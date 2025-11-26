import { buildPublicApiUrl } from '$lib/api/base';
import { getSupabaseClient } from '$lib/supabase/client';
import type { ProfileRole, PreferredLanguage } from '../../../../shared/validation/profileSchema';

export type UserProfile = {
	id: string;
	email: string;
	role: ProfileRole;
	preferredLanguage: PreferredLanguage;
	callsign: string | null;
	updatedAt: string;
};

export type ProfilePayload = {
	preferredLanguage?: PreferredLanguage;
	callsign?: string | null;
	inviteToken?: string;
};

async function resolveAccessToken(): Promise<string> {
	const supabase = getSupabaseClient();
	const { data, error } = await supabase.auth.getSession();

	if (error) {
		throw new Error('Nepavyko pasiekti Supabase sesijos.');
	}

	const token = data.session?.access_token;

	if (!token) {
		throw new Error('Prisijungimas negalioja. Prisijunkite iš naujo.');
	}

	return token;
}

function buildHeaders(token: string): Headers {
	const headers = new Headers();
	headers.set('Authorization', `Bearer ${token}`);
	headers.set('Content-Type', 'application/json');
	return headers;
}

export async function fetchProfile(): Promise<UserProfile | null> {
	const token = await resolveAccessToken();
	const response = await fetch(buildPublicApiUrl('/profile'), {
		headers: buildHeaders(token)
	});

	if (!response.ok) {
		throw await buildError(response, 'Nepavyko įkelti profilio.');
	}

	const body = (await response.json()) as { data: { profile: UserProfile | null } };
	return body.data.profile;
}

export async function saveProfile(payload: ProfilePayload = {}): Promise<UserProfile> {
	const token = await resolveAccessToken();
	const response = await fetch(buildPublicApiUrl('/profile'), {
		method: 'POST',
		headers: buildHeaders(token),
		body: JSON.stringify(payload)
	});

	if (!response.ok) {
		throw await buildError(response, 'Nepavyko išsaugoti profilio.');
	}

	const body = (await response.json()) as { data: { profile: UserProfile } };
	return body.data.profile;
}

export async function ensureProfile(preferredLanguage?: PreferredLanguage): Promise<UserProfile> {
	const payload: ProfilePayload = {};
	if (preferredLanguage) {
		payload.preferredLanguage = preferredLanguage;
	}
	return saveProfile(payload);
}

async function buildError(response: Response, fallback: string): Promise<Error> {
	try {
		const body = (await response.json()) as { error?: { message?: string } };
		const message = body?.error?.message ?? fallback;
		return new Error(message);
	} catch (parseError) {
		console.warn('[profileApi] failed to parse error response', parseError);
		return new Error(fallback);
	}
}
