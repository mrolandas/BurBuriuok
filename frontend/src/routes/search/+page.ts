import type { PageLoad } from './$types';
import { searchConcepts } from '$lib/api/search';

const MIN_QUERY_LENGTH = 2;

export const ssr = false;

export const load = (async ({ url }) => {
	const query = url.searchParams.get('q')?.trim() ?? '';

	if (!query) {
		return {
			query,
			minimumLength: MIN_QUERY_LENGTH,
			conceptHits: [],
			descriptionHits: []
		};
	}

	if (query.length < MIN_QUERY_LENGTH) {
		return {
			query,
			minimumLength: MIN_QUERY_LENGTH,
			conceptHits: [],
			descriptionHits: [],
			tooShort: true
		};
	}

	try {
		const { conceptHits, descriptionHits } = await searchConcepts(query);

		return {
			query,
			minimumLength: MIN_QUERY_LENGTH,
			conceptHits,
			descriptionHits
		};
	} catch (error) {
		console.error('Nepavyko atlikti paieškos', error);
		return {
			query,
			minimumLength: MIN_QUERY_LENGTH,
			conceptHits: [],
			descriptionHits: [],
			loadError: 'Nepavyko atlikti paieškos. Bandykite dar kartą.'
		};
	}
}) satisfies PageLoad;
