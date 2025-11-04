import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabaseClient";
import type {
  ContentVersionInput,
  ContentVersionChangeInput,
  ContentVersionChangeType,
} from "../types";

const VERSIONS_TABLE = "content_versions";
const CHANGES_TABLE = "content_version_changes";

interface VersionRow {
  id: string;
}

export async function recordContentVersion(
  input: ContentVersionInput,
  client: SupabaseClient | null = null
): Promise<string> {
  const supabase =
    client ?? getSupabaseClient({ service: true, schema: "burburiuok" });

  const versionPayload = {
    entity_type: input.entityType,
    entity_primary_key: input.entityPrimaryKey,
    status: input.status,
    change_summary: input.changeSummary ?? null,
    diff: input.diff ?? null,
    created_by: input.actor ?? undefined,
  };

  const { data, error } = await (supabase as any)
    .from(VERSIONS_TABLE)
    .insert(versionPayload)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to insert content version: ${error.message}`);
  }

  const versionId = (data as VersionRow | null)?.id;
  if (!versionId) {
    throw new Error("Supabase did not return an id for the inserted content version record.");
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
