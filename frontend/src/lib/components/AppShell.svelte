<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { Snippet } from 'svelte';
	import { onDestroy, onMount } from 'svelte';
	import { quizModal } from '$lib/stores/quizModal';

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
		if (typeof window === 'undefined') {
			return;
		}
		const stored = window.localStorage.getItem('burburiuok-theme');
		const initial: ThemeId = isKnownTheme(stored) ? stored : themeOptions[0].id;
		activeTheme = initial;
		syncThemeToDocument(initial);
		if (!isKnownTheme(stored)) {
			persistTheme(initial);
		}
	});

	const toggleMenu = () => {
		menuOpen = !menuOpen;
	};

	const closeMenu = () => {
		menuOpen = false;
		themeMenuOpen = false;
	};

	const toggleThemeMenu = () => {
		themeMenuOpen = !themeMenuOpen;
	};

	const chooseTheme = (theme: ThemeId) => {
		setTheme(theme);
		themeMenuOpen = false;
	};

	const handleLinkClick = () => {
		closeMenu();
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
			closeMenu();
		}
	};

	const unsubscribePage = page.subscribe(({ url }) => {
		const nextPath = url.pathname;
		if (nextPath !== activePath) {
			activePath = nextPath;
			closeMenu();
		}
		searchTerm = url.searchParams.get('q') ?? '';
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
		closeMenu();
		quizModal.open();
	};

	onDestroy(() => {
		unsubscribePage();
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

	{#if menuOpen}
		<div class="app-shell__menu-overlay" onclick={closeMenu} aria-hidden="true"></div>
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
		<p>
			{#if hasFooterNote}
				<span>{footerNote}</span>
			{/if}
			<a
				class="app-shell__footer-link"
				href="https://lbs.lt/wp-content/uploads/2025/08/LBS-mokymu-programu-2024.10.15d.-redakcija.pdf"
				target="_blank"
				rel="noreferrer noopener"
			>
				Oficiali LBS mokymų programa (PDF)
			</a>
		</p>
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
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.25rem clamp(1rem, 3vw, 2.5rem);
		background: var(--color-header);
		backdrop-filter: blur(24px);
		border-bottom: 1px solid var(--color-border);
		position: relative;
		z-index: 30;
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
		padding: 1.5rem clamp(1rem, 3vw, 2.5rem);
		border-top: 1px solid var(--color-border);
		background: var(--color-footer);
		color: var(--color-text-muted);
		font-size: 0.85rem;
	}

	.app-shell__footer p {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: baseline;
	}

	.app-shell__footer-link {
		color: var(--color-accent);
		font-weight: 600;
		text-decoration: underline;
		text-decoration-thickness: 0.12em;
		text-underline-offset: 0.18em;
	}

	.app-shell__footer-link:hover,
	.app-shell__footer-link:focus-visible {
		color: var(--color-accent-strong);
	}
</style>
