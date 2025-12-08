# App Configuration API

## Overview

The App Configuration API is designed to transform the application from a purpose-built learning tool (e.g., for sailing) into a generic, malleable learning platform. It allows an external agent (such as an AI) to programmatically manage the entire content structure, including curriculum, concepts, media, and global application settings.

## Authentication

All endpoints require authentication with a valid API key or a user token with `admin` role privileges.

- **Header**: `Authorization: Bearer <TOKEN>`

## 1. Global Configuration

Manage high-level application settings such as the application name, description, and theme.

### Data Model: `AppConfig`

```json
{
  "appTitle": "String",
  "appDescription": "String",
  "primaryColor": "String (Hex)",
  "welcomeMessage": "String",
  "registrationEnabled": "Boolean"
}
```

### Endpoints

- `GET /api/v1/admin/settings/global`
  - Returns the current global configuration.
- `PATCH /api/v1/admin/settings/global`
  - Updates specific fields in the global configuration.

## 2. Content Lifecycle Management

Endpoints to manage the lifecycle of the educational content.

### Endpoints

- `POST /api/v1/admin/content/reset`
  - **Action**: Wipes all existing curriculum nodes, concepts, and media associations.
  - **Use Case**: Preparing the application for a completely new subject matter.
  - **Warning**: This action is irreversible.

## 3. Curriculum Management

Manage the hierarchical structure of the course (Sections, Subsections).

### Data Model: `CurriculumNode`

```json
{
  "code": "String (Unique ID)",
  "title": "String",
  "summary": "String",
  "level": "Integer (1=Section, 2=Subsection)",
  "parentCode": "String (Optional, for subsections)",
  "ordinal": "Integer (Ordering)"
}
```

### Endpoints

- `GET /api/v1/admin/curriculum/tree`
  - Returns the full hierarchical tree of the curriculum.
- `POST /api/v1/admin/curriculum/nodes`
  - Creates a new curriculum node.
- `PUT /api/v1/admin/curriculum/nodes/:code`
  - Updates an existing node.
- `DELETE /api/v1/admin/curriculum/nodes/:code`
  - Deletes a node and its children.

## 4. Concept Management

Manage the atomic learning units (Concepts) attached to the curriculum.

### Data Model: `Concept`

```json
{
  "slug": "String (Unique URL friendly ID)",
  "term": "String (Main title)",
  "description": "String (Markdown content)",
  "curriculumNodeCode": "String (Link to curriculum)",
  "metadata": "Object (Flexible metadata)"
}
```

### Endpoints

- `GET /api/v1/admin/concepts`
  - List all concepts, optionally filtered by curriculum node.
- `POST /api/v1/admin/concepts`
  - Create a new concept.
- `PUT /api/v1/admin/concepts/:id`
  - Update a concept.
- `DELETE /api/v1/admin/concepts/:id`
  - Delete a concept.

## 5. Media Management

Manage media assets (images, videos) and link them to concepts.

### Endpoints

- `POST /api/v1/admin/media/upload`
  - Upload a file. Returns a media ID and URL.
- `POST /api/v1/admin/concepts/:id/media`
  - Link an uploaded media asset to a concept.

## Implementation Plan

### Phase 1: Global Settings & Reset

1.  **Extend `system_settings`**: Ensure it can store arbitrary JSON for `app_config`.
2.  **Implement `reset` endpoint**: Create a secure endpoint to truncate/clear content tables (`curriculum_nodes`, `concepts`, `media_assets`).

### Phase 2: Curriculum & Concept API Refinement

1.  **Review existing Admin API**: Ensure `admin/curriculum.ts` and `admin/concepts.ts` support all CRUD operations required for full automation.
2.  **Bulk Operations**: Consider adding bulk import endpoints for efficiency.

### Phase 3: Frontend Adaptation

1.  **Dynamic Branding**: Update the frontend to fetch `appTitle` and `primaryColor` from the API instead of hardcoded values.
2.  **Dynamic Navigation**: Ensure the navigation menu is built entirely from the `curriculum` API response.

### Phase 4: AI Agent Integration

1.  **API Key Generation**: Create a mechanism to generate long-lived API keys for the AI agent.
2.  **Documentation**: Finalize OpenAPI/Swagger documentation for the agent to consume.
