# Moderation SLA & Notifications

Defines service levels and communication rules for reviewing learner-generated assets.

> Status: Deferred during admin-only media MVP (2025-11-17). Keep for contributor upload relaunch.

## Scope

Covers media uploaded to `media_assets` (images, video, documents, audio) and text comments once community features launch.
Paused until learner/contributor submissions are reinstated.

## Roles

- **Learner**: submits asset. Receives status notifications (inactive).
- **Moderator**: triages queue, reviews assets (inactive).
- **Escalation Lead**: handles overdue or sensitive cases (inactive).
- **Automation Bot**: syncs Slack/email alerts (inactive).

## SLA Targets

| Priority | Description                                       | Time to First Review | Time to Resolution | Owner           |
| -------- | ------------------------------------------------- | -------------------- | ------------------ | --------------- |
| P0       | Flagged as harmful/abusive/illegal                | 4 business hours     | 8 business hours   | Escalation Lead |
| P1       | Reported by learner or auto-flagged by heuristics | 8 business hours     | 2 business days    | Moderator       |
| P2       | Routine pending uploads                           | 1 business day       | 3 business days    | Moderator       |

> Business hours: Monday–Friday 09:00–17:00 EET. Outside these hours the timer pauses.

## Queue Management

- Moderators work from `/moderation` dashboard fed by `media_assets` view `moderation_queue_v1` (to be added).
- Items sorted by priority, then oldest `created_at`.
- Automation assigns reviewer by round robin; manual reassignment allowed for language expertise.

## Notifications

- **Slack**
  - Channel `#moderation-alerts` receives P0/P1 creations, overdue warnings, and daily digest.
  - Overdue (>80% SLA) triggers mention of on-call moderator.
- **Email**
  - Learners notified on `status` change via Supabase Edge Function webhook (`POST /notify/asset-status`).
  - Escalation Lead receives summary of unresolved P0 at 12:00 and 16:00 EET.
- **In-app**
  - Learner dashboard badge displays pending reviews; click opens asset detail.

## Reporting & Audit

- Weekly metrics: volume, average resolution time, SLA compliance, flags by category.
- Store audit trail in `media_reviews` including reviewer notes. Non-editable after submission.
- Export metrics as CSV via scheduled job for BI ingestion.

## Exceptions & Overrides

- Escalation Lead may pause SLA clock when awaiting external legal guidance; must log reason in `media_reviews.notes`.
- For mass uploads (e.g., curriculum migration) bulk approval flow allowed with sample-based QA.

## Next Steps

1. Implement `moderation_queue_v1` view and automation assignments.
2. Build Edge Function template for Slack + email notifications.
3. Define on-call rotation roster and document in Ops handbook.
4. Integrate metrics dashboard (Metabase/Looker) for live tracking.

> On hold until contributor or learner submissions return.
