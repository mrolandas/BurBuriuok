import type { PageLoad } from './$types';
import { fetchConceptBySlug } from '$lib/api/concepts';
import { fetchNodeItems } from '$lib/api/curriculum';
import type { ConceptDetail } from '$lib/api/concepts';
import type { CurriculumItem } from '$lib/api/curriculum';

export type ConceptBreadcrumb = {
	label: string;
	routeId?: '/sections/[code]';
	params?: { code: string };
};

export type ConceptNeighbor = {
	label: string;
	slug: string;
	ordinal: number | null;
};

export type ConceptNeighbors = {
	previous?: ConceptNeighbor | null;
	next?: ConceptNeighbor | null;
};

export type ConceptPageData = {
	concept: ConceptDetail | null;
	peerItems: CurriculumItem[];
	breadcrumbs: ConceptBreadcrumb[];
	neighbors: ConceptNeighbors;
	notFound?: boolean;
	loadError?: string;
};

export const ssr = false;

export const load = (async ({ params }) => {
	try {
		const concept = await fetchConceptBySlug(params.slug);

		if (!concept) {
			const fallback: ConceptPageData = {
				concept: null,
				peerItems: [],
				breadcrumbs: [],
				neighbors: {},
				notFound: true
			};
			return fallback;
		}

		let peerItems: CurriculumItem[] = [];
		const neighbors: ConceptNeighbors = {};

		if (concept.curriculumNodeCode) {
			try {
				const items = await fetchNodeItems(concept.curriculumNodeCode);
				peerItems = items.filter((item) => item.conceptSlug && item.conceptSlug !== concept.slug);

				const currentIndex = items.findIndex((item) => item.conceptSlug === concept.slug);
				if (currentIndex !== -1) {
					const previousCandidate = items[currentIndex - 1];
					if (previousCandidate?.conceptSlug) {
						neighbors.previous = {
							label: previousCandidate.label,
							slug: previousCandidate.conceptSlug,
							ordinal: previousCandidate.ordinal ?? null
						};
					}

					const nextCandidate = items[currentIndex + 1];
					if (nextCandidate?.conceptSlug) {
						neighbors.next = {
							label: nextCandidate.label,
							slug: nextCandidate.conceptSlug,
							ordinal: nextCandidate.ordinal ?? null
						};
					}
				}
			} catch (itemError) {
				console.warn('Nepavyko įkelti susijusių temų', itemError);
			}
		}

		const breadcrumbs: ConceptBreadcrumb[] = [];

		if (concept.sectionCode && concept.sectionTitle) {
			breadcrumbs.push({
				label: concept.sectionTitle,
				routeId: '/sections/[code]',
				params: { code: concept.sectionCode }
			});
		}

		if (concept.subsectionTitle) {
			if (concept.sectionCode) {
				breadcrumbs.push({
					label: concept.subsectionTitle,
					routeId: '/sections/[code]',
					params: { code: concept.sectionCode }
				});
			} else {
				breadcrumbs.push({ label: concept.subsectionTitle });
			}
		}

		if (concept.curriculumItemLabel) {
			breadcrumbs.push({ label: concept.curriculumItemLabel });
		}

		const payload: ConceptPageData = {
			concept,
			peerItems,
			breadcrumbs,
			neighbors
		};

		return payload;
	} catch (error) {
		console.error('Nepavyko įkelti temos', error);
		const fallback: ConceptPageData = {
			concept: null,
			peerItems: [],
			breadcrumbs: [],
			neighbors: {},
			loadError: error instanceof Error ? error.message : 'Nepavyko įkelti temos duomenų.'
		};
		return fallback;
	}
}) satisfies PageLoad;
