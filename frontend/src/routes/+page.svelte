<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './+page';

	export let data: PageData;

	const mockProgressBySection: Record<string, { completed: number; total: number }> = {
		'1': { completed: 6, total: 22 },
		'2': { completed: 4, total: 18 },
		'3': { completed: 8, total: 24 },
		'4': { completed: 5, total: 12 },
		'5': { completed: 3, total: 9 },
		'6': { completed: 2, total: 17 },
		'7': { completed: 1, total: 12 },
		'8': { completed: 2, total: 10 },
		'9': { completed: 0, total: 8 },
		'10': { completed: 0, total: 17 }
	};

	const defaultProgress = { completed: 0, total: 0 };

	const getProgress = (code: string) => {
		const progress = mockProgressBySection[code];
		return progress ?? defaultProgress;
	};

	const progressPercent = (completed: number, total: number) => {
		if (!total) return 0;
		return Math.round((completed / total) * 100);
	};

	const reloadSections = async () => {
		await invalidateAll();
	};

	const cleanTitle = (title: string) => title.replace(/\s*\([^)]*\)\s*$/, '').trim();
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

<section class="grid" aria-live="polite">
	{#if !data.sections.length && !data.loadError}
		<div class="grid__placeholder">
			<p>Kraunama skilčių lenta...</p>
		</div>
	{:else}
		{#each data.sections as section (section.code)}
			{@const progress = getProgress(section.code)}
			{@const percent = progressPercent(progress.completed, progress.total)}
			{@const title = cleanTitle(section.title)}

			<a
				class="section-card"
				href={resolve('/sections/[code]', { code: section.code })}
				aria-label={`Atidaryti skiltį ${section.ordinal}`}
			>
				<div class="section-card__head">
					<span class="section-card__ordinal">Skiltis {section.ordinal}</span>
					<span
						class="section-card__progress"
						aria-label={`Pažanga ${progress.completed} iš ${progress.total}`}
					>
						<span class="section-card__progress-label">Pažanga</span>
						<span>{progress.completed}/{progress.total}</span>
						<span>{percent}%</span>
					</span>
				</div>
				<h2 class="section-card__title">{title}</h2>
			</a>
		{/each}
	{/if}
</section>

<style>
	.grid {
		width: min(100%, var(--layout-max-width));
		margin: 0 auto;
		display: grid;
		gap: clamp(1.2rem, 3vw, 1.8rem);
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
	}

	.grid__placeholder {
		min-height: 160px;
		display: grid;
		place-items: center;
		border-radius: 1.25rem;
		background: rgba(15, 23, 42, 0.3);
		border: 1px dashed rgba(148, 163, 184, 0.35);
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
		gap: clamp(0.8rem, 2vw, 1rem);
		padding: clamp(1.5rem, 3vw, 2rem);
		min-height: 100%;
		border-radius: 1.25rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		box-shadow: 0 20px 45px -20px rgba(8, 145, 178, 0.35);
		text-decoration: none;
		color: inherit;
		transition:
			transform 0.2s ease,
			box-shadow 0.25s ease,
			border-color 0.25s ease;
	}

	.section-card:hover,
	.section-card:focus-visible {
		transform: translateY(-3px);
		border-color: rgba(56, 189, 248, 0.45);
		box-shadow: 0 26px 55px -24px rgba(56, 189, 248, 0.55);
	}

	.section-card:focus-visible {
		outline: 2px solid rgba(56, 189, 248, 0.65);
		outline-offset: 4px;
	}

	.section-card__head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.75rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: var(--color-text-muted);
	}

	.section-card__ordinal {
		color: var(--color-text);
		font-weight: 600;
	}

	.section-card__progress {
		display: inline-flex;
		gap: 0.45rem;
		align-items: center;
		white-space: nowrap;
		font-weight: 600;
		color: var(--color-text);
	}

	.section-card__progress-label {
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.section-card__progress span:last-child {
		color: var(--color-text-muted);
		font-weight: 500;
	}

	.section-card__title {
		margin: 0;
		font-size: clamp(1.05rem, 3vw, 1.35rem);
		line-height: 1.35;
		text-transform: uppercase;
		letter-spacing: 0.04em;
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
	}
</style>
