# Content Module

Holds curriculum source material, transformations, and seed scripts used to populate Supabase.

## Responsibilities

- Raw data exports (CSV/JSON) extracted from official curriculum documents.
- Transformation scripts (TypeScript/Node) that normalise data and map to database schema.
- Seed scripts that push data into Supabase (`supabase db seed`).
- Version history/changelogs for content updates.

## Development Notes

- Treat content files as source of truth for Supabase seeds; avoid manual edits in the database.
- Include validation steps in transformation scripts (e.g., using zod schemas).
- Keep large datasets split by section to avoid merge conflicts.

## Planned Commands

- `npm run content:extract` – pull/refresh curriculum data from docs.
- `npm run content:transform` – convert raw data into normalised JSON.
- `npm run content:seed` – apply data to Supabase via seed script.

_Record new datasets and transformation pipelines here as they are introduced._
