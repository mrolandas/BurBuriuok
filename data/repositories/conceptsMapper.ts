import type { Concept, ConceptRow } from "../types";

export function mapConceptRow(row: Partial<ConceptRow>): Concept {
  return {
    id: String(row.id ?? ""),
    sectionCode: String(row.section_code ?? ""),
    sectionTitle: row.section_title ?? null,
    subsectionCode: row.subsection_code ?? null,
    subsectionTitle: row.subsection_title ?? null,
    slug: String(row.slug ?? ""),
    termLt: String(row.term_lt ?? ""),
    termEn: row.term_en ?? null,
    descriptionLt: row.description_lt ?? null,
    descriptionEn: row.description_en ?? null,
    sourceRef: row.source_ref ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    isRequired: row.is_required === true,
    curriculumNodeCode: row.curriculum_node_code ?? null,
    curriculumItemOrdinal:
      typeof row.curriculum_item_ordinal === "number"
        ? row.curriculum_item_ordinal
        : null,
    curriculumItemLabel: row.curriculum_item_label ?? null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}
