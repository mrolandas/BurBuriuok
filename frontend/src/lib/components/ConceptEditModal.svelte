<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { onDestroy } from 'svelte';
	import {
		getAdminConcept,
		saveAdminConcept,
		adminConceptFormSchema,
		type AdminConceptResource,
		type AdminConceptStatus
	} from '$lib/api/admin/concepts';
	import type { ConceptDetail } from '$lib/api/concepts';
	import {
		conceptToInlineForm,
		inlineFormToPayload,
		resourceToConceptDetail,
		deriveConceptStatus,
		type InlineConceptForm
	} from '$lib/admin/conceptInlineEdit';
	import type { InlineFieldErrors } from '$lib/admin/inlineAdvancedSummary';

	type ConceptEditEvents = {
		close: void;
		saved: { concept: AdminConceptResource };
	};

	export let open = false;
	export let slug: string | null = null;
	export let label: string | null = null;

	const dispatch = createEventDispatcher<ConceptEditEvents>();

	let loading = false;
	let loadError: string | null = null;
	let inlineForm: InlineConceptForm = createEmptyInlineForm();
	let inlineErrors: InlineFieldErrors = {};
	let inlineErrorMessage: string | null = null;
	let inlineSaving = false;
	let inlineInitialSnapshot = computeInlineSnapshot(inlineForm);
	let inlineDirty = false;
	let conceptDetail: ConceptDetail | null = null;
	let displayLabel: string | null = null;
	let activeSlug: string | null = null;
	let currentStatus: AdminConceptStatus = 'draft';

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

	function getInlineError(field: keyof InlineConceptForm | string): string | null {
		const list = inlineErrors[field];
		return list && list.length ? list[0] : null;
	}

	const confirmDiscard = (): boolean => {
		if (!inlineDirty) {
			return true;
		}

		if (typeof window === 'undefined') {
			return true;
		}

		return window.confirm('Yra neišsaugotų pakeitimų. Ar tikrai uždaryti be išsaugojimo?');
	};

	const resetState = () => {
		loading = false;
		loadError = null;
		inlineForm = createEmptyInlineForm();
		inlineErrors = {};
		inlineErrorMessage = null;
		inlineSaving = false;
		inlineInitialSnapshot = computeInlineSnapshot(inlineForm);
		inlineDirty = false;
		conceptDetail = null;
		displayLabel = null;
		activeSlug = null;
		currentStatus = 'draft';
	};

	const resetValidation = () => {
		inlineErrors = {};
		inlineErrorMessage = null;
	};

	function handleClose(): void {
		if (inlineSaving) {
			return;
		}

		if (!confirmDiscard()) {
			return;
		}

		dispatch('close');
	}

	const handleBackdropClick = (event: MouseEvent): void => {
		if (event.currentTarget === event.target) {
			handleClose();
		}
	};

	const handleKeydown = (event: KeyboardEvent): void => {
		if (!open) {
			return;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			handleClose();
		}
	};

	function handleInlineInput(field: keyof InlineConceptForm): void {
		const current = inlineErrors[field];
		if (current && current.length) {
			inlineErrors = { ...inlineErrors, [field]: [] };
		}
		inlineErrorMessage = null;
	}

	function resetInlineForm(): void {
		if (!conceptDetail) {
			return;
		}
		inlineForm = conceptToInlineForm(conceptDetail);
		inlineInitialSnapshot = computeInlineSnapshot(inlineForm);
		inlineErrors = {};
		inlineErrorMessage = null;
	}

	async function loadConcept(targetSlug: string): Promise<void> {
		loading = true;
		loadError = null;
		resetValidation();
		inlineSaving = false;

		try {
			const resource = await getAdminConcept(targetSlug);
			if (!resource) {
				resetState();
				loadError = `Tema su žymeniu '${targetSlug}' nerasta.`;
				return;
			}

			const detail = resourceToConceptDetail(resource);
			conceptDetail = detail;
			inlineForm = conceptToInlineForm(detail);
			inlineInitialSnapshot = computeInlineSnapshot(inlineForm);
			inlineErrors = {};
			inlineErrorMessage = null;
			displayLabel = detail.termLt ?? label;
			activeSlug = resource.slug;
			currentStatus = deriveConceptStatus(detail.metadata ?? {});
		} catch (error) {
			resetState();
			loadError = error instanceof Error ? error.message : 'Nepavyko įkelti temos.';
		} finally {
			loading = false;
		}
	}

	async function handleSave(intent: 'draft' | 'publish'): Promise<void> {
		if (!conceptDetail) {
			return;
		}

		resetValidation();

		const overrides = intent === 'publish' ? { status: 'published' as AdminConceptStatus } : {};
		const payload = inlineFormToPayload(conceptDetail, inlineForm, overrides);
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

		try {
			inlineSaving = true;
			const saved = await saveAdminConcept(validation.data);
			const nextDetail = resourceToConceptDetail(saved);
			conceptDetail = nextDetail;
			inlineForm = conceptToInlineForm(nextDetail);
			inlineInitialSnapshot = computeInlineSnapshot(inlineForm);
			inlineErrors = {};
			inlineErrorMessage = null;
			displayLabel = nextDetail.termLt ?? label;
			currentStatus = deriveConceptStatus(nextDetail.metadata ?? {});
			dispatch('saved', { concept: saved });
			dispatch('close');
		} catch (error) {
			inlineErrorMessage =
				error instanceof Error ? error.message : 'Nepavyko išsaugoti pakeitimų.';
		} finally {
			inlineSaving = false;
		}
	}

	function submitDraft(event: SubmitEvent): void {
		event.preventDefault();
		inlineForm = { ...inlineForm, status: 'draft' };
		currentStatus = 'draft';
		void handleSave('draft');
	}

	const submitPublish = () => {
		inlineForm = { ...inlineForm, status: 'published' };
		currentStatus = 'published';
		void handleSave('publish');
	};

	$: inlineDirty = computeInlineSnapshot(inlineForm) !== inlineInitialSnapshot;
	$: displayLabel = inlineForm.termLt.trim().length ? inlineForm.termLt.trim() : label;
	$: if (open && slug) {
		if (!loading && (!activeSlug || slug !== activeSlug)) {
			void loadConcept(slug);
		}
	} else if (!open) {
		resetValidation();
		activeSlug = null;
		displayLabel = null;
	}

	onDestroy(() => {
		resetValidation();
	});
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
	<div class="concept-modal" role="presentation" on:click={handleBackdropClick}>
		<div
			class="concept-modal__dialog"
			role="dialog"
			aria-modal="true"
			aria-labelledby="concept-modal-title"
		>
			<header class="concept-modal__header">
				<div class="concept-modal__heading">
					<h2 id="concept-modal-title">Redaguoti temą</h2>
					{#if displayLabel}
						<p class="concept-modal__label">{displayLabel}</p>
					{:else if label}
						<p class="concept-modal__label">{label}</p>
					{/if}
					<span class="concept-modal__status-chip" data-status={currentStatus}>
						{currentStatus === 'published' ? 'Publikuota' : 'Juodraštis'}
					</span>
				</div>
				<button type="button" class="concept-modal__close" on:click={handleClose} aria-label="Uždaryti">
					✕
				</button>
			</header>

			{#if loading}
				<div class="concept-modal__body concept-modal__body--state">
					<p class="concept-modal__status">Įkeliama...</p>
				</div>
			{:else if loadError}
				<div class="concept-modal__body concept-modal__body--state">
					<p class="concept-modal__status concept-modal__status--error">{loadError}</p>
				</div>
			{:else}
				<form class="concept-modal__form concept-detail__admin-form" on:submit|preventDefault={submitDraft}>
					{#if inlineErrorMessage}
						<div class="concept-detail__admin-alert concept-detail__admin-alert--error">
							{inlineErrorMessage}
						</div>
					{/if}

					<div class="concept-detail__form-grid concept-detail__form-grid--basic">
						<label>
							<span>Sąvoka (LT) *</span>
							<input
								type="text"
								bind:value={inlineForm.termLt}
								on:input={() => handleInlineInput('termLt')}
								required
							/>
							{#if getInlineError('termLt')}
								<p class="concept-detail__field-error">{getInlineError('termLt')}</p>
							{/if}
						</label>

						<label>
							<span>Sąvoka (EN)</span>
							<input
								type="text"
								bind:value={inlineForm.termEn}
								on:input={() => handleInlineInput('termEn')}
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
								on:input={() => handleInlineInput('descriptionLt')}
								required
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
								on:input={() => handleInlineInput('descriptionEn')}
							></textarea>
							{#if getInlineError('descriptionEn')}
								<p class="concept-detail__field-error">{getInlineError('descriptionEn')}</p>
							{/if}
						</label>
					</div>

					<div class="concept-detail__admin-actions concept-modal__actions">
						<button
							type="submit"
							class="concept-detail__admin-button concept-detail__admin-button--primary"
							disabled={inlineSaving || !inlineDirty}
						>
							{inlineSaving ? 'Saugoma…' : 'Į juodraštį'}
						</button>
						<button
							type="button"
							class="concept-detail__admin-button concept-detail__admin-button--publish"
							on:click={submitPublish}
							disabled={inlineSaving || (!inlineDirty && currentStatus === 'published')}
						>
							Publikuoti
						</button>
						<button
							type="button"
							class="concept-detail__admin-button"
							on:click={resetInlineForm}
							disabled={inlineSaving || !inlineDirty}
						>
							Atmesti
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
{/if}

<style>
	.concept-modal {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: grid;
		place-items: center;
		padding: clamp(1rem, 4vw, 2.25rem);
		background: rgba(15, 23, 42, 0.6);
		backdrop-filter: blur(8px);
		z-index: 1000;
	}

	.concept-modal__dialog {
		width: min(560px, 100%);
		max-height: calc(100vh - clamp(2.5rem, 8vw, 4.5rem));
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		background: var(--color-surface-01, #fff);
		color: var(--color-text);
		border-radius: 1.1rem;
		border: 1px solid var(--color-border);
		box-shadow: 0 32px 60px -28px rgba(15, 23, 42, 0.45);
		overflow: hidden;
	}

	.concept-modal__header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		padding: 1.5rem 1.75rem 1.1rem;
		background: var(--color-surface-00, #fff);
	}

	.concept-modal__heading {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.concept-modal__heading h2 {
		margin: 0;
		font-size: 1.25rem;
	}

	.concept-modal__label {
		margin: 0;
		font-size: 0.95rem;
		color: var(--color-muted-text);
	}

	.concept-modal__status-chip {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.25rem 0.65rem;
		border-radius: 999px;
		border: 1px solid var(--color-border);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-muted-text);
	}

	.concept-modal__status-chip[data-status='published'] {
		border-color: var(--color-success-border, var(--color-accent));
		color: var(--color-success-text, var(--color-accent));
	}

	.concept-modal__close {
		border: 1px solid transparent;
		border-radius: 999px;
		background: transparent;
		color: var(--color-muted-text);
		cursor: pointer;
		font-size: 1.05rem;
		line-height: 1;
		padding: 0.35rem 0.65rem;
		transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
	}

	.concept-modal__close:hover,
	.concept-modal__close:focus-visible {
		border-color: var(--color-border);
		background: var(--color-surface-02, rgba(15, 23, 42, 0.08));
		color: var(--color-text);
	}

	.concept-modal__body {
		padding: 1.75rem;
	}

	.concept-modal__body--state {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1.75rem;
	}

	.concept-modal__status {
		margin: 0;
		font-size: 0.95rem;
		color: var(--color-muted-text);
	}

	.concept-modal__status--error {
		color: var(--color-status-error-text);
	}

	.concept-modal__form {
		padding: 0 1.75rem 1.75rem;
		display: grid;
		gap: 1.5rem;
	}

	.concept-modal__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		justify-content: flex-end;
	}

	.concept-detail__admin-form {
		display: grid;
		gap: 1.5rem;
	}

	.concept-detail__admin-alert {
		padding: 0.85rem 1rem;
		border-radius: 0.75rem;
		font-size: 0.9rem;
		margin: 0;
	}

	.concept-detail__admin-alert--error {
		background: var(--color-status-error-surface);
		color: var(--color-status-error-text);
		border: 1px solid var(--color-status-error-border);
	}

	.concept-detail__form-grid {
		display: grid;
		gap: 1rem;
	}

	.concept-detail__form-grid--basic {
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	}

	.concept-detail__form-grid--full {
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
	}

	.concept-detail__form-grid label {
		display: grid;
		gap: 0.45rem;
		font-size: 0.85rem;
	}

	.concept-detail__form-grid label > span:first-child {
		color: var(--color-muted-text);
	}

	.concept-detail__form-grid input,
	.concept-detail__form-grid textarea {
		width: 100%;
		padding: 0.6rem 0.75rem;
		border-radius: 0.7rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface-00, #fff);
		font-size: 0.95rem;
		color: var(--color-text);
		transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
	}

	.concept-detail__form-grid input:hover,
	.concept-detail__form-grid textarea:hover {
		border-color: var(--color-border-strong, var(--color-border));
	}

	.concept-detail__form-grid input:focus-visible,
	.concept-detail__form-grid textarea:focus-visible {
		outline: none;
		border-color: var(--color-accent);
		box-shadow: 0 0 0 2px rgba(94, 234, 212, 0.25);
		background: var(--color-surface-01, #fff);
	}

	.concept-detail__form-grid textarea {
		min-height: 9rem;
		resize: vertical;
	}

	.concept-detail__field-error {
		margin: 0;
		font-size: 0.8rem;
		color: var(--color-status-error-text);
	}

	.concept-detail__admin-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		justify-content: flex-end;
	}

	.concept-detail__admin-button {
		border-radius: 999px;
		border: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-text);
		font-size: 0.9rem;
		font-weight: 600;
		padding: 0.5rem 1.2rem;
		cursor: pointer;
		transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
	}

	.concept-detail__admin-button:hover,
	.concept-detail__admin-button:focus-visible {
		border-color: var(--color-accent);
		background: rgba(94, 234, 212, 0.16);
	}

	.concept-detail__admin-button:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.concept-detail__admin-button--primary {
		background: var(--color-accent);
		border-color: var(--color-accent);
		color: rgba(14, 23, 42, 0.95);
	}

	.concept-detail__admin-button--publish {
		border-color: var(--color-accent);
		color: var(--color-accent);
		background: rgba(94, 234, 212, 0.08);
	}
</style>
