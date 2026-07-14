---
name: zani-review-frontend
description: Implement or review authenticated ZANI React UI for real business data, shared design-system patterns, API-layer separation, role-aware workflows, accessibility, responsive behavior, i18n, and complete loading, error, empty, and forbidden states. Use for frontend/src pages, components, API clients, hooks, navigation, dashboards, CRM drawers, forms, tables, or frontend tests.
---

# Review ZANI Frontend

## Workflow

1. Read `AGENTS.md`, `docs/design-system.md`, `plan/ui_ux_design_system_reform.md`, the affected page/API client, and relevant permission/domain docs.
2. Identify the user's role, job, primary action, real data source, and required states before changing layout.
3. Search shared components, types, API clients, hooks, and i18n keys before creating new ones.
4. Put network calls in `frontend/src/api/*`; keep components focused on interaction and rendering. Avoid `any` unless justified.
5. Make every visible authenticated block serve navigation, real data/KPI, action, form, entity view, analytics, status, alert, or a real next-step empty state. Remove invented demo, marketing, and explanatory copy.
6. Treat frontend role hiding as UX only; preserve backend enforcement and handle forbidden responses.
7. Implement loading, error, empty, forbidden, success, and disabled states as applicable. Check keyboard use, labels, focus, contrast, and desktop/mobile behavior.
8. Source visible text from existing i18n/constants or approved task copy; update supported locales consistently.
9. Add or update focused component/E2E coverage and run the frontend build through `$zani-run-verification`.

Read [references/frontend-checklist.md](references/frontend-checklist.md) before finishing.

## Output Contract

Report the user workflow, data/API connection, permission behavior, states, responsive/accessibility impact, i18n impact, and exact checks.
