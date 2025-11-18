import { base } from '$app/paths';

export type ConceptMediaItem = {
	id: string;
	assetType: 'image' | 'video';
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

export async function fetchConceptMedia(
	slug: string,
	fetcher: typeof fetch = fetch
): Promise<ConceptMediaItem[]> {
	const target = `${base}/api/v1/concepts/${encodeURIComponent(slug)}/media`;
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
