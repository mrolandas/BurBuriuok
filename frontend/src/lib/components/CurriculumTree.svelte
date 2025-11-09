<script lang="ts">
	import CurriculumTreeBranch from './CurriculumTreeBranch.svelte';
	import type { CurriculumNode } from '$lib/api/curriculum';
	import { fetchChildNodes, fetchNodeItems } from '$lib/api/curriculum';
	import { createCurriculumNode } from '$lib/api/admin/curriculum';
	import { adminMode } from '$lib/stores/adminMode';
	import { onDestroy, onMount } from 'svelte';
	import type { TreeNodeState, TreeNodeAdminState } from './curriculumTreeTypes';

	type SectionSummary = {
		code: string;
		title: string;
		summary: string | null;
	};

	export let section: SectionSummary;
	export let initialNodes: CurriculumNode[] = [];

	let adminEnabled = false;
	let adminModeUnsubscribe: (() => void) | null = null;

	const createAdminState = (): TreeNodeAdminState => ({
		createChild: {
			open: false,
			code: '',
			title: '',
			summary: '',
			error: null,
			busy: false
		}
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
		const form = state.admin.createChild;
		form.code = '';
		form.title = '';
		form.summary = '';
		form.error = null;
		form.busy = false;
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

	const updateCreateChildField = (state: TreeNodeState, field: CreateChildField, value: string) => {
		const form = state.admin.createChild;
		form[field] = value;
		if (form.error) {
			form.error = null;
		}
		refreshTree();
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
				code: rawCode ? rawCode : null,
				title,
				summary: summaryValue ? summaryValue : null,
				parentCode: state.node.code
			});

			await ensureChildren(state, { force: true });
			resetCreateChildForm(state);
			form.open = false;
		} catch (err) {
			form.error = err instanceof Error ? err.message : 'Nepavyko sukurti poskyrio.';
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
			onToggle={toggleNode}
			onRetry={retryNode}
			adminEnabled={adminEnabled}
			onOpenCreateChild={openCreateChildForm}
			onCancelCreateChild={cancelCreateChildForm}
			onCreateChildFieldChange={updateCreateChildField}
			onSubmitCreateChild={submitCreateChild}
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
