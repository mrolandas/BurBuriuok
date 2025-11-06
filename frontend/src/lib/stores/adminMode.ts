import { writable } from 'svelte/store';

const STORAGE_KEY = 'burburiuok-admin-mode';

function createAdminModeStore() {
	let initialized = false;
	let currentValue = false;
	const { subscribe, set: baseSet } = writable(false, () => {
		return () => {
			/* noop */
		};
	});

	const setValue = (value: boolean) => {
		currentValue = value;
		baseSet(value);
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
		}
	};

	return {
		subscribe,
		initialize: () => {
			if (initialized || typeof window === 'undefined') {
				return;
			}
			initialized = true;
			const stored = window.localStorage.getItem(STORAGE_KEY);
			setValue(stored === '1' || stored === 'true');
		},
		set: (value: boolean) => {
			setValue(value);
		},
		enable: () => {
			setValue(true);
		},
		disable: () => {
			setValue(false);
		},
		toggle: () => {
			setValue(!currentValue);
		},
		get value() {
			return currentValue;
		}
	};
}

export const adminMode = createAdminModeStore();

export function ensureAdminImpersonation(url: URL, enabled: boolean): boolean {
	const current = url.searchParams.get('impersonate');

	if (enabled) {
		if (current === 'admin') {
			return false;
		}
		url.searchParams.set('impersonate', 'admin');
		return true;
	}

	if (!current) {
		return false;
	}

	url.searchParams.delete('impersonate');
	return true;
}
