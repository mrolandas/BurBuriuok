<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import {
		initializeAuth,
		authSession,
		authStatus,
		refreshAuthSession,
		type AuthSession
	} from '$lib/stores/authStore';
	import {
		userProfile,
		userProfileStatus,
		userProfileError,
		loadUserProfile,
		saveUserProfile
	} from '$lib/stores/profileStore';
	import type { UserProfile, ProfilePayload } from '$lib/api/profile';
	import type { PreferredLanguage } from '../../../../shared/validation/profileSchema';

	type FormState = 'idle' | 'saving' | 'success' | 'error';
	type InviteNoticeKind = 'info' | 'success' | 'error';
	type InviteNotice = {
		kind: InviteNoticeKind;
		text: string;
	};

	let currentProfile: UserProfile | null = null;
	let profileStatus = 'idle';
	let profileError: string | null = null;
	let authState: 'idle' | 'checking' | 'authenticated' | 'unauthenticated' = 'idle';
	let session: AuthSession | null = null;
	let unsubscribeProfile: (() => void) | null = null;
	let unsubscribeStatus: (() => void) | null = null;
	let unsubscribeError: (() => void) | null = null;
	let unsubscribeAuth: (() => void) | null = null;
	let unsubscribeSession: (() => void) | null = null;

	let preferredLanguage: PreferredLanguage = 'lt';
	let callsign = '';
	let formState: FormState = 'idle';
	let formMessage: string | null = null;
	let inviteNotice: InviteNotice | null = null;
	let pendingInviteToken: string | null = null;

	const languageOptions: { value: PreferredLanguage; label: string; description: string }[] = [
		{ value: 'lt', label: 'Lietuvių', description: 'Pirminė mokymosi kalba' },
		{ value: 'en', label: 'Anglų', description: 'Administracinė ir pagalbinė' }
	];

		onMount(() => {
		initializeAuth();
		unsubscribeProfile = userProfile.subscribe((value) => {
			currentProfile = value;
			if (value) {
				preferredLanguage = value.preferredLanguage;
				callsign = value.callsign ?? '';
			}
		});
		unsubscribeStatus = userProfileStatus.subscribe((value) => {
			profileStatus = value;
		});
		unsubscribeError = userProfileError.subscribe((value) => {
			profileError = value;
		});
		unsubscribeAuth = authStatus.subscribe((value) => {
			authState = value;
		});
		unsubscribeSession = authSession.subscribe((value) => {
			session = value;
			maybeAcceptPendingInvite();
		});

		void primeProfile();
		const inviteToken = get(page).url.searchParams.get('invite');
		if (inviteToken) {
			pendingInviteToken = inviteToken;
			maybeAcceptPendingInvite();
		}

		return () => {
			unsubscribeSession?.();
		};
	});

	onDestroy(() => {
		unsubscribeProfile?.();
		unsubscribeStatus?.();
		unsubscribeError?.();
		unsubscribeAuth?.();
		unsubscribeSession?.();
	});

	async function primeProfile(): Promise<void> {
		try {
			await loadUserProfile();
		} catch (error) {
			console.warn('[profile] Failed to load profile', error);
		}
	}

	async function handleProfileSave(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!session) {
			formState = 'error';
			formMessage = 'Prisijunkite prieš išsaugodami profilį.';
			return;
		}

		formState = 'saving';
		formMessage = null;

		const payload: ProfilePayload = {
			preferredLanguage,
			callsign: callsign.trim() ? callsign.trim() : null
		};

		try {
			const updated = await saveUserProfile(payload);
			formState = 'success';
			formMessage = 'Profilis atnaujintas.';
			currentProfile = updated;
		} catch (error) {
			formState = 'error';
			formMessage =
				error instanceof Error ? error.message : 'Nepavyko išsaugoti profilio. Bandykite dar kartą.';
		}
	}

	function maybeAcceptPendingInvite(): void {
		if (!pendingInviteToken || !session) {
			return;
		}
		const token = pendingInviteToken;
		pendingInviteToken = null;
		void acceptInvite(token);
	}

	async function acceptInvite(token: string | null): Promise<void> {
		const normalized = token?.trim();
		if (!normalized) {
			inviteNotice = { kind: 'error', text: 'Kvietimo nuoroda neteisinga.' };
			return;
		}

		inviteNotice = { kind: 'info', text: 'Tikriname kvietimą…' };

		try {
			const updated = await saveUserProfile({ inviteToken: normalized });
			inviteNotice = {
				kind: 'success',
				text: 'Kvietimas pritaikytas! Jūsų teisės atnaujintos.'
			};
			currentProfile = updated;
			preferredLanguage = updated.preferredLanguage;
			callsign = updated.callsign ?? '';
			await refreshAuthSession();
			await removeInviteParam();
		} catch (error) {
			inviteNotice = {
				kind: 'error',
				text:
					error instanceof Error
						? error.message
						: 'Kvietimo nepavyko pritaikyti. Patikrinkite nuorodą.'
			};
		}
	}

	async function removeInviteParam(): Promise<void> {
		const current = get(page);
		const url = new URL(current.url.href);
		url.searchParams.delete('invite');
		await goto(url, { replaceState: true, keepFocus: true, noScroll: true });
	}

	function navigateToLogin(): void {
		const redirect = encodeURIComponent('/profile');
		const loginBase = resolve('/auth/login');
		void goto(`${loginBase}?redirectTo=${redirect}`);
	}

	function formatDate(value?: string | null): string {
		if (!value) {
			return '—';
		}

		const date = new Date(value);
		if (Number.isNaN(date.getTime())) {
			return value;
		}

		return date.toLocaleDateString('lt-LT', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

</script>

<svelte:head>
	<title>Mano profilis · BurKursas</title>
</svelte:head>

<section class="profile">
	<header class="profile__header">
		<h1>Mano profilis</h1>
		<p>Tvarkykite savo mokymosi kalbą, slapyvardį ir peržiūrėkite priskirtas roles.</p>
	</header>

	{#if inviteNotice}
		<p
			class="profile__state"
			class:success={inviteNotice.kind === 'success'}
			class:error={inviteNotice.kind === 'error'}
		>
			{inviteNotice.text}
		</p>
	{/if}

	{#if authState === 'checking'}
		<p class="profile__state">Tikriname prisijungimo būseną...</p>
	{:else if !session}
		<div class="profile__card">
			<p>Norėdami redaguoti profilį, prisijunkite prie BurKursas paskyros.</p>
			<button type="button" class="primary" on:click={navigateToLogin}>Prisijungti</button>
		</div>
	{:else}
		{#if profileStatus === 'loading'}
			<p class="profile__state">Įkeliame profilio duomenis...</p>
		{:else}
			{#if profileError}
				<p class="profile__error" role="alert">{profileError}</p>
			{/if}

			<section class="profile__grid">
				<article class="profile__card">
					<h2>Paskyros informacija</h2>
					<ul>
						<li><strong>El. paštas:</strong> {session?.email ?? 'nenurodytas'}</li>
						<li>
							<strong>Rolė:</strong>
							{#if currentProfile?.role === 'admin'}
								<span class="badge badge--admin">Administratorius</span>
							{:else if currentProfile?.role === 'contributor'}
								<span class="badge badge--contributor">Talkininkas</span>
							{:else}
								<span class="badge">Mokinys</span>
							{/if}
						</li>
						<li>
							<strong>Kalba:</strong> {languageOptions.find((option) => option.value === preferredLanguage)?.label}
						</li>
						<li><strong>Atnaujinta:</strong> {formatDate(currentProfile?.updatedAt)}</li>
					</ul>
				</article>

				<article class="profile__card">
					<h2>Profilio nustatymai</h2>
					<form class="profile-form" on:submit|preventDefault={handleProfileSave}>
						<label for="preferred-language">Pageidaujama kalba</label>
						<select id="preferred-language" bind:value={preferredLanguage}>
							{#each languageOptions as option}
								<option value={option.value}>{option.label} – {option.description}</option>
							{/each}
						</select>

						<label for="callsign">Slapyvardis (nebūtinas)</label>
						<input
							id="callsign"
							type="text"
							maxlength="60"
							placeholder='pvz., „Šiaurės vėjas“'
							bind:value={callsign}
						/>

						{#if formMessage}
							<p class:success={formState === 'success'} class:error={formState === 'error'}>
								{formMessage}
							</p>
						{/if}

						<button type="submit" class="primary" disabled={formState === 'saving'}>
							{formState === 'saving' ? 'Išsaugome…' : 'Išsaugoti' }
						</button>
					</form>
				</article>

			</section>
		{/if}
	{/if}
</section>

<style>
	.profile {
		display: grid;
		gap: 1.5rem;
		padding: 1rem;
	}

	.profile__header h1 {
		margin: 0;
	}

	.profile__state {
		padding: 1rem;
		background: var(--color-panel);
		border-radius: 0.75rem;
	}

	.profile__card {
		background: var(--color-panel, #fff);
		border: 1px solid var(--color-border, #e4e7ec);
		border-radius: 0.85rem;
		padding: 1.25rem;
		box-shadow: 0 6px 20px rgba(15, 23, 42, 0.04);
		display: grid;
		gap: 0.75rem;
	}

	.profile__grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1rem;
	}

	.profile-form {
		display: grid;
		gap: 0.75rem;
	}

	select,
	input[type='text'] {
		padding: 0.75rem 0.9rem;
		border-radius: 0.75rem;
		border: 1px solid var(--color-border, #d0d5dd);
	}

	button.primary {
		border: none;
		border-radius: 0.75rem;
		padding: 0.85rem 1rem;
		font-weight: 600;
		cursor: pointer;
	}

	button.primary {
		background: var(--brand-primary, #0f62fe);
		color: #fff;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		font-size: 0.85rem;
		background: #eef2ff;
		color: #4338ca;
	}

	.badge--admin {
		background: #fef3c7;
		color: #92400e;
	}

	.badge--contributor {
		background: #ecfccb;
		color: #3f6212;
	}

	.success {
		color: #0f8b43;
	}

	.error {
		color: #c81e1e;
	}

	.profile__error {
		color: #c81e1e;
		padding: 0.75rem;
		background: rgba(200, 30, 30, 0.08);
		border-radius: 0.5rem;
	}

	.profile__card ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.35rem;
	}

	@media (max-width: 640px) {
		.profile__grid {
			grid-template-columns: 1fr;
		}
	}
</style>
