# Content Module

Holds curriculum source material, transformations, and seed scripts used to populate Supabase.

## Responsibilities

- Raw data exports (CSV/JSON) extracted from official curriculum documents.
- Transformation scripts (TypeScript/Node) that normalise data and map to database schema.
- Seed scripts that push data into Supabase (`supabase db seed`).
- Version history/changelogs for content updates.
- `raw/` directory contains structured JSON exports (e.g., `section_1_1_korpus_ir_burlaiviu_tipai_concepts.json`) generated from the legacy prototype.
- `scripts/` directory hosts helper tooling (e.g., `build_seed_sql.mjs`) to validate raw data and regenerate SQL seeds.

## Development Notes

- Treat content files as source of truth for Supabase seeds; avoid manual edits in the database.
- Include validation steps in transformation scripts (e.g., using zod schemas).
- Keep large datasets split by section to avoid merge conflicts.
- Run `node content/scripts/extract_prototype_content.mjs` to re-extract concepts from `first_draft/index.html` into JSON files under `content/raw/`.
- Run `node content/scripts/build_seed_sql.mjs` (or `npm run content:seed:generate`) after updating raw data to regenerate `supabase/seeds/seed_concepts.sql`. The script now auto flags which concepts are part of the official LBS curriculum via the `is_required` column so we can highlight mandatory terms in product UI.

## Curriculum Alignment

- `docs/static_info/LBS_programa.md` is treated as the canonical list of required curriculum items.
- Seed generation enriches each concept with an `is_required` flag by fuzzy matching term names against the curriculum document; anything not matched is considered optional enrichment.
- When adding new prototype content, keep a similar required/optional ratio so learners receive the full mandated scope plus helpful extras.
- If the curriculum reference ever changes, rerun the seed generator so the required flags stay in sync.

## Planned Commands

- `npm run content:extract` – pull/refresh curriculum data from docs.
- `npm run content:transform` – convert raw data into normalised JSON.
- `npm run content:seed` – apply data to Supabase via seed script.
- `node content/scripts/build_seed_sql.mjs` – regenerate seed SQL from `raw/` JSON (temporary command until npm script exists).

_Record new datasets and transformation pipelines here as they are introduced._
