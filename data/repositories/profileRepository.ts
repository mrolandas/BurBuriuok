import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabaseClient.ts";
import type {
  Profile,
  ProfileRole,
  ProfileRow,
  UpsertProfileInput,
} from "../types.ts";

const TABLE = "profiles";

function resolveClient(client: SupabaseClient | null): SupabaseClient {
  return client ?? getSupabaseClient({ service: true, schema: "burburiuok" });
}

function mapRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    preferredLanguage: row.preferred_language,
    callsign: row.callsign,
    deviceKeyHash: row.device_key_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertProfile(
  input: UpsertProfileInput,
  client: SupabaseClient | null = null
): Promise<Profile> {
  const supabase = resolveClient(client) as any;
  const payload: Record<string, unknown> = {
    id: input.id,
    email: input.email,
  };

  if (typeof input.role !== "undefined") {
    payload.role = input.role;
  }

  if (typeof input.preferredLanguage !== "undefined") {
    payload.preferred_language = input.preferredLanguage;
  }

  if (typeof input.callsign !== "undefined") {
    payload.callsign = input.callsign;
  }

  if (typeof input.deviceKeyHash !== "undefined") {
    payload.device_key_hash = input.deviceKeyHash;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: "id" })
    .select(
      "id, email, role, preferred_language, callsign, device_key_hash, created_at, updated_at"
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to upsert profile for user '${input.id}': ${error.message}`);
  }

  if (!data) {
    throw new Error("Profile upsert returned no data.");
  }

  return mapRow(data as ProfileRow);
}

export async function getProfileById(
  id: string,
  client: SupabaseClient | null = null
): Promise<Profile | null> {
  const supabase = resolveClient(client) as any;

  const { data, error } = await supabase
    .from(TABLE)
    .select(
      "id, email, role, preferred_language, callsign, device_key_hash, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load profile '${id}': ${error.message}`);
  }

  return data ? mapRow(data as ProfileRow) : null;
}

export async function getProfileByEmail(
  email: string,
  client: SupabaseClient | null = null
): Promise<Profile | null> {
  const supabase = resolveClient(client) as any;

  const { data, error } = await supabase
    .from(TABLE)
    .select(
      "id, email, role, preferred_language, callsign, device_key_hash, created_at, updated_at"
    )
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load profile by email '${email}': ${error.message}`);
  }

  return data ? mapRow(data as ProfileRow) : null;
}

export async function listProfilesByRole(
  role: ProfileRole,
  client: SupabaseClient | null = null
): Promise<Profile[]> {
  const supabase = resolveClient(client) as any;

  const { data, error } = await supabase
    .from(TABLE)
    .select(
      "id, email, role, preferred_language, callsign, device_key_hash, created_at, updated_at"
    )
    .eq("role", role)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list profiles by role '${role}': ${error.message}`);
  }

  return (data ?? []).map((row: ProfileRow) => mapRow(row));
}

export async function countProfilesByRole(
  role: ProfileRole,
  client: SupabaseClient | null = null
): Promise<number> {
  const supabase = resolveClient(client) as any;

  const { count, error } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("role", role);

  if (error) {
    throw new Error(`Failed to count profiles by role '${role}': ${error.message}`);
  }

  return count ?? 0;
}

export async function updateProfileRole(
  id: string,
  role: ProfileRole,
  client: SupabaseClient | null = null
): Promise<Profile> {
  const supabase = resolveClient(client) as any;

  const { data, error } = await supabase
    .from(TABLE)
    .update({ role })
    .eq("id", id)
    .select(
      "id, email, role, preferred_language, callsign, device_key_hash, created_at, updated_at"
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update profile '${id}' role: ${error.message}`);
  }

  if (!data) {
    throw new Error("Profile role update returned no data.");
  }

  return mapRow(data as ProfileRow);
}
