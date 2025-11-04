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
