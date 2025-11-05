<script lang="ts">
	import AppShell, { type NavLink } from '$lib/components/AppShell.svelte';
	import QuizModal from '$lib/components/QuizModal.svelte';
	import favicon from '$lib/assets/favicon.svg';
	import '$lib/styles/global.css';

	const navLinks: NavLink[] = [{ href: '/', label: 'Pagrindinis' }];

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<AppShell {navLinks}>
	{@render children()}
</AppShell>

<QuizModal />
