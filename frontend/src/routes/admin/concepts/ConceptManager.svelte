<script lang="ts">
	import { resolve } from '$app/paths';
	import { onDestroy, onMount } from 'svelte';
	import {
		listAdminConcepts,
		saveAdminConcept,
		fetchAdminConceptHistory,
		type AdminConceptResource,
		type AdminConceptStatus,
		type AdminConceptVersion,
		adminConceptFormSchema
	} from '$lib/api/admin/concepts';
	import type { AdminConceptMutationInput } from '../../../../../shared/validation/adminConceptSchema';

	type ConceptFormState = {
		slug: string;
		termLt: string;
		termEn: string;
		descriptionLt: string;
		descriptionEn: string;
		sectionCode: string;
		sectionTitle: string;
		subsectionCode: string;
		subsectionTitle: string;
		curriculumNodeCode: string;
		curriculumItemOrdinal: string;
		curriculumItemLabel: string;
		sourceRef: string;
		isRequired: boolean;
		status: AdminConceptStatus;
	};

	type FieldErrors = Record<string, string[]>;
	type SectionOption = {
		code: string;
		title: string | null;
	};

	let concepts: AdminConceptResource[] = [];
	let filteredConcepts: AdminConceptResource[] = [];
	let sectionOptions: SectionOption[] = [];
	let filterSectionCode = 'all';
	let filterStatus: 'all' | AdminConceptStatus = 'all';
	let searchTerm = '';
	let totalMatches = 0;

	let loading = false;
	let loadError: string | null = null;
	let editorOpen = false;
	let editorMode: 'create' | 'edit' = 'create';
	let activeConcept: AdminConceptResource | null = null;
	let formState: ConceptFormState = createEmptyFormState();
	let metadataSnapshot: Record<string, unknown> = { status: 'draft' };
	let formErrors: FieldErrors = {};
	let saveError: string | null = null;
	let saving = false;
	let successMessage: string | null = null;
	let successTimeout: ReturnType<typeof setTimeout> | null = null;
	let historyEntries: AdminConceptVersion[] = [];
	let historyLoading = false;
	let historyError: string | null = null;
	let editorDirty = false;
	let initialSnapshot = '';
	let beforeUnloadAttached = false;

	onMount(() => {
		void refreshConcepts();
	});

	function getFilterParams(): {
		sectionCode?: string;
		status?: AdminConceptStatus;
	} {
		const params: { sectionCode?: string; status?: AdminConceptStatus } = {};

		if (filterSectionCode !== 'all') {
			params.sectionCode = filterSectionCode;
		}

		if (filterStatus !== 'all') {
			params.status = filterStatus;
		}

		return params;
	}

	async function refreshConcepts(): Promise<void> {
		loading = true;
		loadError = null;

		try {
			const list = await listAdminConcepts(getFilterParams());
			concepts = sortConcepts(list);
			updateSectionOptions(concepts);
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'Nepavyko įkelti temų sąrašo.';
		} finally {
			loading = false;
		}
	}

	function updateSectionOptions(list: AdminConceptResource[]): void {
		const map = new Map<string, string | null>();
		for (const item of list) {
			if (!map.has(item.sectionCode)) {
				map.set(item.sectionCode, item.sectionTitle ?? null);
			}
		}
		sectionOptions = Array.from(map.entries())
			.map(([code, title]) => ({ code, title }))
			.sort((a, b) => a.code.localeCompare(b.code, 'lt-LT'));
	}

	function sortConcepts(list: AdminConceptResource[]): AdminConceptResource[] {
		return [...list].sort((a, b) => a.termLt.localeCompare(b.termLt, 'lt-LT'));
	}

	function applySavedConcept(saved: AdminConceptResource): void {
		const next = [...concepts];
		const index = next.findIndex((concept) => concept.slug === saved.slug);
		if (index === -1) {
			next.push(saved);
		} else {
			next[index] = saved;
		}
		concepts = sortConcepts(next);
		updateSectionOptions(concepts);
	}

	function matchesSearch(concept: AdminConceptResource, query: string): boolean {
		const trimmed = query.trim().toLowerCase();
		if (!trimmed.length) {
			return true;
		}

		const candidates = [
			concept.termLt,
			concept.termEn ?? undefined,
			concept.slug,
			concept.sectionCode,
			concept.sectionTitle ?? undefined,
			concept.subsectionTitle ?? undefined
		];

		return candidates.some((value) =>
			typeof value === 'string' && value.toLowerCase().includes(trimmed)
		);
	}

	function matchesActiveFilters(concept: AdminConceptResource): boolean {
		if (filterSectionCode !== 'all' && concept.sectionCode !== filterSectionCode) {
			return false;
		}

		if (filterStatus !== 'all' && concept.status !== filterStatus) {
			return false;
		}

		return true;
	}

	async function handleSectionFilterChange(code: string): Promise<void> {
		if (filterSectionCode === code) {
			return;
		}
		filterSectionCode = code;
		await refreshConcepts();
	}

	async function handleStatusFilterChange(status: 'all' | AdminConceptStatus): Promise<void> {
		if (filterStatus === status) {
			return;
		}
		filterStatus = status;
		await refreshConcepts();
	}

	async function clearFilters(): Promise<void> {
		filterSectionCode = 'all';
		filterStatus = 'all';
		searchTerm = '';
		await refreshConcepts();
	}

	$: filteredConcepts = concepts.filter((concept) => matchesSearch(concept, searchTerm));
	$: totalMatches = filteredConcepts.length;

	function createEmptyFormState(): ConceptFormState {
		return {
			slug: '',
			termLt: '',
			termEn: '',
			descriptionLt: '',
			descriptionEn: '',
			sectionCode: '',
			sectionTitle: '',
			subsectionCode: '',
			subsectionTitle: '',
			curriculumNodeCode: '',
			curriculumItemOrdinal: '',
			curriculumItemLabel: '',
			sourceRef: '',
			isRequired: true,
			status: 'draft'
		};
	}

	function resetForm(): void {
		formState = createEmptyFormState();
		metadataSnapshot = { status: 'draft' };
		formErrors = {};
		saveError = null;
		setInitialSnapshot(formState, metadataSnapshot);
	}

	function openCreate(): void {
		editorMode = 'create';
		activeConcept = null;
		resetForm();
		historyEntries = [];
		historyError = null;
		historyLoading = false;
		editorOpen = true;
	}

	function openEdit(concept: AdminConceptResource): void {
		editorMode = 'edit';
		activeConcept = concept;
		formState = conceptToFormState(concept);
		metadataSnapshot = cloneMetadata(concept.metadata);

		if (typeof metadataSnapshot.status !== 'string') {
			metadataSnapshot.status = concept.status;
		}

		formErrors = {};
		saveError = null;
		setInitialSnapshot(formState, metadataSnapshot);
		historyEntries = [];
		historyError = null;
		historyLoading = false;
		void loadHistory(concept.slug);
		editorOpen = true;
	}

	function closeEditor(): void {
		if (saving) {
			return;
		}

		if (!confirmDiscard()) {
			return;
		}

		editorOpen = false;
		editorDirty = false;
	}

	function conceptToFormState(concept: AdminConceptResource): ConceptFormState {
		return {
			slug: concept.slug,
			termLt: concept.termLt,
			termEn: concept.termEn ?? '',
			descriptionLt: concept.descriptionLt ?? '',
			descriptionEn: concept.descriptionEn ?? '',
			sectionCode: concept.sectionCode,
			sectionTitle: concept.sectionTitle ?? '',
			subsectionCode: concept.subsectionCode ?? '',
			subsectionTitle: concept.subsectionTitle ?? '',
			curriculumNodeCode: concept.curriculumNodeCode ?? '',
			curriculumItemOrdinal:
				concept.curriculumItemOrdinal === null || concept.curriculumItemOrdinal === undefined
					? ''
					: String(concept.curriculumItemOrdinal),
			curriculumItemLabel: concept.curriculumItemLabel ?? '',
			sourceRef: concept.sourceRef ?? '',
			isRequired: concept.isRequired,
			status: concept.status
		};
	}

	function cloneMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
		if (!metadata) {
			return { status: 'draft' };
		}

		try {
			return structuredClone(metadata);
		} catch (error) {
			console.warn('Nepavyko naudoti structuredClone, bus taikomas JSON kopijavimas.', error);
			return JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>;
		}
	}

	function optionalString(value: string): string | null {
		const trimmed = value.trim();
		return trimmed.length ? trimmed : null;
	}

	function optionalNumber(value: string): number | null {
		const trimmed = value.trim();
		if (!trimmed.length) {
			return null;
		}

		const parsed = Number.parseInt(trimmed, 10);
		return Number.isNaN(parsed) ? null : parsed;
	}

	function computeSnapshot(
		state: ConceptFormState,
		metadata: Record<string, unknown>
	): string {
		return JSON.stringify({ state, metadata });
	}

	function setInitialSnapshot(
		state: ConceptFormState,
		metadata: Record<string, unknown>
	): void {
		initialSnapshot = computeSnapshot(state, metadata);
		editorDirty = false;
	}

	function markDirty(): void {
		const snapshot = computeSnapshot(formState, metadataSnapshot);
		editorDirty = snapshot !== initialSnapshot;
	}

	function clearSuccessMessage(): void {
		if (successTimeout) {
			clearTimeout(successTimeout);
			successTimeout = null;
		}
		successMessage = null;
	}

	function showSuccess(message: string): void {
		clearSuccessMessage();
		successMessage = message;
		successTimeout = setTimeout(() => {
			successMessage = null;
			successTimeout = null;
		}, 4000);
	}

	function hasUnsavedChanges(): boolean {
		return editorDirty;
	}

	function confirmDiscard(): boolean {
		if (!hasUnsavedChanges()) {
			return true;
		}

		if (typeof window === 'undefined') {
			return true;
		}

		return window.confirm('Yra neišsaugotų pakeitimų. Ar tikrai uždaryti be išsaugojimo?');
	}

	function handleBeforeUnload(event: BeforeUnloadEvent): void {
		if (hasUnsavedChanges()) {
			event.preventDefault();
			event.returnValue = '';
		}
	}

	async function loadHistory(slug: string): Promise<void> {
		historyLoading = true;
		historyError = null;
		try {
			historyEntries = await fetchAdminConceptHistory(slug, { limit: 20 });
		} catch (error) {
			historyError = error instanceof Error ? error.message : 'Nepavyko įkelti istorijos.';
			historyEntries = [];
		} finally {
			historyLoading = false;
		}
	}

	function buildPayload(state: ConceptFormState): AdminConceptMutationInput {
		return {
			slug: state.slug.trim(),
			termLt: state.termLt.trim(),
			termEn: optionalString(state.termEn),
			descriptionLt: state.descriptionLt.trim(),
			descriptionEn: optionalString(state.descriptionEn),
			sectionCode: state.sectionCode.trim(),
			sectionTitle: state.sectionTitle.trim(),
			subsectionCode: optionalString(state.subsectionCode),
			subsectionTitle: optionalString(state.subsectionTitle),
			curriculumNodeCode: optionalString(state.curriculumNodeCode),
			curriculumItemOrdinal: optionalNumber(state.curriculumItemOrdinal),
			curriculumItemLabel: optionalString(state.curriculumItemLabel),
			sourceRef: optionalString(state.sourceRef),
			isRequired: state.isRequired,
			metadata: { ...metadataSnapshot, status: state.status },
			status: state.status
		};
	}

	function getFirstError(field: string): string | null {
		const list = formErrors[field];
		return list && list.length ? list[0] : null;
	}

	function setStatus(status: AdminConceptStatus): void {
		formState = { ...formState, status };
		metadataSnapshot = { ...metadataSnapshot, status };
		formErrors = { ...formErrors, status: [], 'metadata.status': [] };
		markDirty();
	}

	function handleBackdropKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			closeEditor();
			return;
		}

		if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
			event.preventDefault();
			closeEditor();
		}
	}

	function formatTimestamp(value: string | null | undefined): string {
		if (!value) {
			return '–';
		}

		const date = new Date(value);
		if (Number.isNaN(date.getTime())) {
			return value;
		}

		return `${date.toLocaleDateString('lt-LT')} ${date.toLocaleTimeString('lt-LT', {
			hour: '2-digit',
			minute: '2-digit'
		})}`;
	}

	async function handleSubmit(): Promise<void> {
		saveError = null;
		const payload = buildPayload(formState);
		const validation = adminConceptFormSchema.safeParse(payload);

		if (!validation.success) {
			const flattened = validation.error.flatten();
			formErrors = flattened.fieldErrors as FieldErrors;
			const general = flattened.formErrors.filter(Boolean);
			saveError = general.length ? general.join(' ') : null;
			return;
		}

		formErrors = {};

		try {
			saving = true;
			const saved = await saveAdminConcept(validation.data);
			if (matchesActiveFilters(saved)) {
				applySavedConcept(saved);
			} else {
				await refreshConcepts();
			}
			activeConcept = saved;
			editorDirty = false;
			editorOpen = false;
			showSuccess(editorMode === 'edit' ? 'Tema atnaujinta.' : 'Tema sukurta.');
			if (editorMode === 'edit') {
				void loadHistory(saved.slug);
			}
		} catch (error) {
			saveError = error instanceof Error ? error.message : 'Nepavyko išsaugoti temų.';
		} finally {
			saving = false;
		}
	}

	const statusLabels: Record<AdminConceptStatus, string> = {
		draft: 'Juodraštis',
		published: 'Publikuota'
	};

	$: {
		if (typeof window !== 'undefined') {
			if (editorOpen && editorDirty && !beforeUnloadAttached) {
				window.addEventListener('beforeunload', handleBeforeUnload);
				beforeUnloadAttached = true;
			} else if ((!editorOpen || !editorDirty) && beforeUnloadAttached) {
				window.removeEventListener('beforeunload', handleBeforeUnload);
				beforeUnloadAttached = false;
			}
		}
	}

	onDestroy(() => {
		if (typeof window !== 'undefined' && beforeUnloadAttached) {
			window.removeEventListener('beforeunload', handleBeforeUnload);
		}
		clearSuccessMessage();
	});
</script>

<section class="concepts-shell">
	<header class="concepts-shell__header">
		<div>
			<h1>Temų tvarkyklė</h1>
			<p>
				Kurti ir atnaujinti mokomąsias temas. Administratoriaus pakeitimai saugomi ir žymimi kaip
				juodraščiai arba publikuoti įrašai.
			</p>
		</div>
		<button class="primary" type="button" on:click={openCreate}>Nauja tema</button>
	</header>

	{#if loadError}
		<div class="alert alert--error">{loadError}</div>
	{:else if loading}
		<p class="muted">Įkeliama...</p>
	{:else if !concepts.length}
		<p class="muted">Dar nėra sukurtų temų.</p>
	{:else}
		<div class="table-wrapper">
			<table class="concept-table">
				<thead>
					<tr>
						<th scope="col">Terminas</th>
						<th scope="col">Skyrius</th>
						<th scope="col">Slug</th>
						<th scope="col">Būsena</th>
						<th scope="col">Atnaujinta</th>
						<th scope="col">Veiksmai</th>
					</tr>
				</thead>
				<tbody>
					{#each concepts as concept (concept.id)}
						<tr>
							<td>
								<div class="concept-name">
									<span class="concept-name__primary">{concept.termLt}</span>
									{#if concept.termEn}
										<span class="concept-name__secondary">{concept.termEn}</span>
									{/if}
								</div>
							</td>
							<td>
								<div class="concept-section">
									<span>{concept.sectionCode}</span>
									{#if concept.sectionTitle}
										<span class="concept-section__title">{concept.sectionTitle}</span>
									{/if}
								</div>
							</td>
							<td><code>{concept.slug}</code></td>
							<td>
								<span class:status-badge--published={concept.status === 'published'} class="status-badge">
									{statusLabels[concept.status]}
								</span>
							</td>
							<td>{formatTimestamp(concept.updatedAt)}</td>
							<td>
								<div class="concept-table__actions">
									<button type="button" on:click={() => openEdit(concept)}>Redaguoti</button>
									<a
										href={`${resolve('/concepts/[slug]', { slug: concept.slug })}?admin=1`}
										target="_blank"
										rel="noreferrer"
									>
										Atverti temą
									</a>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

{#if editorOpen}
	<div
		class="drawer-backdrop"
		role="button"
		tabindex="0"
		aria-label="Uždaryti temų redagavimo formą"
		on:click={closeEditor}
		on:keydown={handleBackdropKeydown}
	></div>
{/if}

<aside class:drawer--open={editorOpen} class="drawer" aria-hidden={!editorOpen}>
	<form class="drawer__form" on:submit|preventDefault={handleSubmit}>
		<header class="drawer__header">
			<div>
				<h2>{editorMode === 'edit' ? 'Redaguoti temą' : 'Nauja tema'}</h2>
				{#if activeConcept}
					<p class="muted">Redaguojama: <code>{activeConcept.slug}</code></p>
				{/if}
			</div>
			<button type="button" on:click={closeEditor} class="text">Uždaryti</button>
		</header>

		{#if saveError}
			<div class="alert alert--error">{saveError}</div>
		{/if}

		<div class="form-grid">
			<label>
				<span>Slug *</span>
				<input bind:value={formState.slug} name="slug" required disabled={editorMode === 'edit'} on:input={markDirty} />
				{#if getFirstError('slug')}
					<p class="field-error">{getFirstError('slug')}</p>
				{/if}
			</label>

			<label>
				<span>Terminas (LT) *</span>
				<input bind:value={formState.termLt} name="termLt" required on:input={markDirty} />
				{#if getFirstError('termLt')}
					<p class="field-error">{getFirstError('termLt')}</p>
				{/if}
			</label>

			<label>
				<span>Terminas (EN)</span>
				<input bind:value={formState.termEn} name="termEn" on:input={markDirty} />
				{#if getFirstError('termEn')}
					<p class="field-error">{getFirstError('termEn')}</p>
				{/if}
			</label>

			<label class="form-grid__full">
				<span>Aprašymas (LT) *</span>
				<textarea bind:value={formState.descriptionLt} name="descriptionLt" rows="4" required on:input={markDirty}></textarea>
				{#if getFirstError('descriptionLt')}
					<p class="field-error">{getFirstError('descriptionLt')}</p>
				{/if}
			</label>

			<label class="form-grid__full">
				<span>Aprašymas (EN)</span>
				<textarea bind:value={formState.descriptionEn} name="descriptionEn" rows="3" on:input={markDirty}></textarea>
				{#if getFirstError('descriptionEn')}
					<p class="field-error">{getFirstError('descriptionEn')}</p>
				{/if}
			</label>

			<label>
				<span>Skyriaus kodas *</span>
				<input bind:value={formState.sectionCode} name="sectionCode" required on:input={markDirty} />
				{#if getFirstError('sectionCode')}
					<p class="field-error">{getFirstError('sectionCode')}</p>
				{/if}
			</label>

			<label>
				<span>Skyriaus pavadinimas *</span>
				<input bind:value={formState.sectionTitle} name="sectionTitle" required on:input={markDirty} />
				{#if getFirstError('sectionTitle')}
					<p class="field-error">{getFirstError('sectionTitle')}</p>
				{/if}
			</label>

			<label>
				<span>Poskyrio kodas</span>
				<input bind:value={formState.subsectionCode} name="subsectionCode" on:input={markDirty} />
				{#if getFirstError('subsectionCode')}
					<p class="field-error">{getFirstError('subsectionCode')}</p>
				{/if}
			</label>

			<label>
				<span>Poskyrio pavadinimas</span>
				<input bind:value={formState.subsectionTitle} name="subsectionTitle" on:input={markDirty} />
				{#if getFirstError('subsectionTitle')}
					<p class="field-error">{getFirstError('subsectionTitle')}</p>
				{/if}
			</label>

			<label>
				<span>Curriculum node kodas</span>
				<input bind:value={formState.curriculumNodeCode} name="curriculumNodeCode" on:input={markDirty} />
				{#if getFirstError('curriculumNodeCode')}
					<p class="field-error">{getFirstError('curriculumNodeCode')}</p>
				{/if}
			</label>

			<label>
				<span>Pozicijos numeris</span>
				<input
					bind:value={formState.curriculumItemOrdinal}
					name="curriculumItemOrdinal"
					type="number"
					min="0"
					on:input={markDirty}
				/>
				{#if getFirstError('curriculumItemOrdinal')}
					<p class="field-error">{getFirstError('curriculumItemOrdinal')}</p>
				{/if}
			</label>

			<label>
				<span>Pozicijos pavadinimas</span>
				<input bind:value={formState.curriculumItemLabel} name="curriculumItemLabel" on:input={markDirty} />
				{#if getFirstError('curriculumItemLabel')}
					<p class="field-error">{getFirstError('curriculumItemLabel')}</p>
				{/if}
			</label>

			<label>
				<span>Šaltinio nuoroda</span>
				<input bind:value={formState.sourceRef} name="sourceRef" on:input={markDirty} />
				{#if getFirstError('sourceRef')}
					<p class="field-error">{getFirstError('sourceRef')}</p>
				{/if}
			</label>

			<label class="checkbox">
				<input type="checkbox" bind:checked={formState.isRequired} on:change={markDirty} />
				<span>Privaloma tema</span>
			</label>

			<div class="status-toggle" role="radiogroup" aria-label="Temos būsena">
				<span>Būsena *</span>
				<div class="status-toggle__buttons">
					<button
						type="button"
						on:click={() => setStatus('draft')}
						class:status-toggle__button--active={formState.status === 'draft'}
					>
						Juodraštis
					</button>
					<button
						type="button"
						on:click={() => setStatus('published')}
						class:status-toggle__button--active={formState.status === 'published'}
					>
						Publikuota
					</button>
				</div>
				{#if getFirstError('status')}
					<p class="field-error">{getFirstError('status')}</p>
				{:else if getFirstError('metadata.status')}
					<p class="field-error">{getFirstError('metadata.status')}</p>
				{/if}
			</div>
		</div>

		<footer class="drawer__footer">
			<button type="button" class="text" on:click={closeEditor} disabled={saving}>
				Atšaukti
			</button>
			<button class="primary" type="submit" disabled={saving}>
				{saving ? 'Saugoma...' : 'Išsaugoti'}
			</button>
		</footer>
	</form>
</aside>

<style>
	.concepts-shell {
		display: grid;
		gap: 1.5rem;
	}

	.concepts-shell__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.concepts-shell__header h1 {
		margin: 0;
		font-size: clamp(1.6rem, 3vw, 2.2rem);
	}

	.concepts-shell__header p {
		margin: 0.25rem 0 0;
		max-width: 40rem;
		color: var(--color-text-soft);
	}

	.primary {
		background: var(--color-pill-bg);
		color: var(--color-pill-text);
		border: 1px solid var(--color-pill-border);
		border-radius: 0.6rem;
		padding: 0.6rem 1.2rem;
		font-weight: 600;
		cursor: pointer;
	}

	.primary:hover,
	.primary:focus-visible {
		background: var(--color-pill-hover-bg);
		border-color: var(--color-pill-hover-border);
	}

	.text {
		background: none;
		border: none;
		color: var(--color-link);
		cursor: pointer;
		padding: 0.4rem 0.6rem;
	}

	.alert {
		padding: 0.9rem 1.1rem;
		border-radius: 0.75rem;
	}

	.alert--error {
		background: rgba(220, 38, 38, 0.1);
		border: 1px solid rgba(220, 38, 38, 0.4);
		color: rgb(185, 28, 28);
	}

	.muted {
		color: var(--color-text-soft);
	}

	.table-wrapper {
		overflow-x: auto;
		border-radius: 1rem;
		border: 1px solid var(--color-border);
		background: var(--color-panel);
	}

	.concept-table {
		width: 100%;
		border-collapse: collapse;
	}

	.concept-table th,
	.concept-table td {
		padding: 0.75rem 1rem;
		text-align: left;
		border-bottom: 1px solid var(--color-border);
	}

	.concept-table__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.concept-table__actions a {
		display: inline-flex;
		align-items: center;
		padding: 0.35rem 0.75rem;
		border-radius: 0.45rem;
		border: 1px solid var(--color-border-light);
		background: var(--color-panel);
		text-decoration: none;
		color: inherit;
		font-size: 0.85rem;
		transition: background 0.2s ease, border-color 0.2s ease;
	}

	.concept-table__actions button {
		border: 1px solid var(--color-border-light);
		background: var(--color-panel);
		border-radius: 0.45rem;
		padding: 0.35rem 0.75rem;
		cursor: pointer;
		transition: background 0.2s ease, border-color 0.2s ease;
	}

	.concept-table__actions a:hover,
	.concept-table__actions a:focus-visible {
		border-color: var(--color-border);
		background: var(--color-panel-hover);
	}

	.concept-table__actions button:hover,
	.concept-table__actions button:focus-visible {
		border-color: var(--color-border);
		background: var(--color-panel-hover);
	}

	.concept-table th {
		font-weight: 600;
	}

	.concept-name {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.concept-name__primary {
		font-weight: 600;
	}

	.concept-name__secondary {
		color: var(--color-text-soft);
		font-size: 0.9rem;
	}

	.concept-section {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.concept-section__title {
		color: var(--color-text-soft);
		font-size: 0.9rem;
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		background: rgba(107, 114, 128, 0.15);
		color: rgb(31, 41, 55);
		font-size: 0.85rem;
		font-weight: 600;
	}

	.status-badge--published {
		background: rgba(22, 163, 74, 0.15);
		color: rgb(22, 101, 52);
	}

	.drawer-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: rgba(15, 23, 42, 0.35);
		backdrop-filter: blur(2px);
		z-index: 40;
	}

	.drawer {
		position: fixed;
		top: 0;
		right: -480px;
		width: min(480px, 100vw);
		height: 100vh;
		background: var(--color-panel);
		box-shadow: -6px 0 24px rgba(15, 23, 42, 0.16);
		border-left: 1px solid var(--color-border);
		z-index: 41;
		transition: transform 0.3s ease, right 0.3s ease;
		transform: translateX(0);
	}

	.drawer--open {
		right: 0;
	}

	.drawer__form {
		display: grid;
		grid-template-rows: auto 1fr auto;
		height: 100%;
	}

	.drawer__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding: 1.4rem 1.6rem 1rem;
	}

	.drawer__header h2 {
		margin: 0;
		font-size: 1.4rem;
	}

	.form-grid {
		overflow-y: auto;
		padding: 0 1.6rem;
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.form-grid label {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		font-size: 0.95rem;
	}

	.form-grid input,
	.form-grid textarea {
		width: 100%;
		padding: 0.55rem 0.65rem;
		border-radius: 0.55rem;
		border: 1px solid var(--color-border);
		background: var(--color-panel-soft);
		color: var(--color-text);
		resize: vertical;
	}

	.form-grid__full {
		grid-column: 1 / -1;
	}

	.checkbox {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.checkbox input[type='checkbox'] {
		width: auto;
	}

	.status-toggle {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.status-toggle__buttons {
		display: inline-flex;
		gap: 0.4rem;
	}

	.status-toggle__buttons button {
		padding: 0.4rem 0.9rem;
		border-radius: 999px;
		border: 1px solid var(--color-border);
		background: var(--color-panel-soft);
		cursor: pointer;
	}

	.status-toggle__button--active {
		background: rgba(59, 130, 246, 0.15);
		border-color: rgba(59, 130, 246, 0.4);
		color: rgb(37, 99, 235);
	}

	.field-error {
		margin: 0;
		font-size: 0.85rem;
		color: rgb(185, 28, 28);
	}

	.drawer__footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.8rem;
		padding: 1.1rem 1.6rem 1.4rem;
		border-top: 1px solid var(--color-border);
	}

	@media (max-width: 720px) {
		.concepts-shell__header {
			flex-direction: column;
			align-items: stretch;
		}

		.form-grid {
			grid-template-columns: 1fr;
		}

		.drawer {
			width: min(100vw, 420px);
		}
	}
</style>
