import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
	const repoBase = process.env.VITE_APP_BASE_PATH ?? '/BurBuriuok';
	const base = mode === 'development' ? '' : repoBase;

	return {
		plugins: [sveltekit()],
		base
	};
});
