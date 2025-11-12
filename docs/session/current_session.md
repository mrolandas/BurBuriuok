# Current Session Plan – Media Intake & Embeds (2025-11-12)

We are pivoting from trimmed-launch hierarchy work to the media experience. This session plan drives everything required to accept contributor uploads, support YouTube-style embeds, review submissions, and surface approved media inside concepts.

## Orientation Checklist (run at the start of each work block)

- Open `docs/README.md` for navigation updates and maintenance rules; keep it aligned when new docs appear.
- Review `docs/MASTER_PLAN.md` and `docs/references/features/implemented/ADMIN_SETUP.md` to understand current admin affordances and how media fits the roadmap.
- Study `docs/references/infrastructure/SUPABASE.md` plus `docs/references/SCHEMA_DECISIONS.md` for storage, table, and migration expectations.
- Sync with `docs/references/ISSUE_TRACKER.md` to ensure media tasks are tracked and cross-linked with GitHub issues.
- Skim the archive `docs/archive/2025-11-12_current_session.md` if context about the trimmed-scope sprint is needed.

## Objectives for the Media Slice

- Stand up a resilient uploader that handles images and documents with Supabase Storage and generates signed URLs.
- Enable concepts to reference external media, starting with YouTube video embeds that respect moderation flow.
- Provide admins with queue management to approve, reject, or request changes on submissions.
- Capture all schema, API, and UX changes in the reference docs so future assistants inherit accurate guidance.

## Workstream Milestones

- [ ] **Storage & API foundation** – finalise Supabase buckets, migrations (`media_assets`, `media_reviews`), and Express endpoints for create/upload/sign/approve flows.
  - ⏳ Confirm bucket naming and security policies (`public`, `restricted`, signed URL expirations) in `references/infrastructure/SUPABASE.md`.
  - ⏳ Implement `POST /api/v1/media/submissions` for resumable uploads and `POST /api/v1/admin/media/:id/decision` with audit logging.
- [ ] **Contributor upload UX** – design/admin UI updates allowing file selection, metadata capture, and upload progress with validation messages.
  - ⏳ Add learner-facing upload entry point (eventually hidden behind a flag) and admin panel detail views.
  - ⏳ Integrate storage signatures and show thumbnail previews using approved media.
- [ ] **YouTube & external embeds** – define schema to store provider metadata, add validation for whitelisted domains, and render approved embeds on concept pages.
  - ⏳ Extend shared validation schemas so admins can capture video URL, caption, language, and attribution.
  - ⏳ Ensure frontend sanitises `iframe` parameters and provides accessible fallbacks.
- [ ] **Moderation queue & notifications** – upgrade admin console to prioritise pending assets, capture decision reasons, and trigger dispatcher hooks.
  - ⏳ Surface SLA indicators, batch actions, and filter/search enhancements in the queue UI.
  - ⏳ Wire the dispatcher stub to log decisions and send placeholder events for future Slack/email integrations.
- [ ] **Documentation & ops readiness** – update reference docs, testing scripts, and runbooks so media workflows remain reproducible.
  - ⏳ Record schema updates in `SCHEMA_DECISIONS.md`, document CLI/storage steps in `SUPABASE.md`, and add manual QA steps in `TESTING_GUIDE.md`.
  - ⏳ Create runbooks for rotating storage keys and cleaning orphaned assets.

## Immediate Focus (week of 2025-11-12)

- Draft migrations and Supabase storage configuration required for `media_assets`, `media_asset_variants`, and `media_reviews` tables.
- Prototype the backend upload/sign endpoint contract and align with the frontend `adminFetch` helpers.
- Outline frontend component skeletons for contributor upload modal and admin review drawer, noting shared state and stores.
- Add checklist items to `references/ISSUE_TRACKER.md` mapping each milestone bullet to issues/PRs.
- Document YouTube embed validation rules (allowed hosts, parameter sanitisation) ahead of implementation.

## Dependencies & Open Questions

- Confirm whether uploads require authenticated learners or can rely on device tokens; capture the decision in `PERSONAS_PERMISSIONS.md`.
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

- Every schema change must ship with entries in `SCHEMA_DECISIONS.md` and `references/infrastructure/SUPABASE.md` plus migration filenames logged in this plan.
- API additions require updates to `docs/references/API_CONTRACTS.md` and backend overview sections.
- Frontend component work should update `references/infrastructure/FRONTEND.md` with new stores/components.
- Keep `references/ISSUE_TRACKER.md` synced after each GitHub issue/PR merge tied to media work.

## Risks & Mitigations

- **Large file handling** – limit uploads (size/type) in validation, document rejection messaging, and plan chunked uploads if needed.
- **Embed abuse** – whitelist providers, strip query parameters, and ensure moderation catches unsafe content.
- **Storage costs** – schedule review jobs to archive or delete rejected/orphaned files; automate cleanup scripts.
- **UX complexity** – ship MVP with clear roles (contributor vs admin) and iterate once baseline is stable.

## Session Log

- 2025-11-12: Archived the trimmed-scope Build Sprint plan to `docs/archive/2025-11-12_current_session.md` and established this media-focused plan (storage, uploads, embeds, moderation).

## Wrap-up Checklist (close the session when all boxes are ticked)

- [ ] Storage buckets, migrations, and media API endpoints deployed and documented.
- [ ] Contributor upload UI (including progress and validation) shipped behind a feature flag.
- [ ] YouTube/external embed support live with sanitised rendering and admin metadata controls.
- [ ] Moderation queue upgraded with decision workflows, dispatcher events, and audit logging.
- [ ] Documentation updates complete across `API_CONTRACTS.md`, `SUPABASE.md`, `FRONTEND.md`, `ADMIN_SETUP.md`, `TESTING_GUIDE.md`, and `SCHEMA_DECISIONS.md`.
- [ ] Issue tracker and runbooks updated; follow-up tasks (e.g., thumbnail automation, notifications) captured for future sessions.
