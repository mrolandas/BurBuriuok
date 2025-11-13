import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabaseClient.ts";
import type {
  ContentEntityType,
  ContentVersionInput,
  ContentVersionChangeInput,
  ContentVersionChangeType,
  ContentVersionStatus,
} from "../types.ts";

const VERSIONS_TABLE = "content_versions";
const CHANGES_TABLE = "content_version_changes";

interface VersionRow {
  id: string;
}

export interface ContentVersionDbRow {
  id: string;
  entity_type: ContentEntityType;
  entity_primary_key: string;
  status: ContentVersionStatus | null;
  change_summary: string | null;
  diff: unknown;
  snapshot: unknown;
  created_by: string | null;
  created_at: string;
  version: number | null;
}

export async function recordContentVersion(
  input: ContentVersionInput,
  client: SupabaseClient | null = null
): Promise<string> {
  const supabase =
    client ?? getSupabaseClient({ service: true, schema: "burburiuok" });

  const attemptLimit = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < attemptLimit; attempt += 1) {
    try {
      const version = await resolveNextVersion(
        supabase,
        input.entityType,
        input.entityPrimaryKey
      );

      const versionPayload = {
        entity_type: input.entityType,
        entity_primary_key: input.entityPrimaryKey,
        version,
        status: input.status,
        change_summary: input.changeSummary ?? null,
        diff: input.diff ?? null,
        snapshot: input.snapshot ?? null,
        created_by: input.actor ?? null,
      };

      const { data, error } = await (supabase as any)
        .from(VERSIONS_TABLE)
        .insert(versionPayload)
        .select("id")
        .single();

      if (error) {
        if (isVersionConflict(error)) {
          lastError = new Error(error.message);
          continue;
        }
        throw new Error(`Failed to insert content version: ${error.message}`);
      }

      const versionId = (data as VersionRow | null)?.id;
      if (!versionId) {
        throw new Error(
          "Supabase did not return an id for the inserted content version record."
        );
      }

      if (input.changes && input.changes.length) {
        const changeRows = input.changes.map((change) =>
          toChangeRow(change, versionId, input.actor ?? undefined)
        );
        const { error: changeError } = await (supabase as any)
          .from(CHANGES_TABLE)
          .insert(changeRows);

        if (changeError) {
          throw new Error(
            `Failed to insert content version changes: ${changeError.message}`
          );
        }
      }

      return versionId;
    } catch (error) {
      if (isVersionConflict(error)) {
        lastError = error as Error;
        await delayForContention(attempt);
        continue;
      }
      throw error as Error;
    }
  }

  throw (lastError ?? new Error("Unable to record content version due to repeated conflicts."));
}

async function resolveNextVersion(
  client: SupabaseClient,
  entityType: ContentEntityType,
  entityPrimaryKey: string
): Promise<number> {
  const { data, error } = await (client as any)
    .from(VERSIONS_TABLE)
    .select("version")
    .eq("entity_type", entityType)
    .eq("entity_primary_key", entityPrimaryKey)
    .order("version", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(
      `Failed to resolve next version for ${entityType} ${entityPrimaryKey}: ${error.message}`
    );
  }

  const latest = Array.isArray(data) && data.length ? data[0] : null;
  const latestVersion = Number(latest?.version ?? 0);
  return Number.isFinite(latestVersion) ? latestVersion + 1 : 1;
}

function isVersionConflict(error: unknown): boolean {
  const message = (error as { message?: string })?.message ?? "";
  const code = (error as { code?: string })?.code ?? "";
  return (
    code === "23505" ||
    message.includes("content_versions_entity_version_idx") ||
    message.toLowerCase().includes("duplicate key value")
  );
}

async function delayForContention(attempt: number): Promise<void> {
  const delayMs = 25 * (attempt + 1);
  await new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export async function listContentVersionsForEntity(
  entityType: ContentEntityType,
  entityPrimaryKey: string,
  limit = 20,
  client: SupabaseClient | null = null
): Promise<ContentVersionDbRow[]> {
  const supabase =
    client ?? getSupabaseClient({ service: true, schema: "burburiuok" });

  const { data, error } = await (supabase as any)
    .from(VERSIONS_TABLE)
    .select(
      "id, entity_type, entity_primary_key, status, change_summary, diff, snapshot, created_by, created_at, version"
    )
    .eq("entity_type", entityType)
    .eq("entity_primary_key", entityPrimaryKey)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(
      `Failed to list content versions for ${entityType} ${entityPrimaryKey}: ${error.message}`
    );
  }

  return (data ?? []) as ContentVersionDbRow[];
}

export async function getContentVersionById(
  versionId: string,
  client: SupabaseClient | null = null
): Promise<ContentVersionDbRow | null> {
  const supabase =
    client ?? getSupabaseClient({ service: true, schema: "burburiuok" });

  const { data, error } = await (supabase as any)
    .from(VERSIONS_TABLE)
    .select(
      "id, entity_type, entity_primary_key, status, change_summary, diff, snapshot, created_by, created_at, version"
    )
    .eq("id", versionId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to load content version '${versionId}': ${error.message}`);
  }

  return data ? (data as ContentVersionDbRow) : null;
}

function toChangeRow(
  change: ContentVersionChangeInput,
  versionId: string,
  actor: string | undefined
) {
  const changeType = resolveChangeType(change);
  return {
    version_id: versionId,
    field_path: change.fieldPath,
    old_value: normalizeValue(change.oldValue),
    new_value: normalizeValue(change.newValue),
    change_type: changeType,
    created_by: actor,
  };
}

function resolveChangeType(change: ContentVersionChangeInput): ContentVersionChangeType {
  if (change.changeType) {
    return change.changeType;
  }

  const previousMissing = typeof change.oldValue === "undefined";
  const nextMissing = typeof change.newValue === "undefined";

  if (previousMissing && !nextMissing) {
    return "create";
  }

  if (!previousMissing && nextMissing) {
    return "delete";
  }

  return "update";
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "undefined") {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}
