-- 0006_curriculum_dependencies_media.sql
-- Introduces prerequisite mapping, content versioning, and media moderation scaffolding.

create extension if not exists "pgcrypto";

create table if not exists burburiuok.curriculum_dependencies (
    id uuid primary key default gen_random_uuid(),
    source_type text not null check (source_type in ('concept', 'node')),
    source_concept_id uuid references burburiuok.concepts (id) on delete cascade,
    source_node_code text references burburiuok.curriculum_nodes (code) on delete cascade,
    prerequisite_type text not null check (prerequisite_type in ('concept', 'node')),
    prerequisite_concept_id uuid references burburiuok.concepts (id) on delete cascade,
    prerequisite_node_code text references burburiuok.curriculum_nodes (code) on delete cascade,
    notes text,
    created_by text,
    created_at timestamptz not null default timezone('utc', now()),
    constraint curriculum_dependencies_source_chk
        check (
            (source_type = 'concept' and source_concept_id is not null and source_node_code is null)
            or (source_type = 'node' and source_node_code is not null and source_concept_id is null)
        ),
    constraint curriculum_dependencies_prerequisite_chk
        check (
            (prerequisite_type = 'concept' and prerequisite_concept_id is not null and prerequisite_node_code is null)
            or (prerequisite_type = 'node' and prerequisite_node_code is not null and prerequisite_concept_id is null)
        )
);

create index if not exists curriculum_dependencies_source_concept_idx
    on burburiuok.curriculum_dependencies (source_concept_id)
    where source_type = 'concept';

create index if not exists curriculum_dependencies_source_node_idx
    on burburiuok.curriculum_dependencies (source_node_code)
    where source_type = 'node';

create index if not exists curriculum_dependencies_prereq_concept_idx
    on burburiuok.curriculum_dependencies (prerequisite_concept_id)
    where prerequisite_type = 'concept';

create index if not exists curriculum_dependencies_prereq_node_idx
    on burburiuok.curriculum_dependencies (prerequisite_node_code)
    where prerequisite_type = 'node';

create unique index if not exists curriculum_dependencies_concept_to_concept_uniq
    on burburiuok.curriculum_dependencies (source_concept_id, prerequisite_concept_id)
    where source_type = 'concept' and prerequisite_type = 'concept';

create unique index if not exists curriculum_dependencies_node_to_node_uniq
    on burburiuok.curriculum_dependencies (source_node_code, prerequisite_node_code)
    where source_type = 'node' and prerequisite_type = 'node';

create table if not exists burburiuok.content_versions (
    id uuid primary key default gen_random_uuid(),
    entity_type text not null check (entity_type in ('curriculum_node', 'curriculum_item', 'concept', 'media_asset')),
    entity_primary_key text not null,
    version integer not null default 1,
    status text not null check (status in ('draft', 'in_review', 'published', 'archived')),
    change_summary text,
    diff jsonb,
    created_by text,
    created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists content_versions_entity_version_idx
    on burburiuok.content_versions (entity_type, entity_primary_key, version);

create index if not exists content_versions_status_idx
    on burburiuok.content_versions (status);

create table if not exists burburiuok.media_assets (
    id uuid primary key default gen_random_uuid(),
    concept_id uuid references burburiuok.concepts (id) on delete set null,
    curriculum_node_code text references burburiuok.curriculum_nodes (code) on delete set null,
    storage_path text,
    external_url text,
    media_type text not null check (media_type in ('image', 'video', 'pdf', 'audio', 'link')),
    language text not null default 'lt',
    title text,
    caption_lt text,
    caption_en text,
    description text,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'archived')),
    submitted_by text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint media_assets_location_chk
        check (
            (storage_path is not null) or (external_url is not null)
        )
);

create index if not exists media_assets_concept_idx
    on burburiuok.media_assets (concept_id)
    where concept_id is not null;

create index if not exists media_assets_node_idx
    on burburiuok.media_assets (curriculum_node_code)
    where curriculum_node_code is not null;

create index if not exists media_assets_status_idx
    on burburiuok.media_assets (status);

create table if not exists burburiuok.media_reviews (
    id uuid primary key default gen_random_uuid(),
    media_id uuid not null references burburiuok.media_assets (id) on delete cascade,
    reviewer text not null,
    decision text not null check (decision in ('approved', 'rejected')),
    notes text,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists media_reviews_media_idx
    on burburiuok.media_reviews (media_id, created_at desc);

comment on table burburiuok.curriculum_dependencies is 'Maps curriculum concepts or nodes to their prerequisite concepts or nodes.';
comment on table burburiuok.content_versions is 'Tracks draft and published revisions for curriculum and media entities.';
comment on table burburiuok.media_assets is 'Stores metadata for user-submitted media tied to concepts or curriculum nodes.';
comment on table burburiuok.media_reviews is 'Moderation decisions for media assets with reviewer notes.';

grant select, insert, update, delete on burburiuok.curriculum_dependencies to service_role;
grant select, insert, update, delete on burburiuok.content_versions to service_role;
grant select, insert, update, delete on burburiuok.media_assets to service_role;
grant select, insert, update, delete on burburiuok.media_reviews to service_role;

-- Access for anon/authenticated will be opened once RLS policies are defined.
