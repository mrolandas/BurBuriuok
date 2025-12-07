<script lang="ts">
	import { quizModal } from '$lib/stores/quizModal';

	let dialogElement: HTMLDivElement | null = null;

	const close = () => {
		quizModal.close();
	};

	const handleBackdropClick = (event: MouseEvent) => {
		if (event.currentTarget === event.target) {
			close();
		}
	};

	const handleKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Escape' && $quizModal.open) {
			event.preventDefault();
			close();
		}
	};

	$: if ($quizModal.open && dialogElement) {
		dialogElement.focus();
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $quizModal.open}
	<div class="quiz-modal" role="presentation" onclick={handleBackdropClick}>
		<div
			class="quiz-modal__dialog"
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-labelledby="quiz-modal-title"
			bind:this={dialogElement}
		>
			<header class="quiz-modal__header">
				<h2 id="quiz-modal-title">Žinių patikra</h2>
			</header>
			<div class="quiz-modal__body">
				<p>
					Atidarome skilties žinių patikrą (netrukus). Čia galėsite pasirinkti ar tikrinti konkrečią
					skiltį, ar visą kursą.
				</p>
			</div>
			<footer class="quiz-modal__footer">
				<button type="button" class="quiz-modal__close" onclick={close}>Uždaryti</button>
			</footer>
		</div>
	</div>
{/if}

<style>
	.quiz-modal {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: grid;
		place-items: center;
		background: var(--color-overlay);
		backdrop-filter: blur(4px);
		z-index: 999;
		padding: 1.5rem;
	}

	.quiz-modal__dialog {
		width: min(480px, 100%);
		display: grid;
		gap: 1rem;
		border-radius: 1rem;
		padding: 1.6rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		box-shadow: 0 25px 55px -25px rgba(15, 23, 42, 0.15);
		color: var(--color-text);
	}

	.quiz-modal__header h2 {
		margin: 0;
		font-size: 1.25rem;
		color: var(--color-text);
	}

	.quiz-modal__body {
		font-size: 0.95rem;
		line-height: 1.6;
		color: var(--color-text-subtle);
	}

	.quiz-modal__footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
	}

	.quiz-modal__close {
		padding: 0.55rem 1.1rem;
		border-radius: 999px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
		font-weight: 600;
		cursor: pointer;
		transition:
			border-color 0.2s ease,
			background-color 0.2s ease,
			color 0.2s ease;
	}

	.quiz-modal__close:hover,
	.quiz-modal__close:focus-visible {
		border-color: var(--color-accent);
		background: var(--color-accent-faint);
		color: var(--color-accent-strong);
	}
</style>
