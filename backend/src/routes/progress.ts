import { Router } from "express";
import {
  listProgressByDevice,
  upsertProgress,
  deleteProgressRecord,
} from "../../../data/repositories/progressRepository.ts";
import type { ProgressStatus } from "../../../data/types.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";
import { HttpError } from "../utils/httpError.ts";
import { getDeviceKey, requireDeviceKey } from "../utils/deviceKey.ts";
import { createRateLimiter } from "../middleware/rateLimiter.ts";
import {
  upsertProgressBodySchema,
  type UpsertProgressBody,
} from "../validation/progressSchemas.ts";

const router = Router();

const progressWriteRateLimiter = createRateLimiter({
  limit: 120,
  windowMs: 60 * 60 * 1000,
  name: "progress-write",
  keyExtractor: (req) => getDeviceKey(req),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const deviceKey = requireDeviceKey(req);
    const progress = await listProgressByDevice(deviceKey);
    res.json({
      data: progress,
      meta: {
        fetchedAt: new Date().toISOString(),
        deviceKey,
        total: progress.length,
      },
    });
  })
);

router.put(
  "/:conceptId",
  progressWriteRateLimiter,
  asyncHandler(async (req, res) => {
    const deviceKey = requireDeviceKey(req);
    const { conceptId } = req.params;
    const parsed = upsertProgressBodySchema.parse(req.body ?? {});

    if (!conceptId || !conceptId.trim()) {
      throw new HttpError(
        400,
        "Provide conceptId path parameter when updating progress.",
        "CONCEPT_ID_REQUIRED"
      );
    }

    const payload = toUpsertPayload(conceptId.trim(), deviceKey, parsed);

    await upsertProgress([payload]);

    res.json({
      data: {
        conceptId: payload.concept_id,
        deviceKey: payload.device_key,
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
    const deviceKey = requireDeviceKey(req);
    const { conceptId } = req.params;

    if (!conceptId || !conceptId.trim()) {
      throw new HttpError(
        400,
        "Provide conceptId path parameter when deleting progress.",
        "CONCEPT_ID_REQUIRED"
      );
    }

    await deleteProgressRecord(conceptId.trim(), deviceKey);

    res.status(204).end();
  })
);

function toUpsertPayload(
  conceptId: string,
  deviceKey: string,
  body: UpsertProgressBody
) {
  const baseTimestamp = new Date().toISOString();
  return {
    concept_id: conceptId,
    device_key: deviceKey,
    status: (body.status ?? "learning") as ProgressStatus,
    last_reviewed_at: body.lastReviewedAt ?? baseTimestamp,
  };
}

export default router;
