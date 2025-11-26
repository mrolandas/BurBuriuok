import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import type { PreferredLanguage } from '../../../../shared/validation/profileSchema';
import {
	ensureProfile,
	fetchProfile,
	saveProfile,
	type ProfilePayload,
	type UserProfile
} from '$lib/api/profile';

export type ProfileStatus = 'idle' | 'loading' | 'ready' | 'error';

const profile = writable<UserProfile | null>(null);
const status = writable<ProfileStatus>('idle');
const error = writable<string | null>(null);
let bootstrapPromise: Promise<UserProfile | null> | null = null;

export const userProfile = {
	subscribe: profile.subscribe
};

export const userProfileStatus = {
	subscribe: status.subscribe
};

export const userProfileError = {
	subscribe: error.subscribe
};

export function resetUserProfile(): void {
	profile.set(null);
	status.set('idle');
	error.set(null);
	bootstrapPromise = null;
}

export async function loadUserProfile(): Promise<UserProfile | null> {
	status.set('loading');
	error.set(null);

	try {
		const result = await fetchProfile();
		profile.set(result);
		status.set('ready');
		return result;
	} catch (loadError) {
		console.error('[profileStore] Failed to load profile', loadError);
		status.set('error');
		error.set(loadError instanceof Error ? loadError.message : 'Nepavyko įkelti profilio.');
		throw loadError;
	}
}

export async function saveUserProfile(payload: ProfilePayload): Promise<UserProfile> {
	status.set('loading');
	error.set(null);

	try {
		const updated = await saveProfile(payload);
		profile.set(updated);
		status.set('ready');
		return updated;
	} catch (saveError) {
		console.error('[profileStore] Failed to save profile', saveError);
		status.set('error');
		error.set(saveError instanceof Error ? saveError.message : 'Nepavyko išsaugoti profilio.');
		throw saveError;
	}
}

export async function bootstrapUserProfile(): Promise<UserProfile | null> {
	if (bootstrapPromise) {
		return bootstrapPromise;
	}

	bootstrapPromise = (async () => {
		try {
			const result = await ensureProfile(detectPreferredLanguage());
			profile.set(result);
			status.set('ready');
			return result;
		} catch (bootstrapError) {
			console.warn('[profileStore] Failed to bootstrap profile', bootstrapError);
			return null;
		}
	})();

	return bootstrapPromise;
}

function detectPreferredLanguage(): PreferredLanguage | undefined {
	if (!browser) {
		return undefined;
	}

	const language = window.navigator.language?.toLowerCase() ?? '';
	if (language.startsWith('lt')) {
		return 'lt';
	}

	if (language.startsWith('en')) {
		return 'en';
	}

	return undefined;
}
