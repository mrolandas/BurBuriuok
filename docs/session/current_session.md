# Current Session Plan – Content Versioning & Media MVP (2025-11-13)

This plan delivers the post-trimmed-launch MVP workstream: finish content versioning safeguards, tighten the admin concept editor, and then implement the media ingestion pipeline (storage, uploads, moderation, embeds).

## Orientation Checklist (run at the start of each work block)

- Open `docs/README.md` for navigation updates and maintenance rules; keep it aligned when new docs appear.
- Review `docs/MASTER_PLAN.md` and `docs/references/features/implemented/ADMIN_SETUP.md` to understand current admin affordances and how media fits the roadmap.
- Study `docs/references/infrastructure/SUPABASE.md` plus `docs/references/SCHEMA_DECISIONS.md` for storage, table, and migration expectations.
- Sync with `docs/references/ISSUE_TRACKER.md` to ensure media tasks are tracked and cross-linked with GitHub issues.
- Skim the archive `docs/archive/2025-11-12_current_session.md` if context about the trimmed-scope sprint is needed.

## Objectives for This Sprint

- Land the content versioning workflow (DB-002) so admin saves remain auditable.
- Finalise concept editor polish (ADM-002) including filters, optimistic updates, and history drawers.
- Stand up the media pipeline: storage foundations, upload APIs, contributor UX, admin moderation upgrades, and sanitised embeds (MEDIA-001 → MEDIA-005).
- Keep documentation, tests, and GitHub issues in lockstep with each deliverable.
- Capture the authentication backlog (AUTH-001 → AUTH-003) so magic-link rollout planning stays unblocked once media MVP stabilises.

## Workstream Milestones & Dependencies

- [ ] **DB-002 – Content Versioning Model**
  - ⏳ Finalise migrations (content drafts/history), Supabase policies, and regression tests.
  - ⏳ Update docs (`SCHEMA_DECISIONS.md`, `BACKEND.md`) with workflow + rollback guidance.
- [ ] **ADM-002 – Concept Editor MVP polish**
  - ⏳ Ship filters, optimistic updates, and history drawer powered by DB-002.
  - ⏳ Document UX flows in `ADMIN_SETUP.md` and align tests.
- [ ] **MEDIA-001 – Storage Foundation**
  - ⏳ Create `media_assets`, `media_asset_variants`, `media_reviews` migrations and bucket policies.
  - ⏳ Document storage topology and maintenance scripts in `SUPABASE.md` and `SCHEMA_DECISIONS.md`.
- [ ] **MEDIA-002 – Media Submission API**
  - ⏳ Implement Express endpoints for contributor uploads, admin review decisions, and audit logging.
  - ⏳ Add contract tests and update `API_CONTRACTS.md`, `BACKEND.md`.
- [ ] **MEDIA-003 – Contributor Upload UX**
  - ⏳ Build feature-flagged uploader modal with progress, metadata validation, and Supabase integration.
  - ⏳ Extend `TESTING_GUIDE.md` with manual QA steps.
- [ ] **MEDIA-004 – Admin Moderation Queue Upgrade**
  - ⏳ Enhance queue views, detail drawers, and decision workflows consuming MEDIA-002 endpoints.
  - ⏳ Trigger dispatcher stub (ADM-004) hooks and refresh `ADMIN_SETUP.md`.
- [ ] **MEDIA-005 – YouTube & External Embeds**
  - ⏳ Define schema, sanitise embeds, add admin preview, and document security posture.
  - ⏳ Update frontend references and example usage.

## Immediate Focus (week of 2025-11-13)

- Close DB-002 gaps: migrations review, policy test coverage, documentation updates.
- Scope ADM-002 polish with UX notes + task breakdown (filters, optimistic saves, history panel).
- Finalise MEDIA-001 acceptance criteria and open corresponding GitHub issue.
- Draft architecture notes for MEDIA-002 (endpoint contracts, rate limits).
- Ensure `ISSUE_TRACKER.md` + GitHub issues reflect the new MVP order.
- Draft AUTH-001/AUTH-002 briefs (magic links, profiles, admin invites) and confirm device-key fallback expectations with product before raising GitHub issues.

## Dependencies & Open Questions

- Uploads continue to rely on device tokens until learner auth ships; revisit this in AUTH-002 planning and update `PERSONAS_PERMISSIONS.md` if the policy shifts.
- Track magic-link adoption readiness (AUTH-001) and define the data needed to retire device-key fallback in AUTH-003; record signals in `MASTER_PLAN.md` appendix.
- Decide on thumbnail generation strategy (client-side vs worker) and record follow-up tasks.
- Verify Render hosting limits for large file uploads; note any constraints in `INFRASTRUCTURE.md`.
- Determine fallback plan for storage outages (retry queue vs user prompts).

## Testing & Verification Plan

- Extend `npm run test` suite with backend contract tests for media endpoints (`tests/media/*.test.ts`).
- Add Playwright smoke covering upload workflow, admin approval, and concept embed render.
- Update `npm run backend:typecheck` coverage to include new services/modules.
- Introduce `npm run media:smoke` (follow-up script) that uploads a sample file to a local bucket, approves it, and fetches the signed asset.
- Insert manual QA steps into `docs/TESTING_GUIDE.md` once the flows are live (upload, approve, revoke, embed view).

## Documentation & Tracking Rules

- Every schema change must ship with entries in `SCHEMA_DECISIONS.md` and `references/infrastructure/SUPABASE.md`, with migration filenames logged in this plan.
- API additions require updates to `docs/references/API_CONTRACTS.md` and backend overview sections.
- Frontend component work should update `references/infrastructure/FRONTEND.md` with new stores/components.
- After each work session, run the commit hook to confirm GitHub issues and `ISSUE_TRACKER.md` are aligned before pushing.

## Risks & Mitigations

- **Large file handling** – limit uploads (size/type) in validation, document rejection messaging, and plan chunked uploads if needed.
- **Embed abuse** – whitelist providers, strip query parameters, and ensure moderation catches unsafe content.
- **Storage costs** – schedule review jobs to archive or delete rejected/orphaned files; automate cleanup scripts.
- **UX complexity** – ship MVP with clear roles (contributor vs admin) and iterate once baseline is stable.

## Session Log

- 2025-11-12: Archived the trimmed-scope Build Sprint plan to `docs/archive/2025-11-12_current_session.md` and established the media-focused plan (storage, uploads, embeds, moderation).
- 2025-11-13: Refreshed the session scope to include content versioning hardening and the full media MVP pipeline; reordered backlog and documentation rules to enforce GitHub sync via commit hook.
- 2025-11-13: Opened AUTH-001/002/003 issues ([#20](https://github.com/mrolandas/BurBuriuok/issues/20), [#21](https://github.com/mrolandas/BurBuriuok/issues/21), [#22](https://github.com/mrolandas/BurBuriuok/issues/22)) after aligning backlog briefs with documentation.

## Wrap-up Checklist (close the session when all boxes are ticked)

- [ ] Storage buckets, migrations, and media API endpoints deployed and documented.
- [ ] Contributor upload UI (including progress and validation) shipped behind a feature flag.
- [ ] YouTube/external embed support live with sanitised rendering and admin metadata controls.
- [ ] Moderation queue upgraded with decision workflows, dispatcher events, and audit logging.
- [ ] Documentation updates complete across `API_CONTRACTS.md`, `SUPABASE.md`, `FRONTEND.md`, `ADMIN_SETUP.md`, `TESTING_GUIDE.md`, and `SCHEMA_DECISIONS.md`.
- [ ] Issue tracker and runbooks updated; follow-up tasks (e.g., thumbnail automation, notifications) captured for future sessions.
