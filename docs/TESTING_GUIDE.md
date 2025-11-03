# Testing Guide

## Purpose

Testing ensures BurBuriuok delivers accurate terminology, maintains user trust, and avoids regressions as the curriculum expands. This guide documents current practices and outlines future automation goals.

## Current Status (V1)

- Automated tests: limited to a Supabase connectivity check.
- Manual smoke tests:
  - Load glossary sections and verify terminology renders in Lithuanian and English (data served from Supabase `concepts`).
  - Toggle learned state for several terms and confirm persistence via Supabase (`concept_progress`) with fallback caching on the client.
  - Perform searches in Lithuanian and English; validate filtering and results.
  - Run the quiz feature and confirm scoring logic works end-to-end.
  - Regenerate `supabase/seeds/seed_concepts.sql` from `docs/static_info/LBS_concepts_master.md` (`npm run content:seed:generate`) and spot-check a few records to ensure curriculum linkage remains intact before pushing seeds.

### Automated Connectivity Check

- `node tests/checkSupabaseConnection.mjs`
  - Confirms the hosted Supabase REST endpoint responds with HTTP 200 using the service role key.
  - Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to be available in the environment (the script falls back to `.env` if variables are unset).

### Curriculum Export Snapshot

- `node tests/exportCurriculumTree.mjs`
  - Prints the authoritative curriculum hierarchy (nodes and items) exactly as seeded into Supabase.
- `node tests/exportCurriculumTree.mjs --format csv --out docs/static_info/curriculum_in_supabase.csv`
  - Refreshes the stored CSV snapshot at `docs/static_info/curriculum_in_supabase.csv`; the file uses a single `hierarchy_line` column to make diffs easy to review.

### Regression Guards for Markdown-Driven Seeds

- `npm run content:seed:check` (or `npm run content:seed:generate -- --check`)
  - Regenerates seed SQL in-memory and validates it against the committed `supabase/seeds/seed_concepts.sql`.
  - Fails when the canonical markdown produces drift (missing slugs, changed hierarchy codes, translation mismatches) so stale seeds can't slip through.
- Git hook (`.husky/pre-commit`)
  - Executes the seed check locally before commits, preventing out-of-date seeds from landing in the repository.
- CI gate (`.github/workflows/content-seed-guard.yml`)
  - GitHub Action `Content Seed Guard` installs dependencies with `npm ci` and runs `npm run content:seed:check` on pushes and pull requests targeting `main`.

## Planned Automated Coverage

- **Frontend** – component/unit tests with Vitest or Jest; end-to-end flows with Playwright.
- **Backend** (V2) – API contract tests, schema validation, and data access integration tests.
- **Content** – schema validation for glossary data files to ensure required fields are present, plus automated checks that confirm the markdown master file parses successfully before CI regenerates seeds.
- **Media** – upload/delete flows respecting the 4-image quota per user per concept, file-type/size validation, and moderation queue handling once Supabase storage is active.

## Test Commands (to be defined)

- `node tests/checkSupabaseConnection.mjs` – hosted Supabase availability check.
- `npm run content:seed:generate` – rebuild seed SQL from the canonical markdown (treat failures as blockers before applying migrations/seeds).
- `npm run test` – run the full suite locally.
- `npm run test:unit` – unit tests only.
- `npm run test:e2e` – end-to-end tests (requires local backend once available).

> Add concrete commands and coverage thresholds once the testing toolchain is wired into the project.

## Continuous Integration

- Configure GitHub Actions workflow to execute linting, unit tests, and build verification on every pull request.
- Block merges on failing checks once the pipeline is stable.
