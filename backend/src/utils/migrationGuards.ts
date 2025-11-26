import type { Response } from "express";

const PROFILE_TABLE_TOKEN = "burburiuok.profiles";
const INVITE_TABLE_TOKEN = "burburiuok.admin_invites";
const MIGRATION_MESSAGE =
  "Supabase auth profile tables are missing. Apply supabase/migrations/0013_auth_profiles.sql (e.g. `npx supabase db push --include-seed`) and restart the stack.";

function isMissingTable(error: unknown, token: string): boolean {
  if (!(error instanceof Error) || !error.message) {
    return false;
  }
  return error.message.includes(token);
}

export function isMissingProfileTable(error: unknown): boolean {
  return isMissingTable(error, PROFILE_TABLE_TOKEN);
}

export function isMissingAdminInviteTable(error: unknown): boolean {
  return isMissingTable(error, INVITE_TABLE_TOKEN);
}

export function maybeRespondMissingAuthTables(
  res: Response,
  error: unknown
): boolean {
  if (!isMissingProfileTable(error) && !isMissingAdminInviteTable(error)) {
    return false;
  }

  res.status(503).json({
    error: {
      code: "AUTH_MIGRATION_REQUIRED",
      message: MIGRATION_MESSAGE,
    },
  });

  return true;
}
