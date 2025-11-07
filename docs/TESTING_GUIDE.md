# Testing Guide

## Purpose

Testing ensures BurBuriuok delivers accurate terminology, maintains user trust, and avoids regressions as the curriculum expands. This guide documents current practices and outlines future automation goals.

## Current Status (V1)

- Automated coverage focuses on Supabase connectivity and repository helpers.
- Manual smoke tests target backend APIs and seed regeneration integrity:
  - Hit `/health` to confirm the Express service boots (`curl -s http://localhost:4000/health`).
  - Exercise curriculum read endpoints (`GET /api/v1/curriculum`, `/api/v1/concepts`, `/api/v1/dependencies`) and verify payload shape matches `docs/references/API_CONTRACTS.md`.
  - Use a device key when testing progress endpoints (`GET/PUT/DELETE /api/v1/progress/:conceptId`) and validate rate-limit metadata headers.
  - Regenerate `supabase/seeds/seed_concepts.sql` and `supabase/seeds/seed_curriculum_dependencies.sql` from `docs/static_info/LBS_concepts_master.md` (`npm run content:seed:generate`, `npm run content:seed:dependencies`) and confirm `npm run content:seed:check` reports no drift before pushing.
  - Navigate from the curriculum tree to a concept detail page (`/concepts/[slug]`) to confirm breadcrumbs, Lithuanian copy, placeholder actions, and peer-topic links render without console errors.
  - Toggle the AppShell admin control (“Aktyvuoti Admin” / “Deaktyvuoti Admin”) and follow a few concept links to confirm the impersonation query flag persists and inline edit affordances stay visible without requiring a page refresh.
  - Run an admin inline edit rehearsal: with the toggle active, update a draft concept, confirm the inline save returns 201, verify audit logging succeeds, and attempt a publish that currently fails with the expected validation 400 (no 500s). Repeat after any Supabase key rotation.

### Automated Connectivity Check

- `node tests/checkSupabaseConnection.mjs`
  - Confirms the hosted Supabase REST endpoint responds with HTTP 200 using the service role key.
  - Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to be available in the environment (the script falls back to `.env` if variables are unset).

### Backend Type Safety

- `npm run backend:typecheck`
  - Runs `tsc --project backend/tsconfig.json` to ensure the Express layer, middleware, and repositories compile against current type definitions.
  - Husky + CI should run this once backend endpoints expand (hook wiring pending).

### Curriculum Export Snapshot

- `node tests/exportCurriculumTree.mjs`
  - Prints the authoritative curriculum hierarchy (nodes and items) exactly as seeded into Supabase.
- `node tests/exportCurriculumTree.mjs --format csv --out docs/static_info/curriculum_in_supabase.csv`
  - Refreshes the stored CSV snapshot at `docs/static_info/curriculum_in_supabase.csv`; the file uses a single `hierarchy_line` column to make diffs easy to review.

### Regression Guards for Content Artifacts

- **Seed SQL** – `npm run content:seed:check` (or `npm run content:seed:generate -- --check`)
  - Regenerates seed SQL in-memory and validates it against the committed `supabase/seeds/seed_concepts.sql`.
  - Emits info-level warnings when duplicate section/term pairs are collapsed (e.g., tables that repeat “Rifštertai”); this is expected after introducing the deduplication pass in `content/scripts/build_seed_sql.mjs`.
  - Fails when the canonical markdown produces drift (missing slugs, changed hierarchy codes, translation mismatches) so stale seeds can't slip through.
- **Curriculum snapshot** – `npm run content:snapshot:check`
  - Regenerates `docs/static_info/curriculum_in_supabase.csv` and compares it to the committed snapshot so topology changes are caught immediately.
  - Committers stage the refreshed CSV when legitimate curriculum edits occur.
- **Markdown schema** – `npm run content:markdown:validate`
  - Parses `docs/static_info/LBS_concepts_master.md` and ensures required columns (`Term LT`, `Term EN`, `Apibrėžimas`) exist, rows have matching cell counts, and definitions are populated.
- **Git hook** – `.husky/pre-commit`
  - Runs all three guards locally before commits to block stale seeds, snapshot drift, or malformed markdown tables.
- **CI gate** – `.github/workflows/content-seed-guard.yml`
  - GitHub Action `Content Regression Guard` runs the same trio of commands on pushes and pull requests targeting `main`.

### Frontend Inline Editing Regression Tests

- `npm run test:frontend` – runs the Node test harness in `frontend/tests/inlineAdvancedSummary.test.ts` via `tsx`.
  - Verifies the advanced structural summary reflects live field edits.
  - Ensures validation failures on structural fields trigger the advanced drawer warning state.
  - Guards the advanced-field whitelist so structural inputs stay grouped correctly.
- Run before merging any changes to `frontend/src/lib/components/ConceptDetail.svelte`, `$lib/admin/inlineAdvancedSummary.ts`, or other inline admin editing helpers, and whenever bug reports mention “Struktūros nustatymai” or advanced section regressions.

## Planned Automated Coverage

- **Frontend** – component/unit tests with Vitest or Jest; end-to-end flows with Playwright.
- **Backend** (V2) – API contract tests, schema validation, and data access integration tests.
- **Content** – schema validation for glossary data files to ensure required fields are present, plus automated checks that confirm the markdown master file parses successfully before CI regenerates seeds.
- **Media** – upload/delete flows respecting the 4-image quota per user per concept, file-type/size validation, and moderation queue handling once Supabase storage is active.

## Test Commands (to be defined)

- `node tests/checkSupabaseConnection.mjs` – hosted Supabase availability check.
- `npm run content:seed:generate` – rebuild seed SQL from the canonical markdown (treat failures as blockers before applying migrations/seeds).
- `npm run test` – run the full suite locally.
- `npm run backend:typecheck` / `npm run frontend:check` / `npm run content:markdown:validate` / `npm run content:seed:check` – combined “complete test” set exercised before releases to cover backend types, Svelte diagnostics, markdown integrity, and seed drift.
- `npm run test:unit` – unit tests only.
- `npm run test:e2e` – end-to-end tests (requires local backend once available).
- `npm run test:frontend` – runs inline admin editing regressions guarding advanced structural summaries.

> Add concrete commands and coverage thresholds once the testing toolchain is wired into the project.

## Continuous Integration

- Configure GitHub Actions workflow to execute linting, unit tests, and build verification on every pull request.
- Block merges on failing checks once the pipeline is stable.
