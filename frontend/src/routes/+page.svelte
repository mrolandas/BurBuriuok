<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import PageHeading from '$lib/components/PageHeading.svelte';
</script>

<PageHeading
	kicker="Workstream B"
	title="Learner experience scaffold"
	description="Foundation for the curriculum section board, concept detail flows, and Supabase-powered learner dashboards."
>
	<svelte:fragment slot="actions">
		<a class="cta" href="https://github.com/mrolandas/BurBuriuok/issues/1"> View LX-001 </a>
		<a
			class="cta ghost"
			href="https://github.com/mrolandas/BurBuriuok/blob/main/docs/references/UX_MOBILE_WIREFRAMES.md"
			target="_blank"
			rel="noreferrer"
		>
			UX reference
		</a>
	</svelte:fragment>
</PageHeading>

<section class="grid">
	<Card subtitle="Now" title="Section board skeleton">
		<p>
			Implement the curriculum overview route with live Supabase data, responsive grid, and progress
			badges for required topics.
		</p>
		<p class="meta">Tracked in issue LX-001.</p>
	</Card>

	<Card subtitle="Next" title="Concept detail shell">
		<p>
			Compose the concept layout with prerequisite drawers, media placeholders, and quick actions
			for study queues.
		</p>
		<p class="meta">Tracked in issue LX-003.</p>
	</Card>

	<Card subtitle="Soon" title="Study session runner">
		<p>
			Build the timed study experience, integrating queue API endpoints and confidence captures for
			spaced repetition.
		</p>
		<p class="meta">Tracked in issue LX-005.</p>
	</Card>
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
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
	}

	.meta {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: var(--color-text-muted);
	}
</style>
