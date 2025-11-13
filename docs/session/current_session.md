# Current Session Plan – DB-002 Content Versioning (2025-11-13)

This session refocuses on DB-002: harden the content versioning workflow so admin edits stay auditable, reversible, and policy-compliant before expanding further media work.

## Orientation Checklist (run at the start of each work block)

- Open `docs/README.md` for navigation updates and maintenance rules; keep it aligned when new docs appear.
- Review `docs/MASTER_PLAN.md` and `docs/references/features/implemented/ADMIN_SETUP.md` to understand current admin affordances and how media fits the roadmap.
- Study `docs/references/infrastructure/SUPABASE.md` plus `docs/references/SCHEMA_DECISIONS.md` for storage, table, and migration expectations.
- Sync with `docs/references/ISSUE_TRACKER.md` to ensure media tasks are tracked and cross-linked with GitHub issues.
- Skim the archive `docs/archive/2025-11-12_current_session.md` if context about the trimmed-scope sprint is needed.

## Objectives for This Sprint

- Deliver DB-002 content versioning migrations, Supabase policies, and regression coverage.
- Wire backend/admin flows to persist draft/history records with clear rollback paths.
- Document the workflow updates across runbooks and reference guides.
- Capture follow-up work (ADM-002 polish, media backlog, auth rollout) as post-DB-002 dependencies.

## Workstream Milestones & Dependencies

- [ ] **DB-002 – Content Versioning Model**
  - [x] Finalise migrations for `content_drafts`, `content_versions`, and supporting triggers (0010 shipped with default/metadata triggers).
  - [x] Tighten Supabase policies covering draft/publish transitions and admin audit access (RLS enabled with `burburiuok.is_admin_session()` helper).
  - [x] Extend backend services to persist diff metadata and expose rollback endpoints.
  - [x] Apply Supabase migration 0009 to the hosted project and verify snapshot rows populate via audit logging.
  - [x] Add DB-002 smoke coverage (`npm run test:db002`) and document execution cadence.
  - ⏳ Update `SCHEMA_DECISIONS.md`, `BACKEND.md`, and `ADMIN_SETUP.md` with the approved workflow (schema decision log refreshed; backend runbook still pending).
- [ ] **Post-DB-002 Follow-ups** (tracking only)
  - ADM-002 polish depends on DB-002 history tables.
  - MEDIA-001 and MEDIA-002 start once DB-002 lands.
  - AUTH-001→003 backlog prepped; execution queued after DB-002.

## Immediate Focus (week of 2025-11-13)

- Validate existing migrations against supabase/migrations history; generate any missing drafts/history tables.
- Implement Supabase RLS + RPC updates ensuring admins can review drafts while learners remain read-only.
- Add backend regression coverage for draft creation, publish transitions, and rollback flows.
- Document operational runbook for reverting to previous versions and link it from `ADMIN_SETUP.md`.

## Dependencies & Open Questions

- Confirm whether `content_versions` needs additional indexes for rollback queries (review EXPLAIN output).
- Validate audit trail payload shape with product—capture field requirements for future moderation tools.
- Decide how many historical versions to retain per concept and whether to add scheduled cleanup tooling.
- Ensure ADM-002 backlog items stay updated once DB-002 fields are live (filters, history drawer inputs).

## Testing & Verification Plan

- Extend backend unit/integration tests covering draft creation, publish transitions, rollback, and diff summaries.
- Add Vitest coverage for shared validation schemas to ensure draft vs publish status stays in sync.
- Run the DB-002 smoke script (`npm run test:db002`) to create a draft, publish it, and confirm audit + draft tables stay coherent.
- Update `docs/TESTING_GUIDE.md` with manual QA steps for reviewing version history inside the admin console.

## Documentation & Tracking Rules

- Log each migration filename and policy update in this plan plus `SCHEMA_DECISIONS.md`.
- Refresh `references/infrastructure/BACKEND.md` when admin endpoints change.
- Update `references/features/implemented/ADMIN_SETUP.md` with the new versioning UX and rollback steps.
- Keep `docs/references/ISSUE_TRACKER.md` synced with DB-002 status and dependent tasks (ADM-002, media backlog).

## Risks & Mitigations

- **Rollback data gaps** – ensure diff payloads capture all fields; add regression tests around optional columns.
- **Policy regressions** – double-check Supabase RLS on drafts to avoid learner write access; add canary tests.
- **Migration drift** – run `supabase db diff` before shipping to confirm staging/prod parity.
- **Admin UX confusion** – pair documentation with UI hints; schedule feedback loop after rollout.

## Session Log

- 2025-11-12: Archived the trimmed-scope Build Sprint plan to `docs/archive/2025-11-12_current_session.md` and established the media-focused plan (storage, uploads, embeds, moderation).
- 2025-11-13: Refreshed the session scope to include content versioning hardening and the full media MVP pipeline; reordered backlog and documentation rules to enforce GitHub sync via commit hook.
- 2025-11-13: Opened AUTH-001/002/003 issues ([#20](https://github.com/mrolandas/BurBuriuok/issues/20), [#21](https://github.com/mrolandas/BurBuriuok/issues/21), [#22](https://github.com/mrolandas/BurBuriuok/issues/22)) after aligning backlog briefs with documentation.
- 2025-11-13: Narrowed the active session to DB-002 delivery, deferring media/auth execution until versioning policies, migrations, and rollback tooling are complete.
- 2025-11-13: Added `content_versions.snapshot` column, Supabase rollback endpoint, and admin UI controls to restore concepts (section → subsection → concept bundle) using authenticated sessions.
- 2025-11-13: Applied migration `0009_db002_rollback_bundle.sql` to the hosted Supabase project and confirmed seeds were already aligned.
- 2025-11-13: Created test subsection/concept bundle via the admin console and verified `content_versions` snapshots for nodes/items/concepts persist remotely.
- 2025-11-13: Drafted migration `0010_db002_content_drafts_and_policies.sql` introducing `content_drafts`, helper triggers, and RLS policies for version/draft tables.
- 2025-11-13: Wired backend audit logger to reconcile `content_drafts` entries (upsert for draft/in-review saves, cleanup on publish/archive) and updated repositories/types accordingly.
- 2025-11-13: Applied migration `0010_db002_content_drafts_and_policies.sql` to the hosted Supabase project; RLS policies now enforce admin/service-role access to history tables.
- 2025-11-13: Added `tests/db002ContentVersioning.test.ts` plus `npm run test:db002` to exercise draft→publish transitions end-to-end against Supabase with automated cleanup.
- 2025-11-13: Updated testing guidance to document when the DB-002 smoke test should be executed (pre-migration pushes, post-key rotation, release validation).
- 2025-11-13: Refreshed schema decisions, backend runbook, and admin setup docs with DB-002 draft reconciliation details and regression test references; Issue tracker now points to the smoke test as part of DB-002 readiness.

## Wrap-up Checklist (close the session when all boxes are ticked)

- [ ] DB-002 migrations applied (local + staging) with audit logging verified end-to-end.
- [ ] Supabase policies updated, reviewed, and documented with rollback guidance.
- [x] Backend/admin endpoints expose draft/publish history with regression tests in place (DB-002 smoke script covers draft/publish lifecycle).
- [x] Documentation refreshed (`SCHEMA_DECISIONS.md`, `BACKEND.md`, `ADMIN_SETUP.md`, `TESTING_GUIDE.md`).
- [ ] Follow-up tasks for ADM-002, media, and auth backlog captured in `ISSUE_TRACKER.md` with current status.
