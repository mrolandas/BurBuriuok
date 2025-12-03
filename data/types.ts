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

export interface MediaAssetRow {
  id: string;
  concept_id: string;
  asset_type: "image" | "video";
  storage_path: string;
  external_url: string | null;
  title: string | null;
  caption_lt: string | null;
  caption_en: string | null;
  created_by: string | null;
  created_at: string;
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
  device_key: string | null;
  user_id: string | null;
  status: ProgressStatus | null;
  last_reviewed_at: string;
  created_at: string;
  updated_at: string;
}

export interface ConceptProgress {
  conceptId: string;
  deviceKey: string | null;
  userId: string | null;
  status: ProgressStatus;
  lastReviewedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertProgressInput {
  concept_id: string;
  device_key?: string | null;
  user_id?: string | null;
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

export type ContentEntityType =
  | "curriculum_node"
  | "curriculum_item"
  | "concept"
  | "media_asset";

export type ContentVersionStatus =
  | "draft"
  | "in_review"
  | "published"
  | "archived";

export type ContentVersionChangeType = "create" | "update" | "delete";

export type ContentDraftStatus = "draft" | "in_review";

export interface ContentVersionChangeInput {
  fieldPath: string;
  oldValue: unknown;
  newValue: unknown;
  changeType?: ContentVersionChangeType;
}

export interface ContentVersionInput {
  entityType: ContentEntityType;
  entityPrimaryKey: string;
  status?: ContentVersionStatus;
  changeSummary?: string | null;
  diff?: unknown;
  snapshot?: unknown;
  actor?: string | null;
  changes?: ContentVersionChangeInput[];
}

export interface ContentDraftDbRow {
  id: string;
  entity_type: ContentEntityType;
  entity_primary_key: string;
  payload: unknown;
  status: ContentDraftStatus;
  change_summary: string | null;
  version_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentDraftInput {
  entityType: ContentEntityType;
  entityPrimaryKey: string;
  payload: unknown;
  status?: ContentDraftStatus;
  changeSummary?: string | null;
  versionId?: string | null;
  actor?: string | null;
}

export type ProfileRole = "learner" | "admin" | "contributor";
export type PreferredLanguage = "lt" | "en";

export interface ProfileRow {
  id: string;
  email: string;
  role: ProfileRole;
  preferred_language: PreferredLanguage;
  callsign: string | null;
  device_key_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  role: ProfileRole;
  preferredLanguage: PreferredLanguage;
  callsign: string | null;
  deviceKeyHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertProfileInput {
  id: string;
  email: string;
  role?: ProfileRole;
  preferredLanguage?: PreferredLanguage;
  callsign?: string | null;
  deviceKeyHash?: string | null;
}

export interface AdminInviteRow {
  id: string;
  email: string;
  role: ProfileRole;
  token_hash: string;
  expires_at: string;
  invited_by: string | null;
  accepted_profile_id: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminInvite {
  id: string;
  email: string;
  role: ProfileRole;
  expiresAt: string;
  invitedBy: string | null;
  acceptedProfileId: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
