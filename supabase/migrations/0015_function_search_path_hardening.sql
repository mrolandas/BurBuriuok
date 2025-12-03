-- 0015_function_search_path_hardening.sql
-- Pins the search_path for security-sensitive helper functions so their
-- execution context cannot be hijacked via role-level search_path tweaks.

alter function burburiuok.is_admin_session() set search_path = pg_catalog, pg_temp;
alter function burburiuok.profiles_set_timestamps() set search_path = pg_catalog, pg_temp;
alter function burburiuok.admin_invites_set_timestamps() set search_path = pg_catalog, pg_temp;
alter function burburiuok.content_drafts_set_defaults() set search_path = pg_catalog, pg_temp;
alter function burburiuok.content_drafts_set_update_metadata() set search_path = pg_catalog, pg_temp;
alter function burburiuok.content_versions_set_defaults() set search_path = pg_catalog, pg_temp;
alter function burburiuok.content_version_changes_set_defaults() set search_path = pg_catalog, pg_temp;
