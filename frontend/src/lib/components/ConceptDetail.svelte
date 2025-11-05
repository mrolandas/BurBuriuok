<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ConceptDetail } from '$lib/api/concepts';
	import type { CurriculumItem } from '$lib/api/curriculum';

	type Breadcrumb = {
		label: string;
		routeId?: '/sections/[code]';
		params?: { code: string };
	};

	export let concept: ConceptDetail;
	export let breadcrumbs: Breadcrumb[] = [];
	export let peerItems: CurriculumItem[] = [];

	const boardHref = resolve('/');

	const formattedSource = concept.sourceRef?.trim() ?? '';

	const description = concept.descriptionLt?.trim() ?? '';
</script>

<section class="concept-detail">
	<nav class="concept-detail__breadcrumbs" aria-label="Navigacija">
		<a class="concept-detail__crumb" href={boardHref}>Skilčių lenta</a>
		{#each breadcrumbs as crumb (crumb.label)}
			<span class="concept-detail__crumb-separator" aria-hidden="true">›</span>
			{#if crumb.routeId && crumb.params}
				<a class="concept-detail__crumb" href={resolve(crumb.routeId, crumb.params)}
					>{crumb.label}</a
				>
			{:else}
				<span class="concept-detail__crumb concept-detail__crumb--static">{crumb.label}</span>
			{/if}
		{/each}
	</nav>

	<header class="concept-detail__header">
		{#if concept.isRequired}
			<span class="concept-detail__badge">Būtina tema</span>
		{:else}
			<span class="concept-detail__badge concept-detail__badge--optional">Pasirenkama tema</span>
		{/if}
		<h1 class="concept-detail__title">{concept.termLt}</h1>
		{#if concept.termEn}
			<p class="concept-detail__subtitle">{concept.termEn}</p>
		{/if}
		{#if concept.curriculumItemLabel}
			<p class="concept-detail__context">{concept.curriculumItemLabel}</p>
		{/if}
	</header>

	<div class="concept-detail__layout">
		<article class="concept-detail__content">
			<h2 class="concept-detail__section-title">Apibrėžimas</h2>
			{#if description}
				<p>{description}</p>
			{:else}
				<p>
					Apibrėžimas šiai temai dar nepateiktas. Papildysime turinį, kai tik jis bus paruoštas
					recenzijai.
				</p>
			{/if}

			{#if concept.descriptionEn}
				<div class="concept-detail__translation">
					<h3>Anglų kalbos užuomina</h3>
					<p>{concept.descriptionEn}</p>
				</div>
			{/if}

			{#if formattedSource}
				<footer class="concept-detail__source">
					<h3>Šaltinis</h3>
					<p>{formattedSource}</p>
				</footer>
			{/if}
		</article>

		<aside class="concept-detail__sidebar">
			<section class="concept-detail__panel">
				<h2>Prieraišos</h2>
				<p>
					Tikros prielaidos atsiras, kai viešoje schemoje publikavimo metas suteiks priklausomybių
					duomenis. Kol kas žymime, kad ši sritis laukia backend atnaujinimo.
				</p>
			</section>

			<section class="concept-detail__panel">
				<h2>Veiksmai</h2>
				<p class="concept-detail__panel-intro">
					Mygtukai kol kas neveikia – jie taps aktyvūs kartu su LX-004 / LX-005 studijų seanso
					funkcionalumu.
				</p>
				<div class="concept-detail__actions">
					<button type="button" disabled>Pažymėti kaip mokausi</button>
					<button type="button" disabled>Pridėti į pasiruošimo eilę</button>
					<button type="button" disabled>Pradėti mini viktoriną</button>
				</div>
			</section>

			{#if peerItems.length}
				<section class="concept-detail__panel concept-detail__panel--list">
					<h2>Susijusios temos</h2>
					<ul>
						{#each peerItems as item (item.ordinal)}
							<li>
								{#if item.conceptSlug}
									<a href={resolve('/concepts/[slug]', { slug: item.conceptSlug })}>{item.label}</a>
								{:else}
									<span>{item.label}</span>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</aside>
	</div>
</section>

<style>
	.concept-detail {
		display: grid;
		gap: clamp(1.4rem, 3vw, 2rem);
	}

	.concept-detail__breadcrumbs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.85rem;
		color: rgba(148, 163, 184, 0.85);
	}

	.concept-detail__crumb {
		color: inherit;
		text-decoration: none;
		border-bottom: 1px solid transparent;
		transition: border-color 0.2s ease;
	}

	.concept-detail__crumb:hover,
	.concept-detail__crumb:focus-visible {
		border-color: currentColor;
	}

	.concept-detail__crumb--static {
		opacity: 0.8;
	}

	.concept-detail__header {
		display: grid;
		gap: 0.4rem;
	}

	.concept-detail__badge {
		align-self: flex-start;
		display: inline-flex;
		gap: 0.35rem;
		align-items: center;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		font-size: 0.7rem;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		background: rgba(34, 197, 94, 0.15);
		color: #bbf7d0;
		border: 1px solid rgba(34, 197, 94, 0.35);
	}

	.concept-detail__badge--optional {
		background: rgba(96, 165, 250, 0.16);
		color: #dbeafe;
		border-color: rgba(96, 165, 250, 0.35);
	}

	.concept-detail__title {
		margin: 0;
		font-size: clamp(1.6rem, 4vw, 2.3rem);
		line-height: 1.1;
	}

	.concept-detail__subtitle {
		margin: 0;
		color: rgba(148, 163, 184, 0.9);
		font-size: clamp(1rem, 2.8vw, 1.2rem);
	}

	.concept-detail__context {
		margin: 0;
		color: rgba(226, 232, 240, 0.78);
		font-size: 0.95rem;
	}

	.concept-detail__layout {
		display: grid;
		gap: clamp(1.5rem, 3vw, 2.5rem);
	}

	.concept-detail__content {
		display: grid;
		gap: 1.4rem;
		border-radius: 1.2rem;
		padding: clamp(1.5rem, 3vw, 2rem);
		border: 1px solid rgba(148, 163, 184, 0.35);
		background: rgba(15, 23, 42, 0.4);
	}

	.concept-detail__section-title {
		margin: 0;
		font-size: clamp(1.1rem, 3vw, 1.4rem);
	}

	.concept-detail__content p {
		margin: 0;
		line-height: 1.7;
	}

	.concept-detail__translation {
		display: grid;
		gap: 0.5rem;
		padding: 1rem;
		border-radius: 1rem;
		background: rgba(59, 130, 246, 0.12);
		border: 1px solid rgba(59, 130, 246, 0.25);
	}

	.concept-detail__translation h3,
	.concept-detail__source h3 {
		margin: 0;
		font-size: 0.85rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(148, 163, 184, 0.85);
	}

	.concept-detail__source p {
		margin: 0;
		font-size: 0.85rem;
	}

	.concept-detail__sidebar {
		display: grid;
		gap: 1rem;
	}

	.concept-detail__panel {
		display: grid;
		gap: 0.6rem;
		padding: 1.1rem 1.25rem;
		border-radius: 1rem;
		border: 1px dashed rgba(148, 163, 184, 0.4);
		background: rgba(15, 23, 42, 0.24);
	}

	.concept-detail__panel h2 {
		margin: 0;
		font-size: clamp(1rem, 2.5vw, 1.2rem);
	}

	.concept-detail__panel p {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.6;
	}

	.concept-detail__panel-intro {
		color: rgba(226, 232, 240, 0.7);
	}

	.concept-detail__actions {
		display: grid;
		gap: 0.5rem;
	}

	.concept-detail__actions button {
		padding: 0.55rem 0.9rem;
		border-radius: 0.75rem;
		border: 1px solid rgba(148, 163, 184, 0.35);
		background: rgba(148, 163, 184, 0.12);
		color: rgba(226, 232, 240, 0.75);
		font-weight: 600;
		cursor: not-allowed;
	}

	.concept-detail__panel--list ul {
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.45rem;
		list-style: none;
	}

	.concept-detail__panel--list li a {
		color: rgba(94, 234, 212, 0.9);
		text-decoration: none;
		font-weight: 600;
	}

	.concept-detail__panel--list li a:hover,
	.concept-detail__panel--list li a:focus-visible {
		text-decoration: underline;
	}

	@media (min-width: 960px) {
		.concept-detail__layout {
			grid-template-columns: minmax(0, 3fr) minmax(0, 1.4fr);
		}
	}

	@media (max-width: 640px) {
		.concept-detail__badge {
			font-size: 0.65rem;
		}

		.concept-detail__actions {
			gap: 0.4rem;
		}

		.concept-detail__actions button {
			font-size: 0.85rem;
		}
	}
</style>
