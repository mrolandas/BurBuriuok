# Quiz Module Blueprint (LX-006)

This document captures the initial scope for the learner knowledge-check experience that sits on top of the existing concept actions. It defines the end-user flow, question formats, data requirements, and follow-up features such as dashboards and admin tooling.

## 1. Learner Flow

1. **Entry point**
   - Learner clicks **"Pasitikrinti žinias"** from the global menu or concept detail page.
   - Modal opens with quiz configuration options.
2. **Mode selection**
   - Option A: _Test by section_ – dropdown lists available curriculum sections. Selecting a section loads all descendant concepts.
   - Option B: _Whole course_ – targets the entire concept catalog.
3. **Concept filters**
   - Checkbox set for **Nežinau / Mokausi / Moku** (unknown, learning, known).
   - All filters checked by default; learners can narrow the pool.
4. **Quiz session**
   - Questions are delivered one at a time, randomly sampled from the filtered concept list.
   - Each question records the response outcome and updates the learner's concept statistics.
5. **Summary & follow-up**
   - Session recap shows pass/fail counts per state and highlights weak areas.
   - Provide entry points to "review unknown" or launch another quiz.

## 2. Question Formats (Phase 1)

- **Definition → Term (Type A)**
  - Present a concept definition; learner chooses the correct term from multiple options.
- **Term → Definition (Type B)**
  - Present a concept term; learner selects the matching definition.
- Distractor options should preferentially come from the same section to reinforce related knowledge and increase difficulty.

Future extensions:

- Custom, scenario-based questions authored by admins (potentially with media attachments).
- Additional formats (multiple-correct answers, ordering, short answers) once content coverage improves.

## 3. Selection & Randomisation

- Default sampling is random from the eligible concept pool.
- Prevent immediate repeats within a session.
- Longer-term roadmap: bias the selection algorithm away from concepts already "confirmed known" based on consecutive passes.

## 4. Tracking & Persistence

Store quiz metrics in a dedicated `learner_quiz_metrics` table keyed by `user_id` and `concept_id` (FKs to the Supabase `auth.users` table and `concepts`). Include the following fields:

- `quiz_pass_count`
- `quiz_fail_count`
- `quiz_last_checked_at`
- `quiz_pass_streak`
- Optional: `quiz_history` JSON (lightweight recent outcomes for analytics)

Usage:

- Update counts after each question submission.
- Feed the "nežinau → mokausi → moku" state machine (e.g., auto-promote to _Moku_ after a configurable pass streak, demote on failures).
- Power a learner dashboard that surfaces weakest concepts and progress trends.

## 5. Reporting & Review

- **Learner dashboard** (later milestone):
  - Visualise pass/fail ratios by section and state.
  - Provide "Review unknown" quick action that launches a targeted session on concepts with low pass streaks.
- **Admin review tools**:
  - Allow admins to browse question performance, identify problematic items, and flag content for revision.
  - Support "mark question as broken" feedback from learners during a quiz session (records the question ID, user note, timestamp).

## 6. Admin-authored Questions (Backlog)

- Admin UI for creating custom multiple-choice questions with:
  - Rich-text prompts and optional media (image/video).
  - Tagged correct answer(s) and distractors.
  - Section/Concept linkage for analytics and targeted delivery.
- Moderation workflow to approve or suppress learner-submitted flags.

## 7. Implementation Phasing

1. **LX-006 – Quiz Foundation (current scope)**
   - Supabase migration for `learner_quiz_metrics` table and relations to `auth.users` and `concepts`.
   - Modal configuration (section picker, concept state filters).
   - Question generation for Type A/B using existing concept data.
   - Persistence of per-concept quiz metrics.
   - Basic session summary screen.
   - Feedback hook to flag questions.
2. **Later milestones**
   - Adaptive scheduling that weights concepts by pass streak.
   - Learner analytics dashboard.
   - Admin-authored custom questions & media support.
   - Integration with study queues (auto-move failed concepts to "Nežinau").

## 8. Open Questions

- Desired session length defaults (fixed question count vs. continuous until user stops).
- Whether to allow mixed-format sessions vs. single-format selection.
- How learner-generated flags should be triaged (auto-created admin tickets, email notifications, etc.).

Document last updated: 2025-11-05.
