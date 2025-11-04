import { getSupabaseClient } from '$lib/supabase/client';

export type CurriculumNode = {
	code: string;
	title: string;
	summary: string | null;
	level: number;
	ordinal: number;
	prerequisiteCount: number;
};

export type CurriculumItem = {
	nodeCode: string;
	ordinal: number;
	label: string;
};

let hasWarnedAboutPrerequisiteCounts = false;

async function fetchPrerequisiteCounts(nodeCodes: string[]): Promise<Map<string, number>> {
	const supabase = getSupabaseClient();
	const counts = new Map<string, number>();

	if (!nodeCodes.length) {
		return counts;
	}

	const { data, error } = await supabase
		.from('curriculum_dependencies')
		.select('source_node_code', { count: 'exact' })
		.eq('source_type', 'node')
		.eq('prerequisite_type', 'node')
		.in('source_node_code', nodeCodes);

	if (error) {
		if (error.code === 'PGRST205' || error.code === 'PGRST106') {
			if (!hasWarnedAboutPrerequisiteCounts) {
				console.warn(
					'Prerequisite counts unavailable (schema not exposed to anon role). Returning zero values.',
					error
				);
				hasWarnedAboutPrerequisiteCounts = true;
			}
			return counts;
		}
		throw new Error('Nepavyko įkelti priklausomybių duomenų.');
	}

	if (!data) {
		return counts;
	}

	for (const row of data) {
		const code = row.source_node_code as string;
		counts.set(code, (counts.get(code) ?? 0) + 1);
	}

	return counts;
}

export async function fetchNodeByCode(code: string) {
	const supabase = getSupabaseClient();

	const { data, error } = await supabase
		.from('burburiuok_curriculum_nodes')
		.select('code,title,summary,level,ordinal,parent_code')
		.eq('code', code)
		.maybeSingle();

	if (error) {
		throw new Error('Nepavyko įkelti sekcijos duomenų.');
	}

	return data;
}

export async function fetchChildNodes(parentCode: string): Promise<CurriculumNode[]> {
	const supabase = getSupabaseClient();

	const { data, error } = await supabase
		.from('burburiuok_curriculum_nodes')
		.select('code,title,summary,level,ordinal')
		.eq('parent_code', parentCode)
		.order('ordinal', { ascending: true });

	if (error) {
		throw new Error('Nepavyko įkelti poskyrių.');
	}

	const nodes = data ?? [];
	const prerequisiteCounts = await fetchPrerequisiteCounts(nodes.map((node) => node.code));

	return nodes.map((node) => ({
		code: node.code,
		title: node.title,
		summary: node.summary,
		level: node.level,
		ordinal: node.ordinal,
		prerequisiteCount: prerequisiteCounts.get(node.code) ?? 0
	}));
}

export async function fetchNodeItems(nodeCode: string): Promise<CurriculumItem[]> {
	const supabase = getSupabaseClient();

	const { data, error } = await supabase
		.from('burburiuok_curriculum_items')
		.select('node_code,ordinal,label')
		.eq('node_code', nodeCode)
		.order('ordinal', { ascending: true });

	if (error) {
		throw new Error('Nepavyko įkelti temų sąrašo.');
	}

	return (data ?? []).map((item) => ({
		nodeCode: item.node_code,
		ordinal: item.ordinal,
		label: item.label
	}));
}
