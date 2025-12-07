<script lang="ts">
	import { goto } from '$app/navigation';
	import ConceptDisplay from '$lib/components/ConceptDisplay.svelte';
	import ConceptMediaGallery from '$lib/components/ConceptMediaGallery.svelte';
	import type { ConceptDetail as ConceptDetailData } from '$lib/api/concepts';
	import type { CurriculumItem } from '$lib/api/curriculum';
	import type { NextSection } from '$lib/page-data/conceptDetail';
	import { fetchConceptMedia, type ConceptMediaItem } from '$lib/api/media';
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
	import { onDestroy, onMount } from 'svelte';
	import AdminMediaCreateDrawer from '$lib/admin/media/AdminMediaCreateDrawer.svelte';
	import type { MediaConceptOption } from '$lib/admin/media/types';
	import {
		initializeProgressTracking,
		learnerProgress,
		learnerProgressError,
		learnerProgressPending,
		learnerProgressStatus,
		setConceptProgressStatus,
		type ConceptProgressRecord,
		type ProgressStoreStatus,
		type ProgressStatus as LearnerProgressStatus
	} from '$lib/stores/progressStore';
	import { authSession } from '$lib/stores/authStore';

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
		concept: ConceptDetailData;
		breadcrumbs?: Breadcrumb[];
		sectionItems?: CurriculumItem[];
		neighbors?: NeighborSet;
		nextSection?: NextSection | null;
		media?: ConceptMediaItem[];
		mediaError?: string | null;
		adminContext?: ConceptAdminEditContext;
		isModal?: boolean;
	};

	let {
		concept,
		breadcrumbs = [],
		sectionItems = [],
		neighbors,
		nextSection,
		media = [],
		mediaError = null,
		adminContext,
		isModal = false
	}: Props = $props();
	const adminEditEnabled = $derived(Boolean(adminContext?.enabled));
	const adminSessionError = $derived(adminContext?.session.errorMessage ?? null);
	const adminHasAccess = $derived(Boolean(adminContext?.session.allowed));

	type ActionStatus = 'idle' | 'learning' | 'known' | 'reset' | 'seen';
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
	let mediaItems = $state<ConceptMediaItem[]>(media ?? []);
	let mediaLoadError = $state<string | null>(mediaError ?? null);
	let mediaLoading = $state(false);
	let mediaDrawerOpen = $state(false);
	let progressRecords = $state<Map<string, ConceptProgressRecord>>(new Map());
	let progressPendingConcepts = $state<Set<string>>(new Set());
	let progressStoreStatus = $state<ProgressStoreStatus>('idle');
	let progressStoreError = $state<string | null>(null);
	let progressActionError = $state<string | null>(null);
	let lastProgressConceptId: string | null = concept?.id ?? null;

	$effect(() => {
		const currentId = concept?.id ?? null;
		if (currentId === lastProgressConceptId) {
			return;
		}
		lastProgressConceptId = currentId;
		progressActionError = null;
		lastAction = 'idle';
		actionMessage = '';
	});

	const inlineDirty = $derived(computeInlineSnapshot(inlineForm) !== inlineInitialSnapshot);
	const mediaConceptOptions = $derived(
		concept
			? ([
					{
						id: concept.id,
						slug: concept.slug,
						label: concept.termLt?.trim()?.length ? concept.termLt : concept.slug
					}
				] satisfies MediaConceptOption[])
			: ([] as MediaConceptOption[])
	);

	const learnedSlugs = $derived.by(() => {
		const slugs = new Set<string>();
		const idToSlug = new Map<string, string>();
		for (const item of sectionItems) {
			if (item.conceptId && item.conceptSlug) {
				idToSlug.set(item.conceptId, item.conceptSlug);
			}
		}
		
		for (const [id, record] of progressRecords.entries()) {
			if (record.status === 'known') {
				const slug = idToSlug.get(id);
				if (slug) {
					slugs.add(slug);
				}
			}
		}
		return slugs;
	});

	const currentProgressEntry = $derived((() => {
		const id = concept?.id ?? null;
		if (!id) {
			return null;
		}
		return progressRecords.get(id) ?? null;
	})());
	const progressInputsDisabled = $derived((() => {
		const id = concept?.id ?? null;
		if (!id) {
			return true;
		}
		if (!adminContext?.session.allowed && !adminContext?.session.authenticated) {
			return true;
		}
		if (progressStoreStatus === 'loading') {
			return true;
		}
		return progressPendingConcepts.has(id);
	})());

	let currentUrl = $state($page.url);
	const unsubscribePage = page.subscribe(({ url }) => {
		currentUrl = url;
	});
	const unsubscribeProgress = learnerProgress.subscribe((value) => {
		progressRecords = value;
	});
	const unsubscribeProgressStatus = learnerProgressStatus.subscribe((value) => {
		progressStoreStatus = value;
	});
	const unsubscribeProgressError = learnerProgressError.subscribe((value) => {
		progressStoreError = value;
	});
	const unsubscribeProgressPending = learnerProgressPending.subscribe((value) => {
		progressPendingConcepts = value;
	});

	onMount(() => {
		void initializeProgressTracking();
	});

	onDestroy(() => {
		unsubscribePage();
		unsubscribeProgress();
		unsubscribeProgressStatus();
		unsubscribeProgressError();
		unsubscribeProgressPending();
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
		return [entry.id, entry.updatedAt ?? '', entry.termLt ?? '', entry.termEn ?? ''].join('|');
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
		mediaItems = media ?? [];
		mediaLoadError = mediaError ?? null;
	});

	$effect(() => {
		const progressEntry = currentProgressEntry;
		knownChecked = progressEntry?.status === 'known';
	});

	$effect(() => {
		if (
			concept?.id &&
			progressStoreStatus === 'idle' &&
			!currentProgressEntry &&
			adminContext?.session.authenticated
		) {
			void applyProgressStatus('seen');
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
			inlineErrorMessage = general.length ? general.join(' ') : 'Patikrinkite pažymėtus laukus.';
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
			inlineErrorMessage = error instanceof Error ? error.message : 'Nepavyko išsaugoti pakeitimų.';
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

		await goto(url, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	async function reloadMedia(): Promise<void> {
		if (!concept?.slug) {
			return;
		}
		mediaLoading = true;
		mediaLoadError = null;
		try {
			mediaItems = await fetchConceptMedia(concept.slug);
		} catch (error) {
			mediaLoadError = error instanceof Error ? error.message : 'Nepavyko įkelti medijos.';
		} finally {
			mediaLoading = false;
		}
	}

	function openMediaDrawer(): void {
		if (!adminHasAccess || !concept) {
			return;
		}
		mediaDrawerOpen = true;
	}

	function closeMediaDrawer(): void {
		mediaDrawerOpen = false;
	}

	function handleMediaCreated(): void {
		mediaDrawerOpen = false;
		void reloadMedia();
	}

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
			case 'seen':
				return 'Tema peržiūrėta.';
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

	async function applyProgressStatus(target: LearnerProgressStatus | null): Promise<void> {
		if (!concept?.id) {
			return;
		}

		progressActionError = null;

		const currentStatus = currentProgressEntry?.status ?? null;
		if (currentStatus === target) {
			const action: ActionStatus =
				target === 'known' ? 'known' : target === 'learning' ? 'learning' : target === 'seen' ? 'seen' : 'reset';
			setLastAction(action);
			return;
		}

		try {
			await setConceptProgressStatus(concept.id, target);
			const action: ActionStatus =
				target === 'known' ? 'known' : target === 'learning' ? 'learning' : target === 'seen' ? 'seen' : 'reset';
			setLastAction(action);
		} catch (error) {
			console.error('[ConceptDetail] Failed to update progress', error);
			progressActionError =
				error instanceof Error ? error.message : 'Nepavyko išsaugoti pažangos.';
		}
	}

	async function toggleKnown() {
		if (!concept?.id) return;
		const newStatus = knownChecked ? 'seen' : 'known';
		await applyProgressStatus(newStatus);
	}

	const markKnown = (value: boolean) => {
		if (!concept?.id || progressInputsDisabled) {
			return;
		}

		knownChecked = value;
		if (value) {
			void applyProgressStatus('known');
		} else {
			void applyProgressStatus('seen');
		}
	};


 
	const handleKnownChange = (event: Event) => {
		const target = event.currentTarget as HTMLInputElement | null;
		markKnown(Boolean(target?.checked));
	};

	async function refreshMedia() {
		if (!concept?.slug) return;
		mediaLoading = true;
		mediaLoadError = null;
		try {
			mediaItems = await fetchConceptMedia(concept.slug);
		} catch (e) {
			console.error(e);
			mediaLoadError = 'Nepavyko atnaujinti medijos.';
		} finally {
			mediaLoading = false;
		}
	}
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
					<span>Sąvoka (LT) *</span>
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
					<span>Sąvoka (EN)</span>
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
					{inlineSaving ? 'Saugoma…' : 'Į juodraštį'}
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
					aria-label="Atmesti neįrašytus pakeitimus"
				>
					Atmesti
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

		{#if mediaItems.length || mediaLoadError || mediaLoading || adminHasAccess}
			<section class="concept-detail__media" aria-label="Papildoma medžiaga">
				<header class="concept-detail__media-header">
					<h3>Papildoma medžiaga</h3>
					{#if adminHasAccess}
						<button
							type="button"
							class="concept-detail__media-button"
							onclick={openMediaDrawer}
							disabled={mediaLoading}
						>
							Pridėti mediją
						</button>
					{/if}
				</header>
				{#if mediaLoading}
					<p class="concept-detail__media-status">Kraunama medija...</p>
				{:else if mediaLoadError}
					<div class="concept-detail__media-alert concept-detail__media-alert--error">
						{mediaLoadError}
					</div>
				{:else if mediaItems.length === 0}
					<p class="concept-detail__media-status">
						Šiai temai dar nepriskirta vizualinės medžiagos.
					</p>
				{:else}
					<ConceptMediaGallery items={mediaItems} onchange={refreshMedia} />
				{/if}
			</section>
		{/if}

		{#if descriptionEn}
			<div class="concept-detail__translation">
				<h3>Anglų kalbos užuomina</h3>
				<p>{descriptionEn}</p>
			</div>
		{/if}
	{/if}
{/snippet}

	{#snippet actionsSnippet()}
		{#if !adminHasAccess && $authSession}
			<div class="concept-detail__actions-wrapper">
				<span class="concept-detail__status-label">Moku</span>
				<button
					type="button"
					class="concept-detail__status-toggle-icon"
					class:concept-detail__status-toggle-icon--active={knownChecked}
					onclick={toggleKnown}
					disabled={progressStoreStatus === 'loading' || progressInputsDisabled}
					aria-pressed={knownChecked}
					title={knownChecked ? 'Pažymėta kaip išmokta' : 'Pažymėti kaip išmoktą'}
				>
					<svg
						viewBox="0 0 24 24"
						width="20"
						height="20"
						stroke="currentColor"
						stroke-width="2"
						fill="none"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						{#if knownChecked}
							<polyline points="20 6 9 17 4 12" />
						{:else}
							<circle cx="12" cy="12" r="10" />
						{/if}
					</svg>
				</button>
				
				{#if progressStoreStatus === 'loading'}
					<span class="concept-detail__status-spinner" role="status" aria-live="polite"></span>
				{:else if progressStoreError}
					<span class="concept-detail__status-error" title={progressStoreError}>!</span>
				{/if}
			</div>
		{/if}
	{/snippet}

	{#snippet headerActionsSnippet()}
		{#if adminHasAccess}
			<div class="concept-detail__header-actions-wrapper">
				<a
					href="/admin/concepts/{concept.id}"
					class="concept-detail__admin-link"
					title="Redaguoti administraciniame skydelyje"
				>
					<svg
						viewBox="0 0 24 24"
						width="18"
						height="18"
						stroke="currentColor"
						stroke-width="2"
						fill="none"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
					</svg>
				</a>
			</div>
		{/if}
	{/snippet}

<ConceptDisplay
	{concept}
	{breadcrumbs}
	{sectionItems}
	{neighbors}
	{nextSection}
	meta={conceptMeta}
	headerActions={headerActionsSnippet}
	actions={actionsSnippet}
	content={conceptContent}
	{isModal}
	{learnedSlugs}
/>



{#if mediaDrawerOpen && concept && adminHasAccess}
	<AdminMediaCreateDrawer
		conceptOptions={mediaConceptOptions}
		defaultConceptId={concept.id}
		lockedConceptId={true}
		on:close={closeMediaDrawer}
		on:created={handleMediaCreated}
	/>
{/if}

<style>
	.concept-detail__actions-wrapper {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.concept-detail__status-label {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-text-subtle);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.concept-detail__status-toggle-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		border: 2px solid var(--color-border);
		background: var(--color-panel);
		color: var(--color-text-subtle);
		cursor: pointer;
		transition: all 0.2s ease;
		padding: 0;
	}

	.concept-detail__status-toggle-icon:hover:not(:disabled) {
		border-color: var(--color-border-strong);
		background: var(--color-panel-hover);
		color: var(--color-text);
		transform: scale(1.05);
	}

	.concept-detail__status-toggle-icon--active {
		background: var(--color-accent-success, #10b981);
		border-color: var(--color-accent-success, #10b981);
		color: white;
	}

	.concept-detail__status-toggle-icon--active:hover:not(:disabled) {
		background: var(--color-accent-success-hover, #059669);
		border-color: var(--color-accent-success-hover, #059669);
		color: white;
	}

	.concept-detail__status-toggle-icon:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.concept-detail__status-spinner {
		width: 1.2rem;
		height: 1.2rem;
		border: 2px solid var(--color-border);
		border-top-color: var(--color-accent);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.concept-detail__status-error {
		color: var(--color-status-error-text);
		font-weight: bold;
	}



	.concept-detail__header-actions-wrapper {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.concept-detail__admin-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		color: var(--color-text-muted);
		transition:
			background 0.2s ease,
			color 0.2s ease;
	}

	.concept-detail__admin-link:hover {
		background: var(--color-surface-02);
		color: var(--color-text);
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.concept-detail__media {
		display: grid;
		gap: 0.9rem;
		margin: 1.1rem 0;
		padding: 1rem 1.1rem 1.2rem;
		border-radius: 1rem;
		border: 1px solid var(--color-border-light);
		background: var(--color-panel);
	}

	.concept-detail__media-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
	}

	.concept-detail__media-header h3 {
		margin: 0;
		font-weight: normal;
		font-size: 1rem;
	}

	.concept-detail__media-button {
		border: 1px solid var(--color-border);
		background: var(--color-panel-soft);
		color: var(--color-text);
		border-radius: 999px;
		padding: 0.4rem 1rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			background 0.2s ease,
			border-color 0.2s ease;
	}

	.concept-detail__media-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.concept-detail__media-button:hover:not(:disabled),
	.concept-detail__media-button:focus-visible:not(:disabled) {
		background: var(--color-panel-secondary);
		border-color: var(--color-border-strong);
	}

	.concept-detail__media-status {
		margin: 0;
		color: var(--color-text-soft);
		font-size: 0.95rem;
	}

	.concept-detail__media-alert {
		margin: 0;
		padding: 0.75rem 0.9rem;
		border-radius: 0.85rem;
		font-size: 0.9rem;
	}

	.concept-detail__media-alert--error {
		background: rgba(239, 68, 68, 0.12);
		border: 1px solid rgba(239, 68, 68, 0.4);
		color: rgb(185, 28, 28);
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
		transition:
			background 0.2s ease,
			border-color 0.2s ease;
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
		transition:
			border-color 0.2s ease,
			background 0.2s ease,
			box-shadow 0.2s ease;
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
		transition:
			background 0.2s ease,
			border-color 0.2s ease,
			box-shadow 0.2s ease;
		white-space: nowrap;
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
	}
</style>
