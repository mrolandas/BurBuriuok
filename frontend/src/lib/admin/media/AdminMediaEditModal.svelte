<script lang="ts">
	import { updateAdminMediaAsset } from '$lib/api/admin/media';

	type Props = {
		id: string;
		title?: string;
		captionLt?: string;
		captionEn?: string;
		open?: boolean;
		onclose?: () => void;
		onsave?: (detail: { id: string; title: string; captionLt: string; captionEn: string }) => void;
		ondelete?: (id: string) => void;
	};

	let {
		id,
		title = '',
		captionLt = '',
		captionEn = '',
		open = false,
		onclose,
		onsave,
		ondelete
	}: Props = $props();

	let editTitle = $state(title);
	let editCaptionLt = $state(captionLt);
	let editCaptionEn = $state(captionEn);
	let busy = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (open) {
			editTitle = title || '';
			editCaptionLt = captionLt || '';
			editCaptionEn = captionEn || '';
			error = null;
		}
	});

	async function handleSubmit(event: Event) {
		event.preventDefault();
		busy = true;
		error = null;

		try {
			await updateAdminMediaAsset(id, {
				title: editTitle,
				captionLt: editCaptionLt,
				captionEn: editCaptionEn
			});
			onsave?.({
				id,
				title: editTitle,
				captionLt: editCaptionLt,
				captionEn: editCaptionEn
			});
			onclose?.();
		} catch (err) {
			console.error(err);
			error = 'Nepavyko išsaugoti pakeitimų.';
		} finally {
			busy = false;
		}
	}

	function handleClose() {
		onclose?.();
	}

	function handleDelete() {
		ondelete?.(id);
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div class="modal-backdrop" onclick={handleClose} role="presentation">
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
			<header class="modal-header">
				<h3>Redaguoti mediją</h3>
				<button type="button" class="close-button" onclick={handleClose}>&times;</button>
			</header>

			<form onsubmit={handleSubmit} class="modal-body">
				{#if error}
					<div class="alert alert--error">{error}</div>
				{/if}

				<label>
					<span>Pavadinimas</span>
					<input
						type="text"
						bind:value={editTitle}
						maxlength="160"
						placeholder="Medijos pavadinimas"
						disabled={busy}
					/>
				</label>

				<label>
					<span>Aprašymas (LT)</span>
					<textarea
						rows="3"
						bind:value={editCaptionLt}
						maxlength="300"
						placeholder="Trumpas aprašymas lietuvių kalba"
						disabled={busy}
					></textarea>
				</label>

				<label>
					<span>Aprašymas (EN)</span>
					<textarea
						rows="3"
						bind:value={editCaptionEn}
						maxlength="300"
						placeholder="Trumpas aprašymas anglų kalba"
						disabled={busy}
					></textarea>
				</label>

				<div class="modal-actions">
					{#if ondelete}
						<button
							type="button"
							class="button button--danger"
							onclick={handleDelete}
							disabled={busy}
							style="margin-right: auto;"
						>
							Šalinti
						</button>
					{/if}
					<button type="button" class="button button--secondary" onclick={handleClose} disabled={busy}>
						Atšaukti
					</button>
					<button type="submit" class="button button--primary" disabled={busy}>
						{#if busy}
							Išsaugoma...
						{:else}
							Išsaugoti
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: rgba(15, 23, 42, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
		padding: 1rem;
	}

	.modal {
		background: var(--color-panel);
		border-radius: 0.8rem;
		width: 100%;
		max-width: 500px;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
		display: flex;
		flex-direction: column;
		max-height: 90vh;
	}

	.modal-header {
		padding: 1.2rem 1.5rem;
		border-bottom: 1px solid var(--color-border);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.modal-header h3 {
		margin: 0;
		font-size: 1.2rem;
	}

	.close-button {
		background: none;
		border: none;
		font-size: 1.8rem;
		line-height: 1;
		cursor: pointer;
		color: var(--color-text-soft);
		padding: 0;
	}

	.modal-body {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		overflow-y: auto;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	label span {
		font-size: 0.9rem;
		font-weight: 600;
	}

	input,
	textarea {
		padding: 0.6rem;
		border-radius: 0.4rem;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: var(--color-text);
		font-family: inherit;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.8rem;
		margin-top: 0.5rem;
	}

	.button {
		padding: 0.6rem 1.2rem;
		border-radius: 0.4rem;
		font-weight: 600;
		cursor: pointer;
		border: none;
	}

	.button--primary {
		background: #2563eb;
		color: #fff;
	}

	.button--secondary {
		background: #e2e8f0;
		color: #1e293b;
	}

	.button--danger {
		background: #fee2e2;
		color: #ef4444;
	}

	.button--danger:hover {
		background: #fecaca;
	}

	.alert {
		padding: 0.8rem;
		border-radius: 0.4rem;
		font-size: 0.9rem;
	}

	.alert--error {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
	}
</style>
