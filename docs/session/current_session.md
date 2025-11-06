# Current Session Plan – Build Sprint 1

Kick-off session for actual backend and frontend implementation following the planning groundwork completed on 2025-11-03. Use this plan to coordinate thin vertical slices that deliver end-to-end learner and admin value while keeping Supabase schema changes incremental.

## Objectives

- Stand up the initial backend services (Supabase schema + Express API) that expose curriculum data and user progress endpoints.
- Implement the first learner-facing views (section board, concept detail shell) in SvelteKit using live Supabase data.
- Deliver the admin CRUD foundation for concepts and curriculum nodes with validation and draft/publish support.
- Keep automation healthy: migrations, seeds, markdown validation, and snapshot guards must stay green in CI and pre-commit.
- Translate Issue Tracker entries into GitHub issues as workstreams kick off and update statuses continuously.

## Workstreams & Checklists

### A. Backend Foundations (Supabase + API)

- [x] Finalise prerequisite `curriculum_dependencies` migration and seeds (link to `docs/references/SCHEMA_DECISIONS.md`).
- [x] Add content versioning tables/triggers (`content_versions`, `content_version_changes`).
- [x] Scaffold Express (or Supabase Edge) API with read endpoints: curriculum tree, concept by slug, dependency lookups.
- [x] Implement write endpoints for progress tracking (`concept_progress`) with validation and rate limiting stubs.
- [x] Add audit logging for admin content mutations.

### B. Frontend Learner Experience (SvelteKit)

- [x] Bootstrap SvelteKit app structure with routing, layout, and shared UI primitives.
- [x] Implement Section Board page consuming live Supabase data (issue [LX-001](https://github.com/mrolandas/BurBuriuok/issues/1)).
- [x] Build collapsible curriculum tree component with lazy-loaded nodes (issue [LX-002](https://github.com/mrolandas/BurBuriuok/issues/2)) – prerequisite badges currently show zero until a public dependency view ships.
- [x] Deliver concept detail view skeleton showing definitions, prerequisite placeholders, and action stubs (issue [LX-003](https://github.com/mrolandas/BurBuriuok/issues/3)).
- [x] Integrate Supabase client, environment config, and error handling patterns.
- [x] Add global search bar beneath header that surfaces concepts by title/term and matches within descriptions, prioritising direct concept hits before description snippets and returning linked results with snippet context.

### C. Admin & Moderation Interface

- [x] Create secured admin route with persona-based access guards (`docs/references/PERSONAS_PERMISSIONS.md`). _Status: done – ADM-001 guard landed 2025-11-06; SvelteKit layout checks Supabase `app_role`, provides impersonation flag for devs, and backend middleware revalidates._
  - `/admin/+layout` now renders persona banner for admins, falls back to guidance copy for learners, and emits `admin_session_checked` telemetry events.
  - Backend Express middleware `requireAdminRole` validates Supabase JWTs via service client and exposes placeholder `/api/v1/admin/status` endpoint.
- [x] Implement concept management form (create/edit) with draft/publish toggle and validation. _Status: MVP shipped – admin concept endpoints + SvelteKit drawer live; tracking polish items (data grid filters, optimistic UI, history sidebar)._
  - Break work into form shell, validation layer (Zod), audit log hook, and optimistic UI patterns. _In progress – optimistic updates/history sidebar outstanding._
- [ ] Surface moderation queue list with status filters (`pending`, `approved`, `rejected`). _Status: discovery – column set finalised; SLA priorities tied to queue ordering (ADM-003)._
  - Define lightweight REST filter params and UI empty/error states before engineering kickoff.
- [ ] Wire Slack/email notification stubs in backend per `docs/references/MODERATION_SLA.md` (placeholder logs until integration exists). _Status: discovery – ADM-004 seeds Slack webhook + email template stubs._
- [ ] Document how admin actions map to analytics events for future instrumentation. _Status: not started – depends on ADM-002/003 event taxonomy hand-off to analytics._

#### C1. Inline Concept Editing Rollout (ADM-002 follow-up)

1. **Component extraction**

   - [x] Break out the learner-facing concept layout into a reusable `ConceptDisplay` (content, metadata, navigation).
     - [x] Follow up: migrate `ConceptDisplay`/`ConceptDetail` slots to the Svelte 5 snippet API to clear the deprecation warnings.
   - [ ] Centralise concept detail load logic so both `/concepts/[slug]` and admin entry points use a shared loader/store.

2. **Admin session plumbing**

   - [x] Expose an `adminEditMode` flag in `+page.ts` derived from the Supabase session (true for admins / impersonation).
   - [x] Ensure route guards continue to block learners while allowing admins to access `/concepts/[slug]` with edit rights.

3. **Editable UI behaviours**

   - [x] Add prop-driven edit affordances (inline edit buttons, status chips, metadata badges) when `adminEditMode` is true.
   - [x] Wire inline save/publish/archive actions to the existing admin API; add optimistic updates and toast feedback.

4. **Entry points & navigation**

   - [x] Update the admin concept list to deep-link into `/concepts/[slug]?admin=1` (or similar) for quick immersion into edit mode.
   - [x] Provide an in-page “Admin mode” toggle so editors can switch between read-only and edit states without leaving the concept view.

5. **Cleanup & docs**
   - [ ] Deprecate the redundant `/admin/concepts/[slug]` form once inline editing handles the full workflow (retain list/filter view only).
   - [ ] Refresh `docs/references/ADMIN_DASHBOARD.md` and user guides to explain the new inline editing flow.

### D. Learner Practice & Progress

- [ ] Implement local queue store for Ready/Needs Review/Completed lists (issue [LX-004](https://github.com/mrolandas/BurBuriuok/issues/4)).
- [ ] Persist queue interactions to Supabase `concept_progress` via API.
- [ ] Create study session runner MVP with timer and confidence capture (issue [LX-005](https://github.com/mrolandas/BurBuriuok/issues/5)).
- [ ] Define first batch of analytics event emissions in frontend aligned with `docs/references/ANALYTICS_EVENTS.md`.
- [ ] Draft UX for spaced repetition scheduling (implementation optional this sprint).

### E. Quality, Automation & Ops

- [ ] Keep regression guards (`npm run content:seed:check`, `npm run content:snapshot:check`, `npm run content:markdown:validate`) green before every commit.
- [ ] Extend automated tests: add unit tests for new repositories/service layers (`tests/` folder).
- [ ] Configure linting/formatting baseline (ESLint + Prettier) with npm scripts.
- [ ] Set up CI to run lint + unit tests in addition to content guards.
- [ ] Document deployment checklist for the first integrated backend/frontend release.

### F. Documentation & Tracking

- [ ] Open GitHub issues for each READY item in `docs/references/ISSUE_TRACKER.md` and back-link issue numbers.
- [ ] Update `docs/references/DEVELOPMENT_SETUP.md` with final run commands as services come online.
- [ ] Maintain API contract updates in `docs/references/API_CONTRACTS.md` as endpoints evolve.
- [ ] Capture admin UX refinements in `docs/references/ADMIN_DASHBOARD.md` as screens ship.
- [ ] Record implementation decisions in `docs/references/SCHEMA_DECISIONS.md` when migrations diverge from the current plan.

## Session Log

- 2025-11-03: Build Sprint 1 created after planning merge; backlog seeded from `docs/references/ISSUE_TRACKER.md`.
- 2025-11-03: Opened GitHub issues #1-#8 for Build Sprint 1 learner and backend slices.
- 2025-11-03: Curriculum dependency migration + seed tooling drafted and logged (issue [DB-001](https://github.com/mrolandas/BurBuriuok/issues/6)).
- 2025-11-04: Added `content_version_changes`, triggers, and Express read API scaffold (issue [DB-002](https://github.com/mrolandas/BurBuriuok/issues/7)).
- 2025-11-04: Supabase hosted project updated through migration `0008` with refreshed prerequisite seeds.
- 2025-11-04: Progress write API (`PUT/DELETE /api/v1/progress/:conceptId`) shipped with device-key validation and in-memory rate limiting stub.
- 2025-11-04: Backend foundations checklist closed; shifting focus to SvelteKit learner experience slice.
- 2025-11-04: Introduced audit logging service recording admin content mutations to `content_versions` and `content_version_changes`.
- 2025-11-04: SvelteKit learner experience shell scaffolded (`frontend/`) with shared UI primitives and Supabase config utilities.
- 2025-11-04: Frontend lint baseline green after updating AppShell navigation to use `$app/paths.resolve` for internal links.
- 2025-11-04: LX-001 Section board route renders live Supabase curriculum nodes with progress placeholders and inline retry control.
- 2025-11-04: LX-002 Collapsible tree route delivers lazy-loaded curriculum branches, prerequisite badges, and analytics stub logging on expand.
- 2025-11-04: Localised learner UI copy from “sekcija” to “skiltis” and removed remaining English strings across navigation and tree components.
- 2025-11-04: Documented LX-002 completion (fallback prerequisite counts logged) and queued LX-003 concept detail slice.
- 2025-11-05: Reconfirmed modular frontend approach (separate loaders, Supabase helpers, and UI components) so future UX iterations remain low-risk.
- 2025-11-05: Mapped learner flow beyond LX-003—concept workspace → study queue (LX-004) → timed runner (LX-005) with gamification hooks following practice features.
- 2025-11-05: LX-003 concept page uždarytas – veiksmai atnaujina vietinę būseną ir siunčia įvykius laukdami LX-004/LX-005 integracijos.
- 2025-11-05: Mokymosi modelis perskaičiuotas – visos temos startuoja kaip „nežinau“, „Mokausi“ ir „Moku“ žymos valdomos vietoje iki Supabase sinchronizacijos LX-004/LX-005 metu.
- 2025-11-05: Curriculum tree items now deep-link into concept detail pages when Supabase exposes a matching slug, flagging required concepts inline.
- 2025-11-05: Introduced a global knowledge-check modal – the “Pasitikrinti žinias” button now appears in the menu and concept view, currently showing placeholder copy until the LX-00x quiz work begins.
- 2025-11-05: Promoted quiz blueprint to `docs/references/QUIZ.md`, defined dedicated `learner_quiz_metrics` table linked to `auth.users`, and opened LX-006 issue [#9](https://github.com/mrolandas/BurBuriuok/issues/9).
- 2025-11-05: Confirmed Supabase client helper, env guards, and frontend error messaging are in place; FE checklist item closed.
- 2025-11-05: Global paieška realizuota – viršuje įdėtas laukelis, `/search` puslapis rodo sąvokų ir aprašymų rezultatus su fragmentais.
- 2025-11-06: GitHub Pages deploy stabilized with runtime Supabase config written to `env.js`, frontend now merges repo `.env` for local preview, and AppShell ships with a persistent theme picker (Marine, Dawn, Sand) to smooth mobile navigation.
- 2025-11-06: Quiz discovery update – decided to keep question formats modular so sessions can mix configurable percentages (multiple choice, open response, image hotspot) and captured the new hotspot-on-image question concept in `docs/references/QUIZ.md`.
- 2025-11-06: AppShell menu refined – theme picker collapses into the "Spalvų derinys" button, option order updated (Rytmečio dangus, Jūrinė naktis, Smėlio krantai), and the Dawn scheme now loads by default across devices.
- 2025-11-06: Concept detail screen polish shipped – sidebar alignment tightened, pager spacing balanced, and breadcrumb home label confirmed; discovery tasks marked complete in session notes.
- 2025-11-06: ADM-001 uždaryta – `/admin` maršrutas saugomas SvelteKit sargybiniu, backend middleware tikrina Supabase `app_role`, o abu sluoksniai emituoja `admin_session_checked` įvykius stebėsenai.
- 2025-11-06: Admin & moderation discovery kicked off – seeded ADM-001…ADM-005 issues for guarded admin shell, concept editor MVP, moderation queue, notification stubs, and analytics mapping; updated references to reflect Sprint 1 deliverables.
- 2025-11-06: Opened GitHub issues #10-#14 (ADM-001…ADM-005), logged backend middleware coordination in ADM-001, and published implementation checklist to unblock development handoff.
- 2025-11-06: ADM-002 concept editor MVP landed – `/api/v1/admin/concepts` routes plus SvelteKit drawer shipped with shared validation; docs refreshed (`BACKEND.md`, `API_CONTRACTS.md`, `ADMIN_DASHBOARD.md`, `FRONTEND.md`, `SCHEMA_DECISIONS.md`).
- 2025-11-06: Concept layout extracted into shared `ConceptDisplay` component; learner view now delegates layout while preserving action state, and we logged a follow-up to adopt Svelte 5 snippets to remove slot warnings before inline admin editing ships.
- 2025-11-06: ConceptDetail/ConceptDisplay now use Svelte 5 snippets with `{@render ...}` so learner actions render without deprecated `<slot>` usage, clearing frontend check warnings and paving the way for admin inline controls.
- 2025-11-06: Inline concept editing UI shipped – admin toolbar exposes mode toggle, metadata badges, and inline form with validation plus save/publish actions; admin concept list now deep-links into `/concepts/[slug]?admin=1` for rapid entry.
- 2025-11-06: Added shared admin session resolver, wired `/concepts/[slug]` to expose `adminEditMode`, and surfaced inline admin banners so non-admin requests fall back gracefully while admin/impersonation sessions enable future edit controls.

> Continue logging milestones (feature slices, migrations, deployments) as they land.

## Immediate Focus

- Patikrinti „Rytmečio dangaus“ kontrastą po numatytojo nustatymo ir, jei reikia, sukalibruoti šviesių temų tipografiją.
- Uždaryti LX-004 – sukurti vietinę eilės saugyklą ir susieti ją su naujais koncepto veiksmų įvykiais.
- Apibrėžti duomenų perkrovimo/kešavimo strategiją, kad skilties medis ir koncepto puslapis dalintųsi tais pačiais Supabase užklausų rezultatais.
- Coordinate with backend on exposing a public dependency view so prerequisite badges can show real counts.
- Draft LX-004/LX-005 implementation notes (queue state, session HUD, gamification signals) while ruošiamės jungti prie naujų veiksmų įvykių.
- Start LX-004 discovery: outline the study queue store API and how the new action signals will move items between lists (po spalvų atnaujinimo).
- LX-006 planas: apibrėžti modulinių viktorinų tipų tvarkyklę, kuri leis nurodyti klausimų tipų proporcijas vienai sesijai.
- Align on the guided learning path narrative: how the “nežinau → mokausi → moku” model appears in UI and supporting docs.
- Plan the knowledge-check module (section vs. whole-course options) – schedule after LX-005 once the study-session experience solidifies.
- Parengti ADM-002 diegimo backlogą: nustatyti SvelteKit admin formos skeletoną, patikrinti Supabase RLS taisykles ir suderinti validacijos schemų dalinimąsi tarp `frontend/` ir `backend/` (nuoroda į [#11](https://github.com/mrolandas/BurBuriuok/issues/11)).
- Paruošti ADM-003/ADM-004 reikalavimų santrauką: moderavimo sąrašo stulpeliai, SLA signalizacijų žinutės ir pseudo integracijos su Slack/email webhookais (nuoroda į [#12](https://github.com/mrolandas/BurBuriuok/issues/12) ir [#13](https://github.com/mrolandas/BurBuriuok/issues/13)).

## Branching & Testing Strategy

- Use feature branches per issue (e.g., `feature/lx-001-section-board`).
- Require pre-commit hooks to pass; add lint/test scripts to PR checks before merge.
- Keep PRs narrowly scoped (one slice per PR) with links to Issue Tracker IDs.

## Wrap-up Checklist

- [ ] Backend scaffolding merged and deployable.
- [ ] Frontend skeleton deployed with live curriculum read-only views.
- [ ] Admin CRUD MVP behind authentication.
- [ ] Automation (CI + Husky) green across new tooling.
- [ ] Documentation updated with any new patterns or tooling decisions.
