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

## Core Dependencies (install once project tooling is initialised)

- `@supabase/supabase-js`
- `@types/node`
- `typescript`
- `ts-node` (or the chosen build tooling for running scripts)
- `zod` (or another schema validator) for data checks in content tooling

## Project Bootstrap

1. Clone the repository: `git clone https://github.com/mrolandas/BurBuriuok.git`.
2. Switch into the project directory: `cd BurBuriuok`.
3. Copy `.env.example` (when available) to `.env` and update Supabase credentials if needed. Current local keys live in `.env` (not versioned).
4. Install dependencies (placeholder until the SvelteKit/Express scaffold lands): `npm install`.
5. Start the development servers (to be defined once the scaffold is ready). Expected commands:
   - `npm run dev:frontend` – launch SvelteKit in development mode.
   - `npm run dev:backend` – launch the Express API locally.
   - `npm run dev` – run both via a concurrent script.

> Update the command list as soon as the actual scripts exist in `package.json`.

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

## Helpful Utilities

- `npm run lint` – static analysis (to be configured).
- `npm run test` – run automated tests (see `docs/TESTING_GUIDE.md`).
- `npm run build` – production build for deployment.
- `supabase start` / `supabase status` – manage local Supabase services when working on authenticated features or image storage flows (available post-V2 scaffolding).
- `npm run content:seed:curriculum` – regenerate the normalized curriculum hierarchy seed (`supabase/seeds/seed_curriculum.sql`).
- `node content/scripts/build_seed_sql.mjs` – regenerate SQL seed files from raw JSON before seeding (script annotates each concept with `is_required` so we can surface curriculum-mandatory content in the apps).
- `node content/scripts/extract_prototype_content.mjs` – rebuild JSON datasets from `first_draft/index.html` before regenerating seeds.

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

The `--include-seed` flag applies `supabase/seeds/seed_curriculum.sql` and `supabase/seeds/seed_concepts.sql` immediately after migrations so the hosted database always mirrors the generated content. Re-run the content scripts before pushing whenever curriculum data changes.

> Store your Supabase CLI access token outside of `.env` (for example, run `supabase login --token <value>` or export `SUPABASE_ACCESS_TOKEN` in your shell session). Avoid committing the token to the repository.

## AI Assistant Guidance

- Respect this document for shell command expectations.
- When uncertain about a command, describe the intention in the PR or task notes so the team can confirm.
