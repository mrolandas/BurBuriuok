import type { NextFunction, Request, Response } from "express";
import { getSupabaseClient } from "../../../data/supabaseClient.ts";
import { extractBearerToken } from "../utils/authHeaders.ts";
import { forbidden, unauthorized } from "../utils/httpError.ts";
import { logAdminSessionEvent } from "../utils/telemetry.ts";

type MinimalSupabaseAuthUser = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> & { app_role?: string };
};

type MinimalSupabaseAuth = {
  getUser(accessToken: string): Promise<{
    data: { user: MinimalSupabaseAuthUser | null };
    error: Error | null;
  }>;
};

type MinimalSupabaseClient = {
  auth: MinimalSupabaseAuth;
};

export async function requireAdminRole(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractBearerToken(req);

  if (!token) {
    logAdminSessionEvent({
      status: "denied",
      reason: "missing-authorization",
      appRole: null,
      email: null,
    });

    return next(unauthorized("Administrator authentication required."));
  }

  try {
  const supabase = getSupabaseClient({ service: true }) as MinimalSupabaseClient;
    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
      logAdminSessionEvent({
        status: "denied",
        reason: "invalid-token",
        appRole: null,
        email: null,
      });

      return next(unauthorized("Invalid authentication token."));
    }

    const user = data.user;

    if (!user) {
      logAdminSessionEvent({
        status: "denied",
        reason: "missing-user",
        appRole: null,
        email: null,
      });

      return next(unauthorized("Authentication token does not contain a user session."));
    }

    const appRole = (user.app_metadata?.app_role as string | undefined) ?? null;
    const email = user.email ?? null;

    if (appRole !== "admin") {
      logAdminSessionEvent({
        status: "denied",
        reason: "insufficient-role",
        appRole,
        email,
      });

      return next(forbidden("Administrator rights are required for this action."));
    }

    req.authUser = {
      id: user.id,
      email,
      appRole,
    };

    logAdminSessionEvent({
      status: "granted",
      reason: "role-match",
      appRole,
      email,
    });

    return next();
  } catch (error) {
    logAdminSessionEvent({
      status: "denied",
      reason: "supabase-client-error",
      appRole: null,
      email: null,
    });

    return next(error as Error);
  }
}
