import { getSupabaseClient } from '$lib/supabase/client';

const diacriticRegex = /[\u0300-\u036f]/g;

function slugifyConceptLabel(label: string | null | undefined): string | null {
	if (!label) {
		return null;
	}

	const slug = label
		.toLowerCase()
		.normalize('NFD')
		.replace(diacriticRegex, '')
		.replace(/\(.*?\)/g, '')
		.replace(/[&/]/g, ' ')
		.replace(/[^a-z0-9\s-]/g, ' ')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');

	return slug || null;
}

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
	conceptSlug: string | null;
	conceptTerm: string | null;
	isRequired: boolean | null;
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

	const conceptByOrdinal = new Map<
		string,
		{ slug: string | null; term: string | null; isRequired: boolean | null }
	>();

	const { data: concepts, error: conceptError } = await supabase
		.from('burburiuok_concepts')
		.select('slug,curriculum_item_ordinal,term_lt,is_required')
		.eq('curriculum_node_code', nodeCode);

	if (conceptError) {
		console.warn('Nepavyko susieti temų su koncepcijomis', conceptError);
	} else {
		for (const concept of concepts ?? []) {
			const ordinalValue = concept.curriculum_item_ordinal;
			if (ordinalValue == null) {
				continue;
			}

			const ordinalKey = typeof ordinalValue === 'number' ? ordinalValue : Number(ordinalValue);
			if (Number.isNaN(ordinalKey)) {
				continue;
			}

			conceptByOrdinal.set(String(ordinalKey), {
				slug: concept.slug ?? null,
				term: concept.term_lt ?? null,
				isRequired: concept.is_required ?? null
			});
		}
	}

	return (data ?? []).map((item) => {
		const ordinalNumber = typeof item.ordinal === 'number' ? item.ordinal : Number(item.ordinal);
		const conceptKey = Number.isNaN(ordinalNumber) ? String(item.ordinal) : String(ordinalNumber);
		const concept = conceptByOrdinal.get(conceptKey) ?? null;
		const fallbackSlug = slugifyConceptLabel(item.label);
		return {
			nodeCode: item.node_code,
			ordinal: ordinalNumber,
			label: item.label,
			conceptSlug: concept?.slug ?? fallbackSlug,
			conceptTerm: concept?.term ?? item.label,
			isRequired: concept?.isRequired ?? null
		};
	});
}
