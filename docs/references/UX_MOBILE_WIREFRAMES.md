# Mobile UX Wireframe Notes

High-level prototypes for the learner-facing experience. These descriptions serve as guidance until Figma mocks are produced.

## 1. Home (Curriculum Boards)

- **Header**: Greeting (`Sveikas, vardas`) + current streak badge.
- **Study Prompt Card**: "Continue: Navigacija" with progress bar and CTA button.
- **Section Grid** (2-column cards on mobile):
  - Card: title (e.g., "1. Jachtos konstrukcija"), hours, completion %, status chips (e.g., `5 naujų`).
  - Tap opens section tree modal (see below).
- **Quick Actions**: Horizontal chips for `Paieška`, `Studijų planas`, `Peržiūrėti pažangą`.
- **Footer Nav**: `Namai`, `Paieška`, `Praktika`, `Profilis`.

## 2. Section Tree Modal

- Full-screen sheet with swipe-down dismissal.
- Top search to filter nodes by title/code.
- Indented list using collapsible accordions. Each node row:
  - Title + ordinal, dependency badge (e.g., `Reikia: 1.1a`).
  - Progress indicator dot (blank, half, full).
  - Tap loads concept list overlay.
- Bottom CTA: `Pridėti prie studijų plano` (adds entire node subtree).
- Dependency Drawer: long-press opens slide-in panel showing "Reikalinga prieš" and "Atsidaro po", with quick links to review.

## 3. Concept Detail

- **Hero**: Term LT, micro text EN translation, required badge if relevant.
- **Tabs**: `Aprašas`, `Žinios patikrinimas`, `Diskusijos (vėliau)`.
- **Prerequisite Drawer**: Inline chips referencing required concepts. Tapping opens slide-up card with summary & quick mark as known.
- **Body**: Lithuanian description paragraphs, bullet list from curriculum items, optional diagrams (carousel).
- **Actions**: Buttons for `Pažymėti kaip žinoma`, `Įtraukti į studijų planą`, `Pridėti pastabą`.
- **Next Concepts**: Scrollable cards with relationship context (e.g., `Sekantis: 1.2.3 Takelažas`).

## 4. Search Results

- Search bar (with microphone icon for voice later). Recent queries shown when empty.
- Tabs across top: `Sąvokos`, `Temos`, `Media`.
- Results show highlight matches, icons for type, quick-add to study queue.
- Sticky filter drawer for `Tik privalomos`, `Su media`, `Su problemomis`.

## 5. Study Plan Runner

- Wizard page with progress indicator (steps completed / total).
- For each concept:
  - Summary, key points, quick quiz question inline.
  - Buttons: `Supratau`, `Reikia kartoti` toggling spaced repetition weight.
- Intermissions after each module offering break tips.
- Completion modal with XP earned, suggested next path.

## 6. Practice (Quiz Hub)

- Cards for `Flashcards`, `Micro testas`, `Termino vertimas`.
- "Recommended" section based on weak areas.
- History list with last score, retry CTA.

## 7. Profile & Progress

- Top: Avatar, streak, badges slider.
- Progress donut per major topic.
- Study queue list with reordering (drag handle).
- Section for completed study paths with revisit buttons.
- Settings quick links (language toggles, data reset, exports).

## Wireframe Conventions

- Buttons primary color: nautical blue (#1E3A8A). Secondary: light grey (#E5E7EB).
- Typography: Large title 24px, body 16px, micro labels 12px.
- Mobile safe area padding 16px; inter-card spacing 12px.
- Use skeleton loaders for lists to smooth transitions.
- Dependency surfaces: badges + drawers should reuse the same iconography (`↗` for prerequisites, `⇢` for next steps) across screens to build recognition.

These notes feed future Figma work; update this document as the UX evolves.
