<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';
	import { getSupabaseClient } from '$lib/supabase/client';
	import { initializeAuth } from '$lib/stores/authStore';

	type CallbackState = 'idle' | 'exchanging' | 'success' | 'error';

	let state: CallbackState = 'idle';
	let message = 'Ruošiame patvirtinimą...';
	let redirectTarget = '/';

	onMount(() => {
		initializeAuth();
		void completeExchange();
	});

	async function completeExchange(): Promise<void> {
		const current = get(page);
		const code = current.url.searchParams.get('code');
		const type = current.url.searchParams.get('type');
		redirectTarget = sanitizeRedirect(current.url.searchParams.get('redirectTo'));

		if (!code || !type) {
			state = 'error';
			message = 'Trūksta prisijungimo parametrų. Bandykite išsiųsti nuorodą dar kartą.';
			return;
		}

		state = 'exchanging';
		message = 'Tikriname prisijungimo nuorodą...';

		try {
			const supabase = getSupabaseClient();
			const { error } = await supabase.auth.exchangeCodeForSession(code);

			if (error) {
				throw error;
			}

			state = 'success';
			message = 'Prisijungimas patvirtintas. Nukreipiame...';
			setTimeout(() => {
				void gotoResolved(redirectTarget, { replaceState: true });
			}, 1200);
		} catch (exchangeError) {
			console.error('[auth/callback] exchange failed', exchangeError);
			state = 'error';
			message = 'Nepavyko patvirtinti prisijungimo. Paprašykite naujos nuorodos.';
		}
	}

	function sanitizeRedirect(candidate: string | null): string {
		if (!candidate || !candidate.startsWith('/')) {
			return '/';
		}

		if (candidate.startsWith('//')) {
			return '/';
		}

		try {
			const url = new URL(candidate, 'https://burkursas.local');
			return `${url.pathname}${url.search}${url.hash}` || '/';
		} catch {
			return '/';
		}
	}

	function requestAnotherLink(): void {
		const target = `/auth/login?redirectTo=${encodeURIComponent(redirectTarget)}`;
		void gotoResolved(target);
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
	<title>Prisijungimo patvirtinimas · BurKursas</title>
</svelte:head>

<section class="callback">
	<div class="card" data-state={state}>
		<h1>Prisijungimo patvirtinimas</h1>
		<p>{message}</p>

		{#if state === 'error'}
			<button type="button" class="primary" on:click={requestAnotherLink}>
				Siųsti naują nuorodą
			</button>
		{/if}
	</div>
</section>

<style>
	.callback {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 60vh;
		padding: 2rem 1rem;
	}

	.card {
		max-width: 420px;
		width: 100%;
		text-align: center;
		background: var(--surface-primary, #fff);
		border-radius: 1rem;
		padding: 2rem;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
	}

	.card[data-state='exchanging']::after,
	.card[data-state='idle']::after {
		content: '';
		display: block;
		width: 2.5rem;
		height: 2.5rem;
		margin: 1.5rem auto 0;
		border-radius: 50%;
		border: 3px solid rgba(15, 98, 254, 0.2);
		border-top-color: var(--brand-primary, #0f62fe);
		animation: spin 1s linear infinite;
	}

	button.primary {
		margin-top: 1.5rem;
		width: 100%;
		padding: 0.85rem 1rem;
		border: none;
		border-radius: 0.75rem;
		background: var(--brand-primary, #0f62fe);
		color: #fff;
		font-weight: 600;
		cursor: pointer;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}

		to {
			transform: rotate(360deg);
		}
	}
</style>
