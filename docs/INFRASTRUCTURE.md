# Infrastructure Overview

## Current State (V1)

- **Hosting** – GitHub Pages (static deployment from the `main` branch or a dedicated `gh-pages` branch once the build pipeline exists).
- **Runtime** – Static frontend consuming Supabase REST endpoints; no custom server-side runtime yet.
- **Data Storage** – Supabase (shared local instance) for curriculum content and progress data, browser storage for lightweight caches and notes.
- **Integrations** – Supabase REST/Realtime endpoints only (no auth, no storage bucket yet).
- **Codebase Layout** – Modular filesystem: `frontend/` (SvelteKit UI), `backend/` (Express API-to-be), `data/` (Supabase client + repositories), `content/` (curriculum seed files), `infra/` (deployment scripts and migrations).

## Near-Term Improvements

- Establish automated build and deploy workflow (GitHub Actions) once the SvelteKit frontend is scaffolded.
- Define content build steps to transform source JSON/Markdown into consumable bundles.
- Document environment variables needed for local development and future services.
- Connect to the shared local Supabase instance (see `docs/references/SUPABASE.md`) while modelling the migration path to hosted Supabase.
- Add per-module READMEs describing responsibilities and public interfaces for AI-friendly navigation.
- Introduce Supabase migrations and seed scripts under `infra/` to keep schema changes deterministic.

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

## Operational Checklist

- [ ] Decide on automated deployment trigger (push to `main`, release tags, or manual workflow).
- [ ] Choose hosting target for the Express backend ahead of V2 work.
- [ ] Define backup and migration scripts for Supabase-managed content (regular exports, anonymised datasets).
- [ ] Evaluate CDN or caching strategy for serving approved imagery efficiently.
- [ ] Draft IaC or scripted setup for recreating Supabase schema, roles, and storage policies.
- [ ] Keep module READMEs and docs in sync with code changes (especially for AI coding agents).
- [ ] Automate execution of `infra/supabase/migrations/` and `infra/supabase/seeds/` via CI or release workflows.
