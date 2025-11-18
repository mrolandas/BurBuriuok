<script lang="ts">
	import type { ConceptMediaItem } from '$lib/api/media';

	type Props = {
		items: ConceptMediaItem[];
	};

	let { items }: Props = $props();
	let modalOpen = $state(false);
	let activeIndex = $state(0);

	const galleryItems = $derived(items.filter((item) => Boolean(item.url)));
	const currentItem = $derived(galleryItems[activeIndex] ?? null);
	const currentCaption = $derived(() => {
		if (!currentItem) {
			return '';
		}
		const primary = currentItem.captionLt?.trim();
		if (primary && primary.length) {
			return primary;
		}
		const fallback = currentItem.captionEn?.trim();
		return fallback && fallback.length ? fallback : '';
	});

	$effect(() => {
		if (!galleryItems.length) {
			activeIndex = 0;
			modalOpen = false;
			return;
		}
		if (activeIndex >= galleryItems.length) {
			activeIndex = galleryItems.length - 1;
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

		return () => {
			window.removeEventListener('keydown', handleKey);
		};
	});

	function openModal(index: number): void {
		activeIndex = index;
		modalOpen = true;
	}

	function closeModal(): void {
		modalOpen = false;
	}

	function showPrevious(): void {
		if (!galleryItems.length) {
			return;
		}
		activeIndex = (activeIndex - 1 + galleryItems.length) % galleryItems.length;
	}

	function showNext(): void {
		if (!galleryItems.length) {
			return;
		}
		activeIndex = (activeIndex + 1) % galleryItems.length;
	}

	const currentCaptionTrack = $derived<string | null>(
		(() => {
			const item = currentItem;
			if (!item) {
				return null;
			}
			const caption = item.captionLt?.trim() ?? item.captionEn?.trim();
			if (!caption) {
				return null;
			}
			const normalized = caption.replace(/\s+/g, ' ');
			const vtt = `WEBVTT\n\n00:00.000 --> 00:10.000\n${normalized}`;
			return `data:text/vtt,${encodeURIComponent(vtt)}`;
		})()
	);
</script>

<div class="media-gallery" aria-label="Papildoma medžiaga">
	<div class="media-gallery__grid">
		{#each galleryItems as item, index (item.id)}
			{#if item.assetType === 'image'}
				<button
					type="button"
					class="media-gallery__thumb"
					onclick={() => openModal(index)}
					aria-label={item.title ?? 'Peržiūrėti vaizdą'}
				>
					<img src={item.url} alt={item.title ?? 'Papildoma medžiaga'} loading="lazy" />
				</button>
			{:else}
				<button
					type="button"
					class="media-gallery__thumb media-gallery__thumb--video"
					onclick={() => openModal(index)}
					aria-label={item.title ?? 'Peržiūrėti vaizdo įrašą'}
				>
					<span class="media-gallery__thumb-icon" aria-hidden="true">▶</span>
					<span class="media-gallery__thumb-label">Vaizdo įrašas</span>
				</button>
			{/if}
		{/each}
	</div>

	{#if modalOpen && currentItem}
		<div class="media-gallery__overlay" role="dialog" aria-modal="true" aria-label="Peržiūra">
			<div class="media-gallery__modal">
				<button type="button" class="media-gallery__close" onclick={closeModal} aria-label="Uždaryti">
					&times;
				</button>

				{#if currentItem.assetType === 'image'}
					<img
						src={currentItem.url}
						alt={currentItem.title ?? 'Papildoma medžiaga'}
						class="media-gallery__image"
					/>
				{:else if currentItem.assetType === 'video'}
					{#if currentCaptionTrack}
						<video class="media-gallery__video" controls preload="metadata" src={currentItem.url}>
							<track
								kind="captions"
								srclang="lt"
								label="Lietuviškas aprašymas"
								src={currentCaptionTrack}
								default
							/>
						</video>
					{:else}
						<a
							href={currentItem.url}
							target="_blank"
							rel="noreferrer"
							class="media-gallery__external"
						>
							Atidaryti vaizdo įrašą naujame lange
						</a>
					{/if}
				{:else}
					<a
						href={currentItem.url}
						target="_blank"
						rel="noreferrer"
						class="media-gallery__external"
					>
						Atidaryti šaltinį
					</a>
				{/if}

				{#if currentItem.title}
					<h4 class="media-gallery__title">{currentItem.title}</h4>
				{/if}

				{#if currentCaption}
					<p class="media-gallery__caption">{currentCaption}</p>
				{/if}

				{#if galleryItems.length > 1}
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
	}

	.media-gallery__thumb--video {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 1.2rem 0.8rem;
		background: linear-gradient(145deg, rgba(37, 99, 235, 0.9), rgba(59, 130, 246, 0.7));
		color: #fff;
		gap: 0.4rem;
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

	.media-gallery__thumb:hover,
	.media-gallery__thumb:focus-visible {
		transform: translateY(-2px);
	}

	.media-gallery__thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
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
		max-width: min(960px, 92vw);
		max-height: 90vh;
		background: var(--color-panel);
		padding: 1.4rem 1.8rem 1.6rem;
		border-radius: 1.1rem;
		box-shadow: 0 24px 54px rgba(15, 23, 42, 0.35);
		display: grid;
		gap: 1rem;
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
		max-width: min(860px, 82vw);
		max-height: 65vh;
		border-radius: 0.8rem;
		margin: 0 auto;
		object-fit: contain;
	}

	.media-gallery__video {
		max-width: min(860px, 82vw);
		max-height: 65vh;
		border-radius: 0.6rem;
		background: #000;
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
