import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabaseClient.ts";
import type { MediaAssetRow } from "../types.ts";

const MEDIA_TABLE = "media_assets";
const CONCEPTS_TABLE = "concepts";

export async function listMediaAssetsByConceptId(
  conceptId: string,
  client: SupabaseClient | null = null
): Promise<MediaAssetRow[]> {
  const supabase = client ?? getSupabaseClient({ service: true, schema: "burburiuok" });

  const { data, error } = await (supabase as any)
    .from(MEDIA_TABLE)
    .select(
      "id, concept_id, asset_type, storage_path, external_url, title, caption_lt, caption_en, created_by, created_at"
    )
    .eq("concept_id", conceptId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch media for concept '${conceptId}': ${error.message}`);
  }

  return (data ?? []) as MediaAssetRow[];
}

export async function listMediaAssetsByConceptSlug(
  slug: string,
  client: SupabaseClient | null = null
): Promise<MediaAssetRow[]> {
  const supabase = client ?? getSupabaseClient({ service: true, schema: "burburiuok" });

  const { data: concept, error: conceptError } = await (supabase as any)
    .from(CONCEPTS_TABLE)
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (conceptError) {
    throw new Error(`Failed to resolve concept '${slug}': ${conceptError.message}`);
  }

  if (!concept) {
    return [];
  }

  return listMediaAssetsByConceptId(concept.id, supabase);
}
