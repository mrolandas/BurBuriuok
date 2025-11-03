# Current Session Plan – BurBuriuok

Maintain this document during the active development session. Update checklists, add findings, and link to new documents as they appear. When the session ends or scope changes, archive or split portions into more specific docs.

## Objectives

- Translate the refreshed product vision into actionable, mobile-first deliverables.
- Lock the near-term backlog for backend, admin tooling, and learner experience foundations.
- Capture moderation, media, and engagement requirements early so implementation stays aligned.

## Workstreams & Checklists

### A. Product Definition & UX

- [ ] Draft mobile-first wireframes for curriculum boards, concept detail drawers, and study path runner.
- [ ] Document dependency surfacing patterns (prerequisite pills, inline drawers, next-step suggestions).
- [ ] Outline study path templates, including how quizzes and reflections slot in.
- [ ] Validate personas and permissions (learner, contributor, admin) against planned workflows.

### B. Data & Backend Architecture

- [x] Extend Supabase schema with prerequisite mapping tables and draft/publish flags.
- [x] Design media asset metadata + moderation state tables.
- [x] Specify API endpoints (read, progress, admin) and contract expectations.
- [x] Plan audit logging strategy for content edits and approvals.
- [ ] Define gamification data model (XP, streaks, badges) for future phases.

### C. Admin & Moderation Tools

- [ ] Map admin dashboard screens (overview, content CRUD, moderation queue).
- [x] Capture validation rules (duplicates, orphan nodes, missing translations) for form submissions.
- [x] Describe media approval workflow, notifications, and contributor feedback.
- [x] Decide on rate limiting/quota policies for uploads and edits.

### D. Learner Experience Implementation

- [ ] Break curriculum navigation into component-level backlog (section board, collapsible tree, dependency indicators).
- [ ] Specify concept view structure (definition, prerequisites, media carousel, actions).
- [ ] Define study queue interactions (“mark as mastered”, “study later”, “needs review”).
- [ ] Determine analytics events required to monitor learner progression.

### E. Engagement & Analytics

- [ ] Choose initial badge catalogue and streak rules aligned with curriculum milestones.
- [ ] Outline spaced repetition algorithm inputs (confidence scores, quiz outcomes, timestamps).
- [ ] Plan notification cadence (streak nudge, study path completion, pending review).
- [ ] Establish reporting needs for admins (most-missed concepts, dormant learners).

### F. Documentation & Delivery

- [x] Refresh `docs/MASTER_PLAN.md` with the holistic strategy and phased roadmap.
- [x] Update `docs/references/SUPABASE.md` once schema extensions are drafted.
- [ ] Extend `DEVELOPMENT_SETUP.md` with new tooling and moderation workflows.
- [ ] Produce issue/backlog outline aligned with Phase 0/Phase 1 roadmap.

## Session Log

- 2025-11-03: Captured holistic product direction (media moderation, mobile-first UX, engagement strategy) and updated `MASTER_PLAN.md` accordingly.
- 2025-11-03: Created and pushed migration `0006_curriculum_dependencies_media.sql` to add prerequisite mapping, content versioning, and media moderation scaffolding to Supabase (via `npx supabase db push --include-seed`).
- 2025-11-03: Added Supabase migration `0006_curriculum_dependencies_media.sql` covering prerequisite mapping, content versioning, and media moderation scaffolding; updated Supabase reference documentation.
- 2025-11-03: Documented API contracts, validation rules, audit logging, and rate limits in `docs/references/API_CONTRACTS.md` to unblock backend and admin tooling workstreams.
- [ ] Record schema extension decisions after prerequisite + moderation tables are modelled.
- [ ] Log outcomes from wireframing sessions (screenshots/links) for future reference.
- [ ] Document moderation SLA/notification strategy once agreed.

## Immediate Focus

- Finalise schema extension proposal (prerequisites, drafts, media states) and circulate for review.
- Sketch core mobile screens to validate navigation and dependency surfacing.
- Define admin workflow (CRUD + moderation) so backend contracts can follow.

## Branching & Testing Strategy

- Maintain short-lived feature branches off `main`; scope them to single roadmap items.
- Block merges on lint/tests once automation is configured; capture manual QA notes in PR descriptions.
- Use `docs/session/current_session.md` to track context so branches remain lightweight for AI agent collaboration.

## Wrap-up Checklist

- [ ] Review open checkboxes; move untouched items into issues or future sessions.
- [ ] Summarise session outcomes (commit notes, PR descriptions, or archive entry).
- [ ] Ensure `.env` handling and secrets remain excluded from git history.
