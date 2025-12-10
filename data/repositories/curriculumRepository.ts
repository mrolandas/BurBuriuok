/// <reference path="../shims.d.ts" />

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabaseClient.ts";
import type {
  Concept,
  CurriculumItem,
  CurriculumItemRow,
  CurriculumNode,
  CurriculumNodeRow,
} from "../types.ts";
import {
  findConceptBySectionAndTerm,
  getConceptBySlug,
  upsertConcepts,
} from "./conceptsRepository";

const NODE_VIEW = "burburiuok_curriculum_nodes";
const ITEM_VIEW = "burburiuok_curriculum_items";
const NODE_TABLE = "curriculum_nodes";
const ITEM_TABLE = "curriculum_items";
const CONCEPTS_TABLE = "concepts";
const SERVICE_SCHEMA = "burburiuok";
const MAX_CODE_LENGTH = 64;
const MAX_CONCEPT_SLUG_LENGTH = 90;
const diacriticRegex = /[\u0300-\u036f]/g;

type DuplicateConceptError = Error & {
  code: "CONCEPT_ALREADY_EXISTS";
  concept: Concept;
};

function mapNodeRow(row: Partial<CurriculumNodeRow>): CurriculumNode {
  return {
    code: String(row.code ?? ""),
    title: String(row.title ?? ""),
    summary: row.summary ?? null,
    level: Number(row.level ?? 0),
    parentCode: row.parent_code ?? null,
    ordinal: Number(row.ordinal ?? 0),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapItemRow(row: Partial<CurriculumItemRow>): CurriculumItem {
  return {
    nodeCode: String(row.node_code ?? ""),
    ordinal: Number(row.ordinal ?? 0),
    label: String(row.label ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function slugifyConceptTerm(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(diacriticRegex, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[&/]/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_CONCEPT_SLUG_LENGTH);
}

function sanitizeNullable(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return value ?? null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

async function conceptSlugExists(client: SupabaseClient, slug: string): Promise<boolean> {
  const { data, error } = await (client as any)
    .from(CONCEPTS_TABLE)
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to verify concept slug uniqueness: ${error.message}`);
  }

  return Boolean(data?.slug);
}

async function ensureUniqueConceptSlug(client: SupabaseClient, base: string): Promise<string> {
  const normalized = slugifyConceptTerm(base);
  let candidate = normalized || "savoka";
  let suffix = 0;

  while (await conceptSlugExists(client, candidate)) {
    suffix += 1;
    const suffixPart = `-${suffix}`;
    const availableLength = MAX_CONCEPT_SLUG_LENGTH - suffixPart.length;
    const prefix = normalized.slice(0, Math.max(1, availableLength));
    candidate = `${prefix}${suffixPart}`.replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (!candidate.length) {
  candidate = `savoka${suffixPart}`.slice(0, MAX_CONCEPT_SLUG_LENGTH);
    }
    if (suffix > 10_000) {
      throw new Error("Unable to generate unique concept slug.");
    }
  }

  return candidate;
}

function createDuplicateConceptError(concept: Concept): DuplicateConceptError {
  const error = new Error(
    `Concept '${concept.slug}' already exists in section '${concept.sectionCode}'.`
  ) as DuplicateConceptError;
  error.code = "CONCEPT_ALREADY_EXISTS";
  error.concept = concept;
  return error;
}

type SectionContext = {
  sectionCode: string;
  sectionTitle: string | null;
  subsectionCode: string | null;
  subsectionTitle: string | null;
};

async function resolveSectionContext(
  client: SupabaseClient,
  node: CurriculumNode
): Promise<SectionContext> {
  const lineage: CurriculumNode[] = [node];
  let current: CurriculumNode | null = node;

  while (current?.parentCode) {
    const parent = await getCurriculumNodeByCode(current.parentCode, client);
    if (!parent) {
      break;
    }
    lineage.push(parent);
    current = parent;
  }

  const sectionNode = lineage[lineage.length - 1];
  const subsectionNode = node.code === sectionNode.code ? null : node;

  return {
    sectionCode: sectionNode.code,
    sectionTitle: sectionNode.title ?? null,
    subsectionCode: subsectionNode ? subsectionNode.code : null,
    subsectionTitle: subsectionNode ? subsectionNode.title ?? null : null,
  } satisfies SectionContext;
}

async function fetchNextItemOrdinal(client: SupabaseClient, nodeCode: string): Promise<number> {
  const { data, error } = await (client as any)
    .from(ITEM_TABLE)
    .select("ordinal")
    .eq("node_code", nodeCode)
    .order("ordinal", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch curriculum item ordinal: ${error.message}`);
  }

  const latest = Array.isArray(data) && data.length ? data[0] : null;
  const rawOrdinal = latest?.ordinal;
  const ordinalNumber =
    typeof rawOrdinal === "number"
      ? rawOrdinal
      : typeof rawOrdinal === "string"
      ? Number.parseInt(rawOrdinal, 10)
      : 0;

  return Number.isFinite(ordinalNumber) ? ordinalNumber + 1 : 1;
}

async function deleteCurriculumItemRecord(
  client: SupabaseClient,
  nodeCode: string,
  ordinal: number
): Promise<void> {
  const { error } = await (client as any)
    .from(ITEM_TABLE)
    .delete()
    .eq("node_code", nodeCode)
    .eq("ordinal", ordinal);

  if (error) {
    throw new Error(`Failed to revert curriculum item insert: ${error.message}`);
  }
}

function getServiceClient(client: SupabaseClient | null = null): SupabaseClient {
  if (client) {
    return client;
  }
  return getSupabaseClient({ service: true, schema: SERVICE_SCHEMA });
}

function applyParentFilter(query: any, parentCode: string | null) {
  if (parentCode) {
    return query.eq("parent_code", parentCode);
  }
  return query.is("parent_code", null);
}

type ResolveCodeOptions = {
  client: SupabaseClient;
  providedCode: string | null;
  parentCode: string | null;
  title: string;
};

async function resolveCurriculumNodeCode({
  client,
  providedCode,
  parentCode,
  title,
}: ResolveCodeOptions): Promise<string> {
  if (providedCode && providedCode.length) {
    return providedCode;
  }

  const base = buildCodeBase(parentCode, title);
  return ensureUniqueCode(client, base);
}

function buildCodeBase(parentCode: string | null, title: string): string {
  const normalized = title
    .normalize("NFD")
    .replace(diacriticRegex, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, Math.max(1, MAX_CODE_LENGTH - 8));

  const fallback = parentCode ? `${parentCode}-poskyris` : "poskyris";
  const candidate = normalized || fallback;

  if (!parentCode) {
    return candidate;
  }

  const combined = `${parentCode}-${candidate}`;
  if (combined.length <= MAX_CODE_LENGTH) {
    return combined;
  }

  const trimmedParent = parentCode.slice(0, Math.max(1, Math.floor(MAX_CODE_LENGTH / 2)));
  const available = MAX_CODE_LENGTH - trimmedParent.length - 1;
  const trimmedCandidate = candidate.slice(0, Math.max(1, available));
  return `${trimmedParent}-${trimmedCandidate}`;
}

async function ensureUniqueCode(client: SupabaseClient, base: string): Promise<string> {
  let suffix = 0;
  let candidate = base.slice(0, MAX_CODE_LENGTH) || "poskyris";

  while (await nodeCodeExists(client, candidate)) {
    suffix += 1;
    const suffixPart = `-${suffix}`;
    const availableLength = MAX_CODE_LENGTH - suffixPart.length;
    const prefix = base.slice(0, availableLength);
    candidate = `${prefix}${suffixPart}`;
    if (!candidate.length) {
      candidate = `poskyris${suffixPart}`.slice(0, MAX_CODE_LENGTH);
    }
    if (suffix > 10_000) {
      throw new Error("Unable to generate unique curriculum node code.");
    }
  }

  return candidate;
}

async function nodeCodeExists(client: SupabaseClient, code: string): Promise<boolean> {
  const { data, error } = await (client as any)
    .from(NODE_TABLE)
    .select("code")
    .eq("code", code)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to verify curriculum code uniqueness: ${error.message}`);
  }

  return Boolean(data?.code);
}

export async function listCurriculumNodes(
  client: SupabaseClient | null = null
): Promise<CurriculumNode[]> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await (supabase as any)
    .from(NODE_VIEW)
    .select("*")
    .order("level", { ascending: true })
    .order("parent_code", { ascending: true, nullsFirst: true })
    .order("ordinal", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch curriculum nodes: ${error.message}`);
  }

  return (data ?? []).map(mapNodeRow);
}

export async function getCurriculumNodeByCode(
  code: string,
  client: SupabaseClient | null = null
): Promise<CurriculumNode | null> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await (supabase as any)
    .from(NODE_VIEW)
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    if (typeof error.message === "string" && error.message.includes("schema cache")) {
      const tableClient = client ?? getServiceClient(null);
      const { data: fallbackData, error: fallbackError } = await (tableClient as any)
        .from(NODE_TABLE)
        .select("*")
        .eq("code", code)
        .maybeSingle();

      if (fallbackError) {
        throw new Error(
          `Failed to fetch curriculum node '${code}' via fallback: ${fallbackError.message}`
        );
      }

      if (!fallbackData) {
        return null;
      }

      return mapNodeRow(fallbackData);
    }
    throw new Error(`Failed to fetch curriculum node '${code}': ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapNodeRow(data);
}

type CurriculumItemOptions = {
  nodeCode?: string;
};

export async function listCurriculumItems(
  client: SupabaseClient | null = null,
  options: CurriculumItemOptions = {}
): Promise<CurriculumItem[]> {
  const supabase = client ?? getSupabaseClient();
  let query = (supabase as any)
    .from(ITEM_VIEW)
    .select("*")
    .order("node_code", { ascending: true })
    .order("ordinal", { ascending: true });

  if (options.nodeCode) {
    query = query.eq("node_code", options.nodeCode);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch curriculum items: ${error.message}`);
  }

  return (data ?? []).map(mapItemRow);
}

export async function listAllCurriculumNodes(
  client: SupabaseClient | null = null
): Promise<CurriculumNode[]> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await (supabase as any)
    .from(NODE_VIEW)
    .select("*")
    .order("code", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch all curriculum nodes: ${error.message}`);
  }

  return (data ?? []).map(mapNodeRow);
}

export async function listCurriculumNodesByParent(
  parentCode: string | null,
  client: SupabaseClient | null = null
): Promise<CurriculumNode[]> {
  const supabase = client ?? getSupabaseClient();
  let query = (supabase as any)
    .from(NODE_VIEW)
    .select("*")
    .order("ordinal", { ascending: true });

  query = applyParentFilter(query, parentCode);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch curriculum nodes by parent: ${error.message}`);
  }

  return (data ?? []).map(mapNodeRow);
}

type SiblingRow = {
  code: string;
  ordinal: number | null;
};

function clampOrdinal(requested: number, maxOrdinal: number): number {
  if (!Number.isFinite(requested) || requested < 1) {
    return maxOrdinal;
  }
  const floored = Math.floor(requested);
  return Math.min(Math.max(floored, 1), maxOrdinal);
}

async function fetchSiblingOrdinals(
  client: SupabaseClient,
  parentCode: string | null
): Promise<SiblingRow[]> {
  let query = (client as any)
    .from(NODE_TABLE)
    .select("code, ordinal")
    .order("ordinal", { ascending: true });

  query = applyParentFilter(query, parentCode);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load sibling ordinals: ${error.message}`);
  }

  return (data ?? []) as SiblingRow[];
}

async function shiftSiblingOrdinals(
  client: SupabaseClient,
  parentCode: string | null,
  startingOrdinal: number
): Promise<void> {
  let query = (client as any)
    .from(NODE_TABLE)
    .select("code, ordinal")
    .order("ordinal", { ascending: false })
    .gte("ordinal", startingOrdinal);

  query = applyParentFilter(query, parentCode);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch sibling ordinals for update: ${error.message}`);
  }

  const siblings = (data ?? []) as SiblingRow[];

  if (!siblings.length) {
    return;
  }

  for (const sibling of siblings) {
    const rawOrdinal =
      typeof sibling.ordinal === "number"
        ? sibling.ordinal
        : typeof sibling.ordinal === "string"
        ? Number.parseInt(sibling.ordinal, 10)
        : null;
    const safeOrdinal = Number.isFinite(rawOrdinal) ? Number(rawOrdinal) : startingOrdinal - 1;
    const nextOrdinal = safeOrdinal + 1;

    const { error: updateError } = await (client as any)
      .from(NODE_TABLE)
      .update({
        ordinal: nextOrdinal,
        updated_at: new Date().toISOString(),
      })
      .eq("code", sibling.code);

    if (updateError) {
      throw new Error(
        `Failed to bump sibling '${sibling.code}' ordinal: ${updateError.message}`
      );
    }
  }
}

export type CreateCurriculumNodeInput = {
  code?: string | null;
  title: string;
  summary: string | null;
  parentCode: string | null;
  ordinal?: number | null;
};

export type UpdateCurriculumNodeInput = {
  title?: string;
  summary?: string | null;
  parentCode?: string | null;
  ordinal?: number | null;
};

export type CreateCurriculumItemInput = {
  nodeCode: string;
  label: string;
  conceptSlug?: string | null;
  termLt?: string | null;
  termEn?: string | null;
  descriptionLt?: string | null;
  descriptionEn?: string | null;
  sourceRef?: string | null;
  isRequired?: boolean | null;
  /** Optional target ordinal. If provided, existing items at and after this ordinal will be shifted. */
  targetOrdinal?: number | null;
};

export type UpdateCurriculumItemInput = {
  termLt?: string | null;
  termEn?: string | null;
  descriptionLt?: string | null;
  descriptionEn?: string | null;
  sourceRef?: string | null;
  label?: string | null;
};

export type ReorderCurriculumItemInput = {
  slug: string;
  newOrdinal: number;
};

export type MoveCurriculumItemInput = {
  slug: string;
  targetNodeCode: string;
  targetOrdinal?: number | null;
};

export type BatchCreateConceptInput = {
  nodeCode: string;
  term: string;
  description?: string | null;
  termEn?: string | null;
  descriptionEn?: string | null;
  slug?: string | null;
};

export type BatchCreateConceptsInput = {
  concepts: BatchCreateConceptInput[];
  dryRun?: boolean;
};

export type BatchCreateConceptResult = {
  slug: string;
  term: string;
  nodeCode: string;
  ordinal: number;
  status: 'created' | 'skipped' | 'failed';
  reason?: string;
};

export type BatchCreateConceptsResult = {
  dryRun: boolean;
  created: BatchCreateConceptResult[];
  skipped: BatchCreateConceptResult[];
  failed: BatchCreateConceptResult[];
  summary: {
    total: number;
    created: number;
    skipped: number;
    failed: number;
  };
};

export type CreateCurriculumItemResult = {
  item: CurriculumItem;
  concept: Concept;
};

export async function createCurriculumNodeAdmin(
  input: CreateCurriculumNodeInput
): Promise<CurriculumNode> {
  const serviceClient = getServiceClient();
  const parentCode = input.parentCode ?? null;

  let level = 1;

  if (parentCode) {
    const parent = await getCurriculumNodeByCode(parentCode);
    if (!parent) {
      const error = new Error(`Parent node '${parentCode}' was not found.`);
      (error as { code?: string }).code = "PARENT_NOT_FOUND";
      throw error;
    }
    level = parent.level + 1;
  }

  const siblings = await fetchSiblingOrdinals(serviceClient, parentCode);
  const maxOrdinal = siblings.length + 1;
  const desiredOrdinal =
    typeof input.ordinal === "number" && Number.isFinite(input.ordinal)
      ? Number(input.ordinal)
      : maxOrdinal;
  const ordinal = clampOrdinal(desiredOrdinal, maxOrdinal);

  if (ordinal <= siblings.length) {
    await shiftSiblingOrdinals(serviceClient, parentCode, ordinal);
  }

  const code = await resolveCurriculumNodeCode({
    client: serviceClient,
    providedCode: typeof input.code === "string" ? input.code.trim() : null,
    parentCode,
    title: input.title,
  });

  const { error } = await (serviceClient as any)
    .from(NODE_TABLE)
    .insert({
      code,
      title: input.title,
      summary: input.summary,
      level,
      parent_code: parentCode,
      ordinal,
    });

  if (error) {
    throw error;
  }

  const created = await getCurriculumNodeByCode(code);

  if (!created) {
    throw new Error(`Curriculum node '${code}' could not be reloaded after creation.`);
  }

  return created;
}

export async function updateCurriculumNodeAdmin(
  code: string,
  input: UpdateCurriculumNodeInput
): Promise<CurriculumNode> {
  const serviceClient = getServiceClient();
  const existing = await getCurriculumNodeByCode(code);

  if (!existing) {
    throw new Error(`Curriculum node '${code}' was not found.`);
  }

  const updates: Record<string, unknown> = {};

  if (typeof input.title === "string") {
    updates.title = input.title.trim();
  }

  if (typeof input.summary !== "undefined") {
    const summaryValue =
      typeof input.summary === "string" ? input.summary.trim() : input.summary ?? null;
    updates.summary = summaryValue && summaryValue.length ? summaryValue : null;
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString();
    const { error } = await (serviceClient as any)
      .from(NODE_TABLE)
      .update(updates)
      .eq("code", code);

    if (error) {
      throw error;
    }
  }

  const hasOrdinalUpdate =
    typeof input.ordinal === "number" && Number.isFinite(input.ordinal);

  if (hasOrdinalUpdate) {
    const siblings = await fetchSiblingOrdinals(serviceClient, existing.parentCode);
    const siblingsWithoutCurrent = siblings.filter((sibling) => sibling.code !== code);
    const targetOrdinal = clampOrdinal(
      Number(input.ordinal),
      siblingsWithoutCurrent.length + 1
    );

    if (targetOrdinal !== existing.ordinal) {
      const orderedCodes = siblingsWithoutCurrent.map((sibling) => sibling.code);
      orderedCodes.splice(targetOrdinal - 1, 0, code);
      await resequenceParentChildren(serviceClient, existing.parentCode, orderedCodes);
    }
  }

  const updated = await getCurriculumNodeByCode(code);

  if (!updated) {
    throw new Error(`Curriculum node '${code}' could not be reloaded after update.`);
  }

  return updated;
}

async function collectSubtreeNodeCodes(rootCode: string): Promise<string[]> {
  const visited = new Set<string>();
  const queue: string[] = [rootCode];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }

    visited.add(current);

    const children = await listCurriculumNodesByParent(current);
    for (const child of children) {
      queue.push(child.code);
    }
  }

  return Array.from(visited);
}

type ConceptSlugRow = {
  slug?: string | null;
};

async function listConceptSlugsForNodes(
  client: SupabaseClient,
  nodeCodes: string[]
): Promise<string[]> {
  if (!nodeCodes.length) {
    return [];
  }

  const { data, error } = await (client as any)
    .from(CONCEPTS_TABLE)
    .select("slug")
    .in("curriculum_node_code", nodeCodes);

  if (error) {
    throw new Error(
      `Failed to fetch concepts for curriculum nodes '${nodeCodes.join(", ")}' to support deletion: ${error.message}`
    );
  }

  const rows = (data as ConceptSlugRow[] | null) ?? [];
  const slugs = rows
    .map((row) => (typeof row.slug === "string" ? row.slug.trim() : ""))
    .filter((slug) => slug.length);

  return Array.from(new Set(slugs));
}

export async function deleteCurriculumNodeAdmin(code: string): Promise<CurriculumNode> {
  const serviceClient = getServiceClient();
  const existing = await getCurriculumNodeByCode(code);

  if (!existing) {
    throw new Error(`Curriculum node '${code}' was not found.`);
  }

  const subtreeNodeCodes = await collectSubtreeNodeCodes(code);
  const conceptSlugs = await listConceptSlugsForNodes(serviceClient, subtreeNodeCodes);

  for (const slug of conceptSlugs) {
    try {
      await deleteCurriculumItemAdminBySlug(slug);
    } catch (error) {
      if ((error as { code?: string }).code === "CONCEPT_NOT_FOUND") {
        continue;
      }
      throw error;
    }
  }

  const { error } = await (serviceClient as any)
    .from(NODE_TABLE)
    .delete()
    .eq("code", code);

  if (error) {
    throw error;
  }

  const siblings = await fetchSiblingOrdinals(serviceClient, existing.parentCode);
  const orderedCodes = siblings.map((sibling) => sibling.code);

  if (orderedCodes.length) {
    await resequenceParentChildren(serviceClient, existing.parentCode, orderedCodes);
  }

  return existing;
}

export async function createCurriculumItemAdmin(
  input: CreateCurriculumItemInput
): Promise<CreateCurriculumItemResult> {
  const serviceClient = getServiceClient();
  const nodeCode = typeof input.nodeCode === "string" ? input.nodeCode.trim() : "";

  if (!nodeCode.length) {
    throw new Error("Curriculum node code is required to create an item.");
  }

  const node = await getCurriculumNodeByCode(nodeCode, serviceClient);

  if (!node) {
    const error = new Error(`Curriculum node '${nodeCode}' was not found.`);
    (error as { code?: string }).code = "NODE_NOT_FOUND";
    throw error;
  }

  const label = input.label?.trim() ?? "";

  if (!label.length) {
    throw new Error("Curriculum item label cannot be empty.");
  }

  const providedSlug =
    typeof input.conceptSlug === "string" && input.conceptSlug.trim().length
      ? input.conceptSlug.trim().toLowerCase()
      : null;
  const termLt = sanitizeNullable(input.termLt) ?? label;
  const termEn = sanitizeNullable(input.termEn);
  const descriptionLt = sanitizeNullable(input.descriptionLt) ?? "Aprašymas bus papildytas vėliau.";
  const descriptionEn = sanitizeNullable(input.descriptionEn);
  const sourceRef = sanitizeNullable(input.sourceRef);
  const isRequired = typeof input.isRequired === "boolean" ? input.isRequired : true;

  // Calculate ordinal: use targetOrdinal if provided, otherwise append
  let ordinal: number;
  const targetOrdinal = typeof input.targetOrdinal === "number" && input.targetOrdinal >= 1 
    ? input.targetOrdinal 
    : null;
  
  if (targetOrdinal) {
    // Insert at specific position - shift existing items at and after targetOrdinal
    const now = new Date().toISOString();
    const { data: existingItems } = await (serviceClient as any)
      .from(ITEM_TABLE)
      .select("ordinal")
      .eq("node_code", node.code)
      .gte("ordinal", targetOrdinal)
      .order("ordinal", { ascending: false });

    // Shift items from highest to lowest to avoid conflicts
    for (const item of (existingItems ?? []) as { ordinal: number }[]) {
      await (serviceClient as any)
        .from(ITEM_TABLE)
        .update({ ordinal: item.ordinal + 1, updated_at: now })
        .eq("node_code", node.code)
        .eq("ordinal", item.ordinal);

      await (serviceClient as any)
        .from(CONCEPTS_TABLE)
        .update({ curriculum_item_ordinal: item.ordinal + 1 })
        .eq("curriculum_node_code", node.code)
        .eq("curriculum_item_ordinal", item.ordinal);
    }
    ordinal = targetOrdinal;
  } else {
    ordinal = await fetchNextItemOrdinal(serviceClient, node.code);
  }

  const slugBase = providedSlug ?? termLt ?? label;
  const slug = await ensureUniqueConceptSlug(serviceClient, slugBase);
  const sectionContext = await resolveSectionContext(serviceClient, node);

  const existingConcept = await findConceptBySectionAndTerm(
    sectionContext.sectionCode,
    termLt,
    serviceClient
  );

  if (existingConcept) {
    throw createDuplicateConceptError(existingConcept);
  }

  let insertedRow: CurriculumItemRow | null = null;

  try {
    const insertPayload = {
      node_code: node.code,
      ordinal,
      label,
    } satisfies Partial<CurriculumItemRow>;

    const { data: inserted, error: insertError } = await (serviceClient as any)
      .from(ITEM_TABLE)
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError) {
      throw insertError;
    }

    insertedRow = inserted as CurriculumItemRow;

    const metadata = {
      status: "draft",
      createdVia: "curriculum-tree",
    } satisfies Record<string, unknown>;

    await upsertConcepts(
      [
        {
          section_code: sectionContext.sectionCode,
          section_title: sectionContext.sectionTitle,
          subsection_code: sectionContext.subsectionCode,
          subsection_title: sectionContext.subsectionTitle,
          slug,
          term_lt: termLt,
          term_en: termEn,
          description_lt: descriptionLt,
          description_en: descriptionEn,
          source_ref: sourceRef,
          metadata,
          is_required: isRequired,
          curriculum_node_code: node.code,
          curriculum_item_ordinal: ordinal,
          curriculum_item_label: label,
        },
      ],
      serviceClient
    );

    const concept = await getConceptBySlug(slug, serviceClient);

    if (!concept) {
      throw new Error(`Concept '${slug}' could not be reloaded after creation.`);
    }

    const item = mapItemRow(insertedRow);

    return {
      item,
      concept,
    } satisfies CreateCurriculumItemResult;
  } catch (error) {
    if (insertedRow) {
      const parsedOrdinal =
        typeof insertedRow.ordinal === "number"
          ? insertedRow.ordinal
          : Number.parseInt(String(insertedRow.ordinal ?? ordinal), 10);
      const rollbackOrdinal = Number.isFinite(parsedOrdinal) ? Number(parsedOrdinal) : ordinal;
      try {
        await deleteCurriculumItemRecord(serviceClient, node.code, rollbackOrdinal);
      } catch (rollbackError) {
        // eslint-disable-next-line no-console
        console.error("Failed to rollback curriculum item insert", {
          nodeCode: node.code,
          ordinal: rollbackOrdinal,
          rollbackError,
        });
      }
    }
    throw error;
  }
}

export type DeleteCurriculumItemAdminResult = {
  concept: Concept;
  item: CurriculumItem | null;
};

export async function deleteCurriculumItemAdminBySlug(
  slug: string
): Promise<DeleteCurriculumItemAdminResult> {
  const serviceClient = getServiceClient();
  const concept = await getConceptBySlug(slug, serviceClient);

  if (!concept) {
    const error = new Error(`Concept '${slug}' was not found.`);
    (error as { code?: string }).code = "CONCEPT_NOT_FOUND";
    throw error;
  }

  let itemRow: CurriculumItemRow | null = null;

  if (
    concept.curriculumNodeCode &&
    typeof concept.curriculumItemOrdinal === "number" &&
    Number.isFinite(concept.curriculumItemOrdinal)
  ) {
    const { data, error } = await (serviceClient as any)
      .from(ITEM_TABLE)
      .select("*")
      .eq("node_code", concept.curriculumNodeCode)
      .eq("ordinal", concept.curriculumItemOrdinal)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw new Error(
        `Failed to fetch curriculum item '${concept.curriculumNodeCode}:${concept.curriculumItemOrdinal}': ${error.message}`
      );
    }

    itemRow = (data as CurriculumItemRow | null) ?? null;
  }

  if (itemRow) {
    const { error: deleteItemError } = await (serviceClient as any)
      .from(ITEM_TABLE)
      .delete()
      .eq("node_code", itemRow.node_code)
      .eq("ordinal", itemRow.ordinal);

    if (deleteItemError) {
      throw new Error(
        `Failed to delete curriculum item '${itemRow.node_code}:${itemRow.ordinal}': ${deleteItemError.message}`
      );
    }

    await resequenceNodeItems(serviceClient, itemRow.node_code);
  }

  const { error: deleteConceptError } = await (serviceClient as any)
    .from(CONCEPTS_TABLE)
    .delete()
    .eq("slug", slug);

  if (deleteConceptError) {
    throw new Error(
      `Failed to delete concept '${slug}': ${deleteConceptError.message}`
    );
  }

  return {
    concept,
    item: itemRow ? mapItemRow(itemRow) : null,
  } satisfies DeleteCurriculumItemAdminResult;
}

export type BatchDeleteResult = {
  deleted: Array<{ slug: string; termLt: string }>;
  failed: Array<{ slug: string; error: string }>;
};

/**
 * Delete multiple concepts by their slugs.
 * More efficient than calling deleteCurriculumItemAdminBySlug multiple times
 * because it groups deletions by node and only resequences once per node.
 */
export async function deleteCurriculumItemsAdminBySlug(
  slugs: string[]
): Promise<BatchDeleteResult> {
  if (!slugs.length) {
    return { deleted: [], failed: [] };
  }

  const serviceClient = getServiceClient();
  const deleted: Array<{ slug: string; termLt: string }> = [];
  const failed: Array<{ slug: string; error: string }> = [];
  const nodesToResequence = new Set<string>();

  for (const slug of slugs) {
    try {
      const concept = await getConceptBySlug(slug, serviceClient);

      if (!concept) {
        failed.push({ slug, error: "Concept not found" });
        continue;
      }

      // Delete curriculum item if exists
      if (
        concept.curriculumNodeCode &&
        typeof concept.curriculumItemOrdinal === "number" &&
        Number.isFinite(concept.curriculumItemOrdinal)
      ) {
        const { error: deleteItemError } = await (serviceClient as any)
          .from(ITEM_TABLE)
          .delete()
          .eq("node_code", concept.curriculumNodeCode)
          .eq("ordinal", concept.curriculumItemOrdinal);

        if (deleteItemError) {
          failed.push({ slug, error: `Failed to delete item: ${deleteItemError.message}` });
          continue;
        }

        nodesToResequence.add(concept.curriculumNodeCode);
      }

      // Delete concept
      const { error: deleteConceptError } = await (serviceClient as any)
        .from(CONCEPTS_TABLE)
        .delete()
        .eq("slug", slug);

      if (deleteConceptError) {
        failed.push({ slug, error: `Failed to delete concept: ${deleteConceptError.message}` });
        continue;
      }

      deleted.push({ slug, termLt: concept.termLt });
    } catch (error: any) {
      failed.push({ slug, error: error.message });
    }
  }

  // Resequence all affected nodes once at the end
  for (const nodeCode of nodesToResequence) {
    try {
      await resequenceNodeItems(serviceClient, nodeCode);
    } catch (error: any) {
      console.error(`Failed to resequence node ${nodeCode}:`, error.message);
    }
  }

  return { deleted, failed };
}

const BATCH_CREATE_MAX_ITEMS = 50;

/**
 * Batch create multiple concepts with guardrails.
 * 
 * Guardrails:
 * 1. Pre-validates ALL items before creating ANY
 * 2. Limits batch size to 50 items
 * 3. Supports dry-run mode to preview what would be created
 * 4. Detects duplicate slugs/terms within batch and against existing content
 * 5. Groups by node for efficient ordinal calculation
 * 6. Returns detailed results for each item
 */
export async function batchCreateCurriculumItemsAdmin(
  input: BatchCreateConceptsInput
): Promise<BatchCreateConceptsResult> {
  const { concepts, dryRun = false } = input;
  const serviceClient = getServiceClient();

  const created: BatchCreateConceptResult[] = [];
  const skipped: BatchCreateConceptResult[] = [];
  const failed: BatchCreateConceptResult[] = [];

  // Guardrail 1: Limit batch size
  if (concepts.length > BATCH_CREATE_MAX_ITEMS) {
    throw new Error(
      `Batch size ${concepts.length} exceeds maximum of ${BATCH_CREATE_MAX_ITEMS}. ` +
      `Split into smaller batches.`
    );
  }

  if (!concepts.length) {
    return {
      dryRun,
      created: [],
      skipped: [],
      failed: [],
      summary: { total: 0, created: 0, skipped: 0, failed: 0 },
    };
  }

  // Phase 1: Pre-validation - collect all info before any writes
  const nodeCache = new Map<string, CurriculumNode>();
  const sectionContextCache = new Map<string, SectionContext>();
  const slugsInBatch = new Set<string>();
  const termsInSection = new Map<string, Set<string>>(); // sectionCode -> terms

  // Validate all nodes exist and build caches
  const uniqueNodeCodes = [...new Set(concepts.map(c => c.nodeCode))];
  for (const nodeCode of uniqueNodeCodes) {
    const node = await getCurriculumNodeByCode(nodeCode, serviceClient);
    if (!node) {
      // All concepts targeting this node will fail
      for (const c of concepts.filter(x => x.nodeCode === nodeCode)) {
        failed.push({
          slug: c.slug ?? slugifyConceptTerm(c.term),
          term: c.term,
          nodeCode: c.nodeCode,
          ordinal: 0,
          status: 'failed',
          reason: `Node '${nodeCode}' not found`,
        });
      }
    } else {
      nodeCache.set(nodeCode, node);
      const sectionContext = await resolveSectionContext(serviceClient, node);
      sectionContextCache.set(nodeCode, sectionContext);
    }
  }

  // Filter out concepts with invalid nodes
  const validConcepts = concepts.filter(c => nodeCache.has(c.nodeCode));

  // Pre-compute ordinals per node
  const nodeOrdinalOffsets = new Map<string, number>();
  for (const nodeCode of nodeCache.keys()) {
    const nextOrdinal = await fetchNextItemOrdinal(serviceClient, nodeCode);
    nodeOrdinalOffsets.set(nodeCode, nextOrdinal);
  }

  // Prepare items with computed slugs and ordinals
  type PreparedItem = {
    input: BatchCreateConceptInput;
    slug: string;
    ordinal: number;
    sectionContext: SectionContext;
    node: CurriculumNode;
    skipReason?: string;
  };

  const preparedItems: PreparedItem[] = [];

  for (const c of validConcepts) {
    const node = nodeCache.get(c.nodeCode)!;
    const sectionContext = sectionContextCache.get(c.nodeCode)!;
    const termLt = c.term.trim();

    // Generate slug
    const slugBase = c.slug?.trim().toLowerCase() ?? termLt;
    let slug = slugifyConceptTerm(slugBase);

    // Guardrail 2: Check for duplicate slug within batch
    if (slugsInBatch.has(slug)) {
      // Try to make it unique with a suffix
      let suffix = 1;
      while (slugsInBatch.has(`${slug}-${suffix}`)) {
        suffix++;
        if (suffix > 100) break;
      }
      slug = `${slug}-${suffix}`;
    }

    // Check if slug already exists in database
    const existingBySlug = await getConceptBySlug(slug, serviceClient);
    if (existingBySlug) {
      skipped.push({
        slug,
        term: termLt,
        nodeCode: c.nodeCode,
        ordinal: 0,
        status: 'skipped',
        reason: `Slug '${slug}' already exists`,
      });
      continue;
    }

    // Guardrail 3: Check for duplicate term in same section
    const sectionTerms = termsInSection.get(sectionContext.sectionCode) ?? new Set();
    if (sectionTerms.has(termLt.toLowerCase())) {
      skipped.push({
        slug,
        term: termLt,
        nodeCode: c.nodeCode,
        ordinal: 0,
        status: 'skipped',
        reason: `Term '${termLt}' already exists in batch for section ${sectionContext.sectionCode}`,
      });
      continue;
    }

    // Check if term exists in database for this section
    const existingByTerm = await findConceptBySectionAndTerm(
      sectionContext.sectionCode,
      termLt,
      serviceClient
    );
    if (existingByTerm) {
      skipped.push({
        slug,
        term: termLt,
        nodeCode: c.nodeCode,
        ordinal: 0,
        status: 'skipped',
        reason: `Term '${termLt}' already exists in section (slug: ${existingByTerm.slug})`,
      });
      continue;
    }

    // Calculate ordinal for this node
    const ordinal = nodeOrdinalOffsets.get(c.nodeCode)!;
    nodeOrdinalOffsets.set(c.nodeCode, ordinal + 1);

    // Mark slug and term as used
    slugsInBatch.add(slug);
    sectionTerms.add(termLt.toLowerCase());
    termsInSection.set(sectionContext.sectionCode, sectionTerms);

    preparedItems.push({
      input: c,
      slug,
      ordinal,
      sectionContext,
      node,
    });
  }

  // If dry-run, return what would be created without actually creating
  if (dryRun) {
    for (const item of preparedItems) {
      created.push({
        slug: item.slug,
        term: item.input.term,
        nodeCode: item.input.nodeCode,
        ordinal: item.ordinal,
        status: 'created',
        reason: 'Would be created (dry-run)',
      });
    }

    return {
      dryRun: true,
      created,
      skipped,
      failed,
      summary: {
        total: concepts.length,
        created: created.length,
        skipped: skipped.length,
        failed: failed.length,
      },
    };
  }

  // Phase 2: Execute creates - group by node for efficiency
  const itemsByNode = new Map<string, PreparedItem[]>();
  for (const item of preparedItems) {
    const nodeItems = itemsByNode.get(item.node.code) ?? [];
    nodeItems.push(item);
    itemsByNode.set(item.node.code, nodeItems);
  }

  for (const [nodeCode, items] of itemsByNode) {
    // Batch insert curriculum_items for this node
    const itemPayloads = items.map(item => ({
      node_code: nodeCode,
      ordinal: item.ordinal,
      label: item.input.term.trim(),
    }));

    const { error: itemsError } = await (serviceClient as any)
      .from(ITEM_TABLE)
      .insert(itemPayloads);

    if (itemsError) {
      // All items for this node failed
      for (const item of items) {
        failed.push({
          slug: item.slug,
          term: item.input.term,
          nodeCode,
          ordinal: item.ordinal,
          status: 'failed',
          reason: `Failed to insert curriculum item: ${itemsError.message}`,
        });
      }
      continue;
    }

    // Batch insert concepts
    const conceptPayloads = items.map(item => ({
      section_code: item.sectionContext.sectionCode,
      section_title: item.sectionContext.sectionTitle,
      subsection_code: item.sectionContext.subsectionCode,
      subsection_title: item.sectionContext.subsectionTitle,
      slug: item.slug,
      term_lt: item.input.term.trim(),
      term_en: item.input.termEn?.trim() ?? null,
      description_lt: item.input.description?.trim() ?? 'Aprašymas bus papildytas vėliau.',
      description_en: item.input.descriptionEn?.trim() ?? null,
      metadata: { status: 'draft', createdVia: 'batch-create' },
      is_required: true,
      curriculum_node_code: nodeCode,
      curriculum_item_ordinal: item.ordinal,
      curriculum_item_label: item.input.term.trim(),
    }));

    const { error: conceptsError } = await (serviceClient as any)
      .from(CONCEPTS_TABLE)
      .insert(conceptPayloads);

    if (conceptsError) {
      // Concepts failed - need to rollback curriculum items
      for (const item of items) {
        await (serviceClient as any)
          .from(ITEM_TABLE)
          .delete()
          .eq('node_code', nodeCode)
          .eq('ordinal', item.ordinal);

        failed.push({
          slug: item.slug,
          term: item.input.term,
          nodeCode,
          ordinal: item.ordinal,
          status: 'failed',
          reason: `Failed to insert concept: ${conceptsError.message}`,
        });
      }
      continue;
    }

    // All items for this node succeeded
    for (const item of items) {
      created.push({
        slug: item.slug,
        term: item.input.term,
        nodeCode,
        ordinal: item.ordinal,
        status: 'created',
      });
    }
  }

  return {
    dryRun: false,
    created,
    skipped,
    failed,
    summary: {
      total: concepts.length,
      created: created.length,
      skipped: skipped.length,
      failed: failed.length,
    },
  };
}

async function resequenceParentChildren(
  client: SupabaseClient,
  parentCode: string | null,
  orderedCodes: string[]
): Promise<void> {
  if (!orderedCodes.length) {
    return;
  }

  const offset = orderedCodes.length;
  const now = new Date().toISOString();

  for (let index = 0; index < orderedCodes.length; index += 1) {
    const code = orderedCodes[index];
    const updateQuery = applyParentFilter(
      (client as any)
        .from(NODE_TABLE)
        .update({
          ordinal: offset + index + 1,
          updated_at: now,
        })
        .eq("code", code),
      parentCode
    );

    const { error: tempError } = await updateQuery;

    if (tempError) {
      throw new Error(
        `Failed to assign temporary ordinal for '${code}': ${tempError.message}`
      );
    }
  }

  for (let index = 0; index < orderedCodes.length; index += 1) {
    const code = orderedCodes[index];
    const updateQuery = applyParentFilter(
      (client as any)
        .from(NODE_TABLE)
        .update({
          ordinal: index + 1,
          updated_at: now,
        })
        .eq("code", code),
      parentCode
    );

    const { error: resequenceError } = await updateQuery;

    if (resequenceError) {
      throw new Error(
        `Failed to resequence ordinal for '${code}': ${resequenceError.message}`
      );
    }
  }
}

async function resequenceNodeItems(
  client: SupabaseClient,
  nodeCode: string
): Promise<void> {
  const { data, error } = await (client as any)
    .from(ITEM_TABLE)
    .select("ordinal")
    .eq("node_code", nodeCode)
    .order("ordinal", { ascending: true });

  if (error) {
    throw new Error(
      `Failed to load curriculum item ordinals for '${nodeCode}': ${error.message}`
    );
  }

  const rows = (data as { ordinal: number }[] | null) ?? [];

  if (!rows.length) {
    return;
  }

  const ordinals = rows
    .map((row) =>
      typeof row.ordinal === "number" && Number.isFinite(row.ordinal)
        ? row.ordinal
        : Number(row.ordinal)
    )
    .filter((value) => Number.isFinite(value)) as number[];

  let requiresResequence = false;

  for (let index = 0; index < ordinals.length; index += 1) {
    if (ordinals[index] !== index + 1) {
      requiresResequence = true;
      break;
    }
  }

  if (!requiresResequence) {
    return;
  }

  // Use the maximum ordinal value as offset to avoid conflicts
  const maxOrdinal = Math.max(...ordinals);
  const offset = maxOrdinal;
  const now = new Date().toISOString();

  for (let index = 0; index < ordinals.length; index += 1) {
    const originalOrdinal = ordinals[index];
    const tempOrdinal = offset + index + 1;

    const { error: tempUpdateError } = await (client as any)
      .from(ITEM_TABLE)
      .update({
        ordinal: tempOrdinal,
        updated_at: now,
      })
      .eq("node_code", nodeCode)
      .eq("ordinal", originalOrdinal);

    if (tempUpdateError) {
      throw new Error(
        `Failed to assign temporary ordinal for '${nodeCode}:${originalOrdinal}': ${tempUpdateError.message}`
      );
    }

    const { error: tempConceptUpdateError } = await (client as any)
      .from(CONCEPTS_TABLE)
      .update({
        curriculum_item_ordinal: tempOrdinal,
      })
      .eq("curriculum_node_code", nodeCode)
      .eq("curriculum_item_ordinal", originalOrdinal);

    if (tempConceptUpdateError) {
      throw new Error(
        `Failed to assign temporary concept ordinal for '${nodeCode}:${originalOrdinal}': ${tempConceptUpdateError.message}`
      );
    }
  }

  for (let index = 0; index < ordinals.length; index += 1) {
    const targetOrdinal = index + 1;
    const tempOrdinal = offset + index + 1;

    const { error: resequenceError } = await (client as any)
      .from(ITEM_TABLE)
      .update({
        ordinal: targetOrdinal,
        updated_at: now,
      })
      .eq("node_code", nodeCode)
      .eq("ordinal", tempOrdinal);

    if (resequenceError) {
      throw new Error(
        `Failed to resequence ordinal for '${nodeCode}:${tempOrdinal}': ${resequenceError.message}`
      );
    }

    const { error: resequenceConceptError } = await (client as any)
      .from(CONCEPTS_TABLE)
      .update({
        curriculum_item_ordinal: targetOrdinal,
      })
      .eq("curriculum_node_code", nodeCode)
      .eq("curriculum_item_ordinal", tempOrdinal);

    if (resequenceConceptError) {
      throw new Error(
        `Failed to resequence concept ordinal for '${nodeCode}:${tempOrdinal}': ${resequenceConceptError.message}`
      );
    }
  }
}

/**
 * Update a concept's content fields (term, description, etc.) by its slug.
 * Does NOT change the concept's position or curriculum association.
 */
export async function updateCurriculumItemAdmin(
  slug: string,
  input: UpdateCurriculumItemInput
): Promise<{ concept: Concept; item: CurriculumItem | null }> {
  const serviceClient = getServiceClient();
  const concept = await getConceptBySlug(slug, serviceClient);

  if (!concept) {
    const error = new Error(`Concept '${slug}' was not found.`);
    (error as { code?: string }).code = "CONCEPT_NOT_FOUND";
    throw error;
  }

  const now = new Date().toISOString();

  // Update concept fields
  const conceptUpdate: Record<string, unknown> = { updated_at: now };
  if (input.termLt !== undefined) conceptUpdate.term_lt = sanitizeNullable(input.termLt) ?? concept.termLt;
  if (input.termEn !== undefined) conceptUpdate.term_en = sanitizeNullable(input.termEn);
  if (input.descriptionLt !== undefined) conceptUpdate.description_lt = sanitizeNullable(input.descriptionLt);
  if (input.descriptionEn !== undefined) conceptUpdate.description_en = sanitizeNullable(input.descriptionEn);
  if (input.sourceRef !== undefined) conceptUpdate.source_ref = sanitizeNullable(input.sourceRef);
  if (input.label !== undefined) conceptUpdate.curriculum_item_label = sanitizeNullable(input.label) ?? concept.curriculumItemLabel;

  const { error: conceptUpdateError } = await (serviceClient as any)
    .from(CONCEPTS_TABLE)
    .update(conceptUpdate)
    .eq("slug", slug);

  if (conceptUpdateError) {
    throw new Error(`Failed to update concept '${slug}': ${conceptUpdateError.message}`);
  }

  // Also update the curriculum_item label if provided and item exists
  let item: CurriculumItem | null = null;
  if (
    input.label !== undefined &&
    concept.curriculumNodeCode &&
    typeof concept.curriculumItemOrdinal === "number"
  ) {
    const newLabel = sanitizeNullable(input.label) ?? concept.curriculumItemLabel ?? concept.termLt;
    const { data: itemData, error: itemUpdateError } = await (serviceClient as any)
      .from(ITEM_TABLE)
      .update({ label: newLabel, updated_at: now })
      .eq("node_code", concept.curriculumNodeCode)
      .eq("ordinal", concept.curriculumItemOrdinal)
      .select("*")
      .single();

    if (itemUpdateError && itemUpdateError.code !== "PGRST116") {
      throw new Error(`Failed to update curriculum item label: ${itemUpdateError.message}`);
    }
    if (itemData) {
      item = mapItemRow(itemData);
    }
  }

  // Reload the updated concept
  const updatedConcept = await getConceptBySlug(slug, serviceClient);
  if (!updatedConcept) {
    throw new Error(`Concept '${slug}' could not be reloaded after update.`);
  }

  return { concept: updatedConcept, item };
}

/**
 * Change the ordinal (position) of a concept within its current curriculum node.
 */
export async function reorderCurriculumItemAdmin(
  input: ReorderCurriculumItemInput
): Promise<{ concept: Concept; item: CurriculumItem }> {
  const serviceClient = getServiceClient();
  const { slug, newOrdinal } = input;

  if (!Number.isFinite(newOrdinal) || newOrdinal < 1) {
    throw new Error("New ordinal must be a positive integer.");
  }

  const concept = await getConceptBySlug(slug, serviceClient);
  if (!concept) {
    const error = new Error(`Concept '${slug}' was not found.`);
    (error as { code?: string }).code = "CONCEPT_NOT_FOUND";
    throw error;
  }

  const nodeCode = concept.curriculumNodeCode;
  const currentOrdinal = concept.curriculumItemOrdinal;

  if (!nodeCode || typeof currentOrdinal !== "number") {
    throw new Error(`Concept '${slug}' is not linked to a curriculum item.`);
  }

  if (currentOrdinal === newOrdinal) {
    // No change needed
    const { data: itemData } = await (serviceClient as any)
      .from(ITEM_TABLE)
      .select("*")
      .eq("node_code", nodeCode)
      .eq("ordinal", currentOrdinal)
      .single();
    return { concept, item: mapItemRow(itemData) };
  }

  // Get all items in this node ordered by ordinal
  const { data: allItems, error: fetchError } = await (serviceClient as any)
    .from(ITEM_TABLE)
    .select("ordinal, label")
    .eq("node_code", nodeCode)
    .order("ordinal", { ascending: true });

  if (fetchError) {
    throw new Error(`Failed to fetch items for reordering: ${fetchError.message}`);
  }

  const items = (allItems ?? []) as { ordinal: number; label: string }[];
  const itemCount = items.length;
  // Use actual max ordinal value, not count (in case of gaps)
  const actualMaxOrdinal = items.length > 0 ? Math.max(...items.map(i => i.ordinal)) : 0;
  const targetOrdinal = Math.min(newOrdinal, itemCount); // Target based on item count (1 to N)

  const now = new Date().toISOString();
  const tempOrdinal = actualMaxOrdinal + 1000; // Temporary ordinal to avoid conflicts

  // Step 1: Move current item to temp ordinal
  await (serviceClient as any)
    .from(ITEM_TABLE)
    .update({ ordinal: tempOrdinal, updated_at: now })
    .eq("node_code", nodeCode)
    .eq("ordinal", currentOrdinal);

  await (serviceClient as any)
    .from(CONCEPTS_TABLE)
    .update({ curriculum_item_ordinal: tempOrdinal })
    .eq("curriculum_node_code", nodeCode)
    .eq("curriculum_item_ordinal", currentOrdinal);

  // Step 2: Shift items between old and new position
  if (targetOrdinal < currentOrdinal) {
    // Moving up: shift items down (increase ordinal) from targetOrdinal to currentOrdinal-1
    for (let ord = currentOrdinal - 1; ord >= targetOrdinal; ord--) {
      await (serviceClient as any)
        .from(ITEM_TABLE)
        .update({ ordinal: ord + 1, updated_at: now })
        .eq("node_code", nodeCode)
        .eq("ordinal", ord);

      await (serviceClient as any)
        .from(CONCEPTS_TABLE)
        .update({ curriculum_item_ordinal: ord + 1 })
        .eq("curriculum_node_code", nodeCode)
        .eq("curriculum_item_ordinal", ord);
    }
  } else {
    // Moving down: shift items up (decrease ordinal) from currentOrdinal+1 to targetOrdinal
    for (let ord = currentOrdinal + 1; ord <= targetOrdinal; ord++) {
      await (serviceClient as any)
        .from(ITEM_TABLE)
        .update({ ordinal: ord - 1, updated_at: now })
        .eq("node_code", nodeCode)
        .eq("ordinal", ord);

      await (serviceClient as any)
        .from(CONCEPTS_TABLE)
        .update({ curriculum_item_ordinal: ord - 1 })
        .eq("curriculum_node_code", nodeCode)
        .eq("curriculum_item_ordinal", ord);
    }
  }

  // Step 3: Move item from temp to target ordinal
  const { data: movedItem, error: finalMoveError } = await (serviceClient as any)
    .from(ITEM_TABLE)
    .update({ ordinal: targetOrdinal, updated_at: now })
    .eq("node_code", nodeCode)
    .eq("ordinal", tempOrdinal)
    .select("*")
    .single();

  if (finalMoveError) {
    throw new Error(`Failed to finalize reorder: ${finalMoveError.message}`);
  }

  await (serviceClient as any)
    .from(CONCEPTS_TABLE)
    .update({ curriculum_item_ordinal: targetOrdinal })
    .eq("curriculum_node_code", nodeCode)
    .eq("curriculum_item_ordinal", tempOrdinal);

  // Resequence all items to compact ordinals (1, 2, 3, ...) and close any gaps
  await resequenceNodeItems(serviceClient, nodeCode);

  const updatedConcept = await getConceptBySlug(slug, serviceClient);
  if (!updatedConcept) {
    throw new Error(`Concept '${slug}' could not be reloaded after reorder.`);
  }

  return { concept: updatedConcept, item: mapItemRow(movedItem) };
}

/**
 * Move a concept from one curriculum node to another.
 */
export async function moveCurriculumItemAdmin(
  input: MoveCurriculumItemInput
): Promise<{ concept: Concept; item: CurriculumItem }> {
  const serviceClient = getServiceClient();
  const { slug, targetNodeCode, targetOrdinal } = input;

  const concept = await getConceptBySlug(slug, serviceClient);
  if (!concept) {
    const error = new Error(`Concept '${slug}' was not found.`);
    (error as { code?: string }).code = "CONCEPT_NOT_FOUND";
    throw error;
  }

  const sourceNodeCode = concept.curriculumNodeCode;
  const sourceOrdinal = concept.curriculumItemOrdinal;

  if (!sourceNodeCode || typeof sourceOrdinal !== "number") {
    throw new Error(`Concept '${slug}' is not linked to a curriculum item.`);
  }

  // Validate target node exists
  const targetNode = await getCurriculumNodeByCode(targetNodeCode, serviceClient);
  if (!targetNode) {
    const error = new Error(`Target node '${targetNodeCode}' was not found.`);
    (error as { code?: string }).code = "NODE_NOT_FOUND";
    throw error;
  }

  if (sourceNodeCode === targetNodeCode) {
    // Same node - just reorder
    if (targetOrdinal && targetOrdinal !== sourceOrdinal) {
      return reorderCurriculumItemAdmin({ slug, newOrdinal: targetOrdinal });
    }
    // No change needed
    const { data: itemData } = await (serviceClient as any)
      .from(ITEM_TABLE)
      .select("*")
      .eq("node_code", sourceNodeCode)
      .eq("ordinal", sourceOrdinal)
      .single();
    return { concept, item: mapItemRow(itemData) };
  }

  const now = new Date().toISOString();

  // Get the item label from the source
  const { data: sourceItemData } = await (serviceClient as any)
    .from(ITEM_TABLE)
    .select("*")
    .eq("node_code", sourceNodeCode)
    .eq("ordinal", sourceOrdinal)
    .single();

  const sourceItem = sourceItemData as CurriculumItemRow | null;
  const label = sourceItem?.label ?? concept.termLt;

  // Calculate target ordinal (append if not specified)
  const newOrdinal = targetOrdinal ?? (await fetchNextItemOrdinal(serviceClient, targetNodeCode));

  // Resolve section context for the target node
  const sectionContext = await resolveSectionContext(serviceClient, targetNode);

  // Step 1: Delete the item from source node
  await (serviceClient as any)
    .from(ITEM_TABLE)
    .delete()
    .eq("node_code", sourceNodeCode)
    .eq("ordinal", sourceOrdinal);

  // Step 2: Resequence source node
  await resequenceNodeItems(serviceClient, sourceNodeCode);

  // Step 3: Make room in target node if inserting at a specific position
  if (targetOrdinal) {
    // Shift existing items at and after targetOrdinal
    const { data: targetItems } = await (serviceClient as any)
      .from(ITEM_TABLE)
      .select("ordinal")
      .eq("node_code", targetNodeCode)
      .gte("ordinal", targetOrdinal)
      .order("ordinal", { ascending: false });

    for (const ti of (targetItems ?? []) as { ordinal: number }[]) {
      await (serviceClient as any)
        .from(ITEM_TABLE)
        .update({ ordinal: ti.ordinal + 1, updated_at: now })
        .eq("node_code", targetNodeCode)
        .eq("ordinal", ti.ordinal);

      await (serviceClient as any)
        .from(CONCEPTS_TABLE)
        .update({ curriculum_item_ordinal: ti.ordinal + 1 })
        .eq("curriculum_node_code", targetNodeCode)
        .eq("curriculum_item_ordinal", ti.ordinal);
    }
  }

  // Step 4: Insert new item in target node
  const { data: newItemData, error: insertError } = await (serviceClient as any)
    .from(ITEM_TABLE)
    .insert({
      node_code: targetNodeCode,
      ordinal: newOrdinal,
      label,
    })
    .select("*")
    .single();

  if (insertError) {
    throw new Error(`Failed to insert item in target node: ${insertError.message}`);
  }

  // Step 5: Update concept to point to new location
  const { error: conceptUpdateError } = await (serviceClient as any)
    .from(CONCEPTS_TABLE)
    .update({
      curriculum_node_code: targetNodeCode,
      curriculum_item_ordinal: newOrdinal,
      section_code: sectionContext.sectionCode,
      section_title: sectionContext.sectionTitle,
      subsection_code: sectionContext.subsectionCode,
      subsection_title: sectionContext.subsectionTitle,
      updated_at: now,
    })
    .eq("slug", slug);

  if (conceptUpdateError) {
    throw new Error(`Failed to update concept location: ${conceptUpdateError.message}`);
  }

  // Resequence target node to ensure ordinals are compact (1, 2, 3, ...)
  await resequenceNodeItems(serviceClient, targetNodeCode);

  const updatedConcept = await getConceptBySlug(slug, serviceClient);
  if (!updatedConcept) {
    throw new Error(`Concept '${slug}' could not be reloaded after move.`);
  }

  return { concept: updatedConcept, item: mapItemRow(newItemData) };
}
