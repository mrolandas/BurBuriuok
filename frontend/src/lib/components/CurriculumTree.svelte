<script lang="ts">
	import CurriculumTreeBranch from './CurriculumTreeBranch.svelte';
	import type { CurriculumNode } from '$lib/api/curriculum';
	import { fetchChildNodes, fetchNodeItems } from '$lib/api/curriculum';
	import type { TreeNodeState } from './curriculumTreeTypes';

	type SectionSummary = {
		code: string;
		title: string;
		summary: string | null;
	};

	export let section: SectionSummary;
	export let initialNodes: CurriculumNode[] = [];

	const createState = (node: CurriculumNode): TreeNodeState => ({
		node,
		expanded: false,
		loading: false,
		loaded: false,
		hasTrackedOpen: false,
		children: [],
		items: [],
		error: null
	});

	let roots: TreeNodeState[] = initialNodes.map(createState);
	let renderKey = 0;

	$: if (initialNodes) {
		roots = initialNodes.map(createState);
		bump();
	}

	const bump = () => {
		renderKey += 1;
	};

	const trackNodeOpen = (state: TreeNodeState) => {
		if (state.hasTrackedOpen) {
			return;
		}
		state.hasTrackedOpen = true;
		console.info('[analytics] curriculum_tree_node_open', {
			nodeCode: state.node.code,
			level: state.node.level,
			prerequisiteCount: state.node.prerequisiteCount
		});
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
		bump();

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
			bump();
		}
	};

	export const toggleNode = async (state: TreeNodeState) => {
		if (state.expanded) {
			state.expanded = false;
			bump();
			return;
		}

		state.expanded = true;
		trackNodeOpen(state);
		bump();
		await ensureChildren(state);
	};

	export const retryNode = async (state: TreeNodeState) => {
		if (!state.expanded) {
			state.expanded = true;
		}
		bump();
		await ensureChildren(state, { force: true });
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
		{#key renderKey}
			<CurriculumTreeBranch nodes={roots} onToggle={toggleNode} onRetry={retryNode} />
		{/key}
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
		border: 1px dashed rgba(148, 163, 184, 0.4);
		color: var(--color-text-muted);
		background: rgba(15, 23, 42, 0.3);
	}
</style>
