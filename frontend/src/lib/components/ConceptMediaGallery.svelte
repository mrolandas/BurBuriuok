<script lang="ts">
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import type { ConceptMediaItem } from '$lib/api/media';

	type Props = {
		items: ConceptMediaItem[];
	};

	const DEFAULT_VIDEO_TRACK_MESSAGE = 'Šiam vaizdo įrašui nėra aprašymo.';
	let { items }: Props = $props();
	let modalOpen = $state(false);
	let activeIndex = $state(0);

	const displayItems = $derived(items.filter((item) => Boolean(item.url)));
	const previewableItems = $derived(displayItems.filter((item) => item.assetType !== 'document'));
	let currentItem = $state<ConceptMediaItem | null>(null);
	let currentCaption = $state('');
	let currentCaptionTrack = $state<string | null>(null);
	let currentEmbedUrl = $state<string | null>(null);
	let currentDisplayTitle = $state('');

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
				<span class="media-gallery__thumb-title" title={itemTitle}>{itemTitle}</span>
			</div>
		{/each}
	</div>

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
							href={resolve(currentItem.url ?? '')}
							target="_blank"
							rel="noopener noreferrer"
							class="media-gallery__external"
						>
							Atidaryti vaizdo įrašą naujame lange
						</a>
					{/if}
				{:else}
					<a
						href={resolve(currentItem.url ?? '')}
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
		max-width: min(1100px, 96vw);
		max-height: 92vh;
		background: var(--color-panel);
		padding: 1.4rem 1.8rem 1.6rem;
		border-radius: 1.1rem;
		box-shadow: 0 24px 54px rgba(15, 23, 42, 0.35);
		display: grid;
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
	}

	.media-gallery__image {
		max-width: min(1000px, 90vw);
		max-height: 75vh;
		border-radius: 0.8rem;
		margin: 0 auto;
		object-fit: contain;
	}

	.media-gallery__video {
		max-width: min(1000px, 90vw);
		max-height: 75vh;
		border-radius: 0.6rem;
		background: #000;
	}

	.media-gallery__embed {
		max-width: min(1000px, 90vw);
		width: 100%;
		aspect-ratio: 16 / 9;
		border-radius: 0.6rem;
		overflow: hidden;
		background: #000;
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
