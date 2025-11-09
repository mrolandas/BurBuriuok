import { adminFetch } from '$lib/api/admin/client';

export type AdminCurriculumNode = {
	code: string;
	title: string;
	summary: string | null;
	level: number;
	parentCode: string | null;
	ordinal: number;
	createdAt: string;
	updatedAt: string;
};

export type CreateCurriculumNodeInput = {
	code?: string | null;
	title: string;
	summary?: string | null;
	parentCode?: string | null;
	ordinal?: number;
};

type CreateCurriculumNodeResponse = {
	data: {
		node: AdminCurriculumNode;
	};
};

export type UpdateCurriculumNodeInput = {
	title?: string;
	summary?: string | null;
	parentCode?: string | null;
	ordinal?: number | null;
};

type UpdateCurriculumNodeResponse = {
	data: {
		node: AdminCurriculumNode;
	};
};

type DeleteCurriculumNodeResponse = {
	data: {
		node: AdminCurriculumNode;
	};
};

export type AdminCurriculumItem = {
	nodeCode: string;
	ordinal: number;
	label: string;
	conceptSlug: string;
	conceptTerm: string;
	isRequired: boolean;
	createdAt: string;
	updatedAt: string;
};

export type CreateCurriculumItemInput = {
	nodeCode: string;
	label: string;
	termLt?: string;
	termEn?: string | null;
	descriptionLt?: string | null;
	descriptionEn?: string | null;
	sourceRef?: string | null;
	isRequired?: boolean;
};

type CreateCurriculumItemResponse = {
	data: {
		item: AdminCurriculumItem;
	};
};

export async function createCurriculumNode(
	input: CreateCurriculumNodeInput
): Promise<AdminCurriculumNode> {
	const response = await adminFetch<CreateCurriculumNodeResponse>('/curriculum/nodes', {
		method: 'POST',
		body: JSON.stringify(input)
	});

	return response.data.node;
}

export async function updateCurriculumNode(
	code: string,
	input: UpdateCurriculumNodeInput
): Promise<AdminCurriculumNode> {
	const target = `/curriculum/nodes/${encodeURIComponent(code)}`;
	const response = await adminFetch<UpdateCurriculumNodeResponse>(target, {
		method: 'PATCH',
		body: JSON.stringify(input)
	});

	return response.data.node;
}

export async function deleteCurriculumNode(code: string): Promise<AdminCurriculumNode> {
	const target = `/curriculum/nodes/${encodeURIComponent(code)}`;
	const response = await adminFetch<DeleteCurriculumNodeResponse>(target, {
		method: 'DELETE'
	});

	return response.data.node;
}

export async function createCurriculumItem(
	input: CreateCurriculumItemInput
): Promise<AdminCurriculumItem> {
	const payload = {
		nodeCode: input.nodeCode,
		label: input.label,
		termLt: input.termLt,
		termEn: input.termEn ?? undefined,
		descriptionLt: input.descriptionLt ?? undefined,
		descriptionEn: input.descriptionEn ?? undefined,
		sourceRef: input.sourceRef ?? undefined,
		isRequired: typeof input.isRequired === 'boolean' ? input.isRequired : undefined
	} satisfies Record<string, unknown>;

	const response = await adminFetch<CreateCurriculumItemResponse>('/curriculum/items', {
		method: 'POST',
		body: JSON.stringify(payload)
	});

	return response.data.item;
}
