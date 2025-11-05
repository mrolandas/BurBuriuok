<script lang="ts">
import { resolve } from '$app/paths';
import Card from '$lib/components/Card.svelte';
import ConceptDetail from '$lib/components/ConceptDetail.svelte';
import type { ConceptPageData } from './+page';

export let data: ConceptPageData;
</script>

<div class="concept-page">
	{#if data.notFound}
		<Card title="Tema nerasta" subtitle="Klaida 404">
			<p>Šios temos neradome. Patikrinkite nuorodą ir bandykite dar kartą.</p>
		</Card>
	{:else if data.loadError}
		<Card title="Nepavyko įkelti temos" subtitle="Techninė klaida">
			<p>{data.loadError}</p>
		</Card>
	{:else if data.concept}
		<ConceptDetail
			concept={data.concept}
			breadcrumbs={data.breadcrumbs}
			peerItems={data.peerItems}
		/>
	{:else}
		<Card title="Kraunama tema">
			<p>Laukiame duomenų iš Supabase...</p>
		</Card>
	{/if}
</div>

<style>
	.concept-page {
		display: grid;
		gap: clamp(1.2rem, 3vw, 2rem);
	}
</style>
