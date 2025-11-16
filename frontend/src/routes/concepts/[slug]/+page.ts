import type { PageLoad } from './$types';
import {
	loadConceptDetailData,
	type ConceptBreadcrumb,
	type ConceptNeighbor,
	type ConceptNeighbors,
	type ConceptPageData
} from '$lib/page-data/conceptDetail';

export type { ConceptBreadcrumb, ConceptNeighbor, ConceptNeighbors, ConceptPageData };

export const ssr = false;

export const load = (async ({ params, url }) => {
	return loadConceptDetailData({ slug: params.slug, url });
}) satisfies PageLoad;
