# Frontend – BurBuriuok

SvelteKit powers the learner experience under `frontend/`. This README captures the essentials for running the app, wiring new slices, and understanding the shared utilities.

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

During development the app expects two environment variables (see `.env.example`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Create `frontend/.env`, copy the example values, and point them at the hosted or local Supabase instance. Missing keys trigger a console warning in dev.

## Available Scripts

Run these from the repository root (wrappers live in the top-level `package.json`):

- `npm run frontend:dev` – start the Vite dev server with hot module reload.
- `npm run frontend:build` – production build output under `frontend/build`.
- `npm run frontend:preview` – preview the production build locally.
- `npm run frontend:check` – `svelte-check` for type and Svelte diagnostics.
- `npm run frontend:lint` – Prettier + ESLint (includes navigation lint rule).
- `npm run frontend:format` – apply Prettier formatting to the frontend project.

## Project Structure

- `src/routes/+page.svelte` – Section board (LX-001) with Supabase-backed section cards.
- `src/routes/sections/[code]/` – Collapsible curriculum tree (LX-002) for individual sections.
- `src/lib/components/` – Shared UI, including `AppShell`, `PageHeading`, `Card`, and the recursive `CurriculumTree`.
- `src/lib/api/curriculum.ts` – Supabase helpers for curriculum nodes, items, and dependency counts.
- `src/lib/supabase/client.ts` – Browser-only Supabase client factory shared across routes.
- `src/lib/styles/global.css` – Theme tokens and global layout primitives.

Use the `$lib` alias for imports (e.g., `import { CurriculumTree } from '$lib';`). Shared types for curriculum utilities are exported from `src/lib/index.ts`.

## Navigation & Linting Notes

- Internal links must call `$app/paths.resolve()` before routing. The ESLint rule `svelte/no-navigation-without-resolve` enforces this and keeps adapters with a base path healthy.
- The curriculum tree emits a placeholder analytics event (`console.info`) the first time a node expands. Replace this with the real telemetry hook once the analytics pipeline is online.

## Next Steps

- LX-003 (concept detail view) will extend the current Supabase helpers with concept-level queries.
- Coordinate with the backend team before introducing new Supabase RPCs or stored procedures—document changes in `docs/references/FRONTEND.md`.
