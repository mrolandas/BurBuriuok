import type { NextFunction, Request, Response } from "express";
import { getSupabaseClient } from "../../../data/supabaseClient.ts";
import { extractBearerToken } from "../utils/authHeaders.ts";

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

export async function attachOptionalUserSession(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (req.authUser) {
    return next();
  }

  const token = extractBearerToken(req);

  if (!token) {
    return next();
  }

  try {
    const { data } = await supabaseServiceClient.auth.getUser(token);
    const user = data.user;

    if (!user) {
      return next();
    }

    req.authUser = {
      id: user.id,
      email: user.email ?? null,
      appRole: (user.app_metadata?.app_role as string | undefined) ?? null,
    };
  } catch (error) {
    console.warn("[attachOptionalUserSession] unable to hydrate session", error);
  }

  next();
}
