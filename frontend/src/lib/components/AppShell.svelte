<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { Snippet } from 'svelte';
	import { onDestroy, onMount } from 'svelte';
	import { quizModal } from '$lib/stores/quizModal';
	import { adminMode, ensureAdminImpersonation } from '$lib/stores/adminMode';

	type NavHref = '/' | `/sections/${string}`;

	export type NavLink = {
		href: NavHref;
		label: string;
	};

	type Props = {
		navLinks?: NavLink[];
		children: Snippet;
		footerNote?: string;
	};

	let {
		navLinks = [],
		children,
		footerNote = 'Įtvirtink ir patikrink buriavimo teorijos žinias '
	}: Props = $props();

	let menuOpen = $state(false);
	let activePath = $state($page.url.pathname);
	let searchTerm = $state($page.url.searchParams.get('q') ?? '');
	let searchInput: HTMLInputElement | null = null;
	let adminModeEnabled = $state(adminMode.value);
	let impersonatingAdmin = $state($page.url.searchParams.get('impersonate') === 'admin');
	let adminModeUnsubscribe: (() => void) | null = null;
	let allowAdminSync = false;
	let userMenuOpen = $state(false);
	const visibleNavLinks = $derived(
		navLinks.length <= 1
			? navLinks
			: navLinks.filter((item) => !(item.href === '/' && activePath === '/'))
	);
	const hasFooterNote = $derived(Boolean(footerNote?.trim()));

	const themeOptions = [
		{
			id: 'dawn',
			label: 'Rytmečio dangus',
			description: 'Šviesi schema su sodria mėlyna',
			preview: ['#e0f2fe', '#2563eb', '#1d4ed8']
		},
		{
			id: 'marine',
			label: 'Jūrinė naktis',
			description: 'Subtili tamsi su melsvais akcentais',
			preview: ['#0f172a', '#38bdf8', '#0ea5e9']
		},
		{
			id: 'sand',
			label: 'Smėlio krantai',
			description: 'Šilta pastelė su gintaro akcentais',
			preview: ['#fff7ed', '#f97316', '#ea580c']
		}
	] as const;

	type ThemeOption = (typeof themeOptions)[number];
	type ThemeId = ThemeOption['id'];

	let activeTheme = $state<ThemeId>(themeOptions[0].id);
	let themeMenuOpen = $state(false);
	const activeThemeLabel = $derived(
		themeOptions.find((theme) => theme.id === activeTheme)?.label ?? ''
	);

	const isKnownTheme = (value: string | null): value is ThemeId =>
		Boolean(value && themeOptions.some((option) => option.id === value));

	const syncThemeToDocument = (theme: ThemeId) => {
		if (typeof document === 'undefined') {
			return;
		}
		document.documentElement.dataset.theme = theme;
	};

	const persistTheme = (theme: ThemeId) => {
		if (typeof window === 'undefined') {
			return;
		}
		window.localStorage.setItem('burburiuok-theme', theme);
	};

	const setTheme = (theme: ThemeId) => {
		if (activeTheme === theme) {
			return;
		}
		activeTheme = theme;
		syncThemeToDocument(theme);
		persistTheme(theme);
	};

	onMount(() => {
		adminMode.initialize();
		adminModeUnsubscribe = adminMode.subscribe((value) => {
			adminModeEnabled = value;
			if (allowAdminSync) {
				void syncAdminModeToUrl(value);
			}
		});

		if (typeof window === 'undefined') {
			return;
		}

		const currentUrl = new URL(window.location.href);
		const impersonating = currentUrl.searchParams.get('impersonate') === 'admin';
		impersonatingAdmin = impersonating;
		if (adminMode.value && !impersonating) {
			void syncAdminModeToUrl(true);
		} else if (!adminMode.value && impersonating) {
			adminMode.enable();
		}
		const stored = window.localStorage.getItem('burburiuok-theme');
		const initial: ThemeId = isKnownTheme(stored) ? stored : themeOptions[0].id;
		activeTheme = initial;
		syncThemeToDocument(initial);
		if (!isKnownTheme(stored)) {
			persistTheme(initial);
		}

		allowAdminSync = true;
		void syncAdminModeToUrl(adminModeEnabled);
	});

	const toggleMenu = () => {
		const next = !menuOpen;
		menuOpen = next;
		if (next) {
			themeMenuOpen = false;
			userMenuOpen = false;
		} else {
			themeMenuOpen = false;
		}
	};

	const toggleUserMenu = () => {
		const next = !userMenuOpen;
		userMenuOpen = next;
		if (next) {
			menuOpen = false;
			themeMenuOpen = false;
		}
	};

	const closeMenus = () => {
		menuOpen = false;
		themeMenuOpen = false;
		userMenuOpen = false;
	};

	const toggleThemeMenu = () => {
		const next = !themeMenuOpen;
		themeMenuOpen = next;
		if (next) {
			userMenuOpen = false;
		}
	};

	const chooseTheme = (theme: ThemeId) => {
		setTheme(theme);
		themeMenuOpen = false;
	};

	const handleLinkClick = () => {
		closeMenus();
	};

	const isActive = (href: NavHref) => {
		const path = $page.url.pathname;
		if (href === '/') {
			return path === '/';
		}
		return path.startsWith(href);
	};

	const handleKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Escape') {
			closeMenus();
		}
	};

	const syncAdminModeToUrl = async (enabled: boolean) => {
		if (typeof window === 'undefined') {
			return;
		}

		const url = new URL(window.location.href);
		if (!ensureAdminImpersonation(url, enabled)) {
			return;
		}

		await goto(`${url.pathname}${url.search}${url.hash}`, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	};

	const unsubscribePage = page.subscribe(({ url }) => {
		const nextPath = url.pathname;
		if (nextPath !== activePath) {
			activePath = nextPath;
			closeMenus();
		}
		searchTerm = url.searchParams.get('q') ?? '';
		impersonatingAdmin = url.searchParams.get('impersonate') === 'admin';
		if (allowAdminSync) {
			void syncAdminModeToUrl(adminModeEnabled);
		}
	});

	const clearSearch = () => {
		if (!searchTerm) {
			return;
		}
		searchTerm = '';
		searchInput?.focus();
		void goto(resolve('/'), { replaceState: true });
	};

	const handleSearchButtonClick = (event: MouseEvent) => {
		if (!searchTerm.trim()) {
			return;
		}

		event.preventDefault();
		clearSearch();
	};

	const openQuizModal = () => {
		closeMenus();
		quizModal.open();
	};

	const handleAdminModeToggle = () => {
		adminMode.toggle();
		closeMenus();
	};

	onDestroy(() => {
		unsubscribePage();
		adminModeUnsubscribe?.();
		adminModeUnsubscribe = null;
	});
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="app-shell">
	<header class="app-shell__header">
		<div class="app-shell__brand">
			<a class="app-shell__brand-link" href={resolve('/')} aria-label="BurBuriuok pradžia">
				<span class="app-shell__brand-mark">BurBuriuok</span>
				<span class="app-shell__brand-subtitle">Mokymosi padėjėjas</span>
			</a>
		</div>
		<div class="app-shell__controls">
			<div class="app-shell__user" data-admin-active={adminModeEnabled ? 'true' : 'false'}>
				<button
					type="button"
					class="app-shell__user-toggle"
					class:app-shell__user-toggle--active={adminModeEnabled}
					aria-haspopup="true"
					aria-expanded={userMenuOpen}
					aria-controls="app-shell-user-menu"
					onclick={toggleUserMenu}
					title={adminModeEnabled ? 'Administratorius aktyvus' : 'Naudotojo parinktys'}
				>
					<span class="app-shell__user-icon" aria-hidden="true">
						<svg viewBox="0 0 24 24" role="presentation" focusable="false">
							{#if adminModeEnabled}
								<path
									d="M8 9.5a4 4 0 1 1 8 0v.5H8z"
									class="app-shell__user-icon-hat"
								></path>
							{/if}
							<circle cx="12" cy="10" r="3" class="app-shell__user-icon-head"></circle>
							<path
								d="M6.5 19.25c.54-3.18 2.95-4.75 5.5-4.75s4.96 1.57 5.5 4.75"
								class="app-shell__user-icon-body"
							></path>
						</svg>
					</span>
					<span class="app-shell__sr-only">
						{adminModeEnabled ? 'Administratorius aktyvus' : 'Naudotojo parinktys'}
					</span>
				</button>

				{#if userMenuOpen}
					<div
						id="app-shell-user-menu"
						class="app-shell__user-menu"
						role="menu"
						aria-label="Naudotojo parinktys"
					>
						<a
							href="/login"
							class="app-shell__user-item"
							role="menuitem"
							onclick={closeMenus}
						>
							Prisijungti
						</a>
						<a
							href="/register"
							class="app-shell__user-item"
							role="menuitem"
							onclick={closeMenus}
						>
							Registruotis
						</a>
						<button
							type="button"
							class="app-shell__user-item app-shell__user-item--admin"
							role="menuitem"
							onclick={handleAdminModeToggle}
						>
							{adminModeEnabled ? 'Deaktyvuoti Admin' : 'Aktyvuoti Admin'}
						</button>
					</div>
				{/if}
			</div>

			<button
				type="button"
				class="app-shell__menu-toggle"
				aria-haspopup="true"
				aria-expanded={menuOpen}
				aria-controls="app-shell-menu"
				onclick={toggleMenu}
			>
				<span class="app-shell__menu-icon" aria-hidden="true">
					<span></span>
					<span></span>
					<span></span>
				</span>
				<span class="app-shell__menu-label">Meniu</span>
			</button>
		</div>
		<nav
			id="app-shell-menu"
			class="app-shell__menu"
			aria-label="Global navigation"
			hidden={!menuOpen}
		>
			<ul class="app-shell__menu-list">
				{#each visibleNavLinks as item (item.href)}
					<li>
						<a
							class="app-shell__menu-link"
							class:active={isActive(item.href)}
							href={resolve(item.href)}
							aria-current={isActive(item.href) ? 'page' : undefined}
							onclick={handleLinkClick}
						>
							{item.label}
						</a>
					</li>
				{/each}

				{#if visibleNavLinks.length}
					<li class="app-shell__menu-divider" aria-hidden="true"></li>
				{/if}

				<li>
					<button class="app-shell__menu-action" type="button" onclick={openQuizModal}>
						Pasitikrinti žinias
					</button>
				</li>

				<li class="app-shell__menu-divider" aria-hidden="true"></li>

				<li class="app-shell__menu-theme">
					<button
						id="app-shell-theme-toggle"
						class="app-shell__menu-action app-shell__menu-theme-toggle"
						type="button"
						onclick={toggleThemeMenu}
						aria-expanded={themeMenuOpen}
						aria-controls="app-shell-theme-options"
					>
						<span class="app-shell__menu-theme-text">
							<span>Spalvų derinys</span>
							{#if activeThemeLabel}
								<small>{activeThemeLabel}</small>
							{/if}
						</span>
						<span class="app-shell__menu-theme-icon" aria-hidden="true"></span>
					</button>
					{#if themeMenuOpen}
						<div
							id="app-shell-theme-options"
							class="app-shell__theme-choices"
							role="group"
							aria-label="Pasirinkite spalvų derinį"
						>
							{#each themeOptions as theme (theme.id)}
								<button
									type="button"
									class="app-shell__theme-choice"
									class:active={activeTheme === theme.id}
									onclick={() => chooseTheme(theme.id)}
								>
									<span
										class="app-shell__theme-swatch"
										style={`--preview-primary: ${theme.preview[0]}; --preview-accent: ${theme.preview[1]}; --preview-secondary: ${
											theme.preview[2] ?? theme.preview[1]
										};`}
										aria-hidden="true"
									></span>
									<div class="app-shell__theme-copy">
										<span class="app-shell__theme-label">{theme.label}</span>
										<small>{theme.description}</small>
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</li>
			</ul>
		</nav>
		</header>

		{#if menuOpen || userMenuOpen}
			<div class="app-shell__menu-overlay" onclick={closeMenus} aria-hidden="true"></div>
		{/if}

		<div class="app-shell__search" role="search">
			<form class="app-shell__search-form" action={resolve('/search')} method="get">
			<label class="app-shell__search-label" for="global-search">Paieška</label>
			<div class="app-shell__search-field">
				<input
					id="global-search"
					type="search"
					name="q"
					placeholder="Ieškokite sąvokose ir aprašymuose..."
					autocomplete="off"
					spellcheck="false"
					bind:this={searchInput}
					bind:value={searchTerm}
					aria-label="Paieška temose"
				/>
				<button
					class="app-shell__search-action"
					type={searchTerm ? 'button' : 'submit'}
					onclick={handleSearchButtonClick}
					aria-label={searchTerm ? 'Išvalyti paiešką' : 'Ieškoti'}
				>
					<span aria-hidden="true">{searchTerm ? '✕' : '🔍'}</span>
				</button>
			</div>
		</form>
	</div>

	<main class="app-shell__main" id="main-content">
		{@render children()}
	</main>

	<footer class="app-shell__footer">
		{#if hasFooterNote}
			<p class="app-shell__footer-note">{footerNote}</p>
		{/if}
	</footer>
</div>

<style>
	.app-shell {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.app-shell__search {
		padding: 0 clamp(1rem, 3vw, 2.5rem);
		border-bottom: 1px solid var(--color-border);
		background: var(--color-search);
		backdrop-filter: blur(24px);
	}

	.app-shell__search-form {
		max-width: var(--layout-max-width);
		margin: 0 auto;
		padding: clamp(1rem, 3vw, 1.5rem) 0;
	}

	.app-shell__search-label {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.app-shell__search-field {
		position: relative;
		display: flex;
		align-items: center;
	}

	.app-shell__search-field input {
		flex: 1;
		border-radius: 999px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		padding: 0.65rem 3.5rem 0.65rem 1rem;
		font-size: 1rem;
		transition:
			background-color 0.2s ease,
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.app-shell__search-field input:focus-visible {
		outline: none;
		border-color: rgba(56, 189, 248, 0.6);
		box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.2);
	}

	.app-shell__search-field input::-webkit-search-decoration,
	.app-shell__search-field input::-webkit-search-cancel-button,
	.app-shell__search-field input::-webkit-search-results-button,
	.app-shell__search-field input::-webkit-search-results-decoration {
		display: none;
	}

	.app-shell__search-field input::-ms-clear {
		display: none;
		width: 0;
		height: 0;
	}

	.app-shell__search-action {
		position: absolute;
		top: 50%;
		right: 0.5rem;
		transform: translateY(-50%);
		border: none;
		background: transparent;
		color: var(--color-text-muted);
		width: 2.25rem;
		height: 2.25rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		border-radius: 50%;
		transition:
			background-color 0.2s ease,
			color 0.2s ease;
	}

	.app-shell__search-action:hover,
	.app-shell__search-action:focus-visible {
		background: rgba(56, 189, 248, 0.16);
		color: var(--color-text);
	}

	.app-shell__search-action span {
		font-size: 1rem;
	}

	@media (max-width: 640px) {
		.app-shell__search-field input {
			padding-right: 3rem;
		}

		.app-shell__search-action {
			right: 0.6rem;
		}
	}

	.app-shell__header {
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		gap: clamp(0.5rem, 2vw, 1rem);
		padding: 1.25rem clamp(1rem, 3vw, 2.5rem);
		background: var(--color-header);
		backdrop-filter: blur(24px);
		border-bottom: 1px solid var(--color-border);
		position: relative;
		z-index: 30;
	}

	.app-shell__brand {
		flex: 1 1 auto;
		min-width: 0;
	}

	.app-shell__brand-link {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		text-decoration: none;
	}

	.app-shell__brand-mark {
		font-size: clamp(1.2rem, 2.6vw, 1.6rem);
		font-weight: 600;
		letter-spacing: 0.05em;
	}

	.app-shell__brand-subtitle {
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	.app-shell__controls {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-left: auto;
	}

	.app-shell__user {
		position: relative;
	}

	.app-shell__user-toggle {
		border: 1px solid var(--color-border);
		background: var(--color-surface-alt);
		color: var(--color-text);
		border-radius: 999px;
		width: 2.4rem;
		height: 2.4rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition:
			background-color 0.2s ease,
			border-color 0.2s ease,
			box-shadow 0.2s ease,
			color 0.2s ease;
	}

	.app-shell__user-toggle:hover,
	.app-shell__user-toggle:focus-visible {
		border-color: rgba(56, 189, 248, 0.35);
		background: rgba(56, 189, 248, 0.12);
		color: var(--color-text);
		box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.18);
	}

	.app-shell__user-toggle:focus-visible {
		outline: none;
	}

	.app-shell__user-toggle--active {
		border-color: var(--color-accent-border-strong);
		color: var(--color-accent-strong);
		box-shadow: 0 0 0 3px var(--color-accent-faint-strong);
	}

	.app-shell__user-icon svg {
		width: 1.2rem;
		height: 1.2rem;
		stroke: currentColor;
		stroke-width: 1.6;
		fill: none;
	}

	.app-shell__user-icon-head {
		fill: none;
	}

	.app-shell__user-icon-body {
		fill: none;
		stroke-linecap: round;
	}

	.app-shell__user-icon-hat {
		fill: currentColor;
		stroke: currentColor;
		opacity: 0.2;
	}

	.app-shell__sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.app-shell__user-menu {
		position: absolute;
		top: calc(100% + 0.55rem);
		right: 0;
		display: grid;
		gap: 0.35rem;
		min-width: 200px;
		padding: 0.65rem;
		border-radius: 0.9rem;
		background: var(--color-popover, var(--color-surface));
		border: 1px solid var(--color-border);
		box-shadow: 0 22px 45px -26px var(--color-overlay, rgba(15, 23, 42, 0.5));
		backdrop-filter: blur(18px);
		z-index: 95;
	}

	.app-shell__user-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		width: 100%;
		padding: 0.55rem 0.75rem;
		border-radius: 0.75rem;
		text-decoration: none;
		font: inherit;
		color: inherit;
		border: 1px solid transparent;
		background: transparent;
		cursor: pointer;
		transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
		text-align: left;
	}

	.app-shell__user-item:hover,
	.app-shell__user-item:focus-visible {
		border-color: var(--color-border);
		background: var(--color-panel-hover);
		outline: none;
	}

	.app-shell__user-item--admin {
		color: var(--color-accent-strong);
	}

	.app-shell__user-item--admin:hover,
	.app-shell__user-item--admin:focus-visible {
		border-color: transparent;
		background: var(--color-accent-faint);
	}

	.app-shell__menu-toggle {
		border: 1px solid var(--color-border);
		background: var(--color-surface-alt);
		color: var(--color-text);
		border-radius: 999px;
		padding: 0.55rem 0.85rem;
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			background-color 0.2s ease,
			border-color 0.2s ease,
			transform 0.2s ease;
	}

	.app-shell__menu-toggle:hover,
	.app-shell__menu-toggle:focus-visible {
		background: rgba(56, 189, 248, 0.12);
		border-color: rgba(56, 189, 248, 0.3);
		transform: translateY(-1px);
	}

	.app-shell__menu-toggle[aria-expanded='true'] {
		background: var(--color-surface-alt);
		border-color: var(--color-border);
		transform: none;
	}

	.app-shell__menu-toggle:focus-visible {
		outline: 2px solid rgba(56, 189, 248, 0.6);
		outline-offset: 3px;
	}

	.app-shell__menu-icon {
		position: relative;
		width: 1.25rem;
		height: 0.95rem;
		display: inline-flex;
		flex-direction: column;
		justify-content: space-between;
	}

	.app-shell__menu-icon span {
		display: block;
		height: 2px;
		width: 100%;
		border-radius: 999px;
		background: currentColor;
		transition: transform 0.2s ease;
	}

	.app-shell__menu-toggle[aria-expanded='true'] .app-shell__menu-icon span:nth-child(1) {
		transform: translateY(8px) rotate(45deg);
	}

	.app-shell__menu-toggle[aria-expanded='true'] .app-shell__menu-icon span:nth-child(2) {
		opacity: 0;
	}

	.app-shell__menu-toggle[aria-expanded='true'] .app-shell__menu-icon span:nth-child(3) {
		transform: translateY(-8px) rotate(-45deg);
	}

	.app-shell__menu-label {
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.app-shell__menu-overlay {
		position: fixed;
		inset: 0;
		background: var(--color-overlay, rgba(15, 23, 42, 0.45));
		backdrop-filter: blur(3px);
		z-index: 20;
	}

	.app-shell__menu {
		position: absolute;
		top: calc(100% + 0.75rem);
		right: clamp(1rem, 3vw, 2.5rem);
		min-width: 240px;
		max-width: min(360px, calc(100vw - 3rem));
		padding: clamp(0.75rem, 3vw, 1rem);
		border-radius: 1rem;
		background: var(--color-popover, var(--color-surface));
		border: 1px solid var(--color-border);
		box-shadow: 0 22px 55px -25px var(--color-overlay, rgba(15, 23, 42, 0.55));
		backdrop-filter: blur(26px);
		z-index: 90;
		transform: none;
	}

	@media (max-width: 720px) {
		.app-shell__menu {
			left: clamp(1rem, 6vw, 2rem);
			right: clamp(1rem, 6vw, 2rem);
			top: calc(100% + 1rem);
			min-width: auto;
			max-width: none;
			max-height: calc(100vh - clamp(7rem, 18vw, 9rem));
			overflow-y: auto;
		}
	}

	.app-shell__menu-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.app-shell__menu-divider {
		border-top: 1px solid var(--color-border);
		margin: 0.4rem 0;
		height: 0;
	}

	.app-shell__menu-link {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.6rem 0.75rem;
		border-radius: 0.75rem;
		text-decoration: none;
		color: var(--color-text);
		font-weight: 600;
		transition: background-color 0.2s ease;
	}

	.app-shell__menu-link:hover,
	.app-shell__menu-link:focus-visible {
		background: var(--color-accent-faint, rgba(56, 189, 248, 0.14));
	}

	.app-shell__menu-link.active {
		background: var(--color-accent-faint-strong, rgba(56, 189, 248, 0.22));
		color: var(--color-text);
	}

	.app-shell__menu-action {
		width: 100%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		padding: 0.55rem 0.75rem;
		border-radius: 0.75rem;
		border: 1px solid var(--color-accent-border, rgba(59, 130, 246, 0.25));
		background: var(--color-accent-faint, rgba(59, 130, 246, 0.14));
		color: var(--color-text);
		font-weight: 600;
		cursor: pointer;
		transition:
			background-color 0.2s ease,
			border-color 0.2s ease,
			color 0.2s ease;
	}

	.app-shell__menu-action:hover,
	.app-shell__menu-action:focus-visible {
		background: var(--color-accent-faint-strong, rgba(59, 130, 246, 0.22));
		border-color: var(--color-accent-border-strong, rgba(59, 130, 246, 0.45));
	}

	.app-shell__menu-action:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.app-shell__menu-theme {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-top: 0.2rem;
	}

	.app-shell__menu-theme-toggle {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		gap: 0.75rem;
	}

	.app-shell__menu-theme-text {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.15rem;
		font-weight: 600;
	}

	.app-shell__menu-theme-text small {
		font-weight: 500;
		font-size: 0.8rem;
		color: var(--color-text-muted);
	}

	.app-shell__menu-theme-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.4rem;
		height: 1.4rem;
		border-radius: 999px;
		background: var(--color-surface-alt);
		color: var(--color-text);
		transition: transform 0.2s ease;
	}

	.app-shell__menu-theme-icon::before {
		content: '';
		display: block;
		width: 0.45rem;
		height: 0.45rem;
		border-right: 2px solid currentColor;
		border-bottom: 2px solid currentColor;
		transform: rotate(45deg);
		transition: transform 0.2s ease;
	}

	.app-shell__menu-theme-toggle[aria-expanded='true'] .app-shell__menu-theme-icon::before {
		transform: rotate(-135deg);
	}

	.app-shell__theme-choices {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.app-shell__theme-choice {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		padding: 0.55rem 0.6rem;
		border: 1px solid transparent;
		border-radius: 0.8rem;
		background: transparent;
		color: var(--color-text);
		text-align: left;
		cursor: pointer;
		transition:
			background-color 0.2s ease,
			border-color 0.2s ease,
			color 0.2s ease,
			transform 0.2s ease;
	}

	.app-shell__theme-choice:hover,
	.app-shell__theme-choice:focus-visible {
		background: var(--color-accent-faint, rgba(56, 189, 248, 0.14));
		border-color: var(--color-accent-border, rgba(56, 189, 248, 0.3));
		transform: translateY(-1px);
	}

	.app-shell__theme-choice.active {
		border-color: var(--color-accent-border-strong, rgba(56, 189, 248, 0.45));
		background: var(--color-accent-faint-strong, rgba(56, 189, 248, 0.22));
	}

	.app-shell__theme-choice:focus-visible {
		outline: 2px solid var(--color-accent-border-strong, rgba(56, 189, 248, 0.45));
		outline-offset: 3px;
	}

	.app-shell__theme-swatch {
		--preview-primary: transparent;
		--preview-accent: transparent;
		--preview-secondary: transparent;
		flex-shrink: 0;
		width: 2.2rem;
		height: 2.2rem;
		border-radius: 0.6rem;
		background:
			linear-gradient(
				135deg,
				var(--preview-primary) 0%,
				var(--preview-accent) 55%,
				var(--preview-secondary) 100%
			);
		position: relative;
		box-shadow:
			inset 0 0 0 1px rgba(255, 255, 255, 0.45),
			0 6px 12px -8px var(--color-overlay, rgba(15, 23, 42, 0.35));
	}

	.app-shell__theme-swatch::after {
		content: '';
		position: absolute;
		inset: 18%;
		border-radius: 0.45rem;
		background: radial-gradient(circle at top, rgba(255, 255, 255, 0.5), transparent 60%);
		opacity: 0.75;
	}

	.app-shell__theme-copy {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.app-shell__theme-label {
		font-weight: 600;
		font-size: 0.95rem;
	}

	.app-shell__theme-copy small {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.app-shell__main {
		flex: 1;
		padding: clamp(1.5rem, 4vw, 3rem) clamp(1rem, 4vw, 3rem) 2.5rem;
		display: flex;
		flex-direction: column;
		align-items: stretch;
	}

	.app-shell__footer {
		margin-top: auto;
		padding: 1.5rem clamp(1rem, 4vw, 3rem) 2.5rem;
		background: var(--color-surface-alt);
		border-top: 1px solid var(--color-border);
	}

	.app-shell__footer-note {
		margin: 0;
		color: var(--color-text-muted);
		font-size: 0.9rem;
		line-height: 1.4;
		text-align: center;
	}

</style>
