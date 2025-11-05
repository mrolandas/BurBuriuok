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

- [ ] Create secured admin route with persona-based access guards (`docs/references/PERSONAS_PERMISSIONS.md`).
- [ ] Implement concept management form (create/edit) with draft/publish toggle and validation.
- [ ] Surface moderation queue list with status filters (`pending`, `approved`, `rejected`).
- [ ] Wire Slack/email notification stubs in backend per `docs/references/MODERATION_SLA.md` (placeholder logs until integration exists).
- [ ] Document how admin actions map to analytics events for future instrumentation.

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

> Continue logging milestones (feature slices, migrations, deployments) as they land.

## Immediate Focus

- Patobulinti šviesių temų teksto kontrastą ir ekrano šrifto spalvas (rytoj).
- Uždaryti LX-004 – sukurti vietinę eilės saugyklą ir susieti ją su naujais koncepto veiksmų įvykiais.
- Apibrėžti duomenų perkrovimo/kešavimo strategiją, kad skilties medis ir koncepto puslapis dalintųsi tais pačiais Supabase užklausų rezultatais.
- Coordinate with backend on exposing a public dependency view so prerequisite badges can show real counts.
- Draft LX-004/LX-005 implementation notes (queue state, session HUD, gamification signals) while ruošiamės jungti prie naujų veiksmų įvykių.
- Start LX-004 discovery: outline the study queue store API and how the new action signals will move items between lists (po spalvų atnaujinimo).
- Align on the guided learning path narrative: how the “nežinau → mokausi → moku” model appears in UI and supporting docs.
- Plan the knowledge-check module (section vs. whole-course options) – schedule after LX-005 once the study-session experience solidifies.

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
