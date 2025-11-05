# Frontend Overview

The SvelteKit app under `frontend/` delivers the learner experience and consumes Supabase for data. Use this document as the starting point for architecture decisions, development workflows, and references to deeper documentation.

## Architecture Snapshot

- **Framework** – SvelteKit with TypeScript and Vite (Node 20 target).
- **Routing** – File-based routes under `src/routes`. The root `+page.svelte` renders the LX-001 “Skilčių lenta” board; `src/routes/sections/[code]/+page.svelte` hosts the LX-002 collapsible curriculum tree; `src/routes/concepts/[slug]/+page.svelte` delivers the LX-003 concept detail workspace.
- **Data Loading** – Page-level `+page.ts` files use `getSupabaseClient()` (SSR disabled) to query public Supabase views `burburiuok_curriculum_nodes`, `burburiuok_curriculum_items`, and `burburiuok_concepts`. The tree route lazy-loads child nodes/items when a branch expands and enriches items with concept slugs for deep links.
- **Layouts** – `src/routes/+layout.svelte` wires global styles and the shared `AppShell` component.
- **Shared UI** – Components live in `src/lib/components/`. Core pieces include `AppShell`, `PageHeading`, `Card`, the recursive `CurriculumTree` + `CurriculumTreeBranch` pair (now emitting concept links and required badges), and `ConceptDetail` for the LX-003 workspace shell.
- **State & Data** – Supabase client utilities sit in `src/lib/supabase/`. Import helpers from there rather than creating ad-hoc clients.
- **Styling** – Global CSS and theme tokens reside in `src/lib/styles/global.css`. Co-locate component styles using `<style>` blocks inside Svelte files when needed.

## Environment Configuration

Populate the following variables in `frontend/.env.example` and copy to a local `.env` file when running the app:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Values propagate via `src/lib/config/appConfig.ts` and are consumed by the Supabase client helper. Development builds log a warning if the values are missing to help contributors spot misconfiguration early.

## Navigation Guidelines

- Always wrap internal `href` values with `$app/paths.resolve(...)`. This keeps ESLint (`svelte/no-navigation-without-resolve`) satisfied and supports adapters that mount the app under a base path.
- Prefer the default anchor behaviour for client-side routing. Use `goto` sparingly and only after calling `resolve()` first.

## Commands

Run all commands from the repository root:

- `npm run frontend:dev` – start Vite dev server with hot module reloading.
- `npm run frontend:build` / `npm run frontend:preview` – create a production build and preview it locally.
- `npm run frontend:check` – run `svelte-check` for type safety and lint-like diagnostics.
- `npm run frontend:lint` – execute Prettier plus ESLint (includes the navigation rule above).
- `npm run frontend:format` – apply Prettier formatting across the frontend project.

## Coding Standards

- Write components in TypeScript (`<script lang="ts">`).
- Co-locate stories or example usage in dedicated routes rather than inside the component tree.
- Re-export shared modules through `src/lib/index.ts` when they should be consumed outside the app (e.g., future package extraction).
- Keep learner-facing copy in Lithuanian; comments and internal identifiers remain in English.
- Preserve Lithuanian terminology (“skiltis”, “Skilčių lenta”) when adding new UI or logging strings; audit new components before review.
- Ensure new learner flows (concept actions, study queue) wire through existing helpers instead of embedding Supabase queries directly in components.

## Supabase Usage

- Import `getSupabaseClient` from `src/lib/supabase/client.ts` to create a browser client.
- Treat Supabase calls as asynchronous; colocate data fetching in page `load` functions or use SvelteKit server endpoints when server-side logic is required.
- Record schema and API changes in `docs/references/SUPABASE.md` and update seeds via the scripts documented in `docs/references/DEVELOPMENT_SETUP.md`.
- Use the helpers in `src/lib/api/curriculum.ts` (`fetchChildNodes`, `fetchNodeItems`) for curriculum navigation to keep prerequisite counts and ordering logic consistent. `fetchNodeItems` now enriches list entries with concept slugs/flags so the tree can link into the LX-003 view. Prerequisite badges currently fall back to zero counts until a public dependency view is introduced; the helper logs a warning when the fallback triggers.
- Use `src/lib/api/concepts.ts::fetchConceptBySlug` when loading concept detail routes to avoid duplicating Supabase queries.

## Testing & Quality

- `frontend/src/app.d.ts` defines project-level ambient types. Extend this file when adding custom stores or app-wide types.
- Add component-level tests (Playwright or Vitest) as the UI grows. Placeholder guidance will live in this document once tooling is decided.

## Roadmap Notes

- LX-001 Section Board now serves as the pattern reference for Supabase-driven pages (client-side load, retries, progress placeholders).
- LX-002 Collapsible Tree introduces lazy-loaded branches, prerequisite badges, and a placeholder analytics event (`console.info` on first expand). Replace with the real telemetry client once analytics is wired up. Tree leaf items now open concept detail pages when a slug is available and tag required topics inline.
- LX-003 Concept Detail provides the learner workspace with breadcrumbs, Lithuanian copy, peer-topic suggestions, and disabled action buttons awaiting LX-004/LX-005 integrations.
- Document any global stores, layout hierarchy changes, or design system additions here so new contributors understand the abstraction layers.
