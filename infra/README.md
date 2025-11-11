# Infrastructure Module

Automation scripts, deployment workflows, and infrastructure-as-code assets for BurKursas.

## Responsibilities

- Supabase migrations (`supabase/migrations/`) and seed scripts references.
- Deployment tooling for frontend (GitHub Pages/Vercel) and backend (Railway/Fly.io/etc.).
- CI/CD configurations (GitHub Actions workflow files).
- Environment provisioning scripts and documentation (e.g., shell scripts, Terraform in future).
- Seed data lives under `supabase/seeds/` with SQL scripts (`seed_concepts.sql`) until automated loaders are in place.
- Run `node content/scripts/build_seed_sql.mjs` to rebuild seed SQL before applying migrations to Supabase.

## Development Notes

- Keep automation idempotent so dev/prod environments can be recreated consistently.
- Store secrets outside of version control; reference them via environment variables or GitHub secrets.
- Document every script with usage instructions and prerequisites.

## Planned Commands

- `npm run infra:deploy:frontend` – publish latest frontend build.
- `npm run infra:deploy:backend` – deploy Express service once hosting target is chosen.
- `npm run infra:migrate` – apply Supabase migrations.

_Update this README as soon as automation scripts land and specific hosting providers are selected._
