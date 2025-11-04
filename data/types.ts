export type ConceptStatus = "learning" | "known" | "review";

export interface CurriculumNodeRow {
  code: string;
  title: string;
  summary: string | null;
  level: number;
  parent_code: string | null;
  ordinal: number;
  created_at: string;
  updated_at: string;
}

export interface CurriculumNode {
  code: string;
  title: string;
  summary: string | null;
  level: number;
  parentCode: string | null;
  ordinal: number;
  createdAt: string;
  updatedAt: string;
}

export interface CurriculumItemRow {
  node_code: string;
  ordinal: number;
  label: string;
  created_at: string;
  updated_at: string;
}

export interface CurriculumItem {
  nodeCode: string;
  ordinal: number;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConceptRow {
  id: string;
  section_code: string;
  section_title: string | null;
  subsection_code: string | null;
  subsection_title: string | null;
  slug: string;
  term_lt: string;
  term_en: string | null;
  description_lt: string | null;
  description_en: string | null;
  source_ref: string | null;
  metadata: Record<string, unknown> | null;
  is_required: boolean | null;
  curriculum_node_code: string | null;
  curriculum_item_ordinal: number | null;
  curriculum_item_label: string | null;
  created_at: string;
  updated_at: string;
}

export interface Concept {
  id: string;
  sectionCode: string;
  sectionTitle: string | null;
  subsectionCode: string | null;
  subsectionTitle: string | null;
  slug: string;
  termLt: string;
  termEn: string | null;
  descriptionLt: string | null;
  descriptionEn: string | null;
  sourceRef: string | null;
  metadata: Record<string, unknown>;
  isRequired: boolean;
  curriculumNodeCode: string | null;
  curriculumItemOrdinal: number | null;
  curriculumItemLabel: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertConceptInput {
  section_code: string;
  section_title?: string | null;
  subsection_code?: string | null;
  subsection_title?: string | null;
  slug: string;
  term_lt: string;
  term_en?: string | null;
  description_lt?: string | null;
  description_en?: string | null;
  source_ref?: string | null;
  metadata?: Record<string, unknown>;
  is_required?: boolean;
  curriculum_node_code?: string | null;
  curriculum_item_ordinal?: number | null;
  curriculum_item_label?: string | null;
}

export type ProgressStatus = ConceptStatus;

export interface ConceptProgressRow {
  concept_id: string;
  device_key: string;
  status: ProgressStatus | null;
  last_reviewed_at: string;
  created_at: string;
  updated_at: string;
}

export interface ConceptProgress {
  conceptId: string;
  deviceKey: string;
  status: ProgressStatus;
  lastReviewedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertProgressInput {
  concept_id: string;
  device_key: string;
  status?: ProgressStatus;
  last_reviewed_at?: string;
}

export type DependencyEntityType = "concept" | "node";

export interface CurriculumDependencyRow {
  id: string;
  source_type: DependencyEntityType;
  source_concept_id: string | null;
  source_node_code: string | null;
  prerequisite_type: DependencyEntityType;
  prerequisite_concept_id: string | null;
  prerequisite_node_code: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CurriculumDependency {
  id: string;
  source: {
    type: DependencyEntityType;
    conceptId: string | null;
    nodeCode: string | null;
  };
  prerequisite: {
    type: DependencyEntityType;
    conceptId: string | null;
    nodeCode: string | null;
  };
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}
