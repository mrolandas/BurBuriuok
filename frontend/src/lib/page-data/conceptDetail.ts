import type { ConceptDetail } from '$lib/api/concepts';
import { fetchConceptBySlug } from '$lib/api/concepts';
import type { CurriculumItem } from '$lib/api/curriculum';
import { fetchNodeItems, fetchNodeByCode, fetchChildNodes } from '$lib/api/curriculum';
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

export type NextSection = {
	title: string;
	code: string;
};

export type ConceptPageData = {
	concept: ConceptDetail | null;
	sectionItems: CurriculumItem[];
	breadcrumbs: ConceptBreadcrumb[];
	neighbors: ConceptNeighbors;
	nextSection?: NextSection | null;
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
	fetchChildNodes: fetchChildNodes,
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
		fetchChildNodes,
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
				sectionItems: [],
				breadcrumbs: [],
				neighbors: {},
				media: [],
				notFound: true,
				adminContext
			};
		}

		let sectionItems: CurriculumItem[] = [];
		const neighbors: ConceptNeighbors = {};
		let nextSection: NextSection | null = null;

		if (concept.curriculumNodeCode) {
			try {
				const items = await fetchItems(concept.curriculumNodeCode);
				sectionItems = items;

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
					} else if (currentIndex === items.length - 1) {
						// If we are at the last item, try to find the next section
						try {
							const currentNode = await fetchNode(concept.curriculumNodeCode);
							if (currentNode?.parent_code) {
								const siblings = await fetchChildNodes(currentNode.parent_code);
								const currentNodeIndex = siblings.findIndex((n) => n.code === concept.curriculumNodeCode);
								if (currentNodeIndex !== -1 && currentNodeIndex < siblings.length - 1) {
									const nextNode = siblings[currentNodeIndex + 1];
									nextSection = {
										title: nextNode.title,
										code: nextNode.code
									};
								}
							}
						} catch (e) {
							console.warn('Failed to fetch next section', e);
						}
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
			sectionItems,
			breadcrumbs,
			neighbors,
			nextSection,
			media,
			mediaError,
			adminContext
		};
	} catch (error) {
		console.error('Nepavyko įkelti temos', error);
		const adminContext = await adminContextPromise;
		return {
			concept: null,
			sectionItems: [],
			breadcrumbs: [],
			neighbors: {},
			media: [],
			loadError: error instanceof Error ? error.message : 'Nepavyko įkelti temos duomenų.',
			adminContext
		};
	}
}
