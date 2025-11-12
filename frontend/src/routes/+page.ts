import type { PageLoad } from './$types';
import { getSupabaseClient } from '$lib/supabase/client';

export type SectionCard = {
	code: string;
	title: string;
	summary: string | null;
	ordinal: number;
	subsectionCount: number;
	conceptCount: number;
};

export type PageData = {
	sections: SectionCard[];
	loadError?: string;
};

export const ssr = false;

export const load = (async () => {
	const supabase = getSupabaseClient();
	type RawSection = {
		code: string;
		title: string;
		summary: string | null;
		ordinal: number;
	};

	const { data, error } = await supabase
		.from('burburiuok_curriculum_nodes')
		.select('code,title,summary,ordinal')
		.eq('level', 1)
		.order('ordinal', { ascending: true });

	if (error) {
		console.error('Nepavyko įkelti skilčių lentos duomenų iš Supabase', error);
		const fallback: PageData = {
			sections: [],
			loadError: 'Nepavyko įkelti skilčių. Pabandykite dar kartą.'
		};
		return fallback;
	}

	const sectionsRaw = (data ?? []) as RawSection[];
	const sectionCodes = sectionsRaw.map((section) => section.code);
	const subsectionCounts = new Map<string, number>();
	const conceptCounts = new Map<string, number>();

	if (sectionCodes.length) {
		const { data: subsectionData, error: subsectionError } = await supabase
			.from('burburiuok_curriculum_nodes')
			.select('parent_code')
			.in('parent_code', sectionCodes);

		if (subsectionError) {
			console.warn('Nepavyko suskaičiuoti poskyrių', subsectionError);
		} else {
			for (const entry of subsectionData ?? []) {
				const parentCode = (entry as { parent_code: string | null }).parent_code;
				if (!parentCode) {
					continue;
				}
				subsectionCounts.set(parentCode, (subsectionCounts.get(parentCode) ?? 0) + 1);
			}
		}

		const { data: conceptData, error: conceptError } = await supabase
			.from('burburiuok_concepts')
			.select('section_code')
			.in('section_code', sectionCodes);

		if (conceptError) {
			console.warn('Nepavyko suskaičiuoti sąvokų', conceptError);
		} else {
			for (const entry of conceptData ?? []) {
				const sectionCode = (entry as { section_code: string | null }).section_code;
				if (!sectionCode) {
					continue;
				}
				conceptCounts.set(sectionCode, (conceptCounts.get(sectionCode) ?? 0) + 1);
			}
		}
	}

	const sections: SectionCard[] = sectionsRaw.map((section) => ({
		code: section.code,
		title: section.title,
		summary: section.summary,
		ordinal: section.ordinal,
		subsectionCount: subsectionCounts.get(section.code) ?? 0,
		conceptCount: conceptCounts.get(section.code) ?? 0
	}));

	const payload: PageData = {
		sections
	};

	return payload;
}) satisfies PageLoad;
