<script lang="ts">
	export let title: string;
	export let kicker: string | undefined = undefined;
	export let description: string | undefined = undefined;
</script>

<section class="page-heading">
	{#if kicker}
		<p class="page-heading__kicker">{kicker}</p>
	{/if}
	<h1 class="page-heading__title">{title}</h1>
	{#if description}
		<p class="page-heading__description">{description}</p>
	{/if}
	<div class="page-heading__actions">
		<slot name="actions" />
	</div>
</section>

<style>
	.page-heading {
		max-width: var(--layout-max-width);
		margin: 0 auto clamp(2rem, 6vw, 3.5rem);
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	.page-heading__kicker {
		margin: 0;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.page-heading__title {
		margin: 0;
		font-size: clamp(2rem, 6vw, 3.4rem);
		font-weight: 600;
		line-height: 1.1;
	}

	.page-heading__description {
		margin: 0;
		max-width: 52ch;
		font-size: clamp(1rem, 2.5vw, 1.2rem);
		color: var(--color-text-muted);
	}

	.page-heading__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}
</style>
