import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../../../data/supabaseClient.ts";
import type { ProfileRole } from "../../../data/types.ts";

const serviceClient = getSupabaseClient({ service: true }) as SupabaseClient;

export async function updateSupabaseAppRole(
  userId: string,
  role: ProfileRole
): Promise<void> {
  const { error } = await serviceClient.auth.admin.updateUserById(userId, {
    app_metadata: {
      app_role: role,
    },
  });

  if (error) {
    throw new Error(`Failed to update Supabase app_role for user '${userId}': ${error.message}`);
  }
}
