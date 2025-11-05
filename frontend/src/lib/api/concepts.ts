import { getSupabaseClient } from '$lib/supabase/client';

export type ConceptDetail = {
	id: string;
	slug: string;
	termLt: string;
	termEn: string | null;
	descriptionLt: string | null;
	descriptionEn: string | null;
	sectionCode: string;
	sectionTitle: string;
	subsectionCode: string | null;
	subsectionTitle: string | null;
	curriculumNodeCode: string | null;
	curriculumItemOrdinal: number | null;
	curriculumItemLabel: string | null;
	sourceRef: string | null;
	metadata: Record<string, unknown> | null;
	isRequired: boolean;
	createdAt: string | null;
	updatedAt: string | null;
};

export async function fetchConceptBySlug(slug: string): Promise<ConceptDetail | null> {
	const supabase = getSupabaseClient();

	const { data, error } = await supabase
		.from('burburiuok_concepts')
		.select(
			'id,slug,term_lt,term_en,description_lt,description_en,section_code,section_title,subsection_code,subsection_title,curriculum_node_code,curriculum_item_ordinal,curriculum_item_label,source_ref,metadata,is_required,created_at,updated_at'
		)
		.eq('slug', slug)
		.maybeSingle();

	if (error) {
		console.error('Nepavyko įkelti koncepcijos duomenų', error);
		throw new Error('Nepavyko įkelti temos duomenų.');
	}

	if (!data) {
		return null;
	}

	return {
		id: data.id,
		slug: data.slug,
		termLt: data.term_lt,
		termEn: data.term_en,
		descriptionLt: data.description_lt,
		descriptionEn: data.description_en,
		sectionCode: data.section_code,
		sectionTitle: data.section_title,
		subsectionCode: data.subsection_code,
		subsectionTitle: data.subsection_title,
		curriculumNodeCode: data.curriculum_node_code,
		curriculumItemOrdinal: data.curriculum_item_ordinal,
		curriculumItemLabel: data.curriculum_item_label,
		sourceRef: data.source_ref,
		metadata: data.metadata,
		isRequired: Boolean(data.is_required),
		createdAt: data.created_at,
		updatedAt: data.updated_at
	};
}
