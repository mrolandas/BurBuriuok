# Subscriptions

> **Status**: Planned (Priority 2 in Roadmap)

This document describes the learner subscription system for accessing subject content.

## Vision

Learners subscribe to specific subjects (top-level curriculum sections) to:

- Focus on relevant content
- Avoid information overload
- Track progress within their subjects
- Receive personalized recommendations

## Subscription Model

### Subject = Top-Level Section

A "subject" in Moxlai corresponds to a complete learning domain:

- **LBS** - Laivo Buriuotojo Sertifikatas (sailing theory)
- **FIZ** - Physics (future)
- **MAT** - Mathematics (future)

When subscribed to a subject, learners see **all content** within that subject.

### Access Control

| Subscription Status | Access                 |
| ------------------- | ---------------------- |
| Not subscribed      | Hidden from UI         |
| Subscribed          | Full read access       |
| Expired (future)    | Read-only, no progress |

## Data Model

### `subjects` Table (Future)

```sql
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,        -- e.g., 'LBS'
  title TEXT NOT NULL,              -- e.g., 'Laivo Buriuotojo Sertifikatas'
  slug TEXT UNIQUE NOT NULL,        -- URL-friendly: 'buriavimas'
  description TEXT,
  icon TEXT,                        -- Emoji or icon identifier
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### `learner_subscriptions` Table

```sql
CREATE TABLE learner_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,           -- NULL = never expires
  granted_by UUID REFERENCES profiles(id),  -- Admin who granted
  metadata JSONB DEFAULT '{}',
  UNIQUE(profile_id, subject_id)
);
```

## Subscription Management

### Admin-Controlled (Phase 1)

Initially, subscriptions are managed by admins:

1. Admin navigates to User Management
2. Selects a user
3. Toggles subject subscriptions on/off
4. Changes take effect immediately

### Self-Service (Future)

Later phases may include:

- Public subject catalog
- Subscription requests
- Payment integration (if monetized)

## UI Integration

### Subject Selection

On first visit or from settings:

```
┌─────────────────────────────────────────┐
│         Pasirink mokymosi sritį         │
├─────────────────────────────────────────┤
│                                         │
│  ⛵ Buriavimas                          │
│     Laivo Buriuotojo Sertifikatas      │
│     [Prenumeruoti]                     │
│                                         │
│  🔬 Fizika                             │
│     Fizikos pagrindai                  │
│     [Netrukus]                         │
│                                         │
│  📐 Matematika                         │
│     Algebra ir geometrija              │
│     [Netrukus]                         │
│                                         │
└─────────────────────────────────────────┘
```

### Filtered Navigation

The main curriculum view only shows subscribed subjects:

```typescript
// frontend/src/lib/stores/subscriptionStore.ts
import { writable, derived } from "svelte/store";

export const subscriptions = writable<Subscription[]>([]);

export const subscribedSubjectIds = derived(
  subscriptions,
  ($subs) => new Set($subs.map((s) => s.subject_id))
);

// Used in curriculum loading
export async function loadCurriculum() {
  const subjects = await getSubscribedSubjects();
  // Only fetch curriculum for subscribed subjects
}
```

### Homepage

Homepage shows only subscribed subjects' sections:

```
┌─────────────────────────────────────────┐
│                  Moxlai                  │
├─────────────────────────────────────────┤
│                                         │
│ ⛵ Buriavimas                           │
│ ┌─────────────────────────────────────┐ │
│ │ LBS-1  Laivo tipai          12/15  │ │
│ │ LBS-2  Burės ir takelažas   8/20   │ │
│ │ LBS-3  Navigacija           3/10   │ │
│ │ ...                                 │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [+ Pridėti naują sritį]                │
│                                         │
└─────────────────────────────────────────┘
```

## API Endpoints (Planned)

### Public/Learner

| Method | Endpoint                    | Description                 |
| ------ | --------------------------- | --------------------------- |
| GET    | `/subjects`                 | List all subjects (catalog) |
| GET    | `/subscriptions`            | Get user's subscriptions    |
| POST   | `/subscriptions/:subjectId` | Request subscription        |
| DELETE | `/subscriptions/:subjectId` | Cancel subscription         |

### Admin

| Method | Endpoint                                    | Description              |
| ------ | ------------------------------------------- | ------------------------ |
| GET    | `/admin/subjects`                           | List all subjects        |
| POST   | `/admin/subjects`                           | Create subject           |
| PUT    | `/admin/subjects/:id`                       | Update subject           |
| DELETE | `/admin/subjects/:id`                       | Delete subject           |
| GET    | `/admin/users/:id/subscriptions`            | Get user's subscriptions |
| POST   | `/admin/users/:id/subscriptions`            | Grant subscription       |
| DELETE | `/admin/users/:id/subscriptions/:subjectId` | Revoke subscription      |

## Migration Strategy

### Existing Content

The current LBS content needs to be associated with a subject:

```sql
-- Create LBS subject
INSERT INTO subjects (code, title, slug, description)
VALUES ('LBS', 'Laivo Buriuotojo Sertifikatas', 'buriavimas',
        'Lietuvos buriavimo teorijos kursas');

-- Link existing curriculum nodes
UPDATE curriculum_nodes
SET subject_id = (SELECT id FROM subjects WHERE code = 'LBS')
WHERE code LIKE 'LBS-%';

-- Link existing concepts
UPDATE concepts
SET subject_id = (SELECT id FROM subjects WHERE code = 'LBS')
WHERE curriculum_node_code LIKE 'LBS-%';
```

### Auto-Subscribe Existing Users

```sql
-- Subscribe all existing users to LBS
INSERT INTO learner_subscriptions (profile_id, subject_id)
SELECT p.id, s.id
FROM profiles p
CROSS JOIN subjects s
WHERE s.code = 'LBS'
ON CONFLICT DO NOTHING;
```

## Subject Manager Role (Future)

Later phases will introduce a "subject manager" role:

| Permission             | Admin | Subject Manager | Learner         |
| ---------------------- | ----- | --------------- | --------------- |
| Create subjects        | ✅    | ❌              | ❌              |
| Manage all content     | ✅    | ❌              | ❌              |
| Manage own subject     | ✅    | ✅              | ❌              |
| Use AI for own subject | ✅    | ✅              | ❌              |
| View curriculum        | ✅    | ✅              | Subscribed only |
| Track progress         | ✅    | ✅              | ✅              |

---

## Maintenance

- **Last verified**: 2025-12-10
- **Status**: Planning document - not yet implemented
- **Update when**: Implementation begins, requirements change
- **Related docs**: [Roadmap](../ROADMAP.md), [Database Schema](../architecture/DATABASE_SCHEMA.md)
