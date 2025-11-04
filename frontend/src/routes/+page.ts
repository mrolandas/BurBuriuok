import type { PageLoad } from './$types';
import { getSupabaseClient } from '$lib/supabase/client';

export type SectionCard = {
	code: string;
	title: string;
	summary: string | null;
	ordinal: number;
};

export type PageData = {
	sections: SectionCard[];
	loadError?: string;
};

export const ssr = false;

export const load = (async () => {
	const supabase = getSupabaseClient();

	const { data, error } = await supabase
		.from('burburiuok_curriculum_nodes')
		.select('code,title,summary,ordinal')
		.eq('level', 1)
		.order('ordinal', { ascending: true });

	if (error) {
		console.error('Nepavyko įkelti skilčių lentos duomenų iš Supabase', error);
		const fallback: PageData = {
			sections: [],
			loadError: 'Nepavyko įkelti skilčių. Pabandykite dar kartą.'
		};
		return fallback;
	}

	const payload: PageData = {
		sections: data ?? []
	};

	return payload;
}) satisfies PageLoad;
