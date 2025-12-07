<script lang="ts">
	import { resolve } from '$app/paths';
	import { pushState } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import Card from '$lib/components/Card.svelte';
	import CurriculumTree from '$lib/components/CurriculumTree.svelte';
	import ConceptModal from '$lib/components/ConceptModal.svelte';
	import type { SectionPageData } from './+page';

	export let data: SectionPageData;

	const homeHref = resolve('/');

	let selectedConceptSlug: string | null = null;
	let expandCode: string | null = null;

	function handleSelectConcept(slug: string) {
		selectedConceptSlug = slug;
		const url = new URL($page.url);
		url.searchParams.set('concept', slug);
		pushState(url, { conceptSlug: slug });
	}

	function closeConceptModal() {
		selectedConceptSlug = null;
		const url = new URL($page.url);
		url.searchParams.delete('concept');
		pushState(url, { conceptSlug: null });
	}

	// Handle browser back/forward
	$: {
		const state = $page.state as { conceptSlug?: string | null };
		if (state.conceptSlug !== undefined) {
			selectedConceptSlug = state.conceptSlug;
		} else {
			const slug = $page.url.searchParams.get('concept');
			if (slug !== selectedConceptSlug) {
				selectedConceptSlug = slug;
			}
		}
		
		const expand = $page.url.searchParams.get('expand');
		if (expand && expand !== expandCode) {
			expandCode = expand;
			// Clear the expand parameter from URL to avoid persistent state
			const newUrl = new URL($page.url);
			newUrl.searchParams.delete('expand');
			pushState(newUrl, $page.state);
		}
	}

	onMount(() => {
		const slug = $page.url.searchParams.get('concept');
		if (slug) {
			selectedConceptSlug = slug;
		}
		const expand = $page.url.searchParams.get('expand');
		if (expand) {
			expandCode = expand;
			// Clear the expand parameter from URL to avoid persistent state
			const newUrl = new URL($page.url);
			newUrl.searchParams.delete('expand');
			pushState(newUrl, $page.state);
		}
	});
</script>

<div class="section-view">
	<nav class="section-breadcrumbs" aria-label="Navigacija">
		<a class="section-breadcrumb" href={homeHref}>Pagrindinis</a>
		{#if data.breadcrumbs}
			{#each data.breadcrumbs as crumb}
				<span class="section-breadcrumb-separator" aria-hidden="true">›</span>
				{#if crumb.href}
					<a class="section-breadcrumb" href={crumb.href}>{crumb.label}</a>
				{:else}
					<span class="section-breadcrumb section-breadcrumb--static">{crumb.label}</span>
				{/if}
			{/each}
		{/if}
	</nav>

	{#if data.notFound}
		<Card title="Skiltis nerasta" subtitle="Klaida 404">
			<p>Ši skiltis nerasta. Patikrinkite nuorodą ir bandykite dar kartą.</p>
		</Card>
	{:else if data.loadError}
		<Card title="Nepavyko įkelti skilties" subtitle="Techninė klaida">
			<p>{data.loadError}</p>
		</Card>
	{:else if data.section}
		<CurriculumTree 
			section={data.section} 
			initialNodes={data.initialNodes} 
			onSelectConcept={handleSelectConcept}
			{expandCode}
		/>
	{:else}
		<Card title="Kraunama skiltis">
			<p>Laukiame duomenų iš Supabase...</p>
		</Card>
	{/if}

	{#if selectedConceptSlug}
		<ConceptModal 
			slug={selectedConceptSlug} 
			onClose={closeConceptModal} 
		/>
	{/if}
</div>

<style>
	.section-view {
		display: grid;
		gap: clamp(1rem, 2vw, 1.5rem);
	}

	.section-breadcrumbs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.85rem;
		color: var(--color-breadcrumb, var(--color-text-soft));
		margin-bottom: 0.5rem;
	}

	.section-breadcrumb {
		display: inline-flex;
		align-items: center;
		color: inherit;
		text-decoration: none;
		border-bottom: 1px solid transparent;
		transition: border-color 0.2s ease;
	}

	.section-breadcrumb--static {
		opacity: 0.8;
		cursor: default;
	}

	a.section-breadcrumb:hover,
	a.section-breadcrumb:focus-visible {
		border-color: currentColor;
	}

	.section-breadcrumb-separator {
		opacity: 0.5;
	}
</style>
