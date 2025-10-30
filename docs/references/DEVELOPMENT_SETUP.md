# Development Setup

This document keeps the development environment expectations in one place. Update it whenever tooling changes so human contributors and AI assistants stay in sync. For Supabase-specific details, see `docs/references/SUPABASE.md`.

## Repository Layout (Scaffold)

- `frontend/` – SvelteKit app (routes, components, stores, styles).
- `backend/` – Express API service (controllers, services, validation, middlewares).
- `data/` – Supabase client wrapper, repositories, shared data contracts.
- `content/` – Curriculum seed data, CSV/JSON imports, transformation scripts.
- `infra/` – Deployment scripts, Supabase migrations, automation tooling.
- `docs/` – Project documentation (this folder).
- `first_draft/` – Legacy prototype kept for reference.

## System Requirements

- Linux, macOS, or WSL2 on Windows.
- Node.js 20 LTS (use `nvm` or `asdf` to manage versions).
- npm 10+ (bundled with Node 20).
- Git 2.40+.
- Supabase CLI (install once backend storage and image uploads are introduced in V2).

## Core Dependencies (install once project tooling is initialised)

- `@supabase/supabase-js`
- `@types/node`
- `typescript`
- `ts-node` or build tooling of choice for running scripts

## Project Bootstrap

1. Clone the repository: `git clone https://github.com/mrolandas/BurBuriuok.git`.
2. Switch into the project directory: `cd BurBuriuok`.
3. Copy `.env.example` (when available) to `.env` and update Supabase credentials if needed. Current local keys live in `.env` (not versioned).
4. Install dependencies (placeholder until the SvelteKit/Express scaffold lands): `npm install`.
5. Start the development servers (to be defined once the scaffold is ready). Expected commands:
   - `npm run dev:frontend` – launch SvelteKit in development mode.
   - `npm run dev:backend` – launch the Express API locally.
   - `npm run dev` – run both via a concurrent script.

> Update the command list as soon as the actual scripts exist in `package.json`.

## Coding Standards

- TypeScript preferred for new application code (frontend and backend).
- ESLint + Prettier baseline (rules TBD).
- Keep UI strings in Lithuanian; internal identifiers and comments in English.

## Helpful Utilities

- `npm run lint` – static analysis (to be configured).
- `npm run test` – run automated tests (see `docs/TESTING_GUIDE.md`).
- `npm run build` – production build for deployment.
- `supabase start` / `supabase status` – manage local Supabase services when working on authenticated features or image storage flows (available post-V2 scaffolding).

## AI Assistant Guidance

- Respect this document for shell command expectations.
- When uncertain about a command, describe the intention in the PR or task notes so the team can confirm.
