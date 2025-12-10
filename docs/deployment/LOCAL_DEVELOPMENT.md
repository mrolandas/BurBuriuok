# Local Development

This document covers the local development environment setup and workflow.

## Prerequisites

| Tool         | Version | Purpose                   |
| ------------ | ------- | ------------------------- |
| Node.js      | 20+ LTS | Runtime                   |
| npm          | 10+     | Package management        |
| Git          | 2.x     | Version control           |
| Supabase CLI | Latest  | Local database (optional) |

## Initial Setup

```bash
# Clone repository
git clone https://github.com/mrolandas/BurBuriuok.git
cd BurBuriuok

# Install root dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Copy environment template
cp .env.example .env
```

## Environment Configuration

Edit `.env` with your credentials:

```bash
# Required: Supabase
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Required: Frontend Supabase
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"

# Required: Auth
AUTH_REDIRECT_URL="http://localhost:5173/auth/callback"
AUTH_EMAIL_FROM="Moxlai <noreply@example.com>"

# Optional: AI Agent
GOOGLE_AI_STUDIO_KEY="your-gemini-api-key"

# Optional: Development flags
VITE_ENABLE_ADMIN_IMPERSONATION="true"
```

## Starting the Stack

### Quick Start

```bash
./scripts/start_stack.sh
```

This script:

1. Checks for required environment variables
2. Starts backend on port 4000
3. Starts frontend on port 5173
4. Stores PIDs for clean shutdown

### Manual Start

```bash
# Terminal 1: Backend
npm run backend:dev

# Terminal 2: Frontend
npm run frontend:dev
```

### Stopping

```bash
./scripts/stop_stack.sh
```

## Development URLs

| Service         | URL                          | Purpose                               |
| --------------- | ---------------------------- | ------------------------------------- |
| Frontend        | http://localhost:5173        | Main application                      |
| Backend         | http://localhost:4000        | REST API                              |
| Backend Health  | http://localhost:4000/health | Health check                          |
| Supabase Studio | http://localhost:54323       | Local DB UI (if using local Supabase) |

## Project Scripts

### Backend

```bash
npm run backend:dev        # Start with hot reload (tsx watch)
npm run backend:start      # Single run
npm run backend:typecheck  # TypeScript validation
```

### Frontend

```bash
npm run frontend:dev       # Development server
npm run frontend:build     # Production build
npm run frontend:preview   # Preview production build
npm run frontend:check     # Svelte/TypeScript checks
npm run frontend:lint      # ESLint
npm run frontend:format    # Prettier
```

### Content

```bash
npm run content:seed:check       # Validate seeds match source
npm run content:seed:generate    # Rebuild concept seeds
npm run content:seed:curriculum  # Rebuild curriculum seeds
npm run content:seed:dependencies # Rebuild dependency seeds
npm run content:markdown:validate # Validate markdown content
npm run content:snapshot:refresh # Export curriculum CSV
```

### Testing

```bash
npm run test:supabase    # Connection test
npm run test:db002       # Content versioning
npm run test:media001    # Media assets
npm run test:media002    # Media API
npm run test:frontend    # Frontend unit tests
```

## Database Options

### Hosted Supabase (Recommended)

Use your Supabase project directly:

```bash
# Link to project
npx supabase link --project-ref YOUR_PROJECT_REF

# Push migrations and seeds
npx supabase db push --include-seed
```

### Local Supabase

Run Supabase locally with Docker:

```bash
# Start local Supabase
npx supabase start

# Push migrations locally
npx supabase db push --local --include-seed

# Stop when done
npx supabase stop
```

Local URLs:

- Studio: http://localhost:54323
- API: http://localhost:54321
- Auth: http://localhost:54321/auth/v1

## Working with Migrations

### Creating a Migration

```bash
# Create new migration file
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_description.sql

# Edit the SQL file
code supabase/migrations/NNNN_description.sql

# Push to database
npx supabase db push
```

### Migration Naming

Format: `NNNN_description.sql`

Examples:

- `0001_initial_schema.sql`
- `0019_system_settings.sql`
- `0020_add_subjects_table.sql`

### Resetting Database

```bash
# Local only - resets and reseeds
npx supabase db reset --local
```

## Admin Testing

### Generating Admin Token

For testing admin endpoints without a full auth flow:

```bash
npx ts-node scripts/generate_admin_token.ts
```

This outputs a JWT you can use in requests:

```bash
curl -H "Authorization: Bearer <token>" \
     http://localhost:4000/api/v1/admin/concepts
```

### Admin Impersonation

Enable in `.env`:

```bash
VITE_ENABLE_ADMIN_IMPERSONATION="true"
```

Then add `?impersonate=admin` to any URL to access admin features without logging in.

## Hot Reload

### Backend

The `tsx watch` command provides hot reload for TypeScript changes:

- Watches all `.ts` files in `backend/src/`
- Restarts server on changes
- Preserves terminal output

### Frontend

SvelteKit's dev server provides:

- Hot Module Replacement (HMR)
- Instant style updates
- Fast refresh for components

## Debugging

### Backend Debugging

Add to VS Code `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["tsx", "backend/src/server.ts"],
      "env": { "NODE_ENV": "development" },
      "console": "integratedTerminal"
    }
  ]
}
```

### Frontend Debugging

Use browser DevTools with:

- Svelte DevTools extension
- Source maps (enabled by default)

## Common Issues

### Port Already in Use

```bash
# Find process on port
lsof -i :4000

# Kill process
kill -9 <PID>
```

### Missing Dependencies

```bash
# Reinstall all
rm -rf node_modules frontend/node_modules
npm install
cd frontend && npm install
```

### Supabase Connection Failed

1. Check `.env` has correct credentials
2. Verify project is running (if local)
3. Check network/firewall settings

### TypeScript Errors

```bash
# Check both projects
npm run backend:typecheck
npm run frontend:check
```

---

## Maintenance

- **Last verified**: 2025-12-10
- **Related code**: `package.json`, `scripts/`, `.env.example`
- **Update when**: Development workflow changes, new scripts added
- **Related docs**: [Getting Started](../GETTING_STARTED.md)
