<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import type { Snippet } from 'svelte';
	import { onDestroy } from 'svelte';
	import { menuActionsStore, type MenuAction } from '$lib/stores/menuActions';

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
		footerNote = 'BurBuriuok – mokymosi padėjėjas pasiruošti Lietuvos Buriavimo Asociacijos vidaus vandenų burinės jachtos vado egzaminui.'
	}: Props = $props();

	let menuOpen = $state(false);
	let activePath = $state($page.url.pathname);
	let menuActions = $state<MenuAction[]>([]);
	const visibleNavLinks = $derived(
		navLinks.length <= 1
			? navLinks
			: navLinks.filter((item) => !(item.href === '/' && activePath === '/'))
	);
	const hasMenuToggle = $derived(visibleNavLinks.length > 0 || menuActions.length > 0);
	const hasFooterNote = $derived(Boolean(footerNote?.trim()));

	const toggleMenu = () => {
		menuOpen = !menuOpen;
	};

	const closeMenu = () => {
		menuOpen = false;
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
	});

	const unsubscribeMenuActions = menuActionsStore.subscribe((items) => {
		menuActions = items;
	});

	const handleActionSelect = (action: MenuAction) => {
		closeMenu();

		if (action.disabled) {
			return;
		}

		try {
			action.onSelect();
		} catch (error) {
			console.error('Nepavyko įvykdyti meniu veiksmo', error);
		}
	};

	onDestroy(() => {
		unsubscribePage();
		unsubscribeMenuActions();
	});
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="app-shell">
	<header class="app-shell__header">
		<div class="app-shell__brand">
			<a class="app-shell__brand-link" href={resolve('/')} aria-label="BurBuriuok pradžia">
				<span class="app-shell__brand-mark">BurBuriuok</span>
				<span class="app-shell__brand-subtitle">Mokymosi palydovas</span>
			</a>
		</div>
		{#if hasMenuToggle}
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
		{/if}
		{#if menuOpen && hasMenuToggle}
			<div class="app-shell__menu-overlay" onclick={closeMenu} aria-hidden="true"></div>
		{/if}
		{#if hasMenuToggle}
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

					{#if visibleNavLinks.length && menuActions.length}
						<li class="app-shell__menu-divider" aria-hidden="true"></li>
					{/if}

					{#each menuActions as action (action.id)}
						<li>
							<button
								class="app-shell__menu-action"
								type="button"
								onclick={() => handleActionSelect(action)}
								disabled={action.disabled}
							>
								{action.label}
							</button>
						</li>
					{/each}
				</ul>
			</nav>
		{/if}
	</header>

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

	.app-shell__header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.25rem clamp(1rem, 3vw, 2.5rem);
		background: rgba(15, 23, 42, 0.55);
		backdrop-filter: blur(24px);
		border-bottom: 1px solid var(--color-border);
		position: relative;
	}

	@media (prefers-color-scheme: light) {
		.app-shell__header {
			background: rgba(255, 255, 255, 0.9);
			backdrop-filter: blur(18px);
		}
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
		background: transparent;
		z-index: 10;
	}

	.app-shell__menu {
		position: absolute;
		top: calc(100% + 0.75rem);
		right: clamp(1rem, 3vw, 2.5rem);
		min-width: 220px;
		padding: 0.75rem;
		border-radius: 1rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		box-shadow: 0 20px 45px -20px rgba(15, 23, 42, 0.45);
		z-index: 20;
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
		background: rgba(56, 189, 248, 0.14);
	}

	.app-shell__menu-link.active {
		background: rgba(56, 189, 248, 0.22);
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
		border: 1px solid rgba(59, 130, 246, 0.25);
		background: rgba(59, 130, 246, 0.14);
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
		background: rgba(59, 130, 246, 0.22);
		border-color: rgba(59, 130, 246, 0.45);
	}

	.app-shell__menu-action:disabled {
		opacity: 0.6;
		cursor: not-allowed;
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
		background: rgba(15, 23, 42, 0.5);
		color: var(--color-text-muted);
		font-size: 0.85rem;
	}

	@media (prefers-color-scheme: light) {
		.app-shell__footer {
			background: rgba(248, 250, 252, 0.92);
		}
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
