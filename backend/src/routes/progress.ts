import { Router } from "express";
import type { Request } from "express";
import {
  listProgressByDevice,
  listProgressByUser,
  upsertProgress,
  deleteProgressRecord,
} from "../../../data/repositories/progressRepository.ts";
import type { ConceptProgress, ProgressStatus } from "../../../data/types.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";
import { HttpError } from "../utils/httpError.ts";
import { getDeviceKey, requireDeviceKey } from "../utils/deviceKey.ts";
import { createRateLimiter } from "../middleware/rateLimiter.ts";
import {
  upsertProgressBodySchema,
  type UpsertProgressBody,
} from "../validation/progressSchemas.ts";
import { attachOptionalUserSession } from "../middleware/attachOptionalUserSession.ts";

type ProgressIdentity = {
  userId: string | null;
  deviceKey: string | null;
};

const router = Router();

router.use(asyncHandler(attachOptionalUserSession));

const progressWriteRateLimiter = createRateLimiter({
  limit: 120,
  windowMs: 60 * 60 * 1000,
  name: "progress-write",
  keyExtractor: (req) => getDeviceKey(req) ?? req.authUser?.id ?? null,
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const identity = resolveProgressIdentity(req);
    const progress = await fetchProgress(identity);
    res.json({
      data: progress,
      meta: {
        fetchedAt: new Date().toISOString(),
        deviceKey: identity.deviceKey,
        userId: identity.userId,
        total: progress.length,
      },
    });
  })
);

router.put(
  "/:conceptId",
  progressWriteRateLimiter,
  asyncHandler(async (req, res) => {
    const identity = resolveProgressIdentity(req);
    const { conceptId } = req.params;
    const parsed = upsertProgressBodySchema.parse(req.body ?? {});

    if (!conceptId || !conceptId.trim()) {
      throw new HttpError(
        400,
        "Provide conceptId path parameter when updating progress.",
        "CONCEPT_ID_REQUIRED"
      );
    }

    const payload = toUpsertPayload(conceptId.trim(), identity, parsed);

    await upsertProgress([payload]);

    res.json({
      data: {
        conceptId: payload.concept_id,
        deviceKey: payload.device_key ?? null,
        userId: payload.user_id ?? null,
        status: (payload.status ?? "learning") as ProgressStatus,
        lastReviewedAt: payload.last_reviewed_at,
      },
      meta: {
        savedAt: new Date().toISOString(),
      },
    });
  })
);

router.delete(
  "/:conceptId",
  progressWriteRateLimiter,
  asyncHandler(async (req, res) => {
    const identity = resolveProgressIdentity(req);
    const { conceptId } = req.params;

    if (!conceptId || !conceptId.trim()) {
      throw new HttpError(
        400,
        "Provide conceptId path parameter when deleting progress.",
        "CONCEPT_ID_REQUIRED"
      );
    }

    await deleteProgressRecord(conceptId.trim(), {
      userId: identity.userId,
      deviceKey: identity.deviceKey,
    });

    res.status(204).end();
  })
);

function toUpsertPayload(
  conceptId: string,
  identity: ProgressIdentity,
  body: UpsertProgressBody
) {
  const baseTimestamp = new Date().toISOString();
  return {
    concept_id: conceptId,
    device_key: identity.deviceKey ?? undefined,
    user_id: identity.userId ?? undefined,
    status: (body.status ?? "learning") as ProgressStatus,
    last_reviewed_at: body.lastReviewedAt ?? baseTimestamp,
  };
}

function resolveProgressIdentity(req: Request): ProgressIdentity {
  const userId = req.authUser?.id ?? null;
  const deviceKey = getDeviceKey(req);

  if (!userId && !deviceKey) {
    const fallback = requireDeviceKey(req);
    return { userId: null, deviceKey: fallback };
  }

  return { userId, deviceKey: deviceKey ?? null };
}

async function fetchProgress(identity: ProgressIdentity) {
  if (identity.userId) {
    const [userProgress, deviceProgress] = await Promise.all([
      listProgressByUser(identity.userId),
      identity.deviceKey ? listProgressByDevice(identity.deviceKey) : Promise.resolve([]),
    ]);

    return mergeProgressRecords(userProgress, deviceProgress);
  }

  if (identity.deviceKey) {
    return listProgressByDevice(identity.deviceKey);
  }

  return [];
}

function mergeProgressRecords(
  primary: ConceptProgress[],
  fallback: ConceptProgress[]
) {
  const seen = new Set(primary.map((entry) => entry.conceptId));
  const merged = [...primary];

  for (const entry of fallback) {
    if (seen.has(entry.conceptId)) {
      continue;
    }
    merged.push(entry);
  }

  return merged;
}

export default router;
