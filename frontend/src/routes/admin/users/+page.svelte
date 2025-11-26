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

<section class="users">
	<header class="users__header">
		<div>
			<h1>Naudotojų valdymas</h1>
			<p>Sekite aktyvius administratorius ir siųskite kvietimus naujiems komandos nariams.</p>
		</div>
		<button type="button" class="secondary" on:click={navigateToAdminHome}>Grįžti į valdymo pultą</button>
	</header>

	{#if !session && !impersonatingAdmin}
		<p class="users__state">Prisijunkite kaip administratorius, kad pasiektumėte šį puslapį.</p>
	{:else if session && session.appRole !== 'admin' && !impersonatingAdmin}
		<p class="users__state">Tik administratoriai gali valdyti naudotojų sąrašą.</p>
	{:else}
		{#if impersonatingAdmin}
			<p class="users__banner">Peržiūrite puslapį administratoriaus režimu (impersonation). Duomenys rodomi tik lokaliai.</p>
		{/if}
		{#if loadState === 'loading'}
			<p class="users__state">Įkeliame duomenis...</p>
		{:else if loadState === 'error'}
			<p class="users__error" role="alert">{loadError}</p>
		{:else}
			<section class="users__grid">
				<article class="users__card users__card--list">
					<div class="users__card-header">
						<div>
							<h2>Visi naudotojai</h2>
							<p class="users__card-subtitle">
								Iš viso {totalUsers} · Administratoriai {adminCount}
							</p>
						</div>
					</div>
					{#if !users.length}
						<p>Šiuo metu nėra registruotų naudotojų.</p>
					{:else}
						<table class="users-table">
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

				<div class="users__stack">
					<article class="users__card users__card--form">
						<h2>Naujas kvietimas</h2>
						<form class="invite-form" on:submit|preventDefault={handleInviteSubmit}>
							<label for="invite-email">El. paštas</label>
							<input
								id="invite-email"
								type="email"
								required
								placeholder="vardas@pavyzdys.lt"
								bind:value={inviteForm.email}
							/>

							<label for="invite-role">Rolė</label>
							<select id="invite-role" bind:value={inviteForm.role}>
								{#each roleOptions as option}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>

							<label for="invite-expiry">Galiojimas</label>
							<select id="invite-expiry" bind:value={inviteForm.expiresInHours}>
								{#each expiryOptions as option}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>

							{#if inviteFormMessage}
								<p class:success={inviteFormState === 'success'} class:error={inviteFormState === 'error'}>
									{inviteFormMessage}
								</p>
							{/if}

							<div class="invite-form__actions">
								<button type="submit" class="primary" disabled={inviteFormState === 'submitting'}>
									{inviteFormState === 'submitting' ? 'Siunčiame…' : 'Siųsti kvietimą'}
								</button>
								{#if inviteShareVisible && inviteShareLink}
									<button type="button" class="secondary" on:click={copyInviteLink}>
										Kopijuoti nuorodą
									</button>
								{/if}
							</div>
						</form>
					</article>

					<article class="users__card">
						<h2>Laukiantys kvietimai</h2>
						{#if !invites.length}
							<p>Nėra aktyvių kvietimų.</p>
						{:else}
							<ul class="invite-list">
								{#each invites as invite}
									<li>
										<div>
											<strong>{invite.email}</strong>
											<span class={`status status--${invite.status}`}>{inviteStatus(invite)}</span>
											<p>Galioja iki {formatDate(invite.expiresAt)}</p>
										</div>
										{#if isPending(invite)}
											<button
												type="button"
												class="secondary"
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
	.users {
		display: grid;
		gap: 1.5rem;
		padding: 1rem;
	}

	.users__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.users__state,
	.users__error {
		padding: 1rem;
		border-radius: 0.75rem;
	}

	.users__error {
		background: rgba(220, 38, 38, 0.1);
		color: #7f1d1d;
	}

	.users__state {
		background: var(--color-panel);
	}

	.users__grid {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
		gap: 1rem;
		align-items: start;
	}

	.users__stack {
		display: grid;
		gap: 1rem;
	}

	.users__banner {
		padding: 0.9rem 1rem;
		border-radius: 0.8rem;
		background: rgba(59, 130, 246, 0.1);
		border: 1px solid rgba(59, 130, 246, 0.3);
		color: #1d4ed8;
		font-size: 0.95rem;
	}

	.users__card {
		background: var(--color-panel, #fff);
		border: 1px solid var(--color-border, #e5e7eb);
		border-radius: 0.85rem;
		padding: 1.25rem;
		box-shadow: 0 6px 20px rgba(15, 23, 42, 0.04);
		display: grid;
		gap: 0.75rem;
	}

	.users__card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.users__card-subtitle {
		margin: 0.2rem 0 0;
		color: #64748b;
		font-size: 0.9rem;
	}

	.invite-form {
		display: grid;
		gap: 0.75rem;
	}

	.invite-form input,
	.invite-form select {
		padding: 0.75rem 0.9rem;
		border-radius: 0.75rem;
		border: 1px solid var(--color-border, #d0d5dd);
	}

	.invite-form__actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	button.primary,
	button.secondary {
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

	button.secondary {
		background: var(--color-panel-hover, #f4f6fb);
	}

	.users-table {
		width: 100%;
		border-collapse: collapse;
	}

	.users-table th,
	.users-table td {
		padding: 0.65rem;
		text-align: left;
		border-bottom: 1px solid rgba(148, 163, 184, 0.3);
	}

	.users-table select {
		width: 100%;
		padding: 0.4rem;
		border-radius: 0.5rem;
	}

	.invite-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.75rem;
	}

	.invite-list li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.25);
	}

	.invite-list li:last-child {
		border-bottom: none;
	}

	.status {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border-radius: 999px;
		padding: 0.15rem 0.6rem;
		font-size: 0.85rem;
	}

	.status--pending {
		background: #fef3c7;
		color: #92400e;
	}

	.status--accepted {
		background: #dcfce7;
		color: #166534;
	}

	.status--revoked {
		background: #fee2e2;
		color: #991b1b;
	}

	.status--expired {
		background: #e0e7ff;
		color: #3730a3;
	}

	.muted {
		color: #64748b;
		font-size: 0.9rem;
	}

	@media (max-width: 960px) {
		.users__grid {
			grid-template-columns: 1fr;
		}
	}
</style>
