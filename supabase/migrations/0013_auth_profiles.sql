-- 0013_auth_profiles.sql
-- Introduce learner profiles and admin invite tracking with row-level security.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'burburiuok'
          AND t.typname = 'profile_role'
    ) THEN
        CREATE TYPE burburiuok.profile_role AS ENUM ('learner', 'admin', 'contributor');
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS burburiuok.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    email text NOT NULL CHECK (position('@' in email) > 1),
    role burburiuok.profile_role NOT NULL DEFAULT 'learner',
    preferred_language text NOT NULL DEFAULT 'lt' CHECK (preferred_language IN ('lt', 'en')),
    callsign text,
    device_key_hash text,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_idx
    ON burburiuok.profiles (lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_device_key_hash_unique_idx
    ON burburiuok.profiles (device_key_hash)
    WHERE device_key_hash IS NOT NULL;

COMMENT ON TABLE burburiuok.profiles IS 'Per-user metadata synced with Supabase Auth (role, locale, callsign, device key hash).';
COMMENT ON COLUMN burburiuok.profiles.email IS 'Cached Supabase email value for quick lookups in admin tools.';
COMMENT ON COLUMN burburiuok.profiles.role IS 'Application role mirrored into Supabase JWT app_role claim.';
COMMENT ON COLUMN burburiuok.profiles.device_key_hash IS 'Optional hashed device key used for progress migration (AUTH-003).';

CREATE OR REPLACE FUNCTION burburiuok.profiles_set_timestamps()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.created_at IS NULL THEN
        NEW.created_at := timezone('utc', now());
    END IF;

    NEW.updated_at := timezone('utc', now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_timestamps ON burburiuok.profiles;
CREATE TRIGGER profiles_set_timestamps
    BEFORE INSERT OR UPDATE ON burburiuok.profiles
    FOR EACH ROW
    EXECUTE FUNCTION burburiuok.profiles_set_timestamps();

ALTER TABLE burburiuok.profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON burburiuok.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON burburiuok.profiles TO service_role;

CREATE POLICY profiles_self_select
    ON burburiuok.profiles
    FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY profiles_self_upsert
    ON burburiuok.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_self_update
    ON burburiuok.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS burburiuok.admin_invites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL CHECK (position('@' in email) > 1),
    role burburiuok.profile_role NOT NULL DEFAULT 'admin',
    token_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    invited_by uuid REFERENCES burburiuok.profiles (id) ON DELETE SET NULL,
    accepted_profile_id uuid REFERENCES burburiuok.profiles (id) ON DELETE SET NULL,
    accepted_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_invites_token_hash_unique_idx
    ON burburiuok.admin_invites (token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS admin_invites_active_email_unique_idx
    ON burburiuok.admin_invites (lower(email))
    WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS admin_invites_status_idx
    ON burburiuok.admin_invites ((accepted_at IS NULL), expires_at DESC);

COMMENT ON TABLE burburiuok.admin_invites IS 'Admin-issued invitation tokens for onboarding new users/roles.';
COMMENT ON COLUMN burburiuok.admin_invites.token_hash IS 'Hashed invite token; compare using the same hashing algorithm at runtime.';
COMMENT ON COLUMN burburiuok.admin_invites.role IS 'Target application role granted when the invite is accepted.';

CREATE OR REPLACE FUNCTION burburiuok.admin_invites_set_timestamps()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.created_at IS NULL THEN
        NEW.created_at := timezone('utc', now());
    END IF;

    NEW.updated_at := timezone('utc', now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_invites_set_timestamps ON burburiuok.admin_invites;
CREATE TRIGGER admin_invites_set_timestamps
    BEFORE INSERT OR UPDATE ON burburiuok.admin_invites
    FOR EACH ROW
    EXECUTE FUNCTION burburiuok.admin_invites_set_timestamps();

ALTER TABLE burburiuok.admin_invites ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON burburiuok.admin_invites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON burburiuok.admin_invites TO service_role;

CREATE POLICY admin_invites_admin_manage
    ON burburiuok.admin_invites
    FOR ALL
    USING (burburiuok.is_admin_session())
    WITH CHECK (burburiuok.is_admin_session());
