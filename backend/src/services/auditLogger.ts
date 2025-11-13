import {
  recordContentVersion,
} from "../../../data/repositories/contentVersionsRepository.ts";
import {
  deleteContentDraft,
  upsertContentDraft,
} from "../../../data/repositories/contentDraftsRepository.ts";
import type {
  ContentEntityType,
  ContentVersionStatus,
  ContentVersionChangeType,
  ContentDraftStatus,
} from "../../../data/types.ts";

export interface ContentMutationPayload<T extends Record<string, unknown>> {
  entityType: ContentEntityType;
  entityId: string;
  after: T;
  before?: T | null;
  actor?: string | null;
  status?: ContentVersionStatus;
  changeSummary?: string | null;
}

export interface DiffOperation {
  path: string;
  previous: unknown;
  next: unknown;
  changeType: ContentVersionChangeType;
}

export async function logContentMutation<T extends Record<string, unknown>>(
  payload: ContentMutationPayload<T>
): Promise<string> {
  const operations = buildDiffOperations(payload.before ?? undefined, payload.after);
  const normalizedDiff = operations.map((op) => ({
    path: op.path,
    changeType: op.changeType,
    previous: normalizeForJson(op.previous),
    next: normalizeForJson(op.next),
  }));

  const versionId = await recordContentVersion({
    entityType: payload.entityType,
    entityPrimaryKey: payload.entityId,
    status: payload.status,
    changeSummary: payload.changeSummary,
    diff: normalizedDiff.length ? normalizedDiff : [],
    snapshot: serializeSnapshot(payload.after),
    actor: payload.actor ?? null,
    changes: operations.map((op) => ({
      fieldPath: op.path,
      oldValue: op.previous,
      newValue: op.next,
      changeType: op.changeType,
    })),
  });

  await reconcileContentDraft({
    entityType: payload.entityType,
    entityId: payload.entityId,
    status: payload.status,
    actor: payload.actor ?? null,
    changeSummary: payload.changeSummary ?? null,
    snapshot: serializeSnapshot(payload.after),
    versionId,
  });

  return versionId;
}

export function buildDiffOperations(
  before: unknown,
  after: unknown,
  path = ""
): DiffOperation[] {
  const normalizedPath = path || "$";

  if (typeof before === "undefined" && typeof after === "undefined") {
    return [];
  }

  if (typeof before === "undefined") {
    if (isPlainObject(after)) {
      const entries = Object.entries(after as Record<string, unknown>);
      if (!entries.length) {
        return [buildOperation(normalizedPath, undefined, after)];
      }
      return entries.flatMap(([key, value]) =>
        buildDiffOperations(undefined, value, joinPath(path, key))
      );
    }

    if (Array.isArray(after)) {
      if (!after.length) {
        return [buildOperation(normalizedPath, undefined, after)];
      }
      return [buildOperation(normalizedPath, undefined, after)];
    }

    return [buildOperation(normalizedPath, undefined, after)];
  }

  if (typeof after === "undefined") {
    if (isPlainObject(before)) {
      const entries = Object.entries(before as Record<string, unknown>);
      if (!entries.length) {
        return [buildOperation(normalizedPath, before, undefined)];
      }
      return entries.flatMap(([key, value]) =>
        buildDiffOperations(value, undefined, joinPath(path, key))
      );
    }

    if (Array.isArray(before)) {
      if (!before.length) {
        return [buildOperation(normalizedPath, before, undefined)];
      }
      return [buildOperation(normalizedPath, before, undefined)];
    }

    return [buildOperation(normalizedPath, before, undefined)];
  }

  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([
      ...Object.keys(before as Record<string, unknown>),
      ...Object.keys(after as Record<string, unknown>),
    ]);
    const diffs: DiffOperation[] = [];
    for (const key of keys) {
      diffs.push(
        ...buildDiffOperations(
          (before as Record<string, unknown>)[key],
          (after as Record<string, unknown>)[key],
          joinPath(path, key)
        )
      );
    }
    return diffs;
  }

  if (Array.isArray(before) || Array.isArray(after)) {
    if (JSON.stringify(before) === JSON.stringify(after)) {
      return [];
    }
    return [buildOperation(normalizedPath, before, after)];
  }

  if (Object.is(before, after)) {
    return [];
  }

  return [buildOperation(normalizedPath, before, after)];
}

function buildOperation(
  path: string,
  previous: unknown,
  next: unknown
): DiffOperation {
  const previousMissing = typeof previous === "undefined";
  const nextMissing = typeof next === "undefined";

  let changeType: ContentVersionChangeType;
  if (previousMissing && !nextMissing) {
    changeType = "create";
  } else if (!previousMissing && nextMissing) {
    changeType = "delete";
  } else {
    changeType = "update";
  }

  return {
    path,
    previous,
    next,
    changeType,
  };
}

function joinPath(parent: string, key: string): string {
  return parent ? `${parent}.${key}` : key;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function normalizeForJson(value: unknown): unknown {
  if (typeof value === "undefined") {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function serializeSnapshot(value: unknown): unknown {
  if (typeof value === "undefined") {
    return null;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "object") {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("Failed to serialize snapshot for content version", error);
    }
  }

  return value;
}

async function reconcileContentDraft(options: {
  entityType: ContentEntityType;
  entityId: string;
  status?: ContentVersionStatus;
  actor: string | null;
  changeSummary: string | null;
  snapshot: unknown;
  versionId: string;
}): Promise<void> {
  const shouldPersist = needsDraftPersistence(options.status);
  const hasPayload = hasPersistableSnapshot(options.snapshot);

  if (shouldPersist && hasPayload) {
    await upsertContentDraft({
      entityType: options.entityType,
      entityPrimaryKey: options.entityId,
      payload: options.snapshot ?? {},
      status: toDraftStatus(options.status),
      changeSummary: options.changeSummary,
      versionId: options.versionId,
      actor: options.actor ?? undefined,
    });
    return;
  }

  await deleteContentDraft(options.entityType, options.entityId);
}

function needsDraftPersistence(status?: ContentVersionStatus): boolean {
  return status === "draft" || status === "in_review" || typeof status === "undefined";
}

function toDraftStatus(status?: ContentVersionStatus): ContentDraftStatus {
  if (status === "in_review") {
    return "in_review";
  }
  return "draft";
}

function hasPersistableSnapshot(snapshot: unknown): boolean {
  if (snapshot === null || typeof snapshot === "undefined") {
    return false;
  }

  if (Array.isArray(snapshot)) {
    return snapshot.length > 0;
  }

  if (typeof snapshot === "object") {
    return Object.keys(snapshot as Record<string, unknown>).length > 0;
  }

  return true;
}
