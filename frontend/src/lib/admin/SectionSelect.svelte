<script lang="ts">
	import { createEventDispatcher, onDestroy, tick } from 'svelte';

	export type SectionOption = {
		code: string;
		title: string | null;
	};

	type SectionSelectEvent = {
		change: SectionOption;
	};

	export let options: SectionOption[] = [];
	export let valueCode = '';
	export let valueTitle: string | null = '';
	export let labelledBy: string | undefined;
	export let disabled = false;
	export let placeholder = 'Pasirinkite skyrių';

	const dispatch = createEventDispatcher<SectionSelectEvent>();

	let open = false;
	let query = '';
	let previousQuery = '';
	let highlightedIndex = -1;
	let buttonEl: HTMLButtonElement | null = null;
	let searchEl: HTMLInputElement | null = null;
	let dropdownEl: HTMLDivElement | null = null;

	const componentId = `section-select-${Math.random().toString(36).slice(2, 9)}`;
	const listboxId = `${componentId}-listbox`;

	function optionDisplay(option: SectionOption): string {
		const title = option.title?.trim();
		return title && title.length ? `${title} (${option.code})` : option.code;
	}

	function resolveTitle(option: SectionOption): string {
		const title = option.title?.trim();
		return title && title.length ? title : option.code;
	}

	function matchesQuery(option: SectionOption, term: string): boolean {
		if (!term.length) {
			return true;
		}

		const code = option.code.toLowerCase();
		const title = option.title?.toLowerCase() ?? '';
		return code.includes(term) || title.includes(term);
	}

	$: normalizedQuery = query.trim().toLowerCase();
	$: filteredOptions = options.filter((option) => matchesQuery(option, normalizedQuery));
	$: selectedOption = options.find((option) => option.code === valueCode) ?? null;
	$: displayLabel = selectedOption ? resolveTitle(selectedOption) : placeholder;
	$: displayCode = selectedOption ? selectedOption.code : '';
	$: highlightedId =
		highlightedIndex >= 0 && highlightedIndex < filteredOptions.length
			? `${componentId}-option-${filteredOptions[highlightedIndex].code}`
			: undefined;

	let detachPointerListener: (() => void) | null = null;

	function attachPointerListener(): void {
		if (detachPointerListener) {
			return;
		}

		const handler = (event: PointerEvent) => {
			const target = event.target as Node | null;
			if (target && (dropdownEl?.contains(target) || buttonEl?.contains(target))) {
				return;
			}
			closeDropdown(false);
		};

		document.addEventListener('pointerdown', handler, true);
		detachPointerListener = () => {
			document.removeEventListener('pointerdown', handler, true);
			detachPointerListener = null;
		};
	}

	function detachPointer(): void {
		if (detachPointerListener) {
			detachPointerListener();
		}
	}

	onDestroy(() => {
		detachPointer();
	});

	$: {
		if (open) {
			attachPointerListener();
		} else {
			detachPointer();
		}
	}

	async function openDropdown(): Promise<void> {
		if (disabled || !options.length) {
			return;
		}

		open = true;
		query = '';
		previousQuery = '';

		await tick();

		highlightedIndex = (() => {
			if (!filteredOptions.length) {
				return -1;
			}
			if (!selectedOption) {
				return 0;
			}
			const index = filteredOptions.findIndex((option) => option.code === selectedOption.code);
			return index >= 0 ? index : 0;
		})();

		await tick();
		searchEl?.focus();
		scrollHighlightedIntoView();
	}

	function closeDropdown(focusButton = true): void {
		if (!open) {
			return;
		}

		open = false;
		query = '';
		previousQuery = '';
		highlightedIndex = -1;

		if (focusButton) {
			buttonEl?.focus();
		}
	}

	function toggleDropdown(): void {
		if (open) {
			closeDropdown();
		} else {
			void openDropdown();
		}
	}

	function moveHighlight(delta: number): void {
		if (!filteredOptions.length) {
			highlightedIndex = -1;
			return;
		}

		const maxIndex = filteredOptions.length - 1;
		let next = highlightedIndex + delta;

		if (next < 0) {
			next = maxIndex;
		} else if (next > maxIndex) {
			next = 0;
		}

		highlightedIndex = next;
		scrollHighlightedIntoView();
	}

	function scrollHighlightedIntoView(): void {
		void tick().then(() => {
			if (!dropdownEl) {
				return;
			}
			const element = dropdownEl.querySelector<HTMLElement>(
				`[data-option-index="${highlightedIndex}"]`
			);
			element?.scrollIntoView({ block: 'nearest' });
		});
	}

	function selectHighlighted(): void {
		if (!filteredOptions.length) {
			return;
		}

		const index = highlightedIndex >= 0 ? highlightedIndex : 0;
		const option = filteredOptions[index];
		selectOption(option);
	}

	function selectOption(option: SectionOption): void {
		dispatch('change', option);
		closeDropdown();
	}

	function handleButtonKeydown(event: KeyboardEvent): void {
		if (disabled) {
			return;
		}

		switch (event.key) {
			case 'ArrowDown':
			case 'ArrowUp':
			case 'Enter':
			case ' ':
			case 'Spacebar':
				event.preventDefault();
				void openDropdown();
				break;
			default:
				break;
		}
	}

	function handleSearchInput(event: Event): void {
		const target = event.currentTarget as HTMLInputElement | null;
		query = target?.value ?? '';
	}

	function handleSearchKeydown(event: KeyboardEvent): void {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				moveHighlight(1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				moveHighlight(-1);
				break;
			case 'Enter':
				event.preventDefault();
				selectHighlighted();
				break;
			case 'Escape':
				event.preventDefault();
				closeDropdown();
				break;
			case 'Tab':
				closeDropdown(false);
				break;
			default:
				break;
		}
	}

	$: if (open && query !== previousQuery) {
		previousQuery = query;

		if (!filteredOptions.length) {
			highlightedIndex = -1;
		} else {
			const preferred = selectedOption
				? filteredOptions.findIndex((option) => option.code === selectedOption.code)
				: -1;
			highlightedIndex = preferred >= 0 ? preferred : 0;
			scrollHighlightedIntoView();
		}
	}
</script>

<div class="section-select" data-open={open}>
	<button
		type="button"
		class="section-select__button"
		class:section-select__button--placeholder={!selectedOption}
		disabled={disabled || !options.length}
		on:click={toggleDropdown}
		on:keydown={handleButtonKeydown}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-controls={listboxId}
		aria-labelledby={labelledBy}
		bind:this={buttonEl}
	>
		<span class="section-select__value">
			<span class="section-select__title">
				{displayLabel}
			</span>
			{#if selectedOption}
				<span class="section-select__code">{displayCode}</span>
			{/if}
		</span>
		<span class="section-select__icon" aria-hidden="true"></span>
	</button>

	{#if open}
		<div class="section-select__dropdown" bind:this={dropdownEl}>
			<input
				type="text"
				class="section-select__search"
				placeholder="Ieškoti skyriaus..."
				bind:value={query}
				on:input={handleSearchInput}
				on:keydown={handleSearchKeydown}
				aria-autocomplete="list"
				role="combobox"
				aria-expanded="true"
				aria-controls={listboxId}
				aria-activedescendant={highlightedId}
				aria-labelledby={labelledBy}
				bind:this={searchEl}
				spellcheck="false"
				autocomplete="off"
			/>

			<ul class="section-select__options" role="listbox" id={listboxId}>
				{#if filteredOptions.length}
					{#each filteredOptions as option, index (option.code)}
						<li>
							<button
								type="button"
								class="section-option"
								class:section-option--selected={option.code === valueCode}
								class:section-option--highlighted={index === highlightedIndex}
								on:click={() => selectOption(option)}
								role="option"
								aria-selected={option.code === valueCode}
								id={`${componentId}-option-${option.code}`}
								data-option-index={index}
							>
								<span class="section-option__title">{resolveTitle(option)}</span>
								<span class="section-option__code">{option.code}</span>
							</button>
						</li>
					{/each}
				{:else}
					<li class="section-select__empty">Nerasta sutampančių skyrių.</li>
				{/if}
			</ul>
		</div>
	{/if}
</div>

<style>
	.section-select {
		position: relative;
	}

	.section-select__button {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.55rem 0.65rem;
		border-radius: 0.55rem;
		border: 1px solid var(--color-border);
		background: var(--color-panel-soft);
		color: var(--color-text);
		cursor: pointer;
		font: inherit;
	}

	.section-select__button:focus-visible {
		outline: 2px solid rgba(59, 130, 246, 0.6);
		outline-offset: 2px;
	}

	.section-select__button:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.section-select__button--placeholder .section-select__title {
		color: var(--color-text-soft);
	}

	.section-select__value {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.2rem;
		min-width: 0;
	}

	.section-select__title {
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.section-select__code {
		font-size: 0.85rem;
		color: var(--color-text-soft);
	}

	.section-select__icon::before {
		content: '';
		display: inline-block;
		width: 0.55rem;
		height: 0.35rem;
		border-right: 2px solid currentColor;
		border-bottom: 2px solid currentColor;
		transform: rotate(45deg);
		transition: transform 0.2s ease;
	}

	[data-open='true'] .section-select__icon::before {
		transform: rotate(-135deg);
	}

	.section-select__dropdown {
		position: absolute;
		top: calc(100% + 0.4rem);
		left: 0;
		right: 0;
		border: 1px solid var(--color-border);
		border-radius: 0.75rem;
		background: var(--color-panel);
		box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
		padding: 0.75rem;
		display: grid;
		gap: 0.6rem;
		z-index: 60;
	}

	.section-select__search {
		width: 100%;
		padding: 0.45rem 0.55rem;
		border-radius: 0.55rem;
		border: 1px solid var(--color-border-light);
		background: var(--color-panel-soft);
		font: inherit;
	}

	.section-select__search:focus-visible {
		outline: 2px solid rgba(59, 130, 246, 0.6);
		outline-offset: 2px;
	}

	.section-select__options {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.25rem;
		max-height: 260px;
		overflow-y: auto;
	}

	.section-option {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.6rem;
		border-radius: 0.55rem;
		border: 1px solid transparent;
		background: transparent;
		font: inherit;
		cursor: pointer;
		text-align: left;
	}

	.section-option:hover,
	.section-option:focus-visible {
		background: rgba(59, 130, 246, 0.1);
		border-color: rgba(59, 130, 246, 0.25);
	}

	.section-option--selected {
		border-color: rgba(59, 130, 246, 0.35);
	}

	.section-option--highlighted {
		background: rgba(59, 130, 246, 0.15);
	}

	.section-option__title {
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.section-option__code {
		font-size: 0.8rem;
		color: var(--color-text-soft);
	}

	.section-select__empty {
		padding: 0.4rem 0.2rem;
		font-size: 0.9rem;
		color: var(--color-text-soft);
	}
</style>
