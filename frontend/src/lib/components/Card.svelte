<script lang="ts">
	export let title: string | undefined = undefined;
	export let subtitle: string | undefined = undefined;
</script>

<article class="card">
	{#if subtitle}
		<p class="card__subtitle">{subtitle}</p>
	{/if}
	{#if title}
		<h2 class="card__title">{title}</h2>
	{/if}
	<div class="card__body">
		<slot />
	</div>
</article>

<style>
	.card {
		border-radius: 1.25rem;
		padding: clamp(1.5rem, 3vw, 2rem);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		box-shadow: 0 25px 50px -12px rgba(14, 116, 144, 0.35);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-height: 100%;
	}

	@media (prefers-color-scheme: light) {
		.card {
			background: rgba(255, 255, 255, 0.88);
			box-shadow: 0 16px 45px -22px rgba(15, 23, 42, 0.45);
		}
	}

	.card__subtitle {
		margin: 0;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: var(--color-text-muted);
	}

	.card__title {
		margin: 0;
		font-size: clamp(1.2rem, 4vw, 1.6rem);
		line-height: 1.25;
	}

	.card__body {
		color: var(--color-text-muted);
		font-size: 0.95rem;
		line-height: 1.6;
	}

	.card__body :global(p) {
		margin: 0 0 0.75rem;
	}

	.card__body :global(p:last-child) {
		margin-bottom: 0;
	}
</style>
