import type { NextFunction, Request, Response } from "express";
import { getSupabaseClient } from "../../../data/supabaseClient.ts";
import { extractBearerToken } from "../utils/authHeaders.ts";
import { unauthorized } from "../utils/httpError.ts";

type MinimalSupabaseAuthUser = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> & { app_role?: string };
};

type MinimalSupabaseClient = {
  auth: {
    getUser(accessToken: string): Promise<{
      data: { user: MinimalSupabaseAuthUser | null };
      error: Error | null;
    }>;
  };
};

const supabaseServiceClient = getSupabaseClient({ service: true }) as MinimalSupabaseClient;

export async function requireUserSession(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractBearerToken(req);

  if (!token) {
    return next(unauthorized("Authentication is required for this action."));
  }

  const { data, error } = await supabaseServiceClient.auth.getUser(token);

  if (error || !data.user) {
    return next(unauthorized("Sesija negalioja arba neprisijungta."));
  }

  req.authUser = {
    id: data.user.id,
    email: data.user.email ?? null,
    appRole: (data.user.app_metadata?.app_role as string | undefined) ?? null,
  };

  next();
}
