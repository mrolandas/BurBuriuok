<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	export let data: PageData;

	const query = data.query;
	const totalResults =
		data.conceptHits.length + data.descriptionHits.length + (data.sectionHits?.length ?? 0);
</script>

<section class="search-results" aria-live="polite">
	{#if !query}
		<p class="search-results__hint">
			Įveskite paieškos frazę viršuje ir paspauskite „Ieškoti“, kad pamatytumėte rezultatus.
		</p>
	{:else if data.tooShort}
		<p class="search-results__hint">
			Įveskite bent {data.minimumLength} simbolius, kad pradėtume paiešką.
		</p>
	{:else if data.loadError}
		<p class="search-results__error">{data.loadError}</p>
	{:else if totalResults === 0}
		<p class="search-results__hint">
			Rezultatų „{query}“ neradome. Pabandykite kitą frazę arba patikrinkite rašybą.
		</p>
	{/if}

	{#if data.sectionHits && data.sectionHits.length}
		<section class="search-results__section" aria-label="Rasta temose">
			<h2 class="search-results__heading">
				Rasta temose
				<span aria-hidden="true">({data.sectionHits.length})</span>
			</h2>
			<ul class="search-results__list">
				{#each data.sectionHits as hit (hit.code)}
					<li class="search-results__item search-results__item--section">
						<a class="search-results__link" href={resolve('/sections/[code]', { code: hit.code })}>
							<span class="search-results__term">{hit.title}</span>
							<span class="search-results__section-name">Tema {hit.code}</span>
						</a>
						{#if hit.snippet}
							<p class="search-results__snippet">{hit.snippet}</p>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.conceptHits.length}
		<section class="search-results__section" aria-label="Rasta sąvokų pavadinimuose">
			<h2 class="search-results__heading">
				Rasta sąvokų pavadinimuose
				<span aria-hidden="true">({data.conceptHits.length})</span>
			</h2>
			<ul class="search-results__list">
				{#each data.conceptHits as hit (hit.id)}
					<li class="search-results__item search-results__item--concept">
						<a class="search-results__link" href={resolve('/concepts/[slug]', { slug: hit.slug })}>
							<span class="search-results__term">{hit.term}</span>
							{#if hit.sectionTitle}
								<span class="search-results__section-name">{hit.sectionTitle}</span>
							{/if}
						</a>
						{#if hit.snippet}
							<p class="search-results__snippet">{hit.snippet}</p>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.descriptionHits.length}
		<section class="search-results__section" aria-label="Rasta aprašymuose">
			<h2 class="search-results__heading">
				Rasta aprašymuose
				<span aria-hidden="true">({data.descriptionHits.length})</span>
			</h2>
			<ul class="search-results__list">
				{#each data.descriptionHits as hit (hit.id)}
					<li class="search-results__item search-results__item--description">
						<a class="search-results__link" href={resolve('/concepts/[slug]', { slug: hit.slug })}>
							<span class="search-results__term">{hit.term}</span>
							{#if hit.sectionTitle}
								<span class="search-results__section-name">{hit.sectionTitle}</span>
							{/if}
						</a>
						{#if hit.snippet}
							<p class="search-results__snippet">{hit.snippet}</p>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</section>

<style>
	.search-results {
		max-width: var(--layout-max-width);
		margin: 0 auto clamp(2rem, 6vw, 4rem);
		display: flex;
		flex-direction: column;
		gap: clamp(1.5rem, 4vw, 2.5rem);
	}

	.search-results__hint {
		margin: 0;
		font-size: 1rem;
		color: var(--color-text-muted);
	}

	.search-results__error {
		margin: 0;
		padding: 1rem 1.25rem;
		border-radius: 1rem;
		background: var(--color-status-error-bg);
		border: 1px solid var(--color-status-error-border);
		color: var(--color-status-error-text);
	}

	.search-results__section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.search-results__heading {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		color: var(--color-text);
	}

	.search-results__list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.search-results__item {
		padding: 1rem 1.1rem;
		border-radius: 1rem;
		border: 1px solid var(--color-border);
		background: var(--color-panel);
		transition:
			background-color 0.2s ease,
			border-color 0.2s ease,
			transform 0.2s ease;
	}

	.search-results__item--section {
		background: var(--color-panel-secondary);
		border-color: var(--color-accent-border);
	}

	.search-results__item--concept {
		background: var(--color-panel);
	}

	.search-results__item--description {
		background: var(--color-panel-soft);
	}

	.search-results__item:hover,
	.search-results__item:focus-within {
		transform: translateY(-2px);
		border-color: var(--color-accent-border-strong);
		background: var(--color-panel-hover);
	}

	.search-results__link {
		display: inline-flex;
		gap: 0.45rem;
		flex-wrap: wrap;
		align-items: baseline;
		color: var(--color-text);
		text-decoration: none;
		font-weight: 600;
	}

	.search-results__link:hover,
	.search-results__link:focus-visible {
		text-decoration: underline;
		color: var(--color-accent-strong);
	}

	.search-results__term {
		font-size: 1rem;
	}

	.search-results__section-name {
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	.search-results__snippet {
		margin: 0.6rem 0 0;
		font-size: 0.95rem;
		line-height: 1.6;
		color: var(--color-text-muted);
	}
</style>
