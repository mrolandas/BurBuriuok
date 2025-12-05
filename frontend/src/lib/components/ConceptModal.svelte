<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import ConceptDetail from '$lib/components/ConceptDetail.svelte';
	import { loadConceptDetailData, type ConceptPageData } from '$lib/page-data/conceptDetail';
	import { page } from '$app/stores';

	let { slug, onClose } = $props<{ 
		slug: string; 
		onClose: () => void;
	}>();

	let data = $state<ConceptPageData | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function loadData(currentSlug: string) {
		loading = true;
		error = null;
		try {
			// We pass a dummy fetcher because loadConceptDetailData expects one, 
			// but the underlying api functions use getSupabaseClient which uses global fetch if not provided?
			// Actually loadConceptDetailData uses the passed fetcher.
			// In client-side, window.fetch is available.
			data = await loadConceptDetailData({ 
				slug: currentSlug, 
				url: $page.url, 
				fetcher: window.fetch.bind(window) 
			});
		} catch (e) {
			console.error(e);
			error = e instanceof Error ? e.message : 'Nepavyko užkrauti temos.';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (slug) {
			void loadData(slug);
		}
	});

	const handleBackdropClick = (event: MouseEvent) => {
		if (event.currentTarget === event.target) {
			onClose();
		}
	};

	const handleKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
		}
	};
</script>

<svelte:window onkeydown={handleKeydown} />

<div 
	class="concept-modal" 
	role="presentation" 
	onclick={handleBackdropClick}
	transition:fade={{ duration: 200 }}
>
	<div 
		class="concept-modal__dialog"
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		transition:scale={{ start: 0.95, duration: 200 }}
	>
		<button type="button" class="concept-modal__close" onclick={onClose} aria-label="Uždaryti">
			<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
				<line x1="18" y1="6" x2="6" y2="18"></line>
				<line x1="6" y1="6" x2="18" y2="18"></line>
			</svg>
		</button>

		{#if loading}
			<div class="concept-modal__loading">
				<div class="concept-modal__spinner"></div>
				<p>Kraunama...</p>
			</div>
		{:else if error}
			<div class="concept-modal__error">
				<p>{error}</p>
				<button onclick={() => loadData(slug)}>Bandyti dar kartą</button>
			</div>
		{:else if data && data.concept}
			<div class="concept-modal__content">
				<ConceptDetail 
					concept={data.concept}
					breadcrumbs={data.breadcrumbs}
					sectionItems={data.sectionItems}
					neighbors={data.neighbors}
					nextSection={data.nextSection}
					media={data.media}
					mediaError={data.mediaError}
					adminContext={data.adminContext}
					isModal={true}
				/>
			</div>
		{:else}
			<div class="concept-modal__error">
				<p>Tema nerasta.</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.concept-modal {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: grid;
		place-items: center;
		background: rgba(15, 23, 42, 0.8);
		backdrop-filter: blur(4px);
		z-index: 1000;
		padding: 1rem;
		overflow-y: auto;
	}

	.concept-modal__dialog {
		width: min(900px, 100%);
		max-height: 90vh;
		background: var(--color-bg);
		border-radius: 1.5rem;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
		position: relative;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.concept-modal__close {
		position: absolute;
		top: 1rem;
		right: 1rem;
		z-index: 10;
		background: rgba(255, 255, 255, 0.8);
		border: none;
		border-radius: 50%;
		width: 2.5rem;
		height: 2.5rem;
		display: grid;
		place-items: center;
		cursor: pointer;
		color: var(--color-text);
		transition: all 0.2s;
		backdrop-filter: blur(4px);
	}

	.concept-modal__close:hover {
		background: white;
		transform: rotate(90deg);
	}

	.concept-modal__content {
		flex: 1;
		overflow-y: auto;
		padding: 0;
	}

	.concept-modal__loading,
	.concept-modal__error {
		flex: 1;
		min-height: 20rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		color: var(--color-text-muted);
	}

	.concept-modal__spinner {
		width: 2rem;
		height: 2rem;
		border: 3px solid var(--color-border);
		border-top-color: var(--color-accent);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* Dark mode adjustments if needed */
	:global(.dark) .concept-modal__close {
		background: rgba(30, 41, 59, 0.8);
	}
	:global(.dark) .concept-modal__close:hover {
		background: rgba(30, 41, 59, 1);
	}
</style>
