(() => {
	const existingConfig = window.__BURKURSAS_CONFIG__ ?? {};

	try {
		const host = window.location.hostname.toLowerCase();
		if (host.endsWith('github.io')) {
			existingConfig.adminApiBase =
				existingConfig.adminApiBase ?? 'https://burburiuok.onrender.com/api/v1/admin';
			existingConfig.publicApiBase =
				existingConfig.publicApiBase ?? 'https://burburiuok.onrender.com/api/v1';
		}
	} catch {
		// Ignore hostname parsing issues so local development keeps working
	}

	window.__BURKURSAS_CONFIG__ = existingConfig;
})();
