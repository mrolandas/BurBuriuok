# BurBuriuok

BurBuriuok is a Lithuanian-first learning companion that helps novice skippers prepare for the Lithuanian Sailing Association curriculum. The product UI and learner-facing copy stay in Lithuanian, while code, internal documentation, and developer conversations remain in English.

## Overview

BurBuriuok guides learners through the "Lietuvos Buriavimo Asociacijos vidaus vandenų burinės jachtos vado mokymo programa (20241015d_redakcija_241024_112644-1)". The canonical list of required concepts lives in `docs/static_info/LBS_programa.md`. The product concentrates on the theoretical exam and offers practical checklists to support on-water preparation.

## Goals

- Help learners build fluency with every concept required by the national curriculum.
- Provide quick knowledge checks to reinforce progress.
- Stay mobile-first: ~70% phone, 20% tablet, 10% desktop usage assumptions drive design decisions.
- Offer note-taking hooks (hashtags, mentions, or similar affordances) that let learners map class notes back to curriculum sections and individual concepts.

## Release Roadmap

- **Version 1:** Supabase stores core content and learner progress. No authentication or media uploads. The static build continues to deploy via GitHub Pages.
- **Version 2:** Add Supabase authentication and wire the assistant workflow to either Ollama or other publicly accessible models for concept Q&A.
- **Post-V2:** Introduce concept media uploads (up to four illustrations per concept), community sharing, and curator workflows for highlighting the best visuals.

## Language Policy

- Learners study in Lithuanian, but we expose English terminology alongside the Lithuanian copy to support bilingual exam prep.
- Code, commit messages, and documentation stay in English. Only the user interface persists in Lithuanian.

## Architecture Guidelines

- SvelteKit frontend with component-driven, accessible UI tailored for small screens first.
- Modular Express backend that keeps boundaries clean and prepares for REST/JSON integrations with future clients.
- Supabase data layer: Version 1 stores concept catalog and progress metrics; the schema already accounts for future feature growth.
- Media management: No uploads in V1; V2 plans to rely on Supabase Storage with reusable governance controls (per-user quotas, moderation review).
- Shared styles live in `styles/` with a preference toward modular CSS organization.
- All non-README documentation belongs in `docs/` for fast discovery of product, infrastructure, and process materials.

## Prototype Reference

- The `first_draft/` directory contains the initial HTML/JS/CSS prototype for the first curriculum section. Use it as a UX and content reference; the production implementation is component-based and designed for long-term maintainability.

## Documentation

- Start with `docs/README.md` for navigation across planning notes, infrastructure runbooks, and reference guides.
- The static curriculum export is always available in `docs/static_info/LBS_programa.md`.

## Version Control and Releases

- Git powers version control with `main` as the default branch.
- Major efforts land via feature branches or annotated tags capturing release snapshots.
- Releases deploy from GitHub, with Supabase migrations tracked alongside application code.

## Deployment

- The `deploy/github-pages` branch (and `main`) trigger the Pages deployment workflow in `.github/workflows/deploy-frontend-gh-pages.yml`; every push to `main` automatically rebuilds and publishes the static frontend.
- The workflow expects `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` repository secrets so the Supabase client works in production, installs root + frontend dependencies so shared validation schemas bundled from `shared/` resolve correctly, and builds with `VITE_ENABLE_ADMIN_IMPERSONATION=enabled` so the admin toggle stays available on the published site.
- Override the base path with `VITE_APP_BASE_PATH` when testing locally; the default (`/BurBuriuok`) matches the GitHub Pages project URL.
- Trigger a deployment by pushing to `main`, pushing to `deploy/github-pages`, or launching the workflow manually from the Actions tab.
