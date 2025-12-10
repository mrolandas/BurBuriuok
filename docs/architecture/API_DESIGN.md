# API Design

This document describes the REST API design conventions and authentication patterns.

## Base URLs

| Environment | URL                                      |
| ----------- | ---------------------------------------- |
| Production  | `https://moxlai.onrender.com/api/v1` |
| Local       | `http://localhost:4000/api/v1`           |

## Authentication

### Magic-Link Flow

1. Client POSTs email to `/auth/magic-link`
2. Supabase sends email with login link
3. User clicks link → redirected to `/auth/callback`
4. Callback exchanges token for session
5. Session JWT included in subsequent requests

### Headers

```http
Authorization: Bearer <supabase-jwt>
```

For anonymous progress tracking (legacy):

```http
x-device-key: <uuid>
```

### JWT Claims

The Supabase JWT contains:

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "app_metadata": {
    "role": "admin"
  }
}
```

Backend middleware extracts `role` from `app_metadata` for authorization.

## API Namespaces

### Public Endpoints

No authentication required.

| Method | Endpoint            | Description                  |
| ------ | ------------------- | ---------------------------- |
| GET    | `/curriculum`       | List curriculum tree         |
| GET    | `/curriculum/:code` | Get single node              |
| GET    | `/concepts`         | List concepts (with filters) |
| GET    | `/concepts/:slug`   | Get concept detail           |
| GET    | `/dependencies`     | List dependencies            |
| GET    | `/search?q=term`    | Global search                |

### Progress Endpoints

Requires device-key or Bearer token.

| Method | Endpoint          | Description            |
| ------ | ----------------- | ---------------------- |
| GET    | `/progress`       | Get user's progress    |
| POST   | `/progress`       | Update progress        |
| DELETE | `/progress/:slug` | Clear concept progress |

### Auth Endpoints

| Method | Endpoint           | Description         |
| ------ | ------------------ | ------------------- |
| POST   | `/auth/magic-link` | Request login email |
| POST   | `/auth/session`    | Validate session    |
| POST   | `/auth/logout`     | Clear session       |

### Profile Endpoints

Requires Bearer token.

| Method | Endpoint   | Description              |
| ------ | ---------- | ------------------------ |
| GET    | `/profile` | Get current user profile |
| PATCH  | `/profile` | Update profile           |

### Admin Endpoints

Requires Bearer token with admin role.

| Method | Endpoint                             | Description          |
| ------ | ------------------------------------ | -------------------- |
| GET    | `/admin/concepts`                    | List all concepts    |
| POST   | `/admin/concepts`                    | Create concept       |
| PUT    | `/admin/concepts/:slug`              | Update concept       |
| DELETE | `/admin/concepts/:slug`              | Delete concept       |
| GET    | `/admin/curriculum`                  | List curriculum tree |
| POST   | `/admin/curriculum`                  | Create node          |
| PUT    | `/admin/curriculum/:code`            | Update node          |
| DELETE | `/admin/curriculum/:code`            | Delete node          |
| POST   | `/admin/curriculum/:code/resequence` | Reorder items        |
| GET    | `/admin/media`                       | List media assets    |
| POST   | `/admin/media`                       | Upload media         |
| PATCH  | `/admin/media/:id`                   | Update metadata      |
| DELETE | `/admin/media/:id`                   | Delete media         |
| GET    | `/admin/users`                       | List users           |
| PATCH  | `/admin/users/:id`                   | Update user role     |
| POST   | `/admin/invites`                     | Send admin invite    |
| GET    | `/admin/settings`                    | Get system settings  |
| PATCH  | `/admin/settings`                    | Update settings      |

### Agent Endpoints

Requires Bearer token with admin role.

| Method | Endpoint        | Description              |
| ------ | --------------- | ------------------------ |
| GET    | `/agent/models` | List available AI models |
| GET    | `/agent/test`   | Test AI connection       |
| POST   | `/agent/chat`   | Send chat message        |

## Request/Response Format

### Standard Response

```json
{
  "data": { ... },
  "meta": {
    "timestamp": "2025-12-10T12:00:00Z"
  }
}
```

### Error Response

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### Common Error Codes

| Code               | HTTP Status | Description                       |
| ------------------ | ----------- | --------------------------------- |
| `UNAUTHORIZED`     | 401         | Missing or invalid auth           |
| `FORBIDDEN`        | 403         | Insufficient permissions          |
| `NOT_FOUND`        | 404         | Resource doesn't exist            |
| `VALIDATION_ERROR` | 400         | Invalid request body              |
| `CONFLICT`         | 409         | Duplicate or constraint violation |
| `RATE_LIMITED`     | 429         | Too many requests                 |
| `INTERNAL_ERROR`   | 500         | Server error                      |

## Rate Limiting

Implemented via token bucket algorithm per endpoint category.

| Category            | Limit | Window              |
| ------------------- | ----- | ------------------- |
| Public search       | 60    | per minute per IP   |
| Progress updates    | 120   | per hour per device |
| Admin media uploads | 40    | per day             |
| Admin concept edits | 30    | per hour            |
| Magic-link requests | 10    | per hour per IP     |
| Agent chat          | 60    | per hour per user   |

Rate limit headers returned:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1702209600
```

## Pagination

List endpoints support pagination:

```http
GET /api/v1/concepts?limit=20&offset=40
```

Response includes pagination metadata:

```json
{
  "data": [...],
  "meta": {
    "total": 300,
    "limit": 20,
    "offset": 40
  }
}
```

## Filtering

Concept list supports filters:

```http
GET /api/v1/concepts?node=LBS-1-1A&status=published&is_required=true
```

Search endpoint:

```http
GET /api/v1/search?q=jole&type=concept
```

## Agent Chat Protocol

### Request

```json
{
  "messages": [{ "role": "user", "content": "Show me the curriculum" }],
  "executionMode": "plan",
  "confirmToolCalls": false,
  "model": "gemini-2.5-flash"
}
```

### Response (Plan Mode)

```json
{
  "role": "assistant",
  "content": "I'll fetch the curriculum structure.",
  "tool_calls": [
    {
      "id": "call_123",
      "function": {
        "name": "list_curriculum",
        "arguments": "{}"
      }
    }
  ]
}
```

### Response (After Execution)

```json
{
  "role": "assistant",
  "content": "The curriculum has 10 main sections...",
  "toolLogs": [
    {
      "tool": "list_curriculum",
      "args": {},
      "result": "[...]",
      "timestamp": "2025-12-10T12:00:00Z"
    }
  ]
}
```

## CORS

Backend requires `BACKEND_ALLOWED_ORIGINS` environment variable:

```bash
BACKEND_ALLOWED_ORIGINS="https://mrolandas.github.io,https://mrolandas.github.io/Moxlai"
```

Credentials are supported for authenticated requests.

---

## Maintenance

- **Last verified**: 2025-12-10
- **Related code**: `backend/src/routes/`, `backend/src/middleware/`
- **Update when**: New endpoints added, auth flow changes
- **Related docs**: [Architecture Overview](OVERVIEW.md), [API Endpoints Reference](../reference/API_ENDPOINTS.md)
