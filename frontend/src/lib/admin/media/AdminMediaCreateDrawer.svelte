<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import { AdminApiError } from '$lib/api/admin/client';
	import {
		createAdminMediaAsset,
		deleteAdminMediaAsset,
		type AdminMediaAsset,
		type AdminMediaUploadInstruction
	} from '$lib/api/admin/media';
	import type { AdminMediaCreateInput } from '../../../../../shared/validation/adminMediaAssetSchema';
	import type { MediaConceptOption, MediaCreateSuccessDetail } from './types';

	type FieldErrors = Record<string, string>;

	type SourceKind = 'upload' | 'external';

	type UploadPhase = 'idle' | 'creating' | 'uploading';
	const MAX_FILE_SIZE = 10 * 1024 * 1024;
	const ACCEPTED_FILE_TYPES = 'image/*,video/mp4,application/pdf';

	export let conceptOptions: MediaConceptOption[] = [];
	export let defaultConceptId: string | null = null;
	export let lockedConceptId = false;

	const dispatch = createEventDispatcher<{
		close: void;
		created: MediaCreateSuccessDetail;
	}>();

	let conceptId = '';
	let sourceKind: SourceKind = 'upload';
	let title = '';
	let captionLt = '';
	let captionEn = '';
	let externalUrl = '';
	let selectedFile: File | null = null;

	let fieldErrors: FieldErrors = {};
	let formError: string | null = null;
	let uploadPhase: UploadPhase = 'idle';
	let successMessage: string | null = null;
	let fileInput: HTMLInputElement | null = null;

	const sourceKindOptions: SourceKind[] = ['upload', 'external'];

	const successTimeoutMs = 4000;
	let successTimer: ReturnType<typeof setTimeout> | null = null;

	function clearSuccessMessage(): void {
		if (successTimer) {
			clearTimeout(successTimer);
			successTimer = null;
		}
		successMessage = null;
	}

	function showSuccess(message: string): void {
		clearSuccessMessage();
		successMessage = message;
		successTimer = setTimeout(() => {
			successMessage = null;
			successTimer = null;
		}, successTimeoutMs);
	}

	$: if (defaultConceptId && (!conceptId || lockedConceptId)) {
		const match = conceptOptions.find((option) => option.id === defaultConceptId);
		if (match) {
			conceptId = match.id;
		}
	}

	$: if (sourceKind === 'external') {
		selectedFile = null;
	}

	function resetErrors(): void {
		fieldErrors = {};
		formError = null;
	}

	function resetFormAfterSuccess(): void {
		title = '';
		captionLt = '';
		captionEn = '';
		externalUrl = '';
		selectedFile = null;
		fieldErrors = {};
		formError = null;
		if (fileInput) {
			fileInput.value = '';
		}
	}

	function handleSelectFile(event: Event): void {
		const target = event.currentTarget as HTMLInputElement;
		const files = target.files;
		selectedFile = files && files.length ? files.item(0) : null;
		if (selectedFile) {
			if (fieldErrors.file) {
				const nextErrors = { ...fieldErrors };
				delete nextErrors.file;
				fieldErrors = nextErrors;
			}
		}
	}

	function closeDrawer(): void {
		if (uploadPhase !== 'idle') {
			return;
		}
		dispatch('close');
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			closeDrawer();
		}
	}

	onMount(() => {
		const keyListener = (event: KeyboardEvent) => handleKeydown(event);
		document.addEventListener('keydown', keyListener);
		return () => {
			document.removeEventListener('keydown', keyListener);
		};
	});

	onDestroy(() => {
		clearSuccessMessage();
	});

	function trimmedOrNull(value: string): string | null {
		const trimmed = value.trim();
		return trimmed.length ? trimmed : null;
	}

	function extractFileExtension(fileName: string): string {
		const trimmed = fileName.trim().toLowerCase();
		const dotIndex = trimmed.lastIndexOf('.');
		if (dotIndex === -1) {
			return '';
		}
		return trimmed.slice(dotIndex);
	}

	function detectFileAssetType(file: File | null): 'image' | 'video' | 'document' | null {
		if (!file) {
			return null;
		}

		const mime = file.type?.toLowerCase() ?? '';
		if (mime.startsWith('image/')) {
			return 'image';
		}
		if (mime === 'video/mp4') {
			return 'video';
		}
		if (mime === 'application/pdf') {
			return 'document';
		}

		const extension = extractFileExtension(file.name);
		if (!extension) {
			return null;
		}
		if (['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) {
			return 'image';
		}
		if (extension === '.mp4') {
			return 'video';
		}
		if (extension === '.pdf') {
			return 'document';
		}
		return null;
	}

	function resolveFileContentType(file: File | null): string {
		if (!file) {
			return 'application/octet-stream';
		}

		const mime = file.type?.trim();
		if (mime && mime.length) {
			const normalized = mime.toLowerCase();
			if (normalized.startsWith('image/')) {
				return mime;
			}
			if (normalized === 'video/mp4') {
				return 'video/mp4';
			}
			if (normalized === 'application/pdf') {
				return 'application/pdf';
			}
		}

		const extension = extractFileExtension(file.name);
		if (['.jpg', '.jpeg'].includes(extension)) {
			return 'image/jpeg';
		}
		if (extension === '.png') {
			return 'image/png';
		}
		if (extension === '.webp') {
			return 'image/webp';
		}
		if (extension === '.mp4') {
			return 'video/mp4';
		}
		if (extension === '.pdf') {
			return 'application/pdf';
		}
		return 'application/octet-stream';
	}

	function validateLocal(): boolean {
		const next: FieldErrors = {};

		if (!conceptId) {
			next.conceptId = 'Pasirinkite sąvoką.';
		}

		if (sourceKind === 'upload') {
			if (!selectedFile) {
				next.file = 'Pasirinkite failą įkėlimui.';
			} else {
				if (selectedFile.size <= 0) {
					next.file = 'Failas yra tuščias.';
				}
				if (!next.file && selectedFile.size > MAX_FILE_SIZE) {
					next.file = 'Failas negali būti didesnis nei 10 MB.';
				}
				if (!next.file) {
					const detectedType = detectFileAssetType(selectedFile);
					if (!detectedType) {
						next.file = 'Nepalaikomas failo formatas. Įkelkite JPG, PNG, WEBP, MP4 arba PDF.';
					}
				}
			}
		} else if (sourceKind === 'external') {
			if (!externalUrl.trim().length) {
				next.externalUrl = 'Įveskite išorinį URL adresą.';
			}
		}

		const trimmedTitle = title.trim();
		if (!trimmedTitle.length) {
			next.title = 'Įveskite medijos pavadinimą.';
		}

		fieldErrors = next;
		return Object.keys(next).length === 0;
	}

	function mapApiFieldErrors(errors: Record<string, string[] | undefined> | undefined): void {
		if (!errors) {
			return;
		}

		const next: FieldErrors = {};
		const takeFirst = (key: string): string | null => {
			const messages = errors[key];
			return messages && messages.length ? messages[0] : null;
		};

		const conceptError = takeFirst('conceptId');
		if (conceptError) {
			next.conceptId = conceptError;
		}

		const titleError = takeFirst('title');
		if (titleError) {
			next.title = titleError;
		}

		const captionLtError = takeFirst('captionLt');
		if (captionLtError) {
			next.captionLt = captionLtError;
		}

		const captionEnError = takeFirst('captionEn');
		if (captionEnError) {
			next.captionEn = captionEnError;
		}

		const urlError = takeFirst('source.url');
		if (urlError) {
			next.externalUrl = urlError;
		}

		const fileNameError = takeFirst('source.fileName');
		const fileSizeError = takeFirst('source.fileSize');
		const contentTypeError = takeFirst('source.contentType');
		const sourceKindError = takeFirst('source.kind');

		const fileError = fileNameError ?? fileSizeError ?? contentTypeError;
		if (fileError) {
			next.file = fileError;
		}

		if (sourceKindError) {
			next.sourceKind = sourceKindError;
		}

		fieldErrors = next;
	}

	function buildPayload(): AdminMediaCreateInput {
		const payload: AdminMediaCreateInput = {
			conceptId,
			title: (() => {
				const trimmed = title.trim();
				title = trimmed;
				return trimmed;
			})(),
			captionLt: trimmedOrNull(captionLt),
			captionEn: trimmedOrNull(captionEn),
			source:
				sourceKind === 'upload'
					? {
							kind: 'upload',
							fileName: selectedFile?.name ?? '',
							fileSize: selectedFile?.size ?? 0,
							contentType: resolveFileContentType(selectedFile)
						}
					: {
							kind: 'external',
							url: externalUrl.trim()
						}
		};

		return payload;
	}

	async function uploadFile(instructions: AdminMediaUploadInstruction, file: File): Promise<void> {
		const response = await fetch(instructions.url, {
			method: 'PUT',
			headers: {
				'Content-Type': instructions.contentType,
				'X-Upsert-Token': instructions.token
			},
			body: file
		});

		if (!response.ok) {
			const message = `Nepavyko įkelti failo (klaidos kodas ${response.status}).`;
			throw new Error(message);
		}
	}

	async function handleSubmit(): Promise<void> {
		if (uploadPhase !== 'idle') {
			return;
		}

		resetErrors();

		if (!validateLocal()) {
			formError = 'Ištaisykite žemiau pažymėtas klaidas.';
			return;
		}

		const payload = buildPayload();
		let createdAsset: AdminMediaAsset | null = null;
		let uploadInstructions: AdminMediaUploadInstruction | null = null;

		try {
			uploadPhase = 'creating';
			const result = await createAdminMediaAsset(payload);
			createdAsset = result.asset;
			uploadInstructions = result.upload ?? null;

			if (uploadInstructions && selectedFile) {
				uploadPhase = 'uploading';
				await uploadFile(uploadInstructions, selectedFile);
			}

			dispatch('created', { asset: result.asset });
			showSuccess('Medijos įrašas sukurtas.');
			resetFormAfterSuccess();
		} catch (error) {
			if (error instanceof AdminApiError) {
				mapApiFieldErrors(
					(error.body as { error?: { fieldErrors?: Record<string, string[] | undefined> } })?.error
						?.fieldErrors
				);
				formError = error.message;
			} else if (error instanceof Error) {
				formError = error.message;
			} else {
				formError = 'Įvyko nenumatyta klaida.';
			}

			if (createdAsset && uploadPhase === 'uploading') {
				try {
					await deleteAdminMediaAsset(createdAsset.id);
				} catch (cleanupError) {
					console.warn('Nepavyko pašalinti nepilno medijos įrašo.', cleanupError);
				}
			}
		} finally {
			uploadPhase = 'idle';
		}
	}

	function handleFormSubmit(event: SubmitEvent): void {
		event.preventDefault();
		void handleSubmit();
	}

	function buttonDisabled(): boolean {
		return uploadPhase !== 'idle';
	}

	function findConceptLabel(id: string): string {
		const match = conceptOptions.find((option) => option.id === id);
		if (match) {
			return match.label;
		}
		if (defaultConceptId === id) {
			return 'Pasirinkta sąvoka';
		}
		return id;
	}

	$: lockedConceptLabel = lockedConceptId && conceptId ? findConceptLabel(conceptId) : null;
</script>

<button
	type="button"
	class="media-create-backdrop"
	onclick={closeDrawer}
	aria-label="Uždaryti medijos kūrimo langą"
></button>
<div
	class="media-create-drawer"
	role="dialog"
	aria-modal="true"
	aria-labelledby="media-create-title"
>
	<header class="media-create-drawer__header">
		<div>
			<h2 id="media-create-title">Pridėti naują medijos įrašą</h2>
			<p class="muted">
				Sukurkite medijos įrašą susietą su pasirinkta sąvoka. Įkėlimo duomenys galioja ribotą laiką,
				todėl failą įkelkite iš karto.
			</p>
		</div>
		<button type="button" class="plain" onclick={closeDrawer}>Uždaryti</button>
	</header>

	<div class="media-create-drawer__content">
		{#if successMessage}
			<div class="alert alert--success" role="status">{successMessage}</div>
		{/if}

		{#if formError}
			<div class="alert alert--error" role="alert">{formError}</div>
		{/if}

		<form class="media-create-form" onsubmit={handleFormSubmit} novalidate>
			<section class="media-create-section">
				<h3>Susietas konceptas</h3>
				{#if lockedConceptLabel}
					<p class="muted">Medija bus susieta su: <strong>{lockedConceptLabel}</strong></p>
					{#if fieldErrors.conceptId}
						<p class="field-error">{fieldErrors.conceptId}</p>
					{/if}
				{:else}
					<label>
						<span>Sąvoka *</span>
						<select bind:value={conceptId} required>
							<option value="">Pasirinkite sąvoką</option>
							{#each conceptOptions as option (option.id)}
								<option value={option.id}>{option.label}</option>
							{/each}
						</select>
					</label>
					{#if fieldErrors.conceptId}
						<p class="field-error">{fieldErrors.conceptId}</p>
					{/if}
				{/if}
			</section>

			<section class="media-create-section">
				<h3>Medijos šaltinis</h3>
				<p class="muted">Medijos tipas nustatomas automatiškai pagal pasirinkto failo turinį.</p>
				<fieldset class="media-create-fieldset">
					<legend>Šaltinis *</legend>
					<div class="media-create-options">
						{#each sourceKindOptions as option (option)}
							<label>
								<input
									type="radio"
									name="source-kind"
									value={option}
									bind:group={sourceKind}
									disabled={buttonDisabled()}
								/>
								<span>{option === 'upload' ? 'Įkelti failą' : 'Išorinis šaltinis'}</span>
							</label>
						{/each}
					</div>
				</fieldset>
				{#if fieldErrors.sourceKind}
					<p class="field-error">{fieldErrors.sourceKind}</p>
				{/if}
			</section>

			<section class="media-create-section">
				<h3>Turinio duomenys</h3>
				{#if sourceKind === 'upload'}
					<label>
						<span>Failas *</span>
						<input
							type="file"
							accept={ACCEPTED_FILE_TYPES}
							required
							onchange={handleSelectFile}
							bind:this={fileInput}
						/>
					</label>
					{#if fieldErrors.file}
						<p class="field-error">{fieldErrors.file}</p>
					{/if}
					<p class="field-hint">
						Leidžiami paveikslėliai (JPEG, PNG, WEBP), MP4 vaizdo įrašai ir PDF dokumentai iki 10
						MB.
					</p>
				{:else}
					<label>
						<span>Išorinis URL *</span>
						<input type="url" bind:value={externalUrl} required placeholder="https://example.com" />
					</label>
					{#if fieldErrors.externalUrl}
						<p class="field-error">{fieldErrors.externalUrl}</p>
					{/if}
					<p class="field-hint">
						Leidžiami tik HTTPS adresai iš patvirtintų teikėjų (YouTube, Vimeo).
					</p>
				{/if}
			</section>

			<section class="media-create-section">
				<h3>Meta duomenys</h3>
				<div class="media-create-meta-grid">
					<label>
						<span>Pavadinimas *</span>
						<input bind:value={title} maxlength="160" required />
					</label>
					<label>
						<span class="label-heading">
							Aprašymas (LT)
							<em class="label-optional">Neprivaloma</em>
						</span>
						<textarea bind:value={captionLt} rows="2" maxlength="300"></textarea>
					</label>
					<label>
						<span class="label-heading">
							Aprašymas (EN)
							<em class="label-optional">Neprivaloma</em>
						</span>
						<textarea bind:value={captionEn} rows="2" maxlength="300"></textarea>
					</label>
				</div>
				{#if fieldErrors.title}
					<p class="field-error">{fieldErrors.title}</p>
				{/if}
				{#if fieldErrors.captionLt}
					<p class="field-error">{fieldErrors.captionLt}</p>
				{/if}
				{#if fieldErrors.captionEn}
					<p class="field-error">{fieldErrors.captionEn}</p>
				{/if}
			</section>

			<footer class="media-create-footer">
				<button type="button" class="secondary" onclick={closeDrawer} disabled={buttonDisabled()}>
					Atšaukti
				</button>
				<button type="submit" class="primary" disabled={buttonDisabled()}>
					{#if uploadPhase === 'creating'}
						Kuriama…
					{:else if uploadPhase === 'uploading'}
						Įkeliama…
					{:else}
						Pridėti mediją
					{/if}
				</button>
			</footer>
		</form>
	</div>
</div>

<style>
	.media-create-backdrop {
		border: none;
		padding: 0;
		margin: 0;
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: rgba(15, 23, 42, 0.35);
		z-index: 95;
		cursor: pointer;
	}

	.media-create-drawer {
		position: fixed;
		top: 0;
		right: 0;
		width: min(34rem, 92vw);
		height: 100vh;
		background: var(--color-panel);
		color: var(--color-text);
		box-shadow: -18px 0 40px rgba(15, 23, 42, 0.28);
		z-index: 100;
		display: grid;
		grid-template-rows: auto 1fr;
	}

	.media-create-drawer__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.9rem;
		padding: 1.1rem 1.4rem 0.85rem;
		border-bottom: 1px solid var(--color-border);
	}

	.media-create-drawer__header h2 {
		margin: 0;
		font-size: 1.25rem;
	}

	.media-create-drawer__header p {
		margin: 0.4rem 0 0;
		color: var(--color-text-soft);
		max-width: 22rem;
		line-height: 1.5;
	}

	.media-create-drawer__content {
		overflow-y: auto;
		padding: 1rem 1.4rem 1.4rem;
		display: grid;
		gap: 0.9rem;
	}

	.media-create-form {
		display: grid;
		gap: 1rem;
	}

	.media-create-section {
		display: grid;
		gap: 0.6rem;
	}

	.media-create-section h3 {
		margin: 0;
		font-size: 1rem;
	}

	.media-create-fieldset {
		border: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}

	.media-create-fieldset legend {
		font-weight: 600;
		font-size: 0.9rem;
	}

	.media-create-options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.media-create-options label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.media-create-options input[type='radio'] {
		accent-color: var(--color-pill-border);
	}

	.media-create-section label {
		display: grid;
		gap: 0.3rem;
	}

	.media-create-meta-grid {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	}

	.label-heading {
		display: inline-flex;
		gap: 0.35rem;
		align-items: baseline;
	}

	.label-optional {
		font-style: normal;
		font-weight: 500;
		font-size: 0.78rem;
		color: var(--color-text-soft);
	}

	.media-create-section select,
	.media-create-section input,
	.media-create-section textarea {
		border-radius: 0.65rem;
		border: 1px solid var(--color-border);
		background: var(--color-panel-soft);
		padding: 0.55rem 0.75rem;
		color: inherit;
	}

	.media-create-section textarea {
		min-height: 4.1rem;
	}

	.media-create-section input[type='file'] {
		padding: 0.35rem;
	}

	.media-create-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.65rem;
		padding-top: 0.4rem;
	}

	.primary,
	.secondary,
	.plain {
		border-radius: 0.7rem;
		padding: 0.55rem 1rem;
		font-weight: 600;
		cursor: pointer;
	}

	.primary {
		background: var(--color-pill-bg);
		border: 1px solid var(--color-pill-border);
		color: var(--color-pill-text);
	}

	.primary:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}

	.secondary {
		background: transparent;
		border: 1px solid var(--color-border);
		color: var(--color-text);
	}

	.secondary:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}

	.plain {
		background: none;
		border: none;
		color: var(--color-link);
		padding: 0;
	}

	.plain:hover,
	.plain:focus-visible {
		text-decoration: underline;
	}

	.alert {
		padding: 0.8rem 1rem;
		border-radius: 0.8rem;
		font-size: 0.9rem;
	}

	.alert--success {
		background: rgba(16, 185, 129, 0.12);
		border: 1px solid rgba(16, 185, 129, 0.4);
		color: rgb(5, 122, 85);
	}

	.alert--error {
		background: rgba(239, 68, 68, 0.12);
		border: 1px solid rgba(239, 68, 68, 0.4);
		color: rgb(185, 28, 28);
	}

	.field-error {
		color: rgb(185, 28, 28);
		font-size: 0.85rem;
		margin: 0;
	}

	.field-hint {
		color: var(--color-text-soft);
		font-size: 0.85rem;
		margin: 0;
	}

	.muted {
		color: var(--color-text-soft);
		margin: 0;
	}

	@media (max-width: 640px) {
		.media-create-drawer {
			width: 100vw;
		}
	}
</style>
