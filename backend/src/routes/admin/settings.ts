import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import { getSetting, updateSetting, getAppConfig } from "../../../../data/repositories/settingsRepository.ts";

const router = Router();

const updateGlobalSettingsSchema = z.object({
  appTitle: z.string().optional(),
  appDescription: z.string().optional(),
  primaryColor: z.string().optional(),
  welcomeMessage: z.string().optional(),
  registrationEnabled: z.boolean().optional(),
});

router.get(
  "/global",
  asyncHandler(async (_req, res) => {
    const config = await getAppConfig();
    res.json({
      data: config,
      meta: {
        fetchedAt: new Date().toISOString(),
      },
    });
  })
);

router.patch(
  "/global",
  asyncHandler(async (req, res) => {
    const payload = updateGlobalSettingsSchema.parse(req.body);
    const current = await getAppConfig();
    const next = { ...current, ...payload };
    
    await updateSetting("app_config", next, req.authUser?.id ?? null);
    
    res.json({
      data: next,
      meta: {
        updatedAt: new Date().toISOString(),
      },
    });
  })
);

router.get(
  "/registration",
  asyncHandler(async (_req, res) => {
    const config = await getAppConfig();
    res.json({
      data: {
        enabled: config.registrationEnabled,
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
    const payload = z.object({ value: z.boolean() }).parse(req.body);
    const current = await getAppConfig();
    const next = { ...current, registrationEnabled: payload.value };
    
    await updateSetting("app_config", next, req.authUser?.id ?? null);

    res.json({
      data: {
        setting: { value: next.registrationEnabled },
      },
      meta: {
        updatedAt: new Date().toISOString(),
      },
    });
  })
);

router.get(
  "/api-key",
  asyncHandler(async (_req, res) => {
    const key = await getSetting<string | null>("openai_api_key", null);
    res.json({
      data: {
        isSet: !!key,
        masked: key ? `${key.slice(0, 3)}...${key.slice(-4)}` : null
      }
    });
  })
);

router.put(
  "/api-key",
  asyncHandler(async (req, res) => {
    const { key } = z.object({ key: z.string() }).parse(req.body);
    await updateSetting("openai_api_key", key, req.authUser?.id ?? null);
    res.json({ success: true });
  })
);

export default router;
