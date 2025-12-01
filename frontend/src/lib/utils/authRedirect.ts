import { browser } from '$app/environment';

const STORAGE_KEY = 'burkursas.auth.redirectTarget';

function canUseStorage(): boolean {
	return browser && typeof sessionStorage !== 'undefined';
}

export function persistRedirectTarget(target: string | null | undefined): void {
	if (!canUseStorage()) {
		return;
	}

	const value = normalizeTarget(target);

	try {
		sessionStorage.setItem(STORAGE_KEY, value);
	} catch (error) {
		console.warn('[authRedirect] Failed to persist redirect target', error);
	}
}

export function readRedirectTarget(): string | null {
	if (!canUseStorage()) {
		return null;
	}

	try {
		const stored = sessionStorage.getItem(STORAGE_KEY);
		if (!stored) {
			return null;
		}
		return stored.startsWith('/') ? stored : null;
	} catch (error) {
		console.warn('[authRedirect] Failed to read redirect target', error);
		return null;
	}
}

export function clearRedirectTarget(): void {
	if (!canUseStorage()) {
		return;
	}

	try {
		sessionStorage.removeItem(STORAGE_KEY);
	} catch (error) {
		console.warn('[authRedirect] Failed to clear redirect target', error);
	}
}

function normalizeTarget(target: string | null | undefined): string {
	if (!target || !target.startsWith('/') || target.startsWith('//')) {
		return '/';
	}

	return target;
}
