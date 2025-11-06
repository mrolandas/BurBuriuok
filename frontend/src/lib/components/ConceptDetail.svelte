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
		collectMetadataBadges,
		conceptToInlineForm,
		deriveConceptStatus,
		inlineFormToPayload,
		resourceToConceptDetail,
		type InlineConceptForm,
		type MetadataBadge
	} from '$lib/admin/conceptInlineEdit';
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
	const adminImpersonating = $derived(Boolean(adminContext?.session.impersonating));

	type ActionStatus = 'idle' | 'learning' | 'known' | 'reset';
	type InlineFieldErrors = Record<string, string[]>;

	const dispatch = createEventDispatcher<{
		setLearning: { conceptId: string; learning: boolean };
		setKnown: { conceptId: string; known: boolean };
	}>();

	const statusLabels: Record<AdminConceptStatus, string> = {
		draft: 'Juodraštis',
		published: 'Publikuota'
	};
	const statusOptions: AdminConceptStatus[] = ['draft', 'published'];

	const metadataBadges = $derived(
		concept ? collectMetadataBadges(concept.metadata ?? null) : ([] as MetadataBadge[])
	);
	const adminBadges = $derived(
		concept?.sourceRef
			? ([...metadataBadges, { key: 'Šaltinis', value: concept.sourceRef } as MetadataBadge] as MetadataBadge[])
			: metadataBadges
	);
	const descriptionLt = $derived(concept?.descriptionLt?.trim() ?? '');
	const descriptionEn = $derived(concept?.descriptionEn?.trim() ?? '');
	const initialInlineForm = concept ? conceptToInlineForm(concept) : createEmptyInlineForm();
	const conceptStatus = $derived(
		concept ? deriveConceptStatus(concept.metadata ?? {}) : ('draft' satisfies AdminConceptStatus)
	);

	let adminEditing = $state(false);
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

	$effect(() => {
		if (!adminEditEnabled && adminEditing) {
			adminEditing = false;
		}
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
				{#if adminEditEnabled}
					<span class="concept-detail__admin-pill concept-detail__admin-pill--active">
						Administratoriaus režimas įjungtas
						{#if adminImpersonating}
							<span class="concept-detail__admin-pill-note">(imitacija)</span>
						{/if}
					</span>
				{:else if adminContext?.requested}
					<span class="concept-detail__admin-pill concept-detail__admin-pill--denied">
						{adminSessionError ?? 'Administratoriaus režimo įjungti nepavyko.'}
					</span>
				{:else if adminHasAccess}
					<span class="concept-detail__admin-pill concept-detail__admin-pill--ready">
						Administratoriaus teisės aptiktos – galite įjungti redagavimą.
					</span>
				{/if}

				{#if adminHasAccess}
					<button
						type="button"
						class="concept-detail__admin-toggle"
						onclick={() => void setAdminMode(!adminEditEnabled)}
						disabled={inlineSaving}
					>
						{adminEditEnabled ? 'Išjungti admin režimą' : 'Įjungti admin režimą'}
					</button>
				{/if}
			</div>

			{#if adminEditEnabled}
				<div class="concept-detail__admin-toolbar">
					<span
						class="concept-detail__status"
						class:concept-detail__status--published={conceptStatus === 'published'}
					>
						{statusLabels[conceptStatus]}
					</span>

					<span
						class="concept-detail__badge"
						class:concept-detail__badge--optional={!concept?.isRequired}
					>
						{concept?.isRequired ? 'Privaloma tema' : 'Papildoma tema'}
					</span>

					{#if adminBadges.length}
						<ul class="concept-detail__badge-list">
							{#each adminBadges as badge (badge.key)}
								<li class="concept-detail__badge-item">
									<span class="concept-detail__badge-key">{badge.key}</span>
									<span class="concept-detail__badge-value">{badge.value}</span>
								</li>
							{/each}
						</ul>
					{/if}

					<div class="concept-detail__admin-toolbar-actions">
						<button type="button" onclick={() => (adminEditing = !adminEditing)}>
							{adminEditing ? 'Rodyti peržiūrą' : 'Redaguoti turinį'}
						</button>
						<a
							href="/admin/concepts"
							target="_blank"
							rel="noreferrer"
							class="concept-detail__admin-link"
						>
							Admin sąsaja
						</a>
					</div>
				</div>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet conceptContent()}
	{#if adminEditEnabled && adminEditing}
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

			<div class="concept-detail__form-grid concept-detail__form-grid--meta">
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

				<label>
					<span>Būsena</span>
					<select bind:value={inlineForm.status} onchange={() => handleInlineInput('status')}>
						{#each statusOptions as option}
							<option value={option}>{statusLabels[option]}</option>
						{/each}
					</select>
					{#if getInlineError('status')}
						<p class="concept-detail__field-error">{getInlineError('status')}</p>
					{/if}
				</label>

				<label>
					<span>Šaltinis</span>
					<input
						type="text"
						bind:value={inlineForm.sourceRef}
						oninput={() => handleInlineInput('sourceRef')}
					/>
					{#if getInlineError('sourceRef')}
						<p class="concept-detail__field-error">{getInlineError('sourceRef')}</p>
					{/if}
				</label>

				<label class="concept-detail__checkbox">
					<input
						type="checkbox"
						bind:checked={inlineForm.isRequired}
						onchange={() => handleInlineInput('isRequired')}
					/>
					<span>Privaloma tema</span>
				</label>
			</div>

			<div class="concept-detail__form-grid concept-detail__form-grid--structure">
				<label>
					<span>Skyrius kodas *</span>
					<input
						type="text"
						bind:value={inlineForm.sectionCode}
						oninput={() => handleInlineInput('sectionCode')}
					/>
					{#if getInlineError('sectionCode')}
						<p class="concept-detail__field-error">{getInlineError('sectionCode')}</p>
					{/if}
				</label>

				<label>
					<span>Skyrius pavadinimas *</span>
					<input
						type="text"
						bind:value={inlineForm.sectionTitle}
						oninput={() => handleInlineInput('sectionTitle')}
					/>
					{#if getInlineError('sectionTitle')}
						<p class="concept-detail__field-error">{getInlineError('sectionTitle')}</p>
					{/if}
				</label>

				<label>
					<span>Poskyrio kodas</span>
					<input
						type="text"
						bind:value={inlineForm.subsectionCode}
						oninput={() => handleInlineInput('subsectionCode')}
					/>
					{#if getInlineError('subsectionCode')}
						<p class="concept-detail__field-error">{getInlineError('subsectionCode')}</p>
					{/if}
				</label>

				<label>
					<span>Poskyrio pavadinimas</span>
					<input
						type="text"
						bind:value={inlineForm.subsectionTitle}
						oninput={() => handleInlineInput('subsectionTitle')}
					/>
					{#if getInlineError('subsectionTitle')}
						<p class="concept-detail__field-error">{getInlineError('subsectionTitle')}</p>
					{/if}
				</label>

				<label>
					<span>Curriculum mazgo kodas</span>
					<input
						type="text"
						bind:value={inlineForm.curriculumNodeCode}
						oninput={() => handleInlineInput('curriculumNodeCode')}
					/>
					{#if getInlineError('curriculumNodeCode')}
						<p class="concept-detail__field-error">{getInlineError('curriculumNodeCode')}</p>
					{/if}
				</label>

				<label>
					<span>Curriculum elemento eilės nr.</span>
					<input
						type="text"
						inputmode="numeric"
						bind:value={inlineForm.curriculumItemOrdinal}
						oninput={() => handleInlineInput('curriculumItemOrdinal')}
					/>
					{#if getInlineError('curriculumItemOrdinal')}
						<p class="concept-detail__field-error">{getInlineError('curriculumItemOrdinal')}</p>
					{/if}
				</label>

				<label>
					<span>Curriculum elemento pavadinimas</span>
					<input
						type="text"
						bind:value={inlineForm.curriculumItemLabel}
						oninput={() => handleInlineInput('curriculumItemLabel')}
					/>
					{#if getInlineError('curriculumItemLabel')}
						<p class="concept-detail__field-error">{getInlineError('curriculumItemLabel')}</p>
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

			{@render conceptActions()}
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
		gap: 0.5rem;
		align-items: center;
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

	.concept-detail__admin-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.75rem;
		border-radius: 999px;
		border: 1px solid var(--color-border-light);
		background: var(--color-panel-secondary);
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-text-subtle);
	}

	.concept-detail__admin-pill--active {
		border-color: var(--color-border);
		color: var(--color-text);
	}

	.concept-detail__admin-pill--denied {
		border-color: var(--color-border-strong);
		color: #b3474d;
	}

	.concept-detail__admin-pill--ready {
		color: var(--color-text);
	}

	.concept-detail__admin-pill-note {
		font-weight: 500;
		font-size: 0.78rem;
		color: var(--color-text-subtle);
	}

	.concept-detail__admin-form {
		display: grid;
		gap: 1.2rem;
		margin-top: 0.5rem;
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
		gap: 0.9rem;
	}

	.concept-detail__form-grid--meta,
	.concept-detail__form-grid--structure {
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	}

	.concept-detail__form-grid--full {
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
	}

	.concept-detail__form-grid label {
		display: grid;
		gap: 0.35rem;
		font-size: 0.85rem;
	}

	.concept-detail__form-grid input,
	.concept-detail__form-grid select,
	.concept-detail__form-grid textarea {
		width: 100%;
		border: 1px solid var(--color-border-light);
		border-radius: 0.55rem;
		padding: 0.6rem 0.75rem;
		font: inherit;
		background: var(--color-panel-secondary);
		color: inherit;
		transition: border-color 0.2s ease, background 0.2s ease;
	}

	.concept-detail__form-grid input:focus-visible,
	.concept-detail__form-grid select:focus-visible,
	.concept-detail__form-grid textarea:focus-visible {
		outline: none;
		border-color: var(--color-border);
		background: var(--color-panel);
	}

	.concept-detail__field-error {
		margin: 0;
		font-size: 0.8rem;
		color: #b3474d;
	}

	.concept-detail__checkbox {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		margin-top: 1.6rem;
		font-weight: 600;
	}

	.concept-detail__checkbox input[type='checkbox'] {
		width: 1.1rem;
		height: 1.1rem;
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
		border-radius: 0.6rem;
		padding: 0.6rem 1rem;
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
		transition: background 0.2s ease, border-color 0.2s ease;
	}

	.concept-detail__admin-button:hover,
	.concept-detail__admin-button:focus-visible {
		border-color: var(--color-border);
		background: var(--color-panel);
	}

	.concept-detail__admin-button--primary {
		background: var(--color-panel);
		border-color: var(--color-border);
	}

	.concept-detail__admin-button--publish {
		background: rgba(59, 130, 246, 0.12);
		border-color: rgba(59, 130, 246, 0.3);
		color: #1d4ed8;
	}

	.concept-detail__admin-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.concept-detail__admin-toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		align-items: center;
	}

	.concept-detail__status {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.8rem;
		border-radius: 999px;
		background: var(--color-panel-secondary);
		border: 1px solid var(--color-border-light);
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--color-text-subtle);
	}

	.concept-detail__status--published {
		background: rgba(46, 160, 67, 0.15);
		border-color: rgba(46, 160, 67, 0.35);
		color: #256c3f;
	}

	.concept-detail__badge {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.3rem 0.7rem;
		border-radius: 999px;
		background: var(--color-panel-secondary);
		border: 1px solid var(--color-border-light);
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--color-text-subtle);
	}

	.concept-detail__badge--optional {
		background: rgba(59, 130, 246, 0.12);
		border-color: rgba(59, 130, 246, 0.25);
		color: #1d4ed8;
	}

	.concept-detail__badge-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.concept-detail__badge-item {
		display: inline-flex;
		gap: 0.35rem;
		align-items: baseline;
		font-size: 0.82rem;
	}

	.concept-detail__badge-key {
		font-weight: 600;
		color: var(--color-text-subtle);
	}

	.concept-detail__badge-value {
		color: var(--color-text);
	}

	.concept-detail__admin-toolbar-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-left: auto;
	}

	.concept-detail__admin-toolbar-actions button,
	.concept-detail__admin-link {
		border: 1px solid var(--color-border-light);
		background: var(--color-panel-secondary);
		padding: 0.35rem 0.75rem;
		border-radius: 0.6rem;
		font-size: 0.82rem;
		color: inherit;
		cursor: pointer;
		text-decoration: none;
		transition: background 0.2s ease, border-color 0.2s ease;
	}

	.concept-detail__admin-toolbar-actions button:hover,
	.concept-detail__admin-toolbar-actions button:focus-visible,
	.concept-detail__admin-link:hover,
	.concept-detail__admin-link:focus-visible {
		border-color: var(--color-border);
		background: var(--color-panel);
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
