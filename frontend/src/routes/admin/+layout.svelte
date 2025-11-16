<script lang="ts">
	import { resolve } from '$app/paths';

	type LayoutData = {
		guard: {
			allowed: boolean;
			reason: string;
			appRole: string | null;
			email: string | null;
			impersonating: boolean;
			errorMessage?: string;
		};
		impersonationEnabled: boolean;
	};

	let { data, children } = $props<{ data: LayoutData; children: () => unknown }>();

	const guard = data.guard;
	const impersonationEnabled = data.impersonationEnabled;
	const homeHref = resolve('/');

	const statusCopy: Record<string, string> = {
		'missing-session':
			'Norėdami pasiekti administratoriaus įrankius, prisijunkite kaip administratorius.',
		'session-error': 'Nepavyko perskaityti prisijungimo sesijos. Bandykite dar kartą.',
		'insufficient-role':
			'Šiai paskyrai nesuteiktos administratoriaus teisės. Susisiekite su komanda, jei manote, kad taip neturėtų būti.',
		'supabase-unconfigured':
			'Supabase konfigūracija nepasiekiama. Administratoriaus aplinka laikinai išjungta.'
	};

	const fallbackMessage =
		guard.errorMessage ??
		statusCopy[guard.reason] ??
		'Administratoriaus sritis pasiekiama tik turint reikiamas teises.';

	const personaLabel = guard.impersonating ? 'Imituojamas administratorius' : 'Administratorius';
</script>

{#if guard.allowed}
	<section class="admin-shell" aria-label="Administratoriaus aplinka">
		<div class="admin-shell__status" role="status">
			<span class="admin-shell__persona">{personaLabel}</span>
			{#if guard.email}
				<span class="admin-shell__email">{guard.email}</span>
			{/if}
		</div>
		<div class="admin-shell__content">
			{@render children?.()}
		</div>
	</section>
{:else}
	<section class="admin-fallback" aria-labelledby="admin-access-title">
		<h1 id="admin-access-title">Administratoriaus prieiga</h1>
		<p>{fallbackMessage}</p>
		<a class="admin-fallback__link" href={homeHref}>Grįžti į pagrindinį puslapį</a>

		{#if impersonationEnabled}
			<p class="admin-fallback__hint">
				Režimas <code>?impersonate=admin</code> leidžiamas tik kūrėjams, kai sukonfigūruotas
				aplinkos kintamasis
				<code>VITE_ENABLE_ADMIN_IMPERSONATION</code>.
			</p>
		{/if}
	</section>
{/if}

<style>
	.admin-shell {
		display: grid;
		gap: 1.2rem;
		padding: clamp(1.5rem, 3vw, 2.5rem);
	}

	.admin-shell__status {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
		padding: 0.75rem 1rem;
		border-radius: 0.9rem;
		border: 1px solid var(--color-border);
		background: var(--color-panel);
		color: var(--color-text);
		font-size: 0.95rem;
	}

	.admin-shell__persona {
		font-weight: 600;
	}

	.admin-shell__email {
		color: var(--color-text-soft);
	}

	.admin-shell__content {
		border-radius: 1.1rem;
		border: 1px dashed var(--color-border);
		background: var(--color-panel-soft);
		padding: clamp(1.5rem, 3vw, 2rem);
		min-height: 40vh;
	}

	.admin-fallback {
		display: grid;
		gap: 1rem;
		padding: clamp(1.5rem, 3vw, 2.5rem);
		border-radius: 1.2rem;
		border: 1px solid var(--color-border);
		background: var(--color-panel);
		color: var(--color-text);
		max-width: 48rem;
	}

	.admin-fallback__link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.6rem 1.2rem;
		border-radius: 0.8rem;
		background: var(--color-pill-bg);
		border: 1px solid var(--color-pill-border);
		text-decoration: none;
		color: var(--color-pill-text);
		font-weight: 600;
		width: fit-content;
	}

	.admin-fallback__link:hover,
	.admin-fallback__link:focus-visible {
		background: var(--color-pill-hover-bg);
		border-color: var(--color-pill-hover-border);
		color: var(--color-text);
	}

	.admin-fallback__hint {
		margin: 0;
		font-size: 0.85rem;
		color: var(--color-link-subtle);
	}

	@media (max-width: 640px) {
		.admin-shell,
		.admin-fallback {
			padding: 1.25rem;
		}

		.admin-shell__content {
			padding: 1.2rem;
		}
	}
</style>
