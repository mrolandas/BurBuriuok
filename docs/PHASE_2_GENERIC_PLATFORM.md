# Phase 2: Generic Learning Platform (`mokslai.cit.lt`)

## Vision

Transform the specialized "Buriavimas" application into a generic, AI-driven learning engine hosted at `mokslai.cit.lt`. The platform will support multiple subjects (tenants) simultaneously, with content generated and managed by AI agents.

## 1. Architecture & Multi-Tenancy

### Domain Structure

- **Primary Domain**: `mokslai.cit.lt` (Landing page, directory of courses).
- **Tenant Subdomains**:
  - `buriavimas.mokslai.cit.lt`
  - `fizika.mokslai.cit.lt`
  - `istorija.mokslai.cit.lt`
- **Admin Portal**: `admin.mokslai.cit.lt` (or `mokslai.cit.lt/admin`).

### Database Strategy

- **Single Database, Logical Isolation**:
  - Add `tenant_id` (or `app_id`) column to all major tables (`curriculum_nodes`, `concepts`, `media_assets`, `profiles`).
  - Use Supabase RLS (Row Level Security) to enforce tenant isolation based on the request origin or user context.
  - **Alternative (Simpler for Phase 2)**:
    - Keep the current schema but treat the entire DB as _one_ course for now, and deploy separate Supabase projects for different subjects.
    - _Decision_: For the immediate "Phase 2", we will likely stick to **one instance per subject** to avoid massive refactoring, but build the _codebase_ to be configurable.

## 2. AI Agent Integration

### The "God Mode" Admin

An autonomous agent (likely running as a background worker or triggered via a CLI/Admin UI) will act as the primary content creator.

- **Input**: A "Master Document" (PDF, Markdown) or a "Master Prompt" (e.g., "Create a high-school physics curriculum based on the Lithuanian national standard").
- **Process**:
  1.  **Analysis**: Agent parses the input.
  2.  **Structure**: Agent calls `POST /curriculum/nodes` to build the tree.
  3.  **Content**: Agent calls `POST /concepts` to fill in the details.
  4.  **Review**: Human admin reviews the generated structure on the frontend.

### Agent Implementation

- **Tech Stack**: Node.js / Python script using OpenAI API (or Anthropic).
- **Interface**:
  - Initially: A CLI tool (`npm run agent:generate -- --topic="Physics"`).
  - Later: A web UI in the Admin Dashboard.

## 3. Frontend Adaptation

### Dynamic Configuration

The frontend must stop hardcoding "Buriavimas" specific strings and colors.

- **Config Store**: A Svelte store that fetches configuration on initialization.
  - `appTitle`: "Buriavimas" vs "Fizika".
  - `themeColor`: Blue vs Green.
  - `logoUrl`: URL to the subject icon.
- **Routing**:
  - Middleware to detect the hostname (`window.location.hostname`).
  - Fetch the appropriate config based on the hostname (if using multi-tenant DB) or just load from `settings` table (if using single-tenant DB).

## 4. Infrastructure & Deployment

### DNS

- `*.mokslai.cit.lt` CNAME record pointing to the Vercel/Netlify deployment.

### Authentication

- **Admin**: `info@cit.lt` (Global Admin).
- **AI Agent**: Uses a dedicated API Key or a service account with Admin privileges.

## Implementation Roadmap

### Step 1: Generalize the Codebase

- [ ] Refactor `frontend/src/lib/config.ts` to load values from the backend API (`/api/v1/settings/global`) instead of hardcoded constants.
- [ ] Update UI components to use these dynamic values (Header, Footer, Meta tags).

### Step 2: AI Agent Prototype

- [ ] Create a standalone script (e.g., `agent/index.ts`) that:
  - Takes a topic string.
  - Generates a curriculum tree using an LLM.
  - Calls the App Configuration API to persist it.
- [ ] Test with a new subject (e.g., "Kelių Eismo Taisyklės").

### Step 3: Production Deployment

- [ ] Set up `mokslai.cit.lt`.
- [ ] Deploy the generalized frontend.
- [ ] Run the AI agent to populate the initial "Buriavimas" content (or migrate existing data).
