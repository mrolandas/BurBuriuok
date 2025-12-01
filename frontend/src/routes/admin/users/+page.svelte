<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		createAdminInvite,
		fetchAdminUsers,
		revokeAdminInvite,
		updateAdminUserRole,
		type AdminInviteSummary,
		type AdminProfileSummary
	} from '$lib/api/admin/users';
	import { authSession, initializeAuth, type AuthSession } from '$lib/stores/authStore';
	import type { ProfileRole } from '../../../../../shared/validation/profileSchema';

	type LoadState = 'idle' | 'loading' | 'ready' | 'error';
	type FormState = 'idle' | 'submitting' | 'success' | 'error';

	let users: AdminProfileSummary[] = [];
	let invites: AdminInviteSummary[] = [];
	let loadState: LoadState = 'idle';
	let loadError: string | null = null;
	let session: AuthSession | null = null;
	let inviteForm = {
		email: '',
		role: 'admin' as ProfileRole,
		expiresInHours: 72
	};
	let inviteFormState: FormState = 'idle';
	let inviteFormMessage: string | null = null;
	let inviteShareLink: string | null = null;
	let inviteShareVisible = false;
	let refreshingRoles = new Set<string>();
	let revokingInvites = new Set<string>();
	let totalUsers = 0;
	let adminCount = 0;
	let impersonatingAdmin = false;
	const adminImpersonationEnabled =
		import.meta.env.VITE_ENABLE_ADMIN_IMPERSONATION === 'true' ||
		import.meta.env.VITE_ENABLE_ADMIN_IMPERSONATION === '1' ||
		import.meta.env.VITE_ENABLE_ADMIN_IMPERSONATION === 'enabled';
	let pageUnsubscribe: (() => void) | null = null;

	const roleOptions: { value: ProfileRole; label: string }[] = [
		{ value: 'admin', label: 'Administratorius' },
		{ value: 'contributor', label: 'Talkininkas' },
		{ value: 'learner', label: 'Mokinys' }
	];

	const expiryOptions = [
		{ label: '48 valandos', value: 48 },
		{ label: '3 dienos', value: 72 },
		{ label: '7 dienos', value: 168 }
	];

	onMount(() => {
		initializeAuth();
		const unsub = authSession.subscribe((value) => {
			session = value;
		});
		pageUnsubscribe = page.subscribe(({ url }) => {
			impersonatingAdmin = adminImpersonationEnabled && url.searchParams.get('impersonate') === 'admin';
		});
		void loadDashboard();
		return () => {
			unsub();
			pageUnsubscribe?.();
			pageUnsubscribe = null;
		};
	});


	async function loadDashboard(): Promise<void> {
		loadState = 'loading';
		loadError = null;
		inviteShareLink = null;
		inviteShareVisible = false;
		try {
			const result = await fetchAdminUsers();
			users = result.users;
			invites = result.invites;
			updateUserStats();
			loadState = 'ready';
		} catch (error) {
			loadState = 'error';
			loadError = error instanceof Error ? error.message : 'Nepavyko įkelti naudotojų sąrašo.';
		}
	}

	async function handleInviteSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		inviteFormState = 'submitting';
		inviteFormMessage = null;
		inviteShareVisible = false;

		try {
			const payload = { ...inviteForm };
			payload.email = payload.email.trim().toLowerCase();
			const response = await createAdminInvite(payload);
			invites = [response.invite, ...invites];
			inviteFormState = 'success';
			inviteFormMessage = 'Kvietimas išsiųstas. Pasidalinkite nuoroda arba laukite, kol naudotojas prisijungs.';
			inviteForm.email = '';
			inviteShareLink = buildInviteLink(response.redirectTarget);
			inviteShareVisible = Boolean(inviteShareLink);
		} catch (error) {
			inviteFormState = 'error';
			inviteFormMessage =
				error instanceof Error ? error.message : 'Nepavyko sukurti kvietimo. Bandykite dar kartą.';
		}
	}

	async function handleRoleChange(profileId: string, role: ProfileRole): Promise<void> {
		refreshingRoles.add(profileId);
		try {
			const updated = await updateAdminUserRole(profileId, role);
			users = users.map((user) => (user.id === profileId ? updated : user));
			updateUserStats();
		} catch (error) {
			console.error('[admin/users] role update failed', error);
			alert(
				error instanceof Error ? error.message : 'Nepavyko atnaujinti rolės. Patikrinkite teises ir bandykite dar kartą.'
			);
		} finally {
			refreshingRoles.delete(profileId);
		}
	}

	async function handleInviteRevoke(inviteId: string): Promise<void> {
		revokingInvites.add(inviteId);
		try {
			const updated = await revokeAdminInvite(inviteId);
			invites = invites.map((invite) => (invite.id === inviteId ? updated : invite));
		} catch (error) {
			console.error('[admin/users] invite revoke failed', error);
			alert(error instanceof Error ? error.message : 'Nepavyko atšaukti kvietimo.');
		} finally {
			revokingInvites.delete(inviteId);
		}
	}

	function buildInviteLink(redirectTarget: string): string | null {
		if (typeof window === 'undefined') {
			return null;
		}

		const loginBase = resolve('/auth/login');
		const url = new URL(loginBase, window.location.origin);
		url.searchParams.set('redirectTo', redirectTarget);
		return url.toString();
	}

	async function copyInviteLink(): Promise<void> {
		if (!inviteShareLink) {
			return;
		}

		try {
			await navigator.clipboard.writeText(inviteShareLink);
			inviteFormMessage = 'Nuoroda nukopijuota. Pasidalinkite su kviečiamu naudotoju.';
		} catch (error) {
			console.warn('[admin/users] copy failed', error);
		}
	}

	function inviteStatus(invite: AdminInviteSummary): string {
		return invite.status === 'pending'
			? 'Laukiama'
			: invite.status === 'accepted'
				? 'Priimtas'
				: invite.status === 'revoked'
					? 'Atšauktas'
					: 'Baigė galioti';
	}

	function isPending(invite: AdminInviteSummary): boolean {
		return invite.status === 'pending';
	}

	function formatDate(value: string | null): string {
		if (!value) {
			return '—';
		}

		const date = new Date(value);
		return Number.isNaN(date.getTime())
			? value
			: date.toLocaleString('lt-LT', {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
	}

	function navigateToAdminHome(): void {
		void goto(resolve('/admin'));
	}

	function updateUserStats(): void {
		totalUsers = users.length;
		adminCount = users.filter((user) => user.role === 'admin').length;
	}
</script>

<svelte:head>
	<title>Naudotojų valdymas · BurKursas</title>
</svelte:head>

<section class="admin-section users">
	<header class="users__header">
		<div>
			<h1>Naudotojų valdymas</h1>
			<p>Sekite aktyvius administratorius ir siųskite kvietimus naujiems komandos nariams.</p>
		</div>
		<button type="button" class="admin-button admin-button--secondary" on:click={navigateToAdminHome}>
			Grįžti į valdymo pultą
		</button>
	</header>

	{#if !session && !impersonatingAdmin}
		<p class="admin-alert">Prisijunkite kaip administratorius, kad pasiektumėte šį puslapį.</p>
	{:else if session && session.appRole !== 'admin' && !impersonatingAdmin}
		<p class="admin-alert">Tik administratoriai gali valdyti naudotojų sąrašą.</p>
	{:else}
		{#if impersonatingAdmin}
			<p class="admin-alert admin-alert--warning users__banner">
				Peržiūrite puslapį administratoriaus režimu (impersonation). Duomenys rodomi tik lokaliai.
			</p>
		{/if}
		{#if loadState === 'loading'}
			<p class="admin-alert">Įkeliame duomenis...</p>
		{:else if loadState === 'error'}
			<p class="admin-alert admin-alert--error" role="alert">{loadError}</p>
		{:else}
			<section class="admin-grid admin-grid--two-column users__grid">
				<article class="admin-card admin-card--hoverable users__card users__card--list">
					<div class="users__card-header">
						<div>
							<h2 class="admin-card__title">Visi naudotojai</h2>
							<p class="admin-card__subtitle">Iš viso {totalUsers} · Administratoriai {adminCount}</p>
						</div>
					</div>
					{#if !users.length}
						<p>Šiuo metu nėra registruotų naudotojų.</p>
					{:else}
						<table class="admin-table">
							<thead>
								<tr>
									<th>El. paštas</th>
									<th>Rolė</th>
									<th>Atnaujinta</th>
								</tr>
							</thead>
							<tbody>
								{#each users as user}
									<tr>
										<td>
											<strong>{user.email}</strong>
											{#if user.callsign}
												<span class="muted">({user.callsign})</span>
											{/if}
										</td>
										<td>
											<select
												bind:value={user.role}
												on:change={(event) => handleRoleChange(user.id, event.currentTarget.value as ProfileRole)}
												disabled={refreshingRoles.has(user.id)}
											>
												{#each roleOptions as option}
													<option value={option.value}>{option.label}</option>
												{/each}
											</select>
										</td>
										<td>{formatDate(user.updatedAt)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				</article>

				<div class="users__stack admin-grid">
					<article class="admin-card users__card users__card--form">
						<h2 class="admin-card__title">Naujas kvietimas</h2>
						<form class="admin-form invite-form" on:submit|preventDefault={handleInviteSubmit}>
							<div class="admin-field">
								<label class="admin-field__label" for="invite-email">El. paštas</label>
								<input
									id="invite-email"
									type="email"
									required
									placeholder="vardas@pavyzdys.lt"
									bind:value={inviteForm.email}
								/>
							</div>

							<div class="admin-field">
								<label class="admin-field__label" for="invite-role">Rolė</label>
								<select id="invite-role" bind:value={inviteForm.role}>
									{#each roleOptions as option}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
							</div>

							<div class="admin-field">
								<label class="admin-field__label" for="invite-expiry">Galiojimas</label>
								<select id="invite-expiry" bind:value={inviteForm.expiresInHours}>
									{#each expiryOptions as option}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
							</div>

							{#if inviteFormMessage}
								<p
									class={`invite-form__notice admin-alert ${inviteFormState === 'success' ? 'invite-form__notice--success' : 'admin-alert--error'}`}
								>
									{inviteFormMessage}
								</p>
							{/if}

							<div class="invite-form__actions">
								<button type="submit" class="admin-button admin-button--primary" disabled={inviteFormState === 'submitting'}>
									{inviteFormState === 'submitting' ? 'Siunčiame…' : 'Siųsti kvietimą'}
								</button>
								{#if inviteShareVisible && inviteShareLink}
									<button type="button" class="admin-button admin-button--secondary" on:click={copyInviteLink}>
										Kopijuoti nuorodą
									</button>
								{/if}
							</div>
						</form>
					</article>

					<article class="admin-card users__card">
						<h2>Laukiantys kvietimai</h2>
						{#if !invites.length}
							<p>Nėra aktyvių kvietimų.</p>
						{:else}
							<ul class="invite-list">
								{#each invites as invite}
									<li>
										<div>
											<strong>{invite.email}</strong>
											<span class={`status-chip status-chip--${invite.status}`}>{inviteStatus(invite)}</span>
											<p>Galioja iki {formatDate(invite.expiresAt)}</p>
										</div>
										{#if isPending(invite)}
											<button
												type="button"
												class="admin-button admin-button--secondary"
												on:click={() => handleInviteRevoke(invite.id)}
												disabled={revokingInvites.has(invite.id)}
											>
												{revokingInvites.has(invite.id) ? 'Atšaukiame…' : 'Atšaukti'}
											</button>
										{/if}
									</li>
								{/each}
							</ul>
						{/if}
					</article>
				</div>
			</section>
		{/if}
	{/if}
</section>

<style>
	.users__header {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		justify-content: space-between;
	}

	.users__header p {
		color: var(--color-text-soft);
		margin: 0.3rem 0 0;
	}

	.users__grid {
		align-items: start;
	}

	.users__card-header {
		align-items: flex-start;
		display: flex;
		justify-content: space-between;
	}

	.users__card--list {
		overflow-x: auto;
	}

	.invite-form__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.invite-form__notice {
		font-size: 0.9rem;
		margin: 0;
	}

	.invite-form__notice--success {
		background: rgba(34, 197, 94, 0.12);
		border: 1px solid rgba(34, 197, 94, 0.25);
		color: #166534;
	}

	.invite-list {
		display: grid;
		gap: 0.85rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.invite-list li {
		align-items: center;
		border-bottom: 1px solid var(--color-border-light, rgba(148, 163, 184, 0.25));
		display: flex;
		gap: 0.75rem;
		justify-content: space-between;
		padding-bottom: 0.85rem;
	}

	.invite-list li:last-child {
		border-bottom: none;
	}

	.muted {
		color: var(--color-text-soft);
		font-size: 0.9rem;
	}

	@media (max-width: 640px) {
		.users__header {
			align-items: flex-start;
			flex-direction: column;
		}

		.invite-form__actions {
			flex-direction: column;
		}

		.invite-form__actions .admin-button {
			width: 100%;
		}
	}
</style>

