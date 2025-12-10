# Supabase Configuration

Supabase provides the database, authentication, and storage for Moxlai.

> **Note**: We use hosted Supabase only. Local Supabase is not supported.

## Overview

| Service        | Usage                     |
| -------------- | ------------------------- |
| **PostgreSQL** | Main database             |
| **Auth**       | Magic-link authentication |
| **Storage**    | Media file uploads        |
| **Realtime**   | Not currently used        |

## Project Details

| Aspect         | Value                                                       |
| -------------- | ----------------------------------------------------------- |
| Project Ref    | `zvlziltltbalebqpmuqs`                                      |
| Dashboard      | https://supabase.com/dashboard/project/zvlziltltbalebqpmuqs |
| Region         | West EU (Ireland)                                           |
| Schema         | `burburiuok` (will migrate to `moxlai`)                     |
| Storage Bucket | `media-admin`                                               |

## Supabase CLI Setup

The project is managed via Supabase CLI (no local Docker needed).

### Initial Setup (one-time)

```bash
# Install CLI (if not present)
npm install -g supabase

# Login to Supabase
npx supabase login

# Link to the project
npx supabase link --project-ref zvlziltltbalebqpmuqs
```

### Verify Connection

```bash
# Check linked projects (shows ● next to linked project)
npx supabase projects list

# Test migration status
npx supabase db push --dry-run
```

## Database

### Schema

All tables are in the `burburiuok` schema, not `public`. This provides:

- Namespace isolation
- Cleaner organization
- Easier migrations

### Migrations

Located in `supabase/migrations/`:

```
0001_initial_schema.sql
0002_public_views.sql
...
0019_system_settings.sql
```

### Applying Migrations

```bash
# Check what would be applied (safe to run)
npx supabase db push --dry-run

# Push migrations to hosted database
npx supabase db push

# Push with seed data
npx supabase db push --include-seed
```

### Pulling Remote Changes

If schema was modified via Dashboard, capture as migration:

```bash
# Pull remote schema changes into a new migration file
npx supabase db pull
```

### Seeds

Located in `supabase/seeds/`:

| File                               | Purpose              |
| ---------------------------------- | -------------------- |
| `seed_curriculum.sql`              | Curriculum structure |
| `seed_concepts.sql`                | Concept content      |
| `seed_curriculum_dependencies.sql` | Prerequisites        |

Seeds are regenerated from source files in `content/raw/`.

## Authentication

### Magic-Link Flow

1. User enters email
2. Backend calls `supabase.auth.signInWithOtp()`
3. Supabase sends email with login link
4. User clicks → redirected to callback URL
5. Callback exchanges code for session

### Configuration

In Supabase dashboard under Authentication > Settings:

| Setting          | Value                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------- |
| Site URL         | `https://mrolandas.github.io/Moxlai`                                                      |
| Redirect URLs    | `http://localhost:5173/auth/callback`, `https://mrolandas.github.io/Moxlai/auth/callback` |
| Email OTP Expiry | 1 hour                                                                                        |

### Email Templates

Customize in Authentication > Email Templates:

- Confirm signup
- Magic Link
- Reset Password

### User Roles

Roles are stored in `profiles.role`:

- `learner` (default)
- `admin`
- `contributor` (future)

Set via admin API or direct database update:

```sql
UPDATE burburiuok.profiles
SET role = 'admin'
WHERE email = 'user@example.com';
```

## Storage

### Bucket Configuration

| Bucket        | Access  | Purpose              |
| ------------- | ------- | -------------------- |
| `media-admin` | Private | Admin-uploaded media |

### RLS Policies

Media bucket uses Row Level Security:

```sql
-- Admin can upload
CREATE POLICY "Admins can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media-admin' AND
  (SELECT role FROM burburiuok.profiles WHERE id = auth.uid()) = 'admin'
);

-- Public can read
CREATE POLICY "Public can read media"
ON storage.objects FOR SELECT
USING (bucket_id = 'media-admin');
```

### Signed URLs

For private files, generate signed URLs:

```typescript
const { data } = await supabase.storage
  .from("media-admin")
  .createSignedUrl(path, 3600); // 1 hour expiry
```

## Row Level Security (RLS)

All tables have RLS enabled. Key policies:

### Concepts

```sql
-- Public read for published
CREATE POLICY "Public can read published concepts"
ON burburiuok.concepts FOR SELECT
USING ((metadata->>'status') = 'published');

-- Service role for write
CREATE POLICY "Service role full access"
ON burburiuok.concepts
FOR ALL
TO service_role
USING (true);
```

### Progress

```sql
-- Users can manage their own progress
CREATE POLICY "Users manage own progress"
ON burburiuok.concept_progress
FOR ALL
USING (
  device_key = current_setting('request.headers')::json->>'x-device-key'
  OR profile_id = auth.uid()
);
```

## API Keys

### Anon Key

- Public, safe to expose in frontend
- Subject to RLS policies
- Used for: Public reads, auth flows

### Service Role Key

- **Secret**, never expose in frontend
- Bypasses RLS
- Used for: Backend admin operations

## Environment Variables

### Frontend

```bash
VITE_SUPABASE_URL="https://xxx.supabase.co"
VITE_SUPABASE_ANON_KEY="sb_publishable_xxx"
```

### Backend

```bash
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_ANON_KEY="sb_publishable_xxx"
SUPABASE_SERVICE_ROLE_KEY="sb_secret_xxx"
```

## Supabase CLI

### Installation

```bash
npm install -g supabase
```

### Common Commands

```bash
# Login (first time)
supabase login

# Link to project
supabase link --project-ref zvlziltltbalebqpmuqs

# Push migrations to hosted database
supabase db push

# Push with seed data
supabase db push --include-seed

# Pull remote schema
supabase db pull

# Generate types
supabase gen types typescript --linked > data/types-generated.ts
```

> **Note**: We do not use local Supabase. All commands target the hosted instance.

## Troubleshooting

### Connection Refused

**Check**:

1. Supabase project is active (not paused)
2. Credentials are correct
3. Network allows connection

### RLS Blocking Queries

**Symptom**: Empty results or permission denied

**Debug**:

```sql
-- Check as specific role
SET ROLE authenticated;
SELECT * FROM burburiuok.concepts LIMIT 1;
```

### Auth Email Not Received

**Check**:

1. Email not in spam
2. SMTP configured (for custom domain)
3. Rate limits not exceeded

### Storage Upload Fails

**Check**:

1. Bucket exists
2. RLS policy allows upload
3. File size within limits (50MB default)

## Database Backups

### Automatic

Supabase provides daily backups on paid plans.

### Manual Export

```bash
# Using pg_dump
pg_dump -h db.xxx.supabase.co -U postgres -d postgres \
  --schema=burburiuok > backup.sql
```

### Point-in-Time Recovery

Available on Pro plan. Restore from dashboard.

---

## Maintenance

- **Last verified**: 2025-12-10
- **Related code**: `data/supabaseClient.ts`, `supabase/migrations/`
- **Update when**: Schema changes, auth config changes, new buckets
- **Related docs**: [Database Schema](../architecture/DATABASE_SCHEMA.md), [Local Development](LOCAL_DEVELOPMENT.md)
