-- 0001_initial_schema.sql
-- Creates the core BurBuriuok schema and V1 tables in Supabase.

create schema if not exists burburiuok;

create table if not exists burburiuok.concepts (
    id uuid primary key default gen_random_uuid(),
    section_code text not null,
    section_title text,
    subsection_code text,
    subsection_title text,
    slug text unique not null,
    term_lt text not null,
    term_en text,
    description_lt text,
    description_en text,
    source_ref text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists concepts_section_term_idx
    on burburiuok.concepts (section_code, term_lt);

create table if not exists burburiuok.concept_progress (
    concept_id uuid not null references burburiuok.concepts (id) on delete cascade,
    device_key text not null,
    status text not null default 'learning', -- learning | known | review
    last_reviewed_at timestamptz not null default timezone('utc', now()),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    primary key (concept_id, device_key)
);

create index if not exists concept_progress_device_idx
    on burburiuok.concept_progress (device_key);

-- TODO(V2): add profiles, notes, and media tables once authentication is enabled.
