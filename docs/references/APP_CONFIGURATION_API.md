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

## AI Agent Integration Guide

This section documents how an autonomous AI agent should interact with the API to manage the learning platform's content.

### Context & Future Architecture

The platform is evolving into a generic learning engine hosted at `mokykis.cit.lt`.

- **Multi-Tenancy**: Future versions will support unique subdomains for different subjects (e.g., `buriavimas.mokykis.cit.lt`, `fizika.mokykis.cit.lt`).
- **Admin Configuration**: An admin interface will allow users to provide AI credentials and prompts. The backend will then delegate content generation to the AI agent using this API.

### Authentication Strategy

The AI agent acts as a super-admin. It must obtain a Bearer token associated with a user having the `app_role: 'admin'` claim.

1.  **Lookup/Create Admin User**: Ensure a user exists (e.g., `ai-agent@mokykis.cit.lt`).
2.  **Sign In**: Use `supabase.auth.signInWithPassword` to exchange credentials for a JWT.
3.  **Authorization Header**: Include `Authorization: Bearer <ACCESS_TOKEN>` in all requests.

### Scenario 1: Initial Curriculum Generation

When generating a course from scratch (e.g., parsing a master document or generating from a prompt), the agent should follow this sequence:

1.  **Reset Content**: Clear any existing data to ensure a clean slate.
    - `POST /api/v1/admin/content/reset`
2.  **Create Root Sections (Level 1)**:
    - Iterate through high-level topics.
    - `POST /api/v1/admin/curriculum/nodes` with `level: 1`.
3.  **Create Subsections (Level 2+)**:
    - For each section, create children nodes.
    - `POST /api/v1/admin/curriculum/nodes` with `parentCode: <SECTION_CODE>`.
4.  **Populate Concepts**:
    - For each leaf node, create concepts.
    - `POST /api/v1/admin/concepts`
    - **Crucial**: Ensure `slug` is unique. If a collision occurs (`409 Conflict`), append a suffix (e.g., `-2`, `-v2`) or use the parent code in the slug.

### Scenario 2: Content Refactoring & Enrichment

The agent can analyze existing content and restructure it to improve learning outcomes.

#### Workflow: "Split & Enrich"

_Example: A section is too broad and needs to be broken down._

1.  **Analyze**: Fetch the target node and its children.
    - `GET /api/v1/admin/curriculum/nodes?view=all`
2.  **Plan**: Determine new subsections based on the content density or topic distinctness.
3.  **Create New Structure**:
    - `POST /api/v1/admin/curriculum/nodes` for each new subsection.
4.  **Migrate/Create Content**:
    - **Do not create empty placeholders.**
    - Generate real, context-aware concepts for each new subsection immediately.
    - `POST /api/v1/admin/concepts` with `termLt`, `descriptionLt`, and `isRequired`.
5.  **Cleanup (Optional)**:
    - If moving concepts from an old node, update their `sectionCode` via `PUT /api/v1/admin/concepts/:slug`.
    - Delete the old, now empty, node via `DELETE /api/v1/admin/curriculum/nodes/:code`.

### Best Practices for AI

1.  **Slug Stability**: Slugs are URLs. Try to keep them stable. When refactoring, prefer moving concepts (updating `sectionCode`) over deleting and recreating them, to preserve user progress.
2.  **Real Content Only**: Never leave "TODO" or "Generated by AI" placeholders in `descriptionLt`. If the agent creates a node, it must populate it with at least one valid concept.
3.  **Error Handling**:
    - Handle `409 Conflict` on slugs gracefully.
    - Handle `400 Bad Request` validation errors (e.g., text too long) by truncating or summarizing.
