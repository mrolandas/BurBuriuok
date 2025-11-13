import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabaseClient.ts";
import type {
  ContentDraftDbRow,
  ContentDraftInput,
  ContentEntityType,
} from "../types.ts";

const DRAFTS_TABLE = "content_drafts";

function ensureClient(client: SupabaseClient | null): SupabaseClient {
  return client ?? getSupabaseClient({ service: true, schema: "burburiuok" });
}

export async function upsertContentDraft(
  input: ContentDraftInput,
  client: SupabaseClient | null = null
): Promise<ContentDraftDbRow> {
  const supabase = ensureClient(client);

  const draftRecord: Record<string, unknown> = {
    entity_type: input.entityType,
    entity_primary_key: input.entityPrimaryKey,
    payload: input.payload ?? {},
    status: input.status ?? "draft",
    change_summary: input.changeSummary ?? null,
    version_id: input.versionId ?? null,
    updated_by: input.actor ?? null,
  };

  if (input.actor) {
    draftRecord.created_by = input.actor;
  }

  const { data, error } = await (supabase as any)
    .from(DRAFTS_TABLE)
    .upsert(draftRecord, {
      onConflict: "entity_type,entity_primary_key",
    })
    .select(
      "id, entity_type, entity_primary_key, payload, status, change_summary, version_id, created_by, updated_by, created_at, updated_at"
    )
    .single();

  if (error) {
    throw new Error(
      `Failed to upsert content draft for ${input.entityType} ${input.entityPrimaryKey}: ${error.message}`
    );
  }

  return data as ContentDraftDbRow;
}

export async function deleteContentDraft(
  entityType: ContentEntityType,
  entityPrimaryKey: string,
  client: SupabaseClient | null = null
): Promise<void> {
  const supabase = ensureClient(client);

  const { error } = await (supabase as any)
    .from(DRAFTS_TABLE)
    .delete()
    .eq("entity_type", entityType)
    .eq("entity_primary_key", entityPrimaryKey);

  if (error) {
    throw new Error(
      `Failed to delete content draft for ${entityType} ${entityPrimaryKey}: ${error.message}`
    );
  }
}

export async function getContentDraft(
  entityType: ContentEntityType,
  entityPrimaryKey: string,
  client: SupabaseClient | null = null
): Promise<ContentDraftDbRow | null> {
  const supabase = ensureClient(client);

  const { data, error } = await (supabase as any)
    .from(DRAFTS_TABLE)
    .select(
      "id, entity_type, entity_primary_key, payload, status, change_summary, version_id, created_by, updated_by, created_at, updated_at"
    )
    .eq("entity_type", entityType)
    .eq("entity_primary_key", entityPrimaryKey)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(
      `Failed to load content draft for ${entityType} ${entityPrimaryKey}: ${error.message}`
    );
  }

  return data ? (data as ContentDraftDbRow) : null;
}
