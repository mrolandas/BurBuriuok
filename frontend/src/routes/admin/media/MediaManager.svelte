<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
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

	let successMessage: string | null = null;
	let successTimer: ReturnType<typeof setTimeout> | null = null;

	let createDrawerOpen = false;
	let createDefaultConceptId: string | null = null;
	let createLockedConcept = false;
	let creationConceptOptions: MediaConceptOption[] = [];

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

	$: creationConceptOptions = conceptOptions.map((concept) => ({
		id: concept.id,
		slug: concept.slug,
		label: concept.termLt?.trim().length ? concept.termLt : concept.slug
	}));

	onMount(async () => {
		applyQueryDefaults();
		await Promise.all([loadConceptOptions(), loadMedia()]);
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
			return 'Nežinomas konceptas';
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
		return resolve(`/admin/concepts?slug=${encodeURIComponent(concept.slug)}`);
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

		detailLoading = true;
		try {
			const fresh = await getAdminMediaAsset(asset.id);
			detailAsset = fresh;
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
		} catch (error) {
			signedUrlError =
				error instanceof Error
					? error.message
					: 'Nepavyko sugeneruoti pasirašyto URL.';
		} finally {
			signedUrlLoading = false;
		}
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
			await deleteAdminMediaAsset(detailAsset.id);
			setSuccess('Medijos įrašas pašalintas.');
			closeDetail();
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
		<div class="media-table-wrapper">
			<table class="media-table">
				<thead>
					<tr>
						<th scope="col">Medijos įrašas</th>
						<th scope="col">Sąvoka</th>
						<th scope="col">Šaltinis</th>
						<th scope="col">Sukūrė</th>
						<th scope="col">Sukurta</th>
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
										on:click|stopPropagation
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
		conceptOptions={creationConceptOptions}
		defaultConceptId={createDefaultConceptId}
		lockedConceptId={createLockedConcept}
		on:close={closeCreateDrawer}
		on:created={handleCreateSuccess}
	/>
{/if}

{#if selectedAsset}
	<div class="drawer-backdrop" on:click={closeDetail}></div>
	<aside class="drawer" aria-labelledby="media-detail-title">
		<header class="drawer__header">
			<h2 id="media-detail-title">Medijos įrašo detalės</h2>
			<button class="plain" type="button" on:click={closeDetail}>Uždaryti</button>
		</header>

		{#if detailLoading}
			<p class="muted">Įkeliama...</p>
		{:else if detailError}
			<div class="alert alert--error">{detailError}</div>
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
							on:click={handleFetchSignedUrl}
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
								on:click={() => void copyToClipboard(detailAsset?.storagePath ?? '')}
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
								on:click={() => void copyToClipboard(signedUrl.url)}
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
					<p class="alert alert--warning">
						Paspauskite „Patvirtinti šalinimą“, kad užbaigtumėte šį veiksmą.
					</p>
				{/if}
			</section>
		{/if}
	</aside>
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

	.media-shell__load-more {
		width: fit-content;
	}

	.drawer-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: rgba(15, 23, 42, 0.35);
		z-index: 80;
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
