import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import { getSetting, updateSetting } from "../../../../data/repositories/settingsRepository.ts";

const router = Router();

const updateSettingSchema = z.object({
  value: z.any(),
});

router.get(
  "/registration",
  asyncHandler(async (_req, res) => {
    const enabled = await getSetting("registration_enabled", true);
    res.json({
      data: {
        enabled,
      },
      meta: {
        fetchedAt: new Date().toISOString(),
      },
    });
  })
);

router.patch(
  "/registration",
  asyncHandler(async (req, res) => {
    const payload = updateSettingSchema.parse(req.body);
    const updated = await updateSetting(
      "registration_enabled",
      payload.value,
      req.authUser?.id ?? null
    );

    res.json({
      data: {
        setting: updated,
      },
      meta: {
        updatedAt: new Date().toISOString(),
      },
    });
  })
);

export default router;
