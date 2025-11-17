# Master Plan

## Vision

Deliver a Lithuanian-first, mobile-native learning companion that guides aspiring skippers through the entire Lietuvos Buriavimo Asociacijos curriculum, surfaces prerequisite knowledge when it matters, and keeps motivation high through timely practice loops and light gamification. English equivalents remain contextual hints for terminology only; the rest of the experience stays Lithuanian.

## Source Material

- Primary terminology and scope come from `static_info/LBS_programa.md` (Lietuvos Buriavimo Asociacijos Vidaus vandenu jachtos vado mokymo programa, 2024-10-15 redakcija).
- Supplementary insights originate from in-person lectures, course materials, and student notes.

## Target Personas

1. **First-time student** – navigates the curriculum entirely on a phone, needs structured guidance, prerequisite hints, and confidence boosts.
2. **Returning skipper** – dips into specific topics for refreshers, expects fast search, bookmarking, and minimal friction.
3. **Instructor / Admin** – curates concepts, approves media, and keeps the canonical structure clean. (Global admin role for now; instructor-role moderation later.)

## Current Decisions

- Lithuanian is the default language; English appears only as secondary terminology labels.
- A single global admin manages content and media approvals in early releases.
- PDF exports or external LMS integrations are explicitly out of scope.
- UI is designed mobile-first (sub-6" screens) with responsive enhancements for tablet/desktop.
- Media uploads are limited to admins for the MVP; contributor submissions and moderation queues return in a later phase.
- Learner authentication launches with Supabase magic-link sign-in while device-key progress syncing remains available until the dedicated retirement task (AUTH-003) ships.

## Experience Blueprint

### Learner Journey

- Landing screen highlights curriculum sections as “boards” with progress meters and estimated study time.
- Expanding a section reveals a collapsible tree; each node advertises prerequisites and next steps so learners can navigate depth without losing context. Prerequisite badges currently show zero counts until the public dependency view is exposed.
- Concept detail pages act as the learner “workspace,” keeping definition, media, and progression controls in one stay-put view.
- Guided study sessions advance learners through Ready/Needs Review/Completed queues without hopping back to the tree.
- Quick search lives in a persistent bottom navigation item, clustering results by concept/module/media.

### Concept View

- Definition and translation front and center, followed by prerequisite badges that open inline drawers (no back-navigation needed).
- “Next concepts” suggestions nudge learners through recommended sequences and queue shortcuts.
- Media carousel (images, videos, PDFs) is swipe-friendly and lazy loaded.
- Immediate actions: mark mastered, add to study queue, launch micro-quiz.
- Local session state tracks current concept progress so learners can move through a run without revisiting the tree.

### Guided Study & Practice

- Curated “study paths” bundle concepts into manageable runs with embedded quizzes and reflections.
- Adaptive review targets concepts marked as unclear or missed in quizzes, scheduling flashcards automatically.
- Ready/Needs Review/Completed queues power continuous study sessions with minimal navigation friction.
- Gentle nudges (push/email later) celebrate streaks and remind learners when progress stalls.

### Admin Workspace

- Dashboard summarises pending media submissions, draft content, and high-impact concepts (e.g., high failure rate).
- Editors can add/edit/delete nodes, items, and concepts inline with validation, dependency linking, and preview diffs prior to publish.
- Inline concept editing is now accessible straight from `/concepts/[slug]` when the global “Aktyvuoti Admin” toggle is active, reflecting the persistent `adminMode` store shared across the shell.
- Section board cards on the learner homepage now expose inline edit controls when admin mode is toggled on, reusing the same modal and validation helpers that power concept editing.
- Concept manager orchestration lives in `ConceptManager.svelte`, while extracted modules (`components/ConceptFilters.svelte`, `components/ConceptList.svelte`, `components/ConceptEditorDrawer.svelte`) and shared admin types in `types.ts` keep toolbar/search/list/drawer logic modular for faster iteration.
- Versioning supports draft vs published states plus basic history for rollback.

### Media Moderation Flow

> Deferred until contributor uploads resume; the admin-only MVP relies on manual judgement during upload.

- When reopened, authenticated contributors will submit media with metadata (type, language, captions, credit).
- Submissions will queue for admin approval; automated checks will enforce quota, MIME type, file size, and malicious content scanning.
- Approved media will inherit contributor attribution and can be revoked or edited at any time.

## Engagement & Gamification

- Lightweight XP system tracks completed concepts, streaks, and milestones per module.
- Badges celebrate key achievements (“Rigging Ready”, “Safety Champion”).
- “Study later” queue and spaced repetition reminders keep learners returning.
- Analytics drive personalised recommendations (e.g., “You struggled with terminology on navigation—review these before moving on”).

## Technical Direction

### Backend & Data

- Supabase remains the system of record: curriculum nodes, items, concepts, prerequisites, media assets, user progress, and gamification stats.
- Future Express (or similar) service mediates requests for rate limiting, validation, and moderation workflows.
- Content edits follow draft/publish flags with audit logs to track who changed what and when.

### Frontend & UX

- SvelteKit (or equivalent) mobile-first UI with offline-friendly caching for content and progress snapshots.
- Persistent menu supporting quick access to curriculum, search, practice, and profile areas.
- Context-aware drawers and overlays to show prerequisite content without destructive navigation.
- Modular component library (AppShell, curriculum board/tree, concept view, study runner) keeps data fetching, layout, and interaction logic separated for easy iteration.

### Media Handling

- Media uploads defer to a post-auth milestone; initial authentication work (AUTH-001/002) must land before learner-facing storage opens up beyond the current admin tooling.

### Authentication & Sessions

- Supabase Auth backs the learner experience with magic-link sessions; admin invites live inside AUTH-002 so privileged accounts stay curated.
- Device-key progress tracking continues as a fallback until AUTH-003 introduces migration tools and observability around session adoption.
- The backend enforces persona roles via `app_role` claims and continues to treat unauthenticated learners as `guest` users with read-only access.

## Trimmed Launch Scope (2025-11-07)

### Included for Launch

- Admin authoring with inline concept editing plus a hierarchy management UI that lets editors drag concepts between sections/subsections and promote/demote nodes across levels.
- Learner core experience: curriculum boards, collapsible tree navigation, concept workspace, and global search backed by live Supabase data.
- Backend foundations covering curriculum/progress read endpoints, progress mutations with rate-limiting shim, audit logging, and deployable migrations/seeds.
- Automation baseline: lint/unit/content checks, CI integration, and a first-release deployment checklist.
- Architectural seams for future work: moderation-ready enums, backend event dispatcher stub, learner progression data shape (with optional history table), analytics event wrapper, rich content version metadata, and a defined media storage pipeline.

### Deferred (Post-Launch Reference)

- Moderation queue UI, approval workflows, and notification transports (Slack/email) wired to the dispatcher seam.
- Learner practice loop (queue store, Supabase persistence, study runner HUD, spaced repetition scheduler) and knowledge-check module.
- Gamification layer: streaks, XP, badges, adaptive recommendations, and analytics dashboards beyond the existing instrumentation seam.
- Media submission intake, automated scanning, and contributor management beyond the defined storage seam.
- Advanced moderation, instructor-role granularity, and social/community features (forums, discussions, reactions).
- Comprehensive analytics taxonomy implementation, engagement nudges, and outbound messaging.

## Planning Status (2025-11-07)

- Trimmed launch scope captured in `docs/session/current_session.md`; full historical session notes archived under `docs/archive/` (see `2025-11-07-current-session.md`).
- 2025-11-09: Admin AppShell refresh merged to `main`, inline concept editing reorganised for mobile, backend admin saves hardened against Supabase auth failures, and Supabase keys rotated with schema grants restored; documentation refresh queued.
- 2025-11-10 (evening): Section board inline editing shipped—the learner homepage now surfaces edit affordances for root curriculum nodes when admin mode is active, persisting title/summary updates via the admin curriculum node endpoint and echoing toast feedback on success.
- Planning deliverables are consolidated in `docs/references/SCHEMA_DECISIONS.md`, `docs/references/MODERATION_SLA.md`, `docs/references/ANALYTICS_EVENTS.md`, and `docs/references/ISSUE_TRACKER.md`.
- 2025-11-09 (evening): Curriculum tree admin UX now ships drag-and-drop reorder with cancel/apply confirmation banner, gated pending highlights, auto-expanding edit/delete affordances, and restored “Pridėti poskyrį” controls pending backend item CRUD alignment.
- Regression guardrail automation (seeds, curriculum snapshot, markdown validation) runs locally via Husky and in CI via `content-seed-guard.yml`.
- No standalone wireframing assets exist beyond the written UX notes in `docs/references/UX_MOBILE_WIREFRAMES.md`; there are currently no screenshots to maintain.
- Engineering is cleared to begin backend and frontend implementation using the backlog seeds in `docs/references/ISSUE_TRACKER.md` and the roadmap below.
- Build Sprint 1 backlog items now exist as GitHub issues (#1-#8) opened via the GitHub CLI, with cross-links maintained in `docs/references/ISSUE_TRACKER.md`.
- `npm run content:seed:dependencies` generates `supabase/seeds/seed_curriculum_dependencies.sql`, keeping prerequisite data aligned with the schema migration.
- Remote Supabase project refreshed on 2025-11-04 with migrations through `0008` and regenerated prerequisite seeds.
- Express API scaffold landed under `backend/src/` with read-only routes for curriculum, concepts, and dependencies plus `npm run backend:*` scripts.
- Progress write endpoints (`PUT`/`DELETE /api/v1/progress`) shipped with zod validation, device-key enforcement, and in-memory rate limiting.
- Audit logging utility persists admin content mutations to `content_versions` and `content_version_changes` via Supabase service client.
- `0007_content_versioning_history.sql` extends the schema with `content_version_changes` and triggers that auto-increment versions and stamp audit metadata.

- Supabase Storage plan now centres on a single admin-only bucket with signed URLs; contributor buckets return with MEDIA-003.
- Moderation status tables (`media_reviews`, extended enums) remain deferred until contributor submissions come back online.
- Automated scanning pipeline (e.g., via edge function or scheduled job) to flag suspicious uploads before admin review.

## Implementation Roadmap

### Phase 0 – Platform Foundation

- [x] Generate canonical curriculum + concept seeds and push baseline Supabase schema.
- [x] Model prerequisite relationships (node/concept dependency tables + seed alignment).
- [x] Define draft/published states and change history tables for content.
- [x] Outline API surface (read, progress, admin) with contracts documented (`docs/references/API_CONTRACTS.md`).
- [x] Prepare baseline mobile wireframes for curriculum board and concept view (`docs/references/UX_MOBILE_WIREFRAMES.md`).

### Phase 1 – Admin Content Management & Moderation Foundations

- [ ] Complete admin CRUD + hierarchy management (drag/drop, promote/demote) for nodes, items, and concepts, sharing validation between frontend and backend.
- [ ] Ship the content versioning workflow (draft → review → publish) with audit logging, rollback notes, and documentation updates.
- [ ] Stand up the admin media upload pipeline (upload surface, metadata capture) and record storage decisions; moderation queue deferred.
- [ ] Build the initial moderation queue with approve/reject actions, SLA signalling, and Slack/email notification stubs wired to the dispatcher seam. _(Deferred until contributor uploads return.)_
- [ ] Harden validation, Supabase policies, and persona-based UI controls per `docs/references/PERSONAS_PERMISSIONS.md`.
- [ ] Document every schema change in `SCHEMA_DECISIONS.md` and update reference guides as features land.

### Phase 2 – Learner Experience Core Flows

- [x] Ship curriculum navigation (section boards, collapsible tree, prerequisite indicators – counts currently placeholder until public dependency view).
- [ ] Finish concept detail view (prerequisite/next drawers, media carousel, inline admin hooks) and polish UX copy.
- [ ] Create the study session runner with progress HUD, confidence capture, and queue transitions.
- [ ] Persist Ready/Needs Review/Completed queues to Supabase and sync with local state.
- [ ] Deliver global search with grouped results, filters, and deep links into concept/admin views.
- [ ] Kick off personalised recommendations leveraging progression and queue data.

### Phase 3 – Engagement & Analytics Layer

- [ ] Implement gamification tables and UI (streaks, XP, badges) per `references/features/ideas/GAMIFICATION_MODEL.md`.
- [ ] Launch adaptive review/spaced repetition scheduler with learner-facing flashcard UI.
- [ ] Add nudges/notifications for streak breaks, study gaps, and path completion milestones.
- [ ] Instrument analytics events (curriculum traversal, practice outcomes) and surface admin dashboards.
- [ ] Strengthen telemetry pipelines, logging, and monitoring before scaling engagement.

### Phase 4 – Social & Community Features

- [ ] Introduce concept-level discussions, replies, reactions, and moderation controls.
- [ ] Create forum channels with tagging for broader navigation/safety/community topics.
- [ ] Wire notifications for mentions/replies and unify moderation workflows.
- [ ] Establish long-term community guidelines, escalation tooling, and analytics for social health.

## Content Development Approach

- Progress section by section, validating dependency mapping as each batch lands.
- Maintain versioned content files so database migrations remain reproducible.
- Enlist subject-matter reviewers for Lithuanian phrasing before publish.
- Keep per-module documentation updated (purpose, data source, QA checklist).
- Limit source files to manageable sizes (<200 lines when practical) and add comments where logic or data wrangling becomes non-obvious.

## Dependencies and Constraints

- Usage assumption: ~90% mobile, 10% tablet/desktop; design, caching, and performance budgets follow suit.
- Accessibility: WCAG AA baseline, high-contrast option for outdoor viewing, screen-reader friendly navigation tree.
- Security: enforce authentication for any write action; apply rate limiting, quota enforcement, and audit logging from the first release that supports uploads.
- Maintain AI coding agent friendliness via consistent structure, explicit interfaces, and current docs.

## Open Questions

- How granular should study path authoring be (manual playlists vs generated sequences)?
- What service handles automated media scanning (Supabase Edge Function vs external provider)?
- Do we need per-module admin permissions before instructor moderation begins?
- What metrics define success for engagement features (minimum streak length, quiz accuracy thresholds, etc.)?
- How will we collect structured feedback from learners (in-app form, periodic survey, or later forum integration)?

## Appendix

### Device-Key Sunset Sketch

- Target post-AUTH-003 once operational telemetry confirms magic-link adoption above the agreed threshold.
- Provide a read-only migration script that maps existing device-key progress records onto authenticated profiles without dropping anonymous history.
- Announce the cutoff in-product at least one sprint ahead, including fallback guidance for learners who delay account creation.
- Capture the final rollback plan (how to re-enable device-key writes) and storage hygiene steps before flipping the switch.
