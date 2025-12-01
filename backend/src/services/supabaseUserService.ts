import { getSupabaseClient } from "../../../data/supabaseClient.ts";
import type { ProfileRole } from "../../../data/types.ts";

type AdminSupabaseClient = {
  auth: {
    admin: {
      updateUserById: (
        userId: string,
        params: {
          app_metadata: {
            app_role: ProfileRole;
          };
        }
      ) => Promise<{ error: Error | null }>;
    };
  };
};

const serviceClient = getSupabaseClient({ service: true }) as AdminSupabaseClient;

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
