# Study Path Framework

Outlines how structured learning sequences operate in BurBuriuok. Supports the Study Plan Runner and prioritised backlog items.

## Concepts

- **Study Path** – curated list of curriculum nodes/concepts with recommended order, estimated duration, and embedded assessments.
- **Module** – grouping by topic (e.g., `1.2 Takelažas`).
- **Checkpoint** – quick quiz or reflection inserted between modules.
- **Outcome** – message shown at completion (badge, recommendation).

## Data Shape (Planned)

Tables (future migrations):

1. `study_paths`

   - `id` (uuid), `slug`, `title_lt`, `title_en?`, `description_lt`, `estimated_minutes`, `icon`, `is_active`, `created_at`, `updated_at`.

2. `study_path_steps`

   - `id`, `path_id`, `ordinal`, `step_type` (`concept`, `module`, `checkpoint`, `media`), `concept_id?`, `curriculum_node_code?`, `checkpoint_id?`, `metadata` (jsonb).

3. `study_path_assignments`

   - `profile_id`, `path_id`, `progress` (jsonb: step index, results), `status` (`not_started`, `in_progress`, `completed`, `abandoned`), `started_at`, `completed_at`.

4. `study_path_checkpoints`
   - `id`, `title`, `items` (jsonb array of questions/prompts), `passing_score`.

## Initial Library

| Path               | Description                                            | Target                    |
| ------------------ | ------------------------------------------------------ | ------------------------- |
| `foundations`      | Covers 1.1 + key vocabulary across hull types.         | New learners.             |
| `rigging_basics`   | 1.2.3 Takelažas + safety prerequisites.                | Preparing for first sail. |
| `safety_briefing`  | Sections 4 + emergency manoeuvres.                     | Exam prep.                |
| `navigation_intro` | Topic 6 essentials with map exercises.                 | Intermediate learners.    |
| `exam_cram`        | Mixed review across all topics with adaptive quizzing. | Final revision.           |

Each path includes 4–8 steps, estimated 15–40 minutes. Checkpoints: 3-5 questions. If a learner fails, they re-review flagged concepts before continuing.

## UX Flow

1. Learner chooses path from "Study Plan" tab (cards showing duration, prerequisites).
2. Path runner displays step `n` of `total`, concept summary, key takeaways, quick question.
3. Learner marks understanding (`Supratau`, `Dar kartą`).
4. Checkpoint triggers short quiz; results stored in assignments.
5. Completion screen awards XP/badges, suggests next path.

## Personalisation Hooks

- Use `curriculum_dependencies` to auto-suggest concept pre-work if prerequisites incomplete.
- Adaptive ordering: reorder final review steps based on checkpoint performance (future).
- Path recommendations from admin/instructors flagged as "Recommended" in UI.

## Backlog Tasks

1. Migration & repository for paths/steps/checkpoints.
2. Admin UI to create/edit paths (extend existing admin console).
3. Learner UI runner with offline support.
4. Analytics reporting (completion rates, average scores).
5. Notifications: remind learners to continue assigned path after 48h inactivity.

## Open Questions

- How do study paths interact with free-form browsing (can learners skip ahead)?
- Do we allow branching paths (choose your difficulty) or stick to linear sequences initially?
- Should admins assign paths to cohorts or keep them self-enrolled until classroom mode arrives?
