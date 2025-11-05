import type { CurriculumItem, CurriculumNode } from '$lib/api/curriculum';

export type TreeNodeState = {
	node: CurriculumNode;
	expanded: boolean;
	loading: boolean;
	loaded: boolean;
	children: TreeNodeState[];
	items: CurriculumItem[];
	error: string | null;
};
