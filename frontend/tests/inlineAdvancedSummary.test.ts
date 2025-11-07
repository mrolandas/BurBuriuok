import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	advancedFieldKeys,
	buildAdvancedSummary,
	hasAdvancedErrors,
	type InlineFieldErrors
} from '$lib/admin/inlineAdvancedSummary';
import type { InlineConceptForm } from '$lib/admin/conceptInlineEdit';

const baseForm: InlineConceptForm = {
	termLt: 'Terminas LT',
	termEn: 'Terminas EN',
	descriptionLt: 'Aprašymas LT',
	descriptionEn: 'Aprašymas EN',
	sourceRef: 'Šaltinis-1',
	sectionCode: 'SEC-1',
	sectionTitle: 'I skyrius',
	subsectionCode: 'SUB-1',
	subsectionTitle: 'II poskyris',
	curriculumNodeCode: 'NODE-7',
	curriculumItemOrdinal: '3',
	curriculumItemLabel: 'Tema 3',
	status: 'draft',
	isRequired: true
};

const emptyForm: InlineConceptForm = {
	termLt: '',
	termEn: '',
	descriptionLt: '',
	descriptionEn: '',
	sourceRef: '',
	sectionCode: '',
	sectionTitle: '',
	subsectionCode: '',
	subsectionTitle: '',
	curriculumNodeCode: '',
	curriculumItemOrdinal: '',
	curriculumItemLabel: '',
	status: 'draft',
	isRequired: false
};

test('buildAdvancedSummary lists every structural field in order when present', () => {
	const summary = buildAdvancedSummary(baseForm);
	assert.equal(
		summary,
		'Skyrius SEC-1 (I skyrius) • Poskyris SUB-1 (II poskyris) • Eilė Nr. 3 • Mazgas NODE-7 • Šaltinis Šaltinis-1'
	);
});

test('buildAdvancedSummary omits duplicated node codes when they match the section', () => {
	const summary = buildAdvancedSummary({ ...baseForm, curriculumNodeCode: 'SEC-1' });
	assert.equal(
		summary,
		'Skyrius SEC-1 (I skyrius) • Poskyris SUB-1 (II poskyris) • Eilė Nr. 3 • Šaltinis Šaltinis-1'
	);
});

test('buildAdvancedSummary ignores default source reference placeholder', () => {
	const summary = buildAdvancedSummary({ ...baseForm, sourceRef: 'LBS_concepts_master.md' });
	assert.equal(
		summary,
		'Skyrius SEC-1 (I skyrius) • Poskyris SUB-1 (II poskyris) • Eilė Nr. 3 • Mazgas NODE-7'
	);
});

test('buildAdvancedSummary falls back to default label when no structural values exist', () => {
	assert.equal(buildAdvancedSummary(emptyForm), 'Struktūros nustatymai');
});

test('hasAdvancedErrors flags structural issues only when advanced fields report errors', () => {
	const emptyErrors: InlineFieldErrors = {};
	assert.equal(hasAdvancedErrors(emptyErrors), false);

	const basicError: InlineFieldErrors = { termLt: ['required'] };
	assert.equal(hasAdvancedErrors(basicError), false);

	const structuralError: InlineFieldErrors = { sectionCode: ['required'] };
	assert.equal(hasAdvancedErrors(structuralError), true);

	const multipleErrors: InlineFieldErrors = {
		sectionCode: [],
		curriculumNodeCode: ['invalid'],
		descriptionLt: ['too short']
	};
	assert.equal(hasAdvancedErrors(multipleErrors), true);
});

test('advancedFieldKeys covers the intended structural inputs', () => {
	assert.deepEqual(advancedFieldKeys, [
		'sectionCode',
		'sectionTitle',
		'subsectionCode',
		'subsectionTitle',
		'curriculumNodeCode',
		'curriculumItemOrdinal',
		'curriculumItemLabel',
		'sourceRef'
	]);
});
