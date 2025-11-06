type AdminSessionStatus = 'granted' | 'denied';

type AdminSessionEvent = {
	status: AdminSessionStatus;
	reason: string;
	email: string | null;
	appRole: string | null;
	timestamp?: string;
};

export function logAdminSessionEvent(event: AdminSessionEvent): void {
	const detail = {
		...event,
		timestamp: event.timestamp ?? new Date().toISOString(),
		source: 'backend'
	};

	// eslint-disable-next-line no-console
	console.info('[telemetry] admin_session_checked', detail);
}
