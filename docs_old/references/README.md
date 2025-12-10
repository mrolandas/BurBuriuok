# Reference Documentation Map

Use this index to understand what lives in `docs/references/` and when to update each document. Update this file whenever new reference material is added or reorganised so contributors (and AI assistants) can navigate quickly.

## Root Reference Guides (cross-cutting)

- `ANALYTICS_EVENTS.md` – telemetry taxonomy, event payloads, and rollout guidance. Refresh after analytics hooks change.
- `API_CONTRACTS.md` – REST surface, request/response envelopes, and rate limits. Update whenever endpoints or validation rules shift.
- `ISSUE_TRACKER.md` – backlog-ready issue seeds with status/links. Maintain after opening, updating, or closing issues; ensure statuses mirror GitHub and acceptance criteria stay current.
- `MODERATION_SLA.md` – service-level expectations for moderation workflows. Revise when policies or notification flows evolve.
- `PERSONAS_PERMISSIONS.md` – persona matrix and role bindings. Update alongside access-control changes or Supabase RLS updates.
- `PHASE_BACKLOG.md` – high-level roadmap checkpoints beyond the trimmed launch. Keep aligned with `MASTER_PLAN.md` whenever priorities move.
- `SCHEMA_DECISIONS.md` – record of schema/migration decisions and rationale. Extend whenever new migrations land.
- `UX_MOBILE_WIREFRAMES.md` – canonical UX references for mobile-first layouts. Refresh when designs are approved or deprecated.

## Subdirectories

- `infrastructure/` – layer-specific manuals (`BACKEND.md`, `FRONTEND.md`, `SUPABASE.md`) plus its own `README.md` describing how to maintain runbooks. Update these alongside infrastructure/tooling changes.
- `features/implemented/` – documentation for live features (currently `ADMIN_SETUP.md`). Keep these synced with production behaviour and admin workflows.
- `features/ideas/` – discovery notes for future work (`QUIZ.md`, `STUDY_PATHS.md`, `GAMIFICATION_MODEL.md`, etc.). Update when ideation outcomes change or backlog items are refined.

## Maintenance Expectations

- When adding a new reference, add a one-line description here and update `docs/README.md` so the top-level index stays accurate.
- Cross-link related updates: if you touch schemas, update both `SCHEMA_DECISIONS.md` and the relevant infrastructure feature docs.
- Treat `ISSUE_TRACKER.md` as the single source for sprint-ready tickets—sync IDs, statuses, and links immediately after GitHub updates.
