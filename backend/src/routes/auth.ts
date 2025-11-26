import { Router } from "express";
import { getSupabaseClient } from "../../../data/supabaseClient.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";
import { HttpError } from "../utils/httpError.ts";
import { createRateLimiter } from "../middleware/rateLimiter.ts";
import { extractBearerToken } from "../utils/authHeaders.ts";
import { magicLinkRequestSchema } from "../validation/authSchemas.ts";
import {
  buildRedirectUrl,
  getRequiredAuthEnv,
  sanitizeRedirectTarget,
} from "../utils/authRedirect.ts";

const router = Router();

type MinimalSupabaseAuthUser = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> & { app_role?: string };
};

type MagicLinkSupabaseClient = {
  auth: {
    signInWithOtp: (params: {
      email: string;
      options?: {
        emailRedirectTo?: string;
        shouldCreateUser?: boolean;
      };
    }) => Promise<{ data: unknown; error: Error | null }>;
    getUser: (token: string) => Promise<{
      data: { user: MinimalSupabaseAuthUser | null };
      error: Error | null;
    }>;
  };
};

const magicLinkRateLimiter = createRateLimiter({
  name: "auth-magic-link",
  limit: 10,
  burst: 10,
  windowMs: 60 * 60 * 1000,
  keyExtractor: (req) => req.ip ?? null,
});

const supabaseServiceClient = getSupabaseClient({ service: true }) as MagicLinkSupabaseClient;

router.post(
  "/magic-link",
  magicLinkRateLimiter,
  asyncHandler(async (req, res) => {
    const payload = magicLinkRequestSchema.parse(req.body ?? {});
    const normalizedEmail = payload.email.trim().toLowerCase();
    const redirectTarget = sanitizeRedirectTarget(payload.redirectTo);
    const baseRedirectUrl = getRequiredAuthEnv("AUTH_REDIRECT_URL");
    const emailRedirectTo = buildRedirectUrl(baseRedirectUrl, redirectTarget);
    const emailFrom = getRequiredAuthEnv("AUTH_EMAIL_FROM");

    const { error } = await supabaseServiceClient.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo,
        shouldCreateUser: true,
      },
    });

    if (error) {
      throw new HttpError(502, "Nepavyko išsiųsti prisijungimo nuorodos.", "AUTH_MAGIC_LINK_FAILED");
    }

    res.json({
      data: {
        ok: true,
        email: normalizedEmail,
        emailFrom,
        redirectTo: redirectTarget,
      },
      meta: {
        requestedAt: new Date().toISOString(),
      },
    });
  })
);

router.get(
  "/session",
  asyncHandler(async (req, res) => {
    const token = extractBearerToken(req);

    if (!token) {
      return res.json({
        data: { session: null },
        meta: {
          checkedAt: new Date().toISOString(),
        },
      });
    }

    const { data, error } = await supabaseServiceClient.auth.getUser(token);

    if (error) {
      throw new HttpError(401, "Sesija negalioja. Prisijunkite dar kartą.", "INVALID_SESSION");
    }

    const user = data.user;

    if (!user) {
      return res.json({
        data: { session: null },
        meta: {
          checkedAt: new Date().toISOString(),
        },
      });
    }

    const session = serializeSupabaseUser(user);
    req.authUser = session;

    res.json({
      data: { session },
      meta: {
        checkedAt: new Date().toISOString(),
      },
    });
  })
);

type SerializedSession = {
  id: string;
  email: string | null;
  appRole: string | null;
};

function serializeSupabaseUser(user: MinimalSupabaseAuthUser): SerializedSession {
  return {
    id: user.id,
    email: user.email ?? null,
    appRole: (user.app_metadata?.app_role as string | undefined) ?? null,
  };
}

export default router;
