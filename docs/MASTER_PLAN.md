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
- Media submissions (images, video links, PDFs, audio) require human approval before they surface publicly.

## Experience Blueprint

### Learner Journey

- Landing screen highlights curriculum sections as “boards” with progress meters and estimated study time.
- Expanding a section reveals a collapsible tree; each node advertises prerequisites and next steps so learners can navigate depth without losing context.
- Quick search lives in a persistent bottom navigation item, clustering results by concept/module/media.

### Concept View

- Definition and translation front and center, followed by prerequisite badges that open inline drawers (no back-navigation needed).
- “Next concepts” suggestions nudge learners through recommended sequences.
- Media carousel (images, videos, PDFs) is swipe-friendly and lazy loaded.
- Immediate actions: mark mastered, add to study queue, launch micro-quiz.

### Guided Study & Practice

- Curated “study paths” bundle concepts into manageable runs with embedded quizzes and reflections.
- Adaptive review targets concepts marked as unclear or missed in quizzes, scheduling flashcards automatically.
- Gentle nudges (push/email later) celebrate streaks and remind learners when progress stalls.

### Admin Workspace

- Dashboard summarises pending media submissions, draft content, and high-impact concepts (e.g., high failure rate).
- Editors can add/edit/delete nodes, items, and concepts inline with validation, dependency linking, and preview diffs prior to publish.
- Versioning supports draft vs published states plus basic history for rollback.

### Media Moderation Flow

- Authenticated users submit media with metadata (type, language, captions, credit).
- Submissions queue for admin approval; automated checks enforce quota, MIME type, file size, and malicious content scanning.
- Approved media inherits contributor attribution and can be revoked or edited at any time.

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

### Media Handling

## Planning Status (2025-11-03)

- Planning deliverables are consolidated in `docs/references/SCHEMA_DECISIONS.md`, `docs/references/MODERATION_SLA.md`, `docs/references/ANALYTICS_EVENTS.md`, and `docs/references/ISSUE_TRACKER.md`.
- Regression guardrail automation (seeds, curriculum snapshot, markdown validation) runs locally via Husky and in CI via `content-seed-guard.yml`.
- No standalone wireframing assets exist beyond the written UX notes in `docs/references/UX_MOBILE_WIREFRAMES.md`; there are currently no screenshots to maintain.
- Engineering is cleared to begin backend and frontend implementation using the backlog seeds in `docs/references/ISSUE_TRACKER.md` and the roadmap below.
- Build Sprint 1 backlog items now exist as GitHub issues (#1-#8) opened via the GitHub CLI, with cross-links maintained in `docs/references/ISSUE_TRACKER.md`.
- `npm run content:seed:dependencies` generates `supabase/seeds/seed_curriculum_dependencies.sql`, keeping prerequisite data aligned with the schema migration.
- Remote Supabase project refreshed on 2025-11-04 with migrations through `0008` and regenerated prerequisite seeds.
- Express API scaffold landed under `backend/src/` with read-only routes for curriculum, concepts, and dependencies plus `npm run backend:*` scripts.
- `0007_content_versioning_history.sql` extends the schema with `content_version_changes` and triggers that auto-increment versions and stamp audit metadata.

- Supabase Storage buckets segregated by media type with signed URL access.
- Metadata tables track moderation state (`pending`, `approved`, `rejected`, `archived`).
- Automated scanning pipeline (e.g., via edge function or scheduled job) to flag suspicious uploads before admin review.

## Implementation Roadmap

### Phase 0 – Platform Foundation

- [x] Generate canonical curriculum + concept seeds and push baseline Supabase schema.
- [x] Model prerequisite relationships (node/concept dependency tables + seed alignment).
- [x] Define draft/published states and change history tables for content.
- [x] Outline API surface (read, progress, admin) with contracts documented (`docs/references/API_CONTRACTS.md`).
- [x] Prepare baseline mobile wireframes for curriculum board and concept view (`docs/references/UX_MOBILE_WIREFRAMES.md`).

### Phase 1 – Content Management & Moderation

- [ ] Build admin CRUD UI for nodes, items, concepts, and dependencies.
- [ ] Implement content versioning workflow (draft → review → publish).
- [ ] Ship media submission pipeline (upload, metadata capture, queued status).
- [ ] Deliver admin moderation queue with approve/reject actions and notifications.
- [ ] Add automated validation checks (missing fields, duplicate ordinals, orphan dependencies).
- [ ] Finalise role-based UI controls according to `docs/references/PERSONAS_PERMISSIONS.md`.

### Phase 2 – Learner Experience

- [ ] Implement curriculum navigation (section boards, collapsible tree, dependency indicators).
- [ ] Build concept detail view with prerequisite/next concept drawers and media carousel.
- [ ] Create study path runner (sequence UI + progress HUD).
- [ ] Wire up progress tracking and “study later” queue synced to Supabase.
- [ ] Ship global search with grouped results and filters.
- [ ] Personalise recommendations based on gamification/study path data.

### Phase 3 – Engagement & Analytics

- [ ] Introduce streaks, XP, and badge attribution tables + UI surfaces.
- [ ] Launch adaptive review loop (spaced repetition service + flashcard UI).
- [ ] Configure nudges/notifications for streak breaks and path completions.
- [ ] Instrument analytics events for curriculum traversal and practice outcomes.
- [ ] Build lightweight insights dashboard for admins (e.g., most-missed concepts).
- [ ] Operationalise gamification rules defined in `docs/references/GAMIFICATION_MODEL.md`.

### Phase 4 – Social Layer (Post-MVP)

- [ ] Design concept-level discussion threads with moderation hooks.
- [ ] Enable upvote/downvote + flag mechanisms.
- [ ] Create forum channels (navigation, safety, community tips) with tagging.
- [ ] Integrate notifications for replies/mentions.
- [ ] Establish long-term moderation policies and tooling.

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
