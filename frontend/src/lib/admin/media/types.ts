import type { AdminMediaAsset } from '$lib/api/admin/media';

export type MediaConceptOption = {
	id: string;
	slug: string;
	label: string;
};

export type MediaCreateSuccessDetail = {
	asset: AdminMediaAsset;
};
