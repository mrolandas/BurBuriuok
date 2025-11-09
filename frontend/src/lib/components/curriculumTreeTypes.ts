import type { CurriculumItem, CurriculumNode } from '$lib/api/curriculum';

export type TreeNodeCreateChildState = {
	open: boolean;
	code: string;
	title: string;
	summary: string;
	error: string | null;
	busy: boolean;
};

export type TreeNodeEditState = {
	open: boolean;
	title: string;
	summary: string;
	error: string | null;
	busy: boolean;
};

export type TreeNodeDeleteState = {
	confirming: boolean;
	busy: boolean;
	error: string | null;
};

export type TreeNodeReorderState = {
	busy: boolean;
	error: string | null;
};

export type TreeNodeAdminState = {
	createChild: TreeNodeCreateChildState;
	edit: TreeNodeEditState;
	remove: TreeNodeDeleteState;
	reorder: TreeNodeReorderState;
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
