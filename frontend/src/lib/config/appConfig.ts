type RuntimeConfig = {
	supabaseUrl?: string;
	supabaseAnonKey?: string;
	adminApiBase?: string;
};

const globalWithRuntimeConfig = globalThis as typeof globalThis & {
	__BURBURIUOK_CONFIG__?: unknown;
};

const runtimeConfig: RuntimeConfig =
	typeof globalWithRuntimeConfig.__BURBURIUOK_CONFIG__ === 'object' &&
	globalWithRuntimeConfig.__BURBURIUOK_CONFIG__ !== null
		? (globalWithRuntimeConfig.__BURBURIUOK_CONFIG__ as RuntimeConfig)
		: {};

const supabaseUrl = runtimeConfig.supabaseUrl ?? import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = runtimeConfig.supabaseAnonKey ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
const adminApiBase = runtimeConfig.adminApiBase ?? import.meta.env.VITE_ADMIN_API_BASE ?? '';

export const appConfig = {
	appName: 'BurBuriuok',
	supabase: {
		url: supabaseUrl,
		anonKey: supabaseAnonKey
	},
	admin: {
		apiBase: adminApiBase
	}
};

export function hasSupabaseCredentials(): boolean {
	return Boolean(supabaseUrl && supabaseAnonKey);
}

export function validateSupabaseConfig(): void {
	if (import.meta.env.DEV && !hasSupabaseCredentials()) {
		console.warn(
			'Missing Supabase configuration. Define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable data fetching.'
		);
	}
}

declare global {
	interface Global {
		__BURBURIUOK_CONFIG__?: RuntimeConfig;
	}

	interface Window {
		__BURBURIUOK_CONFIG__?: RuntimeConfig;
	}
}

validateSupabaseConfig();
