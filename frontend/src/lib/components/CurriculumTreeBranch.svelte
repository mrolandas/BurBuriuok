<script lang="ts">
	import type { TreeNodeState } from './curriculumTreeTypes';

	export let nodes: TreeNodeState[] = [];
	export let level = 0;
	export let onToggle: (state: TreeNodeState) => Promise<void> | void;
	export let onRetry: (state: TreeNodeState) => Promise<void> | void;
</script>

<ul class="tree-branch" data-level={level}>
	{#each nodes as state (state.node.code)}
		<li class="tree-node">
			<div class="tree-node__header">
				<button
					type="button"
					class="tree-node__toggle"
					aria-expanded={state.expanded}
					on:click={() => onToggle(state)}
				>
					<span class="tree-node__chevron" aria-hidden="true">
						{#if state.loading}
							•
						{:else if state.expanded}
							▾
						{:else}
							▸
						{/if}
					</span>
					<span class="tree-node__title">{state.node.title}</span>
				</button>
				{#if state.node.prerequisiteCount}
					<span
						class="tree-node__badge"
						aria-label={`Turi ${state.node.prerequisiteCount} prielaidas`}
					>
						{state.node.prerequisiteCount} prielaidos
					</span>
				{/if}
			</div>

			{#if state.expanded}
				<div class="tree-node__panel">
					{#if state.loading}
						<p class="tree-node__status">Kraunama...</p>
					{:else if state.error}
						<p class="tree-node__status tree-node__status--error">{state.error}</p>
						<button type="button" class="tree-node__retry" on:click={() => onRetry(state)}>
							Bandyti dar kartą
						</button>
					{:else}
						{#if state.items.length}
							<ul class="tree-node__items">
								{#each state.items as item (item.ordinal)}
									<li>
										<span class="tree-node__item-ordinal">{item.ordinal}.</span>
										<span>{item.label}</span>
									</li>
								{/each}
							</ul>
						{/if}

						{#if state.children.length}
							<svelte:self nodes={state.children} level={level + 1} {onToggle} {onRetry} />
						{:else if !state.items.length}
							<p class="tree-node__status tree-node__status--muted">Šiame lygyje turinio nėra.</p>
						{/if}
					{/if}
				</div>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.tree-branch {
		margin: 0;
		padding-left: calc(1rem + (var(--level-indent, 1rem) * max(0, var(--branch-level, 0))));
		list-style: none;
		display: grid;
		gap: 0.75rem;
	}

	.tree-branch[data-level='0'] {
		--branch-level: 0;
		padding-left: 0;
	}

	.tree-branch[data-level='1'] {
		--branch-level: 1;
	}

	.tree-branch[data-level='2'] {
		--branch-level: 2;
	}

	.tree-node {
		border: 1px solid rgba(148, 163, 184, 0.35);
		border-radius: 0.9rem;
		background: rgba(15, 23, 42, 0.4);
		padding: 0.75rem 1rem;
		display: grid;
		gap: 0.8rem;
	}

	.tree-node__header {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		justify-content: space-between;
	}

	.tree-node__toggle {
		background: transparent;
		border: 0;
		padding: 0;
		margin: 0;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: clamp(0.95rem, 2vw, 1.05rem);
		font-weight: 600;
		color: inherit;
		cursor: pointer;
	}

	.tree-node__toggle:hover,
	.tree-node__toggle:focus-visible {
		text-decoration: underline;
	}

	.tree-node__chevron {
		font-size: 0.9rem;
		width: 1.25rem;
		display: inline-flex;
		justify-content: center;
	}

	.tree-node__badge {
		font-size: 0.7rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		background: rgba(250, 204, 21, 0.18);
		color: #facc15;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		border: 1px solid rgba(250, 204, 21, 0.35);
	}

	.tree-node__panel {
		display: grid;
		gap: 0.75rem;
	}

	.tree-node__status {
		margin: 0;
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	.tree-node__status--error {
		color: #fca5a5;
	}

	.tree-node__status--muted {
		color: rgba(148, 163, 184, 0.85);
	}

	.tree-node__retry {
		justify-self: flex-start;
		border: 1px solid rgba(248, 113, 113, 0.45);
		background: rgba(248, 113, 113, 0.1);
		color: #fecaca;
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 600;
		padding: 0.35rem 0.9rem;
		cursor: pointer;
	}

	.tree-node__items {
		margin: 0;
		padding-left: 1.25rem;
		list-style: none;
		display: grid;
		gap: 0.45rem;
	}

	.tree-node__items li {
		display: inline-flex;
		gap: 0.4rem;
		font-size: 0.9rem;
		color: rgba(226, 232, 240, 0.95);
	}

	.tree-node__item-ordinal {
		font-variant-numeric: tabular-nums;
		color: rgba(148, 163, 184, 0.9);
	}

	@media (max-width: 640px) {
		.tree-node {
			padding: 0.7rem 0.8rem;
		}

		.tree-node__toggle {
			align-items: flex-start;
		}
	}
</style>
