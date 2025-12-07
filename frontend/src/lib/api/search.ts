import { getSupabaseClient } from '$lib/supabase/client';

export type SearchHit = {
	id: string;
	slug: string;
	term: string;
	sectionTitle: string | null;
	sectionCode: string | null;
	snippet: string | null;
};

export type SectionHit = {
	code: string;
	title: string;
	snippet: string | null;
};

export type SearchResults = {
	conceptHits: SearchHit[];
	descriptionHits: SearchHit[];
	sectionHits: SectionHit[];
};

const SELECT_FIELDS = 'id,slug,term_lt,term_en,description_lt,section_title,section_code';

function escapeIlike(value: string): string {
	return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function buildSnippet(source: string | null, query: string): string | null {
	if (!source) {
		return null;
	}

	const cleanSource = source.replace(/\s+/g, ' ').trim();
	if (!cleanSource) {
		return null;
	}

	const lowerSource = cleanSource.toLowerCase();
	const lowerQuery = query.toLowerCase();
	const matchIndex = lowerSource.indexOf(lowerQuery);

	const MAX_LENGTH = 160;

	if (matchIndex === -1) {
		if (cleanSource.length <= MAX_LENGTH) {
			return cleanSource;
		}
		return `${cleanSource.slice(0, MAX_LENGTH).trimEnd()}…`;
	}

	const padding = 60;
	const start = Math.max(0, matchIndex - padding);
	const end = Math.min(cleanSource.length, matchIndex + lowerQuery.length + padding);

	let snippet = cleanSource.slice(start, end).trim();

	if (start > 0) {
		snippet = `…${snippet}`;
	}

	if (end < cleanSource.length) {
		snippet = `${snippet}…`;
	}

	return snippet;
}

export async function searchConcepts(query: string, limit = 20): Promise<SearchResults> {
	const supabase = getSupabaseClient();
	const trimmed = query.trim();

	if (!trimmed) {
		return { conceptHits: [], descriptionHits: [] };
	}

	const escaped = escapeIlike(trimmed);

	const { data: conceptData, error: conceptError } = await supabase
		.from('burburiuok_concepts')
		.select(SELECT_FIELDS)
		.or(
			[
				`slug.ilike.%${escaped}%`,
				`term_lt.ilike.%${escaped}%`,
				`term_en.ilike.%${escaped}%`,
				`section_title.ilike.%${escaped}%`
			].join(',')
		)
		.order('term_lt', { ascending: true, nullsFirst: false })
		.limit(limit);

	if (conceptError) {
		console.error('Nepavyko gauti sąvokų paieškos rezultatų', conceptError);
		throw new Error('Nepavyko atlikti paieškos.');
	}

	const conceptHits = (conceptData ?? []).map((item) => ({
		id: item.id,
		slug: item.slug,
		term: item.term_lt ?? item.term_en ?? item.slug,
		sectionTitle: item.section_title ?? null,
		sectionCode: item.section_code ?? null,
		snippet: buildSnippet(item.description_lt, trimmed)
	}));

	// Search for sections that match the query
	const { data: sectionData, error: sectionError } = await supabase
		.from('burburiuok_curriculum_nodes')
		.select('code, title, summary')
		.ilike('title', `%${escaped}%`)
		.limit(limit);

	if (sectionError) {
		console.error('Nepavyko gauti temų paieškos rezultatų', sectionError);
	}

	const sectionHits: SectionHit[] = (sectionData ?? []).map((item) => ({
		code: item.code,
		title: item.title,
		snippet: buildSnippet(item.summary, trimmed)
	}));

	const conceptIds = new Set(conceptHits.map((hit) => hit.id));

	const { data: descriptionData, error: descriptionError } = await supabase
		.from('burburiuok_concepts')
		.select(SELECT_FIELDS)
		.ilike('description_lt', `%${escaped}%`)
		.order('term_lt', { ascending: true, nullsFirst: false })
		.limit(limit);

	if (descriptionError) {
		console.error('Nepavyko gauti aprašymų paieškos rezultatų', descriptionError);
		throw new Error('Nepavyko atlikti paieškos.');
	}

	const descriptionHits = (descriptionData ?? [])
		.filter((item) => !conceptIds.has(item.id))
		.map((item) => ({
			id: item.id,
			slug: item.slug,
			term: item.term_lt ?? item.term_en ?? item.slug,
			sectionTitle: item.section_title ?? null,
			sectionCode: item.section_code ?? null,
			snippet: buildSnippet(item.description_lt, trimmed)
		}));

	return { conceptHits, descriptionHits, sectionHits };
}
