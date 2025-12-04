-- 0017_progress_conflict_and_view.sql
-- Adds a unique constraint for authenticated progress upserts and flips the
-- public progress view to SECURITY INVOKER to satisfy Supabase advisor rules.

alter table burburiuok.concept_progress
    drop constraint if exists concept_progress_concept_user_unique;

drop index if exists concept_progress_user_unique_idx;

alter table burburiuok.concept_progress
    add constraint concept_progress_concept_user_unique unique (concept_id, user_id);

-- recreate the helper index without a unique requirement so lookups remain quick
-- for authenticated learners.
create index if not exists concept_progress_user_idx
    on burburiuok.concept_progress (user_id)
    where user_id is not null;

-- ensure the public view no longer runs with security definer privileges.
drop view if exists public.burburiuok_concept_progress;

create view public.burburiuok_concept_progress
with (security_invoker = true) as
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
