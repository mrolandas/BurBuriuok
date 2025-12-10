# Moxlai

**Moxlai** is a dynamic curriculum creation and learning platform. Using AI-assisted tools, educators and administrators can build complete learning structures—curriculum hierarchies, study materials, and assessments—for any subject matter. Learners subscribe to subjects and track their progress through structured content and testing.

> **Note**: The project is transitioning from "burburiuok" to "moxlai". Some code references still use the old naming.

## Vision

A single platform where:

- **Admins/Managers** use AI to create and maintain comprehensive curricula from scratch or external sources
- **Learners** subscribe to subjects, study concepts, and validate knowledge through dynamic testing
- **Content** remains Lithuanian-first for learner-facing material, with English administration tools

## Current State

The platform is functional with:

- ✅ Multi-level curriculum structure (sections → subsections → concepts)
- ✅ AI-powered curriculum builder (admin chat interface)
- ✅ Learner progress tracking ("moku" concepts)
- ✅ Media library with image/video/PDF support
- ✅ Magic-link authentication
- ✅ Theme selection (Dawn/Marine/Sand)

**Proof-of-Concept Subject**: LBS (Laivo Buriuotojo Sertifikatas) - Lithuanian sailing theory curriculum with ~300 concepts.

## Architecture Overview

| Component | Technology              | Hosting           |
| --------- | ----------------------- | ----------------- |
| Frontend  | SvelteKit (static)      | GitHub Pages      |
| Backend   | Express.js (TypeScript) | Render.com        |
| Database  | PostgreSQL              | Supabase (hosted) |
| Storage   | Object Storage          | Supabase (hosted) |
| AI        | Google Gemini           | API               |

## Quick Links

| Document                                                   | Purpose                             |
| ---------------------------------------------------------- | ----------------------------------- |
| [Getting Started](GETTING_STARTED.md)                      | Local development setup             |
| [Roadmap](ROADMAP.md)                                      | Current priorities and future plans |
| [Architecture Overview](architecture/OVERVIEW.md)          | System design                       |
| [Database Schema](architecture/DATABASE_SCHEMA.md)         | Tables and relationships            |
| [API Reference](reference/API_ENDPOINTS.md)                | Backend endpoints                   |
| [AI Curriculum Builder](features/AI_CURRICULUM_BUILDER.md) | Agent tools and workflow            |

## Project Structure

```
moxlai/
├── backend/           # Express.js API
│   └── src/
│       ├── routes/    # API endpoints
│       ├── services/  # Business logic (AI agent, audit)
│       └── middleware/# Auth, rate limiting
├── frontend/          # SvelteKit app
│   └── src/
│       ├── routes/    # Pages and layouts
│       └── lib/       # Components, stores, utils
├── data/              # Shared data layer
│   └── repositories/  # Database access
├── shared/            # Shared validation schemas
├── supabase/          # Migrations and seeds
├── content/           # Content source files and scripts
├── scripts/           # Development utilities
└── docs/              # Documentation (you are here)
```

## URLs

| Environment | Frontend                                 | Backend                           |
| ----------- | ---------------------------------------- | --------------------------------- |
| Production  | `https://mrolandas.github.io/Moxlai` | `https://moxlai.onrender.com` |
| Local Dev   | `http://localhost:5173`                  | `http://localhost:4000`           |
| Future      | `moxlai.lt/<subject>`                    | TBD                               |

---

## Maintenance

- **Last verified**: 2025-12-10
- **Update when**: Project structure, hosting, or core features change
- **Related docs**: All docs link back here
