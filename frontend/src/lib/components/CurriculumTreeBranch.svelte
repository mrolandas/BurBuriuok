<script lang="ts">
	import { resolve } from '$app/paths';
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
										{#if item.conceptSlug}
											<a
												class="tree-node__item-link"
												href={resolve(`/concepts/${encodeURIComponent(item.conceptSlug)}`)}
											>
												<span class="tree-node__item-ordinal">{item.ordinal}.</span>
												<span class="tree-node__item-label">{item.label}</span>
											</a>
										{:else}
											<span class="tree-node__item-text">
												<span class="tree-node__item-ordinal">{item.ordinal}.</span>
												<span>{item.label}</span>
											</span>
										{/if}
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
		border: 1px solid var(--color-border);
		border-radius: 0.9rem;
		background: var(--color-panel);
		padding: 0.75rem 1rem;
		display: grid;
		gap: 0.8rem;
	}

	.tree-node__header {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
	}

	.tree-node__toggle {
		background: transparent;
		border: 0;
		padding: 0;
		margin: 0;
		display: flex;
		align-items: flex-start;
		justify-content: flex-start;
		gap: 0.5rem;
		font-size: clamp(0.95rem, 2vw, 1.05rem);
		font-weight: 600;
		color: inherit;
		cursor: pointer;
		width: 100%;
		text-align: left;
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
		background: var(--color-badge-warning-bg);
		color: var(--color-badge-warning-text);
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		border: 1px solid var(--color-badge-warning-border);
		margin-left: auto;
	}

	.tree-node__panel {
		display: grid;
		gap: 0.75rem;
	}

	.tree-node__status {
		margin: 0;
		font-size: 0.85rem;
		color: var(--color-text-soft);
	}

	.tree-node__status--error {
		color: var(--color-status-error-text);
	}

	.tree-node__status--muted {
		color: var(--color-text-soft);
	}

	.tree-node__retry {
		justify-self: flex-start;
		border: 1px solid var(--color-status-error-border);
		background: var(--color-status-error-bg);
		color: var(--color-status-error-text);
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
		list-style: none;
	}

	.tree-node__item-link,
	.tree-node__item-text {
		display: flex;
		align-items: flex-start;
		justify-content: flex-start;
		gap: 0.5rem;
		font-size: 0.9rem;
		color: var(--color-text);
		text-align: left;
		width: 100%;
	}

	.tree-node__item-link {
		border: 1px solid var(--color-accent-border);
		background: var(--color-accent-faint);
		padding: 0.35rem 0.6rem;
		border-radius: 0.75rem;
		text-decoration: none;
		transition:
			border-color 0.2s ease,
			background 0.2s ease,
			transform 0.2s ease;
	}

	.tree-node__item-link:hover,
	.tree-node__item-link:focus-visible {
		border-color: var(--color-accent-border-strong);
		background: var(--color-accent-faint-strong);
		transform: translateY(-1px);
	}

	.tree-node__item-ordinal {
		font-variant-numeric: tabular-nums;
		color: var(--color-text-soft);
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
