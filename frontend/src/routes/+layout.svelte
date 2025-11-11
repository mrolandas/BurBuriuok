<script lang="ts">
	import AppShell, { type NavLink } from '$lib/components/AppShell.svelte';
	import QuizModal from '$lib/components/QuizModal.svelte';
	import '$lib/styles/global.css';
	import { base } from '$app/paths';

	const navLinks: NavLink[] = [{ href: '/', label: 'Pagrindinis' }];

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={`${base}/favicon.ico`} sizes="any" />
	<link rel="shortcut icon" href={`${base}/favicon.ico`} type="image/x-icon" />
</svelte:head>

<AppShell {navLinks}>
	{@render children()}
</AppShell>

<QuizModal />
