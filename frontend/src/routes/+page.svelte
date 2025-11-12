<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import { adminMode } from '$lib/stores/adminMode';
	import type { PageData, SectionCard } from './+page';

	export let data: PageData;

	let adminModeEnabled = false;
	let unsubscribeAdmin: (() => void) | null = null;

	onMount(() => {
		adminMode.initialize();
		unsubscribeAdmin = adminMode.subscribe((value) => {
			adminModeEnabled = value;
		});
	});

	onDestroy(() => {
		unsubscribeAdmin?.();
	});

	const reloadSections = async () => {
		await invalidateAll();
	};

	const cleanTitle = (title: string) => title.replace(/\s*\([^)]*\)\s*$/, '').trim();

	const formatSummary = (summary: string | null, title: string) => {
		const trimmed = summary?.trim();
		if (trimmed && trimmed.length) {
			return trimmed;
		}
		return `${title} skilties aprašas bus papildytas netrukus.`;
	};

	const avatarPalettes = [
		{
			background: 'linear-gradient(135deg, rgba(56,189,248,0.16), rgba(37,99,235,0.45))',
			color: '#0f172a'
		},
		{
			background: 'linear-gradient(135deg, rgba(99,102,241,0.16), rgba(79,70,229,0.45))',
			color: '#0f172a'
		},
		{
			background: 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(5,150,105,0.45))',
			color: '#0f172a'
		},
		{
			background: 'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(245,158,11,0.45))',
			color: '#78350f'
		},
		{
			background: 'linear-gradient(135deg, rgba(244,114,182,0.18), rgba(236,72,153,0.45))',
			color: '#831843'
		}
	] as const;

	const hashCode = (value: string) => {
		let hash = 0;
		for (let index = 0; index < value.length; index += 1) {
			hash = (hash << 5) - hash + value.charCodeAt(index);
			hash |= 0;
		}
		return Math.abs(hash);
	};

	const selectPalette = (code: string) => {
		const index = hashCode(code) % avatarPalettes.length;
		return avatarPalettes[index];
	};

	const extractInitials = (title: string) => {
		const tokens = title
			.replace(/[0-9]+/g, ' ')
			.split(/\s+/)
			.filter(Boolean);
		if (!tokens.length) {
			return 'BK';
		}
		if (tokens.length === 1) {
			const word = tokens[0];
			const slice = word.slice(0, 2).toUpperCase();
			return slice || word.charAt(0).toUpperCase();
		}
		return `${tokens[0].charAt(0)}${tokens[1].charAt(0)}`.toUpperCase();
	};

	const formatMeta = (ordinal: number) => `LBS dalis Nr. ${ordinal}`;

	const toDomId = (code: string) => code.replace(/[^a-zA-Z0-9_-]/g, '-');

	const handleEditClick = (event: MouseEvent, section: SectionCard) => {
		event.preventDefault();
		event.stopPropagation();
		// Inline editing hook will be attached in the upcoming admin slice.
	};
</script>


{#if data.loadError}
	<section class="status-block status-block--error" role="alert">
		<div>
			<p class="status-block__title">Nepavyko įkelti skilčių</p>
			<p class="status-block__body">{data.loadError}</p>
		</div>
		<button class="status-block__action" type="button" onclick={() => void reloadSections()}>
			Bandyti dar kartą
		</button>
	</section>
{/if}

<section class="sections-grid" aria-live="polite">
	{#if !data.sections.length && !data.loadError}
		<div class="sections-grid__placeholder">
			<p>Kraunama skilčių lenta...</p>
		</div>
	{:else}
		{#each data.sections as section (section.code)}
			{@const title = cleanTitle(section.title)}
			{@const description = formatSummary(section.summary, title)}
			{@const palette = selectPalette(section.code)}
			{@const initials = extractInitials(title)}
			{@const metaLabel = formatMeta(section.ordinal)}
			{@const domId = toDomId(section.code)}

			<article class="section-card">
				<a
					class="section-card__link"
					href={resolve('/sections/[code]', { code: section.code })}
					aria-labelledby={`section-${domId}`}
				>
					<span
						class="section-card__avatar"
						style={`background:${palette.background};color:${palette.color};`}
					>
						{initials}
					</span>
					<div class="section-card__content">
						<h2 class="section-card__title" id={`section-${domId}`}>{title}</h2>
						<p class="section-card__summary">{description}</p>
					</div>
					<span class="section-card__chevron" aria-hidden="true">
						<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
							<path
								d="M9 6l6 6-6 6"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							></path>
						</svg>
					</span>
				</a>
				<div class="section-card__meta">
					<span class="section-card__meta-label">{metaLabel}</span>
					{#if adminModeEnabled}
						<button
							type="button"
							class="section-card__edit"
							onclick={(event) => handleEditClick(event, section)}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
								<path
									d="M4 20h16"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
								></path>
								<path
									d="M14.5 4.5l5 5L9 20l-5 1 1-5z"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linejoin="round"
								></path>
							</svg>
							<span>Keisti skiltį</span>
						</button>
					{/if}
				</div>
			</article>
		{/each}
	{/if}
</section>

<style>
	.sections-grid {
		width: min(100%, var(--layout-max-width));
		margin: 0 auto;
		display: grid;
		gap: clamp(1.4rem, 3vw, 2rem);
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		align-content: start;
	}

	.sections-grid__placeholder {
		min-height: 160px;
		display: grid;
		place-items: center;
		border-radius: 1.25rem;
		background: rgba(15, 23, 42, 0.24);
		border: 1px dashed rgba(148, 163, 184, 0.32);
		color: var(--color-text-muted);
		font-size: 0.95rem;
	}

	.status-block {
		width: min(100%, var(--layout-max-width));
		margin: 0 auto clamp(1.2rem, 2vw, 1.8rem);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.25rem;
		padding: clamp(1rem, 2.5vw, 1.5rem) clamp(1.2rem, 3vw, 1.5rem);
		border-radius: 1.25rem;
		border: 1px solid rgba(239, 68, 68, 0.35);
		background: rgba(239, 68, 68, 0.12);
		color: #fee2e2;
	}

	.status-block__title {
		margin: 0 0 0.35rem;
		font-weight: 600;
		font-size: 1rem;
	}

	.status-block__body {
		margin: 0;
		font-size: 0.9rem;
		color: #fecaca;
	}

	.status-block__action {
		border: 0;
		border-radius: 999px;
		padding: 0.55rem 1.2rem;
		font-weight: 600;
		cursor: pointer;
		background: rgba(248, 113, 113, 0.9);
		color: #fff;
		transition: transform 0.2s ease;
	}

	.status-block__action:hover,
	.status-block__action:focus-visible {
		transform: translateY(-1px);
	}

	.section-card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: clamp(1rem, 3vw, 1.2rem);
		padding: clamp(1.4rem, 3vw, 1.8rem);
		min-height: 100%;
		border-radius: 1.25rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		box-shadow: 0 18px 42px -28px rgba(15, 23, 42, 0.45);
		transition:
			transform 0.2s ease,
			box-shadow 0.25s ease,
			border-color 0.25s ease;
	}

	.section-card:hover,
	.section-card:focus-within {
		transform: translateY(-3px);
		border-color: rgba(56, 189, 248, 0.38);
		box-shadow: 0 24px 55px -32px rgba(56, 189, 248, 0.5);
	}

	.section-card__link {
		display: flex;
		align-items: center;
		gap: clamp(1rem, 3vw, 1.4rem);
		text-decoration: none;
		color: inherit;
	}

	.section-card__link:focus-visible {
		outline: 2px solid rgba(56, 189, 248, 0.65);
		outline-offset: 4px;
	}

	.section-card__avatar {
		flex: 0 0 auto;
		width: 3.2rem;
		height: 3.2rem;
		border-radius: 999px;
		display: grid;
		place-items: center;
		font-weight: 700;
		font-size: 1.1rem;
		letter-spacing: 0.04em;
	}

	.section-card__content {
		flex: 1 1 auto;
		display: flex;
		flex-direction: column;
		gap: clamp(0.55rem, 2vw, 0.75rem);
	}

	.section-card__title {
		margin: 0;
		font-size: clamp(1.1rem, 3vw, 1.35rem);
		line-height: 1.35;
		font-weight: 600;
		color: var(--color-text);
	}

	.section-card__summary {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.55;
		color: var(--color-text-muted);
	}

	.section-card__chevron {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-muted);
	}

	.section-card__chevron svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.section-card__meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.85rem;
		color: var(--color-text-muted);
		border-top: 1px solid var(--color-border);
		padding-top: 0.75rem;
		margin-top: -0.35rem;
	}

	.section-card__meta-label {
		flex: 1 1 auto;
	}

	.section-card__edit {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border-radius: 999px;
		border: 1px solid transparent;
		background: var(--color-surface-alt);
		color: var(--color-text);
		padding: 0.35rem 0.75rem;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
	}

	.section-card__edit svg {
		width: 1rem;
		height: 1rem;
	}

	.section-card__edit:hover,
	.section-card__edit:focus-visible {
		border-color: var(--color-accent-border);
		background: var(--color-accent-faint);
		transform: translateY(-1px);
	}

	.section-card__edit:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--color-accent-faint-strong);
	}

	@media (max-width: 640px) {
		.status-block {
			flex-direction: column;
			align-items: flex-start;
		}

		.status-block__action {
			width: 100%;
			justify-content: center;
		}

		.section-card__link {
			align-items: flex-start;
		}

		.section-card__chevron {
			display: none;
		}
	}
</style>
