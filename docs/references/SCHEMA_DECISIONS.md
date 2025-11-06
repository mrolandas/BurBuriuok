# Schema Decisions – Prerequisites, Drafts, Media

This log captures authoritative decisions about the evolving Supabase schema so migrations, seeds, and docs stay aligned.

## 2025-11-06 – Concept Draft Status Metadata

- **Tables**: `concepts`
  - Draft/published state stores inside the `metadata` JSON column under the `status` key.
  - Service defaults the value to `draft` when absent so legacy rows remain editable without migration.
  - Admin API normalises optional metadata fields while preserving unknown keys for forward compatibility.
- **Validation**: Shared schema (`shared/validation/adminConceptSchema.ts`) requires the request body to provide an explicit `status` (`draft` or `published`) and rejects mismatched `metadata.status` values.
- **Audit logging**: Concept saves continue to write a row to `content_versions` with the requested `status` so moderation workflows can track promotion from draft to published.
- **Follow-up**: Revisit once Supabase RLS rules enforce per-status visibility; until then, learners keep reading from the public view and ignore draft flag.

## 2025-11-03 – Curriculum Dependencies

- **Tables**: `curriculum_dependencies`
  - `id` (uuid default `gen_random_uuid()`) primary key.
  - `source_type` (text) constrained to `concept` or `node`.
  - `source_concept_id` (uuid, nullable) references `concepts.id` when `source_type = 'concept'`.
  - `source_node_code` (text, nullable) references `curriculum_nodes.code` when `source_type = 'node'`.
  - `prerequisite_type` (text) constrained to `concept` or `node`.
  - `prerequisite_concept_id` (uuid, nullable) references `concepts.id` when `prerequisite_type = 'concept'`.
  - `prerequisite_node_code` (text, nullable) references `curriculum_nodes.code` when `prerequisite_type = 'node'`.
  - `notes` (text) for reviewer context.
  - `created_by` (text) for lightweight audit; defaults handled in seed files.
  - `created_at` (timestamptz) default `timezone('utc', now())`.
- **Constraints & Indexes**:
  - `curriculum_dependencies_source_chk` / `curriculum_dependencies_prerequisite_chk` enforce that concept/node identifiers are mutually exclusive.
  - Filtered indexes for each lookup leg: `curriculum_dependencies_source_concept_idx`, `curriculum_dependencies_source_node_idx`, `curriculum_dependencies_prereq_concept_idx`, `curriculum_dependencies_prereq_node_idx`.
  - Partial unique indexes on concept→concept (`curriculum_dependencies_concept_to_concept_uniq`) and node→node (`curriculum_dependencies_node_to_node_uniq`) edges prevent duplicate rows while keeping cross-type links flexible; migration `0008_curriculum_dependency_constraint_patch.sql` reasserts these indexes for the hosted project.
- **Seed strategy**:
  - `content/scripts/build_dependency_seed_sql.mjs` reads `content/raw/curriculum_dependencies.json` and generates `supabase/seeds/seed_curriculum_dependencies.sql` with idempotent inserts using a conflict target on `(source_node_code, prerequisite_node_code)` constrained to node→node edges.
  - Initial data focuses on top-level module prerequisites; expand the JSON when concept-level edges are ready.
- **Policies**:
  - RLS remains disabled (service-role only). Once persona roles land, restrict inserts to admins and expose read-only views for learners.

## 2025-11-03 – Content Versioning

- **Tables**: `content_versions`
  - `id` (uuid default `gen_random_uuid()`) primary key.
  - `entity_type` (text) constrained to `curriculum_node`, `curriculum_item`, `concept`, or `media_asset`.
  - `entity_primary_key` (text) stores the upstream identifier (UUID or code) of the entity being versioned.
  - `version` (integer) auto-increments per entity via trigger (`content_versions_set_defaults`).
  - `status` (text) constrained to `draft`, `in_review`, `published`, `archived` with default `draft`.
  - `change_summary` (text) provides human-readable context.
  - `diff` (jsonb) captures serialized field deltas for tooling.
  - `created_by` (text) defaults to request JWT `sub` claim or `system` fallback in trigger.
  - `created_at` (timestamptz) default `timezone('utc', now())`.
- **Tables**: `content_version_changes`
  - Stores field-level diffs linked to `content_versions.id` (`version_id` FK, cascade delete).
  - `field_path` (text) records dotted JSON path; `change_type` (`create|update|delete`) defaults to `update`.
  - `old_value` / `new_value` (jsonb) hold before/after payloads; `created_by` mirrors JWT fallback logic, `created_at` auto-stamped.
  - Indexed on `version_id` for fast joins in history views.
- **Triggers & functions (0007_content_versioning_history.sql)**:
  - `content_versions_set_defaults` assigns sequential version numbers per entity and fills audit metadata when callers omit fields.
  - `content_version_changes_set_defaults` ensures change rows capture actor/timestamp metadata consistently.
- **Workflow**:
  - Draft rows represent proposed edits. Publishing logic (future trigger or service) will promote a draft to `published` and synchronize canonical tables.
  - `diff` payload is optional for MVP; downstream services can parse it for review tooling.
  - `content_version_changes` is optional to populate from services until automated diffing lands.
- **Policies**:
  - No RLS yet; inserts limited to service role. Introduce role-bound policies once admin/auth scaffolding lands.

## 2025-11-03 – Media Moderation

- **Tables**: `media_assets`, `media_reviews`
  - `media_assets`
    - `id` (uuid default `gen_random_uuid()`) primary key.
    - `concept_id` (uuid, nullable) references `concepts.id` for concept-scoped media.
    - `curriculum_node_code` (text, nullable) references `curriculum_nodes.code` for section-level media.
    - `storage_path` (text, nullable) holds Supabase Storage object path when managed internally.
    - `external_url` (text, nullable) for externally hosted assets.
    - `media_type` (text) constrained to `image`, `video`, `pdf`, `audio`, `link`.
    - `language` (text) default `lt` for localized captions.
    - `title`, `caption_lt`, `caption_en`, `description` (text) metadata fields.
    - `status` (text) constrained to `pending`, `approved`, `rejected`, `archived` with default `pending`.
    - `submitted_by` (text) stores submitter identifier (email or Supabase UID placeholder).
    - `metadata` (jsonb default `{}`) stores EXIF and processing details.
    - `created_at`, `updated_at` (timestamptz) default `timezone('utc', now())`.
    - Check constraint ensures either `storage_path` or `external_url` is present.
  - `media_reviews`
    - `id` (uuid default `gen_random_uuid()`) primary key.
    - `media_id` (uuid) references `media_assets.id` on delete cascade.
    - `reviewer` (text) records moderator identity.
    - `decision` (text) constrained to `approved` or `rejected`.
    - `notes` (text) optional moderator notes.
    - `created_at` (timestamptz) default `timezone('utc', now())`.
- **Indexes**:
  - Lookup indexes on `concept_id`, `curriculum_node_code`, and `status` for moderation dashboards.
  - `media_reviews_media_idx` orders reviews per asset by recency.
- **Storage policy**:
  - Keep Supabase bucket folders `pending/<concept-or-node>/<uuid>` and optional `approved/` mirror; policies will grant update/delete to moderators.
- **Hooks**:
  - Future edge function will emit notifications on `media_reviews` insert.
  - Scheduled cleanup job can archive or delete assets left in `rejected` beyond retention window.

> Update this file whenever a schema decision is ratified. Link to associated migrations and PRs for traceability.
