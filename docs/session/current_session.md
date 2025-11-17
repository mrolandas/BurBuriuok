# Current Session Plan – Media Roadmap Kickoff (2025-11-17)

This block pivots from ADM-002 polish to preparing the media intake pipeline and lining up auth dependencies for the next implementation cycle.

## Orientation Checklist

- Review `docs/references/ISSUE_TRACKER.md` for MEDIA-001→005 and AUTH-001→003 scope notes.
- Revisit `docs/references/features/implemented/ADMIN_SETUP.md` to confirm current admin affordances before layering media workflows.
- Skim `docs/references/API_CONTRACTS.md`, `docs/references/SCHEMA_DECISIONS.md`, and `docs/references/infrastructure/SUPABASE.md` so storage, API, and policy changes stay consistent.
- Check `docs/references/PHASE_BACKLOG.md` for roadmap sequencing when proposing schedule shifts.

## Objectives for This Block

- Finalise the MEDIA-001 storage + migration blueprint so engineering work can begin immediately afterward.
- Define MEDIA-002 REST contracts (submission + admin review) and document validation paths.
- Capture contributor/admin UX requirements that will drive MEDIA-003 and MEDIA-004 implementation briefs.
- Align AUTH-001→003 scope with media reviewer access so onboarding and moderation can launch together.

## Immediate Focus (week of 2025-11-17)

- Draft Supabase bucket configuration, table layouts, and migration order for `media_assets` and supporting tables; record outcomes in `docs/references/infrastructure/SUPABASE.md` and `docs/references/SCHEMA_DECISIONS.md`.
- Outline learner + admin endpoints, request/response payloads, and error handling in `docs/references/API_CONTRACTS.md`, including rate-limit and audit requirements.
- List critical UX affordances (upload progress, moderation filters, SLA badges) and link them back to `MEDIA-003`/`MEDIA-004` rows in `docs/references/ISSUE_TRACKER.md`.
- Review AUTH briefs to ensure admin invite + role management covers media reviewers; note any updates needed in `docs/references/PERSONAS_PERMISSIONS.md`.

## Planning Deliverables

- **MEDIA-001** – Inventory target buckets (public vs restricted), policy helpers, and migration filenames; define verification checklist and document rollback strategy.
- **MEDIA-002** – Specify REST resources (`/api/v1/media/submissions`, `/api/v1/admin/media`, decision endpoints), payload schemas, quotas, and telemetry hooks.
- **MEDIA-003** – Capture contributor upload UX flows (flag strategy, progress indicators, validation copy) and note feature flag requirements for rollout.
- **MEDIA-004** – Outline moderation queue layout updates, SLA badge logic, decision drawer states, and integration hooks for dispatcher stubs.
- **MEDIA-005** – List supported providers, embed sanitisation rules, localisation strategy, and accessibility acceptance criteria.
- **AUTH alignment** – Map reviewer invite flow, required roles/claims, and migration or feature flag changes needed alongside media launch.

## Dependencies & Open Questions

- Confirm storage size/cost assumptions with infrastructure docs before locking bucket lifecycle policies.
- Decide whether moderation queue enhancements can extend the Concept Manager shell or require a dedicated `/admin/media` route.
- Determine initial safeguards for upload abuse (file type, size, rate limits) and who owns enforcement.
- Clarify whether contributor uploads require immediate localization support or if English-first is acceptable for MVP.

## Documentation & Tracking

- Update `docs/references/infrastructure/SUPABASE.md`, `docs/references/SCHEMA_DECISIONS.md`, and `docs/references/API_CONTRACTS.md` as decisions land.
- Reflect plan progress in `docs/references/ISSUE_TRACKER.md` (MEDIA-001→005, AUTH-001→003) so GitHub issue creation is turnkey.
- Note UX research or design follow-ups in `docs/references/features/ideas/` if new concepts emerge during scoping.

## Session Log

- 2025-11-17: Archived ADM-002 session and kicked off media roadmap planning focused on storage, API surface, and auth alignment.
- 2025-11-17: Broke down MEDIA-001→005 deliverables and documented planning artefacts required before implementation starts.

## Wrap-up Checklist (close when all items are complete)

- [ ] MEDIA-001 migration + bucket plan documented and reviewed.
- [ ] MEDIA-002 endpoint contracts captured with error + audit notes.
- [ ] MEDIA-003/004 UX requirements summarised and linked in the issue tracker.
- [ ] AUTH backlog updated to reflect media reviewer access + invite needs.
- [ ] Follow-up tasks noted in `docs/references/ISSUE_TRACKER.md` and ready for issue creation.
