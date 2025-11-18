<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { resolve } from '$app/paths';
	import type { AdminConceptResource, AdminConceptStatus } from '$lib/api/admin/concepts';

	type Events = {
		edit: AdminConceptResource;
		requestDelete: AdminConceptResource;
		confirmDelete: void;
		cancelDelete: void;
		clearFilters: void;
	};

	export let filteredConcepts: AdminConceptResource[] = [];
	export let isFiltered = false;
	export let deleteConfirmSlug: string | null = null;
	export let deletingSlug: string | null = null;
	export let deleteError: string | null = null;
	export let statusLabels: Record<AdminConceptStatus, string> = {
		draft: 'Juodraštis',
		published: 'Publikuota'
	};
	export let formatTimestamp: (value: string | null | undefined) => string = () => '–';

	const dispatch = createEventDispatcher<Events>();

	function handleEdit(concept: AdminConceptResource): void {
		dispatch('edit', concept);
	}

	function requestDelete(concept: AdminConceptResource): void {
		dispatch('requestDelete', concept);
	}

	function confirmDelete(): void {
		dispatch('confirmDelete');
	}

	function cancelDelete(): void {
		dispatch('cancelDelete');
	}

	function clearFilters(): void {
		dispatch('clearFilters');
	}
</script>

{#if !filteredConcepts.length}
	<div class="concepts-empty">
		<p class="muted">
			{#if isFiltered}
				Pagal pasirinktus filtrus rezultatų nėra.
			{:else}
				Dar nėra sukurtų sąvokų.
			{/if}
		</p>
		{#if isFiltered}
			<button type="button" on:click={clearFilters}>Išvalyti filtrus</button>
		{/if}
	</div>
{:else}
	<div class="table-wrapper">
		<table class="concept-table">
			<thead>
				<tr>
					<th scope="col">Sąvoka</th>
					<th scope="col">Skyrius</th>
					<th scope="col">Būsena</th>
					<th scope="col">Atnaujinta</th>
					<th scope="col">Veiksmai</th>
				</tr>
			</thead>
			<tbody>
				{#each filteredConcepts as concept (concept.id)}
					<tr>
						<td>
							<div class="concept-name">
								<a
									href={`${resolve('/concepts/[slug]', { slug: concept.slug })}?admin=1`}
									target="_blank"
									rel="noreferrer"
									class="concept-name__primary"
								>
									{concept.termLt}
								</a>
								{#if concept.termEn}
									<span class="concept-name__secondary">{concept.termEn}</span>
								{/if}
							</div>
						</td>
						<td>
							<div class="concept-section">
								<span>{concept.subsectionCode ?? concept.sectionCode}</span>
								{#if concept.subsectionTitle ?? concept.sectionTitle}
									<span class="concept-section__title">
										{concept.subsectionTitle ?? concept.sectionTitle}
									</span>
								{/if}
							</div>
						</td>
						<td>
							<span
								class="status-badge"
								class:status-badge--published={concept.status === 'published'}
								class:status-badge--draft={concept.status === 'draft'}
							>
								{statusLabels[concept.status] ?? concept.status}
							</span>
						</td>
						<td>{formatTimestamp(concept.updatedAt)}</td>
						<td>
							<div class="concept-table__actions">
								<button type="button" on:click={() => handleEdit(concept)}>Redaguoti</button>
								<button type="button" class="danger" on:click={() => requestDelete(concept)}>
									Šalinti
								</button>
							</div>
							{#if deleteConfirmSlug === concept.slug}
								<div class="concept-table__delete-confirm">
									<p>Ar tikrai norite pašalinti "{concept.termLt}" sąvoką?</p>
									{#if deleteError}
										<p class="concept-table__delete-error">{deleteError}</p>
									{/if}
									<div class="concept-table__delete-actions">
										<button
											type="button"
											class="danger"
											on:click={confirmDelete}
											disabled={deletingSlug === concept.slug}
										>
											{deletingSlug === concept.slug ? 'Šalinama...' : 'Patvirtinti'}
										</button>
										<button
											type="button"
											on:click={cancelDelete}
											disabled={deletingSlug === concept.slug}
										>
											Atšaukti
										</button>
									</div>
								</div>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.table-wrapper {
		overflow-x: auto;
		border-radius: 0.75rem;
		border: 1px solid var(--color-border);
		background: var(--color-panel);
	}

	.concept-table {
		width: 100%;
		border-collapse: collapse;
	}

	.concept-table th,
	.concept-table td {
		padding: 0.75rem 1rem;
		text-align: left;
		border-bottom: 1px solid var(--color-border-light);
		vertical-align: top;
	}

	.concept-table th {
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-soft);
	}

	.concept-table tbody tr:last-child td {
		border-bottom: none;
	}

	.concept-name {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.concept-name__primary {
		font-weight: 600;
		color: inherit;
		text-decoration: none;
	}

	.concept-name__secondary {
		font-size: 0.85rem;
		color: var(--color-text-soft);
	}

	.concept-section {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.concept-section__title {
		font-size: 0.85rem;
		color: var(--color-text-soft);
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		background: rgba(148, 163, 184, 0.25);
		font-size: 0.8rem;
		font-weight: 600;
	}

	.status-badge--published {
		background: rgba(22, 163, 74, 0.18);
		color: rgb(21, 128, 61);
	}

	.status-badge--draft {
		background: rgba(234, 179, 8, 0.18);
		color: rgb(180, 83, 9);
	}

	.concept-table__actions {
		display: flex;
		gap: 0.4rem;
	}

	.concept-table__delete-confirm {
		margin-top: 0.75rem;
		padding: 0.65rem 0.75rem;
		border-radius: 0.55rem;
		border: 1px solid rgba(239, 68, 68, 0.35);
		background: rgba(239, 68, 68, 0.1);
		display: grid;
		gap: 0.55rem;
	}

	.concept-table__delete-error {
		margin: 0;
		color: rgb(185, 28, 28);
	}

	.concept-table__delete-actions {
		display: flex;
		gap: 0.45rem;
	}

	.concepts-empty {
		padding: 1.75rem;
		border-radius: 0.75rem;
		border: 1px dashed var(--color-border-light);
		text-align: center;
		display: grid;
		gap: 0.75rem;
	}

	.concepts-empty button {
		justify-self: center;
		padding: 0.55rem 0.9rem;
		border-radius: 0.55rem;
		border: 1px solid transparent;
		background: rgba(59, 130, 246, 0.12);
		color: rgb(37, 99, 235);
		cursor: pointer;
	}

	.concepts-empty button:hover,
	.concepts-empty button:focus-visible {
		background: rgba(59, 130, 246, 0.18);
	}
</style>
