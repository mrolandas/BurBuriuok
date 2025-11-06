<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ConceptDetail } from '$lib/api/concepts';
	import type { CurriculumItem } from '$lib/api/curriculum';
	import { createEventDispatcher } from 'svelte';

	const conceptActionState: Record<string, { learning: boolean; known: boolean }> = {};

	type Breadcrumb = {
		label: string;
		routeId?: '/sections/[code]';
		params?: { code: string };
	};

	type NeighborLink = {
		label: string;
		slug: string;
		ordinal: number | null;
	};

	type NeighborSet = {
		previous?: NeighborLink | null;
		next?: NeighborLink | null;
	};

	type Props = {
		concept: ConceptDetail;
		breadcrumbs?: Breadcrumb[];
		peerItems?: CurriculumItem[];
		neighbors?: NeighborSet;
	};

	let { concept, breadcrumbs = [], peerItems = [], neighbors }: Props = $props();

	type ActionStatus = 'idle' | 'learning' | 'known' | 'reset';

	const dispatch = createEventDispatcher<{
		setLearning: { conceptId: string; learning: boolean };
		setKnown: { conceptId: string; known: boolean };
	}>();

	let learningChecked = $state(false);
	let knownChecked = $state(false);
	let lastAction = $state<ActionStatus>('idle');
	let actionMessage = $state('');
	let showAllBreadcrumbs = $state(false);

	const getMessageForAction = (action: ActionStatus) => {
		if (!concept?.id) {
			return '';
		}

		switch (action) {
			case 'learning':
				return 'Pažymėta kaip „mokausi“ – ši tema liks mokymosi sąraše.';
			case 'known':
				return 'Pažymėta kaip „moku“ – perkelsime į pasiruošimo patikros eilę.';
			case 'reset':
				return 'Tema grąžinta į „nežinau“ būseną.';
			default:
				return '';
		}
	};

	const setLastAction = (action: ActionStatus) => {
		lastAction = action;
		actionMessage = getMessageForAction(action);
	};

	const persistActionState = () => {
		if (!concept?.id) {
			return;
		}

		conceptActionState[concept.id] = {
			learning: learningChecked,
			known: knownChecked
		};
	};

	const markLearning = (value: boolean) => {
		if (!concept?.id) {
			return;
		}

		learningChecked = value;
		if (value) {
			knownChecked = false;
			setLastAction('learning');
		} else if (!knownChecked) {
			setLastAction('reset');
		} else {
			setLastAction('known');
		}
		dispatch('setLearning', { conceptId: concept.id, learning: value });
		persistActionState();
	};

	const markKnown = (value: boolean) => {
		if (!concept?.id) {
			return;
		}

		knownChecked = value;
		if (value) {
			learningChecked = false;
			setLastAction('known');
		} else if (!learningChecked) {
			setLastAction('reset');
		} else {
			setLastAction('learning');
		}
		dispatch('setKnown', { conceptId: concept.id, known: value });
		persistActionState();
	};

	const handleLearningChange = (event: Event) => {
		const target = event.currentTarget as HTMLInputElement | null;
		markLearning(Boolean(target?.checked));
	};

	const handleKnownChange = (event: Event) => {
		const target = event.currentTarget as HTMLInputElement | null;
		markKnown(Boolean(target?.checked));
	};

	const boardHref = resolve('/');

	const description = $derived(concept.descriptionLt?.trim() ?? '');

	const visibleBreadcrumbs = $derived(
		showAllBreadcrumbs || breadcrumbs.length <= 2
			? breadcrumbs
			: breadcrumbs.slice(-2)
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
		const currentId = concept?.id;
		const stored = currentId ? conceptActionState[currentId] : null;
		learningChecked = stored?.learning ?? false;
		knownChecked = stored?.known ?? false;
		lastAction = 'idle';
		actionMessage = '';
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
			<span class="concept-detail__crumb concept-detail__crumb--static concept-detail__crumb--ellipsis" aria-hidden="true">
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

			{#if description}
				<p>{description}</p>
			{:else}
				<p>
					Apibrėžimas šiai temai dar nepateiktas. Papildysime turinį, kai tik jis bus paruoštas
					recenzijai.
				</p>
			{/if}

			<section class="concept-detail__actions-panel" aria-label="Veiksmai" data-last-action={lastAction}>
				<label class="concept-detail__action-option">
					<input
						type="checkbox"
						checked={learningChecked}
						onchange={handleLearningChange}
						aria-label="Pažymėti temą kaip mokausi"
					/>
					<span>Mokausi</span>
				</label>
				<label class="concept-detail__action-option">
					<input
						type="checkbox"
						checked={knownChecked}
						onchange={handleKnownChange}
						aria-label="Pažymėti temą kaip moku"
					/>
					<span>Moku</span>
				</label>
			</section>

			{#if actionMessage}
				<p class="concept-detail__actions-feedback" role="status" aria-live="polite">
					{actionMessage}
				</p>
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

	.concept-detail__title {
		margin: 0;
		font-size: clamp(1.6rem, 4vw, 2.3rem);
		line-height: 1.1;
	}

	.concept-detail__subtitle {
		margin-left: 0.4rem;
		color: var(--color-text-soft);
		font-size: clamp(1rem, 2.8vw, 1.2rem);
		font-weight: 500;
	}

	.concept-detail__content p {
		margin: 0;
		line-height: 1.7;
	}

	.concept-detail__actions-panel {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: 0.75rem;
		align-items: stretch;
	}

	.concept-detail__action-option {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.35rem 0.6rem;
		border-radius: 0.6rem;
		border: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-text);
		font-weight: 600;
		cursor: pointer;
		user-select: none;
		transition:
			border-color 0.2s ease,
			background 0.2s ease,
			color 0.2s ease;
	}

	.concept-detail__action-option:hover,
	.concept-detail__action-option:focus-within {
		border-color: var(--color-pill-hover-border);
		background: var(--color-pill-bg);
	}

	.concept-detail__action-option input {
		appearance: none;
		width: 1.05rem;
		height: 1.05rem;
		border-radius: 0.3rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface-alt);
		position: relative;
	}

	.concept-detail__action-option input:checked {
		border-color: var(--color-accent-border-strong);
		background: var(--color-accent-faint-strong);
	}

	.concept-detail__action-option input:checked::after {
		content: '✔';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -58%);
		font-size: 0.75rem;
		color: var(--color-text);
	}

	.concept-detail__actions-feedback {
		margin: 0;
		margin-top: 0.55rem;
		font-size: 0.85rem;
		color: var(--color-link-subtle);
	}

	.concept-detail__translation {
		display: grid;
		gap: 0.5rem;
		padding: 1rem;
		border-radius: 1rem;
		background: var(--color-accent-faint);
		border: 1px solid var(--color-accent-border);
	}

	.concept-detail__translation h3 {
		margin: 0;
		font-size: 0.85rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-text-soft);
	}

	.concept-detail__pager {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.6rem;
		align-self: flex-start;
	}

	.concept-detail__pager-link {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.35rem 0.6rem;
		border-radius: 0.75rem;
		background: var(--color-pill-bg);
		border: 1px solid var(--color-pill-border);
		color: var(--color-pill-text);
		text-decoration: none;
		font-size: 0.85rem;
		transition:
			border-color 0.2s ease,
			background 0.2s ease,
			color 0.2s ease;
	}

	.concept-detail__pager-link:hover,
	.concept-detail__pager-link:focus-visible {
		border-color: var(--color-pill-hover-border);
		background: var(--color-pill-hover-bg);
		color: var(--color-text);
	}

	.concept-detail__pager-link--next {
		margin-left: auto;
	}

	.concept-detail__pager-label {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
	}

	.concept-detail__sidebar {
		display: grid;
		gap: 1rem;
	}

	.concept-detail__panel {
		display: grid;
		gap: 0.6rem;
		padding: 1.1rem 1.25rem;
		border-radius: 1rem;
		border: 1px dashed var(--color-border);
		background: var(--color-panel-soft);
	}

	.concept-detail__panel h2 {
		margin: 0;
		font-size: clamp(1rem, 2.5vw, 1.2rem);
	}

	.concept-detail__panel p {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.6;
	}

	.concept-detail__panel--list ul {
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.45rem;
		list-style: none;
	}

	.concept-detail__panel--list li a {
		color: var(--color-link-subtle);
		text-decoration: none;
		font-weight: 600;
	}

	.concept-detail__panel--list li a:hover,
	.concept-detail__panel--list li a:focus-visible {
		text-decoration: underline;
		color: var(--color-link-subtle-hover);
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
		.concept-detail__actions-panel {
			gap: 0.55rem;
		}

		.concept-detail__action-option {
			font-size: 0.88rem;
		}
	}
</style>
