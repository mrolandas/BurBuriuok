import { createClient, SupabaseClient } from "@supabase/supabase-js";

type ClientContext = {
  service?: boolean;
  schema?: string;
};

const DEFAULT_SCHEMA = "public";
const anonClients = new Map<string, SupabaseClient>();
const serviceClients = new Map<string, SupabaseClient>();

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
  const schema = context.schema ?? DEFAULT_SCHEMA;

  if (context.service) {
    const cached = serviceClients.get(schema);
    if (cached) {
      return cached;
    }
    const client = buildClient({ ...context, service: true, schema });
    serviceClients.set(schema, client);
    return client;
  }

  const cached = anonClients.get(schema);
  if (cached) {
    return cached;
  }

  const client = buildClient({ ...context, service: false, schema });
  anonClients.set(schema, client);
  return client;
}

export function resetSupabaseClients(): void {
  anonClients.clear();
  serviceClients.clear();
}
