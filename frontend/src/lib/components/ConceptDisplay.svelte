<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ConceptDetail as ConceptDetailData } from '$lib/api/concepts';
	import type { CurriculumItem } from '$lib/api/curriculum';

	export type Breadcrumb = {
		label: string;
		routeId?: '/sections/[code]';
		params?: { code: string };
	};

	export type NeighborLink = {
		label: string;
		slug: string;
		ordinal: number | null;
	};

	export type NeighborSet = {
		previous?: NeighborLink | null;
		next?: NeighborLink | null;
	};

	export interface $$Slots {
		meta?: unknown;
		actions?: unknown;
	}

	type Props = {
		concept: ConceptDetailData;
		breadcrumbs?: Breadcrumb[];
		peerItems?: CurriculumItem[];
		neighbors?: NeighborSet;
	};

	let { concept, breadcrumbs = [], peerItems = [], neighbors }: Props = $props();

	let showAllBreadcrumbs = $state(false);

	const boardHref = resolve('/');

	const description = $derived(concept.descriptionLt?.trim() ?? '');

	const visibleBreadcrumbs = $derived(
		showAllBreadcrumbs || breadcrumbs.length <= 2 ? breadcrumbs : breadcrumbs.slice(-2)
	);

	const hasHiddenBreadcrumbs = $derived(!showAllBreadcrumbs && breadcrumbs.length > 2);

	const formatBreadcrumbLabel = (crumb: Breadcrumb) => {
		if (showAllBreadcrumbs) {
			return crumb.label;
		}

		const MAX_LENGTH = 36;
		if (crumb.label.length <= MAX_LENGTH) {
			return crumb.label;
		}

		return `…${crumb.label.slice(-MAX_LENGTH + 1)}`;
	};

	$effect(() => {
		showAllBreadcrumbs = false;
	});
</script>

<section class="concept-detail">
	<nav
		class="concept-detail__breadcrumbs"
		class:concept-detail__breadcrumbs--expanded={showAllBreadcrumbs}
		aria-label="Navigacija"
	>
		<a class="concept-detail__crumb" href={boardHref}>Pagrindinis</a>

		{#if hasHiddenBreadcrumbs}
			<span class="concept-detail__crumb-separator" aria-hidden="true">›</span>
			<span
				class="concept-detail__crumb concept-detail__crumb--static concept-detail__crumb--ellipsis"
				aria-hidden="true"
			>
				…
			</span>
			<button
				type="button"
				class="concept-detail__crumb concept-detail__crumb--toggle"
				onclick={() => (showAllBreadcrumbs = true)}
				aria-expanded={showAllBreadcrumbs}
				aria-label="Rodyti pilną naršymo kelią"
			>
				>>
			</button>
		{/if}

		{#each visibleBreadcrumbs as crumb (crumb.label)}
			<span class="concept-detail__crumb-separator" aria-hidden="true">›</span>
			{#if crumb.routeId && crumb.params}
				<a class="concept-detail__crumb" href={resolve(crumb.routeId, crumb.params)}
					>{formatBreadcrumbLabel(crumb)}</a
				>
			{:else}
				<span class="concept-detail__crumb concept-detail__crumb--static">
					{formatBreadcrumbLabel(crumb)}
				</span>
			{/if}
		{/each}
	</nav>

	<div class="concept-detail__layout">
		<article class="concept-detail__content">
			<header class="concept-detail__content-header">
				<h1 class="concept-detail__title">
					{concept.termLt}
					{#if concept.termEn}
						<span class="concept-detail__subtitle">({concept.termEn})</span>
					{/if}
				</h1>
			</header>

			{#if $$slots.meta}
				<div class="concept-detail__meta-slot">
					<slot name="meta" />
				</div>
			{/if}

			{#if description}
				<p>{description}</p>
			{:else}
				<p>
					Apibrėžimas šiai temai dar nepateiktas. Papildysime turinį, kai tik jis bus paruoštas
					recenzijai.
				</p>
			{/if}

			{#if $$slots.actions}
				<slot name="actions" />
			{/if}

			{#if concept.descriptionEn}
				<div class="concept-detail__translation">
					<h3>Anglų kalbos užuomina</h3>
					<p>{concept.descriptionEn}</p>
				</div>
			{/if}
		</article>

		{#if neighbors?.previous || neighbors?.next}
			<nav class="concept-detail__pager" aria-label="Temų naršymas">
				{#if neighbors?.previous}
					<a
						class="concept-detail__pager-link concept-detail__pager-link--prev"
						href={resolve('/concepts/[slug]', { slug: neighbors.previous.slug })}
					>
						<span aria-hidden="true">‹</span>
						<span>
							<span class="concept-detail__pager-label">{neighbors.previous.label}</span>
						</span>
					</a>
				{/if}

				{#if neighbors?.next}
					<a
						class="concept-detail__pager-link concept-detail__pager-link--next"
						href={resolve('/concepts/[slug]', { slug: neighbors.next.slug })}
					>
						<span>
							<span class="concept-detail__pager-label">{neighbors.next.label}</span>
						</span>
						<span aria-hidden="true">›</span>
					</a>
				{/if}
			</nav>
		{/if}

		<aside class="concept-detail__sidebar">
			{#if peerItems.length}
				<section class="concept-detail__panel concept-detail__panel--list">
					<h2>Susijusios temos</h2>
					<ul>
						{#each peerItems as item (item.ordinal)}
							<li>
								{#if item.conceptSlug}
									<a href={resolve('/concepts/[slug]', { slug: item.conceptSlug })}>{item.label}</a>
								{:else}
									<span>{item.label}</span>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<section class="concept-detail__panel">
				<h2>Prieraišos</h2>
				<p>
					Tikros prielaidos atsiras, kai viešoje schemoje publikavimo metas suteiks priklausomybių
					duomenis. Kol kas žymime, kad ši sritis laukia backend atnaujinimo.
				</p>
			</section>
		</aside>
	</div>
</section>

<style>
	.concept-detail {
		display: grid;
		gap: clamp(1.4rem, 3vw, 2rem);
	}

	.concept-detail__breadcrumbs {
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.85rem;
		color: var(--color-breadcrumb);
		overflow: hidden;
		white-space: nowrap;
	}

	.concept-detail__breadcrumbs--expanded {
		flex-wrap: wrap;
		white-space: normal;
		overflow: visible;
	}

	.concept-detail__crumb {
		display: inline-flex;
		align-items: center;
		flex: 0 1 auto;
		max-width: min(100%, 20ch);
		color: inherit;
		text-decoration: none;
		border-bottom: 1px solid transparent;
		transition: border-color 0.2s ease;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.concept-detail__crumb--static {
		opacity: 0.8;
	}

	.concept-detail__crumb--ellipsis,
	.concept-detail__crumb--toggle {
		flex: 0 0 auto;
		max-width: none;
	}

	.concept-detail__crumb--toggle {
		border: none;
		background: none;
		padding: 0;
		font: inherit;
		cursor: pointer;
		border-bottom: 1px solid transparent;
	}

	.concept-detail__crumb--toggle:focus-visible {
		outline: 2px solid var(--color-pill-hover-border);
		outline-offset: 2px;
	}

	.concept-detail__crumb:hover,
	.concept-detail__crumb:focus-visible {
		border-color: currentColor;
	}

	.concept-detail__crumb-separator {
		flex: 0 0 auto;
	}

	.concept-detail__layout {
		display: grid;
		gap: clamp(1.5rem, 3vw, 2.5rem);
	}

	.concept-detail__content {
		display: grid;
		gap: 1.3rem;
		border-radius: 1.2rem;
		padding: clamp(1.5rem, 3vw, 2rem);
		border: 1px solid var(--color-border);
		background: var(--color-panel);
	}

	.concept-detail__content-header {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		align-items: baseline;
	}

	.concept-detail__meta-slot {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}

	.concept-detail__title {
		font-size: clamp(1.6rem, 4vw, 2.3rem);
		line-height: 1.2;
		margin: 0;
	}

	.concept-detail__subtitle {
		font-size: clamp(1rem, 2.4vw, 1.2rem);
		color: var(--color-text-subtle);
		margin-left: 0.4rem;
	}

	.concept-detail__translation {
		display: grid;
		gap: 0.6rem;
		border-top: 1px dashed var(--color-border);
		padding-top: 1rem;
		color: var(--color-text-subtle);
	}

	.concept-detail__translation h3 {
		margin: 0;
		font-size: 1rem;
	}

	.concept-detail__pager {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.concept-detail__pager-link {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		border: 1px solid var(--color-border);
		padding: 0.75rem 1rem;
		border-radius: 0.9rem;
		text-decoration: none;
		color: inherit;
		background: var(--color-panel);
		transition: background 0.2s ease, border-color 0.2s ease;
	}

	.concept-detail__pager-link:hover,
	.concept-detail__pager-link:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-panel-hover);
	}

	.concept-detail__pager-link span[aria-hidden='true'] {
		font-size: 1.4rem;
		line-height: 1;
	}

	.concept-detail__pager-label {
		font-weight: 600;
	}

	.concept-detail__sidebar {
		display: grid;
		gap: 1.2rem;
	}

	.concept-detail__panel {
		display: grid;
		gap: 0.6rem;
		border-radius: 1rem;
		padding: clamp(1.2rem, 3vw, 1.5rem);
		background: var(--color-panel-secondary);
		border: 1px solid var(--color-border-light);
	}

	.concept-detail__panel h2 {
		margin: 0;
		font-size: 1.1rem;
	}

	.concept-detail__panel ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.5rem;
	}

	.concept-detail__panel a {
		text-decoration: none;
		color: var(--color-link);
		border-bottom: 1px solid transparent;
		transition: border-color 0.2s ease;
	}

	.concept-detail__panel a:hover,
	.concept-detail__panel a:focus-visible {
		border-color: currentColor;
	}

	@media (min-width: 900px) {
		.concept-detail__layout {
			grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
		}

		.concept-detail__sidebar {
			position: sticky;
			top: clamp(1rem, 3vw, 2rem);
			height: fit-content;
		}
	}

	@media (min-width: 960px) {
		.concept-detail__layout {
			grid-template-columns: minmax(0, 3fr) minmax(0, 1.35fr);
			grid-template-areas:
				'content sidebar'
				'pager sidebar';
			align-items: start;
		}

		.concept-detail__content {
			grid-area: content;
		}

		.concept-detail__pager {
			grid-area: pager;
			margin-top: 0.4rem;
		}

		.concept-detail__sidebar {
			grid-area: sidebar;
			align-self: start;
		}
	}

	@media (max-width: 640px) {
		.concept-detail__meta-slot {
			gap: 0.4rem;
		}
	}
</style>
