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
  - `snapshot` (jsonb, 2025-11-13) persists the full serialized entity state at the time of the change so rollback flows can restore concept + curriculum bundles without relying on inferred diffs. Older versions without snapshots remain view-only in history.
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
  - Superseded by the 2025-11-13 update: RLS now restricts access to service-role or admin JWT sessions (`burburiuok.is_admin_session()`), keeping learner/anon clients out of history tables.

## 2025-11-13 – Content Drafts & RLS Guardrails

- **Tables**: `content_drafts`
  - `id` (uuid default `gen_random_uuid()`) primary key.
  - `entity_type` (text) constrained to the same enum values as `content_versions` (`curriculum_node`, `curriculum_item`, `concept`, `media_asset`).
  - `entity_primary_key` (text) stores the upstream identifier (slug/code/uuid) of the entity being drafted. Unique together with `entity_type` to keep a single working copy per entity.
  - `payload` (jsonb default `{}`) stores the serialised draft body; hydration mirrors the admin form payload.
  - `status` (text) constrained to `draft` or `in_review` with default `draft`.
  - `change_summary` (text) optional narrative describing the work-in-progress.
  - `version_id` (uuid nullable) references the latest `content_versions.id` recorded for the draft save, enabling quick diff lookups.
  - `created_by` / `updated_by` (text) capture Supabase JWT subject when present; trigger falls back to `system` for service-role writes.
  - `created_at` / `updated_at` (timestamptz) auto-stamped via triggers `content_drafts_set_defaults` and `content_drafts_set_update_metadata`.
- **Triggers**:
  - `content_drafts_set_defaults` mirrors the history table defaults, ensuring metadata + payload never land null and actor attribution survives service-role calls.
  - `content_drafts_set_update_metadata` refreshes timestamps/actor on every mutation and guards against null payload assignments.
- **Row Level Security**:
  - Added helper `burburiuok.is_admin_session()` returning `true` for service-role, Supabase dashboard sessions, or JWTs carrying `app_role='admin'`.
  - Enabled RLS on `content_versions`, `content_version_changes`, and `content_drafts`; single policy per table (`*_admin_manage`) grants full access only when `is_admin_session()` is true. Non-admin/authenticated clients can read/write drafts only after real Supabase auth lands.
  - Granted `select` on history tables to `authenticated` role (admin JWT path) and full CRUD to `service_role`; drafts expose CRUD to `authenticated` so the future admin client can save directly when auth is live.
- **Workflow Alignment**:
  - Backend audit logger now reconciles `content_drafts`: draft/in-review saves upsert the working copy (tracking the new version id), while publish/archive operations remove the draft row. Empty snapshots skip persistence to avoid lingering blank drafts.
  - Regression guard `npm run test:db002` provisions disposable concepts, exercises draft→publish transitions via the backend service, and confirms RLS access for service-role keys; run this after migrations/policy updates.

## 2025-11-17 – Admin Media MVP (supersedes moderation plan)

- **Tables**: `media_assets`
  - `id` (uuid default `gen_random_uuid()`) primary key.
  - `concept_id` (uuid, not null) references `concepts.id` – current MVP scopes assets to concepts only.
  - `asset_type` (text) constrained to `image` or `video` (enum created in migration).
  - `storage_path` (text, not null) holds Supabase Storage object path (`media-admin` bucket).
  - `external_url` (text, nullable) reserved for future embeds (ADMIN attaches curated URLs without upload).
  - `title` (text) optional short label shown in admin list.
  - `caption_en` / `caption_lt` (text, nullable) localised captions; MVP requires only `caption_lt` or `caption_en` but allows both.
  - `created_by` (text, not null) stores admin identifier (email or Supabase UID).
  - `created_at` (timestamptz default `timezone('utc', now())`).
  - Unique constraint on `(concept_id, storage_path)` prevents duplicate attachments.
- **Optional table**: `media_asset_variants`
  - `id` (uuid) primary key.
  - `asset_id` (uuid) references `media_assets.id` on delete cascade.
  - `variant_type` (text) constrained to `thumbnail`, `preview`.
  - `storage_path` (text) for derived asset location.
  - `created_at` (timestamptz default `timezone('utc', now())`).
  - Used only when we generate thumbnails – safe to defer creation until variant logic ships.
- **Policies**:
  - Enable RLS on `media_assets`; grant select/insert/delete/update to sessions where `burburiuok.is_admin_session()` returns true. Service role retains full access; learners remain blocked.
  - No moderation states or review queues; admins are expected to upload only approved content.
- **Storage**:
  - Single Supabase bucket `media-admin` with read/write restricted to admins. Backend issues signed URLs for learner consumption.
- **Migration notes**:
  - Drop any obsolete moderation enum values (`pending`, `approved`, etc.) and the unused `media_reviews` table when generating the new migration.
  - Seed script should remain empty until we add baseline curated assets.

### Implementation Checklist (MEDIA-001)

1. Generate migration `supabase/migrations/0011_media_admin_mvp.sql` that:
   - Creates `burburiuok.media_assets` with columns/constraints enumerated above.
   - Defines enum `media_asset_type` (`image`, `video`) and references it from `media_assets.asset_type`.
   - Creates optional `media_asset_variants` table guarded behind `DO $$ ... $$` so it can be skipped when variants are not needed yet.
   - Grants usage/select/insert/update/delete on the new tables to `service_role` and `authenticated` (admin JWT path) as required.
2. Enable RLS on `media_assets` (and `media_asset_variants` when created) with policy `media_assets_admin_manage` invoking `burburiuok.is_admin_session()` for all operations. Deny all by default.
3. Add storage policy in Supabase dashboard/SQL editor:
   - Bucket `media-admin` → insert/update/delete limited to `burburiuok.is_admin_session()`.
   - Select requires signed URLs; leave public access disabled.
4. Update tooling:

- Add `npm run test:media001` to validate CRUD against the admin policy, including failure case for learner JWT.
- Document bucket + migration roll-out steps in `docs/references/infrastructure/SUPABASE.md`.

5. Apply migration locally (`npx supabase db push --include-seed`) and in staging/production after verifying bucket creation.
6. Record automated verification status (MEDIA-001 test) in session log before implementation wrap.

#### Rollback Plan

- Migration rollback: `drop table if exists burburiuok.media_asset_variants cascade; drop table if exists burburiuok.media_assets cascade; drop type if exists media_asset_type;` followed by re-creating the previous moderation tables if required.
- Storage rollback: remove `media-admin` bucket (or clear contents) via Supabase dashboard and restore previous bucket policies.
- Document rollback execution in `docs/session/current_session.md` session log if invoked.

#### Implementation Notes

- 2025-11-18: Migration `0011_media_admin_mvp.sql` applied to hosted project; admin-only tables/policies live.
- 2025-11-18: Smoke test `npm run test:media001` added to guard RLS and Supabase REST behaviour.

## 2025-11-03 – Media Moderation _(deferred until contributor uploads return)_

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
