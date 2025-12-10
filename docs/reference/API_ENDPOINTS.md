# API Endpoints Reference

Complete reference of all REST API endpoints.

## Base URLs

| Environment | URL                                  |
| ----------- | ------------------------------------ |
| Production  | `https://moxlai.onrender.com/api/v1` |
| Local       | `http://localhost:4000/api/v1`       |

## Authentication

Most endpoints require authentication via JWT:

```http
Authorization: Bearer <supabase-jwt>
```

Legacy device-key authentication (for progress):

```http
x-device-key: <uuid>
```

---

## Health Check

### GET /health

Check service status.

**Auth**: None

**Response**:

```json
{
  "data": { "status": "ok" },
  "meta": { "timestamp": "2025-12-10T12:00:00Z" }
}
```

---

## Public Endpoints

### Curriculum

#### GET /curriculum

List curriculum tree.

**Auth**: None

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `flat` | boolean | Return flat list instead of tree |

**Response**:

```json
{
  "data": [
    {
      "code": "LBS-1",
      "title": "Laivo tipai",
      "level": 1,
      "parent_code": null,
      "ordinal": 1,
      "children": [...]
    }
  ]
}
```

#### GET /curriculum/:code

Get single curriculum node.

**Auth**: None

**Response**:

```json
{
  "data": {
    "code": "LBS-1-1A",
    "title": "Burinių laivų tipai",
    "level": 2,
    "parent_code": "LBS-1",
    "ordinal": 1,
    "items": [...]
  }
}
```

### Concepts

#### GET /concepts

List concepts with optional filters.

**Auth**: None

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `node` | string | Filter by curriculum node code |
| `section` | string | Filter by top-level section |
| `status` | string | Filter by status (published/draft) |
| `is_required` | boolean | Filter required concepts |
| `limit` | number | Max results (default 100) |
| `offset` | number | Pagination offset |

**Response**:

```json
{
  "data": [
    {
      "slug": "lbs-1-1a-jole",
      "term_lt": "Jolė",
      "term_en": "Dinghy",
      "curriculum_node_code": "LBS-1-1A",
      "is_required": true
    }
  ],
  "meta": {
    "total": 300,
    "limit": 100,
    "offset": 0
  }
}
```

#### GET /concepts/:slug

Get concept detail.

**Auth**: None

**Response**:

```json
{
  "data": {
    "slug": "lbs-1-1a-jole",
    "term_lt": "Jolė",
    "term_en": "Dinghy",
    "description_lt": "Mažas burlaivis...",
    "description_en": "A small sailboat...",
    "curriculum_node_code": "LBS-1-1A",
    "curriculum_item_ordinal": 1,
    "is_required": true,
    "metadata": { "status": "published" },
    "media": [...]
  }
}
```

### Search

#### GET /search

Global search across concepts and curriculum.

**Auth**: None

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search query (required) |
| `type` | string | Filter by type (concept/node) |
| `limit` | number | Max results |

**Rate Limit**: 60/min/IP

**Response**:

```json
{
  "data": {
    "concepts": [...],
    "nodes": [...]
  }
}
```

### Dependencies

#### GET /dependencies

List curriculum dependencies.

**Auth**: None

**Response**:

```json
{
  "data": [
    {
      "source_type": "concept",
      "source_id": "lbs-1-2-1-kilis",
      "prerequisite_type": "concept",
      "prerequisite_id": "lbs-1-1a-jole",
      "strength": "required"
    }
  ]
}
```

---

## Progress Endpoints

### GET /progress

Get user's learning progress.

**Auth**: Bearer or x-device-key

**Response**:

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

### POST /progress

Update concept progress.

**Auth**: Bearer or x-device-key

**Rate Limit**: 120/hour/device

**Request**:

```json
{
  "concept_slug": "lbs-1-1a-jole",
  "status": "known"
}
```

**Response**:

```json
{
  "data": {
    "concept_slug": "lbs-1-1a-jole",
    "status": "known",
    "updated_at": "2025-12-10T12:00:00Z"
  }
}
```

### DELETE /progress/:slug

Clear progress for a concept.

**Auth**: Bearer or x-device-key

**Response**: 204 No Content

---

## Auth Endpoints

### POST /auth/magic-link

Request magic link email.

**Auth**: None

**Rate Limit**: 10/hour/IP

**Request**:

```json
{
  "email": "user@example.com"
}
```

**Response**:

```json
{
  "data": { "message": "Magic link sent" }
}
```

### POST /auth/session

Validate current session.

**Auth**: Bearer

**Response**:

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "learner"
    }
  }
}
```

### POST /auth/logout

Clear session.

**Auth**: Bearer

**Response**: 204 No Content

---

## Profile Endpoints

### GET /profile

Get current user profile.

**Auth**: Bearer

**Response**:

```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "learner",
    "display_name": "Jonas",
    "language_preference": "lt"
  }
}
```

### PATCH /profile

Update profile.

**Auth**: Bearer

**Request**:

```json
{
  "display_name": "Jonas Jonaitis",
  "language_preference": "en"
}
```

**Response**: Updated profile object

---

## Admin Endpoints

All admin endpoints require Bearer token with admin role.

### Concepts

#### GET /admin/concepts

List all concepts (including drafts).

**Response**: Array of concepts with full details

#### POST /admin/concepts

Create concept.

**Rate Limit**: 30/hour

**Request**:

```json
{
  "slug": "lbs-1-1a-new-concept",
  "term_lt": "Naujas terminas",
  "description_lt": "Aprašymas...",
  "curriculum_node_code": "LBS-1-1A",
  "is_required": false
}
```

#### PUT /admin/concepts/:slug

Update concept.

**Rate Limit**: 30/hour

**Request**: Partial concept object

#### DELETE /admin/concepts/:slug

Delete concept.

**Response**: 204 No Content

### Curriculum

#### GET /admin/curriculum

List full curriculum tree.

#### POST /admin/curriculum

Create curriculum node.

**Request**:

```json
{
  "code": "LBS-11",
  "title": "Naujas skyrius",
  "level": 1,
  "ordinal": 11
}
```

#### PUT /admin/curriculum/:code

Update curriculum node.

#### DELETE /admin/curriculum/:code

Delete curriculum node (must be empty).

#### POST /admin/curriculum/:code/resequence

Reorder items in a node.

**Request**:

```json
{
  "items": [
    { "id": "uuid1", "ordinal": 1 },
    { "id": "uuid2", "ordinal": 2 }
  ]
}
```

### Media

#### GET /admin/media

List media assets.

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `concept` | string | Filter by concept slug |
| `type` | string | Filter by type (image/video/pdf) |

#### POST /admin/media

Upload media file.

**Rate Limit**: 40/day

**Request**: `multipart/form-data` with file

#### PATCH /admin/media/:id

Update media metadata.

**Request**:

```json
{
  "title": "Updated title",
  "description": "Alt text"
}
```

#### DELETE /admin/media/:id

Delete media asset.

### Users

#### GET /admin/users

List all users.

**Response**:

```json
{
  "data": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "role": "learner",
      "created_at": "2025-12-10T12:00:00Z"
    }
  ]
}
```

#### PATCH /admin/users/:id

Update user role.

**Request**:

```json
{
  "role": "admin"
}
```

#### POST /admin/invites

Send admin invite.

**Request**:

```json
{
  "email": "newadmin@example.com"
}
```

### Settings

#### GET /admin/settings

Get system settings.

**Response**:

```json
{
  "data": {
    "registration_enabled": true,
    "ai_provider": "gemini"
  }
}
```

#### PATCH /admin/settings

Update settings.

**Request**:

```json
{
  "registration_enabled": false
}
```

---

## Agent Endpoints

AI agent endpoints for admin users.

### GET /agent/models

List available AI models.

**Auth**: Bearer (admin)

**Response**:

```json
{
  "models": [
    {
      "id": "gemini-2.5-flash",
      "name": "Gemini 2.5 Flash",
      "description": "Fast"
    },
    {
      "id": "gemini-2.5-pro",
      "name": "Gemini 2.5 Pro",
      "description": "Capable"
    }
  ]
}
```

### GET /agent/test

Test AI connection.

**Auth**: Bearer (admin)

**Response**:

```json
{
  "data": { "status": "connected", "model": "gemini-2.5-flash" }
}
```

### POST /agent/chat

Send chat message to AI agent.

**Auth**: Bearer (admin)

**Rate Limit**: 60/hour

**Request**:

```json
{
  "messages": [{ "role": "user", "content": "Show me the curriculum" }],
  "executionMode": "plan",
  "confirmToolCalls": false,
  "model": "gemini-2.5-flash"
}
```

**Response (with tool calls)**:

```json
{
  "role": "assistant",
  "content": "I'll fetch the curriculum...",
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

**Response (final)**:

```json
{
  "role": "assistant",
  "content": "The curriculum has 10 sections...",
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

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### Common Error Codes

| Code               | HTTP | Description                |
| ------------------ | ---- | -------------------------- |
| `UNAUTHORIZED`     | 401  | Missing/invalid auth       |
| `FORBIDDEN`        | 403  | Insufficient permissions   |
| `NOT_FOUND`        | 404  | Resource not found         |
| `VALIDATION_ERROR` | 400  | Invalid request            |
| `CONFLICT`         | 409  | Duplicate/constraint error |
| `RATE_LIMITED`     | 429  | Too many requests          |
| `INTERNAL_ERROR`   | 500  | Server error               |

### Rate Limit Response

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMITED",
  "details": {
    "retryAfter": 3600
  }
}
```

Headers included:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1702209600
```

---

## Maintenance

- **Last verified**: 2025-12-10
- **Related code**: `backend/src/routes/`
- **Update when**: New endpoints added, request/response changes
- **Related docs**: [API Design](../architecture/API_DESIGN.md), [AI Curriculum Builder](../features/AI_CURRICULUM_BUILDER.md)
