import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import {
	deleteConceptProgress,
	fetchConceptProgress,
	upsertConceptProgress,
	type ConceptProgressRecord,
	type ProgressStatus
} from '$lib/api/progress';
import { getSupabaseClient } from '$lib/supabase/client';

export type ProgressStoreStatus = 'idle' | 'loading' | 'ready' | 'error';

const recordsStore = writable<Map<string, ConceptProgressRecord>>(new Map());
const statusStore = writable<ProgressStoreStatus>('idle');
const errorStore = writable<string | null>(null);
const pendingStore = writable<Set<string>>(new Set());

let recordsSnapshot = new Map<string, ConceptProgressRecord>();
let bootstrapPromise: Promise<void> | null = null;
let authListenerRegistered = false;

function cloneRecord(record: ConceptProgressRecord): ConceptProgressRecord {
	return { ...record };
}

function setRecords(list: ConceptProgressRecord[]): void {
	const next = new Map<string, ConceptProgressRecord>();
	for (const record of list) {
		next.set(record.conceptId, cloneRecord(record));
	}
	recordsSnapshot = next;
	recordsStore.set(next);
}

function upsertRecord(record: ConceptProgressRecord): void {
	const next = new Map(recordsSnapshot);
	next.set(record.conceptId, cloneRecord(record));
	recordsSnapshot = next;
	recordsStore.set(next);
}

function deleteRecord(conceptId: string): void {
	const next = new Map(recordsSnapshot);
	next.delete(conceptId);
	recordsSnapshot = next;
	recordsStore.set(next);
}

function setPending(conceptId: string, pending: boolean): void {
	pendingStore.update((current) => {
		const next = new Set(current);
		if (pending) {
			next.add(conceptId);
		} else {
			next.delete(conceptId);
		}
		return next;
	});
}

async function loadProgress(): Promise<void> {
	if (!browser) {
		return;
	}

	const supabase = getSupabaseClient();
	const { data } = await supabase.auth.getSession();
	if (!data.session) {
		setRecords([]);
		statusStore.set('idle');
		return;
	}

	statusStore.set('loading');

	try {
		const records = await fetchConceptProgress();
		setRecords(records);
		errorStore.set(null);
		statusStore.set('ready');
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'Nepavyko įkelti pažangos duomenų.';
		errorStore.set(message);
		statusStore.set('error');
		throw error;
	}
}

function ensureAuthListener(): void {
	if (authListenerRegistered || !browser) {
		return;
	}

	try {
		const supabase = getSupabaseClient();
		supabase.auth.onAuthStateChange((event) => {
			if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
				void refreshProgressTracking();
			}
		});
		authListenerRegistered = true;
	} catch (error) {
		console.warn('[progressStore] Failed to attach auth listener', error);
	}
}

export async function initializeProgressTracking(): Promise<void> {
	ensureAuthListener();

	if (!bootstrapPromise) {
		bootstrapPromise = loadProgress().catch((error) => {
			bootstrapPromise = null;
			return Promise.reject(error);
		});
	}

	return bootstrapPromise;
}

export async function refreshProgressTracking(): Promise<void> {
	ensureAuthListener();

	const pending = loadProgress().catch((error) => {
		bootstrapPromise = null;
		return Promise.reject(error);
	});

	bootstrapPromise = pending;
	return pending;
}

export async function setConceptProgressStatus(
	conceptId: string,
	status: ProgressStatus | null
): Promise<void> {
	if (!conceptId) {
		return;
	}

	const supabase = getSupabaseClient();
	const { data } = await supabase.auth.getSession();
	if (!data.session) {
		throw new Error('Būtina prisijungti norint žymėti pažangą.');
	}

	ensureAuthListener();

	const previous = recordsSnapshot.get(conceptId);
	const previousClone = previous ? cloneRecord(previous) : null;

	setPending(conceptId, true);

	try {
		if (status) {
			const optimistic: ConceptProgressRecord = {
				conceptId,
				status,
				lastReviewedAt: previousClone?.lastReviewedAt ?? new Date().toISOString(),
				deviceKey: previousClone?.deviceKey ?? null,
				userId: previousClone?.userId ?? null
			};
			upsertRecord(optimistic);

			const saved = await upsertConceptProgress(conceptId, status);
			upsertRecord(saved);
		} else {
			deleteRecord(conceptId);
			await deleteConceptProgress(conceptId);
		}
	} catch (error) {
		if (previousClone) {
			upsertRecord(previousClone);
		} else {
			deleteRecord(conceptId);
		}
		throw error;
	} finally {
		setPending(conceptId, false);
	}
}

export const learnerProgress = {
	subscribe: recordsStore.subscribe
};

export const learnerProgressStatus = {
	subscribe: statusStore.subscribe
};

export const learnerProgressError = {
	subscribe: errorStore.subscribe
};

export const learnerProgressPending = {
	subscribe: pendingStore.subscribe
};

export function getProgressSnapshot(conceptId: string): ConceptProgressRecord | undefined {
	return recordsSnapshot.get(conceptId);
}

export type { ConceptProgressRecord, ProgressStatus };
