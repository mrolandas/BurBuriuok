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

### Recent Updates (2025-11-13)

- Ran `npx supabase db push --include-seed` to apply migration `0009_db002_rollback_bundle.sql` on the hosted project; seeds remained current.
- Confirmed rollback snapshots populate by creating a concept bundle in the admin console and querying `content_versions` via REST (`Accept-Profile: burburiuok`, filter `snapshot=not.is.null`).
- Added migration `0010_db002_content_drafts_and_policies.sql` defining the `content_drafts` table, default triggers, and RLS policies for versioning tables. Apply via `npx supabase db push` (include `--include-seed` if seeds changed) before relying on draft persistence.
- Helper function `burburiuok.is_admin_session()` + policies (`content_versions_admin_manage`, etc.) now ensure only service-role or admin JWT sessions can access draft/version rows. Update Supabase Auth `app_role` claims before validating policies via the SQL editor.

### Recent Updates (2025-11-17)

- Locked the media MVP to admin-only uploads. Storage now relies on a single restricted bucket and a trimmed `media_assets` table (see below). Contributor submission + moderation tables remain deferred until MEDIA-003/004 revive.
- Scheduled blueprint docs (`SCHEMA_DECISIONS.md`, `API_CONTRACTS.md`, `ADMIN_SETUP.md`) were refreshed to reflect the admin-only scope; ensure migrations generated from this design omit the superseded moderation tables.

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
  - `media_assets` – metadata for admin-curated media (concept link, storage path, asset type, optional external url). Supersedes the earlier contributor workflow design; moderation tables are deferred until contributor uploads return.
  - `engagement_stats` – XP, streak, and badge counters (phase 3 roadmap).
  - `profiles` / `concept_notes` – remain on the roadmap for authenticated experiences and synced note taking.
- **Migrations** – once tooling is in place, manage via Supabase CLI (`supabase db diff`, `supabase db push`).
- **Current migrations** – `0001`–`0006` under `supabase/migrations/` create the schema, add views, introduce the curriculum hierarchy, extend concepts with curriculum linkage, and add prerequisite/content-version/media scaffolding.

### Data Exports & Validations

- `docs/static_info/LBS_concepts_master.md` is the authoritative content source. Any edits should flow through it, followed by regenerating `supabase/seeds/seed_concepts.sql` with `node content/scripts/build_seed_sql.mjs` (or `npm run content:seed:generate`).
- `content/raw/curriculum_structure.json` remains the canonical JSON source for curriculum nodes/items (structure + ordinals) consumed during seed generation.
- Run `node tests/exportCurriculumTree.mjs --format csv --out docs/static_info/curriculum_in_supabase.csv` to refresh the published curriculum snapshot used for doc reviews.
- Run `node tests/exportCurriculumTree.mjs` without arguments for a quick on-screen tree view that matches the seeded structure in Supabase.

## Storage Bucket – Admin Media MVP (2025-11-17)

- Create bucket `media-admin` in Supabase Storage.
  - **Write access**: admins/service-role only via Supabase policies (`burburiuok.is_admin_session()` guard).
  - **Read access**: deny public reads by default; expose assets via time-limited signed URLs generated by the backend.
  - **Structure**: `concept/{conceptId}/<uuid>.<ext>` (image/video). Keep variants alongside originals (e.g., `concept/<id>/<assetId>.jpg` and `concept/<id>/<assetId>_thumb.jpg`).
- File limits: accept `image/*` and `video/mp4` up to 50 MB. Enforce via backend validation + storage policy metadata checks (`storage.objects.metadata->>size`).
- Lifecycle: no automatic cleanup required for MVP; add quarterly review reminder in `INFRASTRUCTURE.md` to evaluate storage growth and archival needs.
- Future contributor flow: when MEDIA-003 restarts, either introduce a `media-contributor` bucket or extend this one with additional folders + RLS policies. Document revisit in the backlog.

#### Rollout Checklist (MEDIA-001)

1. **Create bucket** – Supabase Dashboard → Storage → `+ New bucket` → name `media-admin`, keep visibility `Private`.
2. **Grant bucket policies** – SQL editor (`storage_policies.sql` scratchpad or CLI):
   ```sql
   begin;
   revoke all on storage.objects from public;
   create policy "Allow admin uploads" on storage.objects for insert using (
     bucket_id = 'media-admin' and burburiuok.is_admin_session()
   );
   create policy "Allow admin updates" on storage.objects for update using (
     bucket_id = 'media-admin' and burburiuok.is_admin_session()
   );
   create policy "Allow admin deletes" on storage.objects for delete using (
     bucket_id = 'media-admin' and burburiuok.is_admin_session()
   );
   commit;
   ```
3. **Register migration** – Apply the MEDIA-001 SQL to hosted project (`npx supabase db push --include-seed`). Completed on 2025-11-18 with `0011_media_admin_mvp.sql`.
4. **Verify access** – Using service-role key, insert a test asset metadata row; ensure learner JWTs receive 403 from Supabase REST. Automate via `npm run test:media001`.
5. **Clean test data** – Delete placeholder object/row and note completion in session log.

#### Rollback Steps

- Drop bucket via Dashboard (Storage → `media-admin` → Delete) after confirming no production assets need retention.
- Revoke bucket policies with `drop policy if exists ... on storage.objects` for the admin rules.
- Re-run schema rollback (`drop table / drop type`) if the migration must be reversed (see `docs/references/SCHEMA_DECISIONS.md`).

## Auth Considerations

- Start with email magic links using Supabase Auth once V2 work begins.
- Link `profiles` table with row-level security (RLS) policies granting access only to the logged-in user.
- Enforce RLS on `concept_notes` and `concept_progress` for learner scope. `media_assets` remains admin-only during the media MVP; expand policies to learners/contributors once uploads reopen beyond admins.

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
