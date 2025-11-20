# Current Session Plan – MVP Polish & Auth Kickoff (2025-11-20)

Media MVP is live (admin uploads, external embeds, PDF support). This session focuses on stabilising the release candidate, capturing documentation debt, and preparing authentication and learner engagement work.

## Orientation Checklist

- Review `docs/references/ISSUE_TRACKER.md` for the remaining MVP items (AUTH-001→003, LX-004→006, ADM-005, MEDIA-005).
- Skim `docs/references/API_CONTRACTS.md`, `docs/references/SCHEMA_DECISIONS.md`, and `docs/references/infrastructure/SUPABASE.md` to confirm media updates are reflected and note gaps for auth/storage follow-ups.
- Re-run the full `npm run test:*` suite (concepts, db002, media001/002) when touching backend logic; update `docs/TESTING_GUIDE.md` if the cadence or coverage changes.
- Align near-term priorities with `docs/references/PHASE_BACKLOG.md`, marking media tasks as shipped and confirming the next learner/auth milestones.

## Objectives for This Block

- Lock down media MVP documentation (admin workflows, API contracts, infra notes, testing playbook) so future contributors have a stable reference.
- Stage authentication groundwork: tighten personas/permissions, confirm Supabase auth flow requirements, and scope UI entry points.
- Prioritise learner queue + quiz planning so LX-004/LX-005 implementation can start once auth scaffolding is underway.
- Capture project status for stakeholders (README + docs index) with clear next steps and release blockers.

## Immediate Focus (week of 2025-11-20)

- Audit `docs/` for stale references to “media pending” and refresh README, references, and session notes with the shipped functionality.
- Identify auth prerequisites (env secrets, role claims, UI scaffolding) and document the proposed rollout order in `PERSONAS_PERMISSIONS.md` + `MASTER_PLAN.md` if changes surface.
- Outline the learner queue MVP (API needs, UI flows, telemetry) so LX-004 scope can be broken into actionable issues.
- Catalogue remaining QA gaps (signed URL expiry, storage cleanup, rate limit regressions) and add any missing manual checks to `TESTING_GUIDE.md`.

## Planning Deliverables

- **Documentation sweep** – README, docs index, infra notes, and admin runbook updated to reflect the current media feature set and list upcoming milestones.
- **Auth prep memo** – Summary of required migrations, secrets, and UI hooks for AUTH-001/002 captured in `docs/references/ISSUE_TRACKER.md` + relevant references.
- **Learner queue outline** – Refined LX-004 acceptance criteria + dependencies noted in backlog/reference docs.
- **Risk register** – Updated `Remaining Risks` and session log with any new concerns around storage, auth, or learner UX.

## Decisions Locked (2025-11-20)

- Admin media uploads ship with automatic asset type detection (image/video/document), 10 MB cap, and PDF preview fallbacks; anything beyond admin-managed assets remains deferred.
- Rate limiting for admin media create/delete stays at `2 per day / burst 2` for uploads and `6 per day / burst 3` for deletes; future adjustments will happen alongside auth rollout.
- Admin documentation must reflect the full media workflow (creation drawer, workspace, concept attachments) before handing work into backlog grooming.
- Next engineering slice after documentation is AUTH-001; MEDIA-005 (external embeds on learner views) follows once auth stubs are in flight and time allows.

## Remaining Risks

- Learner experience still lacks study queue functionality; without interim guidance, the MVP may feel static. Mitigate by drafting LX-004 implementation notes early.
- Authentication introduces new secrets + session handling; without a prep checklist we risk churn during setup. Address via the auth memo deliverable.
- Supabase storage growth is unmonitored; capture a follow-up task to instrument usage metrics and retention policy reminders.
- Signed upload tokens currently log minimal telemetry; analytics requirements should piggyback on ADM-005 to avoid blind spots.

## Documentation & Tracking

- Keep `docs/references/ISSUE_TRACKER.md` statuses aligned with GitHub (MEDIA-001/002 closed, MEDIA-003/004 deferred, MEDIA-005 open).
- Update `docs/references/PHASE_BACKLOG.md` to mark media ingestion as delivered for admin MVP and note contributor scope deferral.
- Note auth prerequisites and learner queue sequencing in `MASTER_PLAN.md` + session log once planning wraps.
- Ensure `TESTING_GUIDE.md` references `npm run test:media002` and highlights rate-limit assertions.

## Next Implementation Tasks

1. AUTH-001 groundwork – seeds for Supabase magic-link auth, environment wiring, and basic login UI scaffolding.
2. LX-004 scoping – break down learner queue MVP into frontend/backend subtasks and confirm API/data requirements.
3. ADM-005 analytics mapping – document media-related events (`asset_created`, `asset_deleted`, signed URL fetch) so instrumentation can follow code updates.
4. MEDIA-005 design notes – capture learner-side embed rendering strategy without blocking auth/queue deliverables.

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
- 2025-11-18: Cleared lingering Svelte accessibility warnings (`npm run frontend:check` now passes clean), localised required-field toasts, and upsized the learner gallery modal for embedded media.
- 2025-11-18: Upgraded `/admin/media` table with checkbox multi-select, bulk delete workflow, and inline media preview (signed URLs + external embeds) while keeping concept attachments in sync.
- 2025-11-18: Upgraded `/admin/media` table with checkbox multi-select, bulk delete workflow, and inline media preview (signed URLs + external embeds) while keeping concept attachments in sync.
- 2025-11-19: Routed concept media fetches through a configurable public API base so GitHub Pages hits the hosted Express app (updates in `frontend/src/lib/api/media.ts`, runtime config, and deploy workflow). Documented the change in infra notes.
- 2025-11-19: Updated GitHub Pages deploy pipeline to inject both admin and public API bases (`deploy-frontend-gh-pages.yml`) ensuring runtime config stays aligned after future key rotations.
- 2025-11-19: Media renders correctly in production; next session will tackle the “Nežinoma sąvoka” placeholder in the `/admin/media` concept column.
- 2025-11-20: Resolved admin media filter desync after reassignment (`applyUpdatedAsset` now prunes items + refreshes list), refreshed documentation (API contracts, testing guide, admin setup, infra index), and noted new QA coverage for modal preview + delete confirmation.
- 2025-11-20: Captured media MVP wrap-up across README/docs, refreshed session goals toward auth + learner queue planning, and re-ran media smoke tests after dropping deprecated payload fields.
- 2025-11-21: Extended admin media uploads with automatic asset type detection (image/video/document), enforced a 10 MB cap, refreshed PDF preview fallbacks across admin/public views, and applied Supabase migration `0012_media_document_support.sql` via `supabase db push` followed by stack restart.

## Wrap-up Checklist (close when all items are complete)

- [ ] Documentation sweep finished (`README.md`, docs index, infra notes, admin runbook).
- [ ] AUTH-001 prep memo drafted (requirements, env wiring, rollout plan).
- [ ] LX-004 learner queue outline added to backlog with refined acceptance criteria.
- [ ] Testing guide updated with media rate-limit + signed URL QA steps.
