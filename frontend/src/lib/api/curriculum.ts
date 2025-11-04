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
	const counts = new Map<string, number>();

	if (!nodeCodes.length) {
		return counts;
	}

	if (!hasWarnedAboutPrerequisiteCounts) {
		console.info(
			'[curriculum] Prerequisite counts unavailable in public schema; defaulting to zero until public view is exposed.'
		);
		hasWarnedAboutPrerequisiteCounts = true;
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
		throw new Error('Nepavyko įkelti skilties duomenų.');
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
