# Database Schema

This document describes the PostgreSQL database schema hosted on Supabase.

## Schema Overview

All tables are in the `burburiuok` schema. The schema uses:

- UUIDs for primary keys
- `created_at`/`updated_at` timestamps
- JSONB for flexible metadata
- Row-Level Security (RLS) on all tables

## Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐
│    subjects     │       │    profiles     │
│ (future)        │       │                 │
└────────┬────────┘       └────────┬────────┘
         │                         │
         │ subject_id              │ profile_id
         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐
│curriculum_nodes │       │learner_         │
│                 │       │subscriptions    │
│ - code (PK)     │       │ (future)        │
│ - title         │       └─────────────────┘
│ - level         │
│ - parent_code   │───┐
└────────┬────────┘   │ self-reference
         │            │
         │ node_code  │
         ▼            │
┌─────────────────┐   │
│curriculum_items │◄──┘
│                 │
│ - node_code     │
│ - ordinal       │
│ - label         │
└────────┬────────┘
         │
         │ curriculum_item
         ▼
┌─────────────────┐       ┌─────────────────┐
│    concepts     │◄──────│  media_assets   │
│                 │       │                 │
│ - slug (PK)     │       │ - concept_slug  │
│ - term_lt/en    │       │ - type          │
│ - description   │       │ - url           │
│ - node_code     │       └─────────────────┘
│ - item_ordinal  │
└────────┬────────┘
         │
         │ concept_slug
         ▼
┌─────────────────┐       ┌─────────────────┐
│concept_progress │       │content_versions │
│                 │       │                 │
│ - device_key    │       │ - concept_slug  │
│ - profile_id    │       │ - version       │
│ - status        │       │ - status        │
└─────────────────┘       │ - snapshot      │
                          └─────────────────┘
```

## Core Tables

### `concepts`

The central content entity—learning items with definitions.

| Column                    | Type        | Description                                     |
| ------------------------- | ----------- | ----------------------------------------------- | ------------------ |
| `slug`                    | TEXT PK     | URL-friendly identifier (e.g., `lbs-1-1a-jole`) |
| `term_lt`                 | TEXT        | Lithuanian term (required)                      |
| `term_en`                 | TEXT        | English term (optional)                         |
| `description_lt`          | TEXT        | Lithuanian description (Markdown)               |
| `description_en`          | TEXT        | English description (Markdown)                  |
| `curriculum_node_code`    | TEXT FK     | Parent curriculum node                          |
| `curriculum_item_ordinal` | INT         | Position in node                                |
| `is_required`             | BOOL        | Required for certification                      |
| `metadata`                | JSONB       | `{status: 'draft'                               | 'published', ...}` |
| `created_at`              | TIMESTAMPTZ | Creation timestamp                              |
| `updated_at`              | TIMESTAMPTZ | Last update                                     |

**Indexes**:

- Primary: `slug`
- `idx_concepts_node_code` on `curriculum_node_code`
- `idx_concepts_metadata_status` on `(metadata->>'status')`

### `curriculum_nodes`

Hierarchical curriculum structure (sections, subsections).

| Column        | Type        | Description                               |
| ------------- | ----------- | ----------------------------------------- |
| `code`        | TEXT PK     | Unique code (e.g., `LBS-1`, `LBS-1-1A`)   |
| `title`       | TEXT        | Display title                             |
| `summary`     | TEXT        | Optional description                      |
| `level`       | INT         | Hierarchy depth (1=section, 2=subsection) |
| `parent_code` | TEXT FK     | Parent node (null for top-level)          |
| `ordinal`     | INT         | Sort order within parent                  |
| `created_at`  | TIMESTAMPTZ | Creation timestamp                        |
| `updated_at`  | TIMESTAMPTZ | Last update                               |

**Constraints**:

- Self-referential FK: `parent_code → code`
- Level 1 nodes have `parent_code = NULL`

### `curriculum_items`

Leaf items within curriculum nodes (bullet points).

| Column       | Type        | Description            |
| ------------ | ----------- | ---------------------- |
| `id`         | UUID PK     | Unique identifier      |
| `node_code`  | TEXT FK     | Parent curriculum node |
| `ordinal`    | INT         | Position within node   |
| `label`      | TEXT        | Display text           |
| `created_at` | TIMESTAMPTZ | Creation timestamp     |
| `updated_at` | TIMESTAMPTZ | Last update            |

**Constraints**:

- Unique: `(node_code, ordinal)`

### `concept_progress`

Learner progress tracking per concept.

| Column         | Type        | Description                     |
| -------------- | ----------- | ------------------------------- |
| `id`           | UUID PK     | Unique identifier               |
| `concept_slug` | TEXT FK     | Related concept                 |
| `device_key`   | TEXT        | Anonymous device identifier     |
| `profile_id`   | UUID FK     | Authenticated user (optional)   |
| `status`       | TEXT        | `learning` / `known` / `review` |
| `created_at`   | TIMESTAMPTZ | First interaction               |
| `updated_at`   | TIMESTAMPTZ | Last status change              |

**Note**: `device_key` is being deprecated in favor of `profile_id`.

### `profiles`

User profiles linked to Supabase Auth.

| Column                | Type        | Description                         |
| --------------------- | ----------- | ----------------------------------- |
| `id`                  | UUID PK/FK  | Matches `auth.users.id`             |
| `email`               | TEXT        | User email                          |
| `role`                | TEXT        | `learner` / `admin` / `contributor` |
| `display_name`        | TEXT        | Optional display name               |
| `language_preference` | TEXT        | `lt` / `en`                         |
| `created_at`          | TIMESTAMPTZ | Profile creation                    |
| `updated_at`          | TIMESTAMPTZ | Last update                         |

### `admin_invites`

Admin invitation tokens.

| Column                | Type        | Description       |
| --------------------- | ----------- | ----------------- |
| `id`                  | UUID PK     | Unique identifier |
| `email`               | TEXT        | Invited email     |
| `token`               | TEXT        | Invitation token  |
| `invited_by`          | UUID FK     | Admin who invited |
| `accepted_at`         | TIMESTAMPTZ | When accepted     |
| `accepted_profile_id` | UUID FK     | Profile created   |
| `expires_at`          | TIMESTAMPTZ | Token expiration  |
| `created_at`          | TIMESTAMPTZ | Invite creation   |

## Content Versioning Tables

### `content_versions`

Audit trail for concept changes.

| Column         | Type        | Description                                      |
| -------------- | ----------- | ------------------------------------------------ |
| `id`           | UUID PK     | Unique identifier                                |
| `concept_slug` | TEXT FK     | Related concept                                  |
| `version`      | INT         | Auto-incrementing version number                 |
| `status`       | TEXT        | `draft` / `in_review` / `published` / `archived` |
| `snapshot`     | JSONB       | Full concept state at this version               |
| `created_by`   | UUID FK     | User who created                                 |
| `created_at`   | TIMESTAMPTZ | Version creation                                 |

### `content_version_changes`

Field-level diffs for each version.

| Column       | Type    | Description       |
| ------------ | ------- | ----------------- |
| `id`         | UUID PK | Unique identifier |
| `version_id` | UUID FK | Parent version    |
| `field_name` | TEXT    | Changed field     |
| `old_value`  | TEXT    | Previous value    |
| `new_value`  | TEXT    | New value         |

### `content_drafts`

Working copies of content being edited.

| Column         | Type        | Description       |
| -------------- | ----------- | ----------------- |
| `id`           | UUID PK     | Unique identifier |
| `concept_slug` | TEXT FK     | Related concept   |
| `draft_data`   | JSONB       | Draft content     |
| `created_by`   | UUID FK     | Editor            |
| `created_at`   | TIMESTAMPTZ | Draft creation    |
| `updated_at`   | TIMESTAMPTZ | Last edit         |

## Media Tables

### `media_assets`

Admin-managed media files.

| Column         | Type        | Description                      |
| -------------- | ----------- | -------------------------------- |
| `id`           | UUID PK     | Unique identifier                |
| `concept_slug` | TEXT FK     | Related concept (optional)       |
| `type`         | TEXT        | `image` / `video` / `pdf`        |
| `url`          | TEXT        | Storage URL or external link     |
| `filename`     | TEXT        | Original filename                |
| `title`        | TEXT        | Display title                    |
| `description`  | TEXT        | Alt text / description           |
| `metadata`     | JSONB       | Size, dimensions, duration, etc. |
| `ordinal`      | INT         | Sort order within concept        |
| `created_by`   | UUID FK     | Uploader                         |
| `created_at`   | TIMESTAMPTZ | Upload time                      |

## Dependencies Tables

### `curriculum_dependencies`

Prerequisite relationships between content.

| Column              | Type        | Description                    |
| ------------------- | ----------- | ------------------------------ |
| `id`                | UUID PK     | Unique identifier              |
| `source_type`       | TEXT        | `concept` / `node`             |
| `source_id`         | TEXT        | Slug or code of dependent item |
| `prerequisite_type` | TEXT        | `concept` / `node`             |
| `prerequisite_id`   | TEXT        | Slug or code of prerequisite   |
| `strength`          | TEXT        | `required` / `recommended`     |
| `created_at`        | TIMESTAMPTZ | Creation time                  |

**Constraints**:

- Unique: `(source_type, source_id, prerequisite_type, prerequisite_id)`

## System Tables

### `system_settings`

Global configuration key-value store.

| Column       | Type        | Description   |
| ------------ | ----------- | ------------- |
| `key`        | TEXT PK     | Setting name  |
| `value`      | JSONB       | Setting value |
| `updated_at` | TIMESTAMPTZ | Last change   |

**Current Settings**:

- `registration_enabled`: Boolean for new user signups
- `ai_provider`: AI configuration

## Views

### `burburiuok_curriculum`

Public view of curriculum tree for learners.

### `burburiuok_concepts`

Public view of published concepts.

### `burburiuok_concept_progress`

Progress data joined with concept info.

## Row-Level Security (RLS)

All tables have RLS enabled. Key policies:

| Table              | Select             | Insert/Update/Delete |
| ------------------ | ------------------ | -------------------- |
| `concepts`         | Public (published) | Service role only    |
| `curriculum_nodes` | Public             | Service role only    |
| `concept_progress` | Own records        | Own records          |
| `profiles`         | Own profile        | Own profile          |
| `media_assets`     | Public             | Service role only    |

## Migrations

Migrations are in `supabase/migrations/` with format `NNNN_description.sql`.

Current migrations (0001–0019):

1. Initial schema
2. Public views
3. `is_required` flag
4. Curriculum hierarchy
5. Concepts ↔ curriculum link
6. Dependencies, versioning, media scaffold
7. Versioning triggers
8. Dependency constraints
9. Rollback bundles
10. Content drafts + RLS
11. Media admin MVP
12. PDF support
13. Auth profiles + invites
14. Security hardening
    15-18. RLS fixes
15. System settings

---

## Maintenance

- **Last verified**: 2025-12-10
- **Related code**: `supabase/migrations/`, `data/repositories/`, `data/types.ts`
- **Update when**: New migrations added, schema changes
- **Related docs**: [Architecture Overview](OVERVIEW.md)
