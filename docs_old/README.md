# BurKursas Documentation Index

Use this guide to find the right document quickly and understand when it needs an update. When you touch a slice of work, scan the relevant section below and keep the linked docs in sync.

## Core Planning

- `MASTER_PLAN.md` – vision, personas, trimmed launch scope, and deferred roadmap items. Update when scope changes or major bets shift.
- `INFRASTRUCTURE.md` – near-term vs future-state platform plans plus operational checklist. Refresh after infrastructure decisions or tooling upgrades.
- `session/current_session.md` – active working session plan and checklist. As of 2025-11-20 it covers MVP polish after the media rollout; revise at the start/end of each session and archive completed plans under `archive/` with a datestamped filename.
- `archive/` – historical session notes and superseded plans. Drop finished session docs here whenever a new plan replaces them (latest: `docs/archive/2025_11_13_current_session.md`).

## Setup & Delivery

- `DEVELOPMENT_SETUP.md` – canonical local tooling expectations, environment variables, and helper commands. Update when setup steps or scripts change.
- `TESTING_GUIDE.md` – automated test coverage, required checks, and manual QA flows. Refresh after adding new suites or changing the release gate.
- `static_info/` – authoritative curriculum sources (for example `static_info/LBS_programa.md`). Update only when the source material changes and regenerate seeds afterward.
- `user_guides/` – learner/admin-facing product guides. Sync with significant UX updates so support and onboarding stay accurate.

## Reference Hubs

- `references/` – canonical specifications and design notes shared across teams. Update these alongside feature or schema changes and remember to append new entries to `references/README.md`. The front-end runbook now captures the extracted Concept Manager modules (`ConceptFilters`, `ConceptList`, `ConceptEditorDrawer`) so future admin UX tweaks stay consistent.
  - `references/infrastructure/` – stack-specific guides (`BACKEND.md`, `FRONTEND.md`, `SUPABASE.md`). Use its `README.md` for navigation and refresh whenever backend/frontend architecture or Supabase workflows evolve.
  - `references/features/implemented/` – living docs for shipped experiences (`ADMIN_SETUP.md`, etc.). Update as production behaviour changes.
  - `references/features/ideas/` – discovery notes and future concepts (`QUIZ.md`, `STUDY_PATHS.md`, `GAMIFICATION_MODEL.md`). Extend when ideation outcomes shift or new backlog items emerge.
  - Other root references (`API_CONTRACTS.md`, `ISSUE_TRACKER.md`, `SCHEMA_DECISIONS.md`, `PERSONAS_PERMISSIONS.md`, `UX_MOBILE_WIREFRAMES.md`) should be updated in lockstep with schema updates, backlog grooming, role changes, or UX approvals respectively.

## Keeping Docs Fresh

- When implementing a feature, update the matching entry under `references/features/` and tag any schema notes in `SCHEMA_DECISIONS.md`.
- After altering infrastructure or CI, edit `INFRASTRUCTURE.md`, `DEVELOPMENT_SETUP.md`, and the relevant `references/infrastructure/` page.
- At sprint close, archive the old `session/current_session.md`, refresh `MASTER_PLAN.md` if scope moved, and record outcomes in the session log.
- Before releases, run through `TESTING_GUIDE.md` to confirm guard rails are current and capture any new manual smoke steps.
- Keep `references/README.md` in sync when adding or moving reference documents so navigation stays accurate.
- Update `references/ISSUE_TRACKER.md` whenever issues are opened/closed or acceptance criteria change—treat it as the single source of truth for sprint-ready work.
- Reflect admin media workflow changes (bulk selection, modal previews, metadata editing, localisation) in `references/features/implemented/ADMIN_SETUP.md` whenever `/admin/media` or concept attachments evolve so operators can rely on the documented runbook.

> Add a bullet here whenever new documentation appears under `docs/` so contributors understand where it lives and when to maintain it.
