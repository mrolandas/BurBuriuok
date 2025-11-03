declare module "@supabase/supabase-js" {
  export type SupabaseClient<TDatabase = any> = unknown;
  export function createClient<TDatabase = any>(
    url: string,
    key: string,
    options?: unknown
  ): SupabaseClient<TDatabase>;
}

declare const process: {
  env: Record<string, string | undefined>;
};

