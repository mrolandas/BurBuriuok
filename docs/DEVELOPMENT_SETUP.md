# Development Setup

This document keeps the development environment expectations in one place. Update it whenever tooling changes so human contributors and AI assistants stay in sync. For Supabase-specific details, see `docs/references/infrastructure/SUPABASE.md`.

## Repository Layout

- `backend/` – Express API service (routes, middleware, services, validation, rate limiting).
- `frontend/` – SvelteKit learner experience shell (Workstream B). Admin concept tooling now lives under `src/routes/admin/concepts/`, with extracted UI modules (`components/ConceptFilters.svelte`, `ConceptList.svelte`, `ConceptEditorDrawer.svelte`) and shared types in `types.ts`.
- `data/` – Supabase client wrapper, repositories, and shared type definitions.
- `content/` – Curriculum seed data, CSV/JSON imports, transformation scripts.
- `docs/` – Project documentation (this folder).
- `shared/` – Cross-cutting TypeScript utilities (currently admin validation schemas shared by frontend and backend).
- `supabase/` – Managed migrations and generated seed SQL kept in sync with Supabase.
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
3. Copy `.env.example` (when available) to `.env` and update Supabase credentials if needed. The repo root `.env` continues to store Supabase URL/keys for backend scripts; the frontend dev server now mirrors those values automatically, so you do not need to maintain a separate `frontend/.env` unless you want overrides. Add the magic-link auth settings while editing `.env`:
   - `AUTH_REDIRECT_URL` – absolute URL to `/auth/callback` (e.g., `http://localhost:5173/auth/callback` in dev, `https://mrolandas.github.io/BurBuriuok/auth/callback` in production).
   - `AUTH_EMAIL_FROM` – friendly From header surfaced in auth emails (e.g., `BurKursas <noreply@burkursas.lt>`).
4. Install dependencies: `npm install`.
5. Update the canonical concept source `docs/static_info/LBS_concepts_master.md` only when content changes are required, then regenerate Supabase seeds with `npm run content:seed:generate` and `npm run content:seed:dependencies`; run `npm run content:seed:check` before pushing.
6. Start local services when needed:
   - `npm run backend:dev` – run the Express API locally with hot reload via `tsx`.
   - `npm run backend:start` – run the backend once without watch mode for smoke testing.
   - `npm run frontend:dev` – launch the SvelteKit learner experience shell (Vite dev server). Supabase URL/anon key are loaded from the repo root `.env`, keeping local preview identical to production credentials.
   - When testing admin layouts without Supabase auth, set `VITE_ENABLE_ADMIN_IMPERSONATION=true` in `frontend/.env.local` (or shell) and `ADMIN_DEV_IMPERSONATION=true` in the repo root `.env`, then append `?impersonate=admin` to `/admin` routes. Remove or disable both flags before committing or deploying so the bypass never ships upstream. With the flags enabled, the AppShell menu shows the persistent "Aktyvuoti Admin" toggle that flips the global `adminMode` store and syncs the impersonation query parameter on navigation.
   - Override the admin API base when the Express server is hosted externally by exporting `VITE_ADMIN_API_BASE` (defaults to `/api/admin`). GitHub Pages deployments **must** set this so admin actions call the hosted backend instead of the static site origin.

> Backend scripts require `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (or anon key for read-only) in `.env` so the shared `data/` repositories can connect.

## Coding Standards

- TypeScript preferred for new application code (frontend and backend).
- ESLint + Prettier baseline (rules TBD).
- Keep UI strings in Lithuanian; internal identifiers and comments in English.
- In SvelteKit components, wrap internal `href` values with `$app/paths.resolve(...)` so lint (`svelte/no-navigation-without-resolve`) stays green and base paths work across adapters. When modifying the concept manager, update the extracted components (`ConceptFilters`, `ConceptList`, `ConceptEditorDrawer`) instead of re-introducing inline markup in `ConceptManager.svelte`—keep orchestration/business logic in the route file and presentation in the component folder.
- Close the loop on GitHub issues: leave a status comment and close the ticket when a slice merges so the tracker stays accurate.

## Reference Guides

- `docs/references/API_CONTRACTS.md` – REST surface, validation rules, rate limits, and persona-level access expectations.
- `docs/references/infrastructure/BACKEND.md` – Express service layout, admin endpoints, shared validation helpers, and audit logging guidance.
- `docs/references/infrastructure/FRONTEND.md` – SvelteKit architecture overview, navigation rules, and frontend-specific workflows.
- `docs/references/features/implemented/ADMIN_SETUP.md` – admin flows, impersonation toggle behaviour, moderation tasks, and analytics widgets that engineering must support.
- `docs/references/UX_MOBILE_WIREFRAMES.md` – prioritized mobile-first layouts and interaction patterns.
- `docs/references/features/ideas/GAMIFICATION_MODEL.md` – XP/streak/badge data contracts and event triggers.
- `docs/references/features/ideas/STUDY_PATHS.md` – curated learner journeys, unlock criteria, and backlog items.
- `docs/references/PERSONAS_PERMISSIONS.md` – persona matrix with role bindings and Supabase RLS considerations.
- `docs/references/ISSUE_TRACKER.md` – pre-scoped engineering tickets ready to be converted into GitHub issues (status tracked per workstream).

## Helpful Utilities

- `npm run backend:dev` / `npm run backend:start` – run the Express API locally (watch / single-run).
- `npm run backend:typecheck` – TypeScript compile check scoped to the backend project.
- `npm run frontend:dev` – start the SvelteKit dev server.
- `npm run frontend:build` / `npm run frontend:preview` – production build & preview for the learner UI.
- `npm run frontend:check` / `npm run frontend:lint` / `npm run frontend:format` – convenience wrappers for SvelteKit check, lint, and formatting.
- `npm run test` / `npm run test:supabase` – Supabase connectivity smoke test.
- `npm run test:concepts` – focused unit test for concept row mapping.
- `npm run test:db002` – DB-002 draft/publish smoke test; run before shipping migrations/policy changes or after rotating Supabase keys.
- `npm run content:seed:generate` – regenerate concept seeds from the canonical markdown.
- `npm run content:seed:dependencies` – rebuild the curriculum dependency seed SQL.
- `npm run content:seed:curriculum` – rebuild the curriculum hierarchy seed when nodes change.
- `npm run content:seed:check` – guard script run locally (and via Husky/CI) to confirm seeds are fresh.
- `npm run content:snapshot:check` – refresh `docs/static_info/curriculum_in_supabase.csv` and fail on drift.
- `npm run content:markdown:validate` – ensure the markdown master file stays well-formed.
- `node content/scripts/extract_prototype_content.mjs` – regenerate JSON snapshots from the legacy prototype when needed.
- `gh issue list --state open` / `gh issue create ...` – manage Build Sprint 1 backlog.

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
- Always review migrations and backups before applying them to any shared instance. See `docs/references/infrastructure/SUPABASE.md` for details about the hosted project and the canonical migration files under `supabase/migrations/`.

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
