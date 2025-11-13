<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { onDestroy, onMount } from 'svelte';
	import {
		listAdminConcepts,
		saveAdminConcept,
		deleteAdminConcept,
		fetchAdminConceptHistory,
		rollbackAdminConcept,
		type AdminConceptResource,
		type AdminConceptStatus,
		type AdminConceptVersion,
		type AdminConceptVersionStatus,
		adminConceptFormSchema
	} from '$lib/api/admin/concepts';
	import SectionSelect from '$lib/admin/SectionSelect.svelte';
	import { listCurriculumNodes } from '$lib/api/admin/curriculum';
	import type { AdminCurriculumNode } from '$lib/api/admin/curriculum';

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
		sourceRef: string;

		isRequired: boolean;
		status: AdminConceptStatus;
	};

	type FieldErrors = Record<string, string[]>;
	type HistoryAction = AdminConceptVersion & {

		statusLabel: string;
		isRollbackDisabled: boolean;
	};

	type SectionSelectOption = {
		key: string;
		label: string;
		sectionCode: string;

		sectionTitle: string;
		subsectionCode: string | null;
		subsectionTitle: string | null;
		nodeCode: string;
		disabled?: boolean;
		depth?: number;
	};


	let concepts: AdminConceptResource[] = [];
	let filteredConcepts: AdminConceptResource[] = [];
	let sectionOptions: SectionSelectOption[] = [];
	let sectionOptionsLoading = false;
	let sectionOptionsError: string | null = null;

	let filterSectionCode = 'all';
	let filterStatus: 'all' | AdminConceptStatus = 'all';
	let searchTerm = '';
	let totalMatches = 0;

	let selectedSectionOptionKey = '';
	let selectedSectionFallbackLabel: string | null = null;


	let loading = false;
	let loadError: string | null = null;
	let editorOpen = false;
	let editorMode: 'create' | 'edit' = 'create';
	let activeConcept: AdminConceptResource | null = null;

	let formState: ConceptFormState;
	let metadataSnapshot: Record<string, unknown> = { status: 'draft' };
	let formErrors: FieldErrors = {};
	let saveError: string | null = null;

	let saving = false;
	let successMessage: string | null = null;
	let successTimeout: ReturnType<typeof setTimeout> | null = null;
	let historyEntries: AdminConceptVersion[] = [];

	let historyActions: HistoryAction[] = [];
	let historyLoading = false;
	let historyError: string | null = null;
	let rollingBackVersionId: string | null = null;
	let rollbackError: string | null = null;

	let editorDirty = false;
	let initialSnapshot = '';
	let beforeUnloadAttached = false;
	let lastPrefilledSlug: string | null = null;
	let requestedSlug: string | null = null;
	let showAdvancedFields = false;
	let discardPromptVisible = false;
	let deleteConfirmSlug: string | null = null;
	let deletingSlug: string | null = null;
	let deleteError: string | null = null;
	const sectionLabelId = 'concept-section-select';

	const MAX_SLUG_LENGTH = 90;
	const SLUG_RANDOM_SEGMENT_LENGTH = 6;
	const SLUG_PREFIX = 'c';

	function randomSegment(length: number): string {
		const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
		let segment = '';

		if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
			const buffer = new Uint32Array(length);
			crypto.getRandomValues(buffer);
			for (const value of buffer) {
				segment += alphabet[value % alphabet.length];
			}
			return segment;
		}

		for (let index = 0; index < length; index += 1) {
			const next = Math.floor(Math.random() * alphabet.length);
			segment += alphabet[next];
		}

		return segment;
	}

	function generateRandomSlug(): string {
		const existing = new Set(concepts.map((concept) => concept.slug));
		let candidate = '';

		do {
			const partA = randomSegment(SLUG_RANDOM_SEGMENT_LENGTH);
			const partB = randomSegment(SLUG_RANDOM_SEGMENT_LENGTH);
			candidate = `${SLUG_PREFIX}-${partA}-${partB}`.slice(0, MAX_SLUG_LENGTH);
		} while (existing.has(candidate));

		return candidate;
	}

	function createEmptyFormState(): ConceptFormState {
		return {
			slug: generateRandomSlug(),
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
			sourceRef: '',
			isRequired: true,
			status: 'draft'
		};
	}

	formState = createEmptyFormState();

	$: draftDisabled = saving || (!editorDirty && formState.status === 'draft');
	$: publishDisabled = saving || (!editorDirty && formState.status === 'published');
	$: discardDisabled = saving || !editorDirty;

	function normalizeNodeTitle(title: string | null | undefined, fallback: string): string {
		const trimmed = (title ?? '').trim();
		return trimmed.length ? trimmed : fallback;
	}

	function sectionOptionLabel(option: SectionSelectOption): string {
		const subsection = option.subsectionTitle?.trim();
		if (subsection && subsection.length) {
			return subsection;
		}
		return normalizeNodeTitle(option.sectionTitle, option.sectionCode);
	}

	function resolveFormFallbackLabel(state: ConceptFormState): string | null {
		const subsection = state.subsectionTitle.trim();
		if (subsection.length) {
			return subsection;
		}

		const subsectionCode = state.subsectionCode.trim();
		if (subsectionCode.length) {
			return subsectionCode;
		}

		const section = state.sectionTitle.trim();
		if (section.length) {
			return section;
		}

		const sectionCode = state.sectionCode.trim();
		if (sectionCode.length) {
			return sectionCode;
		}

		return null;
	}

	function findMatchingOptionForForm(): SectionSelectOption | null {
		const nodeCode = formState.curriculumNodeCode.trim();
		if (nodeCode.length) {
			const byNode = sectionOptions.find((option) => !option.disabled && option.nodeCode === nodeCode);
			if (byNode) {
				return byNode;
			}
		}

		const subsectionCode = formState.subsectionCode.trim();
		if (subsectionCode.length) {
			const bySubsection = sectionOptions.find(
				(option) => !option.disabled && option.subsectionCode === subsectionCode
			);
			if (bySubsection) {
				return bySubsection;
			}
		}

		const sectionCode = formState.sectionCode.trim();
		if (sectionCode.length) {
			const bySection = sectionOptions.find(
				(option) => option.sectionCode === sectionCode && option.disabled === true
			);
			if (bySection) {
				return bySection;
			}
		}

		return null;
	}

	function syncSelectedSectionFromForm(): void {
		const match = findMatchingOptionForForm();
		if (match) {
			selectedSectionOptionKey = match.key;
			selectedSectionFallbackLabel = sectionOptionLabel(match);
			return;
		}

		selectedSectionOptionKey = '';
		selectedSectionFallbackLabel = resolveFormFallbackLabel(formState);
	}

	syncSelectedSectionFromForm();

	async function loadSectionOptions(): Promise<void> {
		sectionOptionsLoading = true;
		sectionOptionsError = null;

		try {
			const compiled: SectionSelectOption[] = [];
			const rootNodes = await listCurriculumNodes(null);

			for (const root of rootNodes) {
				const sectionTitle = normalizeNodeTitle(root.title, root.code);
				compiled.push({
					key: `section:${root.code}`,
					label: sectionTitle,
					sectionCode: root.code,
					sectionTitle,
					subsectionCode: null,
					subsectionTitle: null,
					nodeCode: root.code,
					disabled: true,
					depth: 0
				});

				await appendChildren(root, 1, root, compiled);
			}

			sectionOptions = compiled;
			syncSelectedSectionFromForm();
		} catch (error) {
			sectionOptionsError =
				error instanceof Error ? error.message : 'Nepavyko įkelti skyrių iš mokymo plano.';
			sectionOptions = [];
			syncSelectedSectionFromForm();
		} finally {
			sectionOptionsLoading = false;
		}
	}

	async function appendChildren(
		parent: AdminCurriculumNode,
		depth: number,
		sectionRoot: AdminCurriculumNode,
		collector: SectionSelectOption[]
	): Promise<void> {
		const children = await listCurriculumNodes(parent.code);
		if (!children.length) {
			return;
		}

		const sectionTitle = normalizeNodeTitle(sectionRoot.title, sectionRoot.code);

		for (const child of children) {
			const childTitle = normalizeNodeTitle(child.title, child.code);
			collector.push({
				key: `node:${sectionRoot.code}:${child.code}`,
				label: childTitle,
				sectionCode: sectionRoot.code,
				sectionTitle,
				subsectionCode: child.code,
				subsectionTitle: childTitle,
				nodeCode: child.code,
				disabled: false,
				depth
			});

			await appendChildren(child, depth + 1, sectionRoot, collector);
		}
	}

	onMount(() => {
		void refreshConcepts();
		void loadSectionOptions();
	});

	$: requestedSlug = $page.url.searchParams.get('slug');
	$: if (!loading && !loadError && concepts.length && requestedSlug) {
		const target = concepts.find((concept) => concept.slug === requestedSlug);
		if (target && requestedSlug !== lastPrefilledSlug) {
			openEdit(target);
			lastPrefilledSlug = requestedSlug;
		}
	}

	$: if (!requestedSlug) {
		lastPrefilledSlug = null;
	}

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
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'Nepavyko įkelti sąvokų sąrašo.';
		} finally {
			loading = false;
		}
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

	function handleTermLtInput(): void {
		markDirty();
	}

	function handleSectionChange(option: SectionSelectOption): void {
		const sectionTitle = option.sectionTitle?.trim().length ? option.sectionTitle.trim() : option.sectionCode;
		const subsectionCode = option.subsectionCode ?? '';
		const subsectionTitle = option.subsectionTitle?.trim().length
			? option.subsectionTitle.trim()
			: subsectionCode;
		const previousNode = formState.curriculumNodeCode.trim();
		const nextNode = option.nodeCode ?? '';
		const preserveOrdinal = previousNode.length && previousNode === nextNode;

		selectedSectionOptionKey = option.key;
		selectedSectionFallbackLabel = sectionOptionLabel(option);

		formState = {
			...formState,
			sectionCode: option.sectionCode,
			sectionTitle,
			subsectionCode,
			subsectionTitle: subsectionCode.length ? subsectionTitle : '',
			curriculumNodeCode: nextNode,
			curriculumItemOrdinal: preserveOrdinal ? formState.curriculumItemOrdinal : ''
		};

		formErrors = {
			...formErrors,
			sectionCode: [],
			sectionTitle: [],
			subsectionCode: [],
			subsectionTitle: [],
			curriculumNodeCode: [],
			curriculumItemOrdinal: []
		};

		markDirty();
		syncSelectedSectionFromForm();
	}

	const ADVANCED_FIELDS = new Set(['slug', 'sourceRef', 'isRequired']);

	function ensureAdvancedVisibleForErrors(errors: FieldErrors): void {
		if (showAdvancedFields) {
			return;
		}

		for (const [field, issues] of Object.entries(errors)) {
			if (issues && issues.length && ADVANCED_FIELDS.has(field)) {
				showAdvancedFields = true;
				return;
			}
		}
	}

	function resetForm(): void {
		formState = createEmptyFormState();
		metadataSnapshot = { status: 'draft' };
		formErrors = {};
		saveError = null;
		showAdvancedFields = false;
		setInitialSnapshot(formState, metadataSnapshot);
		syncSelectedSectionFromForm();
	}

	function openCreate(): void {
		editorMode = 'create';
		activeConcept = null;
		discardPromptVisible = false;
		resetForm();
		historyEntries = [];
	 	historyActions = [];
		historyError = null;
		historyLoading = false;
		rollingBackVersionId = null;
		rollbackError = null;
		deleteConfirmSlug = null;
		deleteError = null;
		editorOpen = true;
	}

	function openEdit(concept: AdminConceptResource): void {
		editorMode = 'edit';
		activeConcept = concept;
		formState = conceptToFormState(concept);
		metadataSnapshot = cloneMetadata(concept.metadata);
		showAdvancedFields = false;
		discardPromptVisible = false;
		deleteConfirmSlug = null;
		deleteError = null;

		if (typeof metadataSnapshot.status !== 'string') {
			metadataSnapshot.status = concept.status;
		}

		formErrors = {};
		saveError = null;
		setInitialSnapshot(formState, metadataSnapshot);
		syncSelectedSectionFromForm();
		historyEntries = [];
	 	historyActions = [];
		historyError = null;
		historyLoading = false;
		rollingBackVersionId = null;
		rollbackError = null;
		void loadHistory(concept.slug);
		editorOpen = true;
	}

	function finalizeCloseEditor(): void {
		resetForm();
		activeConcept = null;
		editorMode = 'create';
		editorOpen = false;
		editorDirty = false;
		discardPromptVisible = false;
		showAdvancedFields = false;
		historyEntries = [];
	 	historyActions = [];
		historyError = null;
		historyLoading = false;
		deleteConfirmSlug = null;
		deleteError = null;
	}

	function requestCloseEditor(): void {
		if (saving) {
			return;
		}

		if (!hasUnsavedChanges()) {
			finalizeCloseEditor();
			return;
		}

		discardPromptVisible = true;
	}

	function cancelDiscardPrompt(): void {
		discardPromptVisible = false;
	}

	function confirmDiscardChanges(): void {
		discardPromptVisible = false;
		finalizeCloseEditor();
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
		rollbackError = null;
		rollingBackVersionId = null;
		try {
			historyEntries = await fetchAdminConceptHistory(slug, { limit: 20 });
			historyActions = historyEntries.map((entry) => ({
				...entry,
				statusLabel: resolveHistoryStatus(entry.status),
				isRollbackDisabled: !entry.hasSnapshot
			}));
		} catch (error) {
			historyError = error instanceof Error ? error.message : 'Nepavyko įkelti istorijos.';
			historyEntries = [];
			historyActions = [];
		} finally {
			historyLoading = false;
		}
	}

	async function handleRollback(version: HistoryAction): Promise<void> {
		if (!activeConcept) {
			rollbackError = 'Nėra aktyviai redaguojamos sąvokos.';
			return;
		}

		if (!version.hasSnapshot) {
			rollbackError = 'Pasirinkta versija neturi pilnos kopijos atkūrimui.';
			return;
		}

		if (rollingBackVersionId) {
			return;
		}

		if (hasUnsavedChanges() && !confirmDiscard()) {
			rollingBackVersionId = null;
			return;
		}

		if (typeof window !== 'undefined') {
			const confirmed = window.confirm(
				`Atkurti sąvoką į ${version.version ?? 'pasirinktą'} versiją? Dabartiniai juodraščio pakeitimai bus prarasti.`
			);
			if (!confirmed) {
				return;
			}
		}

		rollingBackVersionId = version.id;
		rollbackError = null;

		try {
			const restored = await rollbackAdminConcept(activeConcept.slug, version.id);
			applySavedConcept(restored);
			openEdit(restored);
			showSuccess('Sąvoka atkurta į pasirinktą versiją.');
		} catch (error) {
			rollbackError =
				error instanceof Error ? error.message : 'Nepavyko atkurti sąvokos versijos.';
		} finally {
			rollingBackVersionId = null;
		}
	}

	function buildPayload(state: ConceptFormState): AdminConceptMutationInput {
		return {
			slug: state.slug.trim(),
			originalSlug: editorMode === 'edit' && activeConcept ? activeConcept.slug : undefined,
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
			curriculumItemLabel: null,
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
			requestCloseEditor();
			return;
		}

		if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
			event.preventDefault();
			requestCloseEditor();
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

	async function handleSubmit(intent: 'draft' | 'publish'): Promise<void> {
		if (saving) {
			return;
		}

		saveError = null;
		const targetStatus: AdminConceptStatus = intent === 'publish' ? 'published' : 'draft';
		if (formState.status !== targetStatus || metadataSnapshot.status !== targetStatus) {
			setStatus(targetStatus);
		} else {
			formErrors = { ...formErrors, status: [], 'metadata.status': [] };
		}

		const payload = buildPayload(formState);
		const validation = adminConceptFormSchema.safeParse(payload);

		if (!validation.success) {
			const flattened = validation.error.flatten();
			formErrors = flattened.fieldErrors as FieldErrors;
			ensureAdvancedVisibleForErrors(formErrors);
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
			const wasEdit = editorMode === 'edit';
			const successText = intent === 'publish'
				? 'Sąvoka publikuota.'
				: wasEdit
				? 'Sąvoka atnaujinta.'
				: 'Sąvoka sukurta.';
			showSuccess(successText);
			finalizeCloseEditor();
		} catch (error) {
			saveError = error instanceof Error ? error.message : 'Nepavyko išsaugoti sąvokų.';
		} finally {
			saving = false;
		}
	}

	function submitDraft(): void {
		void handleSubmit('draft');
	}

	function submitPublish(): void {
		void handleSubmit('publish');
	}

	function restoreInitialState(): void {
		if (!initialSnapshot) {
			return;
		}

		try {
			const parsed = JSON.parse(initialSnapshot) as {
				state: ConceptFormState;
				metadata: Record<string, unknown>;
			};
			formState = parsed.state;
			metadataSnapshot = parsed.metadata ?? { status: 'draft' };
			formErrors = {};
			saveError = null;
			syncSelectedSectionFromForm();
			setInitialSnapshot(formState, metadataSnapshot);
			clearSuccessMessage();
		} catch (error) {
			console.warn('Nepavyko atkurti pradinės būsenos.', error);
		}
	}

	function requestDeleteConcept(concept: AdminConceptResource): void {
		deleteConfirmSlug = concept.slug;
		deleteError = null;
	}

	function cancelDeleteRequest(): void {
		if (deletingSlug) {
			return;
		}
		deleteConfirmSlug = null;
		deleteError = null;
	}

	async function confirmDeleteConcept(): Promise<void> {
		if (!deleteConfirmSlug || deletingSlug) {
			return;
		}

		const targetSlug = deleteConfirmSlug;
		deletingSlug = targetSlug;
		deleteError = null;

		try {
			await deleteAdminConcept(targetSlug);
			const remaining = concepts.filter((concept) => concept.slug !== targetSlug);
			concepts = sortConcepts(remaining);
			if (activeConcept && activeConcept.slug === targetSlug) {
				finalizeCloseEditor();
			}
			showSuccess('Sąvoka pašalinta.');
			deleteConfirmSlug = null;
		} catch (error) {
			deleteError = error instanceof Error ? error.message : 'Nepavyko ištrinti sąvokos.';
		} finally {
			deletingSlug = null;
		}
	}

	const statusLabels: Record<AdminConceptStatus, string> = {
		draft: 'Juodraštis',
		published: 'Publikuota'
	};

	const historyStatusLabels: Record<AdminConceptVersionStatus, string> = {
		draft: 'Juodraštis',
		in_review: 'Peržiūroje',
		published: 'Publikuota',
		archived: 'Archyvuota'
	};

	function resolveHistoryStatus(status: AdminConceptVersionStatus | null | undefined): string {
		if (!status) {
			return 'Nežinoma būsena';
		}

		return historyStatusLabels[status] ?? status;
	}

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
			<h1>Sąvokų administravimas</h1>
			<p>
				Kurti ir atnaujinti mokomąsias sąvokas. Administratoriaus pakeitimai saugomi ir žymimi kaip
				juodraščiai arba publikuoti įrašai.
			</p>
		</div>
		<button class="primary" type="button" on:click={openCreate}>Nauja sąvoka</button>
	</header>

	{#if successMessage}
		<div class="alert alert--success">{successMessage}</div>
	{/if}

	{#if loadError}
		<div class="alert alert--error">{loadError}</div>
	{:else if loading}
		<p class="muted">Įkeliama...</p>
	{:else if !concepts.length}
		<p class="muted">Dar nėra sukurtų sąvokų.</p>
	{:else}
		<div class="table-wrapper">
			<table class="concept-table">
				<thead>
					<tr>
						<th scope="col">Sąvoka</th>
						<th scope="col">Skyrius</th>
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
									<a
										href={`${resolve('/concepts/[slug]', { slug: concept.slug })}?admin=1`}
										target="_blank"
										rel="noreferrer"
										class="concept-name__primary"
									>
										{concept.termLt}
									</a>
									{#if concept.termEn}
										<span class="concept-name__secondary">{concept.termEn}</span>
									{/if}
								</div>
							</td>
							<td>
								<div class="concept-section">
									<span>{concept.subsectionCode ?? concept.sectionCode}</span>
									{#if concept.subsectionTitle ?? concept.sectionTitle}
										<span class="concept-section__title">
											{concept.subsectionTitle ?? concept.sectionTitle}
										</span>
									{/if}
								</div>
							</td>
							<td>
								<span class:status-badge--published={concept.status === 'published'} class="status-badge">
									{statusLabels[concept.status]}
								</span>
							</td>
							<td>{formatTimestamp(concept.updatedAt)}</td>
							<td>
								<div class="concept-table__actions">
									<button type="button" on:click={() => openEdit(concept)}>Redaguoti</button>
									<button
										type="button"
										class="danger"
										on:click={() => requestDeleteConcept(concept)}
									>
										Šalinti
									</button>
								</div>
								{#if deleteConfirmSlug === concept.slug}
									<div class="concept-table__delete-confirm">
										<p>
											Ar tikrai norite pašalinti "{concept.termLt}" sąvoką?
										</p>
										{#if deleteError}
											<p class="concept-table__delete-error">{deleteError}</p>
										{/if}
										<div class="concept-table__delete-actions">
											<button
												type="button"
												class="danger"
												on:click={confirmDeleteConcept}
												disabled={deletingSlug === concept.slug}
											>
												{deletingSlug === concept.slug ? 'Šalinama...' : 'Patvirtinti'}
											</button>
											<button
												type="button"
												on:click={cancelDeleteRequest}
												disabled={deletingSlug === concept.slug}
											>
												Atšaukti
											</button>
										</div>
									</div>
								{/if}
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
		aria-label="Uždaryti sąvokų redagavimo formą"
		on:click={requestCloseEditor}
		on:keydown={handleBackdropKeydown}
	></div>
{/if}

<aside class:drawer--open={editorOpen} class="drawer" aria-hidden={!editorOpen}>
	<form class="drawer__form" on:submit|preventDefault={submitDraft}>
		<header class="drawer__header">
			<div>
				<h2>{editorMode === 'edit' ? 'Redaguoti sąvoką' : 'Nauja sąvoka'}</h2>
				{#if activeConcept}
					<p class="muted">Redaguojama: <code>{activeConcept.slug}</code></p>
				{/if}
			</div>
			<button type="button" on:click={requestCloseEditor} class="text">Uždaryti</button>
		</header>

		<div class="drawer__content">
			{#if saveError}
				<div class="alert alert--error">{saveError}</div>
			{/if}

			<div class="form-grid form-grid--basic">
				<label>
					<span>Sąvoka (LT) *</span>
					<input bind:value={formState.termLt} name="termLt" required on:input={handleTermLtInput} />
					{#if getFirstError('termLt')}
						<p class="field-error">{getFirstError('termLt')}</p>
					{/if}
				</label>

				<label>
					<span>Sąvoka (EN)</span>
					<input bind:value={formState.termEn} name="termEn" on:input={markDirty} />
					{#if getFirstError('termEn')}
						<p class="field-error">{getFirstError('termEn')}</p>
					{/if}
				</label>

				<label class="form-grid__full">
					<span>Aprašymas (LT) *</span>
					<textarea
						bind:value={formState.descriptionLt}
						name="descriptionLt"
						rows="4"
						required
						on:input={markDirty}
					></textarea>
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

				<label class="form-grid__full">
					<span id={sectionLabelId}>Skyrius *</span>
					<SectionSelect
						labelledBy={sectionLabelId}
						options={sectionOptions}
						valueKey={selectedSectionOptionKey}
						valueLabel={selectedSectionFallbackLabel}
						disabled={!sectionOptions.length || sectionOptionsLoading}
						on:change={(event) => handleSectionChange(event.detail)}
					/>
					{#if sectionOptionsLoading}
						<p class="muted">Įkeliami skyriai...</p>
					{:else if sectionOptionsError}
						<p class="field-error">{sectionOptionsError}</p>
					{/if}
					{#if getFirstError('sectionCode')}
						<p class="field-error">{getFirstError('sectionCode')}</p>
					{/if}
					{#if getFirstError('sectionTitle')}
						<p class="field-error">{getFirstError('sectionTitle')}</p>
					{/if}
					{#if getFirstError('subsectionCode')}
						<p class="field-error">{getFirstError('subsectionCode')}</p>
					{/if}
					{#if getFirstError('curriculumNodeCode')}
						<p class="field-error">{getFirstError('curriculumNodeCode')}</p>
					{/if}
					{#if getFirstError('curriculumItemOrdinal')}
						<p class="field-error">{getFirstError('curriculumItemOrdinal')}</p>
					{/if}
				</label>
			</div>

			<div class="advanced-toggle">
				<button
					type="button"
					on:click={() => (showAdvancedFields = !showAdvancedFields)}
					aria-expanded={showAdvancedFields}
					aria-controls="concept-advanced-fields"
				>
					{showAdvancedFields ? 'Slėpti papildomus laukus' : 'Rodyti papildomus laukus'}
				</button>
			</div>

			{#if showAdvancedFields}
				<div class="form-grid form-grid--advanced" id="concept-advanced-fields">
				<label>
					<span>Slug *</span>
					<input
						bind:value={formState.slug}
						name="slug"
						required
						readonly
					/>
					{#if getFirstError('slug')}
						<p class="field-error">{getFirstError('slug')}</p>
					{/if}
					<p class="field-hint">Slug generuojamas automatiškai ir nėra redaguojamas.</p>
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
					<span>Privaloma sąvoka</span>
				</label>
			</div>
			{/if}

			<section class="history-panel" aria-live="polite">
				<header class="history-panel__header">
					<h3>Versijų istorija</h3>
					<p class="muted">Atkūrimas apima sekciją, poskyrius ir susietą sąvoką.</p>
				</header>
				{#if rollbackError}
					<div class="alert alert--error">{rollbackError}</div>
				{/if}
				{#if historyLoading}
					<p class="muted">Įkeliama versijų istorija…</p>
				{:else if historyError}
					<p class="field-error">{historyError}</p>
				{:else if !historyActions.length}
					<p class="muted">Dar nėra užfiksuotų versijų.</p>
				{:else}
					<ul class="history-list">
						{#each historyActions as version (version.id)}
							<li class="history-item">
								<div class="history-item__summary">
									<span class="history-item__version">Versija {version.version ?? '–'}</span>
									<span class="history-item__status">{version.statusLabel}</span>
								</div>
								<div class="history-item__details">
									<span>{formatTimestamp(version.createdAt)}</span>
									{#if version.createdBy}
										<span>{version.createdBy}</span>
									{/if}
								</div>
								<div class="history-item__actions">
									<button
										type="button"
										on:click={() => handleRollback(version)}
										disabled={version.isRollbackDisabled || !!rollingBackVersionId}
									>
										{rollingBackVersionId === version.id ? 'Atkuriama…' : 'Atkurti'}
									</button>
									{#if version.isRollbackDisabled}
										<span class="history-item__hint">Trūksta kopijos atkūrimui</span>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

		</div>

		<footer class="drawer__footer" class:drawer__footer--confirm={discardPromptVisible}>
			{#if discardPromptVisible}
				<div class="drawer__confirm">
					<p>Yra neišsaugotų pakeitimų. Ar tikrai uždaryti be išsaugojimo?</p>
					<div class="drawer__confirm-actions">
						<button type="button" on:click={cancelDiscardPrompt}>
							Tęsti redagavimą
						</button>
						<button type="button" class="danger" on:click={confirmDiscardChanges}>
							Atmesti pakeitimus
						</button>
					</div>
				</div>
			{:else}
				<button type="button" class="text" on:click={requestCloseEditor} disabled={saving}>
					Uždaryti
				</button>
				<div class="drawer__actions">
					<div class="concept-admin-actions">
						<button
							type="submit"
							class="concept-admin-button concept-admin-button--primary"
							disabled={draftDisabled}
						>
							{saving && formState.status !== 'published' ? 'Saugoma…' : 'Į juodraštį'}
						</button>
						<button
							type="button"
							class="concept-admin-button concept-admin-button--publish"
							on:click={submitPublish}
							disabled={publishDisabled}
						>
							{saving && formState.status === 'published' ? 'Publikuojama…' : 'Publikuoti'}
						</button>
						<button
							type="button"
							class="concept-admin-button"
							on:click={restoreInitialState}
							disabled={discardDisabled}
						>
							Atmesti
						</button>
					</div>
					{#if getFirstError('status')}
						<p class="field-error drawer__status-error">{getFirstError('status')}</p>
					{:else if getFirstError('metadata.status')}
						<p class="field-error drawer__status-error">{getFirstError('metadata.status')}</p>
					{/if}
				</div>
			{/if}
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

	.danger {
		background: rgba(220, 38, 38, 0.08);
		color: rgb(185, 28, 28);
		border: 1px solid rgba(220, 38, 38, 0.35);
		border-radius: 0.55rem;
		padding: 0.45rem 0.9rem;
		font-weight: 600;
		cursor: pointer;
	}

	.danger:hover,
	.danger:focus-visible {
		background: rgba(220, 38, 38, 0.16);
		border-color: rgba(220, 38, 38, 0.5);
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

	.alert--success {
		background: rgba(22, 163, 74, 0.12);
		border: 1px solid rgba(22, 163, 74, 0.35);
		color: rgb(22, 101, 52);
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
	.concept-table__delete-confirm {
		margin-top: 0.6rem;
		padding: 0.75rem 0.9rem;
		border-radius: 0.6rem;
		background: rgba(220, 38, 38, 0.08);
		display: grid;
		gap: 0.5rem;
	}

	.concept-table__delete-confirm p {
		margin: 0;
	}

	.concept-table__delete-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.concept-table__delete-error {
		margin: 0;
		color: rgb(185, 28, 28);
		font-size: 0.9rem;
	}

	.concept-table__actions button {
		border: 1px solid var(--color-border-light);
		background: var(--color-panel);
		border-radius: 0.45rem;
		padding: 0.35rem 0.75rem;
		cursor: pointer;
		transition: background 0.2s ease, border-color 0.2s ease;
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
		color: var(--color-link);
		text-decoration: none;
	}

	.concept-name__primary:hover,
	.concept-name__primary:focus-visible {
		text-decoration: underline;
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

	.drawer__content {
		overflow-y: auto;
		padding: 0 1.6rem 1.4rem;
		display: flex;
		flex-direction: column;
		gap: 1.4rem;
	}

	.form-grid {
		display: grid;
		gap: 1rem;
	}

	.form-grid--basic {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.form-grid--advanced {
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

	.advanced-toggle button {
		padding: 0;
		background: none;
		border: none;
		color: var(--color-link);
		font-weight: 600;
		cursor: pointer;
	}

	.field-hint {
		margin: 0.35rem 0 0;
		font-size: 0.82rem;
		color: var(--color-text-soft);
	}

	.drawer__confirm {
		border: 1px solid var(--color-border);
		border-radius: 0.75rem;
		padding: 0.9rem 1rem;
		display: grid;
		gap: 0.6rem;
		background: var(--color-panel-soft);
	}

	.drawer__confirm p {
		margin: 0;
	}

	.drawer__confirm-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.field-error {
		margin: 0;
		font-size: 0.85rem;
		color: rgb(185, 28, 28);
	}

	.drawer__footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.8rem;
		padding: 1.1rem 1.6rem 1.4rem;
		border-top: 1px solid var(--color-border);
	}

	.drawer__footer--confirm {
		flex-direction: column;
		align-items: stretch;
	}

	.drawer__actions {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		align-items: flex-end;
		flex: 1 1 auto;
		min-width: 0;
	}

	.drawer__status-error {
		text-align: right;
	}

	.concept-admin-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		justify-content: flex-end;
	}

	.concept-admin-button {
		border: 1px solid var(--color-border-light);
		background: var(--color-panel-secondary);
		border-radius: 0.65rem;
		padding: 0.6rem 1rem;
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
		transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
		white-space: nowrap;
	}

	.concept-admin-button:hover,
	.concept-admin-button:focus-visible {
		border-color: var(--color-border);
		background: var(--color-panel-hover);
		box-shadow: 0 0 0 2px var(--color-accent-faint-strong);
	}

	.concept-admin-button--primary {
		background: var(--color-panel);
		border-color: var(--color-border);
	}

	.concept-admin-button--publish {
		background: var(--color-accent-faint);
		border-color: var(--color-accent-border-strong);
		color: var(--color-accent-strong);
	}

	.concept-admin-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.history-panel {
		border: 1px solid var(--color-border);
		border-radius: 0.9rem;
		padding: 1rem 1.1rem;
		display: grid;
		gap: 0.8rem;
		background: var(--color-panel-soft);
	}

	.history-panel__header {
		display: grid;
		gap: 0.25rem;
	}

	.history-panel__header h3 {
		margin: 0;
		font-size: 1.08rem;
	}

	.history-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.6rem;
	}

	.history-item {
		display: grid;
		gap: 0.45rem;
		padding: 0.75rem 0.85rem;
		border: 1px solid var(--color-border-light);
		border-radius: 0.75rem;
		background: var(--color-panel);
	}

	.history-item__summary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
	}

	.history-item__status {
		color: var(--color-text-soft);
		font-size: 0.9rem;
	}

	.history-item__details {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		color: var(--color-text-soft);
		font-size: 0.9rem;
	}

	.history-item__actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.history-item__actions button {
		border: 1px solid var(--color-border);
		background: var(--color-panel-secondary);
		border-radius: 0.55rem;
		padding: 0.45rem 0.9rem;
		font-weight: 600;
		cursor: pointer;
	}

	.history-item__actions button:hover,
	.history-item__actions button:focus-visible {
		border-color: var(--color-border);
		background: var(--color-panel-hover);
	}

	.history-item__actions button:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}

	.history-item__hint {
		font-size: 0.82rem;
		color: var(--color-text-soft);
	}

	@media (max-width: 720px) {
		.concepts-shell__header {
			flex-direction: column;
			align-items: stretch;
		}

		.form-grid--basic,
		.form-grid--advanced {
			grid-template-columns: 1fr;
		}

		.drawer {
			width: min(100vw, 420px);
		}

		.drawer__footer {
			flex-direction: column;
			align-items: stretch;
		}

		.drawer__actions {
			align-items: stretch;
		}

		.concept-admin-actions {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
