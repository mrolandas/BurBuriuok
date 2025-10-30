# Supabase Reference

This document captures how BurBuriuok uses Supabase during early development (starting with V1) and how we expect to evolve the setup over time.

## Current Environment

- **Hosted project** – `burburiuok` on Supabase.com, project reference `zvlziltltbalebqpmuqs`.
- **API URL** – `SUPABASE_URL` in `.env` (currently `https://zvlziltltbalebqpmuqs.supabase.co`).
- **Anon Key** – `SUPABASE_ANON_KEY` (client-side requests once auth is enabled).
- **Service Role Key** – `SUPABASE_SERVICE_ROLE_KEY` (server-side only; keep out of client bundles). Stored locally in `.env` for now.
- **Local fallback** – prior local-stack variables remain commented in `.env` in case we need to bring back the on-device Supabase instance for offline work.

> Make sure `.env` is never committed. The repo `.gitignore` already excludes it.

## Database Layout (Draft)

- **Database name/schema** – create a dedicated schema `burburiuok` in the shared instance to avoid collisions with other projects.
- **Tables (V1)**
  - `concepts` – canonical curriculum entries, including Lithuanian/English terms and metadata.
  - `concept_progress` – learned/quiz tracking per (anonymous) device or user token.
- **Tables (V2+)**
  - `profiles` – user metadata tied to Supabase Auth users.
  - `concept_notes` – user-authored notes referencing curriculum concepts.
  - `media_assets` – metadata for user-uploaded images (concept id, storage path, owner, status, moderation fields, soft-delete markers).
- **Migrations** – once tooling is in place, manage via Supabase CLI (`supabase db diff`, `supabase db push`).
- **Current migration** – `supabase/migrations/0001_initial_schema.sql` creates the schema and V1 tables.

## Storage Buckets (Planned)

- Create bucket `concept-images` with policies enforcing:
  - Max 4 images per user per concept.
  - File size/extension limits (e.g., JPEG/PNG under 5 MB).
  - Public read for approved assets, restricted write/delete to owners + moderators.
- Maintain separate folder structure for approved vs pending moderation (e.g., `pending/{conceptId}/{userId}/` and `approved/{conceptId}/`).

## Auth Considerations

- Start with email magic links using Supabase Auth once V2 work begins.
- Link `profiles` table with row-level security (RLS) policies granting access only to the logged-in user.
- Enforce RLS on `concept_notes`, `concept_progress`, and `media_assets` so users can only view or edit their own drafts until moderation approves sharing.

## Local Development Workflow

1. Ensure you are logged into the Supabase CLI with a personal access token: `npx supabase login`.
2. From the repo root, push migrations to the hosted project: `npx supabase db push --project-ref zvlziltltbalebqpmuqs`.
3. Seed Section 1 concepts by running the generated SQL in the SQL editor or via CLI (see below).
4. Keep `.env` up to date with the hosted project keys for local development servers (frontend/backend will consume `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and backend-only `SUPABASE_SERVICE_ROLE_KEY`).
5. If you need to work offline, uncomment the local-stack variables in `.env`, run `npx supabase start`, and apply migrations with `npx supabase db push --local`.

### Applying seeds via CLI

Supabase CLI does not yet support direct seed execution against hosted projects. Options:

- Open the Supabase web console → SQL Editor → run `supabase/seeds/seed_concepts.sql`.
- Or provision a temporary local stack, run migrations + seeds locally, then export/import the data using `pg_dump`/`psql`.

## Future Migration Plan

- When moving to hosted Supabase, create environment-specific `.env` files (`.env.development`, `.env.production`).
- Rotate anon/service keys and update GitHub Action secrets.
- Configure object storage CDN and image moderation tooling before enabling public image uploads.
