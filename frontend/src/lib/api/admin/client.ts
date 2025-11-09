import { getSupabaseClient } from '$lib/supabase/client';

const impersonationEnv = import.meta.env.VITE_ENABLE_ADMIN_IMPERSONATION;
const impersonationEnabled =
	impersonationEnv === 'true' ||
	impersonationEnv === '1' ||
	impersonationEnv === 'enabled';

const rawBase = import.meta.env.VITE_ADMIN_API_BASE ?? '/api/v1/admin';
const ADMIN_API_BASE = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;

export class AdminApiError extends Error {
	status: number;
	body?: unknown;

	constructor(message: string, status: number, body?: unknown) {
		super(message);
		this.name = 'AdminApiError';
		this.status = status;
		this.body = body;
	}
}

async function resolveAccessToken(): Promise<string> {
	const supabase = getSupabaseClient();
	const { data, error } = await supabase.auth.getSession();

	if (error) {
		throw new Error('Nepavyko pasiekti Supabase sesijos.');
	}

	const token = data.session?.access_token;

	if (!token) {
		throw new Error('Administratorius neprisijungęs. Prisijunkite ir bandykite dar kartą.');
	}

	return token;
}

function isMissingSessionError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	return (
		error.message === 'Administratorius neprisijungęs. Prisijunkite ir bandykite dar kartą.' ||
		error.message === 'Nepavyko pasiekti Supabase sesijos.'
	);
}

export async function adminFetch<TResponse>(
	path: string,
	init: RequestInit = {}
): Promise<TResponse> {
	let token: string | null = null;
	let impersonating = false;

	try {
		token = await resolveAccessToken();
	} catch (error) {
		if (impersonationEnabled && isMissingSessionError(error)) {
			impersonating = true;
		} else {
			throw error;
		}
	}

	const headers = new Headers(init.headers ?? {});

	if (init.body && !headers.has('Content-Type')) {
		headers.set('Content-Type', 'application/json');
	}

	if (token) {
		headers.set('Authorization', `Bearer ${token}`);
	} else if (impersonating) {
		headers.set('X-Admin-Impersonate', 'true');
	}

	const targetPath = path.startsWith('/') ? path : `/${path}`;
	const response = await fetch(`${ADMIN_API_BASE}${targetPath}`, {
		...init,
		headers
	});

	if (!response.ok) {
		let errorMessage = response.statusText || 'Serverio klaida.';
		let responseBody: unknown;

		try {
			responseBody = await response.json();
			const bodyWithMessage = responseBody as { error?: { message?: string } };
			if (bodyWithMessage?.error?.message) {
				errorMessage = bodyWithMessage.error.message;
			}
		} catch (parseError) {
			console.warn('Nepavyko perskaityti klaidos žinutės iš administratoriaus API.', parseError);
		}

		throw new AdminApiError(errorMessage, response.status, responseBody);
	}

	return (await response.json()) as TResponse;
}

export function getAdminApiBase(): string {
	return ADMIN_API_BASE;
}
