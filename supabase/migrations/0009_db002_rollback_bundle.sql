-- 0009_db002_rollback_bundle.sql
-- Adds snapshot storage for content versions to enable bundle rollbacks.

alter table burburiuok.content_versions
    add column if not exists snapshot jsonb;

comment on column burburiuok.content_versions.snapshot is 'Serialized entity state captured at the time this version was recorded.';
