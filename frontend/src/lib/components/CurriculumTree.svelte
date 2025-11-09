<script lang="ts">
	import CurriculumTreeBranch from './CurriculumTreeBranch.svelte';
	import type { CurriculumNode } from '$lib/api/curriculum';
	import { fetchChildNodes, fetchNodeItems } from '$lib/api/curriculum';
	import {
		createCurriculumItem,
		createCurriculumNode,
		updateCurriculumNode,
		deleteCurriculumNode
	} from '$lib/api/admin/curriculum';
	import { adminMode } from '$lib/stores/adminMode';
	import { onDestroy, onMount } from 'svelte';
	import { AdminApiError } from '$lib/api/admin/client';
	import type {
		TreeNodeState,
		TreeNodeAdminState,
		TreeNodeCreateChildState,
		TreeNodeCreateItemState,
		TreeNodeEditState,
		TreeNodeDeleteState,
		TreeNodeReorderState,
		TreeNodeOrderChange,
		TreeNodeOrderFinalize
	} from './curriculumTreeTypes';

	type SectionSummary = {
		code: string;
		title: string;
		summary: string | null;
	};

	export let section: SectionSummary;
	export let initialNodes: CurriculumNode[] = [];

	let adminEnabled = false;
	let adminModeUnsubscribe: (() => void) | null = null;
	let activeCreateNodeCode: string | null = null;
	let activeCreateItemNodeCode: string | null = null;
	let dragAndDropEnabled = false;
	let dragSessionActive = false;
	const allowCreateChild = true;

	type DragSnapshot = {
		nodeId: string;
		originParentCode: string | null;
		originOrdinal: number;
	};

	let activeDragSnapshot: DragSnapshot | null = null;

	type PendingReorder = {
		parentCode: string | null;
		orderedIds: string[];
		orderedNodes: TreeNodeState[];
	};

	let pendingReorders = new Map<string | null, PendingReorder>();
	let pendingParentCodes = new Set<string | null>();
	let pendingNodeCodes = new Set<string>();
	let baselinePositions = new Map<string, { parentCode: string | null; ordinal: number }>();
	let reorderSaving = false;
	let reorderError: string | null = null;
	let pendingChangeCount = 0;

	const createCreateChildState = (): TreeNodeCreateChildState => ({
		open: false,
		code: '',
		title: '',
		summary: '',
		error: null,
		busy: false
	});

	const createCreateItemState = (): TreeNodeCreateItemState => ({
		open: false,
		term: '',
		description: '',
		termEn: '',
		sourceRef: '',
		isRequired: true,
		error: null,
		busy: false
	});

	const createEditState = (): TreeNodeEditState => ({
		open: false,
		title: '',
		summary: '',
		error: null,
		busy: false
	});

	const createDeleteState = (): TreeNodeDeleteState => ({
		confirming: false,
		busy: false,
		error: null
	});

	const createReorderState = (): TreeNodeReorderState => ({
		busy: false,
		error: null
	});

	const createAdminState = (): TreeNodeAdminState => ({
		createChild: createCreateChildState(),
		createItem: createCreateItemState(),
		edit: createEditState(),
		remove: createDeleteState(),
		reorder: createReorderState()
	});

	const createState = (node: CurriculumNode): TreeNodeState => ({
		id: node.code,
		node,
		expanded: false,
		loading: false,
		loaded: false,
		children: [],
		items: [],
		error: null,
		admin: createAdminState()
	});

	let roots: TreeNodeState[] = initialNodes.map(createState);

	const visitTree = (nodes: TreeNodeState[], visitor: (state: TreeNodeState) => void) => {
		nodes.forEach((node) => {
			visitor(node);
			if (node.children.length) {
				visitTree(node.children, visitor);
			}
		});
	};

	const closeCreateChildFormsExcept = (target: TreeNodeState | null) => {
		visitTree(roots, (state) => {
			if (target && state.node.code === target.node.code) {
				return;
			}
			if (state.admin.createChild.open || state.admin.createChild.error || state.admin.createChild.busy) {
				state.admin.createChild = createCreateChildState();
			}
		});
	};

	const closeCreateItemFormsExcept = (target: TreeNodeState | null) => {
		visitTree(roots, (state) => {
			if (target && state.node.code === target.node.code) {
				return;
			}
			if (state.admin.createItem.open || state.admin.createItem.error || state.admin.createItem.busy) {
				state.admin.createItem = createCreateItemState();
			}
		});
	};

	const refreshTree = () => {
		roots = [...roots];
	};

	const refreshPendingSets = () => {
		pendingParentCodes = new Set(pendingReorders.keys());
		const nextNodes = new Set<string>();
		for (const code of baselinePositions.keys()) {
			nextNodes.add(code);
		}
		pendingNodeCodes = nextNodes;
	};

	const captureBaselineForParent = (parentCode: string | null) => {
		const parentState = parentCode ? findNodeState(parentCode) : null;
		const collection = parentState ? parentState.children : roots;
		if (!collection.length) {
			return;
		}
		const next = new Map(baselinePositions);
		for (const node of collection) {
			if (!next.has(node.node.code)) {
				next.set(node.node.code, {
					parentCode,
					ordinal: node.node.ordinal
				});
			}
		}
		if (next.size !== baselinePositions.size) {
			baselinePositions = next;
		}
	};

	const cleanupResolvedBaselines = () => {
		if (!baselinePositions.size) {
			return;
		}
		const next = new Map(baselinePositions);
		for (const [code, initial] of baselinePositions.entries()) {
			const nodeState = findNodeState(code);
			if (!nodeState) {
				next.delete(code);
				continue;
			}
			const currentParent = findParentState(code);
			const currentParentCode = currentParent ? currentParent.node.code : null;
			const currentOrdinal = nodeState.node.ordinal;
			if (currentParentCode === initial.parentCode && currentOrdinal === initial.ordinal) {
				next.delete(code);
			}
		}
		if (next.size !== baselinePositions.size) {
			baselinePositions = next;
		}
	};

	const pruneResolvedPending = () => {
		if (!pendingReorders.size) {
			if (pendingParentCodes.size || pendingNodeCodes.size) {
				pendingParentCodes = new Set();
				pendingNodeCodes = new Set();
			}
			return;
		}
		const next = new Map<string | null, PendingReorder>();
		for (const [parentCode, entry] of pendingReorders.entries()) {
			const hasBaselineNode = entry.orderedIds.some((id) => baselinePositions.has(id));
			if (hasBaselineNode) {
				next.set(parentCode, entry);
			}
		}
		if (next.size !== pendingReorders.size) {
			pendingReorders = next;
		}
	};

	const refreshPendingState = () => {
		cleanupResolvedBaselines();
		pruneResolvedPending();
		refreshPendingSets();
	};

	$: pendingChangeCount = pendingNodeCodes.size;
	$: if (!dragAndDropEnabled && dragSessionActive) {
		dragSessionActive = false;
	}

	const registerPendingReorderForParent = (parentCode: string | null) => {
		const parentState = parentCode ? findNodeState(parentCode) : null;
		const collection = parentState ? parentState.children : roots;
		const pending: PendingReorder = {
			parentCode,
			orderedIds: collection.map((state) => state.node.code),
			orderedNodes: [...collection]
		};
		const next = new Map(pendingReorders);
		next.set(parentCode, pending);
		pendingReorders = next;
	};

	onMount(() => {
		adminMode.initialize();
		adminModeUnsubscribe = adminMode.subscribe((value) => {
			adminEnabled = value;
			if (!value) {
				dragAndDropEnabled = false;
			}
			refreshTree();
		});
	});

	onDestroy(() => {
		if (adminModeUnsubscribe) {
			adminModeUnsubscribe();
			adminModeUnsubscribe = null;
		}
	});

	$: if (initialNodes) {
		roots = initialNodes.map(createState);
	}

	const resetCreateChildForm = (state: TreeNodeState, options: { open?: boolean } = {}) => {
		const next = createCreateChildState();
		next.open = options.open ?? state.admin.createChild.open;
		state.admin.createChild = next;
		refreshTree();
	};

	const resetCreateItemForm = (state: TreeNodeState, options: { open?: boolean } = {}) => {
		const next = createCreateItemState();
		next.open = options.open ?? state.admin.createItem.open;
		state.admin.createItem = next;
		refreshTree();
	};

	const openCreateChildForm = (state: TreeNodeState) => {
		if (activeCreateNodeCode && activeCreateNodeCode !== state.node.code) {
			closeCreateChildFormsExcept(state);
		}
		activeCreateNodeCode = state.node.code;
		state.expanded = true;
		if (!state.loaded) {
			void ensureChildren(state);
		}

		resetCreateChildForm(state, { open: true });
		refreshTree();
	};

	const cancelCreateChildForm = (state: TreeNodeState) => {
		resetCreateChildForm(state, { open: false });
		if (activeCreateNodeCode === state.node.code) {
			activeCreateNodeCode = null;
		}
		refreshTree();
	};

	const openCreateItemForm = (state: TreeNodeState) => {
		if (activeCreateItemNodeCode && activeCreateItemNodeCode !== state.node.code) {
			closeCreateItemFormsExcept(state);
		}
		activeCreateItemNodeCode = state.node.code;
		if (!state.expanded) {
			state.expanded = true;
		}
		if (!state.loaded) {
			void ensureChildren(state);
		}
		resetCreateItemForm(state, { open: true });
		refreshTree();
	};

	const cancelCreateItemForm = (state: TreeNodeState) => {
		state.admin.createItem = createCreateItemState();
		if (activeCreateItemNodeCode === state.node.code) {
			activeCreateItemNodeCode = null;
		}
		refreshTree();
	};

	type CreateChildField = 'code' | 'title' | 'summary';
	type CreateItemField = 'term' | 'description' | 'termEn' | 'sourceRef' | 'isRequired';
	type EditField = 'title' | 'summary';

	const updateCreateChildField = (state: TreeNodeState, field: CreateChildField, value: string) => {
		const form = state.admin.createChild;
		form[field] = value;
		if (form.error) {
			form.error = null;
		}
		refreshTree();
	};

	const updateCreateItemField = (
		state: TreeNodeState,
		field: CreateItemField,
		value: string | boolean
	) => {
		const form = state.admin.createItem;
		if (field === 'isRequired') {
			form.isRequired = Boolean(value);
		} else {
			form[field] = typeof value === 'string' ? value : form[field];
		}
		if (form.error) {
			form.error = null;
		}
		refreshTree();
	};

	const translateApiError = (error: unknown, fallback: string): string => {
		if (error instanceof AdminApiError) {
			const apiError: AdminApiError = error;
			if (apiError.status === 409) {
				return 'Toks kodas jau naudojamas. Pasirinkite kitą kodą arba palikite lauką tuščią.';
			}
			if (apiError.status === 400 || apiError.status === 404) {
				return apiError.message;
			}
			return apiError.message || fallback;
		}

		if (error instanceof Error) {
			return error.message || fallback;
		}

		return fallback;
	};

	const openEditForm = (state: TreeNodeState) => {
		if (!state.expanded) {
			state.expanded = true;
		}
		const form = state.admin.edit;
		form.title = state.node.title;
		form.summary = state.node.summary ?? '';
		form.error = null;
		form.busy = false;
		form.open = true;
		refreshTree();
		if (!state.loaded) {
			void ensureChildren(state);
		}
	};

	const cancelEditForm = (state: TreeNodeState) => {
		state.admin.edit = {
			...createEditState()
		};
		refreshTree();
	};

	const updateEditField = (state: TreeNodeState, field: EditField, value: string) => {
		const form = state.admin.edit;
		form[field] = value;
		if (form.error) {
			form.error = null;
		}
		refreshTree();
	};

	const findSiblingCollection = (parent: TreeNodeState | null): TreeNodeState[] => {
		return parent ? parent.children : roots;
	};

	const refreshSiblingOrdinals = (siblings: TreeNodeState[]) => {
		siblings.forEach((sibling, index) => {
			sibling.node.ordinal = index + 1;
		});
	};

	const findNodeState = (code: string, nodes: TreeNodeState[] = roots): TreeNodeState | null => {
		for (const node of nodes) {
			if (node.node.code === code) {
				return node;
			}
			if (node.children.length) {
				const match = findNodeState(code, node.children);
				if (match) {
					return match;
				}
			}
		}
		return null;
	};

	const findParentState = (
		code: string,
		nodes: TreeNodeState[] = roots,
		parent: TreeNodeState | null = null
	): TreeNodeState | null => {
		for (const node of nodes) {
			if (node.node.code === code) {
				return parent;
			}
			if (node.children.length) {
				const match = findParentState(code, node.children, node);
				if (match) {
					return match;
				}
			}
		}
		return null;
	};

	const detachNode = (code: string): TreeNodeState | null => {
		const parent = findParentState(code);
		const collection = parent ? parent.children : roots;
		const index = collection.findIndex((entry) => entry.node.code === code);
		if (index === -1) {
			return null;
		}
		const [removed] = collection.splice(index, 1);
		return removed;
	};

	const applyNodeOrderChange = (change: TreeNodeOrderChange) => {
		const parentState = change.parentCode ? findNodeState(change.parentCode) : null;
		const nodesToAssign = [...change.orderedNodes];
		const parentsToNormalize = new Set<TreeNodeState | null>();

		if (!nodesToAssign.length) {
			if (parentState) {
				parentState.children = [];
			} else {
				roots = [];
			}
			refreshTree();
			return;
		}

		const targetParentCode = parentState ? parentState.node.code : null;

		for (const node of nodesToAssign) {
			const currentParent = findParentState(node.node.code);
			const currentParentCode = currentParent ? currentParent.node.code : null;
			if (currentParentCode !== targetParentCode) {
				detachNode(node.node.code);
				parentsToNormalize.add(currentParent ?? null);
			}
		}

		if (parentState) {
			parentState.children = nodesToAssign;
			refreshSiblingOrdinals(parentState.children);
		} else {
			roots = nodesToAssign;
			refreshSiblingOrdinals(roots);
		}

		parentsToNormalize.forEach((normalParent) => {
			if (normalParent) {
				normalParent.children = [...normalParent.children];
				refreshSiblingOrdinals(normalParent.children);
			} else {
				roots = [...roots];
				refreshSiblingOrdinals(roots);
			}
		});

		refreshTree();
	};

	const handleNodeDragConsider = (change: TreeNodeOrderChange) => {
		if (!dragAndDropEnabled) {
			return;
		}

		const draggedId = change.draggedId;
		if (!draggedId) {
			return;
		}

		const wasActive = dragSessionActive;
		const shouldActivate = change.trigger !== 'dragStopped';
		dragSessionActive = shouldActivate;

		if (!shouldActivate) {
			activeDragSnapshot = null;
			return;
		}

		if (!activeDragSnapshot || activeDragSnapshot.nodeId !== draggedId) {
			const draggedState = findNodeState(draggedId);
			const originParent = findParentState(draggedId);
			activeDragSnapshot = {
				nodeId: draggedId,
				originParentCode: originParent ? originParent.node.code : null,
				originOrdinal: draggedState ? draggedState.node.ordinal : -1
			};
		}

		if (!wasActive && activeDragSnapshot) {
			captureBaselineForParent(activeDragSnapshot.originParentCode);
		}

		const targetParentCode = change.parentCode ?? null;
		captureBaselineForParent(targetParentCode);
		applyNodeOrderChange(change);
	};

	const handleNodeDragFinalize = (change: TreeNodeOrderFinalize) => {
		if (!dragAndDropEnabled) {
			return;
		}

		dragSessionActive = false;
		const snapshot = activeDragSnapshot;
		activeDragSnapshot = null;

		const draggedNode = findNodeState(change.draggedId);
		if (!draggedNode) {
			refreshPendingState();
			return;
		}

		const previousParentCode = snapshot && snapshot.nodeId === change.draggedId
			? snapshot.originParentCode
			: (() => {
				const fallbackParent = findParentState(change.draggedId);
				return fallbackParent ? fallbackParent.node.code : null;
			})();
		const previousOrdinal = snapshot && snapshot.nodeId === change.draggedId && snapshot.originOrdinal > -1
			? snapshot.originOrdinal
			: draggedNode.node.ordinal;
		const targetParentCode = change.parentCode ?? null;

		captureBaselineForParent(previousParentCode);
		captureBaselineForParent(targetParentCode);

		applyNodeOrderChange(change);

		const newIndex = change.orderedIds.findIndex((id) => id === change.draggedId);
		const newOrdinal = newIndex === -1 ? null : newIndex + 1;

		if (previousParentCode === targetParentCode && (newOrdinal === null || previousOrdinal === newOrdinal)) {
			refreshPendingState();
			return;
		}

		registerPendingReorderForParent(targetParentCode);
		if (previousParentCode !== targetParentCode) {
			registerPendingReorderForParent(previousParentCode);
		}

		refreshPendingState();
	};

	const cancelPendingReorders = () => {
		if (!baselinePositions.size) {
			return;
		}

		const parentEntries = new Map<string | null, { code: string; ordinal: number }[]>();
		for (const [code, position] of baselinePositions.entries()) {
			const list = parentEntries.get(position.parentCode) ?? [];
			list.push({ code, ordinal: position.ordinal });
			parentEntries.set(position.parentCode, list);
		}

		for (const [parentCode, entries] of parentEntries.entries()) {
			entries.sort((a, b) => a.ordinal - b.ordinal);
			const nodeStates = entries
				.map(({ code }) => findNodeState(code))
				.filter((state): state is TreeNodeState => Boolean(state));

			for (const nodeState of nodeStates) {
				detachNode(nodeState.node.code);
			}

			if (parentCode) {
				const parentState = findNodeState(parentCode);
				if (!parentState) {
					continue;
				}
				parentState.children = nodeStates;
				refreshSiblingOrdinals(parentState.children);
			} else {
				roots = nodeStates;
				refreshSiblingOrdinals(roots);
			}
		}

		pendingReorders = new Map();
		baselinePositions = new Map();
		reorderError = null;
		dragSessionActive = false;
		activeDragSnapshot = null;
		refreshPendingSets();
		refreshTree();
	};

	const applyPendingReorders = async () => {
		if (reorderSaving || !baselinePositions.size) {
			return;
		}

		const updates = new Map<string, { parentCode: string | null; ordinal: number }>();
		for (const [code, baseline] of baselinePositions.entries()) {
			const nodeState = findNodeState(code);
			if (!nodeState) {
				continue;
			}
			const currentParent = findParentState(code);
			const currentParentCode = currentParent ? currentParent.node.code : null;
			const currentOrdinal = nodeState.node.ordinal;

			if (currentParentCode === baseline.parentCode && currentOrdinal === baseline.ordinal) {
				continue;
			}

			updates.set(code, {
				parentCode: currentParentCode,
				ordinal: currentOrdinal
			});
		}

		if (!updates.size) {
			pendingReorders = new Map();
			baselinePositions = new Map();
			pendingParentCodes = new Set();
			pendingNodeCodes = new Set();
			reorderError = null;
			refreshPendingSets();
			refreshTree();
			return;
		}

		reorderSaving = true;
		reorderError = null;

		const affectedNodes: TreeNodeState[] = [];
		for (const code of updates.keys()) {
			const nodeState = findNodeState(code);
			if (!nodeState) {
				continue;
			}
			nodeState.admin.reorder.busy = true;
			nodeState.admin.reorder.error = null;
			affectedNodes.push(nodeState);
		}
		refreshTree();

		try {
			for (const [code, payload] of updates.entries()) {
				await updateCurriculumNode(code, {
					parentCode: payload.parentCode ?? null,
					ordinal: payload.ordinal
				});
			}

			for (const nodeState of affectedNodes) {
				nodeState.admin.reorder = createReorderState();
			}

			pendingReorders = new Map();
			baselinePositions = new Map();
			pendingParentCodes = new Set();
			pendingNodeCodes = new Set();
			reorderError = null;
			refreshPendingSets();
			refreshTree();
			return;
		} catch (error) {
			const message = translateApiError(error, 'Nepavyko išsaugoti pakeitimų.');
			reorderError = message;
			for (const nodeState of affectedNodes) {
				nodeState.admin.reorder.busy = false;
				nodeState.admin.reorder.error = message;
			}
			return;
		} finally {
			reorderSaving = false;
			dragSessionActive = false;
			activeDragSnapshot = null;
			refreshTree();
		}
	};

	const submitEditForm = async (state: TreeNodeState) => {
		const form = state.admin.edit;
		const title = form.title.trim();
		const summaryValue = form.summary.trim();

		if (!title) {
			form.error = 'Įrašykite pavadinimą.';
			refreshTree();
			return;
		}

		form.busy = true;
		form.error = null;
		refreshTree();

		try {
			const updated = await updateCurriculumNode(state.node.code, {
				title,
				summary: summaryValue ? summaryValue : null
			});

			state.node.title = updated.title;
			state.node.summary = updated.summary;
			state.admin.edit = {
				...createEditState()
			};
		} catch (error) {
			form.error = translateApiError(error, 'Nepavyko atnaujinti poskyrio.');
		} finally {
			form.busy = false;
			refreshTree();
		}
	};

	const openDeleteConfirmation = (state: TreeNodeState) => {
		if (!state.expanded) {
			state.expanded = true;
		}
		state.admin.remove.confirming = true;
		state.admin.remove.error = null;
		refreshTree();
	};

	const cancelDeleteConfirmation = (state: TreeNodeState) => {
		state.admin.remove = {
			...createDeleteState()
		};
		refreshTree();
	};

	const confirmDeleteNode = async (state: TreeNodeState, parent: TreeNodeState | null) => {
		const removal = state.admin.remove;
		removal.busy = true;
		removal.error = null;
		refreshTree();

		try {
			await deleteCurriculumNode(state.node.code);

			const siblings = findSiblingCollection(parent);
			const updatedSiblings = siblings.filter((sibling) => sibling.node.code !== state.node.code);
			refreshSiblingOrdinals(updatedSiblings);
			if (parent) {
				parent.children = updatedSiblings;
			} else {
				roots = updatedSiblings;
			}
			state.admin.remove = {
				...createDeleteState()
			};
		} catch (error) {
			removal.error = translateApiError(error, 'Nepavyko pašalinti poskyrio.');
		} finally {
			removal.busy = false;
			refreshTree();
		}
	};

	const moveNode = async (
		state: TreeNodeState,
		parent: TreeNodeState | null,
		direction: 'up' | 'down'
	) => {
		if (state.admin.reorder.busy) {
			return;
		}

		const siblings = findSiblingCollection(parent);
		const currentIndex = siblings.findIndex((sibling) => sibling.node.code === state.node.code);
		if (currentIndex === -1) {
			return;
		}

		const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
		if (targetIndex < 0 || targetIndex >= siblings.length) {
			return;
		}

		state.admin.reorder.busy = true;
		state.admin.reorder.error = null;
		refreshTree();

		try {
			await updateCurriculumNode(state.node.code, {
				ordinal: targetIndex + 1
			});

			const updatedSiblings = [...siblings];
			const [moved] = updatedSiblings.splice(currentIndex, 1);
			updatedSiblings.splice(targetIndex, 0, moved);
			refreshSiblingOrdinals(updatedSiblings);

			if (parent) {
				parent.children = updatedSiblings;
			} else {
				roots = updatedSiblings;
			}
		} catch (error) {
			state.admin.reorder.error = translateApiError(error, 'Nepavyko perkelti poskyrio.');
		} finally {
			state.admin.reorder.busy = false;
			refreshTree();
		}
	};

	const ensureChildren = async (state: TreeNodeState, { force = false } = {}) => {
		if (state.loading) {
			return;
		}

		if (state.loaded && !force) {
			return;
		}

		state.loading = true;
		state.error = null;
		refreshTree();

		try {
			const [children, items] = await Promise.all([
				fetchChildNodes(state.node.code),
				fetchNodeItems(state.node.code)
			]);

			state.children = children.map(createState);
			state.items = items;
			state.loaded = true;
		} catch (err) {
			state.error = err instanceof Error ? err.message : 'Nepavyko įkelti duomenų.';
		} finally {
			state.loading = false;
			refreshTree();
		}
	};

	export const toggleNode = async (state: TreeNodeState) => {
		if (state.expanded) {
			state.expanded = false;
			refreshTree();
			return;
		}

		state.expanded = true;
		refreshTree();
		await ensureChildren(state);
	};

	export const retryNode = async (state: TreeNodeState) => {
		if (!state.expanded) {
				state.expanded = true;
		}
			refreshTree();
		await ensureChildren(state, { force: true });
	};

	const submitCreateChild = async (state: TreeNodeState) => {
		const form = state.admin.createChild;
		const rawCode = form.code.trim();
		const title = form.title.trim();
		const summaryValue = form.summary.trim();

		if (!title) {
			form.error = 'Įrašykite pavadinimą.';
			refreshTree();
			return;
		}

		form.busy = true;
		form.error = null;
		refreshTree();

		try {
			await createCurriculumNode({
				code: rawCode ? rawCode : undefined,
				title,
				summary: summaryValue ? summaryValue : null,
				parentCode: state.node.code
			});

			await ensureChildren(state, { force: true });
			resetCreateChildForm(state, { open: false });
			if (activeCreateNodeCode === state.node.code) {
				activeCreateNodeCode = null;
			}
		} catch (err) {
			form.error = translateApiError(err, 'Nepavyko sukurti poskyrio.');
		} finally {
			form.busy = false;
			refreshTree();
		}
	};

	const submitCreateItem = async (state: TreeNodeState) => {
		const form = state.admin.createItem;
		const term = form.term.trim();
		const description = form.description.trim();
		const termEn = form.termEn.trim();
		const sourceRef = form.sourceRef.trim();

		if (!term) {
			form.error = 'Įrašykite terminą.';
			refreshTree();
			return;
		}

		form.busy = true;
		form.error = null;
		refreshTree();

		try {
			await createCurriculumItem({
				nodeCode: state.node.code,
				label: term,
				termLt: term,
				termEn: termEn ? termEn : undefined,
				descriptionLt: description ? description : undefined,
				sourceRef: sourceRef ? sourceRef : undefined,
				isRequired: form.isRequired
			});

			await ensureChildren(state, { force: true });
			resetCreateItemForm(state, { open: false });
			if (activeCreateItemNodeCode === state.node.code) {
				activeCreateItemNodeCode = null;
			}
		} catch (err) {
			form.error = translateApiError(err, 'Nepavyko sukurti termino.');
		} finally {
			form.busy = false;
			refreshTree();
		}
	};
</script>

<section class="curriculum-tree">
	<header class="curriculum-tree__header">
		<h1 class="curriculum-tree__title">{section.title}</h1>
		{#if section.summary}
			<p class="curriculum-tree__summary">{section.summary}</p>
		{/if}
		{#if adminEnabled}
			<div class="curriculum-tree__toolbar">
				<label class="curriculum-tree__toggle">
					<input type="checkbox" bind:checked={dragAndDropEnabled} />
					<span>Perkelti vilkdami</span>
				</label>
			</div>
		{/if}
	</header>

	{#if pendingChangeCount}
		<div class="curriculum-tree__pending-container">
			<div
				class="curriculum-tree__pending-banner"
				role="status"
				aria-live="polite"
				data-saving={reorderSaving}
			>
				<span class="curriculum-tree__pending-text">
					Yra neišsaugotų perkėlimų ({pendingChangeCount}).
				</span>
				<div class="curriculum-tree__pending-actions">
					<button
						type="button"
						class="curriculum-tree__pending-button curriculum-tree__pending-button--ghost"
						on:click={cancelPendingReorders}
						disabled={reorderSaving}
					>
						Atšaukti
					</button>
					<button
						type="button"
						class="curriculum-tree__pending-button curriculum-tree__pending-button--primary"
						on:click={applyPendingReorders}
						disabled={reorderSaving}
					>
						Patvirtinti
					</button>
				</div>
			</div>
			{#if reorderError}
				<p class="curriculum-tree__pending-error" role="alert">{reorderError}</p>
			{/if}
		</div>
	{/if}

	{#if !roots.length}
		<p class="curriculum-tree__empty">Šioje skiltyje dar nėra įkelto turinio.</p>
	{:else}
		<CurriculumTreeBranch
			nodes={roots}
			parentState={null}
			onToggle={toggleNode}
			onRetry={retryNode}
			adminEnabled={adminEnabled}
			onOpenCreateChild={openCreateChildForm}
			onCancelCreateChild={cancelCreateChildForm}
			onCreateChildFieldChange={updateCreateChildField}
			onSubmitCreateChild={submitCreateChild}
			onOpenCreateItem={openCreateItemForm}
			onCancelCreateItem={cancelCreateItemForm}
			onCreateItemFieldChange={updateCreateItemField}
			onSubmitCreateItem={submitCreateItem}
			onOpenEdit={openEditForm}
			onCancelEdit={cancelEditForm}
			onEditFieldChange={updateEditField}
			onSubmitEdit={submitEditForm}
			onRequestDelete={openDeleteConfirmation}
			onCancelDelete={cancelDeleteConfirmation}
			onConfirmDelete={confirmDeleteNode}
			onMoveNode={moveNode}
			dragAndDropEnabled={dragAndDropEnabled}
			onNodeDragConsider={handleNodeDragConsider}
			onNodeDragFinalize={handleNodeDragFinalize}
			pendingParentCodes={pendingParentCodes}
			pendingNodeCodes={pendingNodeCodes}
			dragSessionActive={dragSessionActive}
			allowCreateChild={allowCreateChild}
			pendingActive={Boolean(pendingChangeCount)}
		/>
	{/if}
</section>

<style>
	.curriculum-tree {
		display: grid;
		gap: clamp(1.5rem, 3vw, 2rem);
	}

	.curriculum-tree__header {
		display: grid;
		gap: 0.6rem;
	}

	.curriculum-tree__title {
		margin: 0;
		font-size: clamp(1.4rem, 3vw, 1.9rem);
	}

	.curriculum-tree__summary {
		margin: 0;
		color: var(--color-text-muted);
		line-height: 1.6;
	}

	.curriculum-tree__toolbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.curriculum-tree__toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.85rem;
		color: var(--color-text-muted);
		user-select: none;
	}

	.curriculum-tree__toggle input {
		accent-color: var(--color-accent);
	}

		.curriculum-tree__pending-container {
			position: fixed;
			left: 50%;
			bottom: clamp(0.75rem, 4vw, 1.75rem);
			transform: translateX(-50%);
			width: min(calc(100% - 2rem), 40rem);
			z-index: 20;
			pointer-events: none;
			display: grid;
			gap: 0.45rem;
		}

		.curriculum-tree__pending-banner {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.75rem;
			padding: 0.85rem 1.1rem;
			border-radius: 999px;
			border: 1px solid rgba(37, 99, 235, 0.35);
			background: rgba(37, 99, 235, 0.95);
			box-shadow: 0 18px 45px rgba(37, 99, 235, 0.18);
			pointer-events: auto;
		}

		.curriculum-tree__pending-banner[data-saving='true'] {
			opacity: 0.8;
		}

	.curriculum-tree__pending-text {
		font-weight: 600;
			color: var(--color-button-text-on-accent, #fff);
	}

	.curriculum-tree__pending-actions {
		display: flex;
		gap: 0.5rem;
		margin-left: auto;
	}

	.curriculum-tree__pending-button {
		border-radius: 999px;
		font-size: 0.85rem;
		font-weight: 600;
		padding: 0.35rem 0.9rem;
		border: 1px solid transparent;
		cursor: pointer;
		transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
	}

	.curriculum-tree__pending-button--primary {
		background: #fff;
		border-color: transparent;
		color: var(--curriculum-drop-outline, #1d4ed8);
	}

	.curriculum-tree__pending-button--primary:hover,
	.curriculum-tree__pending-button--primary:focus-visible {
		background: rgba(255, 255, 255, 0.92);
		border-color: transparent;
	}

	.curriculum-tree__pending-button--ghost {
		background: transparent;
		border-color: rgba(255, 255, 255, 0.6);
		color: var(--color-button-text-on-accent, #fff);
	}

	.curriculum-tree__pending-button--ghost:hover,
	.curriculum-tree__pending-button--ghost:focus-visible {
		border-color: rgba(255, 255, 255, 0.85);
		background: rgba(255, 255, 255, 0.15);
	}

	.curriculum-tree__pending-button[disabled] {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.curriculum-tree__pending-error {
		margin: 0;
		text-align: center;
		color: #fff;
		font-size: 0.8rem;
		background: rgba(220, 38, 38, 0.92);
		padding: 0.45rem 1.1rem;
		border-radius: 999px;
		box-shadow: 0 12px 30px rgba(220, 38, 38, 0.18);
		pointer-events: auto;
	}

	.curriculum-tree__empty {
		margin: 0;
		padding: 1.5rem;
		border-radius: 1rem;
		border: 1px dashed var(--color-border);
		color: var(--color-text-muted);
		background: var(--color-panel-soft);
	}
</style>
