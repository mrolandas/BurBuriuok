<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { initializeAuth, requestMagicLink } from '$lib/stores/authStore';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { derived, get } from 'svelte/store';
	import { persistRedirectTarget } from '$lib/utils/authRedirect';

	onMount(() => {
		initializeAuth();
	});

	let email = '';
	let formError: string | null = null;
	let isSubmitting = false;
	let successMessage: string | null = null;

	const redirectParam = derived(page, ($page) => sanitizeRedirect($page.url.searchParams.get('redirectTo')));

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		formError = null;
		successMessage = null;

		if (!email.trim()) {
			formError = 'Įveskite el. pašto adresą.';
			return;
		}

		isSubmitting = true;
		try {
			persistRedirectTarget(get(redirectParam));
			await requestMagicLink(email, get(redirectParam));
			successMessage = 'Nuoroda išsiųsta! Patikrinkite el. pašto dėžutę.';
		} catch (error) {
			formError = error instanceof Error ? error.message : 'Nepavyko nusiųsti nuorodos.';
		} finally {
			isSubmitting = false;
		}
	}

	function navigateBack() {
		const redirectTo = get(redirectParam);
		if (redirectTo) {
			void gotoResolved(redirectTo, { replaceState: true });
			return;
		}
		void gotoResolved('/', { replaceState: true });
	}

	function sanitizeRedirect(candidate: string | null): string | null {
		if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
			return null;
		}

		try {
			const url = new URL(candidate, 'https://burkursas.local');
			const normalized = `${url.pathname}${url.search}${url.hash}` || '/';
			return normalized;
		} catch {
			return null;
		}
	}

	function gotoResolved(path: string, options?: Parameters<typeof goto>[1]) {
		const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
		const normalized = path.startsWith('/') ? path : `/${path}`;
		const href = `${base}${normalized}`;
		const target = new URL(href, origin);
		return goto(target, options);
	}
</script>

<svelte:head>
	<title>Prisijungimas · BurKursas</title>
</svelte:head>

<section class="auth">
	<div class="card">
		<header>
			<h1>Prisijungimas</h1>
			<p>Įveskite el. pašto adresą ir mes atsiųsime vienkartinę prisijungimo nuorodą.</p>
		</header>

		<form on:submit|preventDefault={handleSubmit}>
			<label for="email">El. paštas</label>
			<input
				id="email"
				type="email"
				name="email"
				bind:value={email}
				autocomplete="email"
				placeholder="vardas@pavyzdys.lt"
				required
			/>

			{#if formError}
				<p role="alert" class="error">{formError}</p>
			{/if}

			{#if successMessage}
				<p class="success">{successMessage}</p>
			{/if}

			<button type="submit" class="primary" disabled={isSubmitting}>
				{#if isSubmitting}
					Siunčiame...
				{:else}
					Gauti nuorodą
				{/if}
			</button>
		</form>

		<footer>
			<button type="button" class="link" on:click={navigateBack}>Grįžti</button>
		</footer>
	</div>
</section>

<style>
	.auth {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 70vh;
		padding: clamp(1.5rem, 4vw, 3rem) 1rem;
		background:
			radial-gradient(circle at 20% 20%, rgba(56, 189, 248, 0.12), transparent 45%),
			radial-gradient(circle at 80% 0%, rgba(14, 165, 233, 0.08), transparent 55%),
			var(--color-panel-soft, #f5f6fb);
	}

	.card {
		max-width: 420px;
		width: 100%;
		background: var(--color-panel, #fff);
		border: 1px solid var(--color-border, #e5e7eb);
		border-radius: 1.2rem;
		padding: clamp(1.75rem, 3vw, 2.5rem);
		box-shadow: 0 28px 65px rgba(15, 23, 42, 0.12);
	}

	header {
		margin-bottom: 1.75rem;
		display: grid;
		gap: 0.35rem;
	}

	header p {
		margin: 0;
		color: var(--color-text-soft);
		line-height: 1.5;
	}

	form {
		display: grid;
		gap: 0.9rem;
	}

	label {
		font-weight: 600;
		font-size: 0.95rem;
		color: var(--color-text-soft);
	}

	input[type='email'] {
		width: 100%;
		padding: 0.85rem 1rem;
		border: 1px solid var(--color-border, #d0d5dd);
		border-radius: 0.9rem;
		font-size: 1rem;
		background: var(--color-panel-soft);
		color: var(--color-text);
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	input[type='email']:focus-visible {
		outline: none;
		border-color: var(--color-pill-border);
		box-shadow: 0 0 0 3px var(--color-pill-hover-bg, rgba(56, 189, 248, 0.25));
	}

	button.primary {
		width: 100%;
		margin-top: 0.5rem;
		padding: 0.95rem 1rem;
		border-radius: 0.9rem;
		border: 1px solid var(--color-pill-border);
		background: var(--color-pill-bg);
		color: var(--color-pill-text);
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s ease, border-color 0.2s ease;
	}

	button.primary:disabled {
		opacity: 0.75;
		cursor: not-allowed;
	}

	button.primary:not(:disabled):hover,
	button.primary:not(:disabled):focus-visible {
		background: var(--color-pill-hover-bg);
		border-color: var(--color-pill-hover-border);
	}

	button.link {
		margin-top: 0.5rem;
		background: transparent;
		border: none;
		color: var(--color-link, var(--color-text-soft));
		font-weight: 600;
		cursor: pointer;
		padding: 0.5rem 0.25rem;
	}

	button.link:hover,
	button.link:focus-visible {
		text-decoration: underline;
	}

	.error,
	.success {
		margin: 0;
		padding: 0.65rem 0.85rem;
		border-radius: 0.75rem;
		font-size: 0.92rem;
	}

	.error {
		background: rgba(239, 68, 68, 0.12);
		color: #b42318;
		border: 1px solid rgba(239, 68, 68, 0.25);
	}

	.success {
		background: rgba(34, 197, 94, 0.12);
		color: #027a48;
		border: 1px solid rgba(34, 197, 94, 0.25);
	}

	footer {
		margin-top: 1rem;
		display: flex;
		justify-content: center;
	}

	@media (max-width: 500px) {
		.card {
			padding: 1.5rem;
		}

		.auth {
			padding: 1.25rem 0.75rem;
		}
	}
</style>
