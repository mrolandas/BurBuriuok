<script lang="ts">
	/* eslint-disable svelte/prefer-writable-derived */
	import { resolve } from '$app/paths';
	import { pushState, goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { ConceptDetail as ConceptDetailData } from '$lib/api/concepts';
	import type { CurriculumItem } from '$lib/api/curriculum';
	import type { NextSection, PreviousSection } from '$lib/page-data/conceptDetail';
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
		isNextSection?: boolean;
		isPreviousSection?: boolean;
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
		previousSection?: PreviousSection | null;
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
		previousSection,
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

	const visibleSectionItems = $derived(sectionItems);

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

	function getBreadcrumbHref(crumb: Breadcrumb) {
		if (!crumb.routeId) return '#';
		
		// If no code param, just resolve as is
		if (!crumb.params?.code) {
			return resolve(crumb.routeId, crumb.params as any);
		}

		const code = crumb.params.code;
		const rootCode = getRootCode(code);
		
		// Resolve to the root section
		const url = resolve(crumb.routeId, { code: rootCode });
		
		// If it's a subsection, add expand param
		if (code !== rootCode) {
			return `${url}?expand=${code}`;
		}
		return url;
	}

	function handleBreadcrumbClick(event: MouseEvent, href: string) {
		if (!isModal) return;
		// If we are in a modal, clicking a breadcrumb should navigate to that section
		// and effectively close the modal.
		// We use goto to ensure a full navigation, which will update the page component.
		event.preventDefault();
		goto(href);
	}

	$effect(() => {
		showAllBreadcrumbs = false;
	});

	/* eslint-enable svelte/prefer-writable-derived */
</script>

<section class="concept-detail">
	<nav
		class="concept-detail__breadcrumbs"
		class:concept-detail__breadcrumbs--expanded={showAllBreadcrumbs}
		class:concept-detail__breadcrumbs--modal={isModal}
		aria-label="Navigacija"
	>
		{#if !isModal}
			<a class="concept-detail__crumb" href={boardHref}>Pagrindinis</a>
		{/if}

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
				{@const href = getBreadcrumbHref(crumb)}
				<a 
					class="concept-detail__crumb" 
					href={href}
					onclick={(e) => handleBreadcrumbClick(e, href)}
				>
					{formatBreadcrumbLabel(crumb)}
				</a>
			{:else}
				<span class="concept-detail__crumb concept-detail__crumb--static">
					{formatBreadcrumbLabel(crumb)}
				</span>
			{/if}
		{/each}
	</nav>

	<div class="concept-detail__layout" class:concept-detail__layout--modal={isModal}>
		<article class="concept-detail__content">
			<header class="concept-detail__content-header">
				<div class="concept-detail__title-wrapper">
					<div class="concept-detail__title-row">
						<h1 class="concept-detail__title">
							{concept.termLt}
						</h1>
						<div class="concept-detail__header-actions">
							{#if headerActions}
								{@render headerActions()}
							{/if}
						</div>
					</div>
					{#if concept.termEn}
						<div class="concept-detail__subtitle">({concept.termEn})</div>
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
				<div class="concept-detail__footer-actions">
					{@render actions()}
				</div>
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
							{#if neighbors.previous.isPreviousSection}
								<span class="concept-detail__pager-subtitle concept-detail__pager-subtitle--prev">Ankstesnis skyrius</span>
							{/if}
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
							{#if neighbors.next.isNextSection}
								<span class="concept-detail__pager-subtitle">Kitas skyrius</span>
							{/if}
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
					</ul>
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

	.concept-detail__breadcrumbs--modal {
		padding: 0 2rem;
		margin-top: 1rem;
	}

	.concept-detail__breadcrumbs--modal .concept-detail__crumb-separator:first-child {
		display: none;
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
		flex-direction: column;
		gap: 0.2rem;
		width: 100%;
	}

	.concept-detail__title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		width: 100%;
	}

	.concept-detail__header-actions {
		flex-shrink: 0;
		margin-top: 0.2rem;
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-left: auto;
	}

	.concept-detail__layout {
		display: grid;
		gap: clamp(1.5rem, 3vw, 2.5rem);
	}

	.concept-detail__layout--modal {
		gap: 0.5rem;
	}

	.concept-detail__layout--modal .concept-detail__content {
		border: none;
		background: transparent;
		padding: 0 2rem 1rem 2rem;
		box-shadow: none;
	}	.concept-detail__layout--modal .concept-detail__sidebar {
		padding-right: 2rem;
		padding-bottom: 2rem;
	}

	.concept-detail__layout--modal .concept-detail__content-header {
		padding-right: 3rem;
	}

	.concept-detail__layout--modal .concept-detail__pager {
		padding: 0 2rem;
	}

	.concept-detail__footer-actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 0.5rem;
	}

	.concept-detail__content {
		display: grid;
		gap: 1.3rem;
		border-radius: 1.2rem;
		padding: clamp(1.2rem, 3vw, 2rem);
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
		display: block;
	}

	.concept-detail__pager-subtitle {
		display: block;
		font-size: 0.75rem;
		color: var(--color-text-muted);
		font-weight: normal;
		margin-bottom: 0.1rem;
		text-align: right;
	}

	.concept-detail__pager-link--next {
		margin-left: auto;
		text-align: right;
	}

	.concept-detail__sidebar {
		display: grid;
		gap: 1.2rem;
		align-content: start;
	}

	.concept-detail__panel {
		display: grid;
		gap: 0.6rem;
		border-radius: 1rem;
		padding: clamp(1.2rem, 3vw, 1.5rem);
		background: var(--color-panel-secondary);
		border: 1px solid var(--color-border-light);
	}

	.concept-detail__panel--list {
		max-height: 25rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}



	.concept-detail__panel h2 {
		margin: 0;
		font-size: 1.1rem;
		position: sticky;
		top: 0;
		background: var(--color-panel-secondary);
		z-index: 2;
		padding-bottom: 0.5rem;
	}

	.concept-agenda {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0;
		position: relative;
		overflow-y: auto;
		padding-right: 0.5rem;
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
