# Frontend Module

SvelteKit-based user interface for BurBuriuok. The frontend consumes Supabase-backed data through the shared `data/` layer and renders Lithuanian-first UI components optimised for mobile users.

## Responsibilities

- Client-side routing and layouts (`src/routes`).
- UI components and widgets (`src/lib/components`).
- State management/stores (`src/lib/state`).
- Data access wrappers that import repositories from `data/`.
- Styling assets (`src/lib/styles` and `styles/`).

## Development Notes

- Keep components small (<200 lines where practical).
- Place Lithuanian UI strings in dedicated localisation helpers.
- Prefer TypeScript and strong typing against shared interfaces exported from `data/`.

## Planned Commands

- `npm run dev:frontend` – start SvelteKit in development mode.
- `npm run build:frontend` – production build for deployment.
- `npm run test:frontend` – component/unit tests (Vitest).

_Update this README as soon as the project scaffold is generated and commands become available._
