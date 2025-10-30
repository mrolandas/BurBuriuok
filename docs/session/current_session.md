# Current Session Plan – BurBuriuok

Maintain this document during the active development session. Update checklists, add findings, and link to new documents as they appear. When the session ends or scope changes, archive or split portions into more specific docs.

## Objectives

- Establish the multi-layer architecture (frontend, backend, data, content, infra).
- Move prototype content into structured Supabase-backed stores.
- Deliver V1 features (terminology browsing, search, progress tracking, basic quizzes, offline-friendly notes).
- Prepare groundwork for V2 (auth, collaborative notes, image uploads, AI assistant).

## Workstreams & Checklists

### 1. Data & Content

- [x] Define Supabase schema (`concepts`, `concept_progress`) and apply migrations.
- [x] Extract Section 1 concepts from `first_draft` into structured JSON/CSV.
- [ ] Seed Supabase `concepts` table with parsed data via seed script.
- [ ] Implement data validation (zod/schema) for concepts before inserting.
- [ ] Document seeding workflow in `content/README.md` (to create).

### 2. Frontend (SvelteKit)

- [ ] Initialise SvelteKit project under `frontend/` with TypeScript.
- [ ] Set up shared Supabase client in `frontend/src/lib/data/` using `data/` package.
- [ ] Build glossary browsing route (`/concepts`) with list, filters, and search.
- [ ] Implement concept detail view with note-taking stub (client-only for now).
- [ ] Add progress toggles synced to Supabase; cache state locally for offline use.
- [ ] Create UI components (ProgressSummary, SearchBar, ConceptCard) adhering to design guidelines.
- [ ] Configure localisation/i18n helpers to keep Lithuanian UI strings organised.

### 3. Backend (Express)

- [ ] Scaffold Express app in `backend/` with routing, error handling, logging.
- [ ] Create health/status endpoint for monitoring.
- [ ] Implement read-only concept endpoints proxying Supabase (if needed for rate limiting or future caching).
- [ ] Define progress endpoints (`GET/POST`) to mediate Supabase updates.
- [ ] Add validation schemas (zod) for backend request/response contracts.
- [ ] Set up testing harness (Vitest/Jest) for backend services.

### 4. Data Layer

- [x] Implement Supabase client wrapper in `data/supabaseClient.ts`.
- [x] Create repository modules (`conceptsRepository`, `progressRepository`).
- [ ] Define shared TypeScript types/interfaces for concepts and progress records.
- [ ] Add lightweight caching utilities for frequently requested data.
- [ ] Document module usage in `data/README.md`.

### 5. Infrastructure & Tooling

- [ ] Add Supabase CLI workflow (`supabase db push`, `supabase db seed`).
- [ ] Configure npm scripts for linting, testing, building across layers.
- [ ] Set up GitHub Actions pipeline (lint + test + build) once code exists.
- [ ] Draft deployment script for GitHub Pages (frontend) and placeholder for backend hosting.
- [ ] Plan backup/export routine for Supabase data (manual for now).

### 6. Documentation & AI Guidance

- [ ] Create README in each major directory outlining purpose, entry points, and key commands.
- [ ] Update `DEVELOPMENT_SETUP.md` as scripts are added.
- [ ] Keep `SUPABASE.md` synced with schema changes and policies.
- [ ] Record notable decisions or context in session log below.

## Session Log

- _Use this section to capture decisions, blockers, and notes for future contributors._

- [ ] Document why Supabase is used from V1 and any constraints of the shared local instance.
- [ ] Record moderation requirements once image upload planning advances.
- [ ] Note any deviations from the plan and link to follow-up tasks.
- [ ] Capture Supabase migration/seed execution steps once tested against the shared instance.

## Branching & Testing Strategy

Maintain short-lived feature branches branching from `main`, each focused on a single workstream milestone. Suggested sequence:

1. `feature/data-supabase-schema` – define Supabase schema, seed scripts, and data layer repositories. When ready: run unit tests (if present) and manual Supabase validation; merge into `main` after verifying seed scripts succeed.
2. `feature/frontend-glossary` – scaffold SvelteKit, build concepts list/search UI consuming the repositories. Manual UI smoke test (Chrome + mobile viewport) before merging.
3. `feature/backend-progress-api` – implement Express progress/concept endpoints. Run automated tests + manual API calls (Insomnia/curl) prior to merge.
4. `feature/frontend-progress-sync` – connect UI progress toggles to backend/Supabase. Manual regression test: mark/unmark concepts, reload, ensure state persists.
5. `feature/content-expansion` – ingest additional sections, update seed data, adjust UI navigation. Manual verification of new content integrity.

After each branch passes manual verification, open a PR targeting `main`, include checklist results, merge upon review, and then branch anew for the next milestone. Keep branches small so AI coding agents can context-switch easily.

## Wrap-up Checklist

- [ ] Review all open checkboxes; move incomplete work to new docs or issues.
- [ ] Summarise session outcomes in repository (commit message, PR, or session archive).
- [ ] Ensure `.env` handling and secrets remain excluded from git history.
