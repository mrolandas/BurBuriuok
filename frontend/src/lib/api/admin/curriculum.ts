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
