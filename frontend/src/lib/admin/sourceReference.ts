export const SOURCE_REFERENCE_IGNORE = 'LBS_concepts_master.md';

export function normalizeSourceRef(value: string | null | undefined): string | null {
	if (!value) {
		return null;
	}

	const trimmed = value.trim();

	if (!trimmed.length) {
		return null;
	}

	if (trimmed === SOURCE_REFERENCE_IGNORE) {
		return null;
	}

	return trimmed;
}

export function isMeaningfulSourceRef(value: string | null | undefined): value is string {
	return normalizeSourceRef(value) !== null;
}
