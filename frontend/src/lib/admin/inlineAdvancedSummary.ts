import type { InlineConceptForm } from '$lib/admin/conceptInlineEdit';

export type InlineFieldErrors = Record<string, string[]>;

export const advancedFieldKeys: Array<keyof InlineConceptForm> = [
	'sectionCode',
	'sectionTitle',
	'subsectionCode',
	'subsectionTitle',
	'curriculumNodeCode',
	'curriculumItemOrdinal',
	'curriculumItemLabel',
	'sourceRef'
];

export function buildAdvancedSummary(form: InlineConceptForm): string {
	const parts: string[] = [];

	if (form.sectionCode) {
		const sectionTitle = form.sectionTitle ? ` (${form.sectionTitle})` : '';
		parts.push(`Skyrius ${form.sectionCode}${sectionTitle}`);
	}

	if (form.subsectionCode) {
		const subsectionTitle = form.subsectionTitle ? ` (${form.subsectionTitle})` : '';
		parts.push(`Poskyris ${form.subsectionCode}${subsectionTitle}`);
	}

	if (form.curriculumItemOrdinal) {
		parts.push(`Eilė Nr. ${form.curriculumItemOrdinal}`);
	}

	if (form.curriculumNodeCode && form.curriculumNodeCode !== form.sectionCode) {
		parts.push(`Mazgas ${form.curriculumNodeCode}`);
	}

	if (form.sourceRef) {
		parts.push(`Šaltinis ${form.sourceRef}`);
	}

	if (!parts.length) {
		return 'Struktūros nustatymai';
	}

	return parts.join(' • ');
}

export function hasAdvancedErrors(errors: InlineFieldErrors): boolean {
	return advancedFieldKeys.some((key) => {
		const list = errors[key];
		return Array.isArray(list) && list.length > 0;
	});
}