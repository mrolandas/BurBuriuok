<script lang="ts">
	import AppShell, { type NavLink } from '$lib/components/AppShell.svelte';
	import favicon from '$lib/assets/favicon.svg';
	import '$lib/styles/global.css';

	const navLinks: NavLink[] = [{ href: '/', label: 'Section Board' }];

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<AppShell {navLinks}>
	{@render children()}
</AppShell>
