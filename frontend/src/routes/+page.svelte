<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import Card from '$lib/components/Card.svelte';
	import PageHeading from '$lib/components/PageHeading.svelte';
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
</script>

<PageHeading
	kicker="LX-001"
	title="Curriculum section board"
	description="Peržiūrėkite pagrindines mokymo sekcijas, stebėkite pažangą ir pereikite prie detalizuotos medžiagos."
>
	<svelte:fragment slot="actions">
		<a class="cta" href="https://github.com/mrolandas/BurBuriuok/issues/1">Peržiūrėti užduotį</a>
		<a
			class="cta ghost"
			href="https://github.com/mrolandas/BurBuriuok/blob/main/docs/references/UX_MOBILE_WIREFRAMES.md"
			target="_blank"
			rel="noreferrer"
		>
			UX gairės
		</a>
	</svelte:fragment>
</PageHeading>

{#if data.loadError}
	<section class="status-block status-block--error" role="alert">
		<div>
			<p class="status-block__title">Nepavyko įkelti sekcijų</p>
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
			<p>Kraunama sekcijų lenta...</p>
		</div>
	{:else}
		{#each data.sections as section (section.code)}
			{@const progress = getProgress(section.code)}
			{@const percent = progressPercent(progress.completed, progress.total)}

			<Card subtitle={`Sekcija ${section.ordinal}`} title={section.title}>
				{#if section.summary}
					<p>{section.summary}</p>
				{:else}
					<p class="muted">Santrauka ruošiama.</p>
				{/if}
				<div class="section-card__meta">
					<div
						class="section-card__progress"
						aria-label={`Pažanga ${progress.completed} iš ${progress.total}`}
					>
						<span class="section-card__progress-label">Pažanga</span>
						<span class="section-card__progress-value">{progress.completed}/{progress.total}</span>
						<span class="section-card__progress-percentage">{percent}%</span>
					</div>
					<a
						class="section-card__cta"
						href={resolve(`/sections/${section.code}` as unknown as Parameters<typeof resolve>[0])}
					>
						Atidaryti sekciją
					</a>
				</div>
			</Card>
		{/each}
	{/if}
</section>

<style>
	.cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.6rem 1.1rem;
		border-radius: 999px;
		font-weight: 600;
		text-decoration: none;
		background: linear-gradient(120deg, var(--color-accent), var(--color-accent-strong));
		color: white;
		box-shadow: 0 18px 38px -20px rgba(8, 145, 178, 0.55);
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease;
	}

	.cta:hover,
	.cta:focus-visible {
		transform: translateY(-1px);
		box-shadow: 0 24px 44px -18px rgba(3, 105, 161, 0.6);
	}

	.cta.ghost {
		background: transparent;
		color: var(--color-text);
		border: 1px solid rgba(56, 189, 248, 0.35);
		box-shadow: none;
	}

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

	.section-card__meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-top: clamp(0.75rem, 2vw, 1.1rem);
	}

	.section-card__progress {
		display: grid;
		gap: 0.15rem;
	}

	.section-card__progress-label {
		text-transform: uppercase;
		letter-spacing: 0.12em;
		font-size: 0.7rem;
		color: var(--color-text-muted);
	}

	.section-card__progress-value {
		font-weight: 600;
		font-size: 1rem;
	}

	.section-card__progress-percentage {
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	.section-card__cta {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.55rem 1.05rem;
		border-radius: 999px;
		font-weight: 600;
		text-decoration: none;
		color: var(--color-text);
		border: 1px solid rgba(148, 163, 184, 0.4);
		transition:
			transform 0.2s ease,
			background 0.2s ease;
	}

	.section-card__cta:hover,
	.section-card__cta:focus-visible {
		transform: translateY(-1px);
		background: rgba(148, 163, 184, 0.08);
	}

	.muted {
		color: var(--color-text-muted);
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
