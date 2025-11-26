import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabaseClient.ts";
import type { AdminInvite, AdminInviteRow, ProfileRole } from "../types.ts";

const TABLE = "admin_invites";

function resolveClient(client: SupabaseClient | null): SupabaseClient {
  return client ?? getSupabaseClient({ service: true, schema: "burburiuok" });
}

function mapRow(row: AdminInviteRow): AdminInvite {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    expiresAt: row.expires_at,
    invitedBy: row.invited_by,
    acceptedProfileId: row.accepted_profile_id,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type CreateInviteInput = {
  email: string;
  role: ProfileRole;
  tokenHash: string;
  expiresAt: string;
  invitedBy: string | null;
};

export async function createInvite(
  input: CreateInviteInput,
  client: SupabaseClient | null = null
): Promise<AdminInvite> {
  const supabase = resolveClient(client) as any;

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      email: input.email,
      role: input.role,
      token_hash: input.tokenHash,
      expires_at: input.expiresAt,
      invited_by: input.invitedBy,
    })
    .select(
      "id, email, role, expires_at, invited_by, accepted_profile_id, accepted_at, revoked_at, created_at, updated_at"
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to create invite for '${input.email}': ${error.message}`);
  }

  if (!data) {
    throw new Error("Invite creation returned no data.");
  }

  return mapRow(data as AdminInviteRow);
}

export async function listInvites(
  client: SupabaseClient | null = null
): Promise<AdminInvite[]> {
  const supabase = resolveClient(client) as any;

  const { data, error } = await supabase
    .from(TABLE)
    .select(
      "id, email, role, expires_at, invited_by, accepted_profile_id, accepted_at, revoked_at, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list admin invites: ${error.message}`);
  }

  return (data ?? []).map((row: AdminInviteRow) => mapRow(row));
}

type InviteSearchResult = AdminInvite & { tokenHash?: string };

export async function findInviteByTokenHash(
  tokenHash: string,
  client: SupabaseClient | null = null
): Promise<InviteSearchResult | null> {
  const supabase = resolveClient(client) as any;

  const { data, error } = await supabase
    .from(TABLE)
    .select(
      "id, email, role, token_hash, expires_at, invited_by, accepted_profile_id, accepted_at, revoked_at, created_at, updated_at"
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to look up admin invite by token.");
  }

  if (!data) {
    return null;
  }

  const row = data as AdminInviteRow & { token_hash: string };
  return {
    ...mapRow(row),
    tokenHash: row.token_hash,
  };
}

export async function markInviteAccepted(
  inviteId: string,
  profileId: string,
  client: SupabaseClient | null = null
): Promise<AdminInvite> {
  const supabase = resolveClient(client) as any;

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      accepted_profile_id: profileId,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", inviteId)
    .select(
      "id, email, role, expires_at, invited_by, accepted_profile_id, accepted_at, revoked_at, created_at, updated_at"
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to mark invite '${inviteId}' accepted: ${error.message}`);
  }

  if (!data) {
    throw new Error("Invite acceptance returned no data.");
  }

  return mapRow(data as AdminInviteRow);
}

export async function revokeInvite(
  inviteId: string,
  client: SupabaseClient | null = null
): Promise<AdminInvite> {
  const supabase = resolveClient(client) as any;

  const { data, error } = await supabase
    .from(TABLE)
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId)
    .select(
      "id, email, role, expires_at, invited_by, accepted_profile_id, accepted_at, revoked_at, created_at, updated_at"
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to revoke invite '${inviteId}': ${error.message}`);
  }

  if (!data) {
    throw new Error("Invite revocation returned no data.");
  }

  return mapRow(data as AdminInviteRow);
}
