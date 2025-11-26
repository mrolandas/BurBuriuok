import { appConfig } from '$lib/config/appConfig';

function normalizeBase(value: string | undefined, fallback: string): string {
	const trimmed = (value ?? '').trim();
	if (!trimmed) {
		return fallback;
	}
	return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export function resolvePublicApiBase(): string {
	const runtimeBase = normalizeBase(appConfig.public?.apiBase, '');
	const envBase = normalizeBase(import.meta.env.VITE_PUBLIC_API_BASE, '');
	const fallback = '/api/v1';
	const candidate = runtimeBase || envBase || fallback;
	return candidate.endsWith('/') ? candidate.slice(0, -1) : candidate;
}

export function resolveAdminApiBase(): string {
	const runtimeBase = normalizeBase(appConfig.admin?.apiBase, '');
	const envBase = normalizeBase(import.meta.env.VITE_ADMIN_API_BASE, '');
	const fallback = '/api/v1/admin';
	const candidate = runtimeBase || envBase || fallback;
	return candidate.endsWith('/') ? candidate.slice(0, -1) : candidate;
}

export function buildPublicApiUrl(path: string): string {
	const base = resolvePublicApiBase();
	const normalized = path.startsWith('/') ? path : `/${path}`;
	return `${base}${normalized}`;
}
