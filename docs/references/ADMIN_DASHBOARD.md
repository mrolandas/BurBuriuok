# Admin Dashboard Blueprint

Captured screens and flows for the first release of the BurBuriuok admin console. These artefacts guide backend API prioritisation and frontend layout decisions.

## Navigation Structure

1. **Overview** – snapshot of pending tasks and global stats.
2. **Curriculum** – tree editor for nodes/items and dependency management.
3. **Concepts** – data table filtered by section, status, and updated date.
4. **Media Queue** – moderation inbox for pending/approved/rejected assets.
5. **Audit Log** – chronological list of recent changes with diff previews.
6. **Settings** (later) – manage quotas, integrations, and instructor roles.

A persistent sidebar highlights counters (e.g., Pending media: 5). Admins can collapse it on mobile; each module provides quick actions at the top.

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

## Technical Dependencies

- Consumes endpoints documented in `docs/references/API_CONTRACTS.md` (admin namespace).
- Requires real-time updates (optional) to reflect new submissions; fallback poll every 60s.
- Relies on Supabase Auth role claims to render admin-only components.

## Open Questions

- Should instructors have a limited dashboard view (read-only analytics, ability to flag content)?
- How do we surface dependency conflicts best (graph view vs. inline list)?
- Do we need draft scheduling (publish at future date) in the first release?
- What moderation SLA should be communicated to contributors after submission?
