<script lang="ts">
	import { resolve } from '$app/paths';
	import type { TreeNodeState } from './curriculumTreeTypes';

	export let nodes: TreeNodeState[] = [];
	export let level = 0;
	export let parentState: TreeNodeState | null = null;
	export let onToggle: (state: TreeNodeState) => Promise<void> | void;
	export let onRetry: (state: TreeNodeState) => Promise<void> | void;
	export let adminEnabled = false;
	export let onOpenCreateChild: (state: TreeNodeState) => Promise<void> | void;
	export let onCancelCreateChild: (state: TreeNodeState) => Promise<void> | void;
	export let onCreateChildFieldChange: (
		state: TreeNodeState,
		field: 'code' | 'title' | 'summary',
		value: string
	) => void;
	export let onSubmitCreateChild: (state: TreeNodeState) => Promise<void> | void;
	export let onOpenEdit: (state: TreeNodeState) => Promise<void> | void;
	export let onCancelEdit: (state: TreeNodeState) => Promise<void> | void;
	export let onEditFieldChange: (
		state: TreeNodeState,
		field: 'title' | 'summary',
		value: string
	) => void;
	export let onSubmitEdit: (state: TreeNodeState) => Promise<void> | void;
	export let onRequestDelete: (state: TreeNodeState) => Promise<void> | void;
	export let onCancelDelete: (state: TreeNodeState) => Promise<void> | void;
	export let onConfirmDelete: (state: TreeNodeState, parent: TreeNodeState | null) => Promise<void> | void;
	export let onMoveNode: (
		state: TreeNodeState,
		parent: TreeNodeState | null,
		direction: 'up' | 'down'
	) => Promise<void> | void;
</script>


<ul class="tree-branch" data-level={level}>
	{#each nodes as state, index (state.node.code)}
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

					{#if adminEnabled}
						<div class="tree-node__admin-toolbar">
							<button
								type="button"
								class="tree-node__admin-chip"
								on:click={() => onOpenEdit(state)}
								disabled={state.admin.edit.busy || state.admin.edit.open || state.admin.remove.busy}
							>
								Redaguoti
							</button>
							<button
								type="button"
								class="tree-node__admin-chip"
								on:click={() => onMoveNode(state, parentState, 'up')}
								disabled={index === 0 || state.admin.reorder.busy || state.admin.remove.busy}
								aria-label="Perkelti aukštyn"
							>
								↑
							</button>
							<button
								type="button"
								class="tree-node__admin-chip"
								on:click={() => onMoveNode(state, parentState, 'down')}
								disabled={index === nodes.length - 1 || state.admin.reorder.busy || state.admin.remove.busy}
								aria-label="Perkelti žemyn"
							>
								↓
							</button>
							<button
								type="button"
								class="tree-node__admin-chip"
								on:click={() => onOpenCreateChild(state)}
								disabled={state.admin.createChild.busy || state.admin.createChild.open || state.admin.remove.busy}
							>
								Pridėti poskyrį
							</button>
							<button
								type="button"
								class="tree-node__admin-chip tree-node__admin-chip--danger"
								on:click={() => onRequestDelete(state)}
								disabled={state.admin.remove.busy || state.admin.remove.confirming}
							>
								Šalinti
							</button>
						</div>
						{#if state.admin.reorder.error}
							<p class="tree-node__admin-status tree-node__admin-status--error">
								{state.admin.reorder.error}
							</p>
						{/if}
					{/if}

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
									<svelte:self
										nodes={state.children}
										level={level + 1}
										parentState={state}
										{onToggle}
										{onRetry}
										{adminEnabled}
										{onOpenCreateChild}
										{onCancelCreateChild}
										{onCreateChildFieldChange}
										{onSubmitCreateChild}
										{onOpenEdit}
										{onCancelEdit}
										{onEditFieldChange}
										{onSubmitEdit}
										{onRequestDelete}
										{onCancelDelete}
										{onConfirmDelete}
										{onMoveNode}
									/>
								{:else if !state.items.length}
									<p class="tree-node__status tree-node__status--muted">Šiame lygyje turinio nėra.</p>
								{/if}

								{#if adminEnabled && (state.admin.createChild.open || state.admin.edit.open || state.admin.remove.confirming)}
									<div class="tree-node__admin">
										{#if state.admin.createChild.open}
											<form
												class="tree-node__admin-form"
												on:submit|preventDefault={() => onSubmitCreateChild(state)}
											>
												<div class="tree-node__admin-grid">
													<label class="tree-node__admin-field">
														<span>Pavadinimas</span>
														<input
															type="text"
															value={state.admin.createChild.title}
															on:input={(event) =>
																onCreateChildFieldChange(
																	state,
																	'title',
																	event.currentTarget.value
																)}
															placeholder="Naujo poskyrio pavadinimas"
															disabled={state.admin.createChild.busy}
														/>
													</label>
													<label class="tree-node__admin-field tree-node__admin-field--full">
														<span>Santrauka (nebūtina)</span>
														<textarea
															rows={3}
															value={state.admin.createChild.summary}
															on:input={(event) =>
																onCreateChildFieldChange(
																	state,
																	'summary',
																	event.currentTarget.value
																)}
															placeholder="Trumpas aprašas apie poskyrio turinį"
															disabled={state.admin.createChild.busy}
														></textarea>
													</label>
													<label class="tree-node__admin-field">
														<span>Kodas (nebūtinas)</span>
														<input
															type="text"
															value={state.admin.createChild.code}
															on:input={(event) =>
																onCreateChildFieldChange(
																	state,
																	'code',
																	event.currentTarget.value
																)}
															placeholder="Palikite tuščią, jei nurodysime automatiškai"
															autocomplete="off"
															disabled={state.admin.createChild.busy}
														/>
													</label>
												</div>

												{#if state.admin.createChild.error}
													<p class="tree-node__admin-status tree-node__admin-status--error">
														{state.admin.createChild.error}
													</p>
												{/if}

												<div class="tree-node__admin-actions">
													<button
														type="button"
														class="tree-node__admin-button tree-node__admin-button--ghost"
														on:click={() => onCancelCreateChild(state)}
														disabled={state.admin.createChild.busy}
													>
														Atšaukti
													</button>
													<button
														type="submit"
														class="tree-node__admin-button tree-node__admin-button--primary"
														disabled={state.admin.createChild.busy}
													>
														{state.admin.createChild.busy ? 'Saugoma…' : 'Išsaugoti'}
													</button>
												</div>
											</form>
										{/if}

										{#if state.admin.edit.open}
											<form
												class="tree-node__admin-form"
												on:submit|preventDefault={() => onSubmitEdit(state)}
											>
												<div class="tree-node__admin-grid">
													<label class="tree-node__admin-field tree-node__admin-field--full">
														<span>Pavadinimas</span>
														<input
															type="text"
															value={state.admin.edit.title}
															on:input={(event) =>
																onEditFieldChange(state, 'title', event.currentTarget.value)
															}
															disabled={state.admin.edit.busy}
														/>
													</label>
													<label class="tree-node__admin-field tree-node__admin-field--full">
														<span>Santrauka (nebūtina)</span>
														<textarea
															rows={3}
															value={state.admin.edit.summary}
															on:input={(event) =>
																onEditFieldChange(state, 'summary', event.currentTarget.value)
															}
															disabled={state.admin.edit.busy}
														></textarea>
													</label>
												</div>

												{#if state.admin.edit.error}
													<p class="tree-node__admin-status tree-node__admin-status--error">
														{state.admin.edit.error}
													</p>
												{/if}

												<div class="tree-node__admin-actions">
													<button
														type="button"
														class="tree-node__admin-button tree-node__admin-button--ghost"
														on:click={() => onCancelEdit(state)}
														disabled={state.admin.edit.busy}
													>
														Atšaukti
													</button>
													<button
														type="submit"
														class="tree-node__admin-button tree-node__admin-button--primary"
														disabled={state.admin.edit.busy}
													>
														{state.admin.edit.busy ? 'Saugoma…' : 'Išsaugoti'}
													</button>
												</div>
											</form>
										{/if}

										{#if state.admin.remove.confirming}
											<div class="tree-node__admin-delete">
												<p class="tree-node__admin-status">Ar tikrai norite pašalinti šį poskyrį? Visi vidiniai poskyriai bus ištrinti.</p>
												{#if state.admin.remove.error}
													<p class="tree-node__admin-status tree-node__admin-status--error">
														{state.admin.remove.error}
													</p>
												{/if}
												<div class="tree-node__admin-actions">
													<button
														type="button"
														class="tree-node__admin-button tree-node__admin-button--ghost"
														on:click={() => onCancelDelete(state)}
														disabled={state.admin.remove.busy}
													>
														Atšaukti
													</button>
													<button
														type="button"
														class="tree-node__admin-button tree-node__admin-button--primary tree-node__admin-button--danger"
														on:click={() => onConfirmDelete(state, parentState)}
														disabled={state.admin.remove.busy}
													>
														{state.admin.remove.busy ? 'Šalinama…' : 'Patvirtinti šalinimą'}
													</button>
												</div>
											</div>
										{/if}
									</div>
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

	.tree-node__admin {
		margin-top: 0.75rem;
		border-top: 1px dashed var(--color-border-soft);
		padding-top: 0.75rem;
		display: grid;
		gap: 0.75rem;
	}

	.tree-node__admin-toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: -0.25rem;
	}

	.tree-node__admin-chip {
		border: 1px solid var(--color-border);
		background: var(--color-panel-soft);
		color: var(--color-text);
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.25rem 0.75rem;
		border-radius: 999px;
		cursor: pointer;
		transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
	}

	.tree-node__admin-chip:hover,
	.tree-node__admin-chip:focus-visible {
		background: var(--color-panel);
		border-color: var(--color-border-strong, var(--color-border));
		transform: translateY(-1px);
	}

	.tree-node__admin-chip[disabled] {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}

	.tree-node__admin-chip--danger {
		border-color: var(--color-status-error-border);
		background: var(--color-status-error-bg);
		color: var(--color-status-error-text);
	}

	.tree-node__admin-chip--danger:hover,
	.tree-node__admin-chip--danger:focus-visible {
		border-color: var(--color-status-error-border-strong, var(--color-status-error-border));
		background: var(--color-status-error-bg-strong, var(--color-status-error-bg));
	}

	.tree-node__admin-delete {
		border: 1px solid var(--color-status-error-border);
		background: var(--color-status-error-bg);
		border-radius: 0.75rem;
		padding: 0.75rem;
		display: grid;
		gap: 0.6rem;
	}

	.tree-node__admin-form {
		display: grid;
		gap: 0.75rem;
	}

	.tree-node__admin-grid {
		display: grid;
		gap: 0.6rem;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
	}

	.tree-node__admin-field {
		display: grid;
		gap: 0.35rem;
		font-size: 0.8rem;
		color: var(--color-text);
	}

	.tree-node__admin-field--full {
		grid-column: 1 / -1;
	}

	.tree-node__admin-field input,
	.tree-node__admin-field textarea {
		width: 100%;
		border-radius: 0.6rem;
		border: 1px solid var(--color-border-soft);
		background: var(--color-panel-soft);
		padding: 0.45rem 0.6rem;
		font: inherit;
		resize: vertical;
	}

	.tree-node__admin-field input:focus-visible,
	.tree-node__admin-field textarea:focus-visible {
		outline: 2px solid var(--color-accent-border);
		outline-offset: 2px;
	}

	.tree-node__admin-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.tree-node__admin-button {
		border-radius: 999px;
		padding: 0.35rem 0.9rem;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		border: 1px solid transparent;
		transition: background 0.2s ease, border-color 0.2s ease;
	}

	.tree-node__admin-button[disabled] {
		opacity: 0.65;
		cursor: not-allowed;
	}

	.tree-node__admin-button--primary {
		background: var(--color-accent);
		border-color: var(--color-accent-border-strong);
		color: var(--color-button-text-on-accent);
	}

	.tree-node__admin-button--primary:hover,
	.tree-node__admin-button--primary:focus-visible {
		background: var(--color-accent-strong);
		border-color: var(--color-accent-border-stronger);
	}

	.tree-node__admin-button--ghost {
		background: transparent;
		border-color: var(--color-border);
		color: var(--color-text);
	}

	.tree-node__admin-button--ghost:hover,
	.tree-node__admin-button--ghost:focus-visible {
		border-color: var(--color-text-muted);
	}

	.tree-node__admin-status {
		margin: 0;
		font-size: 0.75rem;
	}

	.tree-node__admin-status--error {
		color: var(--color-status-error-text);
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
