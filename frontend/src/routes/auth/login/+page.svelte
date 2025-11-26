<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { initializeAuth, requestMagicLink } from '$lib/stores/authStore';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { derived, get } from 'svelte/store';

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
		padding: 2rem 1rem;
	}

	.card {
		max-width: 420px;
		width: 100%;
		background: var(--surface-primary, #fff);
		border-radius: 1rem;
		padding: 2rem;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
	}

	header {
		margin-bottom: 1.5rem;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
	}

	input[type='email'] {
		width: 100%;
		padding: 0.85rem 1rem;
		border: 1px solid var(--border-muted, #d0d5dd);
		border-radius: 0.75rem;
		font-size: 1rem;
	}

	button.primary {
		width: 100%;
		margin-top: 1rem;
		padding: 0.85rem 1rem;
		border: none;
		border-radius: 0.75rem;
		background: var(--brand-primary, #0f62fe);
		color: #fff;
		font-weight: 600;
		cursor: pointer;
	}

	button.primary:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	button.link {
		margin-top: 1rem;
		background: transparent;
		border: none;
		color: var(--text-secondary, #475467);
		cursor: pointer;
	}

	.error {
		color: #b42318;
		margin-top: 0.5rem;
	}

	.success {
		color: #027a48;
		margin-top: 0.5rem;
	}
</style>
