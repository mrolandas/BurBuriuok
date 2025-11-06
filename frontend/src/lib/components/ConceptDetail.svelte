<script lang="ts">
	import ConceptDisplay from '$lib/components/ConceptDisplay.svelte';
	import type { ConceptDetail as ConceptDetailData } from '$lib/api/concepts';
	import type { CurriculumItem } from '$lib/api/curriculum';
	import { createEventDispatcher } from 'svelte';

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

	const conceptActionState: Record<string, { learning: boolean; known: boolean }> = {};

	type Props = {
		concept: ConceptDetailData;
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

	$effect(() => {
		const currentId = concept?.id;
		const stored = currentId ? conceptActionState[currentId] : null;
		learningChecked = stored?.learning ?? false;
		knownChecked = stored?.known ?? false;
		lastAction = 'idle';
		actionMessage = '';
	});
</script>

{#snippet conceptActions()}
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
{/snippet}

<ConceptDisplay
	{concept}
	{breadcrumbs}
	{peerItems}
	{neighbors}
	actions={conceptActions}
/>

<style>
	.concept-detail__actions-panel {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		border: 1px dashed var(--color-border-light);
		padding: 1rem;
		border-radius: 0.8rem;
		background: var(--color-panel-secondary);
	}

	.concept-detail__action-option {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		font-weight: 600;
	}

	.concept-detail__action-option input[type='checkbox'] {
		width: 1.1rem;
		height: 1.1rem;
	}

	.concept-detail__actions-feedback {
		margin: 0;
		font-size: 0.95rem;
		color: var(--color-text-subtle);
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
