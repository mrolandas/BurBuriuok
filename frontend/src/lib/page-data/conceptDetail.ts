import type { ConceptDetail } from '$lib/api/concepts';
import { fetchConceptBySlug } from '$lib/api/concepts';
import type { CurriculumItem } from '$lib/api/curriculum';
import { fetchNodeItems } from '$lib/api/curriculum';
import { type ConceptAdminEditContext, resolveConceptAdminContext } from '$lib/admin/session';

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
	adminContext: ConceptAdminEditContext;
};

const defaultDeps = {
	fetchConcept: fetchConceptBySlug,
	fetchItems: fetchNodeItems,
	resolveAdminContext: resolveConceptAdminContext
};

export type ConceptDetailLoadDeps = typeof defaultDeps;

export type ConceptDetailLoadArgs = {
	slug: string;
	url: URL;
	deps?: Partial<ConceptDetailLoadDeps>;
};

export async function loadConceptDetailData({
	slug,
	url,
	deps
}: ConceptDetailLoadArgs): Promise<ConceptPageData> {
	const { fetchConcept, fetchItems, resolveAdminContext } = {
		...defaultDeps,
		...deps
	};

	const adminContextPromise = resolveAdminContext(url);

	try {
		const concept = await fetchConcept(slug);

		if (!concept) {
			const adminContext = await adminContextPromise;
			return {
				concept: null,
				peerItems: [],
				breadcrumbs: [],
				neighbors: {},
				notFound: true,
				adminContext
			};
		}

		let peerItems: CurriculumItem[] = [];
		const neighbors: ConceptNeighbors = {};

		if (concept.curriculumNodeCode) {
			try {
				const items = await fetchItems(concept.curriculumNodeCode);
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

		const adminContext = await adminContextPromise;

		return {
			concept,
			peerItems,
			breadcrumbs,
			neighbors,
			adminContext
		};
	} catch (error) {
		console.error('Nepavyko įkelti temos', error);
		const adminContext = await adminContextPromise;
		return {
			concept: null,
			peerItems: [],
			breadcrumbs: [],
			neighbors: {},
			loadError: error instanceof Error ? error.message : 'Nepavyko įkelti temos duomenų.',
			adminContext
		};
	}
}
