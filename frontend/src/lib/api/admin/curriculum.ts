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
	code: string;
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

export async function createCurriculumNode(
	input: CreateCurriculumNodeInput
): Promise<AdminCurriculumNode> {
	const response = await adminFetch<CreateCurriculumNodeResponse>('/curriculum/nodes', {
		method: 'POST',
		body: JSON.stringify(input)
	});

	return response.data.node;
}
