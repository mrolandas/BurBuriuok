import type { CurriculumItem, CurriculumNode } from '$lib/api/curriculum';

export type TreeNodeAdminState = {
	createChild: {
		open: boolean;
		code: string;
		title: string;
		summary: string;
		error: string | null;
		busy: boolean;
	};
};

export type TreeNodeState = {
	node: CurriculumNode;
	expanded: boolean;
	loading: boolean;
	loaded: boolean;
	children: TreeNodeState[];
	items: CurriculumItem[];
	error: string | null;
	admin: TreeNodeAdminState;
};
