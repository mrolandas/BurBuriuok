(() => {
	const existingConfig = window.__BURBURIUOK_CONFIG__ ?? {};

	try {
		const host = window.location.hostname.toLowerCase();
		if (host.endsWith('github.io')) {
			existingConfig.adminApiBase =
				existingConfig.adminApiBase ?? 'https://burburiuok.onrender.com/api/v1/admin';
		}
	} catch {
		// Ignore hostname parsing issues so local development keeps working
	}

	window.__BURBURIUOK_CONFIG__ = existingConfig;
})();
