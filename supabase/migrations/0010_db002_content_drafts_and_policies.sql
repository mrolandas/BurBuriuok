-- 0010_db002_content_drafts_and_policies.sql
-- Introduces the content_drafts table and Row Level Security policies for
-- versioning tables so only admins (or the service role) can access history data.

create or replace function burburiuok.is_admin_session()
returns boolean
language sql
stable
as $$
  select case
    when auth.role() = 'service_role' then true
    when auth.role() = 'supabase_admin' then true
    else coalesce(auth.jwt()->>'app_role', '') = 'admin'
  end;
$$;

comment on function burburiuok.is_admin_session() is
  'Returns true when the current Supabase session belongs to the service role or an admin JWT (app_role="admin").';

create table if not exists burburiuok.content_drafts (
    id uuid primary key default gen_random_uuid(),
    entity_type text not null check (entity_type in ('curriculum_node', 'curriculum_item', 'concept', 'media_asset')),
    entity_primary_key text not null,
    payload jsonb not null default '{}'::jsonb,
    status text not null default 'draft' check (status in ('draft', 'in_review')),
    change_summary text,
    version_id uuid references burburiuok.content_versions (id) on delete set null,
    created_by text,
    updated_by text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists content_drafts_entity_unique_idx
    on burburiuok.content_drafts (entity_type, entity_primary_key);

create index if not exists content_drafts_status_idx
    on burburiuok.content_drafts (status);

comment on table burburiuok.content_drafts is 'Working copies of content entities prior to publication.';
comment on column burburiuok.content_drafts.payload is 'Serialized draft payload saved from the admin console.';
comment on column burburiuok.content_drafts.version_id is 'Latest content_versions.id associated with this draft snapshot.';

create or replace function burburiuok.content_drafts_set_defaults()
returns trigger
language plpgsql
as $$
declare
    request_user text;
begin
    if new.created_at is null then
        new.created_at := timezone('utc', now());
    end if;

    if new.updated_at is null then
        new.updated_at := new.created_at;
    end if;

    if new.payload is null then
        new.payload := '{}'::jsonb;
    end if;

    if new.created_by is null or length(trim(new.created_by)) = 0 then
        begin
            request_user := current_setting('request.jwt.claim.sub', true);
        exception
            when others then
                request_user := null;
        end;

        if request_user is null then
            request_user := 'system';
        end if;

        new.created_by := request_user;
    end if;

    if new.updated_by is null or length(trim(new.updated_by)) = 0 then
        new.updated_by := new.created_by;
    end if;

    return new;
end;
$$;

create or replace function burburiuok.content_drafts_set_update_metadata()
returns trigger
language plpgsql
as $$
declare
    request_user text;
begin
    new.updated_at := timezone('utc', now());

    if new.payload is null then
        new.payload := '{}'::jsonb;
    end if;

    if new.updated_by is null or length(trim(new.updated_by)) = 0 then
        begin
            request_user := current_setting('request.jwt.claim.sub', true);
        exception
            when others then
                request_user := null;
        end;

        if request_user is null then
            request_user := 'system';
        end if;

        new.updated_by := request_user;
    end if;

    return new;
end;
$$;

drop trigger if exists content_drafts_set_defaults on burburiuok.content_drafts;
create trigger content_drafts_set_defaults
    before insert on burburiuok.content_drafts
    for each row
    execute function burburiuok.content_drafts_set_defaults();

drop trigger if exists content_drafts_set_update_metadata on burburiuok.content_drafts;
create trigger content_drafts_set_update_metadata
    before update on burburiuok.content_drafts
    for each row
    execute function burburiuok.content_drafts_set_update_metadata();

alter table burburiuok.content_versions enable row level security;
alter table burburiuok.content_version_changes enable row level security;
alter table burburiuok.content_drafts enable row level security;

grant select on burburiuok.content_versions to authenticated;
grant select, insert, update, delete on burburiuok.content_versions to service_role;

grant select on burburiuok.content_version_changes to authenticated;
grant select, insert, update, delete on burburiuok.content_version_changes to service_role;

grant select, insert, update, delete on burburiuok.content_drafts to authenticated;
grant select, insert, update, delete on burburiuok.content_drafts to service_role;

create policy content_versions_admin_manage
    on burburiuok.content_versions
    for all
    using (burburiuok.is_admin_session())
    with check (burburiuok.is_admin_session());

create policy content_version_changes_admin_manage
    on burburiuok.content_version_changes
    for all
    using (burburiuok.is_admin_session())
    with check (burburiuok.is_admin_session());

create policy content_drafts_admin_manage
    on burburiuok.content_drafts
    for all
    using (burburiuok.is_admin_session())
    with check (burburiuok.is_admin_session());
