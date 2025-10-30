# Backend Module

Express-based API layer responsible for mediating access to Supabase and providing future functionality (auth, notes, media moderation, AI integrations).

## Responsibilities

- HTTP server bootstrap (`src/server.ts`).
- Route handlers grouped by feature under `src/routes/` (e.g., `concepts`, `progress`, `notes`, `media`).
- Service layer under `src/services/` containing business logic and calls into `data/` repositories.
- Validation schemas (zod) in `src/validation/` to guard request/response payloads.
- Shared middleware for logging, error handling, and security at `src/middleware/`.

## Development Notes

- Export typed interfaces for each route to keep the frontend and tests aligned.
- Keep controllers thin; push logic into services for easier testing.
- Add integration tests (Vitest/Jest) under `tests/` as routes are implemented.

## Planned Commands

- `npm run dev:backend` – start Express server with hot reload.
- `npm run build:backend` – compile TypeScript to JavaScript for deployment.
- `npm run test:backend` – run backend unit/integration tests.

_Update this README when the backend scaffold exists and commands are wired up._
