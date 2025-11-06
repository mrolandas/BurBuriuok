import { getSupabaseClient } from '$lib/supabase/client';
import { emitAdminSessionEvent } from '$lib/telemetry/admin';
import type { LayoutLoad } from './$types';

export const ssr = false;

const impersonationEnv = import.meta.env.VITE_ENABLE_ADMIN_IMPERSONATION;
const impersonationEnabled =
	impersonationEnv === 'true' || impersonationEnv === '1' || impersonationEnv === 'enabled';

type GuardState = {
	allowed: boolean;
	reason: string;
	appRole: string | null;
	email: string | null;
	impersonating: boolean;
	errorMessage?: string;
};

const DEFAULT_DENIED_STATE: GuardState = {
	allowed: false,
	reason: 'missing-session',
	appRole: null,
	email: null,
	impersonating: false
};

async function fetchSessionGuard(url: URL): Promise<GuardState> {
	const impersonateParam = url.searchParams.get('impersonate');
	const impersonatingAdmin = impersonationEnabled && impersonateParam === 'admin';

	if (impersonatingAdmin) {
		emitAdminSessionEvent({
			status: 'granted',
			reason: 'impersonation',
			impersonating: true,
			appRole: 'admin',
			email: null
		});

		return {
			allowed: true,
			reason: 'impersonation',
			appRole: 'admin',
			email: null,
			impersonating: true
		};
	}

	let supabase;

	try {
		supabase = getSupabaseClient();
	} catch (clientError) {
		console.warn('Supabase client unavailable – admin guard fallback', clientError);

		emitAdminSessionEvent({
			status: 'denied',
			reason: 'supabase-unconfigured',
			impersonating: false,
			appRole: null,
			email: null
		});

		return {
			...DEFAULT_DENIED_STATE,
			reason: 'supabase-unconfigured',
			errorMessage: 'Supabase konfigūracija nepasiekiama. Administratoriaus prieiga laikinai išjungta.'
		};
	}

	const { data, error } = await supabase.auth.getSession();

	if (error) {
		console.warn('Failed to fetch Supabase session for admin guard', error);

		emitAdminSessionEvent({
			status: 'denied',
			reason: 'session-error',
			impersonating: false,
			appRole: null,
			email: null
		});

		return {
			...DEFAULT_DENIED_STATE,
			reason: 'session-error',
			errorMessage: 'Nepavyko perskaityti prisijungimo sesijos. Bandykite dar kartą.'
		};
	}

	const session = data.session;
	const appRole = session?.user?.app_metadata?.app_role ?? null;
	const email = session?.user?.email ?? null;

	if (appRole === 'admin') {
		emitAdminSessionEvent({
			status: 'granted',
			reason: 'role-match',
			impersonating: false,
			appRole,
			email
		});

		return {
			allowed: true,
			reason: 'role-match',
			appRole,
			email,
			impersonating: false
		};
	}

	const denialReason = session ? 'insufficient-role' : 'missing-session';

	emitAdminSessionEvent({
		status: 'denied',
		reason: denialReason,
		impersonating: false,
		appRole,
		email
	});

	return {
		...DEFAULT_DENIED_STATE,
		reason: denialReason,
		appRole,
		email,
		errorMessage: session
			? 'Ši paskyra neturi administratoriaus teisių. Susisiekite su komanda, jei manote, kad tai klaida.'
			: 'Norėdami pasiekti administratoriaus įrankius, prisijunkite naudodami administratoriaus paskyrą.'
	};
}

export const load = (async ({ url, fetch, parent }) => {
	void fetch;
	void parent;

	const guard = await fetchSessionGuard(url);

	return {
		guard,
		impersonationEnabled
	};
}) satisfies LayoutLoad;

export type AdminLayoutData = Awaited<ReturnType<typeof load>>;
