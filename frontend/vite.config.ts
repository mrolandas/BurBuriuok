import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => {
	const frontendEnv = loadEnv(mode, process.cwd(), '');
	const repoRoot = resolve(process.cwd(), '..');
	const rootEnv = loadEnv(mode, repoRoot, '');

	// Allow `npm run frontend:dev` from the repo root to reuse the existing Supabase
	// credentials in /.env so local previews keep working without duplicating config.
	const effectiveEnv = { ...frontendEnv };

	if (!effectiveEnv.VITE_SUPABASE_URL && rootEnv.SUPABASE_URL) {
		effectiveEnv.VITE_SUPABASE_URL = rootEnv.SUPABASE_URL;
	}

	if (!effectiveEnv.VITE_SUPABASE_ANON_KEY && rootEnv.SUPABASE_ANON_KEY) {
		effectiveEnv.VITE_SUPABASE_ANON_KEY = rootEnv.SUPABASE_ANON_KEY;
	}

	Object.assign(process.env, effectiveEnv);

	const repoBase = process.env.VITE_APP_BASE_PATH ?? '/BurBuriuok';
	const base = mode === 'development' ? '' : repoBase;

	return {
		plugins: [sveltekit()],
		base,
		server: {
			fs: {
				allow: [process.cwd(), repoRoot]
			},
			proxy: {
				'/api/v1': {
					target: 'http://localhost:4000',
					changeOrigin: true,
					secure: false
				}
			}
		}
	};
});
