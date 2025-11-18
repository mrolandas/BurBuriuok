# API & Moderation Contracts

Defines the service surface area that sits in front of Supabase for BurBuriuok. These contracts stabilise the backend workstream and inform the mobile-first UI. Paths assume an Express instance mounted under `/api/v1` with Supabase Auth JWT validation. The initial Express scaffold (2025-11-04) now exposes the public read endpoints documented below.

## Roles & Authentication

- **Public** – no token; read-only curriculum and concept browsing.
- **Learner** – Supabase JWT; can manage personal progress and study queue (media submissions deferred).
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

Progress endpoints require a device binding: send `x-device-key` or `deviceKey` query when auth flow is absent. Rate limit (stubbed in-memory) caps progress writes at 120/hour per device. Learner endpoints also accept optional `confidence` payload values (`high`, `medium`, `low`) when marking progress, feeding the spaced repetition model described in `docs/references/features/ideas/GAMIFICATION_MODEL.md`.

Media submission endpoints are deferred; learners will gain upload APIs when MEDIA-003 revives. Progress endpoints require a device binding: send `x-device-key` or `deviceKey` query when auth flow is absent. Rate limit (stubbed in-memory) caps progress writes at 120/hour per device. Learner endpoints also accept optional `confidence` payload values (`high`, `medium`, `low`) when marking progress, feeding the spaced repetition model described in `docs/references/features/ideas/GAMIFICATION_MODEL.md`.

## Admin Endpoints

### Curriculum & Concepts

| Method | Path                                 | Body                                                           | Status  | Notes                                                                                          |
| ------ | ------------------------------------ | -------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| POST   | `/admin/curriculum/nodes`            | `{ code, title, summary?, parentCode?, ordinal?}`              | Shipped | Creates node; enforces unique code and ordinal-within-parent.                                  |
| PATCH  | `/admin/curriculum/nodes/:code`      | Partial fields (`title`, `summary`, etc.)                      | Shipped | Updates node; writes entry to `content_versions`.                                              |
| DELETE | `/admin/curriculum/nodes/:code`      |                                                                | Shipped | Archives node and returns latest snapshot.                                                     |
| POST   | `/admin/curriculum/items`            | `{ nodeCode, label, termLt, termEn?, ... }`                    | Shipped | Creates curriculum item; validation mirrors shared schema used by admin tree forms.            |
| PATCH  | `/admin/curriculum/items/:id`        | Partial                                                        | Planned | Will support label edits, required toggle, and ordinal swaps once stable.                      |
| POST   | `/admin/curriculum/dependencies`     | `{ source: { type, id }, prerequisite: { type, id }, notes? }` | Planned | Validates both sides exist; rejects self-references and circular graphs via server-side check. |
| DELETE | `/admin/curriculum/dependencies/:id` |                                                                | Planned | Removes mapping, writes audit row.                                                             |

#### Concepts (shipped ADM-002 slice)

| Method | Path                    | Query/Body                                                         | Notes                                                                                                        |
| ------ | ----------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| GET    | `/admin/concepts`       | Query: `sectionCode?`, `status?`                                   | Returns concept collection; status resolves from `metadata.status` (`draft` fallback when absent).           |
| GET    | `/admin/concepts/:slug` |                                                                    | Loads concept for editing; responds with 404 when slug is missing.                                           |
| POST   | `/admin/concepts`       | Body must satisfy `AdminConceptMutationInput` (shared Zod schema). | Creates or updates a concept (Supabase `onConflict` on slug). Persists audit trail via `logContentMutation`. |

Planned follow-ups for ADM-002 include dedicated `PATCH`/`DELETE` routes once archive semantics and RLS policies are finalised. Until then `POST` handles create and update in a single flow.

### Media Library (Admin upload)

| Method | Path                   | Description                                                                                                                                                                                                                                                                     |
| ------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/admin/media`         | **Shipped 2025-11-18.** Body `{ conceptId, assetType, title?, captionEn?, captionLt?, source }` where `source` is `{ kind: 'upload', fileName, fileSize, contentType }` or `{ kind: 'external', url }`. Persists metadata and, for uploads, returns signed upload instructions. |
| GET    | `/admin/media`         | **Shipped 2025-11-18.** Query `conceptId?`, `assetType?`, `limit?`, `cursor?`. Returns recent admin-owned assets ordered by `created_at` with pagination cursors for concept attachment pickers.                                                                                |
| GET    | `/admin/media/:id`     | **Shipped 2025-11-18.** Returns metadata for a single asset (including `sourceKind` helper).                                                                                                                                                                                    |
| GET    | `/admin/media/:id/url` | **Shipped 2025-11-18.** Generates a signed URL (default 1-hour expiry) for upload-backed assets; external links echo their curated URL.                                                                                                                                         |
| DELETE | `/admin/media/:id`     | **Shipped 2025-11-18.** Deletes the asset row and attempts to remove the storage object. Storage removal best effort—missing objects log a warning but do not block deletion.                                                                                                   |

#### Admin Media Request / Response Notes

- Upload sources enforce 50 MB limit, `image/*` (jpeg/png/webp) or `video/mp4` content types, and normalise extensions (`.jpeg → .jpg`). The response returns `upload: { url, token, path, expiresAt }` so the UI can PUT the binary directly to Supabase.
- External sources store HTTPS links for a vetted allowlist (YouTube + Vimeo hosts). The backend records a sentinel storage path `external://<assetId>` so downstream tooling can distinguish upload-vs-external records.
- All responses include `sourceKind` (`upload` or `external`) plus camelCased metadata fields. Signed URL endpoints reply with `{ kind: 'supabase-signed-url', url, expiresAt }` for uploads and `{ kind: 'external', url }` for curated links.
- Pagination uses `created_at` cursors; clients pass the `meta.nextCursor` ISO timestamp in `cursor` to fetch the next page (20 items default, max 50).

### Audit & Versioning

| Method | Path                   | Description                                                                                      |
| ------ | ---------------------- | ------------------------------------------------------------------------------------------------ |
| GET    | `/admin/audit/content` | Returns paginated `content_versions` entries with filters (`entityType`, `status`, `createdBy`). |
| GET    | `/admin/audit/media`   | Reserved for future contributor moderation history (no-op in admin-only MVP).                    |

## Validation Rules

The backend enforces input validation in addition to Supabase constraints.

- **Curriculum nodes**: `code` matches `/^[0-9]+(\.[0-9a-z]+)*$/`, `ordinal` unique within parent, `parentCode` must exist unless root. Depth capped at 4 for now.
- Inline section editing posts trimmed `title`/`summary` payloads to `PATCH /admin/curriculum/nodes/:code`; the service normalises empty summaries to `null` before persistence.
- **Curriculum items**: `label` non-empty, max 400 chars, ordinals sequential (duplicates rejected; gaps allowed but flagged as warning in response metadata).
- **Dependencies**: No self-dependency; server detects simple cycles by checking existing graph before insert. Mixed type links allowed (concept→node) but must reflect real prerequisite order.
- **Concepts**: `termLt` required, `termEn` optional but trimmed. `slug` lowercase kebab-case; generated from Lithuanian term with transliteration. `metadata` defaults to `{}` and must be JSON-serialisable. `isRequired` defaults from seed alignment.
- **Media assets (admin)**: `assetType` must align with stored file; `storage_path` required when `source.kind='upload'`, `external_url` required for curated links. Captions limited to 300 chars per language; enforce 50 MB size cap in service before requesting upload.
- **Progress**: Status limited to `learning|known|review`. `lastReviewedAt` ISO string; server injects timestamp when absent.

Validation errors return HTTP 422 with `{ error: { code: 'VALIDATION_ERROR', fieldErrors: { ... } } }` shape.

## Audit Logging Strategy

- Every content mutation hits `content_versions` with:
  - `entity_type` and `entity_primary_key` (node code, concept id, etc.)
  - `version` auto-incremented per entity inside the service before insert.
  - `status` transitions (`draft` → `in_review` → `published` → `archived`).
  - `diff` storing JSON Patch-style deltas to aid review diffing.
- Backend exposes `logContentMutation` helper that computes field-level changes and persists them to `content_versions` + `content_version_changes`.
- Media uploads create a `content_versions` entry only when metadata changes are significant. No dedicated moderation table is touched in the admin-only MVP; log storage deletions to stdout for later ingestion.
- For high-risk operations (delete/archive), service emits structured logs (JSON) to stdout for ingestion by hosting provider.
- Future improvement: add Supabase triggers to capture direct table edits (if any) and push to the same tables so the audit trail stays consistent.

## Rate Limiting & Quotas

Implemented with an in-memory store (Redis later) using token bucket semantics.

- **Public search**: 60 requests/minute per IP. Burst 10.
- **Progress updates**: 120 writes/hour per learner. Excess attempts return 429 with retry-after.
- **Media uploads (admin)**: 40 uploads/day per admin with burst of 10; configurable via environment variable.
- **Concept edits**: 30 writes/hour per admin. Additional edits require waiting or manual override.
- **Dependency changes**: 20 writes/hour per admin; prevents frantic remapping.

Quota breaches respond with `{ error: { code: 'RATE_LIMITED', retryAfterSeconds } }` and are logged at warning level.

## Future Considerations

- Introduce GraphQL reflection for curriculum browsing once caching strategies stabilise.
- Add websocket channel for live moderation notifications.
- Expand audit trail with end-user-visible changelog derived from `content_versions`.
- Evaluate per-module instructor roles that limit admin endpoints to specific node code prefixes.

## Implementation Checklist (MEDIA-002)

- [x] **Express Routes** – `backend/src/routes/admin/media.ts` now exposes `POST/GET/DELETE` handlers and is mounted under `/api/v1/admin/media` behind `requireAdminRole`.
- [x] **Payload Handling** – Shared schema `shared/validation/adminMediaAssetSchema.ts` validates uploads vs external sources (size/type/provider) and normalises metadata before persisting.
- [x] **Signed URL helper** – Upload-backed assets return short-lived signed upload instructions; `GET /admin/media/:id/url` issues signed read URLs (1 h default, configurable via `expiresIn`).
- [ ] **Rate Limiting & Quotas** – TODO: extend the in-memory limiter for admin media create/delete buckets and surface `RATE_LIMITED` responses.
- [x] **Supabase Interactions** – Service-role client writes `media_assets`, deletes cascade to storage (`external://` sentinel prevents unintended removals) and logs best-effort storage clean-up failures.
- [x] **Tests** – Added smoke coverage `npm run test:media002` exercising upload/external create, list/filter, signed URL fetch, and delete flow via the Express API.
- [x] **Documentation & Observability** – API contract updated, admin setup notes follow, and structured console logs (`[media] asset_created/asset_deleted`) annotate actor + storage outcome for ingestion later.

#### Deployment Steps

1. Merge MEDIA-001 schema/bucket changes and deploy backend with new routes simultaneously.
2. Run automated tests (`npm run test:media002`, `npm run backend:test`) in CI; block deploy on failures.
3. After deploy, execute manual smoke: create test asset, fetch signed URL, delete asset; confirm entries in Supabase.
