# Analytics Events – Learning Experience

Canonical catalog of events we emit to Product Analytics (Snowplow amplitude equivalent TBD). Keeps instrumentation in sync across app, backend, and ETL.

## Tracking Architecture

- Source: Web app (`first_draft/` frontend) using custom tracker wrapper.
- Relay: Supabase Edge Function `log_event` (future) or direct HTTPS to analytics vendor.
- Identity: `user_id` (UUID), `session_id` (UUID v4 per browser session), `locale`, `role`.
- Environment tags: `env` (`dev|staging|prod`), `app_version` (git SHA).

## Event Definitions

| Event                         | Trigger                                                   | Required Properties                                             | Optional Properties                                      | Notes                                                    |
| ----------------------------- | --------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| `curriculum.node_opened`      | Learner opens a curriculum node detail view               | `node_code`, `node_title`, `source` (`map`/`search`/`syllabus`) | `prereq_status` (`satisfied`/`missing`), `concept_count` | Fire once per navigation; throttle duplicates within 30s |
| `concept.viewed`              | Concept card scrolled into view and expanded              | `concept_slug`, `node_code`                                     | `language` (`lt`/`en`), `content_version_id`             | Use `IntersectionObserver` threshold 0.6                 |
| `concept.feedback_submitted`  | Learner submits quick feedback widget                     | `concept_slug`, `rating` (`up`/`down`)                          | `comment_length`, `issue_tags` (array)                   | Route negative feedback with comment to moderation queue |
| `concept.prereq_blocked`      | Learner tries to open gated content without prerequisites | `concept_slug`, `missing_prereq_slugs` (array)                  | `attempt_count`                                          | Supports dependency UX evaluation                        |
| `media.upload_started`        | Learner begins upload flow                                | `concept_slug`, `file_type`, `file_size_bytes`                  | `network_type`                                           | Useful for drop-off funnel                               |
| `media.upload_completed`      | Upload succeeds, pending moderation                       | `asset_id`, `concept_slug`, `file_type`                         | `duration_ms`                                            | Cross-check with moderation SLA metrics                  |
| `curriculum.search_performed` | Search executed in curriculum view                        | `query`, `result_count`                                         | `filters` (array), `device`                              | Log even when zero results                               |
| `auth.login`                  | Successful login                                          | `method` (`password`/`magic_link`/`oauth`), `role`              | `device`, `ua`                                           | Capture source via Supabase auth hook                    |
| `auth.logout`                 | Explicit logout                                           | `method` (`manual`/`session_expire`)                            | `duration_seconds`                                       | Distinguish manual vs timeout for retention diagnostics  |

## Event Payload Template

```json
{
  "event": "concept.viewed",
  "user_id": "uuid",
  "session_id": "uuid",
  "timestamp": "2025-11-03T12:34:56.000Z",
  "properties": {
    "concept_slug": "fractions-intro",
    "node_code": "MATH-3-001",
    "language": "lt"
  },
  "context": {
    "env": "staging",
    "app_version": "e3af6c1"
  }
}
```

## Governance

- Update this catalog before shipping instrumentation changes.
- Version-control tracking plan; tag releases alongside app deployments.
- QA checklist: verify event fires, property coverage, data type, volume, and no personally identifiable info beyond user UUID.

## Open Items

1. Decide analytics vendor (Amplitude vs Plausible custom pipeline).
2. Implement tracker helper in `first_draft/scripts.js` with debounce + batch send.
3. Add server-side events for moderation actions once endpoints exist.
