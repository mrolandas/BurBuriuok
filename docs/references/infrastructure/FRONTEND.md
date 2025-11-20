# Frontend Overview

The SvelteKit app under `frontend/` delivers the learner experience and consumes Supabase for data. Use this document as the starting point for architecture decisions, development workflows, and references to deeper documentation.

## Architecture Snapshot

- **Framework** – SvelteKit with TypeScript and Vite (Node 20 target).
- **Routing** – File-based routes under `src/routes`. The root `+page.svelte` renders the LX-001 “Skilčių lenta” board and, when admin mode is active, exposes inline edit affordances for section cards; `src/routes/sections/[code]/+page.svelte` hosts the LX-002 collapsible curriculum tree; `src/routes/concepts/[slug]/+page.svelte` delivers the LX-003 concept detail workspace; `src/routes/admin/+layout.svelte` guards admin pages, and `src/routes/admin/concepts/+page.svelte` mounts the ADM-002 concept manager drawer. `/admin/media/+page.svelte` loads `MediaManager.svelte`, which now supports modal previews, metadata edits (title, concept reassignment, LT/EN captions), timed delete confirmation, and automatically removes updated assets when they fall outside the active filters.
- **Data Loading** – Page-level `+page.ts` files use `getSupabaseClient()` (SSR disabled) to query public Supabase views `burburiuok_curriculum_nodes`, `burburiuok_curriculum_items`, and `burburiuok_concepts`. The tree route lazy-loads child nodes/items when a branch expands and enriches items with concept slugs for deep links.
- **Layouts** – `src/routes/+layout.svelte` wires global styles and the shared `AppShell` component (now hosting the global theme picker, the quiz modal entry point, and the persistent admin mode toggle rendered when impersonation is enabled).
- **Shared UI** – Components live in `src/lib/components/`. Core pieces include `AppShell`, `Card`, the recursive `CurriculumTree` + `CurriculumTreeBranch` pair (now emitting concept links, required badges, and admin drag/drop events), `ConceptDetail` for the LX-003 workspace shell, the shared `ConceptEditModal` that now also powers section edits on the homepage, and optional layout helpers such as `PageHeading` when a view needs hero-style framing. Admin-only widgets currently sit next to their routes (e.g., `src/routes/admin/concepts/ConceptManager.svelte`), but the concept manager now delegates its toolbar, list, and drawer to extracted modules under `src/routes/admin/concepts/components/` (`ConceptFilters.svelte`, `ConceptList.svelte`, `ConceptEditorDrawer.svelte`) with shared types in `types.ts`. `AppShell` now binds to the `adminMode` store so the “Aktyvuoti Admin” control mirrors global impersonation state. Media-specific helpers (modal preview focus trap, metadata form) remain co-located in `MediaManager.svelte`; consider extracting them once MEDIA-003 resumes.
- **State & Data** – Supabase client utilities sit in `src/lib/supabase/`. Import helpers from there rather than creating ad-hoc clients. Cross-cutting Svelte stores live in `src/lib/stores/`, including `adminMode.ts` which persists admin impersonation choices in `localStorage` and exposes helpers (`initialize`, `toggle`, `ensureAdminImpersonation`).
- **Styling** – Global CSS and theme tokens reside in `src/lib/styles/global.css`. Co-locate component styles using `<style>` blocks inside Svelte files when needed.

## Environment Configuration

- Local development: keep Supabase credentials in the repo root `.env`. The Vite config (`frontend/vite.config.ts`) reads those values and exposes them to the SvelteKit dev server automatically, so no extra `frontend/.env` maintenance is required.
- Admin console requests default to `/api/admin`. Override this with `VITE_ADMIN_API_BASE` when the Express backend runs on another host or port.
- Admin impersonation: export `VITE_ENABLE_ADMIN_IMPERSONATION=true` (and `ADMIN_DEV_IMPERSONATION=true` at the repo root) during local development to surface the AppShell admin toggle. The control updates the `impersonate=admin` query parameter automatically when it changes so inline editing stays active while navigating.
- GitHub Pages: deployments now default to the Render backend (`https://burburiuok.onrender.com/api/v1/admin`). Override this by setting the `VITE_ADMIN_API_BASE` Actions secret if the backend host changes.
- Production builds: GitHub Actions writes `frontend/static/env.js` with `supabaseUrl` and `supabaseAnonKey`. `src/lib/config/appConfig.ts` consumes `window.__BURKURSAS_CONFIG__` at runtime, falling back to `import.meta.env.VITE_*` values when present.
- Browser hydration uses a small inline script in `src/app.html` to apply the cached theme before SvelteKit boots, avoiding a flash of incorrect theming.

Development builds still log a warning if credentials are missing so contributors can spot misconfiguration early.

## Theming

- Global tokens live in `src/lib/styles/global.css`; Dawn (`Rytmečio dangus`) provides the base `:root` palette while Marine and Sand override tokens through `data-theme` attributes.
- `AppShell` persists the selected theme in `localStorage`, reflects it via `data-theme` on `<html>`, and exposes the selector as a compact `Spalvų derinys` disclosure in the hamburger menu (ordered Dawn → Marine → Sand).
- GitHub Pages reads the saved theme during boot (via `src/app.html`) to prevent a flash between visits and defaults to Dawn when no preference exists.

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
- Record schema and API changes in `docs/references/infrastructure/SUPABASE.md` and update seeds via the scripts documented in `docs/DEVELOPMENT_SETUP.md`.
- Use the helpers in `src/lib/api/curriculum.ts` (`fetchChildNodes`, `fetchNodeItems`) for curriculum navigation to keep prerequisite counts and ordering logic consistent. `fetchNodeItems` now enriches list entries with concept slugs/flags so the tree can link into the LX-003 view. Prerequisite badges currently fall back to zero counts until a public dependency view is introduced; the helper logs a warning when the fallback triggers.
- Admin-specific requests live in `src/lib/api/admin/`. `adminFetch` pulls the Supabase access token before calling the Express API (defaults to `/api/admin`), and the concept helpers (`listAdminConcepts`, `saveAdminConcept`) reuse the shared Zod schema from `shared/validation/adminConceptSchema`.
- Use `src/lib/api/concepts.ts::fetchConceptBySlug` when loading concept detail routes to avoid duplicating Supabase queries.
- Inline concept and section editing components subscribe to `adminMode` so toggling the control in `AppShell` immediately flips between read-only and edit affordances without reloading the page.

### Admin Curriculum Tree Workflow (Trimmed Launch)

- Drag-and-drop reorder uses `svelte-dnd-action`; preview moves take effect immediately but require confirmation through the floating `Patvirtinti/Atšaukti` banner pinned to the viewport bottom.
- `CurriculumTree.svelte` collects baseline ordinals before a drag starts, renders pending highlights while moves are unsaved, and clears the visual state as soon as confirmation succeeds or changes are cancelled.
- Delete and edit affordances auto-expand branches so confirmation prompts are visible without manual toggles; “Pridėti poskyrį” and “Pridėti terminą” now open inline forms that post through the admin API, capturing summaries, optional vertimai, šaltiniai, and the required flag before refreshing the branch.
- Admin toolbar buttons now reuse the `tree-node__item-action` styling (shared with concept actions) and follow the order `↑`, `↓`, `Pridėti poskyrį`, `Pridėti terminą`, `Redaguoti`, `Šalinti` (danger rightmost); keep new affordances aligned with this pattern.

## Testing & Quality

- `frontend/src/app.d.ts` defines project-level ambient types. Extend this file when adding custom stores or app-wide types.
- Add component-level tests (Playwright or Vitest) as the UI grows. Placeholder guidance will live in this document once tooling is decided.

## Roadmap Notes

- LX-001 Section Board now serves as the pattern reference for Supabase-driven pages (client-side load, retries, progress placeholders) and demonstrates inline admin editing for curriculum nodes using the shared modal.
- LX-002 Collapsible Tree introduces lazy-loaded branches, prerequisite badges, and deep links into LX-003. Analytics instrumentation is currently disabled; wire up the real telemetry client once analytics is ready. Tree leaf items now open concept detail pages when a slug is available and tag required topics inline.
- LX-003 Concept Detail provides the learner workspace with breadcrumbs, Lithuanian copy, peer-topic suggestions, and (when the admin toggle is active) inline edit controls powered by the shared `adminMode` store.
- Document any global stores, layout hierarchy changes, or design system additions here so new contributors understand the abstraction layers.
