import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabaseClient.ts";

export async function resetContent(client: SupabaseClient | null = null): Promise<void> {
  const supabase = client ?? getSupabaseClient({ service: true, schema: "burburiuok" });

  // 1. Delete all concepts.
  // This will cascade to:
  // - media_assets (on delete cascade)
  // - concept_progress (on delete cascade)
  // - curriculum_dependencies (where source/prereq is concept)
  const { error: conceptsError } = await supabase
    .from("concepts")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (conceptsError) {
    throw new Error(`Failed to reset concepts: ${conceptsError.message}`);
  }

  // 2. Delete all curriculum nodes.
  // This will cascade to:
  // - curriculum_items (on delete cascade)
  // - child curriculum_nodes (on delete cascade)
  // - curriculum_dependencies (where source/prereq is node)
  const { error: nodesError } = await supabase
    .from("curriculum_nodes")
    .delete()
    .neq("code", "_");

  if (nodesError) {
    throw new Error(`Failed to reset curriculum nodes: ${nodesError.message}`);
  }

  // 3. Delete all content versions (orphaned history)
  const { error: versionsError } = await supabase
    .from("content_versions")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (versionsError) {
    throw new Error(`Failed to reset content versions: ${versionsError.message}`);
  }
}
