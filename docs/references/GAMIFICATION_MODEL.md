# Gamification Data Model & Rules

Defines how BurBuriuok measures engagement and rewards learners. Aligns with Phase 3 roadmap items.

## Core Concepts

- **XP (Experience Points)** – earned for completing concepts, quizzes, and maintaining streaks.
- **Streaks** – consecutive days with qualifying activity.
- **Badges** – milestone achievements tied to curriculum progression or behaviour (e.g., "Rigging Ready").
- **Confidence Score** – learner-reported mastery (`confident`, `unsure`) influencing review priority.

## Database Tables (Planned)

1. `gamification_xp_events`

   - `id` (uuid), `profile_id` (uuid), `event_type` (text), `amount` (int), `concept_id` (uuid, optional), `metadata` (jsonb), `created_at` (timestamptz).
   - Event types: `concept_completed`, `quiz_passed`, `study_path_completed`, `streak_bonus`, `medal_awarded`.

2. `gamification_streaks`

   - `profile_id`, `current_streak`, `longest_streak`, `last_activity_date`.

3. `gamification_badges`

   - Catalog of badge definitions: `code`, `title`, `description`, `criteria` (jsonb), `icon`.

4. `gamification_user_badges`

   - `profile_id`, `badge_code`, `awarded_at`, `progress` (jsonb for multi-step badges).

5. `study_queue` (existing plan, cross-reference)
   - Adds `priority_score` derived from confidence and spaced repetition.

## XP Rules (Initial)

| Action                                    | XP  |
| ----------------------------------------- | --- |
| Complete required concept (mark as known) | 10  |
| Complete optional concept                 | 5   |
| Quiz question correct                     | 2   |
| Quiz perfect score (bonus)                | 10  |
| Maintain daily streak (after day 3)       | 5   |
| Complete study path                       | 25  |

XP gain capped at 200/day to prevent grinding. Overflow goes into "pending XP" released after cooldown.

## Streak Logic

- Qualifying activity: mark concept as known, complete quiz session, or finish study path.
- Day boundary uses learner’s timezone (recorded in profile).
- Missed day resets `current_streak`; `longest_streak` persists.
- Streak break notification sent at 20:00 local time if no qualifying activity.

## Badge Catalogue (Draft)

| Code            | Title         | Criteria                                                  |
| --------------- | ------------- | --------------------------------------------------------- |
| `rigging_ready` | Rigging Ready | Complete all concepts in topic 1.2.3 + pass related quiz. |
| `steady_sailor` | Steady Sailor | Maintain a 7-day streak.                                  |
| `navigator`     | Navigator     | Score 90%+ on Navigation study path quiz twice.           |
| `mentor`        | Mentor        | Approve 10 media contributions (admin/instructor).        |
| `lifeline`      | Lifeline      | Revisit 15 concepts flagged as "needs review" in a month. |

Badges grouped as `curriculum`, `consistency`, `community`, `mastery`.

## Spaced Repetition Inputs

- `concept_id`
- `last_reviewed_at`
- `confidence` (`high`, `medium`, `low`)
- `quiz_accuracy` (rolling percentage)
- `times_revisited`

Algorithm: SM-2 inspired with custom weights.

```
nextInterval = baseInterval * modifier
baseInterval = confidence == high ? 3 : confidence == medium ? 2 : 1
modifier = 1 + (quizAccuracy - 0.7)
nextReviewDate = today + max(1, round(nextInterval)) days
```

Low accuracy (<50%) forces review within 24 hours. Manual "needs review" sets confidence to low immediately.

## API Touchpoints

- `POST /progress/:conceptId` accepts `confidence` (optional) to adjust queue.
- `GET /profile/stats` returns XP, badges, streak info for profile screen.
- `POST /practice/quiz-result` logs accuracy, XP, events.
- `POST /study-paths/:id/complete` emits XP event and checks badge criteria.

## Notifications

- **Streak Reminder** – 20:00 if inactive.
- **Badge Earned** – immediate push/in-app toast.
- **Study Plan Suggestion** – weekly digest recommending next path.

## Analytics

Track aggregated metrics: active streak counts, XP distribution, badge unlock rates, question difficulty (accuracy). Feed into admin insights dashboard.

## Open Questions

- Should XP vary by concept difficulty/hours? (Need curriculum metadata.)
- How to handle learners who prefer occasional long sessions vs daily bursts?
- Do we expose a leaderboard or keep progress private?
- What parental controls or instructor oversight do we need for gamification? (Future classroom mode.)
