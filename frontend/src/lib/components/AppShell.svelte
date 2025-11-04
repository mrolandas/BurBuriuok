<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import type { Snippet } from 'svelte';

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
		footerNote = 'Supabase valdomas mokymo turinys'
	}: Props = $props();

	const isActive = (href: NavHref) => {
		const path = $page.url.pathname;
		if (href === '/') {
			return path === '/';
		}
		return path.startsWith(href);
	};
</script>

<div class="app-shell">
	<header class="app-shell__header">
		<div class="app-shell__brand">
			<a class="app-shell__brand-link" href={resolve('/')} aria-label="BurBuriuok pradžia">
				<span class="app-shell__brand-mark">BurBuriuok</span>
				<span class="app-shell__brand-subtitle">Mokymosi palydovas</span>
			</a>
		</div>
		{#if navLinks.length}
			<nav class="app-shell__nav" aria-label="Primary navigation">
				{#each navLinks as item (item.href)}
					<a
						class="app-shell__nav-link"
						class:active={isActive(item.href)}
						href={resolve(item.href)}
						aria-current={isActive(item.href) ? 'page' : undefined}
					>
						{item.label}
					</a>
				{/each}
			</nav>
		{/if}
	</header>

	<main class="app-shell__main" id="main-content">
		{@render children()}
	</main>

	<footer class="app-shell__footer">
		<p>{footerNote}</p>
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

	.app-shell__nav {
		display: inline-flex;
		gap: 0.5rem;
		padding: 0.25rem;
		border-radius: 999px;
		background: var(--color-surface-alt);
	}

	.app-shell__nav-link {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.9rem;
		border-radius: 999px;
		color: var(--color-text-muted);
		text-decoration: none;
		font-weight: 500;
		transition:
			background-color 0.2s ease,
			color 0.2s ease;
	}

	.app-shell__nav-link:hover,
	.app-shell__nav-link:focus-visible {
		background: rgba(56, 189, 248, 0.12);
		color: var(--color-text);
	}

	.app-shell__nav-link.active {
		background: linear-gradient(120deg, var(--color-accent), var(--color-accent-strong));
		color: white;
		box-shadow: 0 10px 30px rgba(8, 145, 178, 0.35);
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
	}
</style>
