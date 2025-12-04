import type { ConceptDetail } from '$lib/api/concepts';
import { fetchConceptBySlug } from '$lib/api/concepts';
import type { CurriculumItem } from '$lib/api/curriculum';
import { fetchNodeItems, fetchNodeByCode } from '$lib/api/curriculum';
import { fetchConceptMedia, type ConceptMediaItem } from '$lib/api/media';
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
	media: ConceptMediaItem[];
	mediaError?: string | null;
	notFound?: boolean;
	loadError?: string;
	adminContext: ConceptAdminEditContext;
};

const defaultDeps = {
	fetchConcept: fetchConceptBySlug,
	fetchItems: fetchNodeItems,
	fetchNode: fetchNodeByCode,
	resolveAdminContext: resolveConceptAdminContext,
	fetchConceptMedia: fetchConceptMedia
};

export type ConceptDetailLoadDeps = typeof defaultDeps;

export type ConceptDetailLoadArgs = {
	slug: string;
	url: URL;
	fetcher?: typeof fetch;
	deps?: Partial<ConceptDetailLoadDeps>;
};

export async function loadConceptDetailData({
	slug,
	url,
	fetcher,
	deps
}: ConceptDetailLoadArgs): Promise<ConceptPageData> {
	const {
		fetchConcept,
		fetchItems,
		fetchNode,
		resolveAdminContext,
		fetchConceptMedia: fetchConceptMediaFn
	} = {
		...defaultDeps,
		...deps
	};

	const adminContextPromise = resolveAdminContext(url);
	const fetchMedia = fetchConceptMediaFn ?? fetchConceptMedia;

	try {
		const concept = await fetchConcept(slug);

		if (!concept) {
			const adminContext = await adminContextPromise;
			return {
				concept: null,
				peerItems: [],
				breadcrumbs: [],
				neighbors: {},
				media: [],
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

		if (concept.sectionCode) {
			try {
				const sectionNode = await fetchNode(concept.sectionCode);
				if (sectionNode?.parent_code) {
					const parentNode = await fetchNode(sectionNode.parent_code);
					if (parentNode) {
						breadcrumbs.push({
							label: parentNode.title,
							routeId: '/sections/[code]',
							params: { code: parentNode.code }
						});
					}
				}
			} catch (e) {
				console.warn('Breadcrumb hierarchy fetch failed', e);
			}
		}

		if (concept.sectionCode && concept.sectionTitle) {
			breadcrumbs.push({
				label: concept.sectionTitle,
				routeId: '/sections/[code]',
				params: { code: concept.sectionCode }
			});
		}

		if (concept.subsectionTitle) {
			if (concept.subsectionCode && concept.subsectionCode !== concept.sectionCode) {
				breadcrumbs.push({
					label: concept.subsectionTitle,
					routeId: '/sections/[code]',
					params: { code: concept.subsectionCode }
				});
			} else {
				breadcrumbs.push({ label: concept.subsectionTitle });
			}
		}

		if (concept.curriculumItemLabel) {
			breadcrumbs.push({ label: concept.curriculumItemLabel });
		}

		const adminContext = await adminContextPromise;
		let media: ConceptMediaItem[] = [];
		let mediaError: string | null = null;

		if (fetcher) {
			try {
				media = await fetchMedia(concept.slug, fetcher);
			} catch (mediaLoadError) {
				mediaError =
					mediaLoadError instanceof Error ? mediaLoadError.message : 'Nepavyko įkelti medijos.';
			}
		}

		return {
			concept,
			peerItems,
			breadcrumbs,
			neighbors,
			media,
			mediaError,
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
			media: [],
			loadError: error instanceof Error ? error.message : 'Nepavyko įkelti temos duomenų.',
			adminContext
		};
	}
}
