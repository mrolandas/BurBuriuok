# Admin Setup & Console Blueprint

Captured screens, flows, and access mechanics for the BurBuriuok admin console. These artefacts guide backend API prioritisation, frontend layout decisions, and the new inline editing toggle that lets admins step into learner pages without extra navigation.

## Navigation Structure

1. **Overview** – snapshot of pending tasks and global stats.
2. **Curriculum** – tree editor for nodes/items and dependency management.
3. **Concepts** – data table filtered by section, status, and updated date.
4. **Media Queue** – moderation inbox for pending/approved/rejected assets.
5. **Audit Log** – chronological list of recent changes with diff previews.
6. **Settings** (later) – manage quotas, integrations, and instructor roles.

A persistent sidebar highlights counters (e.g., Pending media: 5). Admins can collapse it on mobile; each module provides quick actions at the top.

## Sprint 1 Deliverables

The initial admin milestone targets a thin vertical slice that exercises authentication, CRUD, and moderation workflows.

1. **ADM-001 – Secure Admin Shell**: Gate `/admin` routes via Supabase session claims (`app_role='admin'`), provide fallback copy for non-admins, and surface a lightweight status banner showing active persona/role.
2. **ADM-002 – Concept Editor MVP**: Render the Concepts data grid with create/edit drawer, Zod validation shared with backend, draft/publish toggle, and audit-log hook firing `content_versions` entries. _Status: backend endpoints and drawer MVP shipped; polish items pending (data grid filters, optimistic updates, full history sidebar)._
3. **ADM-003 – Moderation Queue List**: Deliver the Media Queue list with status tabs, SLA priority badges (P0/P1/P2), bulk-select skeleton, and empty-state guidance.
4. **ADM-004 – Notification Stubs**: Log Slack/email events when moderation decisions occur, mapping to `docs/references/MODERATION_SLA.md` (real integrations deferred).
5. **ADM-005 – Analytics Mapping Notes**: Document which admin actions emit analytics events so instrumentation can follow once the concept editor and queue are interactive.

Each deliverable should land behind feature flags where possible so the learner experience remains unaffected while the admin surface evolves.

_Update 2025-11-06:_ ADM-001 guard is live – `/admin` layout now displays persona banner for authorised users, renders guidance for learners, and pairs with the Express `requireAdminRole` middleware + telemetry hook.

_Update 2025-11-06 (p.m.)_: ADM-002 admin slice deployed concept CRUD MVP – `/api/v1/admin/concepts` exposes list/detail/upsert endpoints, the SvelteKit console ships the create/edit drawer with shared Zod validation, and audit logging now records each save into `content_versions`.

_Update 2025-11-06 (late)_: Inline concept editing and the persistent “Aktyvuoti Admin” toggle in `AppShell` now mirror the `impersonate=admin` query flag, keeping admin affordances active while navigating between learner pages.

## Screen Details

### 1. Overview

- **Hero cards**: Pending media, Draft concepts, Dependencies needing review (warnings for orphan nodes or circular refs).
- **Activity feed**: Latest 10 actions from `content_versions`/`media_reviews` (who, what, when).
- **Shortcuts**: Buttons to create a new concept, add a curriculum node, or review pending media.
- **System health** (future): Supabase status, seed version hash.

### 2. Curriculum Editor

- **Tree panel**: Expandable curriculum tree with ordinals, prerequisites badges, and quick filters (topics, sections, search by code/title).
- **Details pane**: Editing form for selected node item (title, summary, ordinal, parent). Includes dependency tab to add/remove prerequisites.
- **Validation alerts**: Inline warnings when ordinals collide, missing translations detected, or orphaned children exist.
- **Bulk actions**: Reorder within parent, move subtree to a new parent, export subtree CSV.

### 3. Concept Manager

- **Data grid**: Columns for term (LT/EN), status (draft, published, archived), required flag, curriculum mapping, last edit timestamp.
- **Filters**: Section, text search, status toggle, required-only.
- **Row actions**: View, edit (opens modal or full-page editor), duplicate to create variants, archive.
- **Editor**: Multi-step form capturing core definition, translations, metadata, coverage (linked items + dependencies). Displays preview panes for learners.
- **Version history**: Sidebar listing `content_versions` entries with diff preview before publish.

### 4. Media Queue

- **Tabs**: Pending, Approved, Rejected, Archived.
- **Card list**: Thumbnail, contributor, associated concept/node, submission notes.
- **Review workspace**: Side-by-side media preview and metadata form (captions, alt text, tags). Buttons: Approve, Reject (with reason), Request changes (future).
- **Bulk moderation**: Approve/Reject multiple selected assets with shared note.
- **Automation** (future): Trigger re-scan, reassign to different concept, schedule publish.

### 5. Audit Log

- **Filters**: Entity type (node, concept, media), status, date range, author.
- **Timeline view**: Items show summary (`Concept “Priekis” updated by Ona`), timestamp, link to details.
- **Diff viewer**: JSON Patch or 2-column view to inspect changes before/after.
- **Export**: CSV export for compliance reviews.

## Cross-Cutting UX Patterns

- Toast notifications for success/failure referencing entity slug/code.
- Optimistic updates where safe; roll back on Supabase error.
- Unsaved changes guard when navigating between forms.
- Inline RLS status indicator (if a save fails due to policy).

## Global Admin Mode Toggle

- `AppShell` exposes a menu button labelled “Aktyvuoti Admin” that flips to “Deaktyvuoti Admin” when active. The control is gated behind the same impersonation feature flags used by local development.
- The toggle writes to `src/lib/stores/adminMode.ts`, a persisted Svelte store that ensures admin affordances survive navigation and reloads.
- Toggling the control updates the `impersonate=admin` query parameter via SvelteKit’s `goto`, allowing inline concept editing to reuse the existing admin APIs without a page refresh.
- Future authentication work will swap the toggle for a real login dialog while preserving the shared store so the UI remains reactive.

## Access Control & Routing

- **SvelteKit Layout Guard**: Wrap `/admin/+layout.svelte` with a load function that reads the Supabase session, verifies `app_role`, and redirects to `/` with a friendly message when access is denied. During development, allow a query flag (`?impersonate=admin`) gated behind `VITE_ENABLE_ADMIN_IMPERSONATION` to preview layouts without real credentials.
- **Backend Assertion**: All `/admin/**` API calls must re-check the role server-side (Express middleware) to prevent forged client state from bypassing policies.
- **Allowlist**: Maintain the initial admin list inside Supabase Auth (dashboard-managed). Document the steps in `docs/references/PERSONAS_PERMISSIONS.md` and keep a fallback JSON allowlist for local development.
- **Telemetry**: Emit `admin_session_checked` events (ADM-005) when access is granted or denied to monitor health.
- **Global toggle**: Inline impersonation relies on the `adminMode` store keeping the query string in sync. When real authentication replaces the dev flag, ensure the toggle (or future login CTA) continues to update that store so concept pages react immediately.

## Technical Dependencies

- Consumes endpoints documented in `docs/references/API_CONTRACTS.md` (admin namespace).
- Requires real-time updates (optional) to reflect new submissions; fallback poll every 60s.
- Relies on Supabase Auth role claims to render admin-only components.

## Open Questions

- Should instructors have a limited dashboard view (read-only analytics, ability to flag content)?
- How do we surface dependency conflicts best (graph view vs. inline list)?
- Do we need draft scheduling (publish at future date) in the first release?
- What moderation SLA should be communicated to contributors after submission?
