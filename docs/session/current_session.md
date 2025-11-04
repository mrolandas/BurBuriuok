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
- [ ] Build collapsible curriculum tree component with lazy-loaded nodes (issue [LX-002](https://github.com/mrolandas/BurBuriuok/issues/2)).
- [ ] Deliver concept detail view skeleton showing definitions, prerequisite badges, and placeholder actions (issue [LX-003](https://github.com/mrolandas/BurBuriuok/issues/3)).
- [ ] Integrate Supabase client, environment config, and error handling patterns.

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

> Continue logging milestones (feature slices, migrations, deployments) as they land.

## Immediate Focus

- Kick off LX-002 collapsible curriculum tree with lazy loading and route scaffolding.
- Define data loading strategy (load functions + caching) for learner-facing routes.
- Document frontend environment requirements (`VITE_SUPABASE_*`) for contributors.

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
