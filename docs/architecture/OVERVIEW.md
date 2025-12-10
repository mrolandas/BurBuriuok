# Architecture Overview

This document describes the high-level system architecture of the Moxlai platform.

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USERS                                    │
│    Learners (mobile-first)         Admins (desktop-first)       │
└──────────────────┬──────────────────────────┬───────────────────┘
                   │                          │
                   ▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (SvelteKit)                          │
│                    GitHub Pages (Static)                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │ Learner UI   │ │ Admin UI     │ │ AI Chat Interface        │ │
│  │ - Curriculum │ │ - Concepts   │ │ - Natural language       │ │
│  │ - Concepts   │ │ - Media      │ │ - Tool execution         │ │
│  │ - Progress   │ │ - Users      │ │ - Plan confirmation      │ │
│  │ - Search     │ │ - Settings   │ │                          │ │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Express.js)                          │
│                    Render.com                                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │ Public API   │ │ Admin API    │ │ AI Agent Service         │ │
│  │ - Curriculum │ │ - CRUD ops   │ │ - Gemini integration     │ │
│  │ - Concepts   │ │ - Media      │ │ - Tool orchestration     │ │
│  │ - Progress   │ │ - Users      │ │ - Guardrails             │ │
│  │ - Auth       │ │              │ │                          │ │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘ │
│                          │                                       │
│  ┌───────────────────────┴─────────────────────────────────────┐│
│  │ Middleware: Auth, Rate Limiting, Error Handling             ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │ Repositories │ │ Supabase     │ │ Supabase Storage         │ │
│  │ (TypeScript) │ │ (PostgreSQL) │ │ (media-admin bucket)     │ │
│  │              │ │              │ │                          │ │
│  │ Shared by    │ │ - Tables     │ │ - Images                 │ │
│  │ frontend &   │ │ - Views      │ │ - Videos                 │ │
│  │ backend      │ │ - RLS        │ │ - PDFs                   │ │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │ Supabase     │ │ Google       │ │ Email (SMTP)             │ │
│  │ Auth         │ │ Gemini AI    │ │ (via Supabase)           │ │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### Frontend (SvelteKit)

**Technology**: SvelteKit 2 with Svelte 5, TypeScript, adapter-static

**Responsibilities**:

- Render curriculum and concept pages
- Handle user interactions
- Manage local state (themes, admin mode)
- Communicate with backend API
- Progressive enhancement for mobile

**Key Directories**:

```
frontend/src/
├── routes/           # Page components
│   ├── admin/        # Admin-only pages
│   ├── auth/         # Login/callback
│   ├── concepts/     # Concept detail
│   ├── sections/     # Curriculum tree
│   └── search/       # Global search
├── lib/
│   ├── components/   # Reusable UI
│   ├── stores/       # Svelte stores
│   ├── api/          # API client helpers
│   ├── config/       # Runtime config
│   └── supabase/     # Supabase client
└── app.html          # HTML template
```

**Build Output**: Static files deployed to GitHub Pages with SPA fallback (`404.html`).

### Backend (Express.js)

**Technology**: Express.js with TypeScript, tsx for development

**Responsibilities**:

- Serve REST API endpoints
- Enforce authentication and authorization
- Proxy Supabase operations with service role
- Orchestrate AI agent tool execution
- Rate limiting and audit logging

**Key Directories**:

```
backend/src/
├── routes/           # Endpoint handlers
│   ├── admin/        # Admin CRUD operations
│   ├── agent.ts      # AI chat endpoint
│   ├── auth.ts       # Magic-link flow
│   └── ...           # Public endpoints
├── services/
│   ├── agentService.ts   # AI tool orchestration
│   ├── llmProvider.ts    # Gemini API wrapper
│   └── auditLogger.ts    # Content versioning
├── middleware/
│   ├── requireAdminRole.ts
│   ├── requireUserSession.ts
│   └── rateLimiter.ts
└── validation/       # Request schemas
```

### Data Layer

**Technology**: Supabase (PostgreSQL), TypeScript repositories

**Shared Repository Pattern**:

- Repositories in `data/repositories/` are imported by both frontend and backend
- Frontend uses Supabase client with anon key (RLS enforced)
- Backend uses Supabase client with service role key (bypasses RLS)

```
data/
├── repositories/
│   ├── conceptsRepository.ts
│   ├── curriculumRepository.ts
│   ├── progressRepository.ts
│   ├── mediaRepository.ts
│   ├── profileRepository.ts
│   └── settingsRepository.ts
├── supabaseClient.ts    # Client factory
└── types.ts             # Shared type definitions
```

### External Services

| Service              | Purpose                   | Configuration          |
| -------------------- | ------------------------- | ---------------------- |
| **Supabase Auth**    | Magic-link authentication | Project settings       |
| **Google Gemini**    | AI curriculum generation  | `GOOGLE_AI_STUDIO_KEY` |
| **Supabase Storage** | Media file storage        | `media-admin` bucket   |

## Data Flow Examples

### Learner Viewing a Concept

```
1. User navigates to /concepts/[slug]
2. SvelteKit load function calls conceptsRepository
3. Repository queries Supabase with anon key
4. RLS allows read access to published concepts
5. Page renders concept detail
6. User marks as learned → progress API → backend → Supabase
```

### Admin Creating Concepts via AI

```
1. Admin opens /admin/agent
2. Types "Create 5 concepts about wind for LBS-2"
3. Frontend POSTs to /api/v1/agent/chat
4. Backend validates admin JWT
5. agentService sends prompt to Gemini
6. Gemini returns tool calls (batch_create_concepts)
7. Frontend shows plan for confirmation
8. Admin confirms → tools execute → concepts created
9. Final response shown in chat
```

## Security Model

### Authentication

- **Magic-link**: Email-based, no passwords
- **JWT tokens**: Supabase-issued, contain role claims
- **Device keys**: Legacy anonymous tracking (being deprecated)

### Authorization

| Role    | Access                                |
| ------- | ------------------------------------- |
| Guest   | Read curriculum, concepts, search     |
| Learner | + Progress tracking                   |
| Admin   | + All CRUD, AI agent, user management |

### API Protection

- **Rate limiting**: Per-endpoint limits (see [API Reference](reference/API_ENDPOINTS.md))
- **CORS**: `BACKEND_ALLOWED_ORIGINS` whitelist
- **RLS**: Row-level security on all tables

## Design Principles

1. **Lithuanian-first**: User-facing content in Lithuanian
2. **Mobile-native**: Learner experience optimized for phones
3. **AI-assisted**: Natural language for admin operations
4. **Audit trail**: All content changes versioned
5. **Static frontend**: No server-side rendering needed
6. **Shared code**: Repositories and types reused across stack

---

## Maintenance

- **Last verified**: 2025-12-10
- **Related code**: All directories mentioned above
- **Update when**: Architecture changes, new services added
- **Related docs**: [Database Schema](DATABASE_SCHEMA.md), [API Reference](../reference/API_ENDPOINTS.md)
