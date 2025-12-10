(() => {
	const existingConfig = window.__MOXLAI_CONFIG__ ?? {};

	const sanitizeSupabaseField = (fieldName) => {
		const rawValue = existingConfig[fieldName];
		if (typeof rawValue === 'string') {
			const trimmed = rawValue.trim();
			if (trimmed.length === 0) {
				delete existingConfig[fieldName];
				return false;
			}
			existingConfig[fieldName] = trimmed;
			return true;
		}

		if (rawValue === undefined || rawValue === null) {
			return false;
		}

		console.warn(
			`[runtime-config] Unexpected ${fieldName} value (${typeof rawValue}). Falling back to build-time env.`
		);
		delete existingConfig[fieldName];
		return false;
	};

	const hasSupabaseUrl = sanitizeSupabaseField('supabaseUrl');
	const hasSupabaseAnonKey = sanitizeSupabaseField('supabaseAnonKey');

	if (!hasSupabaseUrl || !hasSupabaseAnonKey) {
		// console.warn(
		// 	'[runtime-config] Supabase credentials missing in env.js. Build-time values (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) will be used instead.'
		// );
	}

	try {
		const host = window.location.hostname.toLowerCase();
		if (host.endsWith('github.io')) {
			existingConfig.adminApiBase =
				existingConfig.adminApiBase ?? 'https://moxlai.onrender.com/api/v1/admin';
			existingConfig.publicApiBase =
				existingConfig.publicApiBase ?? 'https://moxlai.onrender.com/api/v1';
		}
	} catch {
		// Ignore hostname parsing issues so local development keeps working
	}

	window.__MOXLAI_CONFIG__ = existingConfig;
})();
