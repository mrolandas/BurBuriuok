-- 0016_progress_user_identity.sql
-- Adds user-scoped progress tracking while keeping device-key entries for
-- anonymous learners during the transition period.

alter table burburiuok.concept_progress
    drop constraint if exists concept_progress_pkey;

alter table burburiuok.concept_progress
    add column if not exists id uuid default gen_random_uuid(),
    add column if not exists user_id uuid references auth.users (id) on delete cascade,
    alter column device_key drop not null;

alter table burburiuok.concept_progress
    add constraint concept_progress_pkey primary key (id);

create unique index if not exists concept_progress_user_unique_idx
    on burburiuok.concept_progress (concept_id, user_id)
    where user_id is not null;

create index if not exists concept_progress_user_idx
    on burburiuok.concept_progress (user_id)
    where user_id is not null;

drop view if exists public.burburiuok_concept_progress;

create view public.burburiuok_concept_progress as
select
    concept_id,
    device_key,
    user_id,
    status,
    last_reviewed_at,
    created_at,
    updated_at
from burburiuok.concept_progress;

grant select on public.burburiuok_concept_progress to anon, authenticated;
grant select, insert, update, delete on public.burburiuok_concept_progress to service_role;
