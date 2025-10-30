import { createClient, SupabaseClient } from "@supabase/supabase-js";

type ClientContext = {
  service?: boolean;
  schema?: string;
};

const DEFAULT_SCHEMA = "burburiuok";
let cachedAnonClient: SupabaseClient | null = null;
let cachedServiceClient: SupabaseClient | null = null;

function assertEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildClient({
  service = false,
  schema = DEFAULT_SCHEMA,
}: ClientContext): SupabaseClient {
  const url = assertEnv(process.env.SUPABASE_URL, "SUPABASE_URL");
  const keyName = service ? "SUPABASE_SERVICE_ROLE_KEY" : "SUPABASE_ANON_KEY";
  const key = assertEnv(process.env[keyName], keyName);

  return createClient(url, key, {
    db: {
      schema,
    },
    auth: {
      persistSession: !service,
    },
  });
}

export function getSupabaseClient(context: ClientContext = {}): SupabaseClient {
  if (context.service) {
    if (!cachedServiceClient) {
      cachedServiceClient = buildClient({ ...context, service: true });
    }
    return cachedServiceClient;
  }

  if (!cachedAnonClient) {
    cachedAnonClient = buildClient({ ...context, service: false });
  }

  return cachedAnonClient;
}

export function resetSupabaseClients(): void {
  cachedAnonClient = null;
  cachedServiceClient = null;
}
