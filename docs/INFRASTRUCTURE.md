# Infrastructure Overview

## Current State (V1)

- **Hosting** – SvelteKit frontend lives under `frontend/` (local dev via Vite) and uses `$app/paths.resolve` for internal navigation so adapters with a base path stay healthy; production hosting target still tbd. Legacy `first_draft/` prototype remains on GitHub Pages for archival reference.
- **Runtime** – Express backend under `backend/` exposes read/write curriculum + progress endpoints (`/api/v1/*`). The new SvelteKit UI consumes these routes; additional clients (CLI experiments, admin tools) can reuse the same surface.
- **Frontend slices** – Section board (`/`) lists top-level curriculum nodes, while `/sections/[code]` renders the collapsible curriculum tree with lazy Supabase fetches, prerequisite badges, and deep links into the new concept workspace. `/concepts/[slug]` hosts the LX-003 concept detail page (breadcrumbs, Lithuanian copy, disabled action buttons until LX-004/LX-005).
- **Data Storage** – Hosted Supabase project (`zvlziltltbalebqpmuqs`) for curriculum content, dependencies, concept progress, and audit logging (`content_versions`, `content_version_changes`). Seeds stay in sync via the content scripts and `supabase/seeds/*`.
- **Content Pipeline** – Curriculum concepts live in `docs/static_info/LBS_concepts_master.md` and are compiled into Supabase seed SQL via `content/scripts/build_seed_sql.mjs` + `content/scripts/build_dependency_seed_sql.mjs`.
- **Integrations** – Supabase REST only; device-key header authenticates learner progress writes. No auth or storage buckets yet.
- **Codebase Layout** – `backend/`, `frontend/`, `data/`, `content/`, `docs/`, `supabase/`, and `first_draft/` (legacy prototype).

## Near-Term Improvements

- Automate backend deploy (GitHub Actions or Railway) once backend reaches MVP stability.
- Add build pipeline for the SvelteKit frontend and capture deployment target decision.
- Keep Supabase schema + seeds aligned by running `npm run content:seed:check` and `npx supabase db push --include-seed` before deploying.
- Document service credentials (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`) and rotate policies once auth is introduced.
- Publish per-module READMEs for `backend/` and `data/` to help AI agents/local developers navigate responsibilities.
- Continue evolving API contract docs as endpoints expand (progress, admin audit logging already live).

## Future State (V2)

- **Hosting** – Static frontend on GitHub Pages or Vercel; backend deployed to a managed platform (Railway, Fly.io, Supabase Edge Functions, or similar).
- **Backend** – Express (or Fastify) service exposing REST/GraphQL endpoints for notes, progress, media moderation, and AI assistant requests.
- **Database** – Supabase Postgres for user state, synchronized notes, and audit logs.
- **Object Storage** – Supabase Storage bucket for user-submitted images (limit 4 per user per concept) with lifecycle policies for pruning and archival.
- **AI Integration** – Connector to Ollama (self-hosted) or public inference APIs; requires authentication, rate limiting, and prompt logging.
- **Observability** – Minimal logging in V1, expanding to structured logs, uptime checks, and metrics dashboards in V2.

## Security and Privacy Notes

- V1 stores data locally; emphasise that clearing browser data resets progress.
- V2 must implement authentication (email magic links or OAuth) and encrypted storage for personal notes.
- Plan content moderation for AI-generated explanations to avoid misinformation.
- Implement upload validation (file size/type), user quotas, and moderation tooling for community-submitted images.
- Enforce API rate limits and audit logging as defined in `docs/references/API_CONTRACTS.md` to keep operational risk low.

## Operational Checklist

- [ ] Decide on automated deployment trigger (push to `main`, release tags, or manual workflow).
- [ ] Choose hosting target for the Express backend ahead of V2 work.
- [ ] Define backup and migration scripts for Supabase-managed content (regular exports, anonymised datasets).
- [ ] Evaluate CDN or caching strategy for serving approved imagery efficiently.
- [ ] Draft IaC or scripted setup for recreating Supabase schema, roles, and storage policies.
- [ ] Keep module READMEs and docs in sync with code changes (especially for AI coding agents).
- [ ] Automate execution of `supabase/migrations/` and `supabase/seeds/` via CI or release workflows.
