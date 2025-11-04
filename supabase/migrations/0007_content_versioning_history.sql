-- 0007_content_versioning_history.sql
-- Adds change history table and triggers to manage content version metadata.

alter table burburiuok.content_versions
    alter column status set default 'draft';

create table if not exists burburiuok.content_version_changes (
    id uuid primary key default gen_random_uuid(),
    version_id uuid not null references burburiuok.content_versions (id) on delete cascade,
    field_path text not null,
    old_value jsonb,
    new_value jsonb,
    change_type text not null default 'update' check (change_type in ('create', 'update', 'delete')),
    created_by text,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists content_version_changes_version_idx
    on burburiuok.content_version_changes (version_id);

comment on table burburiuok.content_version_changes is 'Field-level diff records attached to content_versions entries.';

create or replace function burburiuok.content_versions_set_defaults()
returns trigger
language plpgsql
as $$
declare
    next_version integer;
    request_user text;
begin
    if new.version is null or new.version < 1 then
        select coalesce(max(version), 0) + 1
        into next_version
        from burburiuok.content_versions
        where entity_type = new.entity_type
          and entity_primary_key = new.entity_primary_key;
        new.version := coalesce(next_version, 1);
    end if;

    if new.status is null then
        new.status := 'draft';
    end if;

    if new.created_at is null then
        new.created_at := timezone('utc', now());
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

    return new;
end;
$$;

drop trigger if exists content_versions_set_defaults on burburiuok.content_versions;
create trigger content_versions_set_defaults
    before insert on burburiuok.content_versions
    for each row
    execute function burburiuok.content_versions_set_defaults();

create or replace function burburiuok.content_version_changes_set_defaults()
returns trigger
language plpgsql
as $$
declare
    request_user text;
begin
    if new.created_at is null then
        new.created_at := timezone('utc', now());
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

    return new;
end;
$$;

drop trigger if exists content_version_changes_set_defaults on burburiuok.content_version_changes;
create trigger content_version_changes_set_defaults
    before insert on burburiuok.content_version_changes
    for each row
    execute function burburiuok.content_version_changes_set_defaults();

grant select, insert, update, delete on burburiuok.content_version_changes to service_role;

comment on column burburiuok.content_version_changes.field_path is 'JSON path (dot notation) describing the field being changed.';
comment on column burburiuok.content_version_changes.change_type is 'Type of change represented by this record (create/update/delete).';
