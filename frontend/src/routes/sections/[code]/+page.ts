import { fetchChildNodes } from '$lib/api/curriculum';
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

export type SectionPageData = {
	section: SectionSummary | null;
	initialNodes: CurriculumNode[];
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
			loadError: 'Nepavyko įkelti skilties. Pabandykite dar kartą.'
		};
		return fallback;
	}

	if (!section) {
		const fallback: SectionPageData = {
			section: null,
			initialNodes: [],
			notFound: true
		};
		return fallback;
	}

	try {
		const initialNodes = await fetchChildNodes(section.code);

		const payload: SectionPageData = {
			section,
			initialNodes
		};

		return payload;
	} catch (err) {
		const fallback: SectionPageData = {
			section,
			initialNodes: [],
			loadError: err instanceof Error ? err.message : 'Nepavyko įkelti poskyrių.'
		};
		return fallback;
	}
}) satisfies PageLoad;
