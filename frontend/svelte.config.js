import { mdsvex } from 'mdsvex';
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const dev = process.argv.includes('dev');
const basePath = process.env.VITE_APP_BASE_PATH ?? '/BurBuriuok';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: [vitePreprocess(), mdsvex()],
	kit: {
		// Use a static site adapter to generate GitHub Pages output with SPA fallback.
		adapter: adapter({
			fallback: 'index.html'
		}),
		paths: {
			base: dev ? '' : basePath
		},
		prerender: {
			handleMissingId: 'ignore',
			entries: []
		}
	},
	extensions: ['.svelte', '.svx']
};

export default config;
