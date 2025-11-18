<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<section class="admin-dashboard">
	<header class="admin-dashboard__header">
		<h1>Administratoriaus valdymo pultas</h1>
		<p>
			Pasirinkite administravimo sritį. Naujos funkcijos atsiras čia, kai tik jos bus parengtos.
		</p>
	</header>

	<div class="admin-dashboard__grid">
		<a class="admin-card" href={resolve('/admin/concepts')}>
			<h2>Sąvokų administravimas</h2>
			<p>Kurti, redaguoti ar šalinti sąvokas ir peržiūrėti jų istoriją.</p>
		</a>
		<a class="admin-card" href={resolve('/admin/media')}>
			<h2>Papildomos medžiagos administravimas</h2>
			<p>Tvarkykite adminų įkeltus failus ir išorinius šaltinius.</p>
		</a>
		<div class="admin-card admin-card--disabled">
			<h2>Kitos sritys</h2>
			<p>Greitai bus galima valdyti papildomus administravimo modulius.</p>
		</div>
	</div>
</section>

<style>
	.admin-dashboard {
		display: grid;
		gap: 1.5rem;
	}

	.admin-dashboard__header h1 {
		margin: 0;
		font-size: clamp(1.6rem, 4vw, 2.4rem);
	}

	.admin-dashboard__header p {
		margin: 0.4rem 0 0;
		max-width: 48rem;
		line-height: 1.6;
	}

	.admin-dashboard__grid {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	}

	.admin-card {
		display: grid;
		gap: 0.5rem;
		padding: 1.1rem 1.2rem;
		border-radius: 0.85rem;
		border: 1px solid var(--color-border);
		background: var(--color-panel);
		text-decoration: none;
		color: inherit;
		transition:
			border-color 0.2s ease,
			background 0.2s ease,
			transform 0.2s ease;
	}

	.admin-card h2 {
		margin: 0;
		font-size: 1.2rem;
	}

	.admin-card p {
		margin: 0;
		color: var(--color-text-soft);
		line-height: 1.5;
	}

	.admin-card:hover,
	.admin-card:focus-visible {
		border-color: var(--color-pill-border);
		background: var(--color-panel-hover);
		transform: translateY(-2px);
	}

	.admin-card--disabled {
		opacity: 0.6;
		pointer-events: none;
	}

	@media (max-width: 640px) {
		.admin-dashboard__grid {
			grid-template-columns: 1fr;
		}
	}
</style>
