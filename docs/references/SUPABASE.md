# Supabase Reference

This document captures how BurBuriuok uses the shared local Supabase stack during early development (starting with V1) and how we expect to evolve toward hosted Supabase later.

## Current Environment

- **Instance** – Local Supabase stack running on a sibling WSL machine, reachable at `http://127.0.0.1:54321`.
- **API URL** – `SUPABASE_URL` in the project `.env` file (currently `http://127.0.0.1:54321`).
- **Anon Key** – `SUPABASE_ANON_KEY` (for client-side authenticated requests once we enable Supabase Auth).
- **Service Role Key** – `SUPABASE_SERVICE_ROLE_KEY` (server-side only; keep out of client bundles). Stored locally in `.env` for now.

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
- **Current migration** – `infra/supabase/migrations/0001_initial_schema.sql` creates the schema and V1 tables.

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

1. Ensure the shared Supabase stack is running (`supabase start`) on the sibling WSL machine.
2. Export or share the `.env` file with the current URL and keys.
3. Run frontend/backend dev servers; they will consume `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and (for backend only) `SUPABASE_SERVICE_ROLE_KEY`.
4. Use Supabase Studio (`http://127.0.0.1:54323`) or `supabase db push` to apply migrations (starting with `0001_initial_schema.sql`) and materialise `concepts`/`concept_progress` tables.
5. Seed Section 1 concepts with `supabase db remote commit --file infra/supabase/seeds/seed_concepts.sql` or run the SQL snippet manually in Supabase Studio.

## Future Migration Plan

- When moving to hosted Supabase, create environment-specific `.env` files (`.env.development`, `.env.production`).
- Rotate anon/service keys and update GitHub Action secrets.
- Configure object storage CDN and image moderation tooling before enabling public image uploads.
