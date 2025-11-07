# Infrastructure References

Use this folder as the single entry point for architecture documentation. Each document focuses on one layer of the stack and stays aligned with the trimmed launch scope.

- `BACKEND.md` – Express service layout, admin endpoints, middleware, and local development workflow.
- `FRONTEND.md` – SvelteKit architecture, routing, shared stores, theming, and quality bars.
- `SUPABASE.md` – Hosted project details, schema/seeds, storage plans, and migration workflow.
- `docs/INFRASTRUCTURE.md` – high-level environment strategy, near-term vs future-state goals, and operational checklist.

Add new pages here whenever infrastructure changes (e.g., deployment platform notes, event dispatcher design, observability playbook). Cross-link updated docs in `docs/README.md` so contributors have a predictable navigation path.
