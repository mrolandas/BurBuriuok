-- 0005_concepts_curriculum_link.sql
-- Links concept records to the normalized curriculum hierarchy.

alter table burburiuok.concepts
    add column if not exists curriculum_node_code text references burburiuok.curriculum_nodes (code);

alter table burburiuok.concepts
    add column if not exists curriculum_item_ordinal integer;

alter table burburiuok.concepts
    add column if not exists curriculum_item_label text;

create index if not exists concepts_curriculum_node_idx
    on burburiuok.concepts (curriculum_node_code);

create index if not exists concepts_curriculum_item_idx
    on burburiuok.concepts (curriculum_node_code, curriculum_item_ordinal)
    where curriculum_node_code is not null and curriculum_item_ordinal is not null;

drop view if exists public.burburiuok_concepts;

create view public.burburiuok_concepts as
select
    id,
    section_code,
    section_title,
    subsection_code,
    subsection_title,
    slug,
    term_lt,
    term_en,
    description_lt,
    description_en,
    source_ref,
    metadata,
    is_required,
    curriculum_node_code,
    curriculum_item_ordinal,
    curriculum_item_label,
    created_at,
    updated_at
from burburiuok.concepts;

comment on view public.burburiuok_concepts is 'Read-only view exposing burburiuok.concepts for Supabase REST including curriculum linkage.';

grant select on public.burburiuok_concepts to anon, authenticated;
grant select, insert, update, delete on public.burburiuok_concepts to service_role;
