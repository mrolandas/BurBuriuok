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

	type NodeRecord = {
		code: string;
		parent_code: string | null;
		level: number;
	};

	type ConceptRecord = {
		section_code: string | null;
		curriculum_node_code: string | null;
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
	const sectionCodeSet = new Set(sectionCodes);
	const subsectionCounts = new Map<string, number>();
	const conceptCounts = new Map<string, number>();
	const nodeByCode = new Map<string, NodeRecord>();
	const rootCache = new Map<string, string>();

	if (sectionCodes.length) {
		const { data: nodesData, error: nodesError } = await supabase
			.from('burburiuok_curriculum_nodes')
			.select('code,parent_code,level');

		if (nodesError) {
			console.warn('Nepavyko gauti skilčių hierarchijos', nodesError);
		} else {
			for (const record of (nodesData ?? []) as NodeRecord[]) {
				nodeByCode.set(record.code, record);
				if (record.level === 1) {
					rootCache.set(record.code, record.code);
				}
				const parentCode = record.parent_code;
				if (parentCode && sectionCodeSet.has(parentCode)) {
					subsectionCounts.set(parentCode, (subsectionCounts.get(parentCode) ?? 0) + 1);
				}
			}
		}

		const resolveRoot = (code: string | null): string | null => {
			if (!code) {
				return null;
			}
			const trail: string[] = [];
			let current: string | null = code;

			while (current) {
				if (rootCache.has(current)) {
					const root = rootCache.get(current)!;
					for (const entry of trail) {
						rootCache.set(entry, root);
					}
					return root;
				}

				trail.push(current);
				const node = nodeByCode.get(current);
				if (!node) {
					if (sectionCodeSet.has(current)) {
						for (const entry of trail) {
							rootCache.set(entry, current);
						}
						return current;
					}
					break;
				}

				if (node.level === 1 || !node.parent_code) {
					for (const entry of trail) {
						rootCache.set(entry, node.code);
					}
					rootCache.set(node.code, node.code);
					return node.code;
				}

				current = node.parent_code;
			}

			return null;
		};

		const { data: conceptData, error: conceptError } = await supabase
			.from('burburiuok_concepts')
			.select('section_code,curriculum_node_code');

		if (conceptError) {
			console.warn('Nepavyko suskaičiuoti sąvokų', conceptError);
		} else {
			for (const record of (conceptData ?? []) as ConceptRecord[]) {
				const rootFromNode = resolveRoot(record.curriculum_node_code);
				let resolvedRoot = rootFromNode;
				if (!resolvedRoot && record.section_code) {
					resolvedRoot = resolveRoot(record.section_code) ?? record.section_code;
				}
				if (!resolvedRoot || !sectionCodeSet.has(resolvedRoot)) {
					continue;
				}
				conceptCounts.set(resolvedRoot, (conceptCounts.get(resolvedRoot) ?? 0) + 1);
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
