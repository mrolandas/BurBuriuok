<script lang="ts">
	import { goto } from '$app/navigation';
	import ConceptDisplay from '$lib/components/ConceptDisplay.svelte';
	import type { ConceptDetail as ConceptDetailData } from '$lib/api/concepts';
	import type { CurriculumItem } from '$lib/api/curriculum';
	import {
		saveAdminConcept,
		adminConceptFormSchema,
		type AdminConceptStatus
	} from '$lib/api/admin/concepts';
	import type { ConceptAdminEditContext } from '$lib/admin/session';
	import {
		conceptToInlineForm,
		deriveConceptStatus,
		inlineFormToPayload,
		resourceToConceptDetail,
		type InlineConceptForm
	} from '$lib/admin/conceptInlineEdit';
	import { type InlineFieldErrors } from '$lib/admin/inlineAdvancedSummary';
	import { page } from '$app/stores';
	import { createEventDispatcher, onDestroy } from 'svelte';

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
		adminContext?: ConceptAdminEditContext;
	};

	let { concept, breadcrumbs = [], peerItems = [], neighbors, adminContext }: Props = $props();
	const adminEditEnabled = $derived(Boolean(adminContext?.enabled));
	const adminSessionError = $derived(adminContext?.session.errorMessage ?? null);
	const adminHasAccess = $derived(Boolean(adminContext?.session.allowed));

	type ActionStatus = 'idle' | 'learning' | 'known' | 'reset';
	const dispatch = createEventDispatcher<{
		setLearning: { conceptId: string; learning: boolean };
		setKnown: { conceptId: string; known: boolean };
	}>();

	const descriptionLt = $derived(concept?.descriptionLt?.trim() ?? '');
	const descriptionEn = $derived(concept?.descriptionEn?.trim() ?? '');
	const initialInlineForm = concept ? conceptToInlineForm(concept) : createEmptyInlineForm();
	const conceptStatus = $derived(
		concept ? deriveConceptStatus(concept.metadata ?? {}) : ('draft' satisfies AdminConceptStatus)
	);

	let inlineForm = $state<InlineConceptForm>(initialInlineForm);
	let inlineErrors = $state<InlineFieldErrors>({});
	let inlineErrorMessage = $state<string | null>(null);
	let inlineSuccessMessage = $state<string | null>(null);
	let inlineSaving = $state(false);
	let inlineInitialSnapshot = $state(computeInlineSnapshot(initialInlineForm));
	let lastConceptKey: string | null = concept ? buildConceptKey(concept) : null;
	let lastConceptId: string | null = concept?.id ?? null;

	const inlineDirty = $derived(computeInlineSnapshot(inlineForm) !== inlineInitialSnapshot);


	let currentUrl = $state($page.url);
	const unsubscribePage = page.subscribe(({ url }) => {
		currentUrl = url;
	});
	onDestroy(() => {
		unsubscribePage();
	});

	function createEmptyInlineForm(): InlineConceptForm {
		return {
			termLt: '',
			termEn: '',
			descriptionLt: '',
			descriptionEn: '',
			sourceRef: '',
			sectionCode: '',
			sectionTitle: '',
			subsectionCode: '',
			subsectionTitle: '',
			curriculumNodeCode: '',
			curriculumItemOrdinal: '',
			curriculumItemLabel: '',
			status: 'draft',
			isRequired: true
		};
	}

	function computeInlineSnapshot(form: InlineConceptForm): string {
		return JSON.stringify(form);
	}

	function buildConceptKey(entry: ConceptDetailData): string {
		return [
			entry.id,
			entry.updatedAt ?? '',
			entry.termLt ?? '',
			entry.termEn ?? ''
		].join('|');
	}

	const conceptKey = $derived(concept ? buildConceptKey(concept) : null);

	$effect(() => {
		const key = conceptKey;
		if (key === lastConceptKey) {
			return;
		}

		lastConceptKey = key;

		if (!concept) {
			inlineForm = createEmptyInlineForm();
			inlineInitialSnapshot = computeInlineSnapshot(inlineForm);
			inlineErrors = {};
			inlineErrorMessage = null;
			inlineSuccessMessage = null;
			lastConceptId = null;
			return;
		}

		inlineForm = conceptToInlineForm(concept);
		inlineInitialSnapshot = computeInlineSnapshot(inlineForm);
		inlineErrors = {};
		inlineErrorMessage = null;
		if (concept.id !== lastConceptId) {
			inlineSuccessMessage = null;
		}
		lastConceptId = concept.id;
	});


	const getInlineError = (field: string): string | null => {
		const list = inlineErrors[field];
		return list && list.length ? list[0] : null;
	};

	function handleInlineInput(field: keyof InlineConceptForm): void {
		const current = inlineErrors[field];
		if (current && current.length) {
			inlineErrors = { ...inlineErrors, [field]: [] };
		}
		inlineErrorMessage = null;
		inlineSuccessMessage = null;
	}

	function resetInlineForm(): void {
		if (!concept) {
			return;
		}
		inlineForm = conceptToInlineForm(concept);
		inlineInitialSnapshot = computeInlineSnapshot(inlineForm);
		inlineErrors = {};
		inlineErrorMessage = null;
		inlineSuccessMessage = null;
	}

	async function handleInlineSave(intent: 'draft' | 'publish'): Promise<void> {
		if (!concept) {
			return;
		}

		inlineErrorMessage = null;
		inlineSuccessMessage = null;

		const overrides = intent === 'publish' ? { status: 'published' as AdminConceptStatus } : {};
		const payload = inlineFormToPayload(concept, inlineForm, overrides);
		const validation = adminConceptFormSchema.safeParse(payload);

		if (!validation.success) {
			const flattened = validation.error.flatten();
			inlineErrors = flattened.fieldErrors as InlineFieldErrors;
			const general = flattened.formErrors.filter(Boolean);
			inlineErrorMessage = general.length
				? general.join(' ')
				: 'Patikrinkite pažymėtus laukus.';
			return;
		}

		inlineErrors = {};

		try {
			inlineSaving = true;
			const saved = await saveAdminConcept(validation.data);
			const nextConcept = resourceToConceptDetail(saved);
			concept = nextConcept;
			inlineForm = conceptToInlineForm(nextConcept);
			inlineInitialSnapshot = computeInlineSnapshot(inlineForm);
			lastConceptKey = buildConceptKey(nextConcept);
			lastConceptId = nextConcept.id;
			inlineSuccessMessage = intent === 'publish' ? 'Tema publikuota.' : 'Pakeitimai išsaugoti.';
		} catch (error) {
			inlineErrorMessage =
				error instanceof Error ? error.message : 'Nepavyko išsaugoti pakeitimų.';
		} finally {
			inlineSaving = false;
		}
	}

	function submitInlineDraft(event: SubmitEvent): void {
		event.preventDefault();
		void handleInlineSave('draft');
	}

	async function setAdminMode(enabled: boolean): Promise<void> {
		if (enabled === adminEditEnabled) {
			return;
		}

		const url = new URL(currentUrl.href);
		if (enabled) {
			url.searchParams.set('admin', '1');
		} else {
			url.searchParams.delete('admin');
		}

		await goto(`${url.pathname}${url.search}${url.hash}`, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

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

{#snippet conceptMeta()}
	{#if adminContext?.requested || adminHasAccess}
		<div class="concept-detail__admin-section">
			<div
				class="concept-detail__admin-meta"
				data-admin-state={adminEditEnabled
					? 'enabled'
					: adminContext?.requested
					? 'denied'
					: 'available'}
			>

				{#if adminHasAccess}
					<button
						type="button"
						class="concept-detail__admin-toggle"
						onclick={() => void setAdminMode(!adminEditEnabled)}
						disabled={inlineSaving}
					>
						{adminEditEnabled ? 'Baigti redagavimą' : 'Redaguoti'}
					</button>
				{/if}

				{#if adminContext?.requested && !adminEditEnabled}
					<p class="concept-detail__admin-message">
						{adminSessionError ?? 'Administratoriaus režimo įjungti nepavyko.'}
					</p>
				{/if}
			</div>
		</div>
	{/if}
{/snippet}

{#snippet conceptContent()}
	{#if adminEditEnabled}
		<form class="concept-detail__admin-form" onsubmit={submitInlineDraft} novalidate>
			{#if inlineErrorMessage}
				<div class="concept-detail__admin-alert concept-detail__admin-alert--error">
					{inlineErrorMessage}
				</div>
			{/if}
			{#if inlineSuccessMessage}
				<div class="concept-detail__admin-alert concept-detail__admin-alert--success">
					{inlineSuccessMessage}
				</div>
			{/if}

			<div class="concept-detail__form-grid concept-detail__form-grid--basic">
				<label>
					<span>Terminas (LT) *</span>
					<input
						type="text"
						bind:value={inlineForm.termLt}
						oninput={() => handleInlineInput('termLt')}
					/>
					{#if getInlineError('termLt')}
						<p class="concept-detail__field-error">{getInlineError('termLt')}</p>
					{/if}
				</label>

				<label>
					<span>Terminas (EN)</span>
					<input
						type="text"
						bind:value={inlineForm.termEn}
						oninput={() => handleInlineInput('termEn')}
					/>
					{#if getInlineError('termEn')}
						<p class="concept-detail__field-error">{getInlineError('termEn')}</p>
					{/if}
				</label>
			</div>

			<div class="concept-detail__form-grid concept-detail__form-grid--full">
				<label>
					<span>Aprašymas (LT) *</span>
					<textarea
						rows="6"
						bind:value={inlineForm.descriptionLt}
						oninput={() => handleInlineInput('descriptionLt')}
					></textarea>
					{#if getInlineError('descriptionLt')}
						<p class="concept-detail__field-error">{getInlineError('descriptionLt')}</p>
					{/if}
				</label>

				<label>
					<span>Aprašymas (EN)</span>
					<textarea
						rows="6"
						bind:value={inlineForm.descriptionEn}
						oninput={() => handleInlineInput('descriptionEn')}
					></textarea>
					{#if getInlineError('descriptionEn')}
						<p class="concept-detail__field-error">{getInlineError('descriptionEn')}</p>
					{/if}
				</label>
			</div>

			<div class="concept-detail__admin-actions">
				<button
					type="submit"
					class="concept-detail__admin-button concept-detail__admin-button--primary"
					disabled={inlineSaving || !inlineDirty}
				>
					{inlineSaving ? 'Saugoma…' : 'Išsaugoti juodraštį'}
				</button>
				<button
					type="button"
					class="concept-detail__admin-button concept-detail__admin-button--publish"
					onclick={() => void handleInlineSave('publish')}
					disabled={inlineSaving || (!inlineDirty && conceptStatus === 'published')}
				>
					Publikuoti
				</button>
				<button
					type="button"
					class="concept-detail__admin-button"
					onclick={resetInlineForm}
					disabled={inlineSaving || !inlineDirty}
				>
					Atstatyti
				</button>
			</div>
		</form>
	{:else}
		{#if descriptionLt}
			<p>{descriptionLt}</p>
		{:else}
			<p>
				Apibrėžimas šiai temai dar nepateiktas. Papildysime turinį, kai tik jis bus paruoštas
				recenzijai.
			</p>
		{/if}

		{@render conceptActions()}

		{#if descriptionEn}
			<div class="concept-detail__translation">
				<h3>Anglų kalbos užuomina</h3>
				<p>{descriptionEn}</p>
			</div>
		{/if}
	{/if}
{/snippet}

{#snippet conceptActions()}
	<section
		class="concept-detail__actions-panel"
		aria-label="Veiksmai"
		data-last-action={lastAction}
		data-admin-mode={adminEditEnabled ? 'enabled' : 'disabled'}
	>
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
	meta={conceptMeta}
	actions={conceptActions}
	content={conceptContent}
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

	.concept-detail__admin-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
	}

	.concept-detail__admin-message {
		flex-basis: 100%;
		margin: 0;
		font-size: 0.82rem;
		color: #b3474d;
		font-weight: 600;
	}

	.concept-detail__admin-section {
		display: grid;
		gap: 0.75rem;
	}

	.concept-detail__admin-toggle {
		border: 1px solid var(--color-border);
		background: var(--color-panel);
		padding: 0.35rem 0.9rem;
		border-radius: 999px;
		font-size: 0.82rem;
		cursor: pointer;
		transition: background 0.2s ease, border-color 0.2s ease;
	}

	.concept-detail__admin-toggle:hover,
	.concept-detail__admin-toggle:focus-visible {
		border-color: var(--color-border-strong);
		background: var(--color-panel-hover);
	}

	.concept-detail__admin-form {
		display: grid;
		gap: 1.5rem;
		margin-top: 0.75rem;
		padding: 1.25rem;
		border-radius: 1.1rem;
		border: 1px solid var(--color-border-light);
		background: var(--color-panel);
		box-shadow: 0 18px 36px -18px var(--color-overlay);
	}

	.concept-detail__admin-form > .concept-detail__form-grid {
		padding: 1rem;
		border-radius: 1rem;
		border: 1px solid var(--color-border-light);
		background: var(--color-panel-secondary);
		box-shadow: 0 12px 28px -22px var(--color-overlay);
	}

	.concept-detail__admin-alert {
		padding: 0.75rem 1rem;
		border-radius: 0.6rem;
		font-size: 0.9rem;
	}

	.concept-detail__admin-alert--error {
		background: rgba(217, 65, 65, 0.12);
		border: 1px solid rgba(217, 65, 65, 0.3);
		color: #922f2f;
	}

	.concept-detail__admin-alert--success {
		background: rgba(46, 160, 67, 0.12);
		border: 1px solid rgba(46, 160, 67, 0.25);
		color: #256c3f;
	}

	.concept-detail__form-grid {
		display: grid;
		gap: 1rem;
	}

	.concept-detail__form-grid--basic {
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	}

	.concept-detail__form-grid--full {
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
	}

	.concept-detail__form-grid label {
		display: grid;
		gap: 0.45rem;
		font-size: 0.85rem;
	}

	.concept-detail__form-grid label > span:first-child {
		font-weight: 600;
		color: var(--color-text-subtle);
	}

	.concept-detail__form-grid input,
	.concept-detail__form-grid textarea {
		width: 100%;
		border: 1px solid var(--color-border-light);
		border-radius: 0.65rem;
		padding: 0.65rem 0.85rem;
		font: inherit;
		background: var(--color-panel);
		color: inherit;
		transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
		box-shadow: 0 0 0 0 transparent;
	}

	.concept-detail__form-grid input:hover,
	.concept-detail__form-grid textarea:hover {
		border-color: var(--color-border);
		background: var(--color-panel-hover);
	}

	.concept-detail__form-grid input:focus-visible,
	.concept-detail__form-grid textarea:focus-visible {
		outline: none;
		border-color: var(--color-accent-strong);
		background: var(--color-popover);
		box-shadow: 0 0 0 2px var(--color-accent-faint-strong);
	}

	.concept-detail__form-grid textarea {
		min-height: 9rem;
		resize: vertical;
	}

	.concept-detail__field-error {
		margin: 0;
		font-size: 0.8rem;
		color: #b3474d;
	}

	.concept-detail__admin-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		align-items: center;
	}

	.concept-detail__admin-button {
		border: 1px solid var(--color-border-light);
		background: var(--color-panel-secondary);
		border-radius: 0.65rem;
		padding: 0.6rem 1rem;
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
		transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
	}

	.concept-detail__admin-button:hover,
	.concept-detail__admin-button:focus-visible {
		border-color: var(--color-border);
		background: var(--color-panel-hover);
		box-shadow: 0 0 0 2px var(--color-accent-faint-strong);
	}

	.concept-detail__admin-button--primary {
		background: var(--color-panel);
		border-color: var(--color-border);
	}

	.concept-detail__admin-button--publish {
		background: var(--color-accent-faint);
		border-color: var(--color-accent-border-strong);
		color: var(--color-accent-strong);
	}

	.concept-detail__admin-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	@media (max-width: 640px) {
		.concept-detail__admin-form {
			padding: 1rem;
		}

		.concept-detail__admin-form > .concept-detail__form-grid {
			padding: 0.75rem;
		}

		.concept-detail__actions-panel {
			gap: 0.55rem;
		}

		.concept-detail__action-option {
			font-size: 0.88rem;
		}
	}
</style>
