import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabaseClient";
import type { Concept, UpsertConceptInput } from "../types";
import { mapConceptRow } from "./conceptsMapper";

const TABLE = "concepts";

type ConceptsQueryOptions = {
  sectionCode?: string;
  nodeCode?: string;
  requiredOnly?: boolean;
};

export async function listConcepts(
  client: SupabaseClient | null = null,
  options: ConceptsQueryOptions = {}
): Promise<Concept[]> {
  const supabase = client ?? getSupabaseClient();
  let query = (supabase as any)
    .from(TABLE)
    .select("*")
    .order("section_code", { ascending: true })
    .order("subsection_code", { ascending: true })
    .order("term_lt", { ascending: true });

  if (options.sectionCode) {
    query = query.eq("section_code", options.sectionCode);
  }

  if (options.nodeCode) {
    query = query.eq("curriculum_node_code", options.nodeCode);
  }

  if (options.requiredOnly) {
    query = query.eq("is_required", true);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch concepts: ${error.message}`);
  }

  return (data ?? []).map(mapConceptRow);
}

export async function getConceptBySlug(
  slug: string,
  client: SupabaseClient | null = null
): Promise<Concept | null> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await (supabase as any)
    .from(TABLE)
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(
      `Failed to fetch concept by slug '${slug}': ${error.message}`
    );
  }

  return data ? mapConceptRow(data) : null;
}

export async function upsertConcepts(
  concepts: UpsertConceptInput[],
  client: SupabaseClient | null = null
): Promise<number> {
  if (!concepts.length) {
    return 0;
  }

  const supabase = client ?? getSupabaseClient({ service: true });
  const payload = concepts.map((concept) => ({
    ...concept,
    metadata: concept.metadata ?? {},
  }));

  const { error, count } = await (supabase as any).from(TABLE).upsert(payload, {
    onConflict: "slug",
    ignoreDuplicates: false,
    count: "exact",
  });

  if (error) {
    throw new Error(`Failed to upsert concepts: ${error.message}`);
  }

  return count ?? payload.length;
}
