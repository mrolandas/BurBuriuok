# Phase 0 / Phase 1 Backlog Outline

Use this backlog to spin issues or PR scopes. Keep items focused on thin slices that ship incremental value and unblock later phases.

## Phase 0 – Platform Foundation

- [ ] **Prerequisite graph modelling** – finalise table design (`curriculum_dependencies`) and extend seed builder to populate edge data; include Supabase migration + regeneration workflow.
- [ ] **Draft/publish workflow scaffolding** – create `content_versions` tables, triggers, and API contracts for status transitions; document moderation states.
- [x] **Canonical concept pipeline** – centralise content in `docs/static_info/LBS_concepts_master.md`, ensure `npm run content:seed:generate` regenerates seeds, and document the workflow in setup guides.
- [ ] **API surface spike** – stub backend endpoints for read/progress/admin access with contract tests.
- [ ] **Developer experience hardening** – wire lint/test commands, seed scripts, and Supabase CLI workflows into CI (lint + seed regeneration gate).

## Phase 1 – Content Management & Moderation

- [ ] **Admin CRUD UI** – build editable grids/forms for nodes, items, concepts, and dependencies with validation feedback.
- [ ] **Content versioning UX** – implement draft → review → publish flow, surfaced in admin dashboard with change history.
- [ ] **Media ingestion pipeline** – allow uploads with metadata capture, pending-state gating, and storage bucket policies.
- [ ] **Moderation queue** – queue view with approve/reject actions, audit trail, and notification hooks.
- [ ] **Automated validation suite** – server-side checks for duplicate ordinals, missing translations, orphan dependencies, and content diffs.
- [ ] **Role-based controls** – enforce permissions per persona (`PERSONAS_PERMISSIONS.md`) within UI and API.

## Curriculum Navigation Components (Learner Experience)

- [ ] **Section board layout** – responsive grid/list that surfaces top-level sections, progress badges, and CTA to drill down; include touch-friendly affordances.
- [ ] **Collapsible tree** – lazy-load nested nodes/items, highlight prerequisites, and expose quick links to concept detail.
- [ ] **Dependency indicators** – inline badges/pills showing required prerequisites, availability state, and links to remaining concepts.

## Concept View Structure

- [ ] **Content header** – title, LT/EN terms, required flag, and curriculum breadcrumb.
- [ ] **Definition & media** – stacked definition, expandable glossary context, and media carousel for approved assets.
- [ ] **Prerequisite & next-step drawers** – collapsible cards summarising dependencies, recommended follow-ups, and outstanding tasks.
- [ ] **Action bar** – buttons for “mark mastered”, “needs review”, “add note”, with keyboard shortcuts and analytics events.

## Study Queue Interactions

- [ ] **Queue manager UI** – backlog of scheduled concepts (Ready, Needs Review, Completed) with swipe/keyboard shortcuts.
- [ ] **Session runner** – timed study mode with confidence prompts and on-the-fly queue updates.
- [ ] **Review outcomes sync** – persist queue state to Supabase (`concept_progress` plus future streak metrics) and broadcast updates via realtime if enabled.

## Automation & Regression Guards

- [ ] **Seed regeneration check** – CI job to run `npm run content:seed:generate` and fail on diff, guaranteeing master markdown edits propagate.
- [ ] **Curriculum snapshot** – nightly/CI task to refresh `docs/static_info/curriculum_in_supabase.csv` and surface drift vs Supabase.
- [ ] **Concept content tests** – schema validation for master markdown tables to catch missing columns or malformed headings.
