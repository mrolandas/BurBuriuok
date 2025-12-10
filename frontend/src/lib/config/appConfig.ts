type RuntimeConfig = {
	supabaseUrl?: string;
	supabaseAnonKey?: string;
	adminApiBase?: string;
	publicApiBase?: string;
};

const globalWithRuntimeConfig = globalThis as typeof globalThis & {
	__MOXLAI_CONFIG__?: unknown;
};

const runtimeConfig: RuntimeConfig =
	typeof globalWithRuntimeConfig.__MOXLAI_CONFIG__ === 'object' &&
	globalWithRuntimeConfig.__MOXLAI_CONFIG__ !== null
		? (globalWithRuntimeConfig.__MOXLAI_CONFIG__ as RuntimeConfig)
		: {};

const supabaseUrl = runtimeConfig.supabaseUrl ?? import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey =
	runtimeConfig.supabaseAnonKey ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
const adminApiBase = runtimeConfig.adminApiBase ?? import.meta.env.VITE_ADMIN_API_BASE ?? '';
const publicApiBase = runtimeConfig.publicApiBase ?? import.meta.env.VITE_PUBLIC_API_BASE ?? '';

export const appConfig = {
	appName: 'Moxlai',
	supabase: {
		url: supabaseUrl,
		anonKey: supabaseAnonKey
	},
	admin: {
		apiBase: adminApiBase
	},
	public: {
		apiBase: publicApiBase
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
		__MOXLAI_CONFIG__?: RuntimeConfig;
	}

	interface Window {
		__MOXLAI_CONFIG__?: RuntimeConfig;
	}
}

validateSupabaseConfig();
