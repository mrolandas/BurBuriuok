/// <reference path="../shims.d.ts" />

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabaseClient";
import type {
  Concept,
  CurriculumItem,
  CurriculumItemRow,
  CurriculumNode,
  CurriculumNodeRow,
} from "../types";
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

  const ordinal = await fetchNextItemOrdinal(serviceClient, node.code);
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

  const offset = ordinals.length;
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
