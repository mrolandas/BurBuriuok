# Development Setup

This document keeps the development environment expectations in one place. Update it whenever tooling changes so human contributors and AI assistants stay in sync. For Supabase-specific details, see `docs/references/SUPABASE.md`.

## Repository Layout (Scaffold)

- `frontend/` – SvelteKit app (routes, components, stores, styles).
- `backend/` – Express API service (controllers, services, validation, middlewares).
- `data/` – Supabase client wrapper, repositories, shared data contracts.
- `content/` – Curriculum seed data, CSV/JSON imports, transformation scripts.
- `infra/` – Deployment scripts, Supabase migrations, automation tooling.
- `docs/` – Project documentation (this folder).
- `first_draft/` – Legacy prototype kept for reference.

## System Requirements

- Linux, macOS, or WSL2 on Windows.
- Node.js 20 LTS (use `nvm` or `asdf` to manage versions).
- npm 10+ (bundled with Node 20).
- Git 2.40+.
- Supabase CLI (install once backend storage and image uploads are introduced in V2).
- GitHub CLI `gh` (used for creating/backfilling sprint issues).

## Core Dependencies (install once project tooling is initialised)

- `@supabase/supabase-js`
- `@types/node`
- `typescript`
- `ts-node` / `tsx` for running TypeScript in development
- `express`, `cors` for the backend HTTP layer
- `zod` (or another schema validator) for data checks in content tooling

## Project Bootstrap

1. Clone the repository: `git clone https://github.com/mrolandas/BurBuriuok.git`.
2. Switch into the project directory: `cd BurBuriuok`.
3. Copy `.env.example` (when available) to `.env` and update Supabase credentials if needed. Current local keys live in `.env` (not versioned).
4. Install dependencies (placeholder until the SvelteKit/Express scaffold lands): `npm install`.
5. Update the canonical concept source `docs/static_info/LBS_concepts_master.md` only when content changes are required, then regenerate Supabase seeds with `npm run content:seed:generate` before pushing.
6. Start the development servers:
   - `npm run dev:frontend` – launch SvelteKit in development mode. _(stub; scaffold pending)_
   - `npm run backend:dev` – launch the Express API locally with hot reload via `tsx`.
   - `npm run backend:start` – run the backend once without watch mode.
   - `npm run dev` – _(optional)_ configure a concurrent runner when the frontend scaffold exists.

> Backend scripts require `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (or anon key for read-only) in `.env` so the shared `data/` repositories can connect.

## Coding Standards

- TypeScript preferred for new application code (frontend and backend).
- ESLint + Prettier baseline (rules TBD).
- Keep UI strings in Lithuanian; internal identifiers and comments in English.

## Reference Guides

- `docs/references/API_CONTRACTS.md` – REST surface, validation rules, rate limits, and persona-level access expectations.
- `docs/references/ADMIN_DASHBOARD.md` – admin flows, moderation tasks, and analytics widgets that engineering must support.
- `docs/references/UX_MOBILE_WIREFRAMES.md` – prioritized mobile-first layouts and interaction patterns.
- `docs/references/GAMIFICATION_MODEL.md` – XP/streak/badge data contracts and event triggers.
- `docs/references/STUDY_PATHS.md` – curated learner journeys, unlock criteria, and backlog items.
- `docs/references/PERSONAS_PERMISSIONS.md` – persona matrix with role bindings and Supabase RLS considerations.
- `docs/references/ISSUE_TRACKER.md` – pre-scoped engineering tickets ready to be converted into GitHub issues (status tracked per workstream).

## Helpful Utilities

- `npm run lint` – static analysis (to be configured).
- `npm run test` – run automated tests (see `docs/TESTING_GUIDE.md`).
- `npm run build` – production build for deployment.
- `npm run backend:typecheck` – TypeScript compile check for `backend/`.
- `npm run backend:dev` / `npm run backend:start` – convenience commands for the Express service.
- `supabase start` / `supabase status` – manage local Supabase services when working on authenticated features or image storage flows (available post-V2 scaffolding).
- `npm run content:seed:curriculum` – regenerate the normalized curriculum hierarchy seed (`supabase/seeds/seed_curriculum.sql`).
- `npm run content:seed:generate` – regenerate concept seeds from `docs/static_info/LBS_concepts_master.md` via `content/scripts/build_seed_sql.mjs` (script annotates each concept with `is_required` and curriculum linkage metadata).
- `npm run content:seed:dependencies` – regenerate `supabase/seeds/seed_curriculum_dependencies.sql` from `content/raw/curriculum_dependencies.json`.
- `node content/scripts/extract_prototype_content.mjs` – rebuild JSON datasets from `first_draft/index.html` before regenerating seeds.
- `gh issue list --state open` – quick snapshot of Build Sprint 1 backlog (#1-#8).
- `gh issue create --title "<id>: <summary>" --body-file <path>` – open new work items while keeping Issue Tracker entries in sync.

### Supabase local push (developer note)

When your Supabase instance is running on a sibling WSL machine or a local stack, prefer the local push command which targets the local instance rather than a remote project. Example:

```bash
# apply migrations to the local Supabase instance
npx supabase db push --local

# optionally run a seed SQL file (run inside Supabase Studio or via CLI depending on setup)
# e.g., open the SQL editor at http://127.0.0.1:54323 or run an appropriate `supabase` CLI command
```

Notes:

- `--local` is useful when the developer machine is not authenticated against a hosted Supabase project and you are applying migrations to a local stack.
- If your local Supabase CLI setup uses different flags or a `remote` target, adapt the command accordingly (for example, `npx supabase db push --project-ref <ref>` for remote pushes).
- Always review migrations and backups before applying them to any shared instance. See `docs/references/SUPABASE.md` for details about the hosted project and the canonical migration files under `supabase/migrations/`.

### Supabase hosted push

We maintain a hosted project `burburiuok` (ref `zvlziltltbalebqpmuqs`). After logging into the Supabase CLI (`npx supabase login`), link the local repository once per machine and then push migrations plus seeds:

```bash
npx supabase link --project-ref zvlziltltbalebqpmuqs
npx supabase db push --include-seed
```

The `--include-seed` flag applies `supabase/seeds/seed_curriculum.sql`, `supabase/seeds/seed_concepts.sql`, and `supabase/seeds/seed_curriculum_dependencies.sql` immediately after migrations so the hosted database always mirrors the generated content. Re-run the content scripts before pushing whenever curriculum data changes.

> Store your Supabase CLI access token outside of `.env` (for example, run `supabase login --token <value>` or export `SUPABASE_ACCESS_TOKEN` in your shell session). Avoid committing the token to the repository.

## AI Assistant Guidance

- Respect this document for shell command expectations.
- When uncertain about a command, describe the intention in the PR or task notes so the team can confirm.
