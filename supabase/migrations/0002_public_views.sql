-- 0002_public_views.sql
-- Expose public-facing views over the burburiuok schema for Supabase REST access.

create or replace view public.burburiuok_concepts as
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
    created_at,
    updated_at
from burburiuok.concepts;

comment on view public.burburiuok_concepts is 'Read-only view exposing burburiuok.concepts to Supabase REST.';

grant select on public.burburiuok_concepts to anon, authenticated;
grant select, insert, update, delete on public.burburiuok_concepts to service_role;

create or replace view public.burburiuok_concept_progress as
select
    concept_id,
    device_key,
    status,
    last_reviewed_at,
    created_at,
    updated_at
from burburiuok.concept_progress;

comment on view public.burburiuok_concept_progress is 'View exposing progress records. Write access restricted to service role until auth is introduced.';

grant select on public.burburiuok_concept_progress to anon, authenticated;
grant select, insert, update, delete on public.burburiuok_concept_progress to service_role;
