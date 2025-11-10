import { z } from 'zod';
import { adminFetch } from './client';
import {
	adminConceptMutationSchema,
	adminConceptStatusSchema,
	type AdminConceptMutationInput
} from '../../../../../shared/validation/adminConceptSchema';

const nullableString = z.union([z.string(), z.null()]).optional();
const nullableNumber = z.union([z.number(), z.null()]).optional();

const adminConceptResourceSchema = z
	.object({
		id: z.string().min(1),
		slug: z.string().min(1),
		termLt: z.string(),
		termEn: nullableString,
		descriptionLt: z.string(),
		descriptionEn: nullableString,
		sectionCode: z.string().min(1),
		sectionTitle: nullableString,
		subsectionCode: nullableString,
		subsectionTitle: nullableString,
		curriculumNodeCode: nullableString,
		curriculumItemOrdinal: nullableNumber,
		curriculumItemLabel: nullableString,
		sourceRef: nullableString,
		isRequired: z.boolean(),
		metadata: z.record(z.string(), z.unknown()).optional(),
		status: adminConceptStatusSchema,
		createdAt: nullableString,
		updatedAt: nullableString
	})
	.passthrough()
	.transform((value) => ({
		...value,
		termEn: typeof value.termEn === 'string' ? value.termEn : null,
		descriptionEn: typeof value.descriptionEn === 'string' ? value.descriptionEn : null,
		sectionTitle: typeof value.sectionTitle === 'string' ? value.sectionTitle : null,
		subsectionCode: typeof value.subsectionCode === 'string' ? value.subsectionCode : null,
		subsectionTitle: typeof value.subsectionTitle === 'string' ? value.subsectionTitle : null,
		curriculumNodeCode:
			typeof value.curriculumNodeCode === 'string' ? value.curriculumNodeCode : null,
		curriculumItemOrdinal:
			typeof value.curriculumItemOrdinal === 'number' ? value.curriculumItemOrdinal : null,
		curriculumItemLabel:
			typeof value.curriculumItemLabel === 'string' ? value.curriculumItemLabel : null,
		sourceRef: typeof value.sourceRef === 'string' ? value.sourceRef : null,
		metadata: value.metadata ?? {},
		createdAt: typeof value.createdAt === 'string' ? value.createdAt : null,
		updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null
	}));

const listResponseSchema = z.object({
	data: z.object({
		concepts: z.array(adminConceptResourceSchema)
	}),
	meta: z
		.object({
			count: z.number().nonnegative(),
			fetchedAt: z.string()
		})
		.passthrough()
		.optional()
});

const detailResponseSchema = z.object({
	data: z.object({
		concept: adminConceptResourceSchema
	}),
	meta: z
		.object({
			fetchedAt: z.string()
		})
		.passthrough()
		.optional()
});

const upsertResponseSchema = z.object({
	data: z.object({
		concept: adminConceptResourceSchema
	}),
	meta: z
		.object({
			savedAt: z.string()
		})
		.passthrough()
		.optional()
});

const deletedCurriculumItemSchema = z
	.object({
		nodeCode: z.string(),
		ordinal: z.number(),
		label: z.string(),
		createdAt: z.string(),
		updatedAt: z.string()
	})
	.passthrough();

const deleteResponseSchema = z.object({
	data: z.object({
		concept: adminConceptResourceSchema,
		item: deletedCurriculumItemSchema.nullable().optional()
	}),
	meta: z
		.object({
			deletedAt: z.string()
		})
		.passthrough()
		.optional()
});

const conceptVersionSchema = z.object({
	id: z.string(),
	status: adminConceptStatusSchema.nullable().optional(),
	changeSummary: z.string().nullable().optional(),
	diff: z.unknown().optional(),
	createdAt: z.string(),
	createdBy: z.string().nullable().optional(),
	version: z.number().int().nullable().optional()
});

const historyResponseSchema = z.object({
	data: z.object({
		versions: z.array(conceptVersionSchema)
	}),
	meta: z
		.object({
			count: z.number().nonnegative(),
			fetchedAt: z.string()
		})
		.passthrough()
		.optional()
});

export type AdminConceptResource = z.infer<typeof adminConceptResourceSchema>;
export type AdminConceptStatus = z.infer<typeof adminConceptStatusSchema>;
export type AdminConceptVersion = z.infer<typeof conceptVersionSchema>;
export type AdminDeletedCurriculumItem = z.infer<typeof deletedCurriculumItemSchema>;

export async function listAdminConcepts(params: {
	sectionCode?: string;
	status?: AdminConceptStatus;
} = {}): Promise<AdminConceptResource[]> {
	const searchParams = new URLSearchParams();

	if (params.sectionCode) {
		searchParams.set('sectionCode', params.sectionCode);
	}

	if (params.status) {
		searchParams.set('status', params.status);
	}

	const query = searchParams.toString();
	const target = query.length ? `/concepts?${query}` : '/concepts';
	const response = await adminFetch<unknown>(target);
	const parsed = listResponseSchema.parse(response);

	return parsed.data.concepts;
}

export async function getAdminConcept(slug: string): Promise<AdminConceptResource | null> {
	const response = await adminFetch<unknown>(`/concepts/${slug}`);
	const parsed = detailResponseSchema.parse(response);
	return parsed.data.concept;
}

export async function saveAdminConcept(
	payload: AdminConceptMutationInput
): Promise<AdminConceptResource> {
	const response = await adminFetch<unknown>('/concepts', {
		method: 'POST',
		body: JSON.stringify(payload)
	});

	const parsed = upsertResponseSchema.parse(response);
	return parsed.data.concept;
}

export async function deleteAdminConcept(
	slug: string
): Promise<{ concept: AdminConceptResource; item: AdminDeletedCurriculumItem | null }> {
	const response = await adminFetch<unknown>(`/concepts/${slug}`, {
		method: 'DELETE'
	});

	const parsed = deleteResponseSchema.parse(response);
	return {
		concept: parsed.data.concept,
		item: parsed.data.item ?? null
	};
}

export async function fetchAdminConceptHistory(
	slug: string,
	params: { limit?: number } = {}
): Promise<AdminConceptVersion[]> {
	const searchParams = new URLSearchParams();
	if (typeof params.limit === 'number') {
		searchParams.set('limit', String(params.limit));
	}

	const query = searchParams.toString();
	const target = query.length ? `/concepts/${slug}/history?${query}` : `/concepts/${slug}/history`;
	const response = await adminFetch<unknown>(target);
	const parsed = historyResponseSchema.parse(response);
	return parsed.data.versions;
}

export const adminConceptFormSchema = adminConceptMutationSchema;
