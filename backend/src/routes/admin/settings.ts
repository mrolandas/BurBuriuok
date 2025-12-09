import { Router } from "express";
import { z } from "zod";
import OpenAI from "openai";
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

const aiConfigSchema = z.object({
  provider: z.enum(['openai', 'gemini', 'openrouter']),
  apiKey: z.string(),
  model: z.string().optional()
});

router.get(
  "/ai-config",
  asyncHandler(async (_req, res) => {
    const config = await getSetting("ai_config", { provider: 'openai', apiKey: '', model: '' });
    res.json({
      data: {
        provider: config.provider,
        isSet: !!config.apiKey,
        maskedKey: config.apiKey ? `${config.apiKey.slice(0, 3)}...${config.apiKey.slice(-4)}` : null,
        model: config.model
      }
    });
  })
);

router.put(
  "/ai-config",
  asyncHandler(async (req, res) => {
    const payload = aiConfigSchema.parse(req.body);
    await updateSetting("ai_config", payload, req.authUser?.id ?? null);
    res.json({ success: true });
  })
);

import { createChatCompletion } from "../../services/llmProvider.ts";

router.post(
  "/test-ai",
  asyncHandler(async (req, res) => {
    // Allow testing with provided credentials OR saved credentials
    let config = req.body.apiKey ? req.body : await getSetting("ai_config", null);
    
    if (!config || !config.apiKey) {
      res.status(400).json({ error: "Configuration not set" });
      return;
    }

    try {
      // Simple test message
      await createChatCompletion(config, [{ role: 'user', content: 'Hello' }]);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  })
);

export default router;
