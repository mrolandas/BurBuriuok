# Backend Module

Express-based API layer responsible for mediating access to Supabase and providing future functionality (auth, notes, media moderation, AI integrations).

## Responsibilities

- HTTP server bootstrap (`src/server.ts`).
- Route handlers grouped by feature under `src/routes/` (e.g., `concepts`, `progress`, `notes`, `media`).
- Service layer under `src/services/` containing business logic and calls into `data/` repositories.
- Validation schemas (zod) in `src/validation/` to guard request/response payloads.
- Shared middleware for logging, error handling, and security at `src/middleware/`.

## Current Endpoints

| Method | Path                       | Description                                            |
| ------ | -------------------------- | ------------------------------------------------------ |
| GET    | `/health`                  | Returns service liveness payload.                      |
| GET    | `/api/v1/curriculum`       | Lists curriculum nodes/items with optional depth cap.  |
| GET    | `/api/v1/curriculum/:code` | Returns a node, its children, items, and dependencies. |
| GET    | `/api/v1/concepts`         | Lists concepts filtered by section/node/required flag. |
| GET    | `/api/v1/concepts/:slug`   | Retrieves a single concept by slug.                    |
| GET    | `/api/v1/dependencies`     | Lists curriculum dependencies with filters.            |

## Development Notes

- Export typed interfaces for each route to keep the frontend and tests aligned.
- Keep controllers thin; push logic into services for easier testing.
- Add integration tests (Vitest/Jest) under `tests/` as routes are implemented.
- Supabase credentials are read from `.env` (see `data/supabaseClient.ts`).

## Commands

- `npm run backend:dev` – start the Express server with hot reload via `tsx`.
- `npm run backend:start` – run the server once (no watch mode).
- `npm run backend:typecheck` – run TypeScript checks for the backend module.
- `npm run test:backend` – _(reserved)_ add route/service tests as they land.
