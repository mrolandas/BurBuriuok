import { browser } from '$app/environment';

const STORAGE_KEY = 'burkursas.device-key.v1';

function generateDeviceKey(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}

	const random = Math.random().toString(36).slice(2);
	const timestamp = Date.now().toString(36);
	return `dev_${random}${timestamp}`;
}

function isValidDeviceKey(value: string | null | undefined): value is string {
	return typeof value === 'string' && value.trim().length >= 16;
}

export function getStoredDeviceKey(): string | null {
	if (!browser) {
		return null;
	}

	try {
		const value = window.localStorage.getItem(STORAGE_KEY);
		return isValidDeviceKey(value) ? value : null;
	} catch (error) {
		console.warn('[deviceKey] Failed to read device key from storage', error);
		return null;
	}
}

export function ensureDeviceKey(): string | null {
	if (!browser) {
		return null;
	}

	const existing = getStoredDeviceKey();
	if (existing) {
		return existing;
	}

	const generated = generateDeviceKey();

	try {
		window.localStorage.setItem(STORAGE_KEY, generated);
	} catch (error) {
		console.warn('[deviceKey] Failed to persist generated device key', error);
	}

	return generated;
}
