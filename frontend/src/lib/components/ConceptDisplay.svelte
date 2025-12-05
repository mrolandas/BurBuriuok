<script lang="ts">
	/* eslint-disable svelte/prefer-writable-derived */
	import { resolve } from '$app/paths';
	import { pushState } from '$app/navigation';
	import { page } from '$app/stores';
	import type { ConceptDetail as ConceptDetailData } from '$lib/api/concepts';
	import type { CurriculumItem } from '$lib/api/curriculum';
	import type { NextSection } from '$lib/page-data/conceptDetail';
	import type { Snippet } from 'svelte';

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

	type Props = {
		concept: ConceptDetailData;
		breadcrumbs?: Breadcrumb[];
		sectionItems?: CurriculumItem[];
		neighbors?: NeighborSet;
		nextSection?: NextSection | null;
		meta?: Snippet;
		actions?: Snippet;
		headerActions?: Snippet;
		content?: Snippet;
		isModal?: boolean;
		learnedSlugs?: Set<string>;
	};

	let {
		concept,
		breadcrumbs = [],
		sectionItems = [],
		neighbors,
		nextSection,
		meta,
		actions,
		headerActions,
		content,
		isModal = false,
		learnedSlugs = new Set()
	}: Props = $props();

	let showAllBreadcrumbs = $state(false);

	const boardHref = resolve('/');

	const description = $derived(concept.descriptionLt?.trim() ?? '');

	const visibleBreadcrumbs = $derived(
		showAllBreadcrumbs || breadcrumbs.length <= 2 ? breadcrumbs : breadcrumbs.slice(-2)
	);

	const hasHiddenBreadcrumbs = $derived(!showAllBreadcrumbs && breadcrumbs.length > 2);

	const visibleSectionItems = $derived.by(() => {
		if (!sectionItems.length) return [];
		const currentIndex = sectionItems.findIndex(i => i.conceptSlug === concept.slug);
		if (currentIndex === -1) return sectionItems.slice(0, 10);
		
		const start = Math.max(0, currentIndex - 5);
		const end = Math.min(sectionItems.length, currentIndex + 6);
		return sectionItems.slice(start, end);
	});

	const hasMoreBefore = $derived(sectionItems.length > 0 && sectionItems.findIndex(i => i.conceptSlug === concept.slug) > 5);
	const hasMoreAfter = $derived(sectionItems.length > 0 && sectionItems.findIndex(i => i.conceptSlug === concept.slug) < sectionItems.length - 6);

	const formatBreadcrumbLabel = (crumb: Breadcrumb) => {
		return crumb.label;
	};

	function getRootCode(code: string) {
		return code.split('.')[0];
	}

	function handleModalNavigate(event: MouseEvent, slug: string) {
		if (!isModal) return;
		event.preventDefault();
		const url = new URL($page.url);
		url.searchParams.set('concept', slug);
		pushState(url, { conceptSlug: slug });
	}

	$effect(() => {
		showAllBreadcrumbs = false;
	});

	/* eslint-enable svelte/prefer-writable-derived */
</script>

<section class="concept-detail">
	{#if !isModal}
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
	{/if}

	<div class="concept-detail__layout" class:concept-detail__layout--modal={isModal}>
		<article class="concept-detail__content">
			<header class="concept-detail__content-header">
				<div class="concept-detail__title-wrapper">
					<h1 class="concept-detail__title">
						{concept.termLt}
						{#if concept.termEn}
							<span class="concept-detail__subtitle">({concept.termEn})</span>
						{/if}
					</h1>
					{#if headerActions}
						<div class="concept-detail__header-actions">
							{@render headerActions()}
						</div>
					{/if}
				</div>
			</header>

			{#if meta}
				<div class="concept-detail__meta-slot">
					{@render meta()}
				</div>
			{/if}

			{#if content}
				{@render content()}
			{:else}
				{#if description}
					<p>{description}</p>
				{:else}
					<p>
						Apibrėžimas šiai temai dar nepateiktas. Papildysime turinį, kai tik jis bus paruoštas
						recenzijai.
					</p>
				{/if}

				{#if concept.descriptionEn}
					<div class="concept-detail__translation">
						<h3>Anglų kalbos užuomina</h3>
						<p>{concept.descriptionEn}</p>
					</div>
				{/if}
			{/if}

			{#if actions}
				{@render actions()}
			{/if}
		</article>

		{#if neighbors?.previous || neighbors?.next}
			<nav class="concept-detail__pager" aria-label="Temų naršymas">
				{#if neighbors?.previous}
					<a
						class="concept-detail__pager-link concept-detail__pager-link--prev"
						href={resolve('/concepts/[slug]', { slug: neighbors.previous.slug })}
						onclick={(e) => handleModalNavigate(e, neighbors.previous!.slug)}
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
						onclick={(e) => handleModalNavigate(e, neighbors.next!.slug)}
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
			{#if sectionItems.length}
				<section class="concept-detail__panel concept-detail__panel--list">
					<h2>Šiame skyriuje</h2>
					<ul class="concept-agenda">
						{#if hasMoreBefore}
							<li class="concept-agenda__item">
								<div class="concept-agenda__marker" aria-hidden="true"></div>
								<span class="concept-agenda__label concept-agenda__label--muted">...</span>
							</li>
						{/if}
						{#each visibleSectionItems as item (item.ordinal)}
							{@const isCurrent = item.conceptSlug === concept.slug}
							{@const isLearned = item.conceptSlug && learnedSlugs.has(item.conceptSlug)}
							<li class="concept-agenda__item" class:concept-agenda__item--current={isCurrent}>
								{#if isLearned && !isCurrent}
									<div class="concept-agenda__marker concept-agenda__marker--learned" aria-hidden="true">
										<svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round">
											<polyline points="20 6 9 17 4 12"></polyline>
										</svg>
									</div>
								{:else}
									<div class="concept-agenda__marker" aria-hidden="true"></div>
								{/if}
								{#if item.conceptSlug}
									{#if isCurrent}
										<span class="concept-agenda__label">{item.label}</span>
									{:else}
										<a 
											href={resolve('/concepts/[slug]', { slug: item.conceptSlug })} 
											class="concept-agenda__link"
											onclick={(e) => handleModalNavigate(e, item.conceptSlug!)}
										>
											{item.label}
										</a>
									{/if}
								{:else}
									<span class="concept-agenda__label concept-agenda__label--muted">{item.label}</span>
								{/if}
							</li>
						{/each}
						{#if hasMoreAfter}
							<li class="concept-agenda__item">
								<div class="concept-agenda__marker" aria-hidden="true"></div>
								<span class="concept-agenda__label concept-agenda__label--muted">...</span>
							</li>
						{/if}
					</ul>
				</section>
			{/if}

			{#if nextSection}
				<section class="concept-detail__panel concept-detail__panel--next">
					<h2>Kitas skyrius</h2>
					<a
						href="{resolve('/sections/[code]', { code: getRootCode(nextSection.code) })}?expand={nextSection.code}"
						class="concept-detail__next-link"
					>
						<span class="concept-detail__next-label">{nextSection.title}</span>
						<span class="concept-detail__next-arrow" aria-hidden="true">→</span>
					</a>
				</section>
			{/if}
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
		color: inherit;
		text-decoration: none;
		border-bottom: 1px solid transparent;
		transition: border-color 0.2s ease;
	}

	.concept-detail__crumb--static {
		opacity: 0.8;
		cursor: default;
	}

	.concept-detail__crumb--ellipsis,
	.concept-detail__crumb--toggle {
		flex: 0 0 auto;
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

	a.concept-detail__crumb:hover,
	a.concept-detail__crumb:focus-visible,
	button.concept-detail__crumb:hover,
	button.concept-detail__crumb:focus-visible {
		border-color: currentColor;
	}

	.concept-detail__crumb-separator {
		flex: 0 0 auto;
	}

	.concept-detail__title-wrapper {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.concept-detail__header-actions {
		flex-shrink: 0;
		margin-top: 0.2rem;
	}

	.concept-detail__layout {
		display: grid;
		gap: clamp(1.5rem, 3vw, 2.5rem);
	}

	.concept-detail__layout--modal {
		gap: 1.5rem;
	}

	.concept-detail__layout--modal .concept-detail__content {
		border: none;
		background: transparent;
		padding: 2rem;
		box-shadow: none;
	}

	.concept-detail__layout--modal .concept-detail__content-header {
		padding-right: 3rem;
	}

	.concept-detail__layout--modal .concept-detail__pager {
		padding: 0 2rem;
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
		margin-bottom: 2rem;
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
		transition:
			background 0.2s ease,
			border-color 0.2s ease;
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

	.concept-detail__pager-link--next {
		margin-left: auto;
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

	.concept-agenda {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0;
		position: relative;
	}

	.concept-agenda::before {
		content: '';
		position: absolute;
		top: 0.8rem;
		bottom: 0.8rem;
		left: 0.6rem;
		width: 2px;
		background: var(--color-border);
		z-index: 0;
	}

	.concept-agenda__item {
		display: grid;
		grid-template-columns: 1.2rem 1fr;
		gap: 0.75rem;
		align-items: baseline;
		padding: 0.4rem 0;
		position: relative;
		z-index: 1;
	}

	.concept-agenda__marker {
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 50%;
		background: var(--color-panel);
		border: 2px solid var(--color-border-strong);
		margin-top: 0.3rem;
		justify-self: center;
		transition: all 0.2s ease;
	}

	.concept-agenda__marker--learned {
		background: var(--color-accent-success, #10b981);
		border-color: var(--color-accent-success, #10b981);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.concept-agenda__item--current .concept-agenda__marker {
		background: var(--color-accent);
		border-color: var(--color-accent);
		transform: scale(1.2);
		box-shadow: 0 0 0 3px var(--color-accent-faint);
	}

	.concept-agenda__link {
		text-decoration: none;
		color: var(--color-text-subtle);
		font-size: 0.95rem;
		transition: color 0.2s ease;
		line-height: 1.4;
	}

	.concept-agenda__link:hover {
		color: var(--color-accent-strong);
	}

	.concept-agenda__label {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--color-text);
		line-height: 1.4;
	}

	.concept-agenda__label--muted {
		color: var(--color-text-muted);
		font-weight: 400;
		font-style: italic;
	}

	.concept-detail__panel--next {
		background: var(--color-panel);
		border-color: var(--color-accent-faint);
	}

	.concept-detail__next-link {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.8rem;
		text-decoration: none;
		color: var(--color-text);
		font-weight: 500;
		padding: 0.4rem 0;
		transition: color 0.2s ease;
	}

	.concept-detail__next-link:hover {
		color: var(--color-accent-strong);
	}

	.concept-detail__next-arrow {
		font-size: 1.2rem;
		line-height: 1;
		color: var(--color-accent);
		transition: transform 0.2s ease;
	}

	.concept-detail__next-link:hover .concept-detail__next-arrow {
		transform: translateX(4px);
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
