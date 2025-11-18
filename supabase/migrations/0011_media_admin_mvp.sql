-- Drop legacy moderation tables/types to prepare for the simplified admin-only schema.
do $$
begin
    if exists (
        select 1 from pg_tables
        where schemaname = 'burburiuok' and tablename = 'media_asset_variants'
    ) then
        execute 'drop table burburiuok.media_asset_variants cascade';
    end if;

    if exists (
        select 1 from pg_tables
        where schemaname = 'burburiuok' and tablename = 'media_reviews'
    ) then
        execute 'drop table burburiuok.media_reviews cascade';
    end if;

    if exists (
        select 1 from pg_tables
        where schemaname = 'burburiuok' and tablename = 'media_assets'
    ) then
        execute 'drop table burburiuok.media_assets cascade';
    end if;

    if exists (
        select 1
        from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where t.typname = 'media_asset_variant_type' and n.nspname = 'burburiuok'
    ) then
        execute 'drop type burburiuok.media_asset_variant_type cascade';
    end if;

    if exists (
        select 1
        from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where t.typname = 'media_asset_status' and n.nspname = 'burburiuok'
    ) then
        execute 'drop type burburiuok.media_asset_status cascade';
    end if;

    if exists (
        select 1
        from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where t.typname = 'media_type' and n.nspname = 'burburiuok'
    ) then
        execute 'drop type burburiuok.media_type cascade';
    end if;

    if exists (
        select 1
        from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where t.typname = 'media_review_decision' and n.nspname = 'burburiuok'
    ) then
        execute 'drop type burburiuok.media_review_decision cascade';
    end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'media_asset_type'
      and n.nspname = 'burburiuok'
  ) then
    create type burburiuok.media_asset_type as enum ('image', 'video');
  end if;
end
$$;

create table if not exists burburiuok.media_assets (
    id uuid primary key default gen_random_uuid(),
    concept_id uuid not null references burburiuok.concepts (id) on delete cascade,
    asset_type burburiuok.media_asset_type not null,
    storage_path text not null check (char_length(btrim(storage_path)) > 0),
    external_url text,
    title text,
    caption_lt text,
    caption_en text,
    created_by text not null default 'system',
    created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists media_assets_concept_storage_idx
    on burburiuok.media_assets (concept_id, storage_path);

create index if not exists media_assets_concept_idx
    on burburiuok.media_assets (concept_id);

create index if not exists media_assets_type_idx
    on burburiuok.media_assets (asset_type);

comment on table burburiuok.media_assets is 'Admin-managed media assets scoped to curriculum concepts.';
comment on column burburiuok.media_assets.storage_path is 'Supabase Storage object path located in the media-admin bucket.';
comment on column burburiuok.media_assets.external_url is 'Optional external link for curated embeds (deferred).';
comment on column burburiuok.media_assets.caption_lt is 'Lithuanian caption shown to learners.';
comment on column burburiuok.media_assets.caption_en is 'English caption shown to admins or for reference.';

create table if not exists burburiuok.media_asset_variants (
    id uuid primary key default gen_random_uuid(),
    asset_id uuid not null references burburiuok.media_assets (id) on delete cascade,
    variant_type text not null check (variant_type in ('thumbnail', 'preview')),
    storage_path text not null check (char_length(btrim(storage_path)) > 0),
    created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists media_asset_variants_unique_idx
    on burburiuok.media_asset_variants (asset_id, variant_type);

create index if not exists media_asset_variants_asset_idx
    on burburiuok.media_asset_variants (asset_id);

comment on table burburiuok.media_asset_variants is 'Optional derived assets (e.g. thumbnails) generated from admin uploads.';
comment on column burburiuok.media_asset_variants.variant_type is 'Identifies the derived variant (thumbnail, preview, etc.).';

alter table burburiuok.media_assets enable row level security;
alter table burburiuok.media_asset_variants enable row level security;

grant select, insert, update, delete on burburiuok.media_assets to authenticated;
grant select, insert, update, delete on burburiuok.media_asset_variants to authenticated;

grant select, insert, update, delete on burburiuok.media_assets to service_role;
grant select, insert, update, delete on burburiuok.media_asset_variants to service_role;

create policy media_assets_admin_manage
    on burburiuok.media_assets
    for all
    using (burburiuok.is_admin_session())
    with check (burburiuok.is_admin_session());

create policy media_asset_variants_admin_manage
    on burburiuok.media_asset_variants
    for all
    using (burburiuok.is_admin_session())
    with check (burburiuok.is_admin_session());

-- Storage bucket policies for admin-only media uploads.
revoke all on storage.objects from public;

do $$
begin
    if exists (
        select 1
        from pg_policies
        where schemaname = 'storage'
            and tablename = 'objects'
            and policyname = 'Allow admin media insert'
    ) then
        execute 'drop policy "Allow admin media insert" on storage.objects';
    end if;

    if exists (
        select 1
        from pg_policies
        where schemaname = 'storage'
            and tablename = 'objects'
            and policyname = 'Allow admin media update'
    ) then
        execute 'drop policy "Allow admin media update" on storage.objects';
    end if;

    if exists (
        select 1
        from pg_policies
        where schemaname = 'storage'
            and tablename = 'objects'
            and policyname = 'Allow admin media delete'
    ) then
        execute 'drop policy "Allow admin media delete" on storage.objects';
    end if;

    if exists (
        select 1
        from pg_policies
        where schemaname = 'storage'
            and tablename = 'objects'
            and policyname = 'Allow admin media select'
    ) then
        execute 'drop policy "Allow admin media select" on storage.objects';
    end if;
end
$$;

create policy "Allow admin media insert"
        on storage.objects
        for insert
        with check (bucket_id = 'media-admin' and burburiuok.is_admin_session());

create policy "Allow admin media update"
        on storage.objects
        for update
        using (bucket_id = 'media-admin' and burburiuok.is_admin_session())
        with check (bucket_id = 'media-admin' and burburiuok.is_admin_session());

create policy "Allow admin media delete"
        on storage.objects
        for delete
        using (bucket_id = 'media-admin' and burburiuok.is_admin_session());

create policy "Allow admin media select"
        on storage.objects
        for select
        using (bucket_id = 'media-admin' and burburiuok.is_admin_session());
