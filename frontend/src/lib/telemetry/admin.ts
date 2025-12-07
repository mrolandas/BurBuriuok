import { browser } from '$app/environment';

export type AdminSessionStatus = 'granted' | 'denied';

export type AdminSessionTelemetry = {
	status: AdminSessionStatus;
	reason: string;
	appRole: string | null;
	email: string | null;
	timestamp?: string;
};

const EVENT_NAME = 'admin_session_checked';

export function emitAdminSessionEvent(event: AdminSessionTelemetry): void {
	if (!browser) {
		return;
	}

	const detail = {
		...event,
		timestamp: event.timestamp ?? new Date().toISOString()
	};

	window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));

	if (import.meta.env.DEV) {
		console.info(`[telemetry] ${EVENT_NAME}`, detail);
	}
}
