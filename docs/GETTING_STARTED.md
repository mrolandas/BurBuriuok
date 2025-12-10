# Getting Started

This guide covers local development setup for the Moxlai platform.

## Prerequisites

- **Node.js** 20+ (LTS recommended)
- **npm** 10+
- **Git**
- **Supabase CLI** (optional, for local database)

## Quick Start

```bash
# Clone repository
git clone https://github.com/mrolandas/BurBuriuok.git
cd BurBuriuok

# Install dependencies
npm install
cd frontend && npm install && cd ..

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development servers
./scripts/start_stack.sh
```

This starts:

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:4000

## Environment Variables

Create a `.env` file in the project root:

```bash
# Supabase (required)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Authentication
AUTH_REDIRECT_URL="http://localhost:5173/auth/callback"
AUTH_EMAIL_FROM="Moxlai <noreply@yourdomain.com>"

# Frontend (Vite)
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"

# AI Agent (optional)
GOOGLE_AI_STUDIO_KEY="your-gemini-api-key"

# Backend CORS (production only)
BACKEND_ALLOWED_ORIGINS="https://mrolandas.github.io,https://mrolandas.github.io/BurBuriuok"
```

## Development Scripts

### Start/Stop

```bash
# Start all services
./scripts/start_stack.sh

# Stop all services
./scripts/stop_stack.sh

# Or run individually:
npm run backend:dev    # Backend with hot reload
npm run frontend:dev   # Frontend dev server
```

### Content & Seeds

```bash
# Validate content sources match seeds
npm run content:seed:check

# Regenerate seed files from source
npm run content:seed:generate
npm run content:seed:curriculum
npm run content:seed:dependencies

# Validate markdown content
npm run content:markdown:validate

# Export curriculum snapshot
npm run content:snapshot:refresh
```

### Type Checking

```bash
npm run backend:typecheck    # Backend TypeScript
npm run frontend:check       # Frontend Svelte/TS
npm run frontend:lint        # ESLint
```

### Testing

```bash
npm run test:supabase        # Connection test
npm run test:db002           # Content versioning
npm run test:media001        # Media assets
npm run test:media002        # Media API
npm run test:frontend        # Frontend unit tests
```

## Database Setup

### Using Hosted Supabase (Recommended)

1. Create a project at [supabase.com](https://supabase.com)
2. Copy the URL and keys to `.env`
3. Link and push migrations:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --include-seed
```

### Using Local Supabase

```bash
npx supabase start
npx supabase db push --local --include-seed
```

Local credentials will be displayed after `supabase start`.

## Project Structure

```
BurBuriuok/
├── backend/src/           # Express API
│   ├── routes/            # Endpoint handlers
│   ├── services/          # Business logic
│   ├── middleware/        # Auth, rate limiting
│   └── validation/        # Request validation
├── frontend/src/          # SvelteKit app
│   ├── routes/            # Pages
│   └── lib/               # Components, stores
├── data/                  # Shared data layer
│   ├── repositories/      # Database queries
│   └── types.ts           # Shared types
├── shared/validation/     # Zod schemas
├── supabase/
│   ├── migrations/        # SQL migrations
│   └── seeds/             # Seed data
├── content/
│   ├── raw/               # Source JSON
│   └── scripts/           # Build scripts
├── scripts/               # Dev utilities
└── docs/                  # Documentation
```

## Common Tasks

### Adding a Migration

```bash
# Create migration file
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_description.sql

# Edit the file, then push
npx supabase db push
```

### Generating Admin Token (Local Testing)

```bash
npx ts-node scripts/generate_admin_token.ts
```

### Seeding Content

```bash
npx ts-node scripts/seed_lbs_content.ts
```

## Troubleshooting

### "Missing Supabase credentials"

Ensure `.env` has both `SUPABASE_URL` and `SUPABASE_ANON_KEY` (and `VITE_*` versions for frontend).

### Backend 500 errors

Check that `SUPABASE_SERVICE_ROLE_KEY` is set correctly. The service role key is required for admin operations.

### Frontend API calls fail

In development, the Vite proxy handles `/api` requests. Ensure backend is running on port 4000.

### AI Agent not working

Set `GOOGLE_AI_STUDIO_KEY` in `.env`. The AI features require a valid Gemini API key.

---

## Maintenance

- **Last verified**: 2025-12-10
- **Related code**: `package.json`, `scripts/start_stack.sh`, `.env.example`
- **Update when**: Dependencies change, new env vars added, or setup process changes
- **Related docs**: [Architecture Overview](architecture/OVERVIEW.md), [Deployment](deployment/)
