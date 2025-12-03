import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabaseClient.ts";
import type {
  ConceptProgress,
  ConceptProgressRow,
  ProgressStatus,
  UpsertProgressInput,
} from "../types.ts";

const TABLE = "concept_progress";
const VIEW = "burburiuok_concept_progress";

function mapRow(row: Partial<ConceptProgressRow>): ConceptProgress {
  return {
    conceptId: String(row.concept_id ?? ""),
    deviceKey: row.device_key ?? null,
    userId: row.user_id ?? null,
    status: (row.status as ProgressStatus) ?? "learning",
    lastReviewedAt: String(row.last_reviewed_at ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function listProgressByDevice(
  deviceKey: string,
  client: SupabaseClient | null = null
): Promise<ConceptProgress[]> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await (supabase as any)
    .from(VIEW)
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

export async function listProgressByUser(
  userId: string,
  client: SupabaseClient | null = null
): Promise<ConceptProgress[]> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await (supabase as any)
    .from(VIEW)
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(
      `Failed to load progress for user '${userId}': ${error.message}`
    );
  }

  return (data ?? []).map(mapRow);
}

export async function upsertProgress(
  updates: UpsertProgressInput[],
  client: SupabaseClient | null = null
): Promise<void> {
  if (!updates.length) {
    return;
  }

  const supabase = client ?? getSupabaseClient({ service: true, schema: "burburiuok" });
  const now = new Date().toISOString();
  const byUser: UpsertProgressInput[] = [];
  const byDevice: UpsertProgressInput[] = [];

  for (const update of updates) {
    const normalized = {
      status: "learning",
      ...update,
      last_reviewed_at: update.last_reviewed_at ?? now,
    } satisfies UpsertProgressInput;

    if (normalized.user_id) {
      byUser.push(normalized);
      continue;
    }

    if (normalized.device_key) {
      byDevice.push(normalized);
      continue;
    }

    throw new Error("Cannot upsert progress without user_id or device_key");
  }

  if (byUser.length) {
    const { error } = await (supabase as any)
      .from(TABLE)
      .upsert(byUser, { onConflict: "concept_id,user_id" });

    if (error) {
      throw new Error(`Failed to upsert user concept progress: ${error.message}`);
    }
  }

  if (byDevice.length) {
    const { error } = await (supabase as any)
      .from(TABLE)
      .upsert(byDevice, { onConflict: "concept_id,device_key" });

    if (error) {
      throw new Error(`Failed to upsert device concept progress: ${error.message}`);
    }
  }
}

export async function deleteProgressRecord(
  conceptId: string,
  identity: { userId?: string | null; deviceKey?: string | null },
  client: SupabaseClient | null = null
): Promise<void> {
  if (!identity.userId && !identity.deviceKey) {
    throw new Error("Cannot delete progress without userId or deviceKey");
  }

  const supabase = client ?? getSupabaseClient({ service: true, schema: "burburiuok" });
  let query = (supabase as any).from(TABLE).delete().eq("concept_id", conceptId);

  if (identity.userId) {
    query = query.eq("user_id", identity.userId);
  } else if (identity.deviceKey) {
    query = query.eq("device_key", identity.deviceKey);
  }

  const { error } = await query;

  if (error) {
    throw new Error(`Failed to delete progress record: ${error.message}`);
  }
}
