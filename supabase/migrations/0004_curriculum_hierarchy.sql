-- 0004_curriculum_hierarchy.sql
-- Normalizes the curriculum hierarchy into dedicated tables for nodes and items.

create table if not exists burburiuok.curriculum_nodes (
    code text primary key,
    title text not null,
    summary text,
    level integer not null check (level >= 1),
    parent_code text references burburiuok.curriculum_nodes (code) on delete cascade,
    ordinal integer not null check (ordinal >= 1),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists curriculum_nodes_parent_ordinal_idx
    on burburiuok.curriculum_nodes (coalesce(parent_code, ''), ordinal);

create table if not exists burburiuok.curriculum_items (
    node_code text not null references burburiuok.curriculum_nodes (code) on delete cascade,
    ordinal integer not null check (ordinal >= 1),
    label text not null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    primary key (node_code, ordinal)
);

create or replace view public.burburiuok_curriculum_nodes as
select
    code,
    title,
    summary,
    level,
    parent_code,
    ordinal,
    created_at,
    updated_at
from burburiuok.curriculum_nodes;

comment on view public.burburiuok_curriculum_nodes is 'Structured curriculum hierarchy nodes aligned with the LBS program.';

grant select on public.burburiuok_curriculum_nodes to anon, authenticated;
grant select, insert, update, delete on public.burburiuok_curriculum_nodes to service_role;

create or replace view public.burburiuok_curriculum_items as
select
    node_code,
    ordinal,
    label,
    created_at,
    updated_at
from burburiuok.curriculum_items;

comment on view public.burburiuok_curriculum_items is 'Curriculum leaf items (comma-separated bullet points) per curriculum node.';

grant select on public.burburiuok_curriculum_items to anon, authenticated;
grant select, insert, update, delete on public.burburiuok_curriculum_items to service_role;
