import type { ConceptDetail } from '$lib/api/concepts';
import type { AdminConceptResource, AdminConceptStatus } from '$lib/api/admin/concepts';
import type { AdminConceptMutationInput } from '../../../../shared/validation/adminConceptSchema';
import { normalizeSourceRef } from '$lib/admin/sourceReference';

const STATUS_FALLBACK: AdminConceptStatus = 'draft';
const STATUS_SET = new Set<AdminConceptStatus>(['draft', 'published']);

export type InlineConceptForm = {
	termLt: string;
	termEn: string;
	descriptionLt: string;
	descriptionEn: string;
	sourceRef: string;
	sectionCode: string;
	sectionTitle: string;
	subsectionCode: string;
	subsectionTitle: string;
	curriculumNodeCode: string;
	curriculumItemOrdinal: string;
	curriculumItemLabel: string;
	status: AdminConceptStatus;
	isRequired: boolean;
};

export type MetadataBadge = {
	key: string;
	value: string;
};

export function deriveConceptStatus(
	metadata: ConceptDetail['metadata'] | AdminConceptResource['metadata']
): AdminConceptStatus {
	const candidate = typeof metadata?.status === 'string' ? metadata.status : null;
	if (candidate && STATUS_SET.has(candidate as AdminConceptStatus)) {
		return candidate as AdminConceptStatus;
	}
	return STATUS_FALLBACK;
}

export function conceptToInlineForm(concept: ConceptDetail): InlineConceptForm {
	return {
		termLt: concept.termLt,
		termEn: concept.termEn ?? '',
		descriptionLt: concept.descriptionLt ?? '',
		descriptionEn: concept.descriptionEn ?? '',
		sourceRef: normalizeSourceRef(concept.sourceRef) ?? '',
		sectionCode: concept.sectionCode,
		sectionTitle: concept.sectionTitle,
		subsectionCode: concept.subsectionCode ?? '',
		subsectionTitle: concept.subsectionTitle ?? '',
		curriculumNodeCode: concept.curriculumNodeCode ?? '',
		curriculumItemOrdinal: concept.curriculumItemOrdinal === null
			? ''
			: String(concept.curriculumItemOrdinal),
		curriculumItemLabel: concept.curriculumItemLabel ?? '',
		status: deriveConceptStatus(concept.metadata ?? {}),
		isRequired: concept.isRequired
	};
}

export function inlineFormToPayload(
	concept: ConceptDetail,
	form: InlineConceptForm,
	overrides: { status?: AdminConceptStatus } = {}
): AdminConceptMutationInput {
	const status = overrides.status ?? form.status;
	const metadata = {
		...(concept.metadata ?? {}),
		status
	};

	return {
		slug: concept.slug,
		termLt: form.termLt.trim(),
		termEn: optionalString(form.termEn),
		descriptionLt: form.descriptionLt.trim(),
		descriptionEn: optionalString(form.descriptionEn),
		sectionCode: form.sectionCode.trim(),
		sectionTitle: form.sectionTitle.trim(),
		subsectionCode: optionalString(form.subsectionCode),
		subsectionTitle: optionalString(form.subsectionTitle),
		curriculumNodeCode: optionalString(form.curriculumNodeCode),
		curriculumItemOrdinal: optionalNumber(form.curriculumItemOrdinal),
		curriculumItemLabel: optionalString(form.curriculumItemLabel),
		sourceRef: normalizeSourceRef(form.sourceRef),
		isRequired: form.isRequired,
		metadata,
		status
	};
}

export function resourceToConceptDetail(resource: AdminConceptResource): ConceptDetail {
	return {
		id: resource.id,
		slug: resource.slug,
		termLt: resource.termLt,
		termEn: resource.termEn ?? null,
		descriptionLt: resource.descriptionLt ?? null,
		descriptionEn: resource.descriptionEn ?? null,
		sectionCode: resource.sectionCode,
		sectionTitle: resource.sectionTitle ?? '',
		subsectionCode: resource.subsectionCode ?? null,
		subsectionTitle: resource.subsectionTitle ?? null,
		curriculumNodeCode: resource.curriculumNodeCode ?? null,
		curriculumItemOrdinal: resource.curriculumItemOrdinal ?? null,
		curriculumItemLabel: resource.curriculumItemLabel ?? null,
		sourceRef: resource.sourceRef ?? null,
		metadata: resource.metadata ?? {},
		isRequired: resource.isRequired,
		createdAt: resource.createdAt ?? null,
		updatedAt: resource.updatedAt ?? null
	};
}

export function collectMetadataBadges(metadata: ConceptDetail['metadata']): MetadataBadge[] {
	if (!metadata) {
		return [];
	}

	return Object.entries(metadata)
		.filter(([key]) => key !== 'status')
		.map(([key, value]) => ({
			key,
			value: formatBadgeValue(value)
		}))
		.sort((a, b) => a.key.localeCompare(b.key, 'lt-LT'));
}

function optionalString(value: string): string | null {
	const trimmed = value.trim();
	return trimmed.length ? trimmed : null;
}

function optionalNumber(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed.length) {
		return null;
	}

	const parsed = Number.parseInt(trimmed, 10);
	return Number.isNaN(parsed) ? null : parsed;
}

function formatBadgeValue(value: unknown): string {
	if (value === null || value === undefined) {
		return '—';
	}

	if (typeof value === 'string' || typeof value === 'number') {
		return String(value);
	}

	if (typeof value === 'boolean') {
		return value ? 'taip' : 'ne';
	}

	if (Array.isArray(value)) {
		return value.map((entry) => formatBadgeValue(entry)).join(', ');
	}

	try {
		return JSON.stringify(value);
	} catch (error) {
		console.warn('Nepavyko serializuoti metaduomenų reikšmės', value, error);
		return '—';
	}
}
