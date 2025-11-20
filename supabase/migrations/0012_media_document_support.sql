-- Add document support to admin media assets.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE n.nspname = 'burburiuok'
          AND t.typname = 'media_asset_type'
          AND e.enumlabel = 'document'
    ) THEN
        ALTER TYPE burburiuok.media_asset_type ADD VALUE 'document';
    END IF;
END
$$;
