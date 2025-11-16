<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { AdminConceptStatus } from '$lib/api/admin/concepts';
	import type { SectionFilterOption } from '../types';

	type FilterStatus = 'all' | AdminConceptStatus;
	type Events = {
		sectionChange: string;
		statusChange: FilterStatus;
		searchChange: string;
		clearFilters: void;
	};

	export let sectionFilterOptions: SectionFilterOption[] = [];
	export let filterSectionCode = 'all';
	export let filterStatus: FilterStatus = 'all';
	export let searchTerm = '';
	export let isFiltered = false;
	export let totalMatches = 0;
	export let totalConcepts = 0;

	const dispatch = createEventDispatcher<Events>();

	function handleSectionChange(event: Event): void {
		const target = event.currentTarget as HTMLSelectElement;
		dispatch('sectionChange', target.value);
	}

	function handleStatusChange(event: Event): void {
		const target = event.currentTarget as HTMLSelectElement;
		dispatch('statusChange', target.value as FilterStatus);
	}

	function handleSearchChange(event: Event): void {
		const target = event.currentTarget as HTMLInputElement;
		dispatch('searchChange', target.value);
	}

	function handleClear(): void {
		dispatch('clearFilters');
	}
</script>

<div class="concepts-toolbar">
	<div class="concept-filters">
		<label class="concept-filters__field">
			<span>Skyrius</span>
			<select value={filterSectionCode} on:change={handleSectionChange}>
				<option value="all">Visi skyriai</option>
				{#each sectionFilterOptions as option (option.code)}
					<option value={option.code}>{option.label}</option>
				{/each}
			</select>
		</label>

		<label class="concept-filters__field">
			<span>Būsena</span>
			<select value={filterStatus} on:change={handleStatusChange}>
				<option value="all">Visos būsenos</option>
				<option value="draft">Juodraštis</option>
				<option value="published">Publikuota</option>
			</select>
		</label>

		<label class="concept-filters__field concept-filters__field--search">
			<span>Paieška</span>
			<input
				type="search"
				placeholder="Ieškoti sąvokų"
				value={searchTerm}
				on:input={handleSearchChange}
			/>
		</label>

		{#if isFiltered}
			<button type="button" class="concept-filters__clear" on:click={handleClear}>
				Išvalyti filtrus
			</button>
		{/if}
	</div>

	<p class="concepts-toolbar__count muted">
		Rodoma {totalMatches} iš {totalConcepts} sąvokų.
	</p>
</div>

<style>
	.concepts-toolbar {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		margin-bottom: 1.4rem;
	}

	@media (min-width: 960px) {
		.concepts-toolbar {
			flex-direction: row;
			justify-content: space-between;
			align-items: center;
		}
	}

	.concept-filters {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		align-items: end;
	}

	.concept-filters__field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.95rem;
	}

	.concept-filters__field select,
	.concept-filters__field input[type='search'] {
		padding: 0.5rem 0.6rem;
		border-radius: 0.55rem;
		border: 1px solid var(--color-border);
		background: var(--color-panel-soft);
		font: inherit;
	}

	.concept-filters__field--search {
		min-width: 220px;
	}

	.concept-filters__clear {
		justify-self: start;
		padding: 0.45rem 0.75rem;
		border-radius: 0.55rem;
		border: 1px solid transparent;
		background: rgba(59, 130, 246, 0.12);
		color: rgb(37, 99, 235);
		cursor: pointer;
	}

	.concept-filters__clear:hover,
	.concept-filters__clear:focus-visible {
		background: rgba(59, 130, 246, 0.18);
	}

	.concepts-toolbar__count {
		margin: 0;
	}
</style>
