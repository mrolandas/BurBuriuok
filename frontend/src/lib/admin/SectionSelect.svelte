<script lang="ts">
	import { createEventDispatcher, onDestroy, tick } from 'svelte';

	type SectionOption = {
		key: string;
		label: string;
		sectionCode: string;
		sectionTitle: string;
		subsectionCode: string | null;
		subsectionTitle: string | null;
		nodeCode: string;
		disabled?: boolean;
		depth?: number;
	};

	type SectionSelectEvent = {
		change: SectionOption;
	};

	export let options: SectionOption[] = [];
	export let valueKey = '';
	export let valueLabel: string | null = '';
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
		const preferred = option.subsectionTitle?.trim();
		if (preferred && preferred.length) {
			return preferred;
		}
		return option.sectionTitle;
	}

	function optionCode(option: SectionOption): string {
		return option.subsectionCode ?? option.sectionCode;
	}

	function sanitizeOptionKey(key: string): string {
		const cleaned = key.replace(/[^A-Za-z0-9_-]/g, '-');
		return cleaned.length ? cleaned : 'option';
	}

	function optionDomId(option: SectionOption): string {
		return `${componentId}-option-${sanitizeOptionKey(option.key)}`;
	}

	function matchesQuery(option: SectionOption, term: string): boolean {
		if (!term.length) {
			return true;
		}

		const haystack = [
			option.label.toLowerCase(),
			option.sectionTitle.toLowerCase(),
			option.subsectionTitle?.toLowerCase() ?? '',
			option.sectionCode.toLowerCase(),
			option.subsectionCode?.toLowerCase() ?? ''
		];
		return haystack.some((value) => value.includes(term));
	}

	$: normalizedQuery = query.trim().toLowerCase();
	$: filteredOptions = options.filter((option) => matchesQuery(option, normalizedQuery));
	$: selectedOption = options.find((option) => option.key === valueKey) ?? null;
	$: resolvedFallbackLabel = valueLabel && valueLabel.trim().length ? valueLabel : null;
	$: displayLabel = selectedOption
		? optionDisplay(selectedOption)
		: resolvedFallbackLabel ?? placeholder;
	$: displayCode = selectedOption ? optionCode(selectedOption) : '';
	$: highlightedId =
		highlightedIndex >= 0 && highlightedIndex < filteredOptions.length
			? optionDomId(filteredOptions[highlightedIndex])
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
				return findFirstEnabled(filteredOptions);
			}
			const index = filteredOptions.findIndex(
				(option) => !option.disabled && option.key === selectedOption.key
			);
			if (index >= 0) {
				return index;
			}
			return findFirstEnabled(filteredOptions);
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

	function findFirstEnabled(options: SectionOption[]): number {
		return options.findIndex((option) => !option.disabled);
	}

	function findLastEnabled(options: SectionOption[]): number {
		for (let index = options.length - 1; index >= 0; index -= 1) {
			if (!options[index]?.disabled) {
				return index;
			}
		}
		return -1;
	}

	function findNextEnabled(current: number, direction: 1 | -1): number {
		if (!filteredOptions.length) {
			return -1;
		}

		let next = current;
		let attempts = 0;
		const total = filteredOptions.length;

		while (attempts < total) {
			next += direction;
			if (next < 0) {
				next = total - 1;
			} else if (next >= total) {
				next = 0;
			}

			if (!filteredOptions[next]?.disabled) {
				return next;
			}

			attempts += 1;
		}

		return -1;
	}

	function moveHighlight(delta: number): void {
		if (!filteredOptions.length) {
			highlightedIndex = -1;
			return;
		}

		if (highlightedIndex === -1) {
			highlightedIndex = delta >= 0 ? findFirstEnabled(filteredOptions) : findLastEnabled(filteredOptions);
			scrollHighlightedIntoView();
			return;
		}

		const direction: 1 | -1 = delta >= 0 ? 1 : -1;
		const next = findNextEnabled(highlightedIndex, direction);

		if (next !== -1) {
			highlightedIndex = next;
			scrollHighlightedIntoView();
		}
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

		let index = highlightedIndex;
		if (index === -1 || filteredOptions[index]?.disabled) {
			index = findFirstEnabled(filteredOptions);
		}

		if (index === -1) {
			return;
		}

		const option = filteredOptions[index];
		selectOption(option);
	}

	function selectOption(option: SectionOption): void {
		if (option.disabled) {
			return;
		}
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
				? filteredOptions.findIndex((option) => !option.disabled && option.key === selectedOption.key)
				: -1;
			const fallback = preferred >= 0 ? preferred : findFirstEnabled(filteredOptions);
			highlightedIndex = fallback;
			scrollHighlightedIntoView();
		}
	}
</script>

<div class="section-select" data-open={open}>
	<button
		type="button"
		class="section-select__button"
		class:section-select__button--placeholder={!selectedOption && !resolvedFallbackLabel}
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
					{#each filteredOptions as option, index (option.key)}
						<li>
							<button
								type="button"
								class="section-option"
								class:section-option--selected={option.key === valueKey}
								class:section-option--highlighted={index === highlightedIndex}
								class:section-option--disabled={option.disabled}
								on:click={() => selectOption(option)}
								role="option"
								aria-selected={option.key === valueKey}
								aria-disabled={option.disabled}
								id={optionDomId(option)}
								data-option-index={index}
								style={`--option-depth: ${option.depth ?? 0};`}
							>
								<span class="section-option__title">{optionDisplay(option)}</span>
								<span class="section-option__code">{optionCode(option)}</span>
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
		padding-inline-start: calc(0.6rem + (var(--option-depth, 0) * 1.35rem));
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

	.section-option--disabled {
		cursor: default;
		background: transparent;
	}

	.section-option--disabled:hover,
	.section-option--disabled:focus-visible {
		background: transparent;
		border-color: transparent;
	}

	.section-option__title {
		font-weight: 500;
		flex: 1 1 auto;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.section-option--disabled .section-option__title {
		font-weight: 600;
	}

	.section-option__code {
		font-size: 0.8rem;
		color: var(--color-text-soft);
		white-space: nowrap;
	}

	.section-select__empty {
		padding: 0.4rem 0.2rem;
		font-size: 0.9rem;
		color: var(--color-text-soft);
	}
</style>
