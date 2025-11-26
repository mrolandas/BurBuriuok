import { derived, writable } from 'svelte/store';
import { browser } from '$app/environment';
import { buildPublicApiUrl } from '$lib/api/base';
import { getSupabaseClient } from '$lib/supabase/client';

export type AuthStatus = 'idle' | 'checking' | 'authenticated' | 'unauthenticated';

export type AuthSession = {
	id: string;
	email: string | null;
	appRole: string | null;
};

function createAuthStore() {
	const session = writable<AuthSession | null>(null);
	const status = writable<AuthStatus>('idle');
	const error = writable<string | null>(null);
	let initialized = false;

	async function refreshSession(): Promise<void> {
		if (!browser) {
			return;
		}

		status.set('checking');
		error.set(null);

		try {
			const supabase = getSupabaseClient();
			const { data, error: sessionError } = await supabase.auth.getSession();

			if (sessionError) {
				throw sessionError;
			}

			const active = data.session?.user;

			if (!active) {
				session.set(null);
				status.set('unauthenticated');
				return;
			}

			session.set({
				id: active.id,
				email: active.email ?? null,
				appRole: (active.app_metadata?.app_role as string | undefined) ?? null
			});
			status.set('authenticated');
		} catch (refreshError) {
			session.set(null);
			status.set('unauthenticated');
			error.set('Nepavyko patvirtinti prisijungimo.');
			console.error('[authStore] refreshSession failed', refreshError);
		}
	}

	function init(): void {
		if (initialized || !browser) {
			return;
		}
		initialized = true;

		const supabase = getSupabaseClient();
		supabase.auth.onAuthStateChange(() => {
			void refreshSession();
		});

		void refreshSession();
	}

	return {
		session,
		status,
		error,
		initialized: () => initialized,
		init,
		refreshSession,
		clearError: () => error.set(null)
	};
}

const authStore = createAuthStore();

export const authSession = {
	subscribe: authStore.session.subscribe
};

export const authStatus = {
	subscribe: authStore.status.subscribe
};

export const authError = {
	subscribe: authStore.error.subscribe
};

export const isLoggedIn = derived(authStore.session, ($session) => Boolean($session));

export function initializeAuth(): void {
	authStore.init();
}

export async function requestMagicLink(email: string, redirectTo?: string | null): Promise<void> {
	const trimmedEmail = email.trim().toLowerCase();

	if (!trimmedEmail) {
		throw new Error('Įveskite el. pašto adresą.');
	}

	const target = buildPublicApiUrl('/auth/magic-link');
	const payload: Record<string, string> = { email: trimmedEmail };
	const sanitizedRedirect = sanitizeRedirectTarget(redirectTo);
	if (sanitizedRedirect) {
		payload.redirectTo = sanitizedRedirect;
	}

	const response = await fetch(target, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(payload)
	});

	if (!response.ok) {
		const body = await response.json().catch(() => ({ error: { message: 'Serverio klaida.' } }));
		const message = body?.error?.message ?? 'Nepavyko nusiųsti prisijungimo nuorodos.';
		throw new Error(message);
	}
}

export async function signOut(): Promise<void> {
	const supabase = getSupabaseClient();
	await supabase.auth.signOut();
}

function sanitizeRedirectTarget(value?: string | null): string | undefined {
	if (!value) {
		return undefined;
	}

	const trimmed = value.trim();
	if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
		return undefined;
	}

	try {
		const url = new URL(trimmed, 'https://burkursas.local');
		const normalized = `${url.pathname}${url.search}${url.hash}`;
		return normalized || undefined;
	} catch {
		return undefined;
	}
}
