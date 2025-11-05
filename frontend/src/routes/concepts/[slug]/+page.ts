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

export type ConceptPageData = {
	concept: ConceptDetail | null;
	peerItems: CurriculumItem[];
	breadcrumbs: ConceptBreadcrumb[];
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
				notFound: true
			};
			return fallback;
		}

		let peerItems: CurriculumItem[] = [];

		if (concept.curriculumNodeCode) {
			try {
				const items = await fetchNodeItems(concept.curriculumNodeCode);
				peerItems = items.filter((item) => item.conceptSlug && item.conceptSlug !== concept.slug);
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
			breadcrumbs
		};

		return payload;
	} catch (error) {
		console.error('Nepavyko įkelti temos', error);
		const fallback: ConceptPageData = {
			concept: null,
			peerItems: [],
			breadcrumbs: [],
			loadError: error instanceof Error ? error.message : 'Nepavyko įkelti temos duomenų.'
		};
		return fallback;
	}
}) satisfies PageLoad;
