# Archived Session – 2025-11-03 Planning Sprint

Maintain this record for historical context. The session captured below corresponds to the pre-implementation planning work that established the curriculum pipeline, schema decisions, moderation workflows, and automation guardrails.

---

# Current Session Plan – BurBuriuok

Maintain this document during the active development session. Update checklists, add findings, and link to new documents as they appear. When the session ends or scope changes, archive or split portions into more specific docs.

## Objectives

- Translate the refreshed product vision into actionable, mobile-first deliverables.
- Lock the near-term backlog for backend, admin tooling, and learner experience foundations.
- Capture moderation, media, and engagement requirements early so implementation stays aligned.

## Workstreams & Checklists

### A. Product Definition & UX

- [x] Draft mobile-first wireframes for curriculum boards, concept detail drawers, and study path runner.
- [x] Document dependency surfacing patterns (prerequisite pills, inline drawers, next-step suggestions).
- [x] Outline study path templates, including how quizzes and reflections slot in.
- [x] Validate personas and permissions (learner, contributor, admin) against planned workflows.

### B. Data & Backend Architecture

- [x] Extend Supabase schema with prerequisite mapping tables and draft/publish flags.
- [x] Design media asset metadata + moderation state tables.
- [x] Specify API endpoints (read, progress, admin) and contract expectations.
- [x] Plan audit logging strategy for content edits and approvals.
- [x] Define gamification data model (XP, streaks, badges) for future phases.
- [x] Consolidate curriculum concepts into a single markdown source and drive Supabase seeding from it.

### C. Admin & Moderation Tools

- [x] Map admin dashboard screens (overview, content CRUD, moderation queue).
- [x] Capture validation rules (duplicates, orphan nodes, missing translations) for form submissions.
- [x] Describe media approval workflow, notifications, and contributor feedback.
- [x] Decide on rate limiting/quota policies for uploads and edits.

### D. Learner Experience Implementation

- [x] Break curriculum navigation into component-level backlog (section board, collapsible tree, dependency indicators).
- [x] Specify concept view structure (definition, prerequisites, media carousel, actions).
- [x] Define study queue interactions (“mark as mastered”, “study later”, “needs review”).
- [x] Determine analytics events required to monitor learner progression (see `docs/references/ANALYTICS_EVENTS.md`).

### E. Engagement & Analytics

- [x] Choose initial badge catalogue and streak rules aligned with curriculum milestones.
- [x] Outline spaced repetition algorithm inputs (confidence scores, quiz outcomes, timestamps).
- [x] Plan notification cadence (streak nudge, study path completion, pending review).
- [x] Establish reporting needs for admins (most-missed concepts, dormant learners).

### F. Documentation & Delivery

- [x] Refresh `docs/MASTER_PLAN.md` with the holistic strategy and phased roadmap.
- [x] Update `docs/references/SUPABASE.md` once schema extensions are drafted.
- [ ] Extend `DEVELOPMENT_SETUP.md` with new tooling and moderation workflows.
- [x] Produce issue/backlog outline aligned with Phase 0/Phase 1 roadmap (see `docs/references/PHASE_BACKLOG.md`, `docs/references/ISSUE_TRACKER.md`).
- [x] Capture canonical concept content source and seed automation in docs (`SUPABASE.md`, `INFRASTRUCTURE.md`, `TESTING_GUIDE.md`).

## Session Log

- 2025-11-03: Captured holistic product direction (media moderation, mobile-first UX, engagement strategy) and updated `MASTER_PLAN.md` accordingly.
- 2025-11-03: Created and pushed migration `0006_curriculum_dependencies_media.sql` to add prerequisite mapping, content versioning, and media moderation scaffolding to Supabase (via `npx supabase db push --include-seed`).
- 2025-11-03: Added Supabase migration `0006_curriculum_dependencies_media.sql` covering prerequisite mapping, content versioning, and media moderation scaffolding; updated Supabase reference documentation.
- 2025-11-03: Documented API contracts, validation rules, audit logging, and rate limits in `docs/references/API_CONTRACTS.md` to unblock backend and admin tooling workstreams.
- 2025-11-03: Captured admin dashboard blueprint in `docs/references/ADMIN_DASHBOARD.md`, outlining screens, workflows, and open UX questions.
- 2025-11-03: Recorded mobile-first UX wireframe notes, study path framework, and gamification model in `docs/references/UX_MOBILE_WIREFRAMES.md`, `docs/references/STUDY_PATHS.md`, and `docs/references/GAMIFICATION_MODEL.md` respectively.
- 2025-11-03: Documented Personas & Permissions matrix in `docs/references/PERSONAS_PERMISSIONS.md` to align Supabase roles with planned capabilities.
- 2025-11-03: Authored `docs/static_info/LBS_concepts_master.md` as the single source of truth for curriculum concepts and linked it to seed automation.
- 2025-11-03: Updated `content/scripts/build_seed_sql.mjs` to parse the master markdown and regenerate `supabase/seeds/seed_concepts.sql` (300 concepts synced with curriculum structure).
- 2025-11-03: Refreshed `docs/references/DEVELOPMENT_SETUP.md` with the markdown-driven seed workflow and canonical content guidance.
- 2025-11-03: Published `docs/references/PHASE_BACKLOG.md` to outline Phase 0/Phase 1 engineering backlog and learner experience components.
- 2025-11-03: Logged schema decisions for prerequisites, draft content, and media moderation in `docs/references/SCHEMA_DECISIONS.md`.
- 2025-11-03: Documented moderation SLA and notification plan in `docs/references/MODERATION_SLA.md`.
- 2025-11-03: Defined learner analytics event catalog in `docs/references/ANALYTICS_EVENTS.md`.
- 2025-11-03: Wired Husky pre-commit hook and GitHub Action `Content Seed Guard` to enforce markdown-driven seed consistency.
- 2025-11-03: Added curriculum snapshot + markdown validation guards (pre-commit + CI) and documented the workflow in `docs/TESTING_GUIDE.md`.
- 2025-11-03: Confirmed no standalone wireframe assets exist; UX considerations live in `docs/references/UX_MOBILE_WIREFRAMES.md`.
- [x] Record schema extension decisions after prerequisite + moderation tables are modelled (tracked in `docs/references/SCHEMA_DECISIONS.md`).
- [x] Log outcomes from wireframing sessions (screenshots/links) for future reference (no standalone assets; see `docs/references/UX_MOBILE_WIREFRAMES.md`).
- [x] Document moderation SLA/notification strategy once agreed (captured in `docs/references/MODERATION_SLA.md`).

## Immediate Focus

- Review the schema decision log (prerequisites, drafts, media states) with stakeholders before shipping migrations.
- Validate personas/permissions and map them to Auth roles/policies.
- Translate the new learner experience backlog (`docs/references/PHASE_BACKLOG.md`) into tracked issues for Section board, concept view, and study queue delivery.
- Close this planning session and spin up a build-focused session plan covering backend/frontend implementation.

## Branching & Testing Strategy

- Maintain short-lived feature branches off `main`; scope them to single roadmap items.
- Block merges on lint/tests once automation is configured; capture manual QA notes in PR descriptions.
- Use `docs/session/current_session.md` to track context so branches remain lightweight for AI agent collaboration.

## Wrap-up Checklist

- [ ] Review open checkboxes; move untouched items into issues or future sessions.
- [ ] Summarise session outcomes (commit notes, PR descriptions, or archive entry).
- [ ] Ensure `.env` handling and secrets remain excluded from git history.
