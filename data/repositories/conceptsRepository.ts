import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabaseClient.ts";
import type { Concept, UpsertConceptInput } from "../types.ts";
import { mapConceptRow } from "./conceptsMapper.ts";

const PUBLIC_VIEW = "burburiuok_concepts";
const PRIVATE_TABLE = "concepts";

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
    .from(PUBLIC_VIEW)
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
    .from(PUBLIC_VIEW)
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    if (typeof error.message === "string" && error.message.includes("schema cache")) {
      const fallbackClient = client ?? getSupabaseClient({ service: true, schema: "burburiuok" });
      const { data: fallbackData, error: fallbackError } = await (fallbackClient as any)
        .from(PRIVATE_TABLE)
        .select("*")
        .eq("slug", slug)
        .single();

      if (fallbackError) {
        // Also check for no-rows-found in fallback
        if (fallbackError.code === "PGRST116") {
          return null;
        }
        throw new Error(
          `Failed to fetch concept by slug '${slug}' via fallback: ${fallbackError.message}`
        );
      }

      return fallbackData ? mapConceptRow(fallbackData) : null;
    }
    throw new Error(
      `Failed to fetch concept by slug '${slug}': ${error.message}`
    );
  }

  return data ? mapConceptRow(data) : null;
}

export async function findConceptBySectionAndTerm(
  sectionCode: string,
  termLt: string,
  client: SupabaseClient | null = null
): Promise<Concept | null> {
  const supabase = client ?? getSupabaseClient({ service: true, schema: "burburiuok" });
  const { data, error } = await (supabase as any)
    .from(PRIVATE_TABLE)
    .select("*")
    .eq("section_code", sectionCode)
    .eq("term_lt", termLt)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to verify concept uniqueness: ${error.message}`);
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

  const supabase = client ?? getSupabaseClient({ service: true, schema: "burburiuok" });
  const payload = concepts.map((concept) => ({
    ...concept,
    metadata: concept.metadata ?? {},
  }));

  const { error, count } = await (supabase as any).from(PRIVATE_TABLE).upsert(payload, {
    onConflict: "slug",
    ignoreDuplicates: false,
    count: "exact",
  });

  if (error) {
    throw new Error(`Failed to upsert concepts: ${error.message}`);
  }

  return count ?? payload.length;
}
