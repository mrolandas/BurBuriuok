<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll, goto, pushState } from '$app/navigation';
	import { page } from '$app/stores';
	import { onDestroy, onMount, tick } from 'svelte';
	import { adminMode } from '$lib/stores/adminMode';
	import { updateCurriculumNode } from '$lib/api/admin/curriculum';
	import { AdminApiError } from '$lib/api/admin/client';
	import type { PageData, SectionCard } from './+page';
	import ConceptModal from '$lib/components/ConceptModal.svelte';
	import {
		initializeProgressTracking,
		learnerProgress,
		learnerProgressStatus,
		type ConceptProgressRecord,
		type ProgressStoreStatus
	} from '$lib/stores/progressStore';
	import { fetchSectionProgressBlueprint } from '$lib/api/curriculum';

	let { data } = $props<{ data: PageData }>();

	let adminModeEnabled = $state(false);
	let unsubscribeAdmin: (() => void) | null = null;
	let sections = $state<SectionCard[]>(
		data.sections.map((section: SectionCard) => ({ ...section }))
	);
	let lastDataSections: SectionCard[] = data.sections;

	// Modal state
	let selectedConceptSlug = $state<string | null>(null);

	// Progress tracking
	let progressRecords = $state<Map<string, ConceptProgressRecord>>(new Map());
	let progressStatus = $state<ProgressStoreStatus>('idle');
	let sectionProgress = $state<Map<string, { known: number; total: number }>>(new Map());
	let unsubscribeProgress: (() => void) | null = null;
	let unsubscribeProgressStatus: (() => void) | null = null;

	type SectionEditForm = {
		code: string;
		title: string;
		summary: string;
	};

	let editForm = $state<SectionEditForm | null>(null);
	let editSaving = $state(false);
	let editError = $state<string | null>(null);
	let editTitleInput = $state<HTMLInputElement | null>(null);
	let successMessage = $state<string | null>(null);
	let successTimeout: ReturnType<typeof setTimeout> | null = null;
	let heroSearchTerm = $state('');

	const handleHeroSearch = (event: Event) => {
		event.preventDefault();
		if (heroSearchTerm.trim()) {
			goto(`/search?q=${encodeURIComponent(heroSearchTerm.trim())}`);
		}
	};

	function handleSelectConcept(slug: string) {
		selectedConceptSlug = slug;
		const url = new URL($page.url);
		url.searchParams.set('concept', slug);
		pushState(url, { conceptSlug: slug });
	}

	function closeConceptModal() {
		selectedConceptSlug = null;
		const url = new URL($page.url);
		url.searchParams.delete('concept');
		pushState(url, { conceptSlug: null });
	}

	// Handle browser back/forward
	$effect(() => {
		const state = $page.state as { conceptSlug?: string | null };
		if (state.conceptSlug !== undefined) {
			selectedConceptSlug = state.conceptSlug;
		} else {
			// Fallback to query param if state is missing (e.g. on load)
			const slug = $page.url.searchParams.get('concept');
			if (slug !== selectedConceptSlug) {
				selectedConceptSlug = slug;
			}
		}
	});

	onMount(() => {
		adminMode.initialize();
		unsubscribeAdmin = adminMode.subscribe((value) => {
			adminModeEnabled = value;
		});

		unsubscribeProgress = learnerProgress.subscribe((value) => {
			progressRecords = value;
			calculateSectionProgress();
		});
		unsubscribeProgressStatus = learnerProgressStatus.subscribe((value) => {
			progressStatus = value;
		});
		void initializeProgressTracking();
		void loadAllSectionBlueprints();

		// Check initial URL
		const slug = $page.url.searchParams.get('concept');
		if (slug) {
			selectedConceptSlug = slug;
		}
	});

	onDestroy(() => {
		unsubscribeAdmin?.();
		unsubscribeProgress?.();
		unsubscribeProgressStatus?.();
		if (successTimeout) {
			clearTimeout(successTimeout);
			successTimeout = null;
		}
	});

	async function loadAllSectionBlueprints() {
		// We need to know which concepts belong to which section to calculate totals
		// This is a bit heavy, but necessary for the dashboard view if we want accurate counts
		// Optimization: In a real app, we might want to fetch this pre-calculated from the backend
		for (const section of sections) {
			try {
				const blueprint = await fetchSectionProgressBlueprint(section.code);
				const conceptIds = new Set<string>();
				for (const assignment of blueprint.conceptAssignments) {
					if (assignment.conceptId) {
						conceptIds.add(assignment.conceptId);
					}
				}
				sectionConceptMaps.set(section.code, conceptIds);
			} catch (e) {
				console.warn(`Failed to load blueprint for ${section.code}`, e);
			}
		}
		calculateSectionProgress();
	}

	const sectionConceptMaps = new Map<string, Set<string>>();

	function calculateSectionProgress() {
		const next = new Map<string, { known: number; total: number }>();
		for (const section of sections) {
			const conceptIds = sectionConceptMaps.get(section.code);
			if (!conceptIds) {
				next.set(section.code, { known: 0, total: 0 });
				continue;
			}
			let known = 0;
			for (const id of conceptIds) {
				if (progressRecords.get(id)?.status === 'known') {
					known++;
				}
			}
			next.set(section.code, { known, total: conceptIds.size });
		}
		sectionProgress = next;
	}

	$effect(() => {
		if (data.sections !== lastDataSections) {
			sections = data.sections.map((section: SectionCard) => ({ ...section }));
			lastDataSections = data.sections;
		}
	});

	const reloadSections = async () => {
		await invalidateAll();
	};

	const cleanTitle = (title: string) => title.replace(/\s*\([^)]*\)\s*$/, '').trim();

	const formatTitle = (title: string) => {
		const cleaned = cleanTitle(title);
		// Check if title is mostly uppercase (simple heuristic: more than 50% uppercase letters)
		const upperCount = cleaned.replace(/[^A-ZĄČĘĖĮŠŲŪŽ]/g, '').length;
		const letterCount = cleaned.replace(/[^a-zA-ZąčęėįšųūžĄČĘĖĮŠŲŪŽ]/g, '').length;
		
		if (letterCount > 0 && upperCount / letterCount > 0.8) {
			// Convert to sentence case
			return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
		}
		return cleaned;
	};

	type AvatarSegment = {
		d: string;
		fill?: string;
		stroke?: string;
		strokeWidth?: number;
		strokeLinecap?: 'round' | 'square' | 'butt';
		strokeLinejoin?: 'round' | 'miter' | 'bevel';
		fillRule?: 'nonzero' | 'evenodd';
	};

	type AvatarTheme = {
		background: string;
		border: string;
		iconColor: string;
		icon: AvatarSegment[];
	};

	const sectionThemes: Record<string, AvatarTheme> = {
		'1': { // Konstrukcija
			background: 'rgba(6, 182, 212, 0.12)',
			border: 'rgba(8, 145, 178, 0.25)',
			iconColor: '#0891b2',
			icon: [
				{ d: 'M2 20a2.4 2.4 0 0 0 2 2h16a2.4 2.4 0 0 0 2-2c0-1.14-.9-2.08-2-2.15V14a2 2 0 0 0-2-2h-2v-2h2a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2v2H6a2 2 0 0 0-2 2v3.85A2.15 2.15 0 0 0 2 20zM6 4h12v4H6V4zm2 6h8v2H8v-2zm-2 4h12v4H6v-4z', fill: 'currentColor' }
			]
		},
		'2': { // Teorija (Wind/Sails)
			background: 'rgba(139, 92, 246, 0.12)',
			border: 'rgba(124, 58, 237, 0.25)',
			iconColor: '#7c3aed',
			icon: [
				{ d: 'M12.8 2.6l-3.6 11.4 6.8 1.4-10.4 6 3.6-11.4-6.8-1.4 10.4-6z', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round', fill: 'none' }
			]
		},
		'3': { // Valdymas (Helm)
			background: 'rgba(249, 115, 22, 0.12)',
			border: 'rgba(234, 88, 12, 0.25)',
			iconColor: '#ea580c',
			icon: [
				{ d: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z', fill: 'currentColor', fillRule: 'evenodd' },
				{ d: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', fill: 'currentColor' },
				{ d: 'M12 2v4M12 18v4M2 12h4M18 12h4', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }
			]
		},
		'4': { // Sauga (Lifebuoy/Cross)
			background: 'rgba(239, 68, 68, 0.12)',
			border: 'rgba(220, 38, 38, 0.25)',
			iconColor: '#dc2626',
			icon: [
				{ d: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
				{ d: 'M12 7v10M7 12h10', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round' }
			]
		},
		'5': { // Meteorologija (Cloud/Sun)
			background: 'rgba(14, 165, 233, 0.12)',
			border: 'rgba(2, 132, 199, 0.25)',
			iconColor: '#0284c7',
			icon: [
				{ d: 'M17 17a5 5 0 0 0 2-9.9V7a7 7 0 0 0-13.8 1.6A5 5 0 0 0 7 17h10z', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' }
			]
		},
		'6': { // Navigacija (Compass)
			background: 'rgba(16, 185, 129, 0.12)',
			border: 'rgba(5, 150, 105, 0.25)',
			iconColor: '#059669',
			icon: [
				{ d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' },
				{ d: 'M12 8v8M8 12h8', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }
			]
		},
		'7': { // Teisė (Scale/Book)
			background: 'rgba(79, 70, 229, 0.12)',
			border: 'rgba(67, 56, 202, 0.25)',
			iconColor: '#4f46e5',
			icon: [
				{ d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', fill: 'none' },
				{ d: 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round', fill: 'none' }
			]
		},
		'8': { // CEVNI (Sign)
			background: 'rgba(217, 70, 239, 0.12)',
			border: 'rgba(192, 38, 211, 0.25)',
			iconColor: '#c026d3',
			icon: [
				{ d: 'M12 2L2 22h20L12 2z', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' },
				{ d: 'M12 16v.01M12 8v4', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round' }
			]
		},
		'9': { // COLREGS (Ships/Traffic)
			background: 'rgba(245, 158, 11, 0.12)',
			border: 'rgba(217, 119, 6, 0.25)',
			iconColor: '#d97706',
			icon: [
				{ d: 'M3 11l18-5v12L3 14v-3z', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' },
				{ d: 'M11.6 16.8L3 14', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }
			]
		},
		'10': { // Praktika (Anchor)
			background: 'rgba(37, 99, 235, 0.12)',
			border: 'rgba(29, 78, 216, 0.25)',
			iconColor: '#1d4ed8',
			icon: [
				{ d: 'M12 2v20M5 12H2a10 10 0 0 0 20 0h-3', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', fill: 'none' },
				{ d: 'M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', fill: 'currentColor' }
			]
		}
	};

	const defaultTheme: AvatarTheme = {
		background: 'rgba(148, 163, 184, 0.12)',
		border: 'rgba(100, 116, 139, 0.25)',
		iconColor: '#64748b',
		icon: [{ d: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' }]
	};

	const selectTheme = (code: string) => {
		return sectionThemes[code] ?? defaultTheme;
	};

	const formatCount = (value: number, singular: string, few: string, many: string) => {
		const modTen = value % 10;
		const modHundred = value % 100;
		if (value === 0) {
			return `0 ${many}`;
		}
		if (modHundred >= 10 && modHundred <= 20) {
			return `${value} ${many}`;
		}
		if (modTen === 1) {
			return `${value} ${singular}`;
		}
		if (modTen >= 2 && modTen <= 9) {
			return `${value} ${few}`;
		}
		return `${value} ${many}`;
	};

	const formatMeta = (section: SectionCard) => {
		const subsectionLabel = formatCount(section.subsectionCount, 'skyrius', 'skyriai', 'skyrių');
		const conceptLabel = formatCount(section.conceptCount, 'sąvoka', 'sąvokos', 'sąvokų');
		
		const progress = sectionProgress.get(section.code);
		if (progress && progress.total > 0 && progress.known > 0) {
			const percentage = Math.round((progress.known / progress.total) * 100);
			return `${percentage}% moku · ${progress.known}/${progress.total} sąvokų`;
		}
		
		return `${subsectionLabel} · ${conceptLabel}`;
	};

	const toDomId = (code: string) => code.replace(/[^a-zA-Z0-9_-]/g, '-');

	const openSectionEditor = async (section: SectionCard) => {
		editForm = {
			code: section.code,
			title: section.title,
			summary: section.summary ?? ''
		};
		editError = null;
		editSaving = false;
		await tick();
		editTitleInput?.focus();
	};

	const closeSectionEditor = () => {
		editForm = null;
		editError = null;
		editSaving = false;
	};

	const showSuccessMessage = (message: string) => {
		successMessage = message;
		if (successTimeout) {
			clearTimeout(successTimeout);
		}
		successTimeout = setTimeout(() => {
			successMessage = null;
			successTimeout = null;
		}, 4000);
	};

	const handleEditClick = async (event: MouseEvent, section: SectionCard) => {
		event.preventDefault();
		event.stopPropagation();
		await openSectionEditor(section);
	};

	const handleEditSubmit = async (event: Event) => {
		event.preventDefault();
		if (!editForm) {
			return;
		}

		const title = editForm.title.trim();
		const summary = editForm.summary.trim();

		if (!title.length) {
			editError = 'Įrašykite skilties pavadinimą.';
			return;
		}

		editSaving = true;
		editError = null;

		try {
			const updated = await updateCurriculumNode(editForm.code, {
				title,
				summary: summary.length ? summary : null
			});
			sections = sections.map((entry: SectionCard) =>
				entry.code === updated.code
					? {
							...entry,
							title: updated.title,
							summary: updated.summary,
							ordinal: typeof updated.ordinal === 'number' ? updated.ordinal : entry.ordinal
						}
					: entry
			);
			closeSectionEditor();
			showSuccessMessage('Skiltis atnaujinta.');
		} catch (error) {
			if (error instanceof AdminApiError) {
				editError = error.message || 'Nepavyko atnaujinti skilties.';
			} else if (error instanceof Error) {
				editError = error.message;
			} else {
				editError = 'Nepavyko atnaujinti skilties.';
			}
		} finally {
			editSaving = false;
		}
	};

	$effect(() => {
		if (!editForm) {
			return;
		}

		const handleKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				closeSectionEditor();
			}
		};

		window.addEventListener('keydown', handleKey);
		return () => {
			window.removeEventListener('keydown', handleKey);
		};
	});
</script>

{#if data.loadError}
	<section class="status-block status-block--error" role="alert">
		<div>
			<p class="status-block__title">Nepavyko įkelti skilčių</p>
			<p class="status-block__body">{data.loadError}</p>
		</div>
		<button class="status-block__action" type="button" onclick={() => void reloadSections()}>
			Bandyti dar kartą
		</button>
	</section>
{/if}

{#if successMessage}
	<div class="sections-toast" role="status" aria-live="polite">{successMessage}</div>
{/if}

<header class="hero">
	<div class="hero__content">
		<form class="hero__search" onsubmit={handleHeroSearch}>
			<div class="hero__search-wrapper">
				<svg class="hero__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="11" cy="11" r="8"></circle>
					<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
				</svg>
				<input 
					type="search" 
					class="hero__search-input" 
					placeholder="Ieškoti temų, sąvokų..." 
					bind:value={heroSearchTerm}
					aria-label="Paieška"
				/>
			</div>
		</form>
	</div>
</header>

<section class="sections-grid" aria-live="polite">
	{#if !sections.length && !data.loadError}
		<div class="sections-grid__placeholder">
			<p>Kraunama skilčių lenta...</p>
		</div>
	{:else}
		{#each sections as section (section.code)}
			{@const title = formatTitle(section.title)}
			{@const theme = selectTheme(section.code)}
			{@const metaLabel = formatMeta(section)}
			{@const sectionLabel = `Skyrius #${section.ordinal}`}
			{@const domId = toDomId(section.code)}
			{@const progress = sectionProgress.get(section.code)}
			{@const isStarted = progress && progress.known > 0}
			{@const isUntouched = !progress || progress.known === 0}

			<article
				class="section-card"
				class:section-card--started={isStarted}
				class:section-card--untouched={isUntouched}
			>
				<a
					class="section-card__link"
					href={resolve('/sections/[code]', { code: section.code })}
					aria-labelledby={`section-${domId}`}
				>
					<div 
						class="section-card__visual"
						style={`background:${theme.background};color:${theme.iconColor};`}
					>
						<svg viewBox="0 0 24 24" role="presentation" focusable="false" aria-hidden="true">
							{#each theme.icon as segment, index (index)}
								<path
									d={segment.d}
									fill={segment.fill ?? 'none'}
									stroke={segment.stroke ?? theme.iconColor}
									stroke-width={segment.strokeWidth}
									stroke-linecap={segment.strokeLinecap}
									stroke-linejoin={segment.strokeLinejoin}
									fill-rule={segment.fillRule}
								></path>
							{/each}
						</svg>
					</div>
					
					<div class="section-card__body">
						<div class="section-card__header">
							<span class="section-card__ordinal">{sectionLabel}</span>
						</div>
						
						<h2 class="section-card__title" id={`section-${domId}`}>{title}</h2>
						
						<div class="section-card__footer">
							<span class="section-card__meta-counts">{metaLabel}</span>
							<span class="section-card__arrow">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<line x1="5" y1="12" x2="19" y2="12"></line>
									<polyline points="12 5 19 12 12 19"></polyline>
								</svg>
							</span>
						</div>
					</div>
				</a>
				
				{#if adminModeEnabled}
					<button
						type="button"
						class="section-card__edit"
						onclick={(event) => handleEditClick(event, section)}
						aria-label="Redaguoti skiltį"
					>
						<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
							<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
							<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
						</svg>
					</button>
				{/if}
			</article>
		{/each}
	{/if}
</section>

{#if editForm}
	<div class="section-edit-layer">
		<button
			type="button"
			class="section-edit-backdrop"
			aria-label="Uždaryti redagavimo langą"
			onclick={closeSectionEditor}
		></button>
		<div
			class="section-edit-dialog"
			role="dialog"
			aria-modal="true"
			aria-labelledby="section-edit-title"
			tabindex="-1"
		>
			<header class="section-edit-header">
				<div>
					<h2 id="section-edit-title">Redaguoti skiltį</h2>
					<p class="section-edit-subtitle">{editForm.code}</p>
				</div>
				<button
					type="button"
					class="section-edit-close"
					onclick={closeSectionEditor}
					aria-label="Uždaryti redagavimo langą"
				>
					<span aria-hidden="true">×</span>
				</button>
			</header>
			<form class="section-edit-form" onsubmit={handleEditSubmit}>
				<div class="section-edit-field">
					<label for="section-edit-title-input">Pavadinimas</label>
					<input
						id="section-edit-title-input"
						type="text"
						bind:value={editForm.title}
						required
						maxlength="150"
						placeholder="Skilties pavadinimas"
						bind:this={editTitleInput}
					/>
				</div>
				<div class="section-edit-field">
					<label for="section-edit-summary-input">Aprašas</label>
					<textarea
						id="section-edit-summary-input"
						rows="5"
						bind:value={editForm.summary}
						placeholder="Trumpas skilties aprašas"
					></textarea>
					<p class="section-edit-hint">Palikite tuščią, jei aprašas dar neparengtas.</p>
				</div>
				{#if editError}
					<p class="section-edit-error" role="alert">{editError}</p>
				{/if}
				<div class="section-edit-actions">
					<button
						type="button"
						class="section-edit-button section-edit-button--ghost"
						onclick={closeSectionEditor}
						disabled={editSaving}
					>
						Atšaukti
					</button>
					<button
						type="submit"
						class="section-edit-button section-edit-button--primary"
						disabled={editSaving}
					>
						{#if editSaving}
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
	.hero {
		width: min(100%, var(--layout-max-width));
		margin: 0 auto;
		padding: 0 clamp(1rem, 3vw, 2rem) clamp(1.5rem, 4vw, 3rem);
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.hero__content {
		max-width: 48rem;
		width: 100%;
	}


	.hero__search {
		width: 100%;
		max-width: 32rem;
		margin: 0 auto;
	}

	.hero__search-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.hero__search-icon {
		position: absolute;
		left: 1.25rem;
		width: 1.5rem;
		height: 1.5rem;
		color: var(--color-text-subtle);
		pointer-events: none;
	}

	.hero__search-input {
		width: 100%;
		height: 3.5rem;
		padding: 0 1.25rem 0 3.5rem;
		font-size: 1.1rem;
		border-radius: 999px;
		border: 2px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
		transition: all 0.2s ease;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
	}

	.hero__search-input:focus {
		outline: none;
		border-color: var(--color-accent);
		box-shadow: 0 0 0 4px var(--color-accent-faint);
	}

	.hero__search-input::placeholder {
		color: var(--color-text-subtle);
	}

	.sections-grid {
		width: min(100%, var(--layout-max-width));
		margin: 0 auto;
		display: grid;
		gap: 1.5rem;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 400px), 1fr));
		padding: 0 clamp(1rem, 3vw, 2rem) 6rem;
	}

	.sections-grid__placeholder {
		grid-column: 1 / -1;
		min-height: 200px;
		display: grid;
		place-items: center;
		border-radius: 1.5rem;
		background: rgba(15, 23, 42, 0.03);
		border: 2px dashed var(--color-border);
		color: var(--color-text-muted);
	}

	.section-card {
		position: relative;
		background: var(--color-surface);
		border-radius: 1.25rem;
		border: 1px solid var(--color-border);
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		overflow: hidden;
		height: 100%;
	}

	.section-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
		border-color: var(--color-accent-border);
	}

	.section-card__link {
		display: grid;
		grid-template-columns: 110px 1fr;
		gap: 1.5rem;
		height: 100%;
		text-decoration: none;
		color: inherit;
	}

	.section-card__link:focus-visible {
		outline: none;
	}

	.section-card:focus-within {
		outline: 2px solid var(--color-accent);
		outline-offset: 4px;
	}

	.section-card__visual {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: 1.5rem;
		position: relative;
	}

	.section-card__visual svg {
		width: 100%;
		height: 100%;
		max-width: 3.5rem;
		max-height: 3.5rem;
		filter: drop-shadow(0 4px 6px rgba(0,0,0,0.05));
		transition: transform 0.3s ease;
	}

	.section-card:hover .section-card__visual svg {
		transform: scale(1.1) rotate(-5deg);
	}

	.section-card__body {
		display: flex;
		flex-direction: column;
		padding: 1.25rem 1.5rem 1.25rem 0;
		gap: 0.5rem;
	}

	.section-card__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.section-card__ordinal {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-subtle);
	}

	.section-card__title {
		font-size: 1.25rem;
		font-weight: 700;
		line-height: 1.3;
		margin: 0;
		color: var(--color-text);
	}

	.section-card__footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: auto;
		padding-top: 0.75rem;
	}

	.section-card__meta-counts {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.section-card__arrow {
		color: var(--color-accent);
		opacity: 0;
		transform: translateX(-10px);
		transition: all 0.3s ease;
	}

	.section-card__arrow svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.section-card:hover .section-card__arrow {
		opacity: 1;
		transform: translateX(0);
	}

	.section-card__edit {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		color: var(--color-text-muted);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s ease;
		opacity: 0;
		z-index: 2;
	}

	.section-card:hover .section-card__edit,
	.section-card:focus-within .section-card__edit {
		opacity: 1;
	}

	.section-card__edit:hover {
		background: var(--color-accent);
		border-color: var(--color-accent);
		color: white;
	}

	.section-card__edit svg {
		width: 1rem;
		height: 1rem;
	}

	/* Progress states */
	.section-card--untouched .section-card__visual {
		filter: grayscale(0.8) opacity(0.7);
		transition: filter 0.3s ease;
	}

	.section-card--untouched:hover .section-card__visual {
		filter: grayscale(0) opacity(1);
	}

	.section-card--started {
		border-color: var(--color-accent-faint);
		background: linear-gradient(to bottom right, var(--color-surface), var(--color-panel-secondary));
	}

	@media (max-width: 640px) {
		.hero {
			padding: 2rem 1rem;
		}
		
		.section-card__link {
			grid-template-columns: 90px 1fr;
		}
		
		.section-card__visual {
			padding: 1rem;
		}
		
		.section-card__body {
			padding: 1rem 1rem 1rem 0;
		}
	}

	/* Status Block & Toast Styles (kept mostly same but updated vars) */
	.status-block {
		width: min(100%, var(--layout-max-width));
		margin: 0 auto 2rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.25rem;
		padding: 1.5rem;
		border-radius: 1rem;
		border: 1px solid rgba(239, 68, 68, 0.3);
		background: rgba(239, 68, 68, 0.1);
		color: var(--color-error);
	}

	.status-block__title {
		margin: 0 0 0.25rem;
		font-weight: 700;
	}

	.status-block__body {
		margin: 0;
		font-size: 0.95rem;
		opacity: 0.9;
	}

	.status-block__action {
		border: 0;
		border-radius: 999px;
		padding: 0.5rem 1.25rem;
		font-weight: 600;
		cursor: pointer;
		background: var(--color-error);
		color: white;
		transition: transform 0.2s ease;
	}

	.sections-toast {
		position: fixed;
		bottom: 2rem;
		right: 2rem;
		background: var(--color-surface);
		color: var(--color-success);
		padding: 1rem 1.5rem;
		border-radius: 1rem;
		font-weight: 600;
		box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
		border: 1px solid var(--color-success);
		z-index: 100;
		animation: slideUp 0.3s ease;
	}

	@keyframes slideUp {
		from { transform: translateY(100%); opacity: 0; }
		to { transform: translateY(0); opacity: 1; }
	}

	/* Edit Modal Styles */
	.section-edit-layer {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		z-index: 1000;
	}

	.section-edit-backdrop {
		position: absolute;
		inset: 0;
		border: none;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
		cursor: pointer;
	}

	.section-edit-dialog {
		position: relative;
		z-index: 1;
		width: min(600px, 100%);
		display: grid;
		gap: 1.5rem;
		padding: 2rem;
		border-radius: 1.5rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
	}

	.section-edit-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
	}

	.section-edit-header h2 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
	}

	.section-edit-subtitle {
		margin: 0.25rem 0 0;
		color: var(--color-text-muted);
	}

	.section-edit-close {
		background: transparent;
		border: none;
		font-size: 1.5rem;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 0.5rem;
		margin: -0.5rem;
		border-radius: 50%;
		transition: all 0.2s;
	}

	.section-edit-close:hover {
		background: var(--color-surface-alt);
		color: var(--color-text);
	}

	.section-edit-form {
		display: grid;
		gap: 1.25rem;
	}

	.section-edit-field {
		display: grid;
		gap: 0.5rem;
	}

	.section-edit-field label {
		font-weight: 600;
		font-size: 0.95rem;
	}

	.section-edit-field input,
	.section-edit-field textarea {
		border-radius: 0.75rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface-alt);
		padding: 0.75rem 1rem;
		font: inherit;
		color: inherit;
		transition: all 0.2s;
	}

	.section-edit-field input:focus,
	.section-edit-field textarea:focus {
		outline: none;
		border-color: var(--color-accent);
		background: var(--color-surface);
		box-shadow: 0 0 0 3px var(--color-accent-faint);
	}

	.section-edit-actions {
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
		margin-top: 0.5rem;
	}

	.section-edit-button {
		border-radius: 999px;
		font-weight: 600;
		padding: 0.6rem 1.5rem;
		border: 1px solid transparent;
		cursor: pointer;
		font: inherit;
		transition: all 0.2s;
	}

	.section-edit-button--ghost {
		background: transparent;
		color: var(--color-text-muted);
	}

	.section-edit-button--ghost:hover {
		background: var(--color-surface-alt);
		color: var(--color-text);
	}

	.section-edit-button--primary {
		background: var(--color-accent);
		color: white;
	}

	.section-edit-button--primary:hover {
		background: var(--color-accent-strong);
		transform: translateY(-1px);
	}

	@media (max-width: 640px) {
		.hero {
			padding: 3rem 1rem;
		}
		
		.section-card__link {
			padding: 1.5rem;
		}
	}
</style>
