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

	type AvatarSegment = {
		d: string;
		fill?: string;
		stroke?: string;
		strokeWidth?: number;
		strokeLinecap?: 'round' | 'square' | 'butt';
		strokeLinejoin?: 'round' | 'miter' | 'bevel';
		fillRule?: 'nonzero' | 'evenodd';
	};

	type AvatarTheme = {
		background: string;
		border: string;
		iconColor: string;
		icon: AvatarSegment[];
	};

	const avatarThemes: AvatarTheme[] = [
		{
			background: 'rgba(56, 189, 248, 0.16)',
			border: 'rgba(14, 165, 233, 0.36)',
			iconColor: '#0f172a',
			icon: [
				{ d: 'M12 4l5.5 9H6.5z', fill: 'currentColor', fillRule: 'evenodd' },
				{ d: 'M5 18h14', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }
			]
		},
		{
			background: 'rgba(249, 115, 22, 0.18)',
			border: 'rgba(234, 88, 12, 0.32)',
			iconColor: '#7c2d12',
			icon: [
				{ d: 'M12 6a6 6 0 1 1 0 12 6 6 0 0 1 0-12z', stroke: 'currentColor', strokeWidth: 1.4 },
				{ d: 'M12 8l2.4 4L10 13.6z', fill: 'currentColor', fillRule: 'evenodd' }
			]
		},
		{
			background: 'rgba(16, 185, 129, 0.16)',
			border: 'rgba(5, 150, 105, 0.28)',
			iconColor: '#065f46',
			icon: [
				{
					d: 'M4 15c2.2 2 4.4 2 6.6 0s4.4-2 6.6 0 4.4 2 6.6 0',
					stroke: 'currentColor',
					strokeWidth: 1.6,
					strokeLinecap: 'round'
				}
			]
		},
		{
			background: 'rgba(236, 72, 153, 0.16)',
			border: 'rgba(219, 39, 119, 0.32)',
			iconColor: '#9d174d',
			icon: [
				{ d: 'M12 6l1.8 3.8 4.2.6-3 3 0.7 4.2L12 16.6 8.3 17.6 9 13.4l-3-3 4.2-.6z', fill: 'currentColor', fillRule: 'evenodd' }
			]
		},
		{
			background: 'rgba(129, 140, 248, 0.18)',
			border: 'rgba(99, 102, 241, 0.32)',
			iconColor: '#4338ca',
			icon: [
				{ d: 'M6 8l6-2 6 2v8l-6 2-6-2z', stroke: 'currentColor', strokeWidth: 1.6, strokeLinejoin: 'round' },
				{ d: 'M6 8l6 2 6-2', stroke: 'currentColor', strokeWidth: 1.6, strokeLinejoin: 'round' }
			]
		}
	];

	const hashCode = (value: string) => {
		let hash = 0;
		for (let index = 0; index < value.length; index += 1) {
			hash = (hash << 5) - hash + value.charCodeAt(index);
			hash |= 0;
		}
		return Math.abs(hash);
	};

	const selectTheme = (code: string) => {
		const index = hashCode(code) % avatarThemes.length;
		return avatarThemes[index] ?? avatarThemes[0];
	};

	const formatCount = (value: number, singular: string, few: string, many: string) => {
		const modTen = value % 10;
		const modHundred = value % 100;
		if (value === 0) {
			return `0 ${many}`;
		}
		if (modHundred >= 10 && modHundred <= 20) {
			return `${value} ${many}`;
		}
		if (modTen === 1) {
			return `${value} ${singular}`;
		}
		if (modTen >= 2 && modTen <= 9) {
			return `${value} ${few}`;
		}
		return `${value} ${many}`;
	};

	const formatMeta = (section: SectionCard) => {
		const subsectionLabel = formatCount(section.subsectionCount, 'skyrius', 'skyriai', 'skyrių');
		const conceptLabel = formatCount(section.conceptCount, 'sąvoka', 'sąvokos', 'sąvokų');
		return `${subsectionLabel} · ${conceptLabel}`;
	};

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
			{@const theme = selectTheme(section.code)}
			{@const metaLabel = formatMeta(section)}
			{@const sectionLabel = `Skyrius #${section.ordinal}`}
			{@const domId = toDomId(section.code)}

			<article class="section-card">
				<a
					class="section-card__link"
					href={resolve('/sections/[code]', { code: section.code })}
					aria-labelledby={`section-${domId}`}
				>
					<span
						class="section-card__avatar"
						style={`background:${theme.background};border-color:${theme.border};color:${theme.iconColor};`}
					>
						<svg viewBox="0 0 24 24" role="presentation" focusable="false" aria-hidden="true">
							{#each theme.icon as segment, index (index)}
								<path
									d={segment.d}
									fill={segment.fill ?? 'none'}
									stroke={segment.stroke ?? theme.iconColor}
									stroke-width={segment.strokeWidth}
									stroke-linecap={segment.strokeLinecap}
									stroke-linejoin={segment.strokeLinejoin}
									fill-rule={segment.fillRule}
								></path>
							{/each}
						</svg>
					</span>
					<div class="section-card__content">
						<h2 class="section-card__title" id={`section-${domId}`}>{title}</h2>
						<p class="section-card__summary">{description}</p>
					</div>
				</a>
				<div class="section-card__meta">
					<span class="section-card__meta-counts">{metaLabel}</span>
					<div class="section-card__meta-actions">
						<span class="section-card__meta-ordinal">{sectionLabel}</span>
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
								<span>Redaguoti skiltį</span>
							</button>
						{/if}
					</div>
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
		grid-template-columns: minmax(0, 1fr);
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
		transform: translateY(0);
	}

	.section-card:hover,
	.section-card:focus-within {
		transform: translateY(-4px);
		border-color: rgba(56, 189, 248, 0.38);
		box-shadow: 0 24px 55px -32px rgba(56, 189, 248, 0.5);
	}

	.section-card__link {
		display: flex;
		align-items: center;
		gap: clamp(1rem, 3vw, 1.4rem);
		text-decoration: none;
		color: inherit;
		flex: 1 1 auto;
	}

	.section-card__link:focus-visible {
		outline: 2px solid rgba(56, 189, 248, 0.65);
		outline-offset: 4px;
	}

	.section-card__avatar {
		flex: 0 0 auto;
		width: 3.6rem;
		height: 3.6rem;
		border-radius: 0.9rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid transparent;
	}

	.section-card__avatar svg {
		width: 1.8rem;
		height: 1.8rem;
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

	.section-card__meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		font-size: 0.85rem;
		color: var(--color-text-muted);
		border-top: 1px solid var(--color-border);
		padding-top: 0.85rem;
		margin-top: auto;
	}

	.section-card__meta-counts {
		flex: 1 1 auto;
		font-weight: 600;
		letter-spacing: 0.01em;
	}

	.section-card__meta-actions {
		display: inline-flex;
		align-items: center;
		gap: 0.8rem;
		flex: 0 0 auto;
	}

	.section-card__meta-ordinal {
		font-weight: 600;
		color: var(--color-text);
		white-space: nowrap;
		font-size: 0.82rem;
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
	}

	@media (min-width: 720px) {
		.sections-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
