# Roadmap

This document outlines current priorities and future plans for the Moxlai platform.

## Current Phase: Foundation

Focus: Transform from sailing-only app to multi-subject learning platform.

## Priority 1: Multi-Subject Architecture

**Goal**: Enable multiple subjects in a single database with proper isolation.

### Tasks

- [ ] Create `subjects` table (id, code, title, slug, metadata)
- [ ] Add `subject_id` foreign key to `curriculum_items`, `concepts`
- [ ] Update AI agent to scope operations to current subject
- [ ] Modify "reset_content" to wipe single subject only
- [ ] Update all repositories to filter by subject
- [ ] Create subject selection UI for admins

### Database Changes

```sql
-- New subjects table
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,      -- e.g., 'LBS', 'FIZ', 'MAT'
  title TEXT NOT NULL,            -- e.g., 'Laivo Buriuotojo Sertifikatas'
  slug TEXT UNIQUE NOT NULL,      -- URL-friendly: 'buriavimas'
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add subject_id to existing tables
ALTER TABLE curriculum_items ADD COLUMN subject_id UUID REFERENCES subjects(id);
ALTER TABLE concepts ADD COLUMN subject_id UUID REFERENCES subjects(id);
```

## Priority 2: Learner Subscriptions

**Goal**: Allow learners to subscribe to specific subjects.

### Tasks

- [ ] Create `learner_subscriptions` table
- [ ] Add subscription management UI for admins
- [ ] Filter curriculum/concepts by subscription in learner views
- [ ] Update progress tracking to scope by subscription

### Database Changes

```sql
CREATE TABLE learner_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) NOT NULL,
  subject_id UUID REFERENCES subjects(id) NOT NULL,
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE(profile_id, subject_id)
);
```

## Priority 3: Dynamic Testing System (High Priority)

**Goal**: Create assessments that work with any subject matter.

### Phase 3a: Structured Tests

- [ ] Create `test_templates` table for reusable test definitions
- [ ] Create `test_questions` table with question types:
  - Multiple choice
  - True/false
  - Matching
- [ ] Create `test_attempts` and `test_answers` tables for tracking
- [ ] Build test-taking UI
- [ ] Auto-generate tests based on curriculum structure

### Phase 3b: AI-Assisted Tests

- [ ] AI-generated questions from concept content
- [ ] Free-text answer grading via AI
- [ ] Scenario-based questions
- [ ] Store AI-generated tests for repeatability

### Phase 3c: Gamified Testing

- [ ] Interactive quiz formats
- [ ] Timed challenges
- [ ] Game-like mechanics (lives, streaks, power-ups)

### Progress Integration

- [ ] Update `learned_concepts` with test-related fields:
  - `times_tested`
  - `times_passed`
  - `last_tested_at`
- [ ] Calculate confidence levels from test history
- [ ] Use progress data to select appropriate questions

## Priority 4: Enhanced Progress Tracking

**Goal**: Better understand and support learner knowledge.

### Tasks

- [ ] Add testing statistics to progress model
- [ ] Implement spaced repetition suggestions
- [ ] Create progress dashboard for learners
- [ ] Admin analytics for subject performance

## Future: Platform Expansion

### Subject Management

- [ ] Subject manager role (between admin and contributor)
- [ ] Per-subject AI agent access
- [ ] Subject-specific configuration

### Content Sources

- [ ] File upload for curriculum import (PDF, DOCX)
- [ ] Web scraping for reference material
- [ ] AI-assisted content extraction

### Deployment

- [ ] Migrate to `moxlai.lt` domain
- [ ] Subject subpaths: `moxlai.lt/buriavimas`
- [ ] Consider subdomain alternative: `buriavimas.moxlai.lt`

### Media Enhancements

- [ ] AI-generated images/diagrams
- [ ] Auto-generated flashcard images
- [ ] Video chapter markers

---

## Completed Features

### Learner Experience

- ✅ Section board homepage
- ✅ Curriculum tree navigation
- ✅ Concept detail pages
- ✅ Global search
- ✅ Magic-link authentication
- ✅ Theme selection
- ✅ Progress tracking (moku concepts)

### Admin Experience

- ✅ Admin dashboard with guards
- ✅ Concept manager (CRUD)
- ✅ Curriculum tree editor
- ✅ Media library
- ✅ User management (partial)
- ✅ AI curriculum builder
- ✅ System settings

### Infrastructure

- ✅ GitHub Pages frontend deployment
- ✅ Render.com backend deployment
- ✅ Supabase database and auth
- ✅ Content versioning and audit trail
- ✅ Rate limiting

---

## Out of Scope (Removed)

These features were considered but removed from active development:

| Feature              | Reason              | Revival Condition        |
| -------------------- | ------------------- | ------------------------ |
| Study Queue          | Needs auth progress | After subscription model |
| Contributor Uploads  | Moderation overhead | Needs moderation system  |
| Social Features      | Beyond MVP          | Phase 4+                 |
| Complex Gamification | Resource intensive  | After basic testing      |

---

## Maintenance

- **Last verified**: 2025-12-10
- **Update when**: Priorities change, features complete, or new requirements emerge
- **Related docs**: [Architecture](architecture/OVERVIEW.md), feature-specific docs
