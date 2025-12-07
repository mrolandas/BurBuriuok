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
			descriptionHits: [],
			sectionHits: []
		};
	}

	if (query.length < MIN_QUERY_LENGTH) {
		return {
			query,
			minimumLength: MIN_QUERY_LENGTH,
			conceptHits: [],
			descriptionHits: [],
			sectionHits: [],
			tooShort: true
		};
	}

	try {
		const { conceptHits, descriptionHits, sectionHits } = await searchConcepts(query);

		return {
			query,
			minimumLength: MIN_QUERY_LENGTH,
			conceptHits,
			descriptionHits,
			sectionHits
		};
	} catch (error) {
		console.error('Nepavyko atlikti paieškos', error);
		return {
			query,
			minimumLength: MIN_QUERY_LENGTH,
			conceptHits: [],
			descriptionHits: [],
			sectionHits: [],
			loadError: 'Nepavyko atlikti paieškos. Bandykite dar kartą.'
		};
	}
}) satisfies PageLoad;
