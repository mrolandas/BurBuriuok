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
  code: string;
  title: string;
  summary: string | null;
  parentCode: string | null;
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

  const { error } = await (serviceClient as any)
    .from(NODE_TABLE)
    .insert({
      code: input.code,
      title: input.title,
      summary: input.summary,
      level,
      parent_code: parentCode,
      ordinal,
    });

  if (error) {
    throw error;
  }

  const created = await getCurriculumNodeByCode(input.code);

  if (!created) {
    throw new Error(
      `Curriculum node '${input.code}' could not be reloaded after creation.`
    );
  }

  return created;
}
