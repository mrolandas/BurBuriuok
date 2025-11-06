<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ConceptDetail } from '$lib/api/concepts';
	import type { CurriculumItem } from '$lib/api/curriculum';
	import { createEventDispatcher } from 'svelte';
	import { quizModal } from '$lib/stores/quizModal';

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
		startSectionQuiz: { conceptId: string; sectionCode?: string };
	}>();

	let learningChecked = $state(false);
	let knownChecked = $state(false);
	let lastAction = $state<ActionStatus>('idle');
	let actionMessage = $state('');

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

	const handleStartQuiz = () => {
		if (!concept?.id) {
			return;
		}

		quizModal.open({ conceptId: concept.id, sectionCode: concept.sectionCode });
		dispatch('startSectionQuiz', { conceptId: concept.id, sectionCode: concept.sectionCode });
	};

	const boardHref = resolve('/');

	const description = $derived(concept.descriptionLt?.trim() ?? '');

	$effect(() => {
		const currentId = concept?.id;
		const stored = currentId ? conceptActionState[currentId] : null;
		learningChecked = stored?.learning ?? false;
		knownChecked = stored?.known ?? false;
		lastAction = 'idle';
		actionMessage = '';
	});
</script>

<section class="concept-detail">
	<nav class="concept-detail__breadcrumbs" aria-label="Navigacija">
		<a class="concept-detail__crumb" href={boardHref}>Skilčių lenta</a>
		{#each breadcrumbs as crumb (crumb.label)}
			<span class="concept-detail__crumb-separator" aria-hidden="true">›</span>
			{#if crumb.routeId && crumb.params}
				<a class="concept-detail__crumb" href={resolve(crumb.routeId, crumb.params)}
					>{crumb.label}</a
				>
			{:else}
				<span class="concept-detail__crumb concept-detail__crumb--static">{crumb.label}</span>
			{/if}
		{/each}
	</nav>

	<header class="concept-detail__header">
		<h1 class="concept-detail__title">{concept.termLt}</h1>
		{#if concept.termEn}
			<p class="concept-detail__subtitle">{concept.termEn}</p>
		{/if}
	</header>

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

	<div class="concept-detail__layout">
		<article class="concept-detail__content">
			<h2 class="concept-detail__section-title">Apibrėžimas</h2>
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
		</article>

		<aside class="concept-detail__sidebar">
			<section class="concept-detail__panel concept-detail__panel--actions" aria-label="Veiksmai">
				<div class="concept-detail__actions" data-last-action={lastAction}>
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
				</div>
				<button type="button" class="concept-detail__quiz-button" onclick={handleStartQuiz}>
					Pasitikrinti žinias
				</button>
				{#if actionMessage}
					<p class="concept-detail__actions-feedback" role="status" aria-live="polite">
						{actionMessage}
					</p>
				{/if}
			</section>

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
		flex-wrap: wrap;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.85rem;
		color: var(--color-breadcrumb);
	}

	.concept-detail__crumb {
		color: inherit;
		text-decoration: none;
		border-bottom: 1px solid transparent;
		transition: border-color 0.2s ease;
	}

	.concept-detail__crumb:hover,
	.concept-detail__crumb:focus-visible {
		border-color: currentColor;
	}

	.concept-detail__crumb--static {
		opacity: 0.8;
	}

	.concept-detail__header {
		display: grid;
		gap: 0.3rem;
	}

	.concept-detail__pager {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.6rem;
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

	.concept-detail__title {
		margin: 0;
		font-size: clamp(1.6rem, 4vw, 2.3rem);
		line-height: 1.1;
	}

	.concept-detail__subtitle {
		margin: 0;
		color: var(--color-text-soft);
		font-size: clamp(1rem, 2.8vw, 1.2rem);
	}

	.concept-detail__layout {
		display: grid;
		gap: clamp(1.5rem, 3vw, 2.5rem);
	}

	.concept-detail__content {
		display: grid;
		gap: 1.4rem;
		border-radius: 1.2rem;
		padding: clamp(1.5rem, 3vw, 2rem);
		border: 1px solid var(--color-border);
		background: var(--color-panel);
	}

	.concept-detail__section-title {
		margin: 0;
		font-size: clamp(1.1rem, 3vw, 1.4rem);
	}

	.concept-detail__content p {
		margin: 0;
		line-height: 1.7;
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

	.concept-detail__panel--actions {
		gap: 0.75rem;
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

	.concept-detail__actions {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.concept-detail__action-option {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.75rem;
		border: 1px solid var(--color-pill-border);
		background: var(--color-pill-bg);
		color: var(--color-pill-text);
		font-weight: 600;
		cursor: pointer;
		user-select: none;
		transition:
			border-color 0.2s ease,
			background 0.2s ease,
			color 0.2s ease;
		flex: 1 1 9rem;
		justify-content: center;
	}

	.concept-detail__action-option:hover,
	.concept-detail__action-option:focus-within {
		border-color: var(--color-pill-hover-border);
		background: var(--color-pill-hover-bg);
		color: var(--color-text);
	}

	.concept-detail__quiz-button {
		margin-top: 0.35rem;
		align-self: flex-start;
		padding: 0.55rem 0.9rem;
		border-radius: 0.75rem;
		border: 1px solid var(--color-accent-border);
		background: var(--color-accent-faint);
		color: var(--color-pill-text);
		font-weight: 600;
		cursor: pointer;
		transition:
			border-color 0.2s ease,
			background 0.2s ease,
			color 0.2s ease;
	}

	.concept-detail__quiz-button:hover,
	.concept-detail__quiz-button:focus-visible {
		border-color: var(--color-accent-border-strong);
		background: var(--color-accent-faint-strong);
		color: var(--color-text);
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
		margin-top: 0.6rem;
		font-size: 0.85rem;
		color: var(--color-link-subtle);
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
			grid-template-columns: minmax(0, 3fr) minmax(0, 1.4fr);
		}
	}

	@media (max-width: 640px) {
		.concept-detail__actions {
			gap: 0.45rem;
		}

		.concept-detail__action-option {
			font-size: 0.85rem;
			padding: 0.45rem 0.65rem;
		}

		.concept-detail__quiz-button {
			width: 100%;
			text-align: center;
		}
	}
</style>
