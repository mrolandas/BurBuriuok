# Progress Tracking

The progress tracking system allows learners to mark concepts as learned ("moku") and tracks their knowledge state across sessions.

## Overview

| Aspect          | Details                                                  |
| --------------- | -------------------------------------------------------- |
| **Table**       | `concept_progress`                                       |
| **Identifiers** | `device_key` (anonymous) or `profile_id` (authenticated) |
| **Statuses**    | `learning`, `known`, `review`                            |

## Progress States

| Status     | Meaning            | UI Indicator |
| ---------- | ------------------ | ------------ |
| `learning` | Currently studying | 📖           |
| `known`    | Mastered           | ✅           |
| `review`   | Needs review       | 🔄           |

## Data Model

### `concept_progress` Table

| Column         | Type        | Description                   |
| -------------- | ----------- | ----------------------------- |
| `id`           | UUID        | Primary key                   |
| `concept_slug` | TEXT        | Reference to concept          |
| `device_key`   | TEXT        | Anonymous device identifier   |
| `profile_id`   | UUID        | Authenticated user (optional) |
| `status`       | TEXT        | Current learning status       |
| `created_at`   | TIMESTAMPTZ | First interaction             |
| `updated_at`   | TIMESTAMPTZ | Last status change            |

### Future Additions (Roadmap)

| Column             | Type        | Purpose                     |
| ------------------ | ----------- | --------------------------- |
| `times_tested`     | INT         | Number of test attempts     |
| `times_passed`     | INT         | Successful test attempts    |
| `last_tested_at`   | TIMESTAMPTZ | Most recent test            |
| `confidence_score` | FLOAT       | Calculated confidence (0-1) |

## Authentication Modes

### Device Key (Legacy)

- UUID stored in browser localStorage
- Sent via `x-device-key` header
- Allows anonymous progress tracking
- **Being deprecated** in favor of authenticated tracking

### Authenticated (Preferred)

- User logs in via magic-link
- JWT contains `profile_id`
- Progress linked to user account
- Persists across devices

### Migration Path

When an anonymous user logs in:

1. Device key progress is preserved
2. Future progress uses profile_id
3. Device key records may be merged to profile

## API Endpoints

### Get Progress

```http
GET /api/v1/progress
Authorization: Bearer <token>
```

Response:

```json
{
  "data": [
    {
      "concept_slug": "lbs-1-1a-jole",
      "status": "known",
      "updated_at": "2025-12-10T12:00:00Z"
    }
  ]
}
```

### Update Progress

```http
POST /api/v1/progress
Authorization: Bearer <token>
Content-Type: application/json

{
  "concept_slug": "lbs-1-1a-jole",
  "status": "known"
}
```

### Clear Progress

```http
DELETE /api/v1/progress/lbs-1-1a-jole
Authorization: Bearer <token>
```

## Frontend Integration

### Concept Detail Page

The concept detail page (`/concepts/[slug]`) shows:

- Current progress status
- "Mark as learned" button
- Progress history (future)

### Curriculum Tree

The curriculum tree shows progress indicators:

- Checkmark for known concepts
- Count of learned concepts per section

### Progress Store

```typescript
// frontend/src/lib/stores/progressStore.ts
import { writable } from "svelte/store";

export const progressStore = writable<Map<string, ProgressStatus>>(new Map());

export async function markAsLearned(slug: string) {
  // API call
  // Update store
}
```

## Rate Limiting

| Operation        | Limit               |
| ---------------- | ------------------- |
| Progress updates | 120/hour per device |

This prevents abuse while allowing normal study sessions.

## Analytics (Future)

Progress data enables:

- Study time tracking
- Learning velocity metrics
- Section completion rates
- Personalized recommendations

## Testing Integration (Future)

Progress will integrate with the testing system:

```
Test Attempt
    ↓
Score ≥ threshold?
    ↓ Yes          ↓ No
Mark as "known"   Mark as "review"
    ↓                  ↓
Update stats      Schedule re-test
```

---

## Maintenance

- **Last verified**: 2025-12-10
- **Related code**:
  - `data/repositories/progressRepository.ts`
  - `backend/src/routes/progress.ts`
  - `frontend/src/lib/stores/progressStore.ts` (if exists)
- **Update when**: Progress model changes, new statuses added, testing integration
- **Related docs**: [Database Schema](../architecture/DATABASE_SCHEMA.md), [Testing System](TESTING_SYSTEM.md)
