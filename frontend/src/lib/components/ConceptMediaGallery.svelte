<script lang="ts">
	import { base } from '$app/paths';
	import { tick } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import type { ConceptMediaItem } from '$lib/api/media';
	import { adminMode } from '$lib/stores/adminMode';
	import { deleteAdminMediaAsset } from '$lib/api/admin/media';
	import AdminMediaEditModal from '$lib/admin/media/AdminMediaEditModal.svelte';

	type Props = {
		items: ConceptMediaItem[];
		onchange?: () => void;
	};

	const DEFAULT_VIDEO_TRACK_MESSAGE = 'Šiam vaizdo įrašui nėra aprašymo.';
	let { items, onchange }: Props = $props();
	let modalOpen = $state(false);
	let activeIndex = $state(0);

	let editModalOpen = $state(false);
	let editItem = $state<ConceptMediaItem | null>(null);
	let deleteConfirmItem = $state<ConceptMediaItem | null>(null);
	let isDeleting = $state(false);

	const displayItems = $derived(items.filter((item) => Boolean(item.url)));
	const toExternalHref = (target: string | null | undefined): string => {
		if (!target) {
			return '#';
		}
		if (/^[a-z][a-z0-9+.-]*:/i.test(target)) {
			return target;
		}
		const normalized = target.startsWith('/') ? target : `/${target}`;
		const parsed = new URL(normalized, 'http://localhost');
		return `${base}${parsed.pathname}${parsed.search}${parsed.hash}`;
	};
	const previewableItems = $derived(displayItems.filter((item) => item.assetType !== 'document'));
	let currentItem = $state<ConceptMediaItem | null>(null);
	let currentCaption = $state('');
	let currentCaptionTrack = $state<string | null>(null);
	let currentEmbedUrl = $state<string | null>(null);
	let currentDisplayTitle = $state('');

	function handleEdit(item: ConceptMediaItem, event: Event) {
		event.stopPropagation();
		editItem = item;
		editModalOpen = true;
	}

	function handleEditSave(detail: {
		id: string;
		title: string;
		captionLt: string;
		captionEn: string;
	}) {
		// The modal calls onsave after successful API call.
		// So we should reload data.
		onchange?.();
	}

	function handleDeleteClick(item: ConceptMediaItem, event?: Event) {
		event?.stopPropagation();
		deleteConfirmItem = item;
	}

	function handleEditDelete(id: string) {
		editModalOpen = false;
		const item = items.find((i) => i.id === id);
		if (item) {
			deleteConfirmItem = item;
		}
	}

	async function confirmDelete() {
		if (!deleteConfirmItem) return;
		isDeleting = true;
		try {
			await deleteAdminMediaAsset(deleteConfirmItem.id);
			onchange?.();
		} catch (e) {
			console.error(e);
			alert('Nepavyko pašalinti medijos.');
		} finally {
			isDeleting = false;
			deleteConfirmItem = null;
		}
	}

	async function focusModal(): Promise<void> {
		await tick();
		const modal = document.querySelector<HTMLElement>('.media-gallery__modal');
		modal?.focus();
	}

	$effect(() => {
		if (!previewableItems.length) {
			activeIndex = 0;
			modalOpen = false;
			currentItem = null;
			currentDisplayTitle = '';
			return;
		}
		if (activeIndex >= previewableItems.length) {
			activeIndex = previewableItems.length - 1;
		}
		currentItem = previewableItems[activeIndex] ?? null;
		currentDisplayTitle = currentItem ? displayTitle(currentItem) : '';
	});

	$effect(() => {
		const item = currentItem;
		if (!item) {
			currentCaption = '';
			currentCaptionTrack = null;
			currentEmbedUrl = null;
			return;
		}

		const caption = extractCaption(item);
		currentCaption = caption;

		if (item.assetType === 'video') {
			if (item.sourceKind === 'upload') {
				const trackContent = caption || item.title?.trim() || DEFAULT_VIDEO_TRACK_MESSAGE;
				currentCaptionTrack = buildCaptionTrack(trackContent);
				currentEmbedUrl = null;
			} else {
				currentCaptionTrack = null;
				currentEmbedUrl = resolveExternalVideoEmbed(item.url);
			}
		} else {
			currentCaptionTrack = null;
			currentEmbedUrl = null;
		}
	});

	$effect(() => {
		if (!modalOpen) {
			return;
		}

		const handleKey = (event: KeyboardEvent) => {
			switch (event.key) {
				case 'Escape':
					modalOpen = false;
					break;
				case 'ArrowLeft':
					showPrevious();
					break;
				case 'ArrowRight':
					showNext();
					break;
				default:
					break;
			}
		};

		window.addEventListener('keydown', handleKey);
		void focusModal();

		return () => {
			window.removeEventListener('keydown', handleKey);
		};
	});

	function openModal(index: number): void {
		if (!previewableItems.length) {
			return;
		}
		const bounded = Math.max(0, Math.min(index, previewableItems.length - 1));
		activeIndex = bounded;
		modalOpen = true;
	}

	function handleItemActivate(item: ConceptMediaItem): void {
		const previewIndex = previewableItems.findIndex((entry) => entry.id === item.id);
		if (previewIndex >= 0) {
			openModal(previewIndex);
			return;
		}

		if (item.url && typeof window !== 'undefined') {
			window.open(item.url, '_blank', 'noopener,noreferrer');
		}
	}

	function closeModal(): void {
		modalOpen = false;
	}

	function handleOverlayPointerDown(event: PointerEvent): void {
		if (event.target === event.currentTarget) {
			closeModal();
		}
	}

	function showPrevious(): void {
		if (!previewableItems.length) {
			return;
		}
		activeIndex = (activeIndex - 1 + previewableItems.length) % previewableItems.length;
	}

	function showNext(): void {
		if (!previewableItems.length) {
			return;
		}
		activeIndex = (activeIndex + 1) % previewableItems.length;
	}

	function extractCaption(item: ConceptMediaItem | null): string {
		if (!item) {
			return '';
		}
		const primary = item.captionLt?.trim();
		if (primary && primary.length) {
			return primary;
		}
		const fallback = item.captionEn?.trim();
		return fallback && fallback.length ? fallback : '';
	}

	function buildCaptionTrack(caption: string): string {
		const normalized = caption.replace(/\s+/g, ' ');
		const vtt = `WEBVTT\n\n00:00.000 --> 00:10.000\n${normalized}`;
		return `data:text/vtt,${encodeURIComponent(vtt)}`;
	}

	function displayTitle(item: ConceptMediaItem): string {
		const trimmed = item.title?.trim();
		if (trimmed && trimmed.length) {
			return trimmed;
		}
		if (item.assetType === 'video') {
			return 'Vaizdo įrašas';
		}
		if (item.assetType === 'document') {
			return 'Dokumentas';
		}
		return 'Papildoma medžiaga';
	}

	function resolveThumbnailUrl(item: ConceptMediaItem): string | null {
		if (!item.url) {
			return null;
		}
		if (item.assetType === 'image') {
			return item.url;
		}
		if (item.assetType === 'video') {
			if (item.sourceKind === 'external') {
				return resolveExternalVideoThumbnail(item.url);
			}
		}
		return null;
	}

	function resolveExternalVideoThumbnail(rawUrl: string): string | null {
		let parsed: URL;
		try {
			parsed = new URL(rawUrl);
		} catch {
			return null;
		}

		const host = parsed.hostname.toLowerCase();

		if (host === 'youtu.be' || host.endsWith('youtube.com')) {
			const videoId = extractYouTubeId(parsed);
			return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
		}

		return null;
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
			const startSeconds = parseStartSeconds(
				parsed.searchParams.get('t') ?? parsed.searchParams.get('start')
			);
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
			if (!vimeoId) {
				return null;
			}
			return `https://player.vimeo.com/video/${vimeoId}`;
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
			switch (match[2].toLowerCase()) {
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

	function extractVimeoId(url: URL): string | null {
		const segments = url.pathname.split('/').filter(Boolean);
		if (!segments.length) {
			return null;
		}
		const candidate = segments[segments.length - 1];
		return /^\d+$/.test(candidate) ? candidate : null;
	}
</script>

<div class="media-gallery" aria-label="Papildoma medžiaga">
	<div class="media-gallery__grid">
		{#each displayItems as item (item.id)}
			{@const itemTitle = displayTitle(item)}
			{@const thumbnail = resolveThumbnailUrl(item)}
			{@const isDocument = item.assetType === 'document'}
			{@const buttonLabel = isDocument
				? `Atidaryti dokumentą naujame lange: ${itemTitle}`
				: itemTitle}
			<div class="media-gallery__item">
				<button
					type="button"
					class="media-gallery__thumb"
					class:media-gallery__thumb--video={!thumbnail && item.assetType === 'video'}
					class:media-gallery__thumb--document={isDocument}
					onclick={() => handleItemActivate(item)}
					aria-label={buttonLabel}
					title={buttonLabel}
				>
					{#if item.assetType === 'image'}
						<img src={item.url} alt={itemTitle} loading="lazy" class="media-gallery__thumb-image" />
					{:else if item.assetType === 'video'}
						{#if thumbnail}
							<img
								src={thumbnail}
								alt={itemTitle}
								loading="lazy"
								class="media-gallery__thumb-image"
							/>
							<span class="media-gallery__thumb-overlay" aria-hidden="true">▶</span>
						{:else}
							<div class="media-gallery__thumb-placeholder">
								<span class="media-gallery__thumb-icon" aria-hidden="true">▶</span>
								<span class="media-gallery__thumb-label">Vaizdo įrašas</span>
							</div>
						{/if}
					{:else}
						<div
							class="media-gallery__thumb-placeholder media-gallery__thumb-placeholder--document"
						>
							<span class="media-gallery__thumb-icon" aria-hidden="true">PDF</span>
							<span class="media-gallery__thumb-label">Dokumentas</span>
						</div>
					{/if}
				</button>
				{#if $adminMode}
					<div class="media-gallery__admin-actions">
						<button
							type="button"
							class="media-gallery__admin-btn"
							onclick={(e) => handleEdit(item, e)}
							title="Redaguoti"
						>
							✎
						</button>
						<button
							type="button"
							class="media-gallery__admin-btn media-gallery__admin-btn--danger"
							onclick={(e) => handleDeleteClick(item, e)}
							title="Šalinti"
						>
							🗑
						</button>
					</div>
				{/if}
				<span class="media-gallery__thumb-title" title={itemTitle}>{itemTitle}</span>
			</div>
		{/each}
	</div>

	{#if editItem}
		<AdminMediaEditModal
			open={editModalOpen}
			id={editItem.id}
			title={editItem.title || ''}
			captionLt={editItem.captionLt || ''}
			captionEn={editItem.captionEn || ''}
			onclose={() => {
				editModalOpen = false;
				editItem = null;
			}}
			onsave={handleEditSave}
			ondelete={handleEditDelete}
		/>
	{/if}

	{#if deleteConfirmItem}
		<div class="media-gallery__confirm-overlay" role="alertdialog" aria-modal="true">
			<div class="media-gallery__confirm-modal">
				<h3>Ar tikrai šalinti?</h3>
				<p>Veiksmas negrįžtamas.</p>
				<div class="media-gallery__confirm-actions">
					<button
						type="button"
						class="media-gallery__confirm-btn"
						onclick={() => (deleteConfirmItem = null)}
						disabled={isDeleting}
					>
						Atšaukti
					</button>
					<button
						type="button"
						class="media-gallery__confirm-btn media-gallery__confirm-btn--danger"
						onclick={confirmDelete}
						disabled={isDeleting}
					>
						{#if isDeleting}Šalinama...{:else}Šalinti{/if}
					</button>
				</div>
			</div>
		</div>
	{/if}

	{#if modalOpen && currentItem}
		<div class="media-gallery__overlay" tabindex="-1" onpointerdown={handleOverlayPointerDown}>
			<div
				class="media-gallery__modal"
				role="dialog"
				aria-modal="true"
				aria-label={`Peržiūra: ${currentDisplayTitle || 'Papildoma medžiaga'}`}
				tabindex="-1"
			>
				<button
					type="button"
					class="media-gallery__close"
					onclick={closeModal}
					aria-label="Uždaryti"
				>
					&times;
				</button>

				{#if currentItem.assetType === 'image'}
					<img
						src={currentItem.url}
						alt={currentDisplayTitle || 'Papildoma medžiaga'}
						class="media-gallery__image"
					/>
				{:else if currentItem.assetType === 'video'}
					{#if currentItem.sourceKind === 'upload'}
						<video
							class="media-gallery__video"
							controls
							preload="metadata"
							src={currentItem.url}
							aria-label={currentDisplayTitle || 'Vaizdo įrašas'}
						>
							<track
								kind="captions"
								srclang="lt"
								label="Lietuviškas aprašymas"
								src={currentCaptionTrack}
								default
							/>
						</video>
					{:else if currentEmbedUrl}
						<div class="media-gallery__embed">
							<iframe
								src={currentEmbedUrl}
								title={currentDisplayTitle || 'Vaizdo įrašas'}
								loading="lazy"
								allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
								allowfullscreen
							></iframe>
						</div>
					{:else}
						<a
							href={toExternalHref(currentItem.url)}
							target="_blank"
							rel="noopener noreferrer"
							class="media-gallery__external"
						>
							Atidaryti vaizdo įrašą naujame lange
						</a>
					{/if}
				{:else}
					<a
						href={toExternalHref(currentItem.url)}
						target="_blank"
						rel="noopener noreferrer"
						class="media-gallery__external"
					>
						Atidaryti šaltinį
					</a>
				{/if}

				{#if currentDisplayTitle}
					<h4 class="media-gallery__title">{currentDisplayTitle}</h4>
				{/if}

				{#if currentCaption}
					<p class="media-gallery__caption">{currentCaption}</p>
				{/if}

				{#if previewableItems.length > 1}
					<button
						type="button"
						class="media-gallery__nav media-gallery__nav--prev"
						onclick={showPrevious}
						aria-label="Ankstesnis vaizdas"
					>
						‹
					</button>
					<button
						type="button"
						class="media-gallery__nav media-gallery__nav--next"
						onclick={showNext}
						aria-label="Kitas vaizdas"
					>
						›
					</button>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.media-gallery {
		display: grid;
		gap: 0.9rem;
	}

	.media-gallery__grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 0.6rem;
	}

	.media-gallery__item {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		position: relative;
	}

	.media-gallery__thumb {
		border: none;
		padding: 0;
		background: none;
		aspect-ratio: 1 / 1;
		border-radius: 0.7rem;
		overflow: hidden;
		box-shadow: 0 6px 20px rgba(15, 23, 42, 0.18);
		cursor: pointer;
		transition: transform 0.18s ease;
		position: relative;
		display: block;
	}

	.media-gallery__thumb:hover,
	.media-gallery__thumb:focus-visible {
		transform: translateY(-2px);
	}

	.media-gallery__thumb-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.media-gallery__thumb-overlay {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		background: linear-gradient(145deg, rgba(15, 23, 42, 0.1), rgba(15, 23, 42, 0.35));
		color: #fff;
		font-size: 1.8rem;
		pointer-events: none;
	}

	.media-gallery__thumb-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 0.4rem;
		background: linear-gradient(145deg, rgba(37, 99, 235, 0.9), rgba(59, 130, 246, 0.7));
		color: #fff;
	}

	.media-gallery__thumb-icon {
		font-size: 2rem;
		line-height: 1;
		filter: drop-shadow(0 4px 8px rgba(15, 23, 42, 0.35));
	}

	.media-gallery__thumb-label {
		font-size: 0.85rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.media-gallery__thumb-title {
		font-size: 0.9rem;
		font-weight: 600;
		line-height: 1.3;
		color: var(--color-text);
		text-align: center;
	}

	.media-gallery__thumb--video {
		background: linear-gradient(145deg, rgba(37, 99, 235, 0.9), rgba(59, 130, 246, 0.7));
		color: #fff;
	}

	.media-gallery__thumb--document {
		background: linear-gradient(145deg, rgba(71, 85, 105, 0.85), rgba(30, 41, 59, 0.9));
		color: #fff;
	}

	.media-gallery__thumb-placeholder--document {
		background: linear-gradient(145deg, rgba(71, 85, 105, 0.85), rgba(30, 41, 59, 0.9));
	}

	.media-gallery__admin-actions {
		position: absolute;
		top: 0.4rem;
		right: 0.4rem;
		display: flex;
		gap: 0.4rem;
		z-index: 10;
	}

	.media-gallery__admin-btn {
		background: var(--color-panel);
		border: 1px solid var(--color-border);
		border-radius: 0.4rem;
		width: 1.8rem;
		height: 1.8rem;
		display: grid;
		place-items: center;
		cursor: pointer;
		font-size: 1rem;
		color: var(--color-text);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		padding: 0;
	}

	.media-gallery__admin-btn:hover {
		background: var(--color-panel-soft);
	}

	.media-gallery__admin-btn--danger {
		color: #ef4444;
	}

	.media-gallery__confirm-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: rgba(15, 23, 42, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
		padding: 1rem;
	}

	.media-gallery__confirm-modal {
		background: var(--color-panel);
		padding: 1.5rem;
		border-radius: 0.8rem;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
		max-width: 400px;
		width: 100%;
		text-align: center;
	}

	.media-gallery__confirm-modal h3 {
		margin: 0 0 0.5rem;
		font-size: 1.2rem;
	}

	.media-gallery__confirm-modal p {
		margin: 0 0 1.5rem;
		color: var(--color-text-soft);
	}

	.media-gallery__confirm-actions {
		display: flex;
		justify-content: center;
		gap: 1rem;
	}

	.media-gallery__confirm-btn {
		padding: 0.6rem 1.2rem;
		border-radius: 0.4rem;
		font-weight: 600;
		cursor: pointer;
		border: none;
		background: var(--color-panel-soft);
		color: var(--color-text);
	}

	.media-gallery__confirm-btn--danger {
		background: #ef4444;
		color: #fff;
	}

	.media-gallery__overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: rgba(15, 23, 42, 0.55);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		z-index: 120;
	}

	.media-gallery__modal {
		position: relative;
		width: min(1000px, 94vw);
		height: min(800px, 85vh);
		background: var(--color-panel);
		padding: 1.4rem 1.8rem 1.6rem;
		border-radius: 1.1rem;
		box-shadow: 0 24px 54px rgba(15, 23, 42, 0.35);
		display: grid;
		grid-template-rows: 1fr auto auto;
		gap: 1rem;
	}

	.media-gallery__modal:focus {
		outline: none;
	}

	.media-gallery__close {
		position: absolute;
		top: 0.35rem;
		right: 0.6rem;
		background: none;
		border: none;
		font-size: 2.2rem;
		line-height: 1;
		cursor: pointer;
		color: var(--color-text);
		z-index: 10;
	}

	.media-gallery__image {
		width: 100%;
		height: 100%;
		object-fit: contain;
		border-radius: 0.8rem;
		min-width: 0;
		min-height: 0;
	}

	.media-gallery__video {
		width: 100%;
		height: 100%;
		object-fit: contain;
		border-radius: 0.6rem;
		background: #000;
		min-width: 0;
		min-height: 0;
	}

	.media-gallery__embed {
		width: 100%;
		height: 100%;
		border-radius: 0.6rem;
		overflow: hidden;
		background: #000;
		min-width: 0;
		min-height: 0;
	}

	.media-gallery__embed iframe {
		width: 100%;
		height: 100%;
		border: 0;
		display: block;
	}

	.media-gallery__external {
		align-self: center;
		justify-self: center;
		padding: 0.6rem 1.1rem;
		border-radius: 0.8rem;
		background: var(--color-panel-soft);
		border: 1px solid var(--color-border);
		font-weight: 600;
	}

	.media-gallery__title {
		margin: 0;
		font-size: 1.05rem;
	}

	.media-gallery__caption {
		margin: 0;
		font-size: 0.95rem;
		color: var(--color-text-soft);
	}

	.media-gallery__nav {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		background: rgba(15, 23, 42, 0.35);
		border: none;
		color: #fff;
		width: 2.4rem;
		height: 2.4rem;
		border-radius: 50%;
		cursor: pointer;
		font-size: 1.6rem;
		line-height: 1;
		display: grid;
		place-items: center;
	}

	.media-gallery__nav--prev {
		left: -1.2rem;
	}

	.media-gallery__nav--next {
		right: -1.2rem;
	}

	.media-gallery__admin-actions {
		position: absolute;
		top: 0.4rem;
		right: 0.4rem;
		display: flex;
		gap: 0.4rem;
		z-index: 5;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.media-gallery__item:hover .media-gallery__admin-actions,
	.media-gallery__item:focus-within .media-gallery__admin-actions {
		opacity: 1;
	}

	.media-gallery__admin-btn {
		background: var(--color-panel);
		border: 1px solid var(--color-border);
		border-radius: 0.4rem;
		width: 1.8rem;
		height: 1.8rem;
		display: grid;
		place-items: center;
		cursor: pointer;
		font-size: 1rem;
		color: var(--color-text);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.media-gallery__admin-btn:hover {
		background: var(--color-panel-soft);
	}

	.media-gallery__admin-btn--danger {
		color: #ef4444;
		border-color: rgba(239, 68, 68, 0.3);
	}

	.media-gallery__admin-btn--danger:hover {
		background: #fee2e2;
	}

	.media-gallery__confirm-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: rgba(15, 23, 42, 0.65);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
		padding: 1rem;
	}

	.media-gallery__confirm-modal {
		background: var(--color-panel);
		padding: 1.5rem;
		border-radius: 0.8rem;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
		max-width: 400px;
		width: 100%;
		text-align: center;
	}

	.media-gallery__confirm-modal h3 {
		margin: 0 0 0.5rem;
		font-size: 1.2rem;
	}

	.media-gallery__confirm-modal p {
		margin: 0 0 1.5rem;
		color: var(--color-text-soft);
	}

	.media-gallery__confirm-actions {
		display: flex;
		justify-content: center;
		gap: 1rem;
	}

	.media-gallery__confirm-btn {
		padding: 0.6rem 1.2rem;
		border-radius: 0.4rem;
		font-weight: 600;
		cursor: pointer;
		border: 1px solid var(--color-border);
		background: var(--color-panel-soft);
		color: var(--color-text);
	}

	.media-gallery__confirm-btn--danger {
		background: #ef4444;
		color: #fff;
		border-color: #ef4444;
	}

	@media (max-width: 720px) {
		.media-gallery__modal {
			padding: 1rem 1.2rem 1.4rem;
		}

		.media-gallery__nav--prev {
			left: 0.2rem;
		}

		.media-gallery__nav--next {
			right: 0.2rem;
		}
	}
</style>
