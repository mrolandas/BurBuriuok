<script lang="ts">
	import SectionSelect from '$lib/admin/SectionSelect.svelte';
	import type { AdminConceptResource } from '$lib/api/admin/concepts';
	import type {
		ConceptEditorMode,
		ConceptFormState,
		FieldErrors,
		HistoryAction,
		SectionSelectOption
	} from '../types';

	export let editorOpen = false;
	export let editorMode: ConceptEditorMode = 'create';
	export let activeConcept: AdminConceptResource | null = null;
	export let formState: ConceptFormState;
	export let formErrors: FieldErrors = {};
	export let saveError: string | null = null;
	export let saveErrorHint: string | null = null;
	export let draftDisabled = false;
	export let publishDisabled = false;
	export let discardDisabled = false;
	export let saving = false;
	export let showAdvancedFields = false;
	export let discardPromptVisible = false;
	export let sectionLabelId = '';
	export let sectionOptions: SectionSelectOption[] = [];
	export let sectionOptionsLoading = false;
	export let sectionOptionsError: string | null = null;
	export let selectedSectionOptionKey = '';
	export let selectedSectionFallbackLabel: string | null = null;
	export let historyActions: HistoryAction[] = [];
	export let historyLoading = false;
	export let historyError: string | null = null;
	export let rollbackError: string | null = null;
	export let rollingBackVersionId: string | null = null;
	export let formatTimestamp: (value: string | null | undefined) => string = () => '–';
	export let getFirstError: (field: string) => string | null = () => null;
	export let requestCloseEditor: () => void = () => {};
	export let handleBackdropKeydown: (event: KeyboardEvent) => void = () => {};
	export let handleSectionChange: (option: SectionSelectOption) => void = () => {};
	export let handleTermLtInput: (event: Event) => void = () => {};
	export let markDirty: (event: Event) => void = () => {};
	export let restoreInitialState: () => void = () => {};
	export let submitDraft: () => void = () => {};
	export let submitPublish: () => void = () => {};
	export let cancelDiscardPrompt: () => void = () => {};
	export let confirmDiscardChanges: () => void = () => {};
	export let handleRollback: (version: HistoryAction) => void = () => {};
	export let toggleAdvancedFields: () => void = () => {};
</script>

{#if editorOpen}
	<div
		class="drawer-backdrop"
		role="button"
		tabindex="0"
		aria-label="Uždaryti sąvokų redagavimo formą"
		on:click={requestCloseEditor}
		on:keydown={handleBackdropKeydown}
	></div>
{/if}

<aside class:drawer--open={editorOpen} class="drawer" aria-hidden={!editorOpen}>
	<form class="drawer__form" on:submit|preventDefault={submitDraft}>
		<header class="drawer__header">
			<div>
				<h2>{editorMode === 'edit' ? 'Redaguoti sąvoką' : 'Nauja sąvoka'}</h2>
				{#if activeConcept}
					<p class="muted">Redaguojama: <code>{activeConcept.slug}</code></p>
				{/if}
			</div>
			<button type="button" on:click={requestCloseEditor} class="text">Uždaryti</button>
		</header>

		<div class="drawer__content">
			{#if saveError}
				<div class="alert alert--error" role="alert">
					<strong>{saveError}</strong>
					{#if saveErrorHint}
						<p class="alert__hint">{saveErrorHint}</p>
					{/if}
				</div>
			{/if}

			<div class="form-grid form-grid--basic">
				<label>
					<span>Sąvoka (LT) *</span>
					<input
						bind:value={formState.termLt}
						name="termLt"
						required
						on:input={handleTermLtInput}
					/>
					{#if getFirstError('termLt')}
						<p class="field-error">{getFirstError('termLt')}</p>
					{/if}
				</label>

				<label>
					<span>Sąvoka (EN)</span>
					<input bind:value={formState.termEn} name="termEn" on:input={markDirty} />
					{#if getFirstError('termEn')}
						<p class="field-error">{getFirstError('termEn')}</p>
					{/if}
				</label>

				<label class="form-grid__full">
					<span>Aprašymas (LT) *</span>
					<textarea
						bind:value={formState.descriptionLt}
						name="descriptionLt"
						rows="4"
						required
						on:input={markDirty}
					></textarea>
					{#if getFirstError('descriptionLt')}
						<p class="field-error">{getFirstError('descriptionLt')}</p>
					{/if}
				</label>

				<label class="form-grid__full">
					<span>Aprašymas (EN)</span>
					<textarea
						bind:value={formState.descriptionEn}
						name="descriptionEn"
						rows="3"
						on:input={markDirty}
					></textarea>
					{#if getFirstError('descriptionEn')}
						<p class="field-error">{getFirstError('descriptionEn')}</p>
					{/if}
				</label>

				<label class="form-grid__full">
					<span id={sectionLabelId}>Skyrius *</span>
					<SectionSelect
						labelledBy={sectionLabelId}
						options={sectionOptions}
						valueKey={selectedSectionOptionKey}
						valueLabel={selectedSectionFallbackLabel}
						disabled={!sectionOptions.length || sectionOptionsLoading}
						on:change={(event) => handleSectionChange(event.detail)}
					/>
					{#if sectionOptionsLoading}
						<p class="muted">Įkeliami skyriai...</p>
					{:else if sectionOptionsError}
						<p class="field-error">{sectionOptionsError}</p>
					{/if}
					{#if getFirstError('sectionCode')}
						<p class="field-error">{getFirstError('sectionCode')}</p>
					{/if}
					{#if getFirstError('sectionTitle')}
						<p class="field-error">{getFirstError('sectionTitle')}</p>
					{/if}
					{#if getFirstError('subsectionCode')}
						<p class="field-error">{getFirstError('subsectionCode')}</p>
					{/if}
					{#if getFirstError('curriculumNodeCode')}
						<p class="field-error">{getFirstError('curriculumNodeCode')}</p>
					{/if}
					{#if getFirstError('curriculumItemOrdinal')}
						<p class="field-error">{getFirstError('curriculumItemOrdinal')}</p>
					{/if}
				</label>
			</div>

			<div class="advanced-toggle">
				<button
					type="button"
					on:click={toggleAdvancedFields}
					aria-expanded={showAdvancedFields}
					aria-controls="concept-advanced-fields"
				>
					{showAdvancedFields ? 'Slėpti papildomus laukus' : 'Rodyti papildomus laukus'}
				</button>
			</div>

			{#if showAdvancedFields}
				<div class="form-grid form-grid--advanced" id="concept-advanced-fields">
					<label>
						<span>Slug *</span>
						<input bind:value={formState.slug} name="slug" required readonly />
						{#if getFirstError('slug')}
							<p class="field-error">{getFirstError('slug')}</p>
						{/if}
						<p class="field-hint">Slug generuojamas automatiškai ir nėra redaguojamas.</p>
					</label>

					<label>
						<span>Šaltinio nuoroda</span>
						<input bind:value={formState.sourceRef} name="sourceRef" on:input={markDirty} />
						{#if getFirstError('sourceRef')}
							<p class="field-error">{getFirstError('sourceRef')}</p>
						{/if}
					</label>

					<label class="checkbox">
						<input type="checkbox" bind:checked={formState.isRequired} on:change={markDirty} />
						<span>Privaloma sąvoka</span>
					</label>
				</div>
			{/if}

			<section class="history-panel" aria-live="polite">
				<header class="history-panel__header">
					<h3>Versijų istorija</h3>
					<p class="muted">Atkūrimas apima sekciją, poskyrius ir susietą sąvoką.</p>
				</header>
				{#if rollbackError}
					<div class="alert alert--error">{rollbackError}</div>
				{/if}
				{#if historyLoading}
					<p class="muted">Įkeliama versijų istorija…</p>
				{:else if historyError}
					<p class="field-error">{historyError}</p>
				{:else if !historyActions.length}
					<p class="muted">Dar nėra užfiksuotų versijų.</p>
				{:else}
					<ul class="history-list">
						{#each historyActions as version (version.id)}
							<li class="history-item">
								<div class="history-item__summary">
									<span class="history-item__version">Versija {version.version ?? '–'}</span>
									<span class="history-item__status">{version.statusLabel}</span>
								</div>
								<div class="history-item__details">
									<span>{formatTimestamp(version.createdAt)}</span>
									{#if version.createdBy}
										<span>{version.createdBy}</span>
									{/if}
								</div>
								<div class="history-item__actions">
									<button
										type="button"
										on:click={() => handleRollback(version)}
										disabled={version.isRollbackDisabled || !!rollingBackVersionId}
									>
										{rollingBackVersionId === version.id ? 'Atkuriama…' : 'Atkurti'}
									</button>
									{#if version.isRollbackDisabled}
										<span class="history-item__hint">Trūksta kopijos atkūrimui</span>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		</div>

		<footer class="drawer__footer" class:drawer__footer--confirm={discardPromptVisible}>
			{#if discardPromptVisible}
				<div class="drawer__confirm">
					<p>Yra neišsaugotų pakeitimų. Ar tikrai uždaryti be išsaugojimo?</p>
					<div class="drawer__confirm-actions">
						<button type="button" on:click={cancelDiscardPrompt}> Tęsti redagavimą </button>
						<button type="button" class="danger" on:click={confirmDiscardChanges}>
							Atmesti pakeitimus
						</button>
					</div>
				</div>
			{:else}
				<button type="button" class="text" on:click={requestCloseEditor} disabled={saving}>
					Uždaryti
				</button>
				<div class="drawer__actions">
					<div class="concept-admin-actions">
						<button
							type="submit"
							class="concept-admin-button concept-admin-button--primary"
							disabled={draftDisabled}
						>
							{saving && formState.status !== 'published' ? 'Saugoma…' : 'Į juodraštį'}
						</button>
						<button
							type="button"
							class="concept-admin-button concept-admin-button--publish"
							on:click={submitPublish}
							disabled={publishDisabled}
						>
							{saving && formState.status === 'published' ? 'Publikuojama…' : 'Publikuoti'}
						</button>
						<button
							type="button"
							class="concept-admin-button"
							on:click={restoreInitialState}
							disabled={discardDisabled}
						>
							Atmesti
						</button>
					</div>
					{#if getFirstError('status')}
						<p class="field-error drawer__status-error">{getFirstError('status')}</p>
					{:else if getFirstError('metadata.status')}
						<p class="field-error drawer__status-error">{getFirstError('metadata.status')}</p>
					{/if}
				</div>
			{/if}
		</footer>
	</form>
</aside>

<style>
	.drawer-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: rgba(15, 23, 42, 0.45);
		backdrop-filter: blur(2px);
		z-index: 40;
	}

	.drawer {
		position: fixed;
		top: 0;
		right: -100%;
		bottom: 0;
		width: min(720px, 90vw);
		background: var(--color-panel);
		box-shadow: -32px 0 42px rgba(15, 23, 42, 0.28);
		transition: right 0.28s ease;
		z-index: 50;
		display: flex;
		flex-direction: column;
	}

	.drawer--open {
		right: 0;
	}

	.drawer__form {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.drawer__header,
	.drawer__footer {
		padding: 1.2rem 1.6rem;
		border-bottom: 1px solid var(--color-border-light);
	}

	.drawer__footer {
		border-bottom: none;
		border-top: 1px solid var(--color-border-light);
	}

	.drawer__content {
		flex: 1 1 auto;
		overflow-y: auto;
		padding: 1.6rem;
		display: grid;
		gap: 1.2rem;
	}

	.form-grid {
		display: grid;
		gap: 1rem;
	}

	.form-grid--basic {
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
	}

	.form-grid__full {
		grid-column: 1 / -1;
	}

	.form-grid label {
		display: grid;
		gap: 0.35rem;
	}

	.form-grid input,
	.form-grid textarea {
		padding: 0.45rem 0.65rem;
		border: 1px solid var(--color-border);
		border-radius: 0.55rem;
		background: var(--color-panel-soft);
		font: inherit;
	}

	.field-error {
		margin: 0;
		color: rgb(185, 28, 28);
		font-size: 0.88rem;
	}

	.field-hint {
		margin: 0;
		font-size: 0.85rem;
		color: var(--color-text-soft);
	}

	.advanced-toggle {
		display: flex;
		justify-content: flex-end;
	}

	.advanced-toggle button {
		border: none;
		background: none;
		color: var(--color-link);
		font-weight: 600;
		cursor: pointer;
	}

	.checkbox {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.history-panel {
		display: grid;
		gap: 0.8rem;
		padding: 1rem;
		border-radius: 0.75rem;
		border: 1px solid var(--color-border-light);
		background: var(--color-panel-soft);
	}

	.history-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.6rem;
	}

	.history-item {
		border-radius: 0.55rem;
		border: 1px solid var(--color-border-light);
		padding: 0.75rem;
		display: grid;
		gap: 0.45rem;
	}

	.history-item__summary {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.history-item__details {
		display: flex;
		gap: 0.75rem;
		font-size: 0.9rem;
		color: var(--color-text-soft);
	}

	.history-item__actions {
		display: flex;
		gap: 0.5rem;
	}

	.history-item__hint {
		font-size: 0.8rem;
		color: var(--color-text-soft);
	}

	.drawer__footer--confirm {
		background: rgba(15, 23, 42, 0.03);
	}

	.drawer__actions {
		display: grid;
		gap: 0.6rem;
	}

	.concept-admin-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.concept-admin-button {
		border-radius: 0.55rem;
		border: 1px solid var(--color-border);
		padding: 0.55rem 1rem;
		font-weight: 600;
		cursor: pointer;
		background: var(--color-panel-soft);
	}

	.concept-admin-button--primary {
		background: rgba(37, 99, 235, 0.12);
		border-color: rgba(37, 99, 235, 0.35);
		color: rgb(37, 99, 235);
	}

	.concept-admin-button--publish {
		background: rgba(22, 163, 74, 0.12);
		border-color: rgba(22, 163, 74, 0.35);
		color: rgb(22, 101, 52);
	}

	.drawer__status-error {
		margin: 0;
	}

	.drawer__confirm {
		display: grid;
		gap: 0.6rem;
	}

	.drawer__confirm-actions {
		display: flex;
		gap: 0.6rem;
	}
</style>
