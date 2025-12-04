import { buildPublicApiUrl } from '$lib/api/base';
import { ensureDeviceKey } from '$lib/utils/deviceKey';
import { getSupabaseClient } from '$lib/supabase/client';

export type ProgressStatus = 'learning' | 'known' | 'review';

export type ConceptProgressRecord = {
	conceptId: string;
	status: ProgressStatus;
	lastReviewedAt: string;
	deviceKey: string | null;
	userId: string | null;
};

type ProgressListResponse = {
	data: ConceptProgressRecord[];
};

type ProgressMutationResponse = {
	data: {
		conceptId: string;
		deviceKey: string | null;
		userId: string | null;
		status: ProgressStatus;
		lastReviewedAt: string;
	};
};

async function resolveAuthToken(): Promise<string | null> {
	try {
		const supabase = getSupabaseClient();
		const { data, error } = await supabase.auth.getSession();

		if (error) {
			console.warn('[progressApi] Unable to resolve Supabase session', error);
			return null;
		}

		return data.session?.access_token ?? null;
	} catch (error) {
		console.warn('[progressApi] Supabase client unavailable', error);
		return null;
	}
}

async function buildHeaders({ includeJson }: { includeJson?: boolean } = {}): Promise<Headers> {
	const headers = new Headers();
	const deviceKey = ensureDeviceKey();
	if (deviceKey) {
		headers.set('x-device-key', deviceKey);
	}

	const token = await resolveAuthToken();
	if (token) {
		headers.set('Authorization', `Bearer ${token}`);
	}

	if (includeJson) {
		headers.set('Content-Type', 'application/json');
	}

	return headers;
}

async function buildError(response: Response, fallback: string): Promise<Error> {
	try {
		const body = (await response.json()) as { error?: { message?: string } };
		const message = body?.error?.message ?? fallback;
		return new Error(message);
	} catch (error) {
		console.warn('[progressApi] Failed to parse error response', error);
		return new Error(fallback);
	}
}

export async function fetchConceptProgress(): Promise<ConceptProgressRecord[]> {
	const headers = await buildHeaders();
	const response = await fetch(buildPublicApiUrl('/progress'), { headers });

	if (!response.ok) {
		throw await buildError(response, 'Nepavyko įkelti pažangos duomenų.');
	}

	const body = (await response.json()) as ProgressListResponse;
	return body.data ?? [];
}

export async function upsertConceptProgress(
	conceptId: string,
	status: ProgressStatus
): Promise<ConceptProgressRecord> {
	const headers = await buildHeaders({ includeJson: true });
	const response = await fetch(buildPublicApiUrl(`/progress/${encodeURIComponent(conceptId)}`), {
		method: 'PUT',
		headers,
		body: JSON.stringify({ status })
	});

	if (!response.ok) {
		throw await buildError(response, 'Nepavyko išsaugoti pažangos.');
	}

	const body = (await response.json()) as ProgressMutationResponse;
	return {
		conceptId: body.data.conceptId,
		deviceKey: body.data.deviceKey,
		userId: body.data.userId,
		status: body.data.status,
		lastReviewedAt: body.data.lastReviewedAt
	};
}

export async function deleteConceptProgress(conceptId: string): Promise<void> {
	const headers = await buildHeaders();
	const response = await fetch(buildPublicApiUrl(`/progress/${encodeURIComponent(conceptId)}`), {
		method: 'DELETE',
		headers
	});

	if (!response.ok) {
		throw await buildError(response, 'Nepavyko atnaujinti pažangos.');
	}
}
