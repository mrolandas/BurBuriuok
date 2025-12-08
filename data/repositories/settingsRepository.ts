import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabaseClient.ts";
import type { SystemSetting, SystemSettingRow, AppConfig } from "../types.ts";

const TABLE = "system_settings";

export const DEFAULT_APP_CONFIG: AppConfig = {
  appTitle: "BurKursas",
  appDescription: "Lietuvos buriuotojų sąjungos egzaminų ruošyklė",
  primaryColor: "#2563eb",
  welcomeMessage: "Sveiki atvykę į BurKursą!",
  registrationEnabled: true,
};

function resolveClient(client: SupabaseClient | null): SupabaseClient {
  return client ?? getSupabaseClient({ service: true, schema: "burburiuok" });
}

function mapRow(row: SystemSettingRow): SystemSetting {
  return {
    key: row.key,
    value: row.value,
    description: row.description,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

export async function getSetting<T = any>(
  key: string,
  defaultValue: T,
  client: SupabaseClient | null = null
): Promise<T> {
  const supabase = resolveClient(client) as any;

  const { data, error } = await supabase
    .from(TABLE)
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    console.warn(`Failed to fetch setting '${key}', using default. Error: ${error.message}`);
    return defaultValue;
  }

  if (!data) {
    return defaultValue;
  }

  return data.value as T;
}

export async function updateSetting<T = any>(
  key: string,
  value: T,
  userId: string | null = null,
  client: SupabaseClient | null = null
): Promise<SystemSetting> {
  const supabase = resolveClient(client) as any;

  const payload: any = {
    key,
    value,
    updated_at: new Date().toISOString(),
  };

  if (userId) {
    payload.updated_by = userId;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update setting '${key}': ${error.message}`);
  }

  return mapRow(data as SystemSettingRow);
}

export async function getAppConfig(client: SupabaseClient | null = null): Promise<AppConfig> {
  const config = await getSetting<Partial<AppConfig>>("app_config", {}, client);
  
  if (config.registrationEnabled === undefined) {
      config.registrationEnabled = await getSetting("registration_enabled", true, client);
  }

  return { ...DEFAULT_APP_CONFIG, ...config };
}
