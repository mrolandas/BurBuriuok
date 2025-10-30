export type ConceptStatus = "learning" | "known" | "review";

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
