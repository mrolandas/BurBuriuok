<script lang="ts">
	import { resolve } from '$app/paths';
	import Card from '$lib/components/Card.svelte';
	import CurriculumTree from '$lib/components/CurriculumTree.svelte';
	import type { SectionPageData } from './+page';

	export let data: SectionPageData;

	const homeHref = resolve('/');
</script>

<div class="section-view">
	<nav class="section-view__nav">
		<a class="section-view__back" href={homeHref}>
			<span aria-hidden="true">←</span>
			Grįžti į sekcijų lentą
		</a>
	</nav>

	{#if data.notFound}
		<Card title="Sekcija nerasta" subtitle="Klaida 404">
			<p>Ši sekcija nerasta. Patikrinkite nuorodą ir bandykite dar kartą.</p>
		</Card>
	{:else if data.loadError}
		<Card title="Nepavyko įkelti sekcijos" subtitle="Techninė klaida">
			<p>{data.loadError}</p>
		</Card>
	{:else if data.section}
		<CurriculumTree section={data.section} initialNodes={data.initialNodes} />
	{:else}
		<Card title="Kraunama sekcija">
			<p>Laukiame duomenų iš Supabase...</p>
		</Card>
	{/if}
</div>

<style>
	.section-view {
		display: grid;
		gap: clamp(1rem, 2vw, 1.5rem);
	}

	.section-view__nav {
		display: flex;
		justify-content: flex-start;
	}

	.section-view__back {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		text-decoration: none;
		font-weight: 600;
		color: var(--color-text);
		border: 1px solid rgba(148, 163, 184, 0.35);
		padding: 0.35rem 0.8rem;
		border-radius: 999px;
		transition:
			transform 0.2s ease,
			background 0.2s ease;
	}

	.section-view__back:hover,
	.section-view__back:focus-visible {
		transform: translateY(-1px);
		background: rgba(148, 163, 184, 0.1);
	}
</style>
