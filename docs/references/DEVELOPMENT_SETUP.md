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

## Helpful Utilities

- `npm run lint` – static analysis (to be configured).
- `npm run test` – run automated tests (see `docs/TESTING_GUIDE.md`).
- `npm run build` – production build for deployment.
- `supabase start` / `supabase status` – manage local Supabase services when working on authenticated features or image storage flows (available post-V2 scaffolding).
- `node content/scripts/build_seed_sql.mjs` – regenerate SQL seed files from raw JSON before seeding.

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

We maintain a hosted project `burburiuok` (ref `zvlziltltbalebqpmuqs`). After logging into the Supabase CLI (`npx supabase login`), run:

```bash
npx supabase db push --project-ref zvlziltltbalebqpmuqs
```

This applies the migrations in `supabase/migrations/` to the hosted database. Execute seeds through the Supabase SQL editor or the workflow described in `docs/references/SUPABASE.md`.

> Store your Supabase CLI access token outside of `.env` (for example, run `supabase login --token <value>` or export `SUPABASE_ACCESS_TOKEN` in your shell session). Avoid committing the token to the repository.

## AI Assistant Guidance

- Respect this document for shell command expectations.
- When uncertain about a command, describe the intention in the PR or task notes so the team can confirm.
