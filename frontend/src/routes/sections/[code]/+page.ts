import { fetchChildNodes, fetchNodeByCode } from '$lib/api/curriculum';
import type { CurriculumNode } from '$lib/api/curriculum';
import { getSupabaseClient } from '$lib/supabase/client';
import type { PageLoad } from './$types';

export type SectionSummary = {
	code: string;
	title: string;
	summary: string | null;
	level: number;
	parent_code: string | null;
};

export type Breadcrumb = {
	label: string;
	href?: string;
};

export type SectionPageData = {
	section: SectionSummary | null;
	initialNodes: CurriculumNode[];
	breadcrumbs: Breadcrumb[];
	notFound?: boolean;
	loadError?: string;
};

export const ssr = false;

export const load = (async ({ params }) => {
	const supabase = getSupabaseClient();

	const { data: section, error: sectionError } = await supabase
		.from('burburiuok_curriculum_nodes')
		.select('code,title,summary,level,parent_code')
		.eq('code', params.code)
		.maybeSingle();

	if (sectionError) {
		console.error('Nepavyko įkelti skilties duomenų', sectionError);
		const fallback: SectionPageData = {
			section: null,
			initialNodes: [],
			breadcrumbs: [],
			loadError: 'Nepavyko įkelti skilties. Pabandykite dar kartą.'
		};
		return fallback;
	}

	if (!section) {
		const fallback: SectionPageData = {
			section: null,
			initialNodes: [],
			breadcrumbs: [],
			notFound: true
		};
		return fallback;
	}

	const breadcrumbs: Breadcrumb[] = [];
	let currentParentCode = section.parent_code;
	const ancestors: Breadcrumb[] = [];

	while (currentParentCode) {
		try {
			const parent = await fetchNodeByCode(currentParentCode);
			if (parent) {
				ancestors.unshift({
					label: parent.title,
					href: `/sections/${parent.code}`
				});
				currentParentCode = parent.parent_code;
			} else {
				break;
			}
		} catch (e) {
			console.warn('Failed to fetch ancestor node', e);
			break;
		}
	}

	breadcrumbs.push(...ancestors);
	breadcrumbs.push({ label: section.title });

	try {
		const initialNodes = await fetchChildNodes(section.code);

		const payload: SectionPageData = {
			section,
			initialNodes,
			breadcrumbs
		};

		return payload;
	} catch (err) {
		const fallback: SectionPageData = {
			section,
			initialNodes: [],
			breadcrumbs,
			loadError: err instanceof Error ? err.message : 'Nepavyko įkelti poskyrių.'
		};
		return fallback;
	}
}) satisfies PageLoad;
