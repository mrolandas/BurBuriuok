# Data Module

Shared data-access layer that encapsulates Supabase connectivity and exposes repositories to both frontend and backend code.

## Responsibilities

- Supabase client factory (`supabaseClient.ts`) using environment variables.
- Repository modules (`conceptsRepository.ts`, `progressRepository.ts`, etc.) with CRUD helpers.
- Shared TypeScript types/interfaces (`types.ts`) for concepts, progress records, notes, media assets.
- Utility functions for caching, batching, and error translation.
- Temporary `shims.d.ts` provides type stubs until the full TypeScript toolchain (`@supabase/supabase-js`, `@types/node`) is configured.

## Development Notes

- Keep repository functions pure and side-effect free; let callers control context (e.g., auth tokens).
- Handle Supabase errors centrally and expose domain-specific error objects.
- Provide mock/stub implementations to aid testing without hitting the real database.
- Document expected environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) for each usage scenario.

## Planned Commands

- `npm run lint:data` – lint data layer files.
- `npm run test:data` – run unit tests for repositories with mocked Supabase client.

_Document additional repositories, helper utilities, and commands as they are implemented._
