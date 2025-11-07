# Current Session Plan – Build Sprint 1 (Trimmed Scope)

Shared orientation, scope, and guard rails for the trimmed Build Sprint 1 launch window agreed on 2025-11-07. Use this document as the first stop for the AI coding assistant or any teammate before diving into tasks.

## Orientation Checklist (start of every work session)

- Read `docs/README.md` for navigation plus documentation upkeep expectations (update it and `docs/references/README.md` if new docs appear).
- Review `docs/MASTER_PLAN.md` for current scope boundaries, deferred items, and personas.
- Open `docs/INFRASTRUCTURE.md` + `docs/references/infrastructure/` for near-term vs future-state environment details.
- Check `docs/references/ISSUE_TRACKER.md` for the latest issue seeds and status links; sync it after creating/updating GitHub issues.
- Scan this file’s `Session Log` and the previous archive (`docs/archive/2025-11-07-current-session.md`) for context.

## Phase 1 Objectives (Admin Content Management & Moderation Foundations)

- Deliver the admin CRUD + hierarchy experience so editors can manage curriculum nodes, items, and concepts safely.
- Establish the content versioning workflow, media submission pipeline, and moderation queue skeleton backed by documented seams.
- Keep automation, documentation, and validation aligned so deferred phases can plug in without rework.

## Deliverable Slices

- [ ] **Curriculum CRUD + hierarchy controls** – extend inline concept editing with tree management, shared validation, and backend reparenting rules.
- [ ] **Content versioning workflow** – implement draft/review/publish flow with audit logging, rollback notes, and documentation updates.
- [ ] **Media intake pipeline** – expose upload/metadata flow, define storage strategy, and queue submissions for review.
- [ ] **Moderation queue & notification stubs** – build approve/reject UI with SLA signalling, dispatcher-backed Slack/email hooks, and tightened RLS/persona guards.

## Recent Progress

- Hardened inline concept editing: AppShell admin toggle persists across navigation, buttons reorganised for mobile, and inline save flow now surfaces backend validation feedback without 500s.
- Backend admin save endpoint now guards Supabase auth errors, emits defensive audit logging, and returns clear payload failures for publish attempts.
- Rotated Supabase anon + service keys, re-granted schema privileges, and verified admin draft saves, expected publish validation errors, and concept cleanup via Supabase script.
- Cleaned temporary admin test concept, merged admin UI refresh branch to `main`, and prepped documentation backlog for the next pass.

## Seam Preservation Checklist (must complete inside trimmed scope)

1. Keep moderation-ready status enums (`draft/published`, `pending/approved/rejected`) and document handling for future queues.
2. Land the backend event dispatcher stub so admin saves can emit Slack/email hooks later.
3. Lock the learner progression schema (`concept_progress` enums + optional history) and capture notes in `docs/references/infrastructure/BACKEND.md`.
4. Wrap frontend analytics behind a shared `emitEvent` helper with TODO hooks for future instrumentation.
5. Ensure audit logging tables record actor, timestamp, and change summary for approval workflows.
6. Define the media pipeline seam (storage targets, metadata table, signed URL strategy) for the upcoming asset work.

## Immediate Focus

- Refresh documentation (this file, `docs/INFRASTRUCTURE.md`, `docs/references/infrastructure/SUPABASE.md`, `docs/MASTER_PLAN.md`) so the latest admin UI tweaks, backend guardrails, and key rotation steps are captured before starting new feature work.
- Re-test the admin shell + inline editing path end-to-end after the merge to confirm the toggle persists, draft saves succeed, and publish attempts surface validation messaging without 500s.
- Sketch the next set of hierarchy UX tasks (tree management, reparenting rules) while identifying backend seams needed for CRUD coverage.
- Inventory remaining audit logging/doc gaps for draft → publish flow and queue them alongside dispatcher hook work.
- Plan the media intake spike (UI, Supabase storage plan) and note schema touchpoints in `references/SCHEMA_DECISIONS.md` for upcoming implementation.

## Documentation & Maintenance Rules

- Update `docs/README.md` and `docs/references/README.md` whenever new documentation is added or reorganised.
- Capture implementation notes in the matching reference file (e.g., ADM work in `references/features/implemented/ADMIN_SETUP.md`).
- Record schema or migration changes in `references/SCHEMA_DECISIONS.md` and propagate to `references/infrastructure/SUPABASE.md`.
- After creating or closing GitHub issues, sync status rows in `references/ISSUE_TRACKER.md` and link the new issue IDs.
- Archive this session plan to `docs/archive/` (datestamped) once the sprint closes and start a fresh plan.

## Testing & Verification

- `npm test` – project-wide unit tests.
- `npm run backend:typecheck` – backend TypeScript coverage.
- `npm run frontend:check` / `npm run frontend:lint` – SvelteKit diagnostics and linting.
- `npm run content:seed:generate` + `npm run content:seed:check` – regenerate/verify Supabase seeds.
- `npm run content:snapshot:check` – ensure curriculum snapshot stays in sync.
- Run targeted smoke tests for new slices (e.g., admin hierarchy controls) and log results in the Session Log if issues arise.

## Infrastructure Notes

- `INFRASTRUCTURE.md` outlines the current vs future hosting plan; defer to `docs/references/infrastructure/README.md` for layer-specific manuals (`BACKEND.md`, `FRONTEND.md`, `SUPABASE.md`).
- Document any deployment or tooling decisions in both places so the assistant and humans stay aligned.
- Maintain environment variable expectations in `DEVELOPMENT_SETUP.md` whenever backend/frontend tooling shifts.

## Branching & Workflow

- Use feature branches per issue (e.g., `feature/adm-tree-management`).
- Reference Issue Tracker IDs in commit messages/PR descriptions.
- Require lint/test/content checks before merge; keep PR scope tight to a single slice.

## Session Log

- 2025-11-07: Trimmed launch scope confirmed; archived prior session plan to `docs/archive/2025-11-07-current-session.md`; new plan captures hierarchy management requirement, architectural seams, and updated delivery slices.
- 2025-11-09: Refined admin shell + inline editing UX, shored up backend guardrails, rotated Supabase keys with schema grants restored, validated draft saves/publish errors, removed test concept, and merged admin refresh to `main`; documentation refresh queued next.

## Wrap-up Checklist

- [ ] Curriculum CRUD + hierarchy controls shipped (frontend + backend) and documented.
- [ ] Content versioning workflow live with audit history and reference docs updated.
- [ ] Media intake pipeline and storage plan documented; submissions queue available for moderation.
- [ ] Moderation queue + notification stubs operating with dispatcher hooks and validated RLS.
- [ ] Seam preservation checklist documented in the relevant reference docs.
- [ ] `references/ISSUE_TRACKER.md` synced with final issue statuses and links.
- [ ] Session archived with outcomes noted and next plan drafted.
