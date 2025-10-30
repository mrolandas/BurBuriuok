import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabaseClient";

export type ProgressStatus = "learning" | "known" | "review";

export interface ConceptProgressRecord {
  conceptId: string;
  deviceKey: string;
  status: ProgressStatus;
  lastReviewedAt: string;
  createdAt: string;
  updatedAt: string;
}

const TABLE = "concept_progress";

function mapRow(row: Record<string, unknown>): ConceptProgressRecord {
  return {
    conceptId: String(row.concept_id),
    deviceKey: String(row.device_key),
    status: (row.status as ProgressStatus) ?? "learning",
    lastReviewedAt: String(row.last_reviewed_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listProgressByDevice(
  deviceKey: string,
  client: SupabaseClient | null = null
): Promise<ConceptProgressRecord[]> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await (supabase as any)
    .from(TABLE)
    .select("*")
    .eq("device_key", deviceKey)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(
      `Failed to load progress for device '${deviceKey}': ${error.message}`
    );
  }

  return (data ?? []).map(mapRow);
}

export interface UpsertProgressInput {
  concept_id: string;
  device_key: string;
  status?: ProgressStatus;
  last_reviewed_at?: string;
}

export async function upsertProgress(
  updates: UpsertProgressInput[],
  client: SupabaseClient | null = null
): Promise<void> {
  if (!updates.length) {
    return;
  }

  const supabase = client ?? getSupabaseClient({ service: true });
  const payload = updates.map((update) => ({
    status: "learning",
    ...update,
    last_reviewed_at: update.last_reviewed_at ?? new Date().toISOString(),
  }));

  const { error } = await (supabase as any)
    .from(TABLE)
    .upsert(payload, { onConflict: "concept_id,device_key" });

  if (error) {
    throw new Error(`Failed to upsert concept progress: ${error.message}`);
  }
}

export async function deleteProgressRecord(
  conceptId: string,
  deviceKey: string,
  client: SupabaseClient | null = null
): Promise<void> {
  const supabase = client ?? getSupabaseClient({ service: true });
  const { error } = await (supabase as any)
    .from(TABLE)
    .delete()
    .eq("concept_id", conceptId)
    .eq("device_key", deviceKey);

  if (error) {
    throw new Error(`Failed to delete progress record: ${error.message}`);
  }
}
