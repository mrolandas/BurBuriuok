# Supabase Reference

This document captures how BurKursas uses Supabase during early development (starting with V1), how to access the live project, and what changes are planned as we expand admin tooling, moderation, and learner engagement.

## Current Environment

- **Hosted project** – `burburiuok` on Supabase.com, project reference `zvlziltltbalebqpmuqs`.
- **API URL** – `SUPABASE_URL` in `.env` (currently `https://zvlziltltbalebqpmuqs.supabase.co`).
- **Anon Key** – `SUPABASE_ANON_KEY` (client-side requests once auth is enabled).
- **Service Role Key** – `SUPABASE_SERVICE_ROLE_KEY` (server-side only; keep out of client bundles). Stored locally in `.env` for now.
- **Local fallback** – prior local-stack variables remain commented in `.env` in case we need to bring back the on-device Supabase instance for offline work.
- **Runtime config** – GitHub Actions writes `frontend/static/env.js` with the production URL + anon key during deploy; the browser reads these values from `window.__BURKURSAS_CONFIG__` so the static bundle stays credentials-free.
- **Dashboard access** – global admin logs into https://app.supabase.com → project `burburiuok` → Database/Storage/Auth tabs. Only the owner account currently has admin rights; invite additional maintainers directly from the Supabase UI.
- **Impersonation toggle** – the learner shell uses the `impersonate=admin` query string to unlock inline editing. Local development requires `VITE_ENABLE_ADMIN_IMPERSONATION`/`ADMIN_DEV_IMPERSONATION` flags so Supabase RLS continues to guard real production sessions.

> Make sure `.env` is never committed. The repo `.gitignore` already excludes it.

### Key Rotation Checklist (2025-11-09 refresh)

1. In the Supabase Dashboard → Project Settings → API, rotate the anon and service role keys. Copy the new values immediately; the old keys are revoked once you navigate away.
2. Update local `.env`, GitHub Secrets (`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), and any deployment environments. Committers should restart local dev servers so the refreshed keys load.
3. Re-run schema grants for the service role: `grant usage on schema burburiuok to service_role;` followed by `grant select, insert, update, delete on all tables in schema burburiuok to service_role;` (repeat for future tables or define default privileges).
4. Validate connectivity with `node tests/checkSupabaseConnection.mjs`, then perform an admin draft save + publish attempt in the UI to confirm 201/400 responses and audit logging. GitHub Pages deploys now run a Supabase anon key smoke test, so a failed deploy is an early warning that Pages secrets are stale.
5. Clean up any test content inserted during validation, and log the rotation date in `docs/INFRASTRUCTURE.md` + this file. Target quarterly rotations unless incidents dictate otherwise.

## Database Layout (Current + Planned)

- **Database name/schema** – create a dedicated schema `burburiuok` in the shared instance to avoid collisions with other projects.
- **Tables (V1)**
  - `concepts` – canonical curriculum entries, including Lithuanian/English terms, curriculum alignment (`is_required`), and metadata.
    - Required entries trace directly to `docs/static_info/LBS_programa.md`; optional entries provide additional depth but are still surfaced by the same table.
    - The seed content is now generated from the master markdown source `docs/static_info/LBS_concepts_master.md`, parsed by `content/scripts/build_seed_sql.mjs` so there is a single editable artifact for content changes.
    - Columns `curriculum_node_code`, `curriculum_item_ordinal`, and `curriculum_item_label` link each concept back to the normalized curriculum hierarchy.
  - `concept_progress` – learned/quiz tracking per (anonymous) device or user token.
  - `curriculum_nodes` – hierarchical outline of the LBS curriculum (codes, titles, summaries, parent links, ordinals).
  - `curriculum_items` – bullet-point leaves (comma-separated items in the source curriculum) associated with their parent node.
- **Tables (in design)**
  - `curriculum_dependencies` – explicit mapping between concepts/nodes and their prerequisites (unblocks inline prerequisite drawers).
  - `content_versions` – draft/publish workflow with audit history (tracks who changed what and when).
  - `media_assets` – metadata for user-uploaded images, PDFs, audio files, and embedded videos (concept id, storage path, contributor id, moderation state).
  - `media_reviews` – queue of pending moderation decisions (approved/rejected, reviewer, timestamps).
  - `engagement_stats` – XP, streak, and badge counters (phase 3 roadmap).
  - `profiles` / `concept_notes` – remain on the roadmap for authenticated experiences and synced note taking.
- **Migrations** – once tooling is in place, manage via Supabase CLI (`supabase db diff`, `supabase db push`).
- **Current migrations** – `0001`–`0006` under `supabase/migrations/` create the schema, add views, introduce the curriculum hierarchy, extend concepts with curriculum linkage, and add prerequisite/content-version/media scaffolding.

### Data Exports & Validations

- `docs/static_info/LBS_concepts_master.md` is the authoritative content source. Any edits should flow through it, followed by regenerating `supabase/seeds/seed_concepts.sql` with `node content/scripts/build_seed_sql.mjs` (or `npm run content:seed:generate`).
- `content/raw/curriculum_structure.json` remains the canonical JSON source for curriculum nodes/items (structure + ordinals) consumed during seed generation.
- Run `node tests/exportCurriculumTree.mjs --format csv --out docs/static_info/curriculum_in_supabase.csv` to refresh the published curriculum snapshot used for doc reviews.
- Run `node tests/exportCurriculumTree.mjs` without arguments for a quick on-screen tree view that matches the seeded structure in Supabase.

## Storage Buckets (Planned)

- Create bucket `concept-images` with policies enforcing:
  - Max 4 images per user per concept.
  - File size/extension limits (e.g., JPEG/PNG under 5 MB).
  - Public read for approved assets, restricted write/delete to owners + moderators.
- Maintain separate folder structure for approved vs pending moderation (e.g., `pending/{conceptId}/{userId}/` and `approved/{conceptId}/`).
- Add additional buckets if needed (e.g., `concept-documents`, `concept-audio`). Keep moderation metadata in `media_assets` regardless of physical bucket.

## Auth Considerations

- Start with email magic links using Supabase Auth once V2 work begins.
- Link `profiles` table with row-level security (RLS) policies granting access only to the logged-in user.
- Enforce RLS on `concept_notes`, `concept_progress`, and `media_assets` so users can only view or edit their own drafts until moderation approves sharing.

## Local Development Workflow

1. Ensure you are logged into the Supabase CLI with a personal access token: `npx supabase login`.
2. Link the local repository to the hosted project (one-time per machine): `npx supabase link --project-ref zvlziltltbalebqpmuqs`.
3. Regenerate curriculum data prior to deployment:

- Update `docs/static_info/LBS_concepts_master.md` with any new or revised concepts.
- `npm run content:seed:curriculum` to rebuild `supabase/seeds/seed_curriculum.sql`.
- `npm run content:seed:generate` (wrapper for `node content/scripts/build_seed_sql.mjs`) to rebuild `supabase/seeds/seed_concepts.sql` directly from the master markdown.
- Optional sanity check: `node tests/exportCurriculumTree.mjs --format tree` to verify hierarchy output before seeding.

4. Push migrations and apply seeds in a single step: `npx supabase db push --include-seed`.
5. Keep `.env` up to date with the hosted project keys for local development servers (frontend/backend will consume `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and backend-only `SUPABASE_SERVICE_ROLE_KEY`). The SvelteKit dev server mirrors these values automatically, so no additional `frontend/.env` upkeep is required.
6. If you need to work offline, uncomment the local-stack variables in `.env`, run `npx supabase start`, and apply migrations with `npx supabase db push --local --include-seed`.

### Applying seeds via CLI

The Supabase CLI can run seeds when `--include-seed` is provided. Example workflows:

- **Hosted project**: `npx supabase db push --include-seed` (after linking), which applies migrations then executes every SQL file matching the `supabase/seeds/*.sql` glob.
- **Local stack**: `npx supabase db push --local --include-seed` after launching `supabase start`.
- Whenever the concept master file changes, re-run `npm run content:seed:generate` before invoking either workflow so Supabase receives the latest content.

If manual execution is ever required, open the Supabase web console → SQL Editor → run `supabase/seeds/seed_curriculum.sql` followed by `supabase/seeds/seed_concepts.sql`.

## Future Migration Plan

- When moving to hosted Supabase, create environment-specific `.env` files (`.env.development`, `.env.production`).
- Rotate anon/service keys and update GitHub Action secrets.
- Configure object storage CDN and image moderation tooling before enabling public media uploads.
- Add automated checks (edge functions or scheduled jobs) to scan pending uploads and notify moderators.
- Capture all schema evolution in migrations + documentation; update this reference whenever tables/policies change.
