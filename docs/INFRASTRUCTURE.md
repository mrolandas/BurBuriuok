# Infrastructure Overview

## Current State (V1)

> For per-layer manuals (backend, frontend, Supabase) refer to `docs/references/infrastructure/README.md`, which links to the detailed infrastructure documents.

- **Hosting** – SvelteKit frontend lives under `frontend/` (local dev via Vite) and ships as a static bundle on GitHub Pages (Pages workflow runs on pushes to `main` or `deploy/github-pages`). Adapter-static currently uses the repository base path `/BurBuriuok` (matching the GitHub Pages slug) while the product brand surfaces as BurKursas. A runtime `env.js` (written during CI) injects Supabase credentials for the browser. Legacy `first_draft/` prototype remains on GitHub Pages for archival reference. The workflow installs root dependencies ahead of the frontend build so shared validation modules under `shared/` resolve `zod` during bundling, and sets `VITE_ENABLE_ADMIN_IMPERSONATION=enabled` so the admin toggle remains active on the published site. Hosted admin requests now default to the Render backend (`https://burburiuok.onrender.com/api/v1/admin`) when the site runs on `github.io`.
- **Runtime** – Express backend under `backend/` exposes read/write curriculum + progress endpoints (`/api/v1/*`). The new SvelteKit UI consumes these routes; additional clients (CLI experiments, admin tools) can reuse the same surface. Admin sessions can now be impersonated from the learner shell via a guarded toggle in `AppShell` that syncs the `impersonate=admin` query parameter and the persisted `adminMode` store; hierarchy editing endpoints are not yet exposed. Admin concept saves now guard Supabase auth errors and wrap audit logging so publish failures return validation messages instead of 500s. Production traffic is handled by the Render deployment (`https://burburiuok.onrender.com`), while local development continues to run via `npm run backend:dev`.
- **Frontend slices** – Section board (`/`) lists top-level curriculum nodes, while `/sections/[code]` renders the collapsible curriculum tree with lazy Supabase fetches, prerequisite badges, and deep links into the new concept workspace. When admin mode is active, section cards expose inline edit controls that launch the shared modal for title/summary updates and persist changes via the admin curriculum node endpoint. The admin view of the tree now supports drag-and-drop reorder with a floating confirmation banner (cancel/apply), restores “Pridėti poskyrį” controls, auto-expands nodes for edit/delete confirmations, and clears pending highlights once changes persist. `/concepts/[slug]` hosts the LX-003 concept detail page (breadcrumbs, Lithuanian copy, disabled action buttons until LX-004/LX-005).
- **Data Storage** – Hosted Supabase project (`zvlziltltbalebqpmuqs`) for curriculum content, dependencies, concept progress, and audit logging (`content_versions`, `content_version_changes`). Migrations `0001`–`0010` in `supabase/migrations/` initialise the schema, add curriculum views, graft concept linkage, patch dependency constraints, persist rollback snapshots (`0009_db002_rollback_bundle.sql` applied remotely on 2025-11-13), and introduce `content_drafts` plus RLS policies protecting version/draft tables (`0010_db002_content_drafts_and_policies.sql`). Seeds stay in sync via the content scripts and `supabase/seeds/*`, while GitHub Actions emits `frontend/static/env.js` with production anon credentials during deploy.
- **Content Pipeline** – Curriculum concepts live in `docs/static_info/LBS_concepts_master.md` and are compiled into Supabase seed SQL via `content/scripts/build_seed_sql.mjs` + `content/scripts/build_dependency_seed_sql.mjs`. Seed generation now de-duplicates duplicate section/term pairs and `supabase/config.toml` pins the execution order (`seed_curriculum.sql` → `seed_concepts.sql` → `seed_curriculum_dependencies.sql`) so foreign-keyed inserts always succeed when applying seeds locally or remotely.
- **Integrations** – Supabase REST only; device-key header authenticates learner progress writes. Runtime Supabase URL/anon key are sourced from `window.__BURKURSAS_CONFIG__` so Pages builds remain static. No auth or storage buckets yet; media lives as external links referenced from concept content.
- **Codebase Layout** – `backend/`, `frontend/`, `data/`, `content/`, `docs/`, `supabase/`, and `first_draft/` (legacy prototype).

> **Development-only flags:** When impersonating the admin dashboard locally, enable `VITE_ENABLE_ADMIN_IMPERSONATION` in `frontend/.env.local` and `ADMIN_DEV_IMPERSONATION` in the repo root `.env`. Always clear these before committing or deploying to shared environments so production builds never expose the bypass. The AppShell toggle reads the same feature flags before exposing the UI affordance.

## Near-Term Improvements (Trimmed Launch)

- Ship hierarchy management for sections/subsections/concepts in both backend (CRUD + reparenting rules) and admin UI (drag/drop, promote/demote controls with optimistic feedback). _Frontend drag/drop reorder with confirmation banner is live; backend create/reparent safeguards remain._
- Introduce a backend event dispatcher stub that centralises admin save/publish actions and logs payloads, paving the way for Slack/email transports.
- Lock in learner progression shape by documenting current enums, adding history table if required, and exposing read/write guards in the API.
- Wrap frontend analytics hooks behind a shared `emitEvent` helper and ensure emitting points map to trimmed-scope interactions.
- Define media storage seam: bucket naming, metadata table, signed URL helper, and interim policy for external links.
- Automate backend deploy (e.g., Railway/Fly) or document manual steps so hierarchy updates can go live with the frontend release.
- Keep Supabase schema + seeds aligned by running `npm run content:seed:check` and `npx supabase db push --include-seed` before deploying hierarchy changes.
- Continue evolving API contract docs as endpoints expand (hierarchy endpoints, event dispatcher surface) and note seams for deferred features.

## Future State (V2)

- **Hosting** – Static frontend on GitHub Pages or Vercel; backend deployed to a managed platform (Railway, Fly.io, Supabase Edge Functions, or similar).
- **Backend** – Express (or Fastify) service exposing REST/GraphQL endpoints for notes, progress, media moderation, and AI assistant requests.
- **Database** – Supabase Postgres for user state, synchronized notes, and audit logs.
- **Object Storage** – Supabase Storage bucket for user-submitted images (limit 4 per user per concept) with lifecycle policies for pruning and archival.
- **AI Integration** – Connector to Ollama (self-hosted) or public inference APIs; requires authentication, rate limiting, and prompt logging.
- **Observability** – Minimal logging in V1, expanding to structured logs, uptime checks, and metrics dashboards in V2.
- **Practice & Engagement** – Queue synchronisation, study runner, spaced repetition scheduler, gamification metrics, and outbound notifications layered on the trimmed-scope seams.

## Security and Privacy Notes

- V1 stores data locally; emphasise that clearing browser data resets progress.
- V2 must implement authentication (email magic links or OAuth) and encrypted storage for personal notes.
- Plan content moderation for AI-generated explanations to avoid misinformation.
- Implement upload validation (file size/type), user quotas, and moderation tooling for community-submitted images.
- Enforce API rate limits and audit logging as defined in `docs/references/API_CONTRACTS.md` to keep operational risk low.

## Operational Checklist

- [ ] Decide on automated deployment trigger (push to `main`, release tags, or manual workflow).
- [ ] Choose hosting target for the Express backend ahead of trimmed launch (Railway/Fly/Render) and document rollback steps.
- [ ] Define backup and migration scripts for Supabase-managed content (regular exports, anonymised datasets).
- [ ] Evaluate CDN or caching strategy for serving approved imagery efficiently.
- [ ] Draft IaC or scripted setup for recreating Supabase schema, roles, and storage policies.
- [ ] Keep module READMEs and docs in sync with code changes (especially for AI coding agents).
- [ ] Automate execution of `supabase/migrations/` and `supabase/seeds/` via CI or release workflows.

## Supabase Key Rotation Notes

- 2025-11-09: Rotated both publishable (`SUPABASE_ANON_KEY`) and service-role (`SUPABASE_SERVICE_ROLE_KEY`) tokens in Supabase. Updated `.env`, GitHub Secrets, and CI configuration; refreshed `frontend/static/env.js` on the next GitHub Pages deploy.
- Re-granted `usage` on schema `burburiuok` to the service role (run `grant usage on schema burburiuok to service_role;` plus matching table privileges) so admin saves could access data after the rotation.
- Verified connectivity with `node tests/checkSupabaseConnection.mjs`, exercised draft concept saves (201), and confirmed publish attempts return validation messages (400) instead of 500s. Removed the temporary test concept via Supabase script post-validation.
- CI now runs a Supabase anon read smoke test during the GitHub Pages build; failed checks usually mean the Pages secrets are stale.
- Follow-up: expand `docs/references/infrastructure/SUPABASE.md` with the rotation checklist and schedule quarterly key reviews.
