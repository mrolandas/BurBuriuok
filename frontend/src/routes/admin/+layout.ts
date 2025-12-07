import { resolveAdminSession } from '$lib/admin/session';
import { emitAdminSessionEvent } from '$lib/telemetry/admin';
import type { LayoutLoad } from './$types';

export const ssr = false;
export type GuardState = Awaited<ReturnType<typeof resolveAdminSession>>;

export const load = (async ({ url, fetch, parent }) => {
	void fetch;
	void parent;

	const guard = await resolveAdminSession(url);

	emitAdminSessionEvent({
		status: guard.allowed ? 'granted' : 'denied',
		reason: guard.reason,
		appRole: guard.appRole,
		email: guard.email
	});

	return {
		guard
	};
}) satisfies LayoutLoad;

export type AdminLayoutData = Awaited<ReturnType<typeof load>>;
