<script lang="ts">
import { resolve } from '$app/paths';
import { onMount, onDestroy, tick } from 'svelte';
import { AdminApiError } from '$lib/api/admin/client';
import {
	listAdminMediaAssets,
	getAdminMediaAsset,
	deleteAdminMediaAsset,
	fetchAdminMediaSignedUrl,
	updateAdminMediaAsset,
	type AdminMediaAsset,
	type AdminMediaAssetType,
	type AdminMediaListMeta,
	type AdminMediaSourceKind
} from '$lib/api/admin/media';
import {
	listAdminConcepts,
	type AdminConceptResource
} from '$lib/api/admin/concepts';
import AdminMediaCreateDrawer from '$lib/admin/media/AdminMediaCreateDrawer.svelte';
	import type {
		MediaConceptOption,
		MediaCreateSuccessDetail
	} from '$lib/admin/media/types';

	type PreviewKind = 'image' | 'video' | 'externalVideo' | 'link';
	type PreviewState = {
		kind: PreviewKind;
		url: string;
	};

	type EditFieldName = 'title' | 'conceptId' | 'captionLt' | 'captionEn';
	type EditFieldErrors = Partial<Record<EditFieldName, string>>;

	type ListState = {
		items: AdminMediaAsset[];
		meta: AdminMediaListMeta;
	};

	const DEFAULT_META: AdminMediaListMeta = {
		count: 0,
		hasMore: false,
		nextCursor: null,
		fetchedAt: null
	};

	let listState: ListState = {
		items: [],
		meta: DEFAULT_META
	};

	let loading = true;
	let loadError: string | null = null;
	let loadMoreLoading = false;

	let conceptOptions: AdminConceptResource[] = [];
	let conceptLookup = new Map<string, AdminConceptResource>();
	let conceptLoading = false;
	let conceptError: string | null = null;

	let filterConceptId: string = 'all';
	let filterAssetType: 'all' | AdminMediaAssetType = 'all';
	let filterSourceKind: 'all' | AdminMediaSourceKind = 'all';
	let searchInput = '';
	let searchTerm = '';
	let searchTimer: ReturnType<typeof setTimeout> | null = null;

	let selectedAsset: AdminMediaAsset | null = null;
	let detailAsset: AdminMediaAsset | null = null;
	let detailLoading = false;
	let detailError: string | null = null;

	let editMode = false;
	let editBusy = false;
	let editError: string | null = null;
	let editFieldErrors: EditFieldErrors = {};
	let editTitle = '';
	let editCaptionLt = '';
	let editCaptionEn = '';
	let editConceptId = '';

	let deleteBusy = false;
	let deleteError: string | null = null;
	let deleteConfirmVisible = false;
	let deleteConfirmTimer: ReturnType<typeof setTimeout> | null = null;
	let actionError: string | null = null;
	let rowDeleteBusyId: string | null = null;

	let selectedIds: Set<string> = new Set();
	let bulkDeleteBusy = false;
	let selectAllCheckbox: HTMLInputElement | null = null;

	let preview: PreviewState | null = null;
	let previewLoading = false;
	let previewError: string | null = null;
	let previewLoadToken = 0;
	let previewModalOpen = false;
	let previewModal: HTMLDialogElement | null = null;
	let previewTrigger: HTMLElement | null = null;

	let successMessage: string | null = null;
	let successTimer: ReturnType<typeof setTimeout> | null = null;

	let createDrawerOpen = false;
	let createDefaultConceptId: string | null = null;
	let createLockedConcept = false;

	const assetTypeLabels: Record<AdminMediaAssetType, string> = {
		image: 'Paveiksliukas',
		video: 'Vaizdo įrašas'
	};

	const sourceKindLabels: Record<AdminMediaSourceKind, string> = {
		upload: 'Įkeltas failas',
		external: 'Išorinis šaltinis'
	};

	const dateFormatter = new Intl.DateTimeFormat('lt-LT', {
		dateStyle: 'medium',
		timeStyle: 'short'
	});

	onMount(async () => {
		applyQueryDefaults();
		await Promise.all([loadConceptOptions(), loadMedia()]);
		await tick();
		updateSelectAllIndeterminate();
	});

	onDestroy(() => {
		if (searchTimer) {
			clearTimeout(searchTimer);
			searchTimer = null;
		}

		if (successTimer) {
			clearTimeout(successTimer);
			successTimer = null;
		}

		if (deleteConfirmTimer) {
			clearTimeout(deleteConfirmTimer);
			deleteConfirmTimer = null;
		}

		closePreviewModal();
	});

	function applyQueryDefaults(): void {
		if (typeof window === 'undefined') {
			return;
		}

		const params = new URLSearchParams(window.location.search);
		const conceptParam = params.get('conceptId');
		const assetTypeParam = params.get('assetType');
		const sourceParam = params.get('sourceKind');
		const searchParam = params.get('search');

		if (conceptParam) {
			filterConceptId = conceptParam;
		}

		if (assetTypeParam === 'image' || assetTypeParam === 'video') {
			filterAssetType = assetTypeParam;
		}

		if (sourceParam === 'upload' || sourceParam === 'external') {
			filterSourceKind = sourceParam;
		}

		if (searchParam) {
			searchInput = searchParam;
			searchTerm = searchParam;
		}
	}

	function setSuccess(message: string): void {
		actionError = null;
		if (successTimer) {
			clearTimeout(successTimer);
		}
		successMessage = message;
		successTimer = setTimeout(() => {
			successMessage = null;
			successTimer = null;
		}, 4000);
	}

	function openCreate(options: { conceptId?: string; lockConcept?: boolean } = {}): void {
		const fallbackConcept =
			options.conceptId ?? (filterConceptId !== 'all' ? filterConceptId : null);

		createDefaultConceptId = fallbackConcept;
		createLockedConcept = Boolean(options.lockConcept && fallbackConcept);
		createDrawerOpen = true;
	}

	function closeCreateDrawer(): void {
		createDrawerOpen = false;
	}

	function handleCreateSuccess(event: CustomEvent<MediaCreateSuccessDetail>): void {
		const asset = event.detail.asset;
		setSuccess('Medijos įrašas sukurtas.');
		createDrawerOpen = false;
		void refreshList();
		if (selectedAsset && selectedAsset.id === asset.id) {
			selectedAsset = asset;
			detailAsset = asset;
			resetEditState(asset);
			clearPreview();
			void loadPreview(asset);
		}
	}

	function populateEditForm(asset: AdminMediaAsset | null): void {
		if (asset) {
			editTitle = asset.title?.trim() ?? '';
			editCaptionLt = asset.captionLt ?? '';
			editCaptionEn = asset.captionEn ?? '';
			editConceptId = asset.conceptId ?? '';
		} else {
			editTitle = '';
			editCaptionLt = '';
			editCaptionEn = '';
			editConceptId = '';
		}
	}

	function resetEditState(asset: AdminMediaAsset | null = detailAsset): void {
		editMode = false;
		editBusy = false;
		editError = null;
		editFieldErrors = {};
		populateEditForm(asset ?? null);
	}

	function beginEdit(): void {
		if (!detailAsset) {
			return;
		}
		populateEditForm(detailAsset);
		editMode = true;
		editError = null;
		editFieldErrors = {};
	}

	function cancelEdit(): void {
		resetEditState(detailAsset);
	}

	function normalizeEditableText(value: string): string | null {
		const trimmed = value.trim();
		return trimmed.length ? trimmed : null;
	}

	function buildEditPayload(asset: AdminMediaAsset): Parameters<typeof updateAdminMediaAsset>[1] {
		const payload: Parameters<typeof updateAdminMediaAsset>[1] = {};
		const trimmedTitle = editTitle.trim();
		const currentTitle = asset.title?.trim() ?? '';
		if (trimmedTitle !== currentTitle) {
			payload.title = trimmedTitle;
		}

		if (editConceptId && editConceptId !== asset.conceptId) {
			payload.conceptId = editConceptId;
		}

		const nextCaptionLt = normalizeEditableText(editCaptionLt);
		const currentCaptionLt = asset.captionLt ?? null;
		if (nextCaptionLt !== currentCaptionLt) {
			payload.captionLt = nextCaptionLt;
		}

		const nextCaptionEn = normalizeEditableText(editCaptionEn);
		const currentCaptionEn = asset.captionEn ?? null;
		if (nextCaptionEn !== currentCaptionEn) {
			payload.captionEn = nextCaptionEn;
		}

		return payload;
	}

	function mapEditFieldErrors(error: AdminApiError): EditFieldErrors {
		const fieldErrors: EditFieldErrors = {};
		const body = error.body as
			| { error?: { fieldErrors?: Record<string, string[] | undefined> } }
			| undefined;
		const rawFieldErrors = body?.error?.fieldErrors ?? {};
		for (const [key, messages] of Object.entries(rawFieldErrors)) {
			if (!messages || messages.length === 0) {
				continue;
			}
			if (key === 'title' || key === 'conceptId' || key === 'captionLt' || key === 'captionEn') {
				fieldErrors[key] = messages[0];
			}
		}
		return fieldErrors;
	}

	function assetMatchesActiveFilters(asset: AdminMediaAsset): boolean {
		if (filterConceptId !== 'all' && asset.conceptId !== filterConceptId) {
			return false;
		}
		if (filterAssetType !== 'all' && asset.assetType !== filterAssetType) {
			return false;
		}
		if (filterSourceKind !== 'all' && asset.sourceKind !== filterSourceKind) {
			return false;
		}
		return true;
	}

	function applyUpdatedAsset(asset: AdminMediaAsset): boolean {
		const matchesFilters = assetMatchesActiveFilters(asset);
		if (matchesFilters) {
			detailAsset = asset;
			selectedAsset = asset;
			listState = {
				...listState,
				items: listState.items.map((item) => (item.id === asset.id ? asset : item))
			};
			resetEditState(asset);
			return true;
		}

		const nextItems = listState.items.filter((item) => item.id !== asset.id);
		listState = {
			...listState,
			items: nextItems
		};
		pruneSelectionFromItems(nextItems);
		detailAsset = asset;
		selectedAsset = asset;
		resetEditState(asset);
		return false;
	}

	async function handleMetadataSubmit(event: Event): Promise<void> {
		event.preventDefault();
		if (!detailAsset || editBusy) {
			return;
		}

		const errors: EditFieldErrors = {};
		const trimmedTitle = editTitle.trim();
		if (!trimmedTitle.length) {
			errors.title = 'Įveskite medijos pavadinimą.';
		}

		if (!editConceptId) {
			errors.conceptId = 'Pasirinkite susietą sąvoką.';
		}

		if (Object.keys(errors).length) {
			editFieldErrors = errors;
			editError = 'Patikrinkite nurodytas klaidas.';
			return;
		}

		const payload = buildEditPayload(detailAsset);
		if (Object.keys(payload).length === 0) {
			editError = 'Pakeitimų nerasta.';
			return;
		}

		editBusy = true;
		editError = null;
		editFieldErrors = {};
		try {
			const updated = await updateAdminMediaAsset(detailAsset.id, payload);
			const stillVisible = applyUpdatedAsset(updated);
			if (stillVisible) {
				setSuccess('Medijos įrašo informacija atnaujinta.');
			} else {
				setSuccess('Medijos įrašas atnaujintas ir pašalintas iš dabartinio filtro.');
				closeDetail();
				await refreshList();
			}
		} catch (error) {
			if (error instanceof AdminApiError && error.status === 422) {
				const fieldErrors = mapEditFieldErrors(error);
				if (Object.keys(fieldErrors).length) {
					editFieldErrors = fieldErrors;
					editError = 'Kai kurie laukeliai neatitinka reikalavimų.';
				} else {
					editError = error.message;
				}
			} else if (error instanceof Error) {
				editError = error.message;
			} else {
				editError = 'Nepavyko atnaujinti medijos įrašo.';
			}
		} finally {
			editBusy = false;
		}
	}

	function beginDeleteConfirmation(): void {
		cancelDeleteConfirmation();
		deleteConfirmVisible = true;
		deleteConfirmTimer = setTimeout(() => {
			deleteConfirmVisible = false;
			deleteConfirmTimer = null;
		}, 10000);
	}

	function cancelDeleteConfirmation(): void {
		if (deleteConfirmTimer) {
			clearTimeout(deleteConfirmTimer);
			deleteConfirmTimer = null;
		}
		deleteConfirmVisible = false;
	}

	function formatDate(value: string | null | undefined): string {
		if (!value) {
			return '–';
		}
		try {
			return dateFormatter.format(new Date(value));
		} catch (error) {
			return value;
		}
	}

	function conceptLabel(conceptId: string): string {
		const concept = conceptLookup.get(conceptId);
		if (!concept) {
			return 'Nežinoma sąvoka';
		}
		const trimmed = concept.termLt?.trim();
		if (trimmed && trimmed.length) {
			return trimmed;
		}
		return concept.slug ?? concept.id;
	}

	function conceptLink(conceptId: string): string | null {
		const concept = conceptLookup.get(conceptId);
		if (!concept) {
			return null;
		}
		const baseHref = resolve('/admin/concepts');
		const search = new URLSearchParams({ slug: concept.slug }).toString();
		return `${baseHref}?${search}`;
	}

	async function loadConceptOptions(): Promise<void> {
		conceptLoading = true;
		conceptError = null;
		try {
			const concepts = await listAdminConcepts();
			const sorted = [...concepts].sort((a, b) => a.termLt.localeCompare(b.termLt));
			conceptOptions = sorted;
			conceptLookup = new Map(sorted.map((concept) => [concept.id, concept]));
		} catch (error) {
			conceptError =
				error instanceof Error
					? error.message
					: 'Nepavyko įkelti sąvokų sąrašo.';
		} finally {
			conceptLoading = false;
		}
	}

	function resolveListParams(cursor?: string | null) {
		const params: {
			conceptId?: string;
			assetType?: AdminMediaAssetType;
			sourceKind?: AdminMediaSourceKind;
			search?: string;
			cursor?: string | null;
			limit?: number;
		} = { limit: 20 };

		if (filterConceptId !== 'all') {
			params.conceptId = filterConceptId;
		}

		if (filterAssetType !== 'all') {
			params.assetType = filterAssetType;
		}

		if (filterSourceKind !== 'all') {
			params.sourceKind = filterSourceKind;
		}

		if (searchTerm.trim().length) {
			params.search = searchTerm.trim();
		}

		if (cursor) {
			params.cursor = cursor;
		}

		return params;
	}

	async function loadMedia(options: { append?: boolean } = {}): Promise<void> {
		const append = options.append ?? false;
		const cursor = append ? listState.meta.nextCursor : undefined;

		if (append) {
			if (!cursor) {
				return;
			}
			loadMoreLoading = true;
		} else {
			loading = true;
			loadError = null;
		}

		try {
			const params = resolveListParams(cursor);
			const result = await listAdminMediaAssets(params);
			listState = {
				items: append ? [...listState.items, ...result.items] : result.items,
				meta: result.meta
			};
			pruneSelectionFromItems(listState.items);
		} catch (error) {
			loadError =
				error instanceof Error
					? error.message
					: 'Nepavyko įkelti medijos įrašų.';
		} finally {
			loading = false;
			loadMoreLoading = false;
		}
	}

	async function refreshList(): Promise<void> {
		detailError = null;
		await loadMedia({ append: false });
	}

	function handleFilterChange(): void {
		actionError = null;
		void refreshList();
	}

	function scheduleSearch(value: string): void {
		searchInput = value;
		if (searchTimer) {
			clearTimeout(searchTimer);
		}
		searchTimer = setTimeout(() => {
			searchTerm = searchInput.trim();
			void refreshList();
			searchTimer = null;
		}, 350);
	}

	function resetFilters(): void {
		actionError = null;
		filterConceptId = 'all';
		filterAssetType = 'all';
		filterSourceKind = 'all';
		searchInput = '';
		searchTerm = '';
		if (searchTimer) {
			clearTimeout(searchTimer);
			searchTimer = null;
		}
		void refreshList();
	}

	function toggleSelection(id: string, checked: boolean): void {
		const next = new Set(selectedIds);
		if (checked) {
			next.add(id);
		} else {
			next.delete(id);
		}
		selectedIds = next;
		actionError = null;
		updateSelectAllIndeterminate();
	}

	function toggleSelectAll(checked: boolean): void {
		const next = new Set(selectedIds);
		if (checked) {
			for (const item of listState.items) {
				next.add(item.id);
			}
		} else {
			for (const item of listState.items) {
				next.delete(item.id);
			}
		}
		selectedIds = next;
		actionError = null;
		updateSelectAllIndeterminate();
	}

	function clearSelection(): void {
		if (!selectedIds.size) {
			return;
		}
		selectedIds = new Set();
		updateSelectAllIndeterminate();
	}

	function pruneSelectionFromItems(items: AdminMediaAsset[]): void {
		if (!selectedIds.size) {
			updateSelectAllIndeterminate();
			return;
		}
		const allowed = new Set(items.map((item) => item.id));
		const retained = [...selectedIds].filter((id) => allowed.has(id));
		if (retained.length !== selectedIds.size) {
			selectedIds = new Set(retained);
		}
		updateSelectAllIndeterminate();
	}

	function buildCreationConceptOptions(concepts: AdminConceptResource[]): MediaConceptOption[] {
		return concepts.map((concept) => ({
			id: concept.id,
			slug: concept.slug,
			label: concept.termLt?.trim().length ? concept.termLt : concept.slug
		}));
	}

	function updateSelectAllIndeterminate(): void {
		if (!selectAllCheckbox) {
			return;
		}
		const visibleSelectedCount = listState.items.reduce(
			(count, item) => (selectedIds.has(item.id) ? count + 1 : count),
			0
		);
		const allVisibleSelected =
			listState.items.length > 0 && visibleSelectedCount === listState.items.length;
		selectAllCheckbox.indeterminate = visibleSelectedCount > 0 && !allVisibleSelected;
	}

	function handleRowKeydown(event: KeyboardEvent, asset: AdminMediaAsset): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			void openDetail(asset);
		}
	}

	async function openDetail(asset: AdminMediaAsset): Promise<void> {
		selectedAsset = asset;
		detailAsset = asset;
		detailError = null;
		deleteError = null;
		cancelDeleteConfirmation();
		resetEditState(asset);
		clearPreview();

		detailLoading = true;
		try {
			const fresh = await getAdminMediaAsset(asset.id);
			detailAsset = fresh;
			selectedAsset = fresh;
			resetEditState(fresh);
		} catch (error) {
			detailError =
				error instanceof Error
					? error.message
					: 'Nepavyko įkelti medijos įrašo detalių.';
		} finally {
			detailLoading = false;
		}

		if (detailAsset) {
			void loadPreview(detailAsset);
		}
	}

	function closeDetail(): void {
		selectedAsset = null;
		detailAsset = null;
		deleteError = null;
		cancelDeleteConfirmation();
		resetEditState(null);
		clearPreview();
	}
	function clearPreview(): void {
		previewLoadToken += 1;
		preview = null;
		previewError = null;
		previewLoading = false;
		closePreviewModal();
	}

	async function loadPreview(asset: AdminMediaAsset): Promise<void> {
		const token = ++previewLoadToken;
		previewLoading = true;
		previewError = null;
		preview = null;

		if (asset.sourceKind === 'external') {
			const externalUrl = (asset.externalUrl ?? '').trim();
			if (!externalUrl.length) {
				if (token === previewLoadToken) {
					previewError = 'Išorinis URL nerastas.';
					previewLoading = false;
				}
				return;
			}

			let nextPreview: PreviewState | null = null;
			if (asset.assetType === 'image') {
				nextPreview = { kind: 'image', url: externalUrl };
			} else if (asset.assetType === 'video') {
				const embed = resolveExternalVideoEmbed(externalUrl);
				nextPreview = embed ? { kind: 'externalVideo', url: embed } : { kind: 'link', url: externalUrl };
			} else {
				nextPreview = { kind: 'link', url: externalUrl };
			}

			if (token === previewLoadToken) {
				preview = nextPreview;
				previewLoading = false;
			}
			return;
		}

		try {
			const result = await fetchAdminMediaSignedUrl(asset.id);
			if (token !== previewLoadToken) {
				return;
			}
			preview =
				asset.assetType === 'image'
					? { kind: 'image', url: result.url }
					: { kind: 'video', url: result.url };
		} catch (error) {
			if (token !== previewLoadToken) {
				return;
			}
			previewError =
				error instanceof Error
					? error.message
					: 'Nepavyko įkelti medijos peržiūros.';
		} finally {
			if (token === previewLoadToken) {
				previewLoading = false;
			}
		}
	}

	function previewSupportsModal(state: PreviewState | null): boolean {
		return Boolean(state && (state.kind === 'image' || state.kind === 'video' || state.kind === 'externalVideo'));
	}

	function handlePreviewExpand(event: MouseEvent): void {
		if (!preview || !previewSupportsModal(preview)) {
			return;
		}
		previewTrigger = event.currentTarget as HTMLElement;
		if (previewModal && typeof previewModal.showModal === 'function') {
			if (!previewModal.open) {
				previewModal.showModal();
			}
			previewModalOpen = true;
		}
	}

	function closePreviewModal(): void {
		if (!previewModalOpen) {
			return;
		}
		previewModalOpen = false;
		const videoEl = previewModal?.querySelector('video');
		if (videoEl && typeof (videoEl as HTMLVideoElement).pause === 'function') {
			(videoEl as HTMLVideoElement).pause();
		}
		if (previewModal?.open) {
			previewModal.close();
		}
		if (previewTrigger && typeof previewTrigger.focus === 'function') {
			previewTrigger.focus();
		}
		previewTrigger = null;
	}

	function handlePreviewBackdropPointerDown(event: PointerEvent): void {
		if (!previewModal) {
			return;
		}
		if (event.target === previewModal) {
			closePreviewModal();
		}
	}

	function handlePreviewModalCancel(event: Event): void {
		event.preventDefault();
		closePreviewModal();
	}

	function resolveExternalVideoEmbed(rawUrl: string): string | null {
		let parsed: URL;
		try {
			parsed = new URL(rawUrl);
		} catch {
			return null;
		}

		const host = parsed.hostname.toLowerCase();

		if (host === 'youtu.be' || host.endsWith('youtube.com')) {
			const videoId = extractYouTubeId(parsed);
			if (!videoId) {
				return null;
			}
			const startSeconds = parseStartSeconds(parsed.searchParams.get('t') ?? parsed.searchParams.get('start'));
			const embed = new URL(`https://www.youtube.com/embed/${videoId}`);
			if (startSeconds !== null && Number.isFinite(startSeconds) && startSeconds >= 0) {
				embed.searchParams.set('start', String(startSeconds));
			}
			return embed.toString();
		}

		if (host === 'player.vimeo.com') {
			return rawUrl;
		}

		if (host.endsWith('vimeo.com')) {
			const vimeoId = extractVimeoId(parsed);
			return vimeoId ? `https://player.vimeo.com/video/${vimeoId}` : null;
		}

		return null;
	}

	function extractYouTubeId(url: URL): string | null {
		const host = url.hostname.toLowerCase();
		if (host === 'youtu.be') {
			const segment = url.pathname.slice(1).split('/')[0];
			return segment && segment.length ? segment : null;
		}

		const path = url.pathname;
		if (path.startsWith('/watch')) {
			const id = url.searchParams.get('v');
			return id && id.trim().length ? id.trim() : null;
		}
		if (path.startsWith('/embed/')) {
			const segment = path.split('/')[2];
			return segment && segment.trim().length ? segment.trim() : null;
		}
		if (path.startsWith('/shorts/')) {
			const segment = path.split('/')[2];
			return segment && segment.trim().length ? segment.trim() : null;
		}
		if (path.startsWith('/live/')) {
			const segment = path.split('/')[2];
			return segment && segment.trim().length ? segment.trim() : null;
		}

		return null;
	}

	function extractVimeoId(url: URL): string | null {
		const path = url.pathname.split('/').filter(Boolean);
		const candidate = path[path.length - 1];
		return candidate && /^[0-9]+$/.test(candidate) ? candidate : null;
	}

	function parseStartSeconds(value: string | null): number | null {
		if (!value) {
			return null;
		}
		const trimmed = value.trim();
		if (!trimmed.length) {
			return null;
		}
		if (/^\d+$/.test(trimmed)) {
			return Number(trimmed);
		}
		if (/^\d+:\d+(?::\d+)?$/.test(trimmed)) {
			const parts = trimmed.split(':').map((part) => Number(part));
			if (parts.some((part) => Number.isNaN(part))) {
				return null;
			}
			while (parts.length < 3) {
				parts.unshift(0);
			}
			const [hours, minutes, seconds] = parts.slice(-3);
			return hours * 3600 + minutes * 60 + seconds;
		}

		const regex = /(\d+)(h|m|s)/gi;
		let match: RegExpExecArray | null;
		let total = 0;
		let matched = false;
		while ((match = regex.exec(trimmed)) !== null) {
			matched = true;
			const amount = Number(match[1]);
			if (Number.isNaN(amount)) {
				continue;
			}
			switch (match[2]) {
				case 'h':
					total += amount * 3600;
					break;
				case 'm':
					total += amount * 60;
					break;
				case 's':
					total += amount;
					break;
				default:
					break;
			}
		}

		return matched ? total : null;
	}

	async function handleDelete(): Promise<void> {
		if (!detailAsset) {
			return;
		}
		if (deleteBusy) {
			return;
		}
		if (!deleteConfirmVisible) {
			beginDeleteConfirmation();
			return;
		}

		deleteBusy = true;
		deleteError = null;
		cancelDeleteConfirmation();
		try {
			const deletedId = detailAsset.id;
			await deleteAdminMediaAsset(deletedId);
			setSuccess('Medijos įrašas pašalintas.');
			closeDetail();
			const nextSelection = new Set(selectedIds);
			nextSelection.delete(deletedId);
			selectedIds = nextSelection;
			updateSelectAllIndeterminate();
			await refreshList();
		} catch (error) {
			deleteError =
				error instanceof Error
					? error.message
					: 'Nepavyko pašalinti medijos įrašo.';
		} finally {
			deleteBusy = false;
		}
	}

	async function handleListDelete(event: MouseEvent, asset: AdminMediaAsset): Promise<void> {
		event.stopPropagation();
		if (rowDeleteBusyId) {
			return;
		}

		const confirmed = window.confirm('Ar tikrai norite pašalinti šią mediją?');
		if (!confirmed) {
			return;
		}

		rowDeleteBusyId = asset.id;
		actionError = null;
		try {
			await deleteAdminMediaAsset(asset.id);
			setSuccess('Medijos įrašas pašalintas.');
			const nextSelection = new Set(selectedIds);
			nextSelection.delete(asset.id);
			selectedIds = nextSelection;
			updateSelectAllIndeterminate();
			if (detailAsset?.id === asset.id) {
				closeDetail();
			}
			await refreshList();
		} catch (error) {
			actionError =
				error instanceof Error
					? error.message
					: 'Nepavyko pašalinti medijos įrašo.';
		} finally {
			rowDeleteBusyId = null;
		}
	}

	async function handleBulkDelete(): Promise<void> {
		if (!selectedIds.size || bulkDeleteBusy) {
			return;
		}

		const confirmed = window.confirm('Ar tikrai norite pašalinti pasirinktus medijos įrašus?');
		if (!confirmed) {
			return;
		}

		bulkDeleteBusy = true;
		actionError = null;
		const ids = Array.from(selectedIds);
		const failures: { id: string; message: string }[] = [];
		let deletedCount = 0;

		try {
			for (const id of ids) {
				try {
					await deleteAdminMediaAsset(id);
					deletedCount += 1;
					if (detailAsset?.id === id) {
						closeDetail();
					}
				} catch (error) {
					const message =
						error instanceof Error
							? error.message
							: 'Nepavyko pašalinti medijos įrašo.';
					failures.push({ id, message });
				}
			}

			if (deletedCount > 0) {
				setSuccess(
					deletedCount === 1
						? 'Medijos įrašas pašalintas.'
						: `Pašalinta ${deletedCount} medijos įrašai (-ų).`
				);
			}

			if (failures.length) {
				actionError =
					failures.length === ids.length
						? failures[0].message
						: `Nepavyko pašalinti ${failures.length} iš ${ids.length} pasirinktų įrašų. Pirmoji klaida: ${failures[0].message}`;
			}

			if (deletedCount > 0) {
				await refreshList();
			}
		} finally {
			const remaining = new Set(failures.map((failure) => failure.id));
			selectedIds = remaining;
			updateSelectAllIndeterminate();
			bulkDeleteBusy = false;
		}
	}

	function sourceSummary(asset: AdminMediaAsset): string {
		const parts = [sourceKindLabels[asset.sourceKind]];
		parts.push(assetTypeLabels[asset.assetType]);
		return parts.join(' · ');
	}

	function assetTitle(asset: AdminMediaAsset): string {
		const title = asset.title?.trim();
		if (title && title.length) {
			return title;
		}
		if (asset.sourceKind === 'external' && asset.externalUrl) {
			return asset.externalUrl;
		}
		return asset.storagePath ?? asset.id;
	}

	function shortText(value: string | null): string {
		if (!value) {
			return '';
		}
		const trimmed = value.trim();
		if (trimmed.length <= 140) {
			return trimmed;
		}
		return `${trimmed.slice(0, 137)}...`;
	}
</script>

<section class="media-shell">
	<header class="media-shell__header">
		<div>
			<h1>Papildomos medžiagos administravimas</h1>
			<p>
				Peržiūrėkite ir tvarkykite administratoriaus įkeltus medijos įrašus. Visi įrašai privalo būti
				susieti su bent viena sąvoka.
			</p>
		</div>
		<button class="primary" type="button" on:click={() => openCreate()}>
			Pridėti failą / išorinį šaltinį
		</button>
	</header>

	{#if conceptError}
		<div class="alert alert--warning">{conceptError}</div>
	{:else if conceptLoading}
		<p class="muted">Įkeliamos sąvokos filtrui...</p>
	{/if}

	{#if successMessage}
		<div class="alert alert--success" role="status" aria-live="polite">{successMessage}</div>
	{/if}

	{#if actionError}
		<div class="alert alert--error" role="alert">{actionError}</div>
	{/if}

	<div class="media-toolbar" role="search">
		<div class="media-toolbar__filters">
			<label>
				<span>Sąvoka</span>
				<select bind:value={filterConceptId} on:change={handleFilterChange}>
					<option value="all">Visos sąvokos</option>
					{#each conceptOptions as option}
						<option value={option.id}>{option.termLt}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Tipas</span>
				<select bind:value={filterAssetType} on:change={handleFilterChange}>
					<option value="all">Visi tipai</option>
					<option value="image">{assetTypeLabels.image}</option>
					<option value="video">{assetTypeLabels.video}</option>
				</select>
			</label>
			<label>
				<span>Šaltinis</span>
				<select bind:value={filterSourceKind} on:change={handleFilterChange}>
					<option value="all">Visi šaltiniai</option>
					<option value="upload">{sourceKindLabels.upload}</option>
					<option value="external">{sourceKindLabels.external}</option>
				</select>
			</label>
		</div>
		<div class="media-toolbar__search">
			<label for="media-search" class="sr-only">Paieška</label>
			<input
				id="media-search"
				type="search"
				placeholder="Ieškoti pagal pavadinimą ar aprašą"
				value={searchInput}
				on:input={(event) => scheduleSearch(event.currentTarget.value)}
			/>
			<button type="button" class="secondary" on:click={resetFilters}>Atstatyti filtrus</button>
		</div>
	</div>

	{#if loadError}
		<div class="alert alert--error">{loadError}</div>
	{:else if loading}
		<p class="muted">Kraunama medija...</p>
	{:else if listState.items.length === 0}
		<p class="muted">Pagal pasirinktus filtrus medijos įrašų nėra.</p>
		<button class="secondary" type="button" on:click={() => openCreate()}>
			Pridėti naują mediją
		</button>
	{:else}
		{#if selectedIds.size > 0}
			<div class="media-table__selection-bar" role="status" aria-live="polite">
				<p>
					{selectedIds.size === 1
						? 'Pasirinktas 1 medijos įrašas.'
						: `Pasirinkta ${selectedIds.size} medijos įrašai (-ų).`}
				</p>
				<div class="media-table__selection-actions">
					<button
						type="button"
						class="danger"
						on:click={() => void handleBulkDelete()}
						disabled={bulkDeleteBusy}
					>
						{#if bulkDeleteBusy}
							Šalinama...
						{:else}
							Pašalinti pasirinktus ({selectedIds.size})
						{/if}
					</button>
					<button
						type="button"
						class="plain"
						on:click={clearSelection}
						disabled={bulkDeleteBusy}
					>
						Atšaukti pasirinkimą
					</button>
				</div>
			</div>
		{/if}
		<div class="media-table-wrapper">
			<table class="media-table">
				<thead>
					<tr>
						<th scope="col" class="media-table__select-header">
							<input
								type="checkbox"
								aria-label="Pasirinkti visus matomus medijos įrašus"
								checked={listState.items.length > 0 && listState.items.every((item) => selectedIds.has(item.id))}
								on:change={(event) => toggleSelectAll(event.currentTarget.checked)}
								bind:this={selectAllCheckbox}
								disabled={listState.items.length === 0}
							/>
						</th>
						<th scope="col">Medijos įrašas</th>
						<th scope="col">Sąvoka</th>
						<th scope="col">Šaltinis</th>
						<th scope="col">Sukūrė</th>
						<th scope="col">Sukurta</th>
						<th scope="col" class="media-table__actions-header">Veiksmai</th>
					</tr>
				</thead>
				<tbody>
					{#each listState.items as item (item.id)}
						<tr
							tabindex="0"
							class="media-table__row"
							on:click={() => void openDetail(item)}
							on:keydown={(event) => handleRowKeydown(event, item)}
						>
							<td class="media-table__select-cell">
								<input
									type="checkbox"
									aria-label={`Pažymėti įrašą ${assetTitle(item)}`}
									checked={selectedIds.has(item.id)}
									on:click={(event) => event.stopPropagation()}
									on:change={(event) => toggleSelection(item.id, event.currentTarget.checked)}
								/>
							</td>
							<th scope="row">
								<div class="media-table__title">{assetTitle(item)}</div>
								{#if item.captionLt}
									<p class="media-table__summary">{shortText(item.captionLt)}</p>
								{:else if item.captionEn}
									<p class="media-table__summary">{shortText(item.captionEn)}</p>
								{/if}
							</th>
							<td>
								{#if conceptLink(item.conceptId)}
									<a
										href={conceptLink(item.conceptId) ?? '#'}
										on:click={(event) => event.stopPropagation()}
									>
										{conceptLabel(item.conceptId)}
									</a>
								{:else}
									{conceptLabel(item.conceptId)}
								{/if}
							</td>
							<td>{sourceSummary(item)}</td>
							<td>{item.createdBy ?? '–'}</td>
							<td>{formatDate(item.createdAt)}</td>
							<td class="media-table__actions">
								<button
									type="button"
									class="plain plain--danger"
									on:click={(event) => void handleListDelete(event, item)}
									disabled={rowDeleteBusyId === item.id}
								>
									{#if rowDeleteBusyId === item.id}
										Šalinama...
									{:else}
										Šalinti
									{/if}
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if listState.meta.hasMore}
			<button
				class="secondary media-shell__load-more"
				type="button"
				on:click={() => void loadMedia({ append: true })}
				disabled={loadMoreLoading}
			>
				{#if loadMoreLoading}
					Kraunama...
				{:else}
					Įkelti daugiau ({Math.max(listState.meta.count - listState.items.length, 0)})
				{/if}
			</button>
		{/if}
	{/if}
</section>

{#if createDrawerOpen}
	<AdminMediaCreateDrawer
		conceptOptions={buildCreationConceptOptions(conceptOptions)}
		defaultConceptId={createDefaultConceptId}
		lockedConceptId={createLockedConcept}
		on:close={closeCreateDrawer}
		on:created={handleCreateSuccess}
	/>
{/if}

{#if selectedAsset}
	<button
		type="button"
		class="drawer-backdrop"
		on:click={closeDetail}
		aria-label="Uždaryti medijos detalių langą"
	></button>
	<div class="drawer" role="dialog" aria-modal="true" aria-labelledby="media-detail-title">
		<header class="drawer__header">
			<h2 id="media-detail-title">Medijos įrašo detalės</h2>
			<button class="plain" type="button" on:click={closeDetail}>Uždaryti</button>
		</header>

		<div class="drawer__body">
			{#if detailLoading}
				<p class="drawer__placeholder muted">Įkeliama...</p>
			{:else if detailError}
				<div class="drawer__placeholder">
					<div class="alert alert--error">{detailError}</div>
				</div>
			{:else if detailAsset}
				<section class="drawer__section drawer__section--preview">
					<header class="drawer__section-header">
						<h3>Peržiūra</h3>
					</header>

					{#if previewLoading}
						<p class="muted">Įkeliama peržiūra...</p>
					{:else if previewError}
						<div class="alert alert--warning">{previewError}</div>
					{:else if preview}
						{#if preview.kind === 'image'}
							<button
								type="button"
								class="preview-card preview-card--image"
								on:click={handlePreviewExpand}
								aria-label="Peržiūrėti visame lange"
							>
								<img
									src={preview.url}
									alt={`Peržiūra: ${assetTitle(detailAsset)}`}
									loading="lazy"
								/>
							</button>
						{:else if preview.kind === 'video'}
							<div class="preview-card preview-card--video">
								<!-- svelte-ignore a11y_media_has_caption -->
								<video controls preload="metadata" src={preview.url} playsinline></video>
								<button
									type="button"
									class="secondary preview-card__trigger"
									on:click={handlePreviewExpand}
								>
									Peržiūrėti visame lange
								</button>
							</div>
						{:else if preview.kind === 'externalVideo'}
							<div class="preview-card preview-card--embed">
								<iframe
									src={preview.url}
									title={`Peržiūra: ${assetTitle(detailAsset)}`}
									loading="lazy"
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
									allowfullscreen
								></iframe>
								<button
									type="button"
									class="secondary preview-card__trigger"
									on:click={handlePreviewExpand}
								>
									Peržiūrėti visame lange
								</button>
							</div>
						{:else if preview.kind === 'link'}
							<a
								class="preview-card preview-card--link"
								href={preview.url}
								target="_blank"
								rel="noopener noreferrer"
							>
								Atidaryti mediją naujame lange
							</a>
						{/if}
					{:else}
						<p class="muted">Peržiūra negalima.</p>
					{/if}
				</section>

				<section class="drawer__section">
					<header class="drawer__section-header">
						<h3>Metaduomenys</h3>
						{#if !editMode}
							<div class="drawer__section-actions">
								<button class="secondary" type="button" on:click={beginEdit}>Redaguoti</button>
							</div>
						{/if}
					</header>

					{#if editMode}
						{#if editError}
							<div class="alert alert--error">{editError}</div>
						{/if}
						<form class="metadata-form" on:submit|preventDefault={handleMetadataSubmit}>
							<label>
								<span>Sąvoka</span>
								<select bind:value={editConceptId} disabled={editBusy}>
									<option value="" disabled>Pasirinkite sąvoką</option>
									{#each conceptOptions as option}
										<option value={option.id}>{conceptLabel(option.id)}</option>
									{/each}
								</select>
							</label>
							{#if editFieldErrors.conceptId}
								<p class="field-error">{editFieldErrors.conceptId}</p>
							{/if}

							<label>
								<span>Pavadinimas</span>
								<input
									type="text"
									bind:value={editTitle}
									maxlength="160"
									placeholder="Medijos pavadinimas"
									disabled={editBusy}
								/>
							</label>
							{#if editFieldErrors.title}
								<p class="field-error">{editFieldErrors.title}</p>
							{/if}

							<label>
								<span>Aprašymas (LT)</span>
								<textarea
									rows="3"
									bind:value={editCaptionLt}
									maxlength="300"
									placeholder="Trumpas aprašymas lietuvių kalba"
									disabled={editBusy}
								></textarea>
							</label>
							{#if editFieldErrors.captionLt}
								<p class="field-error">{editFieldErrors.captionLt}</p>
							{/if}

							<label>
								<span>Aprašymas (EN)</span>
								<textarea
									rows="3"
									bind:value={editCaptionEn}
									maxlength="300"
									placeholder="Trumpas aprašymas anglų kalba"
									disabled={editBusy}
								></textarea>
							</label>
							{#if editFieldErrors.captionEn}
								<p class="field-error">{editFieldErrors.captionEn}</p>
							{/if}

							<div class="drawer__form-actions">
								<button class="primary" type="submit" disabled={editBusy}>
									{#if editBusy}
										Išsaugoma...
									{:else}
										Išsaugoti pakeitimus
									{/if}
								</button>
								<button class="plain" type="button" on:click={cancelEdit} disabled={editBusy}>
									Atšaukti
								</button>
							</div>
						</form>
					{:else}
						<dl class="meta-grid">
							<div>
								<dt>Pavadinimas</dt>
								<dd>{assetTitle(detailAsset)}</dd>
							</div>
							<div>
								<dt>Sąvoka</dt>
								<dd>
									{#if conceptLink(detailAsset.conceptId)}
										<a
											href={conceptLink(detailAsset.conceptId)}
											target="_blank"
											rel="noopener noreferrer"
										>
											{conceptLabel(detailAsset.conceptId)}
										</a>
									{:else}
										{conceptLabel(detailAsset.conceptId)}
									{/if}
								</dd>
							</div>
							<div>
								<dt>Tipas</dt>
								<dd>{assetTypeLabels[detailAsset.assetType]}</dd>
							</div>
							<div>
								<dt>Šaltinis</dt>
								<dd>{sourceKindLabels[detailAsset.sourceKind]}</dd>
							</div>
							<div>
								<dt>Sukūrė</dt>
								<dd>{detailAsset.createdBy ?? '–'}</dd>
							</div>
							<div>
								<dt>Sukurta</dt>
								<dd>{formatDate(detailAsset.createdAt)}</dd>
							</div>
							{#if detailAsset.sourceKind === 'external' && detailAsset.externalUrl}
								<div class="meta-grid__full">
									<dt>Išorinis adresas</dt>
									<dd>
										<a
											href={detailAsset.externalUrl}
											target="_blank"
											rel="noopener noreferrer"
										>
											{detailAsset.externalUrl}
										</a>
									</dd>
								</div>
							{/if}
						</dl>

						{#if detailAsset.captionLt}
							<h4>Aprašymas (LT)</h4>
							<p>{detailAsset.captionLt}</p>
						{/if}
						{#if detailAsset.captionEn}
							<h4>Aprašymas (EN)</h4>
							<p>{detailAsset.captionEn}</p>
						{/if}
					{/if}
				</section>

				<section class="drawer__section drawer__section--danger">
					<h3>Šalinimas</h3>
					<p class="muted">
						Pašalinus paskutinę sąvoką, medija ištrinamas iš bazės ir saugyklos. Šis veiksmas negrįžtamas.
					</p>
					{#if deleteError}
						<div class="alert alert--error">{deleteError}</div>
					{/if}
					<div class="drawer__danger-actions">
						<button
							class="danger"
							type="button"
							on:click={() => void handleDelete()}
							disabled={deleteBusy}
						>
							{#if deleteBusy}
								Šalinama...
							{:else if deleteConfirmVisible}
								Patvirtinti šalinimą
							{:else}
								Pašalinti mediją
							{/if}
						</button>
						{#if deleteConfirmVisible}
							<button class="plain" type="button" on:click={cancelDeleteConfirmation} disabled={deleteBusy}>
								Atšaukti
							</button>
						{/if}
					</div>
					{#if deleteConfirmVisible}
						<p class="alert alert--warning">
							Patvirtinkite per 10 sekundžių, kad būtų pašalinta ši medija.
						</p>
					{/if}
				</section>
			{/if}
		</div>
	</div>
{/if}

<dialog
	class="preview-modal"
	bind:this={previewModal}
	class:preview-modal--open={previewModalOpen}
	on:cancel={handlePreviewModalCancel}
	on:pointerdown={handlePreviewBackdropPointerDown}
>
	<div class="preview-modal__content">
		{#if preview && previewSupportsModal(preview)}
			{#if preview.kind === 'image'}
				<img
					src={preview.url}
					alt={`Peržiūra: ${detailAsset ? assetTitle(detailAsset) : 'Medija'}`}
					class="preview-modal__media preview-modal__media--image"
				/>
			{:else if preview.kind === 'video'}
				<!-- svelte-ignore a11y_media_has_caption -->
				<video
					class="preview-modal__media preview-modal__media--video"
					controls
					preload="metadata"
					src={preview.url}
					autoplay
					playsinline
				></video>
			{:else if preview.kind === 'externalVideo'}
				<iframe
					src={preview.url}
					title={`Peržiūra: ${detailAsset ? assetTitle(detailAsset) : 'Medija'}`}
					class="preview-modal__media preview-modal__media--embed"
					loading="lazy"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
					allowfullscreen
				></iframe>
			{/if}
		{:else}
			<p class="muted">Peržiūra negalima.</p>
		{/if}
	</div>
	<button class="plain preview-modal__close" type="button" on:click={closePreviewModal}>Uždaryti</button>
</dialog>

<style>
	.media-shell {
		display: grid;
		gap: 1.5rem;
	}

	.media-shell__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.media-shell__header h1 {
		margin: 0;
		font-size: clamp(1.6rem, 3vw, 2.2rem);
	}

	.media-shell__header p {
		margin: 0.35rem 0 0;
		color: var(--color-text-soft);
		max-width: 38rem;
	}

	.media-toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		justify-content: space-between;
		align-items: flex-end;
	}

	.media-toolbar__filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.media-toolbar__filters label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.9rem;
	}

	.media-toolbar__filters select,
	.media-toolbar__search input {
		padding: 0.45rem 0.75rem;
		border-radius: 0.6rem;
		border: 1px solid var(--color-border);
		background: var(--color-panel);
		color: var(--color-text);
	}

	.media-toolbar__search {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.media-table__selection-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: 0.9rem;
		background: var(--color-panel-soft);
		margin-bottom: 0.75rem;
	}

	.media-table__selection-bar p {
		margin: 0;
		font-weight: 600;
	}

	.media-table__selection-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.media-table-wrapper {
		overflow-x: auto;
		border-radius: 1rem;
		border: 1px solid var(--color-border);
		background: var(--color-panel);
	}

	.media-table {
		width: 100%;
		border-collapse: collapse;
	}

	.media-table th,
	.media-table td {
		padding: 0.9rem 1rem;
		border-bottom: 1px solid var(--color-border-soft);
		text-align: left;
		vertical-align: top;
	}

	.media-table__select-header,
	.media-table__select-cell {
		width: 2.75rem;
		text-align: center;
		vertical-align: middle;
	}

	.media-table__select-cell input,
	.media-table__select-header input {
		cursor: pointer;
	}

	.media-table__row {
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.media-table__row:hover,
	.media-table__row:focus-visible {
		background: var(--color-panel-soft);
		outline: none;
	}

	.media-table__title {
		font-weight: 600;
	}

	.media-table__summary {
		margin: 0.35rem 0 0;
		font-size: 0.85rem;
		color: var(--color-text-soft);
	}

	.media-table__actions-header {
		text-align: right;
		white-space: nowrap;
	}

	.media-table__actions {
		text-align: right;
		vertical-align: middle;
	}

	.media-shell__load-more {
		width: fit-content;
	}

	.drawer-backdrop {
		border: none;
		padding: 0;
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: rgba(15, 23, 42, 0.35);
		z-index: 80;
		cursor: pointer;
	}

	.drawer {
		position: fixed;
		top: 0;
		right: 0;
		width: min(32rem, 90vw);
		height: 100vh;
		background: var(--color-panel);
		color: var(--color-text);
		box-shadow: -18px 0 40px rgba(15, 23, 42, 0.28);
		z-index: 90;
		display: grid;
		grid-template-rows: auto 1fr;
	}

	.drawer__body {
		overflow-y: auto;
		display: grid;
		align-content: start;
		padding-bottom: 1.5rem;
	}

	.drawer__placeholder {
		padding: 1.2rem 1.5rem;
	}

	.drawer__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.2rem 1.5rem;
		border-bottom: 1px solid var(--color-border);
	}

	.drawer__header h2 {
		margin: 0;
		font-size: 1.2rem;
	}

	.drawer__section {
		padding: 1.2rem 1.5rem;
		display: grid;
		gap: 0.75rem;
		border-bottom: 1px solid var(--color-border-soft);
	}

	.drawer__section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.drawer__section-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.drawer__section--preview {
		gap: 1rem;
	}

	.drawer__section h3 {
		margin: 0;
		font-size: 1rem;
	}

	.drawer__section--danger {
		background: rgba(239, 68, 68, 0.06);
	}

	.drawer__danger-actions {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		align-items: center;
	}

	.metadata-form {
		display: grid;
		gap: 0.75rem;
	}

	.metadata-form label {
		display: grid;
		gap: 0.4rem;
		font-size: 0.9rem;
	}

	.metadata-form input,
	.metadata-form select,
	.metadata-form textarea {
		padding: 0.5rem 0.65rem;
		border-radius: 0.65rem;
		border: 1px solid var(--color-border);
		background: var(--color-panel-soft);
		color: var(--color-text);
	}

	.metadata-form textarea {
		resize: vertical;
		min-height: 4rem;
	}

	.metadata-form input:disabled,
	.metadata-form select:disabled,
	.metadata-form textarea:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.drawer__form-actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.preview-card {
		border-radius: 0.95rem;
		border: 1px solid var(--color-border);
		background: var(--color-panel-soft);
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 0;
		width: 100%;
		overflow: hidden;
	}

	.preview-card.preview-card--image {
		border: none;
		background: var(--color-panel-soft);
		cursor: pointer;
	}

	.preview-card.preview-card--image:focus-visible {
		outline: 3px solid var(--color-link);
		outline-offset: 2px;
	}

	.preview-card--image img {
		display: block;
		width: 100%;
		max-height: 360px;
		object-fit: contain;
	}

	.preview-card--video,
	.preview-card--embed {
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.75rem;
		background: var(--color-panel-soft);
	}

	.preview-card--video video,
	.preview-card--embed iframe {
		width: 100%;
		aspect-ratio: 16 / 9;
		border-radius: 0.9rem;
		border: none;
		background: #000;
	}

	.preview-card--link {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-weight: 600;
		padding: 0.75rem 1rem;
	}

	.preview-card__trigger {
		align-self: flex-start;
	}

	.preview-modal {
		border: none;
		border-radius: 1rem;
		padding: 1.5rem;
		background: var(--color-panel);
		color: var(--color-text);
		max-width: min(62rem, 92vw);
		width: min(62rem, 92vw);
		box-shadow: 0 24px 60px rgba(15, 23, 42, 0.45);
		z-index: 120;
	}

	.preview-modal::backdrop {
		background: rgba(15, 23, 42, 0.45);
	}

	.preview-modal__content {
		display: grid;
		gap: 1rem;
	}

	.preview-modal__media {
		width: 100%;
		border-radius: 1rem;
		background: #000;
	}

	.preview-modal__media--image {
		max-height: 80vh;
		object-fit: contain;
	}

	.preview-modal__media--video,
	.preview-modal__media--embed {
		aspect-ratio: 16 / 9;
	}

	.preview-modal__close {
		margin-top: 1rem;
		justify-self: flex-end;
	}


	.meta-grid {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
	}

	.meta-grid > div,
	.meta-grid__full {
		display: grid;
		gap: 0.25rem;
	}

	.meta-grid__full {
		grid-column: 1 / -1;
	}

	.meta-grid dt {
		font-weight: 600;
		font-size: 0.85rem;
		color: var(--color-text-soft);
	}

	.meta-grid dd {
		margin: 0;
	}

	.alert {
		padding: 0.75rem 1rem;
		border-radius: 0.8rem;
		font-size: 0.9rem;
	}

	.alert--success {
		background: rgba(16, 185, 129, 0.12);
		border: 1px solid rgba(16, 185, 129, 0.4);
		color: rgb(5, 122, 85);
	}

	.alert--error {
		background: rgba(239, 68, 68, 0.12);
		border: 1px solid rgba(239, 68, 68, 0.4);
		color: rgb(185, 28, 28);
	}

	.alert--warning {
		background: rgba(251, 191, 36, 0.15);
		border: 1px solid rgba(217, 119, 6, 0.4);
		color: rgb(180, 83, 9);
	}

	.muted {
		color: var(--color-text-soft);
	}

	.field-error {
		color: rgb(185, 28, 28);
		font-size: 0.85rem;
		margin: 0.35rem 0 0;
	}

	.primary,
	.secondary,
	.danger,
	.plain {
		border-radius: 0.7rem;
		padding: 0.55rem 1rem;
		font-weight: 600;
		cursor: pointer;
	}

	.primary {
		background: var(--color-pill-bg);
		border: 1px solid var(--color-pill-border);
		color: var(--color-pill-text);
	}

	.primary:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.secondary {
		background: transparent;
		border: 1px solid var(--color-border);
		color: var(--color-text);
	}

	.danger {
		background: rgba(239, 68, 68, 0.12);
		border: 1px solid rgba(239, 68, 68, 0.4);
		color: rgb(185, 28, 28);
	}

	.plain {
		background: none;
		border: none;
		color: var(--color-link);
		padding: 0;
	}

	.plain:hover,
	.plain:focus-visible {
		text-decoration: underline;
	}

	.plain--danger {
		color: rgb(185, 28, 28);
	}

	.plain--danger:disabled {
		color: rgba(185, 28, 28, 0.6);
		cursor: not-allowed;
		opacity: 0.65;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@media (max-width: 860px) {
		.media-toolbar {
			flex-direction: column;
			align-items: stretch;
		}

		.media-toolbar__filters,
		.media-toolbar__search {
			width: 100%;
		}

		.media-toolbar__search {
			justify-content: space-between;
		}
	}
</style>
