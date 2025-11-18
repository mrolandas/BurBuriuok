# Admin Dashboard User Guide

_Last updated: 2025-11-18_

## About This Guide

This document explains how authenticated administrators can work inside the BurKursas admin console. The guide covers navigation, key flows, and tips for the current sprint deliverables (ADM-001 and ADM-002) with pointers to future modules.

## Prerequisites

- Admin permissions on your Supabase account (`app_role = "admin"`).
- Access to the staging or production deployment, or a local stack started via `./scripts/start_stack.sh`.
- A modern Chromium-based browser (Chrome, Edge, or Brave recommended).

## Getting Started

1. Sign in to the learner application as usual.
2. Append `/admin` to the base URL (for local development this is typically `http://localhost:5173/admin`).
3. If your session includes the admin claim, the dashboard shell loads with your persona banner. Otherwise you receive friendly guidance and a link back to the learner experience (see **Gaining Admin Access** below).

### Gaining Admin Access

1. Submit an access request to the platform team so they can add your Supabase user to the admin allowlist (steps documented in `docs/references/PERSONAS_PERMISSIONS.md`).
2. An administrator updates your Supabase Auth user metadata to include `app_role = "admin"`—typically via the Supabase dashboard or by running `select auth.set_claim(user_id, 'app_role', 'admin');` in SQL Editor.
3. Sign out and sign back in so the session carries the refreshed claim. Confirm by checking the persona banner on `/admin`.
4. Local development shortcut: when `VITE_ENABLE_ADMIN_IMPERSONATION=true` (set this in `frontend/.env.local` alongside your Supabase keys) **and** the backend `.env` contains `ADMIN_DEV_IMPERSONATION=true`, append `?impersonate=admin` to the URL (e.g., `http://localhost:5173/admin?impersonate=admin`) to preview the shell without modifying real accounts.

> **Development note:** Impersonation is available only while the feature flag remains enabled for testing. Remove or disable this shortcut for production launch.

### Persona Banner and Session Indicator

- The banner shows the active role (e.g., `Admin`) and account email.
- If RLS prevents any action, the banner displays a warning so you can refresh or reauthenticate.

## Navigating the Dashboard

The left-hand sidebar lists all modules. Collapse it on smaller screens with the toggle icon.

| Menu Item     | Purpose                                  | Current Status                         |
| ------------- | ---------------------------------------- | -------------------------------------- |
| Overview      | High-level stats and shortcuts           | Planned (ADM-001 scope only)           |
| Curriculum    | Tree editor for curriculum nodes         | Planned                                |
| Concepts      | Concept manager and editor               | **Available**                          |
| Media Library | Admin-managed uploads and asset previews | **Available**                          |
| Media Queue   | Moderation inbox                         | Deferred (returns with contributor UX) |
| Audit Log     | Chronological change feed                | Planned                                |
| Settings      | Permissions and integrations             | Planned                                |

Use keyboard shortcuts `[` and `]` to move between modules when the sidebar has focus.

## Concepts Module (ADM-002)

The Concepts module is the most complete feature today. It provides a searchable table and a drawer-based editor for creating and updating concepts.

### Listing and Filtering

- **Reload**: The list automatically loads when you open the module; refresh with `R` or the browser reload if needed.
- **Search**: Type in the search box to filter by Lithuanian term, English term, slug, section code, or subsection title.
- **Section Filter**: Use the dropdown to focus on a particular section. The list is sorted alphabetically by Lithuanian term.
- **Status Filter**: Toggle between `Visos`, `Publikuotos`, and `Juodraščiai` to narrow the grid.
- **Reset Filters**: Click the “Išvalyti filtrus” button to clear section, status, and search.

### Creating a Concept

1. Click `+ Nauja tema` at the top of the table to open the drawer.
2. Fill out the required fields (`Slug`, `Sąvoka (LT)`, `Aprašymas (LT)`, `Skyriaus kodas`, `Skyriaus pavadinimas`, `Būsena`). Optional fields accept blank values.
3. Draft vs. Publish: Use the status toggle in the drawer footer. Publishing exposes the concept to learners.
4. Click `Išsaugoti`. The form runs shared Zod validation, showing inline errors if fields are missing or invalid.
5. On success, you see a toast confirmation. The table updates optimistically with the new concept.

### Editing a Concept

1. In the table, click the `Redaguoti` button (renders in the actions column for each row).
2. The drawer pre-fills with the selected concept. Adjust any fields as needed.
3. Dirty-state protection:
   - A confirmation dialog appears if you attempt to close the drawer or click away with unsaved changes.
   - The browser blocks tab closes and reloads when unsaved changes exist.
4. Hit `Išsaugoti` to persist changes. Success toasts appear; errors surface above the form.

### Version History Sidebar (Polish in progress)

- When editing, the console requests the last 20 entries from `/api/v1/admin/concepts/:slug/history`.
- Entries show timestamp, actor, and version summary. Diff previews are slated for a future iteration.

### Validation Rules

- `Slug`: Required, lowercase kebab-case. Immutable after creation.
- `Sąvoka (LT)`: Required.
- `Aprašymas (LT)`: Required; trim extra whitespace.
- `isRequired`: Indicates whether the concept is mandatory in the curriculum.
- Metadata `status` mirrors the top-level status to keep history consistent.

### Tips & Troubleshooting

- If the table appears empty, confirm the backend stack is running and seeded.
- Saved drafts default to `isRequired = true`; uncheck if the concept is optional.
- Use the browser devtools console for API error details if saves fail.

### Managing Concept Media Attachments

- The `Papildoma medžiaga` panel inside the concept drawer surfaces every media asset linked to the current concept. Thumbnails include hover actions to copy signed URLs or jump into the dedicated media workspace for deeper inspection.
- Click **Pridėti mediją** to open the creation drawer. The concept selector is locked to the record you are editing so uploads and external links automatically attach on success.
- New uploads walk through the admin media API: choose `Įkelti` for direct file upload (image or MP4 up to 50 MB) or `Išorinis šaltinis` for whitelisted external embeds. Provide the Lithuanian display title/caption and submit.
- On success, a toast confirms the action and the attachment list refreshes immediately. Failures (validation, 429 rate limit, Supabase errors) surface in the shared drawer alert so you can adjust without reloading.
- To remove an attachment, use the trash icon. Deleting an asset with only one concept association also removes the Supabase object; multi-use assets warn you before proceeding. Confirmation toasts mirror the outcome and the `/admin/media` table stays in sync.

> **Reminder:** The concept drawer does not currently allow bulk deletion. Use the Media Library module for batch cleanup or to preview assets in larger format.

## Additional Modules (Roadmap)

- **Curriculum Editor**: Will provide expandable tree navigation, item editing, and dependency management.
- **Media Queue**: Offers tabbed review flows with approval/rejection actions and SLA badges.
- **Audit Log**: Exposes a timeline of content changes with diff viewing and CSV export.
- **Notifications & Analytics**: Planned Slack/email hooks (ADM-004) and analytics mapping (ADM-005).

## Media Library Module (MEDIA-002)

The Media Library (`/admin/media`) is the dedicated workspace for browsing, previewing, and maintaining admin-managed assets.

### Key Layout

- **Filters**: Narrow by concept, asset type (`Paveikslėlis` / `Vaizdo įrašas`), source (`Įkelta` / `Išorinis šaltinis`), and search term. Filters combine, and clearing them resets the result set.
- **Table**: Displays thumbnail, title, type, source kind, linked concept, creator, and created date. Selecting a row opens the detail drawer on the right.
- **Detail Drawer**: Shows the full preview, captions, and admin actions (copy signed URL, refresh preview, delete). Embeds render inline for YouTube/Vimeo and Supabase signed URLs.
- **Bulk Toolbar**: Checkbox column enables multi-select. When one or more rows are selected, a toolbar slides in with bulk delete. Partial failures display inline so you can retry remaining rows.

### Common Tasks

1. **Preview an Asset**

   - Apply filters as needed and click a row. Use the inline preview in the drawer to verify the media renders correctly.
   - Click “Kopijuoti nuorodą” to generate a one-hour signed URL for manual testing.

2. **Delete Assets in Bulk**

   - Use the checkbox column to select multiple assets.
   - Click the bulk delete button in the toolbar. Confirm the prompt; removed assets disappear from the list and any linked concept attachments update automatically.

3. **Triage Rate Limits or Validation Errors**

   - Rate limit responses surface as red toasts with retry guidance. If seen during upload/delete, pause and retry after the indicated window.
   - Validation errors (wrong file type, oversize) display within the creation drawer so the admin can correct metadata before resubmitting.

4. **Audit Associations**
   - Use the concept filter to audit which assets support a given concept. Signed URL previews help confirm the correct files before a learner-facing release.

> **Troubleshooting:** If previews fail to load, re-fetch the signed URL via the drawer, verify Supabase Storage’s `media-admin` bucket policies are intact, and rerun `npm run test:media001` / `npm run test:media002` to confirm backend connectivity.

## Keyboard and Accessibility Notes

- Drawer traps focus; use `Esc` to close (confirmation appears if changes are unsaved).
- All buttons expose accessible labels; form errors link to offending fields.
- Future iterations will add skip links and high-contrast mode per accessibility audit.

## Support

- File dashboard bugs in the issue tracker under the ADM label.
- For access problems, check `docs/references/PERSONAS_PERMISSIONS.md` and coordinate with the platform team.
- For backend/API questions, see `docs/references/API_CONTRACTS.md` and `docs/references/SCHEMA_DECISIONS.md`.

---

Need something clarified or a new workflow documented? Open an issue tagged `documentation` and mention the admin UX squad.
