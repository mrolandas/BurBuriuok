import { writable } from 'svelte/store';
import {
	loadConceptDetailData,
	type ConceptDetailLoadDeps,
	type ConceptPageData
} from '$lib/page-data/conceptDetail';

export type ConceptDetailStoreValue = ConceptPageData | null;

export type ConceptDetailStoreLoadOptions = {
	slug: string;
	url?: URL;
	deps?: Partial<ConceptDetailLoadDeps>;
};

export function createConceptDetailStore(initial: ConceptDetailStoreValue = null) {
	const { subscribe, set, update } = writable<ConceptDetailStoreValue>(initial);

	const load = async ({ slug, url, deps }: ConceptDetailStoreLoadOptions) => {
		const targetUrl = ensureUrl(url);
		const data = await loadConceptDetailData({ slug, url: targetUrl, deps });
		set(data);
		return data;
	};

	return {
		subscribe,
		set,
		update,
		load,
		reset: () => set(initial)
	};
}

function ensureUrl(url: URL | undefined): URL {
	if (url) {
		return url;
	}

	if (typeof window !== 'undefined' && window.location) {
		return new URL(window.location.href);
	}

	throw new Error('URL reikalingas koncepcijos duomenims įkelti.');
}
