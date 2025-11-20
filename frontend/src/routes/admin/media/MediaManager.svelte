<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import {
		listAdminMediaAssets,
		getAdminMediaAsset,
		deleteAdminMediaAsset,
		fetchAdminMediaSignedUrl,
		type AdminMediaAsset,
		type AdminMediaAssetType,
		type AdminMediaListMeta,
		type AdminMediaSignedUrl,
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
	let signedUrl: AdminMediaSignedUrl | null = null;
	let signedUrlLoading = false;
	let signedUrlError: string | null = null;
	let deleteBusy = false;
	let deleteError: string | null = null;
	let deleteConfirmVisible = false;
	let actionError: string | null = null;
	let rowDeleteBusyId: string | null = null;

	let selectedIds: Set<string> = new Set();
	let bulkDeleteBusy = false;
	let selectAllCheckbox: HTMLInputElement | null = null;

	let preview: PreviewState | null = null;
	let previewLoading = false;
	let previewError: string | null = null;
	let previewLoadToken = 0;

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
		}
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
		signedUrl = null;
		signedUrlError = null;
		deleteError = null;
		deleteConfirmVisible = false;
		clearPreview();

		detailLoading = true;
		try {
			const fresh = await getAdminMediaAsset(asset.id);
			detailAsset = fresh;
			await loadPreview(fresh);
		} catch (error) {
			detailError =
				error instanceof Error
					? error.message
					: 'Nepavyko įkelti medijos įrašo detalių.';
		} finally {
			detailLoading = false;
		}
	}

	function closeDetail(): void {
		selectedAsset = null;
		detailAsset = null;
		signedUrl = null;
		signedUrlError = null;
		deleteError = null;
		deleteConfirmVisible = false;
		clearPreview();
	}

	async function handleFetchSignedUrl(): Promise<void> {
		if (!detailAsset) {
			return;
		}
		signedUrlLoading = true;
		signedUrlError = null;
		try {
			signedUrl = await fetchAdminMediaSignedUrl(detailAsset.id);
			setSuccess('Sugeneruotas laikinas pasirašytas URL.');
			if (detailAsset.sourceKind === 'upload' && signedUrl) {
				preview =
					detailAsset.assetType === 'image'
						? { kind: 'image', url: signedUrl.url }
						: { kind: 'video', url: signedUrl.url };
				previewError = null;
			}
		} catch (error) {
			signedUrlError =
				error instanceof Error
					? error.message
					: 'Nepavyko sugeneruoti pasirašyto URL.';
		} finally {
			signedUrlLoading = false;
		}
	}

	function clearPreview(): void {
		previewLoadToken += 1;
		preview = null;
		previewError = null;
		previewLoading = false;
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
			signedUrl = result;
			signedUrlError = null;
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

	async function copyToClipboard(value: string): Promise<void> {
		try {
			if (navigator?.clipboard?.writeText) {
				await navigator.clipboard.writeText(value);
			} else {
				const temp = document.createElement('textarea');
				temp.value = value;
				temp.setAttribute('readonly', '');
				temp.style.position = 'absolute';
				temp.style.opacity = '0';
				document.body.appendChild(temp);
				temp.select();
				document.execCommand('copy');
				document.body.removeChild(temp);
			}
			setSuccess('Reikšmė nukopijuota į iškarpinę.');
		} catch (error) {
			setSuccess('Nepavyko nukopijuoti. Nukopijuokite rankiniu būdu.');
		}
	}

	async function handleDelete(): Promise<void> {
		if (!detailAsset) {
			return;
		}
		if (!deleteConfirmVisible) {
			deleteConfirmVisible = true;
			return;
		}

		deleteBusy = true;
		deleteError = null;
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
			deleteConfirmVisible = false;
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
		<button class="primary" type="button" onclick={() => openCreate()}>
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
				<select bind:value={filterConceptId} onchange={handleFilterChange}>
					<option value="all">Visos sąvokos</option>
					{#each conceptOptions as option}
						<option value={option.id}>{option.termLt}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Tipas</span>
				<select bind:value={filterAssetType} onchange={handleFilterChange}>
					<option value="all">Visi tipai</option>
					<option value="image">{assetTypeLabels.image}</option>
					<option value="video">{assetTypeLabels.video}</option>
				</select>
			</label>
			<label>
				<span>Šaltinis</span>
				<select bind:value={filterSourceKind} onchange={handleFilterChange}>
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
				oninput={(event) => scheduleSearch(event.currentTarget.value)}
			/>
			<button type="button" class="secondary" onclick={resetFilters}>Atstatyti filtrus</button>
		</div>
	</div>

	{#if loadError}
		<div class="alert alert--error">{loadError}</div>
	{:else if loading}
		<p class="muted">Kraunama medija...</p>
	{:else if listState.items.length === 0}
		<p class="muted">Pagal pasirinktus filtrus medijos įrašų nėra.</p>
		<button class="secondary" type="button" onclick={() => openCreate()}>
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
						onclick={() => void handleBulkDelete()}
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
						onclick={clearSelection}
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
								onchange={(event) => toggleSelectAll(event.currentTarget.checked)}
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
							onclick={() => void openDetail(item)}
							onkeydown={(event) => handleRowKeydown(event, item)}
						>
							<td class="media-table__select-cell">
								<input
									type="checkbox"
									aria-label={`Pažymėti įrašą ${assetTitle(item)}`}
									checked={selectedIds.has(item.id)}
									onclick={(event) => event.stopPropagation()}
									onchange={(event) => toggleSelection(item.id, event.currentTarget.checked)}
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
										onclick={(event) => event.stopPropagation()}
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
									onclick={(event) => void handleListDelete(event, item)}
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
				onclick={() => void loadMedia({ append: true })}
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
		onclick={closeDetail}
		aria-label="Uždaryti medijos detalių langą"
	></button>
	<div class="drawer" role="dialog" aria-modal="true" aria-labelledby="media-detail-title">
		<header class="drawer__header">
			<h2 id="media-detail-title">Medijos įrašo detalės</h2>
			<button class="plain" type="button" onclick={closeDetail}>Uždaryti</button>
		</header>

		<div class="drawer__body">
			{#if detailLoading}
				<p class="drawer__placeholder muted">Įkeliama...</p>
			{:else if detailError}
				<div class="drawer__placeholder">
					<div class="alert alert--error">{detailError}</div>
				</div>
			{:else if detailAsset}
				<section class="drawer__section">
					<h3>Pagrindinė informacija</h3>
					<dl class="meta-grid">
						<div>
							<dt>Pavadinimas</dt>
							<dd>{assetTitle(detailAsset)}</dd>
						</div>
						<div>
							<dt>Sąvoka</dt>
							<dd>{conceptLabel(detailAsset.conceptId)}</dd>
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
					</dl>

					{#if detailAsset.captionLt}
						<h4>Aprašymas (LT)</h4>
						<p>{detailAsset.captionLt}</p>
					{/if}
					{#if detailAsset.captionEn}
						<h4>Aprašymas (EN)</h4>
						<p>{detailAsset.captionEn}</p>
					{/if}
				</section>

				<section class="drawer__section">
					<h3>Peržiūra</h3>
					{#if previewLoading}
						<p class="muted">Įkeliama peržiūra...</p>
					{:else if previewError}
						<div class="alert alert--warning">{previewError}</div>
					{:else if preview}
						{#if preview.kind === 'image'}
							<img
								src={preview.url}
								alt={`Peržiūra: ${assetTitle(detailAsset)}`}
								class="drawer__preview-image"
								loading="lazy"
							/>
						{:else if preview.kind === 'video'}
							<!-- svelte-ignore a11y_media_has_caption -->
							<video
								class="drawer__preview-video"
								controls
								preload="metadata"
								src={preview.url}
								playsinline
							></video>
						{:else if preview.kind === 'externalVideo'}
							<div class="drawer__preview-embed">
								<iframe
									src={preview.url}
									title={`Peržiūra: ${assetTitle(detailAsset)}`}
									loading="lazy"
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
									allowfullscreen
								></iframe>
							</div>
						{:else if preview.kind === 'link'}
							<a
								class="drawer__preview-link"
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
					<h3>Prieiga</h3>
					{#if detailAsset.sourceKind === 'external' && detailAsset.externalUrl}
						<p>
							Išorinis adresas:
							<a href={detailAsset.externalUrl} rel="noopener noreferrer" target="_blank">
								{detailAsset.externalUrl}
							</a>
						</p>
					{:else if detailAsset.sourceKind === 'upload'}
						<p class="muted">Saugojimo kelias: {detailAsset.storagePath}</p>
						<div class="drawer__actions">
							<button
								class="secondary"
								type="button"
								onclick={handleFetchSignedUrl}
								disabled={signedUrlLoading}
							>
								{#if signedUrlLoading}
									Generuojama...
								{:else}
									Gauti pasirašytą URL
								{/if}
							</button>
							{#if detailAsset.storagePath}
								<button
									class="plain"
									type="button"
									onclick={() => void copyToClipboard(detailAsset?.storagePath ?? '')}
								>
									Kopijuoti kelio reikšmę
								</button>
							{/if}
						</div>
						{#if signedUrlError}
							<p class="field-error">{signedUrlError}</p>
						{/if}
						{#if signedUrl}
							<div class="drawer__signed-url">
								<p>
									<a href={signedUrl.url} rel="noopener noreferrer" target="_blank">
										Pasirašytas URL
									</a>
								</p>
								{#if signedUrl.expiresAt}
									<p class="muted">Galioja iki {formatDate(signedUrl.expiresAt)}</p>
								{/if}
								<button
									class="plain"
									type="button"
									onclick={() => {
										if (!signedUrl) {
											return;
										}
										void copyToClipboard(signedUrl.url);
									}}
								>
									Kopijuoti URL
								</button>
							</div>
						{/if}
					{/if}
				</section>

				<section class="drawer__section drawer__section--danger">
					<h3>Šalinimas</h3>
					<p class="muted">
						Pašalinus paskutinę sąvoką, medija ištrinamas iš bazės ir saugyklos. Šis veiksmas
						negrįžtamas.
					</p>
					{#if deleteError}
						<div class="alert alert--error">{deleteError}</div>
					{/if}
					<button
						class="danger"
						type="button"
						onclick={() => void handleDelete()}
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
						<p class="alert alert--warning">
							Paspauskite „Patvirtinti šalinimą“, kad užbaigtumėte šį veiksmą.
						</p>
					{/if}
				</section>
			{/if}
		</div>
	</div>
{/if}

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

	.drawer__section h3 {
		margin: 0;
		font-size: 1rem;
	}

	.drawer__section--danger {
		background: rgba(239, 68, 68, 0.06);
	}

	.drawer__preview-image {
		width: 100%;
		max-height: 360px;
		object-fit: contain;
		border-radius: 0.9rem;
		background: var(--color-panel-soft);
	}

	.drawer__preview-video {
		width: 100%;
		max-height: 360px;
		border-radius: 0.9rem;
		background: #000;
	}

	.drawer__preview-embed {
		position: relative;
		padding-top: 56.25%;
		border-radius: 0.9rem;
		overflow: hidden;
		background: #000;
	}

	.drawer__preview-embed iframe {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		border: 0;
	}

	.drawer__preview-link {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-weight: 600;
	}

	.drawer__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.drawer__signed-url {
		display: grid;
		gap: 0.4rem;
		padding: 0.8rem;
		border-radius: 0.8rem;
		border: 1px solid var(--color-border);
		background: var(--color-panel-soft);
	}

	.meta-grid {
		display: grid;
		gap: 0.75rem;
	}

	.meta-grid > div {
		display: grid;
		gap: 0.25rem;
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
