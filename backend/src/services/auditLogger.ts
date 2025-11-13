import {
  recordContentVersion,
} from "../../../data/repositories/contentVersionsRepository.ts";
import type {
  ContentEntityType,
  ContentVersionStatus,
  ContentVersionChangeType,
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
