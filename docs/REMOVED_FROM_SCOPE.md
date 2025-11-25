# Removed From Scope (2025-11-25)

These items were part of the earlier roadmap but have been pulled from the active plan so the team can focus on authentication, admin user management, and progress tracking. Revisit this list during future planning cycles if priorities shift.

| Item | Original Reference | Rationale for Removal | Notes for Potential Revival |
| --- | --- | --- | --- |
| LX-004 – Study Queue Manager | Issue Tracker (Learner Experience) | Requires persistent authenticated progress data that is not yet available; reintroduce after PROG-002 lands. | Re-scope around the new progress store and consider smaller milestones (e.g., “recently studied” feed). |
| LX-005 – Study Session Runner | Issue Tracker (Learner Experience) | Depends on queue infrastructure and analytics events now deprioritised. | Prototype once queue fundamentals return; consider mobile-only MVP. |
| LX-006 – Quiz Module Foundation | Issue Tracker (Learner Experience) | Requires content authoring capacity and analytics pipeline not on the current critical path. | Keep discovery notes in `docs/references/features/ideas/QUIZ.md`. |
| ADM-003 – Moderation Queue List | Issue Tracker (Admin & Moderation) | Contributor media submissions postponed; queue UI would sit idle. | Reinstate alongside MEDIA-003 when contributor uploads resume. |
| ADM-004 – Moderation Notification Stubs | Issue Tracker (Admin & Moderation) | Downstream of ADM-003; no moderation events to notify against. | Bundle with ADM-003 revival or future moderation automation work. |
| ADM-005 – Admin Analytics Event Mapping | Issue Tracker (Admin & Moderation) | Media analytics deprioritised; focus shifts to auth/progress telemetry first. | Revisit after PROG-003 establishes baseline analytics requirements. |
| MEDIA-003 – Contributor Upload UX | Issue Tracker (Media) | Admin-only media meets MVP; contributor flows create additional moderation overhead. | Requires moderation queue + policy review before revival. |
| MEDIA-004 – Admin Moderation Queue Upgrade | Issue Tracker (Media) | Same dependency as MEDIA-003; no contributor submissions to moderate. | Combine with ADM-003/ADM-004 if contributor scope returns. |
| MEDIA-005 – Learner Embed Rendering | Issue Tracker (Media) | Learner experience work paused until auth/progress complete. | Keep schema ideas in `SCHEMA_DECISIONS.md` appendix for future embeds. |
| DB-003 – Media Moderation Flow | Issue Tracker (Data & Backend) | Supports contributor moderation, currently out of scope. | Restart alongside MEDIA-003/ADM-003. |
| Guided Study & Practice Features | Master Plan (Guided Study, Engagement sections) | Dependent on queue/quizzes and analytics; deprioritised to reduce surface area. | See `docs/references/features/ideas/STUDY_PATHS.md` for future exploration. |
| Engagement & Gamification Layer | Master Plan (Phase 3) | Requires telemetry and sustained product iteration beyond MVP priorities. | Retain ideation in `docs/references/features/ideas/GAMIFICATION_MODEL.md`. |
