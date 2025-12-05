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
};

export type CurriculumItem = {
	nodeCode: string;
	ordinal: number;
	label: string;
	conceptId: string | null;
	conceptSlug: string | null;
	conceptTerm: string | null;
	isRequired: boolean | null;
};

export type SectionProgressBlueprint = {
	nodes: Array<{ code: string; parentCode: string | null }>;
	conceptAssignments: Array<{ conceptId: string; nodeCode: string | null }>;
};

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

	return nodes.map((node) => ({
		code: node.code,
		title: node.title,
		summary: node.summary,
		level: node.level,
		ordinal: node.ordinal
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
		{ id: string | null; slug: string | null; term: string | null; isRequired: boolean | null }
	>();

	const { data: concepts, error: conceptError } = await supabase
		.from('burburiuok_concepts')
		.select('id,slug,curriculum_item_ordinal,term_lt,is_required')
		.eq('curriculum_node_code', nodeCode)
		.order('term_lt', { ascending: true });

	if (conceptError) {
		console.warn('Nepavyko susieti temų su sąvokomis', conceptError);
	}

	// Create a map of existing items by ordinal
	const itemsByOrdinal = new Map<number, CurriculumItem>();
	let maxOrdinal = 0;

	// First, populate with explicit items
	for (const item of data ?? []) {
		const ordinal = typeof item.ordinal === 'number' ? item.ordinal : Number(item.ordinal);
		if (!Number.isNaN(ordinal)) {
			itemsByOrdinal.set(ordinal, {
				nodeCode: item.node_code,
				ordinal: ordinal,
				label: item.label,
				conceptId: null,
				conceptSlug: slugifyConceptLabel(item.label),
				conceptTerm: item.label,
				isRequired: null
			});
			maxOrdinal = Math.max(maxOrdinal, ordinal);
		}
	}

	// Then merge concepts
	for (const concept of concepts ?? []) {
		let ordinal = concept.curriculum_item_ordinal;
		
		// If concept has no ordinal, or points to a non-existent item, we treat it as a new item
		if (ordinal == null || (typeof ordinal === 'number' && !itemsByOrdinal.has(ordinal))) {
			// Assign a new ordinal at the end
			maxOrdinal++;
			ordinal = maxOrdinal;
		}

		const ordinalKey = typeof ordinal === 'number' ? ordinal : Number(ordinal);
		
		if (itemsByOrdinal.has(ordinalKey)) {
			// Enrich existing item
			const item = itemsByOrdinal.get(ordinalKey)!;
			item.conceptId = concept.id;
			item.conceptSlug = concept.slug;
			item.conceptTerm = concept.term_lt;
			item.isRequired = concept.is_required;
		} else {
			// Create new item from concept
			itemsByOrdinal.set(ordinalKey, {
				nodeCode: nodeCode,
				ordinal: ordinalKey,
				label: concept.term_lt ?? 'Be pavadinimo',
				conceptId: concept.id,
				conceptSlug: concept.slug,
				conceptTerm: concept.term_lt,
				isRequired: concept.is_required
			});
		}
	}

	return Array.from(itemsByOrdinal.values()).sort((a, b) => a.ordinal - b.ordinal);
}

export async function fetchSectionProgressBlueprint(
	sectionCode: string
): Promise<SectionProgressBlueprint> {
	const supabase = getSupabaseClient();
	// Use a broad filter to catch all potential descendants (e.g. 1.1, 1.1.1, 1.1a)
	// We will filter out false positives (e.g. 10 when searching for 1) in memory.
	const nodeFilter = `code.eq.${sectionCode},code.like.${sectionCode}%`;
	const conceptFilter = `curriculum_node_code.eq.${sectionCode},curriculum_node_code.like.${sectionCode}%`;

	const { data: nodesRaw, error: nodesError } = await supabase
		.from('burburiuok_curriculum_nodes')
		.select('code,parent_code')
		.or(nodeFilter);

	if (nodesError) {
		console.error('Nepavyko įkelti skilties mazgų hierarchijos', nodesError);
		throw new Error('Nepavyko įkelti skilties hierarchijos.');
	}

	const { data: conceptsRaw, error: conceptsError } = await supabase
		.from('burburiuok_concepts')
		.select('id,curriculum_node_code')
		.or(conceptFilter);

	if (conceptsError) {
		console.error('Nepavyko įkelti skilties sąvokų sąrašo', conceptsError);
		throw new Error('Nepavyko įkelti skilties sąvokų.');
	}

	// Filter function to ensure we only include true descendants
	// e.g. if sectionCode is "1", we want "1.1", "1.1a", but NOT "10"
	const isDescendant = (code: string | null) => {
		if (!code) return false;
		if (code === sectionCode) return true;
		if (!code.startsWith(sectionCode)) return false;
		
		const suffix = code.slice(sectionCode.length);
		// If the next character is a dot, it's a child (e.g. 1.1)
		if (suffix.startsWith('.')) return true;
		// If the next character is NOT a digit, it's a child (e.g. 1a)
		// If it IS a digit, it's a sibling/unrelated (e.g. 10)
		const firstChar = suffix[0];
		return isNaN(parseInt(firstChar, 10));
	};

	const validNodes = (nodesRaw ?? []).filter(n => isDescendant(n.code));
	const validConcepts = (conceptsRaw ?? []).filter(c => isDescendant(c.curriculum_node_code));

	return {
		nodes: validNodes.map((node) => ({
			code: node.code,
			parentCode: node.parent_code ?? null
		})),
		conceptAssignments: validConcepts.map((concept) => ({
			conceptId: concept.id,
			nodeCode: concept.curriculum_node_code ?? null
		}))
	};
}
