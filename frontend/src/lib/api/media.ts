import { resolvePublicApiBase } from '$lib/api/base';

export type ConceptMediaItem = {
	id: string;
	assetType: 'image' | 'video' | 'document';
	sourceKind: 'upload' | 'external';
	title: string | null;
	captionLt: string | null;
	captionEn: string | null;
	url: string;
	expiresAt: string | null;
	createdAt: string;
};

export type ConceptMediaResponse = {
	conceptId: string;
	items: ConceptMediaItem[];
};

const PUBLIC_API_BASE = resolvePublicApiBase();

if (typeof window !== 'undefined') {
	const host = window.location.hostname.toLowerCase();
	if (host.endsWith('github.io') && PUBLIC_API_BASE.startsWith('/')) {
		console.warn(
			'[MediaAPI] Relative public API base detected on GitHub Pages. Configure VITE_PUBLIC_API_BASE or set publicApiBase in env.js so requests reach the hosted backend.'
		);
	}
}

export async function fetchConceptMedia(
	slug: string,
	fetcher: typeof fetch = fetch
): Promise<ConceptMediaItem[]> {
	const target = `${PUBLIC_API_BASE}/concepts/${encodeURIComponent(slug)}/media`;
	const response = await fetcher(target, {
		headers: {
			Accept: 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error('Nepavyko įkelti susietos medijos.');
	}

	const payload = (await response.json()) as { data?: ConceptMediaResponse | null };
	return payload?.data?.items ?? [];
}
