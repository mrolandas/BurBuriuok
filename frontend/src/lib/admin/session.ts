import { getSupabaseClient } from '$lib/supabase/client';

export type AdminSessionReason =
	| 'role-match'
	| 'missing-session'
	| 'insufficient-role'
	| 'supabase-unconfigured'
	| 'session-error';

export type AdminSessionState = {
	allowed: boolean;
	authenticated: boolean;
	reason: AdminSessionReason;
	appRole: string | null;
	email: string | null;
	errorMessage?: string;
};

const DEFAULT_DENIED_STATE: AdminSessionState = {
	allowed: false,
	authenticated: false,
	reason: 'missing-session',
	appRole: null,
	email: null
};

const ADMIN_EDIT_PARAM = 'admin';

const truthyFlags = new Set(['1', 'true', 'yes', 'on', 'enabled']);

export function isAdminEditRequested(url: URL): boolean {
	const requestFlag = url.searchParams.get(ADMIN_EDIT_PARAM);
	return requestFlag ? truthyFlags.has(requestFlag.toLowerCase()) : false;
}

export async function resolveAdminSession(url: URL): Promise<AdminSessionState> {
	let supabase;

	try {
		supabase = getSupabaseClient();
	} catch (clientError) {
		console.warn('Supabase client unavailable – admin session fallback', clientError);

		return {
			...DEFAULT_DENIED_STATE,
			reason: 'supabase-unconfigured',
			errorMessage: 'Supabase konfigūracija nepasiekiama. Administratoriaus režimas išjungtas.'
		};
	}

	const { data, error } = await supabase.auth.getSession();

	if (error) {
		console.warn('Failed to fetch Supabase session for admin access', error);

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
		return {
			allowed: true,
			authenticated: true,
			reason: 'role-match',
			appRole,
			email
		};
	}

	const denialReason: AdminSessionReason = session ? 'insufficient-role' : 'missing-session';

	return {
		...DEFAULT_DENIED_STATE,
		authenticated: !!session,
		reason: denialReason,
		appRole,
		email,
		errorMessage: session
			? 'Ši paskyra neturi administratoriaus teisių. Susisiekite su komanda, jei manote, kad tai klaida.'
			: 'Norėdami įjungti administratoriaus režimą, prisijunkite naudodami administratoriaus paskyrą.'
	};
}

export type ConceptAdminEditContext = {
	requested: boolean;
	enabled: boolean;
	session: AdminSessionState;
};

export async function resolveConceptAdminContext(url: URL): Promise<ConceptAdminEditContext> {
	const requested = isAdminEditRequested(url);
	const session = await resolveAdminSession(url);
	const enabled = requested && session.allowed;

	return {
		requested,
		enabled,
		session
	};
}
