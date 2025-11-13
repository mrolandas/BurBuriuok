# Backend Overview

This document captures how the Express-based admin and learner API is structured, how it interacts with Supabase, and which environment flags keep local development predictable. Update it whenever new routes or middleware land so the frontend and documentation stay aligned.

## Service Layout

- `backend/src/server.ts` starts the Express app and reads the `BACKEND_PORT` (falls back to `PORT` or `4000`).
- `backend/src/app.ts` wires middlewares (CORS, JSON parsing) and mounts versioned routes under `/api/v1`.
- `backend/src/routes/` contains feature routers. Admin-specific code now lives under `backend/src/routes/admin/` with one file per resource (for example `concepts.ts`).
- Shared infrastructure sits in `backend/src/middleware/` (authentication guards), `backend/src/services/` (audit logging), and `backend/src/utils/` (async handler wrapper, telemetry helpers).
- Repositories and Supabase access layers stay inside `data/` so they can be reused by backend services, CLI scripts, or future workers.

```
backend/
  src/
    routes/
      admin.ts            # mounts admin sub-routers
      admin/
        concepts.ts       # concept CRUD endpoints for ADM-002
    middleware/
      requireAdminRole.ts # Supabase JWT guard for admin endpoints
    services/
      auditLogger.ts      # writes to content_versions tables
```

## Authentication & Authorization

- Learner endpoints continue to accept anonymous requests or Supabase JWTs (see `docs/references/API_CONTRACTS.md`).
- Admin routes are protected server-side via `requireAdminRole`. The middleware extracts the bearer token, revalidates it with the Supabase service client, and rejects calls when `app_role` is not `admin`.
- Successful checks attach the minimal identity (`req.authUser`) so downstream handlers can record the actor in audit logs.

## Admin Concept Endpoints

Mounted under `/api/v1/admin/concepts`:

| Method | Path     | Description                                                                                  |
| ------ | -------- | -------------------------------------------------------------------------------------------- |
| GET    | `/`      | Returns the list of concepts (optionally filtered by `sectionCode` and `status`).            |
| GET    | `/:slug` | Loads a single concept for editing. Returns a 404 when the slug has no matching record.      |
| POST   | `/`      | Creates or updates a concept. Body must satisfy the shared admin concept schema (see below). |

- Responses follow the standard `{ data, meta }` envelope with camelCase keys.
- Status filtering is inferred from concept metadata (`metadata.status`). When the field is missing the API reports `draft`.
- `POST /admin/concepts` uses an UPSERT against Supabase (`concepts` table) and refreshes the record for the response, ensuring timestamps reflect the database state. Inline concept editing in the learner shell now calls this same endpoint when the global admin mode toggle is enabled, so keep payload and response formats stable.

## Shared Validation

- The admin surface reuses a Zod schema defined in `shared/validation/adminConceptSchema.ts`. Both the backend and frontend import this module, keeping validation, labels, and status alignment in sync.
- The schema normalises optional text fields (`termEn`, `descriptionEn`, subsection titles) to `null` and constrains slug format to lowercase kebab-case (`^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?$`).
- When validation fails on the server, the endpoint returns HTTP 400 with the flattened Zod error payload (`{ error: { message, details } }`).

## Audit Logging & Draft Reconciliation

- `POST /admin/concepts` calls `logContentMutation` with `entityType: "concept"`. The helper calculates diffs between the previous and updated payload and persists them to `content_versions` plus `content_version_changes`.
- Audit rows store the acting email (preferred) or Supabase UID, the requested `status`, and a summary (`created via admin console` vs `updated via admin console`).
- Draft saves (`status: draft` or `in_review`) now upsert a working copy in `burburiuok.content_drafts`, linking the newly inserted version via `version_id`. Publish/archived states remove the draft row so only pending edits linger in the table.
- Empty snapshots are skipped to avoid polluting history with no-op saves; ensure callers pass the fully hydrated admin payload whenever a visible change occurs.
- Reuse the same helper when additional admin endpoints go live so version history remains consistent.

### Regression Checks

- Run `npm run test:db002` after touching audit logging, Supabase RLS policies, or migrations. The script spins up a disposable concept, exercises draft→publish flows through the backend service, checks `content_drafts` cleanup, and validates `content_versions.snapshot` persistence using service-role credentials.

## Admin Curriculum Node Endpoints

Mounted under `/api/v1/admin/curriculum/nodes`:

| Method | Path     | Description                                                                 |
| ------ | -------- | --------------------------------------------------------------------------- |
| POST   | `/`      | Creates a curriculum node (section/subsection) with optional parent/ordinal |
| PATCH  | `/:code` | Updates node title, summary, parent, or ordinal and records audit metadata. |
| DELETE | `/:code` | Marks the node as archived (payload matches the returned `node` snapshot).  |

- Responses reuse the `{ data: { node } }` envelope consumed by the frontend section board and tree editor.
- Inline section editing on the learner homepage calls `PATCH /admin/curriculum/nodes/:code` with trimmed title/summary payloads; payload validation mirrors the backend schema guard that enforces non-empty titles and optional summaries.
- New nodes immediately surface through `listCurriculumNodes` so the admin tree and section board stay in sync after create or delete operations.

## Environment Flags

- Backend requires `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. These values already live in the repo root `.env` for local development.
- The frontend admin console calls the backend through `/api/admin` by default. Override the base path with `VITE_ADMIN_API_BASE` when the Express API runs on a different host/port (required for GitHub Pages, where the static site would otherwise POST to the pages origin and receive 404/405 HTML responses).
- Set `VITE_ENABLE_ADMIN_IMPERSONATION=true` only during local development to unlock the `?impersonate=admin` preview mode.

## Local Development Workflow

1. Start the backend in watch mode: `npm run backend:dev` (hot reload via `tsx`).
2. Start the frontend: `npm run frontend:dev`. The Vite dev server now has file-system access to `shared/validation/` so it can reuse admin schemas without duplication.
3. Ensure you are signed into Supabase in the browser (or use the impersonation flag above) before navigating to `/admin/concepts`.
4. Save a concept and verify the audit log: check Supabase `content_versions` or run a quick SQL query to confirm `status`, `diff`, and `changes` entries were generated.

> When adding new admin resources, create a matching shared schema (if needed), mount the router under `backend/src/routes/admin/`, update `docs/references/API_CONTRACTS.md`, and document the workflow here.

## Render Deployment

- Service URL: `https://burburiuok.onrender.com` (admin API surface lives under `/api/v1/*`).
- Render injects a `PORT` environment variable; do not override it. The service start command is `npm run backend:start` and relies on `tsx` to launch `backend/src/server.ts`.
- Required environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, and `BACKEND_ALLOWED_ORIGINS` (include both `https://mrolandas.github.io` and `https://mrolandas.github.io/BurBuriuok`).
- GitHub Pages consumers must set `VITE_ADMIN_API_BASE` (Actions secret) or provide the value via `env.js` so hosted admin requests target the Render endpoint instead of the Pages origin. The static `env.js` now assigns the Render URL automatically when the app runs on `github.io`.
