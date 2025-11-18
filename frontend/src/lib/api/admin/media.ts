import { z } from 'zod';
import { adminFetch } from './client';
import {
	adminMediaAssetTypeSchema,
	adminMediaSourceKindSchema,
	type AdminMediaCreateInput
} from '../../../../../shared/validation/adminMediaAssetSchema';

const nullableString = z.union([z.string(), z.null()]).optional();

const adminMediaAssetSchema = z
	.object({
		id: z.string().uuid(),
		conceptId: z.string().uuid(),
		assetType: adminMediaAssetTypeSchema,
		storagePath: nullableString,
		externalUrl: nullableString,
		sourceKind: adminMediaSourceKindSchema,
		title: nullableString,
		captionLt: nullableString,
		captionEn: nullableString,
		createdBy: nullableString,
		createdAt: z.string()
	})
	.transform((value) => ({
		...value,
		storagePath: typeof value.storagePath === 'string' ? value.storagePath : null,
		externalUrl: typeof value.externalUrl === 'string' ? value.externalUrl : null,
		title: typeof value.title === 'string' ? value.title : null,
		captionLt: typeof value.captionLt === 'string' ? value.captionLt : null,
		captionEn: typeof value.captionEn === 'string' ? value.captionEn : null,
		createdBy: typeof value.createdBy === 'string' ? value.createdBy : null
	}));

const mediaListResponseSchema = z.object({
	data: z.object({
		items: z.array(adminMediaAssetSchema)
	}),
	meta: z
		.object({
			count: z.number().nonnegative().optional(),
			hasMore: z.boolean().optional(),
			nextCursor: z.string().nullable().optional(),
			fetchedAt: z.string().optional()
		})
		.optional()
});

const mediaDetailResponseSchema = z.object({
	data: z.object({
		asset: adminMediaAssetSchema
	})
});

const mediaCreateResponseSchema = z.object({
	data: z.object({
		asset: adminMediaAssetSchema,
		upload: z
			.object({
				kind: z.literal('supabase-upload'),
				bucketId: z.string(),
				path: z.string(),
				url: z.string().url(),
				token: z.string(),
				expiresAt: z.string(),
				contentType: z.string()
			})
			.nullable()
			.optional()
	})
});

const mediaDeleteResponseSchema = z.object({
	data: z.object({
		deletedId: z.string(),
		storageStatus: z.enum(['skipped', 'removed', 'missing'])
	}),
	meta: z
		.object({
			deletedAt: z.string().optional()
		})
		.optional()
});

const signedUrlResponseSchema = z.object({
	data: z.discriminatedUnion('kind', [
		z.object({
			kind: z.literal('supabase-signed-url'),
			url: z.string().url(),
			expiresAt: z.string()
		}),
		z.object({
			kind: z.literal('external'),
			url: z.string().url(),
			expiresAt: z.null()
		})
	])
});

export type AdminMediaAsset = z.infer<typeof adminMediaAssetSchema>;
export type AdminMediaListMeta = {
	count: number;
	hasMore: boolean;
	nextCursor: string | null;
	fetchedAt: string | null;
};
export type AdminMediaUploadInstruction = NonNullable<
	z.infer<typeof mediaCreateResponseSchema>['data']['upload']
>;
export type AdminMediaSignedUrl = z.infer<typeof signedUrlResponseSchema>['data'];
export type AdminMediaSourceKind = z.infer<typeof adminMediaSourceKindSchema>;
export type AdminMediaAssetType = z.infer<typeof adminMediaAssetTypeSchema>;

export type AdminMediaListParams = {
	conceptId?: string;
	assetType?: AdminMediaAssetType;
	sourceKind?: AdminMediaSourceKind;
	search?: string;
	cursor?: string | null;
	limit?: number;
};

export async function listAdminMediaAssets(
	params: AdminMediaListParams = {}
): Promise<{ items: AdminMediaAsset[]; meta: AdminMediaListMeta }> {
	const searchParams = new URLSearchParams();

	if (params.conceptId) {
		searchParams.set('conceptId', params.conceptId);
	}

	if (params.assetType) {
		searchParams.set('assetType', params.assetType);
	}

	if (params.sourceKind) {
		searchParams.set('sourceKind', params.sourceKind);
	}

	if (params.search) {
		searchParams.set('search', params.search.trim());
	}

	if (params.cursor) {
		searchParams.set('cursor', params.cursor);
	}

	if (typeof params.limit === 'number') {
		searchParams.set('limit', String(params.limit));
	}

	const query = searchParams.toString();
	const target = query.length ? `/media?${query}` : '/media';
	const response = await adminFetch<unknown>(target);
	const parsed = mediaListResponseSchema.parse(response);

	const meta: AdminMediaListMeta = {
		count: parsed.meta?.count ?? parsed.data.items.length,
		hasMore: parsed.meta?.hasMore ?? false,
		nextCursor: parsed.meta?.nextCursor ?? null,
		fetchedAt: parsed.meta?.fetchedAt ?? null
	};

	return {
		items: parsed.data.items,
		meta
	};
}

export async function getAdminMediaAsset(id: string): Promise<AdminMediaAsset> {
	const response = await adminFetch<unknown>(`/media/${id}`);
	const parsed = mediaDetailResponseSchema.parse(response);
	return parsed.data.asset;
}

export async function createAdminMediaAsset(
	payload: AdminMediaCreateInput
): Promise<{ asset: AdminMediaAsset; upload: AdminMediaUploadInstruction | null }> {
	const response = await adminFetch<unknown>('/media', {
		method: 'POST',
		body: JSON.stringify(payload)
	});

	const parsed = mediaCreateResponseSchema.parse(response);
	return {
		asset: parsed.data.asset,
		upload: parsed.data.upload ?? null
	};
}

export async function deleteAdminMediaAsset(
	id: string
): Promise<{ deletedId: string; storageStatus: 'skipped' | 'removed' | 'missing' }> {
	const response = await adminFetch<unknown>(`/media/${id}`, {
		method: 'DELETE'
	});

	const parsed = mediaDeleteResponseSchema.parse(response);
	return parsed.data;
}

export async function fetchAdminMediaSignedUrl(
	id: string,
	params: { expiresIn?: number } = {}
): Promise<AdminMediaSignedUrl> {
	const searchParams = new URLSearchParams();

	if (typeof params.expiresIn === 'number') {
		searchParams.set('expiresIn', String(params.expiresIn));
	}

	const query = searchParams.toString();
	const target = query.length ? `/media/${id}/url?${query}` : `/media/${id}/url`;

	const response = await adminFetch<unknown>(target);
	const parsed = signedUrlResponseSchema.parse(response);
	return parsed.data;
}
