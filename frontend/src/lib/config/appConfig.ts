const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const appConfig = {
	appName: 'BurBuriuok',
	supabase: {
		url: supabaseUrl,
		anonKey: supabaseAnonKey
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

validateSupabaseConfig();
