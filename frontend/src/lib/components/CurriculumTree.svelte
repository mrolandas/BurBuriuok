<script lang="ts">
	import CurriculumTreeBranch from './CurriculumTreeBranch.svelte';
	import type { CurriculumNode } from '$lib/api/curriculum';
	import { fetchChildNodes, fetchNodeItems } from '$lib/api/curriculum';
	import {
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
		TreeNodeEditState,
		TreeNodeDeleteState,
		TreeNodeReorderState
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

	const createCreateChildState = (): TreeNodeCreateChildState => ({
		open: false,
		code: '',
		title: '',
		summary: '',
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
		edit: createEditState(),
		remove: createDeleteState(),
		reorder: createReorderState()
	});

	const createState = (node: CurriculumNode): TreeNodeState => ({
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

	const refreshTree = () => {
		roots = [...roots];
	};

	onMount(() => {
		adminMode.initialize();
		adminModeUnsubscribe = adminMode.subscribe((value) => {
			adminEnabled = value;
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

	const resetCreateChildForm = (state: TreeNodeState) => {
		state.admin.createChild = {
			...createCreateChildState(),
			open: state.admin.createChild.open
		};
		refreshTree();
	};

	const openCreateChildForm = (state: TreeNodeState) => {
		state.expanded = true;
		if (!state.loaded) {
			void ensureChildren(state);
		}

		resetCreateChildForm(state);
		const form = state.admin.createChild;
		form.open = true;
		form.error = null;
		form.busy = false;
		refreshTree();
	};

	const cancelCreateChildForm = (state: TreeNodeState) => {
		resetCreateChildForm(state);
		state.admin.createChild.open = false;
		refreshTree();
	};

	type CreateChildField = 'code' | 'title' | 'summary';
	type EditField = 'title' | 'summary';

	const updateCreateChildField = (state: TreeNodeState, field: CreateChildField, value: string) => {
		const form = state.admin.createChild;
		form[field] = value;
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
		const form = state.admin.edit;
		form.title = state.node.title;
		form.summary = state.node.summary ?? '';
		form.error = null;
		form.busy = false;
		form.open = true;
		refreshTree();
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
			resetCreateChildForm(state);
			form.open = false;
		} catch (err) {
			form.error = translateApiError(err, 'Nepavyko sukurti poskyrio.');
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
	</header>

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
			onOpenEdit={openEditForm}
			onCancelEdit={cancelEditForm}
			onEditFieldChange={updateEditField}
			onSubmitEdit={submitEditForm}
			onRequestDelete={openDeleteConfirmation}
			onCancelDelete={cancelDeleteConfirmation}
			onConfirmDelete={confirmDeleteNode}
			onMoveNode={moveNode}
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

	.curriculum-tree__empty {
		margin: 0;
		padding: 1.5rem;
		border-radius: 1rem;
		border: 1px dashed var(--color-border);
		color: var(--color-text-muted);
		background: var(--color-panel-soft);
	}
</style>
