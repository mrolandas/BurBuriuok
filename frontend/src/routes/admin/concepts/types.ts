import type {
	AdminConceptResource,
	AdminConceptStatus,
	AdminConceptVersion
} from '$lib/api/admin/concepts';

export type ConceptEditorMode = 'create' | 'edit';

export type ConceptFormState = {
	slug: string;
	termLt: string;
	termEn: string;
	descriptionLt: string;
	descriptionEn: string;
	sectionCode: string;
	sectionTitle: string;
	subsectionCode: string;
	subsectionTitle: string;
	curriculumNodeCode: string;
	curriculumItemOrdinal: string;
	sourceRef: string;
	isRequired: boolean;
	status: AdminConceptStatus;
};

export type FieldErrors = Record<string, string[]>;

export type SectionSelectOption = {
	key: string;
	label: string;
	sectionCode: string;
	sectionTitle: string;
	subsectionCode: string | null;
	subsectionTitle: string | null;
	nodeCode: string;
	disabled?: boolean;
	depth?: number;
};

export type SectionFilterOption = {
	code: string;
	label: string;
};

export type HistoryAction = AdminConceptVersion & {
	statusLabel: string;
	isRollbackDisabled: boolean;
};

export type OptimisticContext = {
	previousSlug: string;
	newSlug: string;
	previousConcept: AdminConceptResource;
	removed: boolean;
};
