# API & Moderation Contracts

Defines the service surface area that sits in front of Supabase for BurBuriuok. These contracts stabilise the backend workstream and inform the mobile-first UI. Paths assume an Express instance mounted under `/api/v1` with Supabase Auth JWT validation. The initial Express scaffold (2025-11-04) now exposes the public read endpoints documented below.

## Roles & Authentication

- **Public** – no token; read-only curriculum and concept browsing.
- **Learner** – Supabase JWT; can manage personal progress, study queue, and media submissions (pending review).
- **Admin** – Supabase JWT with `app_role = 'admin'`; full access to content CRUD, moderation, and audit views. Future instructor role can reuse the same endpoints with scope-restricted policies.

JWTs are verified with Supabase public keys. Requests without a valid token are treated as public. Admin-only endpoints must assert role claims server-side before executing.

## Public Read Endpoints

| Method | Path                | Query Params                                                                       | Description                                                                                                                                         |
| ------ | ------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/curriculum`       | `level?` – optional depth filter (`1` = topic, `2` = section, `3+` = sub-sections) | Returns all curriculum nodes ordered by ordinal. Includes nested items for the requested depth.                                                     |
| GET    | `/curriculum/:code` |                                                                                    | Returns a single node by code with parent, children, items, and dependencies.                                                                       |
| GET    | `/concepts`         | `sectionCode?`, `nodeCode?`, `requiredOnly?`                                       | Lists concepts with pagination (`page`, `pageSize` to add later).                                                                                   |
| GET    | `/concepts/:slug`   |                                                                                    | Returns concept detail plus prerequisite and next-step summaries (front-end currently shows placeholders until the public dependency view arrives). |
| GET    | `/search`           | `q`, `limit?`                                                                      | Full-text search across concepts, nodes, and media captions.                                                                                        |

### Response Shapes

All responses follow `{ data: <payload>, meta: { ... } }` with camelCased keys. Concept payload mirrors `data/types.ts#Concept`.

```json
{
  "data": {
    "id": "uuid",
    "slug": "bur-laivo-priekis",
    "termLt": "Priekis",
    "termEn": "Bow",
    "descriptionLt": "Laivo priekinė dalis...",
    "isRequired": true,
    "curriculumNodeCode": "1.1",
    "curriculumItemOrdinal": 2,
    "curriculumItemLabel": "Švertbotas",
    "prerequisites": [
      { "type": "concept", "slug": "laivas", "termLt": "Laivas" }
    ],
    "nextConcepts": [{ "type": "concept", "slug": "kilis", "termLt": "Kilis" }]
  },
  "meta": { "fetchedAt": "2025-11-03T15:22:00Z" }
}
```

## Learner (Authenticated) Endpoints

| Method | Path                      | Description                                                                            |
| ------ | ------------------------- | -------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| GET    | `/progress`               | Returns concept progress states (requires `x-device-key` header or `deviceKey` query). |
| PUT    | `/progress/:conceptId`    | Body `{ status: "learning"                                                             | "known" | "review", lastReviewedAt? }`. Upserts `concept_progress` row with 120 writes/hour limiter per device. |
| DELETE | `/progress/:conceptId`    | Removes the progress record for the device/concept combination.                        |
| POST   | `/study-queue`            | Adds concept to personal queue. Later backed by dedicated table.                       |
| DELETE | `/study-queue/:conceptId` | Removes concept from queue.                                                            |
| POST   | `/media-submissions`      | Upload metadata payload; signed upload URL returned for storage.                       |
| PATCH  | `/media-submissions/:id`  | Allow contributor to withdraw pending submission.                                      |

Progress endpoints require a device binding: send `x-device-key` or `deviceKey` query when auth flow is absent. Rate limit (stubbed in-memory) caps progress writes at 120/hour per device. Learner endpoints also accept optional `confidence` payload values (`high`, `medium`, `low`) when marking progress, feeding the spaced repetition model described in `docs/references/features/ideas/GAMIFICATION_MODEL.md`.

## Admin Endpoints

### Curriculum & Concepts

| Method | Path                                           | Body                                                           | Status  | Notes                                                                                          |
| ------ | ---------------------------------------------- | -------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| POST   | `/admin/curriculum/nodes`                      | `{ code, title, summary?, parentCode?, ordinal }`              | Planned | Creates node; enforces unique code and ordinal-within-parent.                                  |
| PATCH  | `/admin/curriculum/nodes/:code`                | Partial fields                                                 | Planned | Updates node; writes entry to `content_versions`.                                              |
| DELETE | `/admin/curriculum/nodes/:code`                |                                                                | Planned | Soft delete by setting status to `archived`; cascade handled via Supabase RLS.                 |
| POST   | `/admin/curriculum/nodes/:code/items`          | `{ ordinal, label }`                                           | Planned | Validates ordinal uniqueness for the node.                                                     |
| PATCH  | `/admin/curriculum/nodes/:code/items/:ordinal` | Partial                                                        | Planned | Allows label edits or ordinal swaps.                                                           |
| POST   | `/admin/curriculum/dependencies`               | `{ source: { type, id }, prerequisite: { type, id }, notes? }` | Planned | Validates both sides exist; rejects self-references and circular graphs via server-side check. |
| DELETE | `/admin/curriculum/dependencies/:id`           |                                                                | Planned | Removes mapping, writes audit row.                                                             |

#### Concepts (shipped ADM-002 slice)

| Method | Path                    | Query/Body                                                         | Notes                                                                                                        |
| ------ | ----------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| GET    | `/admin/concepts`       | Query: `sectionCode?`, `status?`                                   | Returns concept collection; status resolves from `metadata.status` (`draft` fallback when absent).           |
| GET    | `/admin/concepts/:slug` |                                                                    | Loads concept for editing; responds with 404 when slug is missing.                                           |
| POST   | `/admin/concepts`       | Body must satisfy `AdminConceptMutationInput` (shared Zod schema). | Creates or updates a concept (Supabase `onConflict` on slug). Persists audit trail via `logContentMutation`. |

Planned follow-ups for ADM-002 include dedicated `PATCH`/`DELETE` routes once archive semantics and RLS policies are finalised. Until then `POST` handles create and update in a single flow.

### Media Moderation

| Method | Path                                                       | Description                                                           |
| ------ | ---------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| GET    | `/admin/media`, query `status=pending\|approved\|rejected` | Paginates submissions with contributor info.                          |
| POST   | `/admin/media/:id/decision`                                | Body `{ decision: 'approved'                                          | 'rejected', notes? }`updates`media_assets.status`, creates `media_reviews` row, notifies contributor. |
| POST   | `/admin/media/:id/reassign`                                | Optional future endpoint to re-map asset to a different concept/node. |

### Audit & Versioning

| Method | Path                   | Description                                                                                      |
| ------ | ---------------------- | ------------------------------------------------------------------------------------------------ |
| GET    | `/admin/audit/content` | Returns paginated `content_versions` entries with filters (`entityType`, `status`, `createdBy`). |
| GET    | `/admin/audit/media`   | Returns moderation history from `media_reviews`.                                                 |

## Validation Rules

The backend enforces input validation in addition to Supabase constraints.

- **Curriculum nodes**: `code` matches `/^[0-9]+(\.[0-9a-z]+)*$/`, `ordinal` unique within parent, `parentCode` must exist unless root. Depth capped at 4 for now.
- **Curriculum items**: `label` non-empty, max 400 chars, ordinals sequential (duplicates rejected; gaps allowed but flagged as warning in response metadata).
- **Dependencies**: No self-dependency; server detects simple cycles by checking existing graph before insert. Mixed type links allowed (concept→node) but must reflect real prerequisite order.
- **Concepts**: `termLt` required, `termEn` optional but trimmed. `slug` lowercase kebab-case; generated from Lithuanian term with transliteration. `metadata` defaults to `{}` and must be JSON-serialisable. `isRequired` defaults from seed alignment.
- **Media submissions**: `media_type` must align with stored file; `storage_path` required for uploads, `external_url` for embeds. Captions limited to 300 chars per language.
- **Progress**: Status limited to `learning|known|review`. `lastReviewedAt` ISO string; server injects timestamp when absent.

Validation errors return HTTP 422 with `{ error: { code: 'VALIDATION_ERROR', fieldErrors: { ... } } }` shape.

## Audit Logging Strategy

- Every content mutation hits `content_versions` with:
  - `entity_type` and `entity_primary_key` (node code, concept id, etc.)
  - `version` auto-incremented per entity inside the service before insert.
  - `status` transitions (`draft` → `in_review` → `published` → `archived`).
  - `diff` storing JSON Patch-style deltas to aid review diffing.
- Backend exposes `logContentMutation` helper that computes field-level changes and persists them to `content_versions` + `content_version_changes`.
- Media decisions append to `media_reviews` capturing reviewer, decision, notes, and timestamp.
- For high-risk operations (delete/archive), service emits structured logs (JSON) to stdout for ingestion by hosting provider.
- Future improvement: add Supabase triggers to capture direct table edits (if any) and push to the same tables so the audit trail stays consistent.

## Rate Limiting & Quotas

Implemented with an in-memory store (Redis later) using token bucket semantics.

- **Public search**: 60 requests/minute per IP. Burst 10.
- **Progress updates**: 120 writes/hour per learner. Excess attempts return 429 with retry-after.
- **Media submissions**: 10 pending assets per learner across all concepts; hard cap 20 uploads/day. Admin override available via backend flag.
- **Concept edits**: 30 writes/hour per admin. Additional edits require waiting or manual override.
- **Dependency changes**: 20 writes/hour per admin; prevents frantic remapping.

Quota breaches respond with `{ error: { code: 'RATE_LIMITED', retryAfterSeconds } }` and are logged at warning level.

## Future Considerations

- Introduce GraphQL reflection for curriculum browsing once caching strategies stabilise.
- Add websocket channel for live moderation notifications.
- Expand audit trail with end-user-visible changelog derived from `content_versions`.
- Evaluate per-module instructor roles that limit admin endpoints to specific node code prefixes.
