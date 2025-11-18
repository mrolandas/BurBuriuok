# Current Session Plan – Media Roadmap Kickoff (2025-11-17)

This block pivots from ADM-002 polish to preparing an admin-only media upload pipeline and lining up minimal auth changes for the next implementation cycle.

## Orientation Checklist

- Review `docs/references/ISSUE_TRACKER.md` for MEDIA-001→005 and AUTH-001→003 scope notes.
- Revisit `docs/references/features/implemented/ADMIN_SETUP.md` to confirm current admin affordances before layering media workflows.
- Skim `docs/references/API_CONTRACTS.md`, `docs/references/SCHEMA_DECISIONS.md`, and `docs/references/infrastructure/SUPABASE.md` so storage, API, and policy changes stay consistent.
- Check `docs/references/PHASE_BACKLOG.md` for roadmap sequencing when proposing schedule shifts.

## Objectives for This Block

- Finalise the MEDIA-001 storage + migration blueprint for a single admin-managed upload path.
- Define MEDIA-002 REST contracts for admin uploads and retrieval, keeping learner endpoints out of scope.
- Document lightweight admin UI affordances for attaching media to concepts (no moderation queue needed).
- Align AUTH-001→003 scope with current admin role usage so no extra reviewer onboarding is required yet.

## Immediate Focus (week of 2025-11-17)

- Draft Supabase bucket configuration, table layout, and migration order for `media_assets`; record outcomes in `docs/references/infrastructure/SUPABASE.md` and `docs/references/SCHEMA_DECISIONS.md`.
- Outline admin-only endpoints (`POST /api/v1/admin/media`, `GET /api/v1/admin/media/:id`, listing helpers) in `docs/references/API_CONTRACTS.md`, including validation, rate limits, and signed URL policy.
- Sketch the minimal admin UI flow (upload button + attachment picker) in `docs/references/features/implemented/ADMIN_SETUP.md` so ADM contributors can follow it after implementation.
- Review AUTH briefs to confirm the existing `admin` role suffices; capture any residual notes in `docs/references/PERSONAS_PERMISSIONS.md`.

## Planning Deliverables

- **MEDIA-001** – Lock storage bucket choice, table schema, seed data expectations, and rollback checklist (see `docs/references/SCHEMA_DECISIONS.md` + `docs/references/infrastructure/SUPABASE.md`). Migration `0011_media_admin_mvp.sql` + smoke test `npm run test:media001` now cover implementation.
- **MEDIA-002** – Document admin upload/read endpoints, payload schemas, and signed URL strategy; learner submission path explicitly deferred (see `docs/references/API_CONTRACTS.md` Implementation Checklist).
- **MEDIA-005 (Slice)** – Record provider whitelist and sanitised embed rules for admin-curated media that will surface on the learner side.
- **Deferred Notes** – Capture future scope for MEDIA-003/004 (contributor uploads & moderation) in `docs/references/ISSUE_TRACKER.md` with a clear “post-admin launch” tag.
- **AUTH alignment** – Note that current `admin` role covers uploads; additional reviewer onboarding is shelved until contributor flows revive.

## Decisions Locked (2025-11-17)

- Storage uses a single Supabase bucket `media-admin` with RLS granting read/write to admins only; assets are published via signed URLs or CDN transforms generated at read time. Standard storage tier stays in place with monthly reviews.
- Schema for MEDIA-001 trims to `media_assets` (id, concept_id, asset_type enum, storage_path, created_by, created_at) and optional `media_asset_variants` for resized images. No `media_reviews` table required in this phase.
- Admin UI now exposes a dedicated `/admin/media` workspace and concept editor attachment panel for end-to-end admin media management.
- Upload safeguards MVP: accept only `image/*` and `video/mp4`, cap size at 50 MB per file, throttle by admin account (existing rate limiter). Manual judgment from the uploading admin replaces moderation workflow.
- Metadata launches English-only; schema keeps optional locale columns but we will populate `en` exclusively until contributor flows return.
- AUTH scope unchanged: the existing `admin` role covers uploads. Invite workflow remains in AUTH-002 but is low priority while contributors stay out of scope.

## Remaining Risks

- Storage costs remain low but we still need an infra reminder to revisit lifecycle policies once uploads exceed admin-produced assets.
- Relying on manual judgment increases the chance of an admin uploading the wrong asset; mitigate by adding an upload checklist in `ADMIN_SETUP.md`.

## Documentation & Tracking

- Update `docs/references/infrastructure/SUPABASE.md`, `docs/references/SCHEMA_DECISIONS.md`, and `docs/references/API_CONTRACTS.md` as decisions land.
- Reflect plan progress in `docs/references/ISSUE_TRACKER.md` (MEDIA-001→005, AUTH-001→003) so GitHub issue creation is turnkey.
- Note UX research or design follow-ups in `docs/references/features/ideas/` if new concepts emerge during scoping.

## Next Implementation Tasks

- MEDIA-002 hardening – Document the admin upload runbook (`ADMIN_SETUP.md`), surface rate-limit guidance in UI copy, and add a QA checklist covering upload failures and signed URL expiry. (Follow-up on [#23](https://github.com/mrolandas/BurBuriuok/issues/23))
- MEDIA-005 planning – Finalise whitelist and embed sanitisation approach so external media can surface on learner views without blocking deployment. (Tracked in [#19](https://github.com/mrolandas/BurBuriuok/issues/19))
- MEDIA telemetry – Scope lightweight logging for admin media create/delete + signed URL fetch events to feed future analytics (ties into [#14](https://github.com/mrolandas/BurBuriuok/issues/14)).

## Session Log

- 2025-11-17: Archived ADM-002 session and kicked off media roadmap planning focused on storage, API surface, and auth alignment.
- 2025-11-17: Broke down MEDIA-001→005 deliverables and documented planning artefacts required before implementation starts.
- 2025-11-17: Rescoped media MVP to admin-only uploads, dropping contributor moderation until after launch.
- 2025-11-17: Captured MEDIA-001 rollout/rollback procedures and MEDIA-002 implementation checklist to unblock upcoming migrations and backend work.
- 2025-11-18: Applied migration `0011_media_admin_mvp.sql` to Supabase and added automated smoke `npm run test:media001` to validate admin-only RLS.
- 2025-11-18: Updated migration guards to suppress redundant drop notices and revalidated (`npx supabase db push --yes`, `npm run test:media001`).
- 2025-11-18: Shipped MEDIA-002 admin media API (`POST/GET/DELETE /admin/media`, signed URL helper), refreshed docs, and added `npm run test:media002` smoke coverage.
- 2025-11-18: Extended rate limiting for admin media create/delete buckets, documented env knobs, and updated smoke coverage to assert `RATE_LIMITED` responses.
- 2025-11-18: Delivered `/admin/media` workspace (filters, search, detail drawer, delete + signed URL actions) and wired admin dashboard link.
- 2025-11-18: Implemented MEDIA-002 creation drawer with automatic Supabase upload hand-off and external link validation (upload + external happy paths + error surfacing).
- 2025-11-18: Added Concept Manager media panel with attachment list, creation drawer shortcut, and inline delete to keep concepts free of orphaned assets.

## Wrap-up Checklist (close when all items are complete)

- [x] MEDIA-001 migration + bucket plan documented and reviewed.
- [x] MEDIA-002 admin endpoint contracts captured with validation + signed URL notes.
- [x] Media attachment UX documented in `ADMIN_SETUP.md` for admin-only flow.
- [x] Deferred contributor scope noted in `docs/references/ISSUE_TRACKER.md` with clear next-step markers.
- [x] Follow-up tasks noted in `docs/references/ISSUE_TRACKER.md` and ready for issue creation.
