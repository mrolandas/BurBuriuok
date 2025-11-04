import { browser } from '$app/environment';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { appConfig, hasSupabaseCredentials } from '$lib/config/appConfig';

let supabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
	if (!browser) {
		throw new Error('Supabase client is only available in the browser context.');
	}

	if (!supabase) {
		if (!hasSupabaseCredentials()) {
			throw new Error(
				'Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the frontend environment.'
			);
		}

		supabase = createClient(appConfig.supabase.url, appConfig.supabase.anonKey, {
			auth: {
				persistSession: true
			}
		});
	}

	return supabase;
}
