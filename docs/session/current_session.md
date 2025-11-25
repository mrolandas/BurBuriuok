# Current Session Plan – Auth & Progress Kickoff (2025-11-25)

With media MVP complete, this session pivots to authentication, admin user management, and learner progress tracking. Everything else moves to the removed-scope log (`docs/REMOVED_FROM_SCOPE.md`).

## Orientation Checklist

- Review `docs/references/ISSUE_TRACKER.md` for the active AUTH and PROG tickets.
- Confirm Supabase auth prerequisites (`PERSONAS_PERMISSIONS.md`, `API_CONTRACTS.md`, `SCHEMA_DECISIONS.md`) and identify missing migrations.
- Audit current admin tooling to ensure the forthcoming user management surface slots cleanly into `/admin` without regressing existing flows.
- Inventory progress data touchpoints (device-key usage, concept completion events) before drafting the new persistence model.

## Objectives for This Block

- Ship the authentication foundation (magic-link login, role claims) and expose an admin UI for inviting/revoking users.
- Design and implement core learner progress tracking (storage model, API endpoints, admin insight views).
- Retire deferred work items from active docs, capturing them in `docs/REMOVED_FROM_SCOPE.md` for future review.
- Keep reference material (`MASTER_PLAN.md`, `ISSUE_TRACKER.md`, `PERSONAS_PERMISSIONS.md`) aligned with the tightened scope.

## Immediate Focus (week of 2025-11-25)

- Finalise AUTH-001 requirements (environment variables, Supabase config, login UX) and update developer setup notes accordingly.
- Draft the admin user management console requirements (invite list, role toggles, audit trail) and capture acceptance criteria in the tracker.
- Model the progress tracking schema (tables, events, API contracts) and prototype the Supabase migrations needed for PROG-001.
- Prepare QA coverage updates: document auth flow smoke tests and progress persistence checks for `docs/TESTING_GUIDE.md`.

## Planning Deliverables

- **Auth implementation brief** – Secrets checklist, migration plan, and UX outline for AUTH-001→002.
- **Admin user management spec** – Wireframe notes plus API + UI requirements for the new `/admin/users` surface.
- **Progress tracking plan** – Data model, API endpoints, and analytics hook list for PROG-001/002.
- **Scope change log** – Populate `docs/REMOVED_FROM_SCOPE.md` and cross-link from master docs.

## Decisions Locked (2025-11-25)

- Media enhancements beyond the MVP (embeds, analytics, contributor flows) are out of scope until auth + progress land.
- Authentication work takes precedence: no further learner UX features will start until AUTH-001→003 and the user management console ship.
- Progress tracking replaces the queued learner-flow experiments; queue/quiz initiatives return only after persistence is stable.

## Remaining Risks

- Supabase auth introduces new operational burden (token rotation, invite flows). Without a thorough runbook we risk production support gaps.
- Device-key migration path must be defined early to avoid data loss when progress moves to authenticated profiles.
- Admin surface expansion could reintroduce `/admin` performance issues; ensure pagination/search requirements are part of the spec.
- Progress analytics will require careful messaging to avoid privacy concerns; coordinate documentation with roadmap updates.

## Documentation & Tracking

- Keep AUTH/PROG entries in `docs/references/ISSUE_TRACKER.md` up to date as scope solidifies.
- Update `docs/MASTER_PLAN.md` once auth milestones are scheduled and removed scope is logged.
- Refresh `docs/TESTING_GUIDE.md` after auth/progress smoke tests are drafted.
- Link any new migrations or policies in `docs/references/SCHEMA_DECISIONS.md`.

## Next Implementation Tasks

1. AUTH-001 groundwork – seeds for Supabase magic-link auth, environment wiring, and basic login UI scaffolding.
2. AUTH-002 – admin invite workflow UI + backend endpoints.
3. ADM-006 – build `/admin/users` management console with invite list, role toggle, and activity log.
4. PROG-001 – implement progress persistence schema + API surface.
5. PROG-002 – wire learner UI to the new progress endpoints and surface basic admin insights.

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
- 2025-11-20: Captured media MVP wrap-up across README/docs, refreshed session goals toward auth planning, and re-ran media smoke tests after dropping deprecated payload fields.
- 2025-11-25: Cleared legacy branches, recorded scope removals, and pivoted session goals to authentication, admin user management, and progress tracking.
- 2025-11-21: Extended admin media uploads with automatic asset type detection (image/video/document), enforced a 10 MB cap, refreshed PDF preview fallbacks across admin/public views, and applied Supabase migration `0012_media_document_support.sql` via `supabase db push` followed by stack restart.

## Wrap-up Checklist (close when all items are complete)

- [ ] Auth implementation brief completed and linked from references.
- [ ] Admin user management spec documented and tracked.
- [ ] Progress tracking plan captured (schema + API).
- [ ] Scope change log (`docs/REMOVED_FROM_SCOPE.md`) populated and cross-referenced.
