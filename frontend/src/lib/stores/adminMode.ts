import { writable } from 'svelte/store';

const STORAGE_KEY = 'burkursas-admin-mode';

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

