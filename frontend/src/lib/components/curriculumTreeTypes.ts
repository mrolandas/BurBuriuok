import type { CurriculumItem, CurriculumNode } from '$lib/api/curriculum';

export type TreeNodeConceptConflict = {
	slug: string;
	term: string;
	nodeCode: string | null;
	itemLabel: string | null;
};

export type TreeNodeCreateChildState = {
	open: boolean;
	code: string;
	title: string;
	summary: string;
	error: string | null;
	busy: boolean;
};

export type TreeNodeCreateItemState = {
	open: boolean;
	term: string;
	description: string;
	termEn: string;
	sourceRef: string;
	isRequired: boolean;
	error: string | null;
	conflict: TreeNodeConceptConflict | null;
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
	createItem: TreeNodeCreateItemState;
	edit: TreeNodeEditState;
	remove: TreeNodeDeleteState;
	reorder: TreeNodeReorderState;
};

export type TreeItemAdminState = {
	busy: boolean;
	error: string | null;
	confirmingDelete: boolean;
};

export type TreeNodeState = {
	id: string;
	node: CurriculumNode;
	expanded: boolean;
	loading: boolean;
	loaded: boolean;
	children: TreeNodeState[];
	items: CurriculumItem[];
	itemAdmin: Record<string, TreeItemAdminState>;
	error: string | null;
	admin: TreeNodeAdminState;
};

export type TreeNodeOrderChange = {
	parentCode: string | null;
	orderedIds: string[];
	orderedNodes: TreeNodeState[];
	trigger: string;
	source: string;
	draggedId?: string;
};

export type TreeNodeOrderFinalize = TreeNodeOrderChange & {
	draggedId: string;
};
