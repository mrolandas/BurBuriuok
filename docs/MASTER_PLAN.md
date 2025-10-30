# Master Plan

## Vision

Create a focused, Lithuanian-language learning companion that helps aspiring skippers internalise the Lithuanian Sailing Association curriculum, bridges terminology to English equivalents, and keeps learners engaged through structured practice and personal note taking.

## Source Material

- Primary terminology and scope come from `static_info/LBS_programa.md` (Lietuvos Buriavimo Asociacijos Vidaus vandenu jachtos vado mokymo programa, 2024-10-15 redakcija).
- Supplementary insights originate from in-person lectures, course materials, and student notes.

## Target Personas

1. **First-time student** – attends official classes and needs a Lithuanian-first glossary with plain-language explanations and self-check tools.
2. **Returning skipper** – already certified, wants a refresher on selected topics, often from a mobile device.
3. **Instructor** – uses the tool to highlight definitions during class and to monitor common knowledge gaps (later roadmap item).

## Version Roadmap

- **V1 (MVP)** – Supabase-backed content and progress storage (hosted project `zvlziltltbalebqpmuqs`), personal progress tracking, basic quizzes, lightweight note taking stored locally in the browser. No authentication, single-device assumptions, hosted on GitHub Pages.
- **V2** – Supabase-backed storage, optional authentication, AI assistant via Ollama or public models, synchronised notes, richer analytics, offline-friendly packaging, and collaborative image uploads (iki 4 vaizdų vienam naudotojui per sąvoką) su moderuotu bendru vaizdų katalogu.
- **Beyond** – multi-user classroom mode, instructor dashboards, localisation helpers for English-first learners.

## Feature Pillars

- **Curriculum Navigation** – clear section hierarchy for all ten programme sections, with the ability to expand later.
- **Progress Tracking** – persistent Supabase-backed progress with per-device caching in V1, spaced review suggestions in V2.
- **Contextual Notes** – taggable notes using inline `#tag` and `@concept` markers with quick linking back to glossary items.
- **Collaborative Illustrations** – learners can attach up to four photos per concept, curate the strongest visuals, and help administrators publish default imagery over time.
- **Bilingual Terminology** – Lithuanian primary terms, English equivalents, optional pronunciation cues in later releases.
- **Assessments** – flashcards, micro-quizzes, and scenario prompts tailored to the official exam style.
- **Modular Infrastructure** – layered architecture (`frontend/`, `backend/`, `data/`, `content/`, `infra/`) with strict separation of concerns for ease of maintenance and AI-assistant navigation.
- **Community Discussions (V3)** – concept-level threads where authenticated users can post questions/answers, upvote/downvote, embed trusted links, and use limited rich text (basic formatting, emojis).

## Content Development Approach

- Start with Section 1 prototype, validate component structure, then iterate section by section using shared JSON/Markdown data sources.
- Maintain versioned content files so that future database migrations are scripted rather than manual.
- Encourage domain experts to review Lithuanian phrasing before publishing new releases.
- Keep per-module documentation updated (short READMEs) so contributors understand boundaries, responsibilities, and extension points.
- Limit source files to manageable sizes (<200 lines when practical) and use descriptive comments where logic becomes non-obvious.

## Dependencies and Constraints

- Target devices: mobile first (~70 percent usage), tablet (~20 percent), desktop (~10 percent).
- Accessibility: WCAG AA baseline, high-contrast themes for outdoor use.
- Security: minimal in V1 (static hosting with Supabase data access via service layer), plan input validation and rate limiting for V2 APIs.
- Maintain AI coding agent friendliness by providing consistent project structure, explicit interfaces, and up-to-date documentation.
- Community moderation: plan voting/flagging workflows and abuse prevention for V3 discussion features.

## Open Questions

- Exact scope of practical exam guidance (checklist detail vs narrative advice).
- Preferred AI model hosting for V2 (self-hosted Ollama vs cloud inference).
- Requirements for collaborative note sharing and privacy expectations.
- Image moderation workflow and storage cost management once uploads are enabled.
- Moderation tooling and policy for V3 community discussion threads.
- Level of automation needed to keep module scaffolds, seeds, and docs synchronized as features expand.
