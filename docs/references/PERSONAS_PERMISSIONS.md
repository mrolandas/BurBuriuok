# Personas & Permissions Matrix

Aligns user archetypes with Supabase Auth roles and the capabilities exposed by the BurBuriuok platform.

## Personas

| Persona         | Description                                                                                             | Primary Goals                                            | Typical Devices                        |
| --------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------- |
| Learner         | Student preparing for LBS skipper exams; consumes curriculum, tracks progress, practices quizzes.       | Build knowledge, stay motivated, review weak topics.     | Mobile (90%), Tablet (10%).            |
| Contributor     | Advanced learner or assistant instructor who proposes content tweaks or media (pending future release). | Suggest improvements, submit media, flag issues.         | Mobile + occasional desktop.           |
| Admin           | Curriculum maintainer/instructor of record. Manages content, approves media, monitors analytics.        | Keep data accurate, moderate submissions, view insights. | Desktop (primary), Tablet (secondary). |
| Visitor (Guest) | Unauthenticated user browsing sample content.                                                           | Evaluate the tool, read basics.                          | Mobile web.                            |

## Role Mapping

Supabase Auth `app_role` custom claim drives API policies.

| Role                   | Personas    | Capabilities                                                                                                           |
| ---------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| `guest` (default)      | Visitor     | Read-only access to public endpoints (curriculum, concepts, search). No data writes.                                   |
| `learner`              | Learner     | Everything in `guest` + progress management, study queue, quiz submissions, media submissions (pending review).        |
| `contributor` (future) | Contributor | Same as `learner` plus ability to propose edits, comment in forum, limited view of moderation queue (own submissions). |
| `admin`                | Admin       | Full CRUD on curriculum/concepts/media, access to audit logs, configure study paths, manage badges.                    |

Authentication flow:

1. Anonymous navigation allowed (role `guest`).
2. Supabase magic-link login is the only sign-in path; backend sets session with `app_role='learner'` unless the email belongs to the admin allowlist.
3. Admin invitations ship with AUTH-002, consolidating allowlist management alongside learner profile bootstrap.
4. Device-key progress syncing remains available (role `guest`) until AUTH-003 lands the migration/sunset tooling.

## API Permissions Summary

| Endpoint Namespace                     | Guest | Learner | Contributor (future)      | Admin |
| -------------------------------------- | ----- | ------- | ------------------------- | ----- |
| `/curriculum`, `/concepts`, `/search`  | ✅    | ✅      | ✅                        | ✅    |
| `/progress`, `/study-queue`            | ❌    | ✅      | ✅                        | ✅    |
| `/media-submissions`                   | ❌    | ✅      | ✅ (own)                  | ✅    |
| `/admin/curriculum`, `/admin/concepts` | ❌    | ❌      | ❌                        | ✅    |
| `/admin/media`                         | ❌    | ❌      | ⚠️ (own submissions only) | ✅    |
| `/admin/audit`                         | ❌    | ❌      | ❌                        | ✅    |
| `/study-paths` (enrol/complete)        | ❌    | ✅      | ✅                        | ✅    |
| `/practice` (quiz results)             | ❌    | ✅      | ✅                        | ✅    |

Legend: ✅ full access; ❌ denied; ⚠️ constrained to own submissions.

## Row-Level Security (RLS) Considerations

- `concept_progress`, `study_queue`, `gamification_*`, `study_path_assignments`: rows restricted to matching `auth.uid()` or `device_key` hashed to session.
- `media_assets`: learners can insert; select limited to own records unless status is `approved`. Admins bypass via `service_role` or policies tied to `app_role='admin'`.
- `content_versions`, `media_reviews`: read-only for admins; hidden from learners.

## Audit & Escalation

- Admins receive weekly digest of outstanding moderation tasks.
- Learners can flag content via `/media-submissions` with `status='flagged'` (future) – escalates to admin queue.
- Contributor role will require review/approval before elevation (`profiles.role = 'contributor'`).
- Monitor magic-link adoption metrics during the AUTH-001/002 rollout and defer any device-key policy changes until AUTH-003 is complete.

## Open Questions

- Do we allow self-service upgrade from learner to contributor, or is it invite-only?
- Should guests have limited progress saving via device key without auth? (Potential for future anonymous progress mode.)
- How do we expire inactive admin accounts (policy & automation)?

## Admin Route Enforcement

- **Frontend Guard**: The `/admin` SvelteKit layout reads the Supabase session during `load()`, asserts `app_role === 'admin'`, renders persona banner for authorised users, and surfaces friendly guidance for everyone else. When `VITE_ENABLE_ADMIN_IMPERSONATION=true`, developers may pass `?impersonate=admin` to preview the shell without a privileged session; never enable this flag in production.
- **Backend Middleware**: Express middleware `requireAdminRole` checks the decoded JWT claim (`app_role`) for every `/admin/**` endpoint. Requests failing the check return HTTP 401/403 and are logged for analytics (ADM-001).
- **Telemetry**: Both layers emit `admin_session_checked` events (console + `CustomEvent`) containing decision outcome, role, and email to support upcoming ADM-005 analytics work.
- **Allowlist Management**: Until AUTH-002 lands, maintain admin emails via the Supabase dashboard (Auth → Users → Add user). The auth backlog replaces this with an invite console backed by the `profiles` table and documented auditing.
- **Local Development Story**: For UI previews without Supabase auth, enable `VITE_ENABLE_ADMIN_IMPERSONATION=true` locally and append `?impersonate=admin` to the `/admin` URL. Remove/disable before committing or deploying.
