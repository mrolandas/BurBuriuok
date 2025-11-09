/// <reference path="../shims.d.ts" />

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabaseClient";
import type {
  CurriculumItem,
  CurriculumItemRow,
  CurriculumNode,
  CurriculumNodeRow,
} from "../types";

const NODE_VIEW = "burburiuok_curriculum_nodes";
const ITEM_VIEW = "burburiuok_curriculum_items";
const NODE_TABLE = "curriculum_nodes";
const SERVICE_SCHEMA = "burburiuok";
const MAX_CODE_LENGTH = 64;
const diacriticRegex = /[\u0300-\u036f]/g;

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

export async function deleteCurriculumNodeAdmin(code: string): Promise<CurriculumNode> {
  const serviceClient = getServiceClient();
  const existing = await getCurriculumNodeByCode(code);

  if (!existing) {
    throw new Error(`Curriculum node '${code}' was not found.`);
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
