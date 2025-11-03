# Schema Decisions – Prerequisites, Drafts, Media

This log captures authoritative decisions about the evolving Supabase schema so migrations, seeds, and docs stay aligned.

## 2025-11-03 – Curriculum Dependencies

- **Tables**: `curriculum_dependencies`
  - `id` (uuid default gen_random_uuid()) primary key.
  - `source_node_code` (text, not null) references `curriculum_nodes.code`.
  - `target_node_code` (text, not null) references `curriculum_nodes.code`.
  - `source_concept_slug` (text, null) references `concepts.slug` when the dependency is concept-specific.
  - `target_concept_slug` (text, null) references `concepts.slug`.
  - `relation_type` (text, default 'prerequisite') for future expansion (e.g., "related", "follow-up").
  - `notes` (text) for manual annotations.
  - `created_at` / `updated_at` (timestamptz) with default `timezone('utc', now())`.
- **Indexes**:
  - Unique constraint on (`source_node_code`, `target_node_code`, `source_concept_slug`, `target_concept_slug`, `relation_type`).
  - B-tree index on `target_node_code` to accelerate reverse lookups.
- **Seed strategy**:
  - Extend `content/scripts/build_seed_sql.mjs` after dependency data is authored (CSV/markdown) to emit insert statements.
  - For initial rollout, only populate node-level prerequisites; concept-level edges follow once QA approves.
- **Policies**:
  - RLS disabled for now (admin-only access). When roles land, allow admins to insert/update, read-only for learners.

## 2025-11-03 – Content Versioning

- **Tables**: `content_versions`, `content_version_changes`
  - `content_versions`
    - `id` (uuid) primary key.
    - `concept_slug` (text) not null references `concepts.slug`.
    - `status` (text) enum `draft|in_review|published|archived`.
    - `title_lt`, `title_en`, `definition_lt`, `definition_en` (text) snapshot fields.
    - `created_by`, `updated_by` (uuid) referencing `profiles.id` (to be added once auth in place).
    - `created_at`, `updated_at` timestamps.
    - `published_at` nullable timestamp.
  - `content_version_changes`
    - `id` uuid primary key.
    - `version_id` (uuid) references `content_versions.id`.
    - `field` text, `old_value` text, `new_value` text.
    - `created_at` timestamp.
- **Workflow**:
  - Drafts created for every edit; publishing copies snapshot into `concepts` table via trigger/scheduled job.
  - Add trigger to update `concepts.updated_at` when a new version reaches `published`.
- **Policies**:
  - Editors can insert drafts, reviewers can promote to `in_review`/`published`.
  - Learners read only published versions alongside public `concepts` view.

## 2025-11-03 – Media Moderation

- **Tables**: `media_assets`, `media_reviews`
  - `media_assets`
    - `id` uuid primary key.
    - `concept_slug` text references `concepts.slug`.
    - `uploader_id` uuid references `profiles.id`.
    - `storage_path` text not null.
    - `kind` text enum `image|video|document|audio`.
    - `status` text enum `pending|approved|rejected|archived` default `pending`.
    - `metadata` jsonb for EXIF/dimensions.
    - `created_at`, `updated_at` timestamps.
  - `media_reviews`
    - `id` uuid primary key.
    - `asset_id` uuid references `media_assets.id`.
    - `reviewer_id` uuid references `profiles.id`.
    - `decision` text enum `approved|rejected`.
    - `notes` text.
    - `created_at` timestamp.
- **Storage policy**:
  - Use Supabase Storage bucket `concept-images` with folders `pending/<slug>/<uuid>` and `approved/<slug>/`.
  - Only moderators can move files between folders.
- **Hooks**:
  - Edge function trigger on `media_reviews` insert to notify uploader via email/webhook.
  - Optional scheduled job to purge `rejected` assets older than 30 days.

> Update this file whenever a schema decision is ratified. Link to associated migrations and PRs for traceability.
