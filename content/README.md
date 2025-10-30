# Content Module

Holds curriculum source material, transformations, and seed scripts used to populate Supabase.

## Responsibilities

- Raw data exports (CSV/JSON) extracted from official curriculum documents.
- Transformation scripts (TypeScript/Node) that normalise data and map to database schema.
- Seed scripts that push data into Supabase (`supabase db seed`).
- Version history/changelogs for content updates.
- `raw/` directory contains source JSON (e.g., `section1_concepts.json`) generated from the legacy prototype.
- `scripts/` directory hosts helper tooling (e.g., `build_seed_sql.mjs`) to validate raw data and regenerate SQL seeds.

## Development Notes

- Treat content files as source of truth for Supabase seeds; avoid manual edits in the database.
- Include validation steps in transformation scripts (e.g., using zod schemas).
- Keep large datasets split by section to avoid merge conflicts.
- Run `node content/scripts/build_seed_sql.mjs` after updating raw data to regenerate `supabase/seeds/seed_concepts.sql`.

## Planned Commands

- `npm run content:extract` – pull/refresh curriculum data from docs.
- `npm run content:transform` – convert raw data into normalised JSON.
- `npm run content:seed` – apply data to Supabase via seed script.
- `node content/scripts/build_seed_sql.mjs` – regenerate seed SQL from `raw/` JSON (temporary command until npm script exists).

_Record new datasets and transformation pipelines here as they are introduced._
