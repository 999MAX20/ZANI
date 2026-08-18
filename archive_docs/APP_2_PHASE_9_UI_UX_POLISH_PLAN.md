# ZANI App 2.0 Phase 9: UI/UX Polish And Interaction QA

Date: 2026-07-21
Status: Active autonomous execution checklist
Scope: authenticated `/app` only

This document tracks the post-cutover UI/UX polish pass after the App 2.0 foundation, AppShell, WorkbenchLayout, Entity Experience and primary workbench phases.

The goal is not another redesign from scratch. The goal is to remove the remaining visual and interaction debt that prevents the CRM from feeling like a polished, expensive, production SaaS.

## Direction

Use the current ZANI visual source of truth:

- `docs/design-system.md`
- `docs/WARM_PREMIUM_CRM_REDESIGN_BRIEF.md`
- `actual_docs/APP_2_WORKBENCH_EXECUTION_ROADMAP.md`
- `plan/ui_ux_design_system_reform.md`

Visual direction:

```text
Warm Premium CRM
Warm ivory workspace + saturated orange actions + plum AI accent
```

## Execution Rules

- Work only inside authenticated `/app` surfaces unless a shared component is used by `/app`.
- Do not change CRM backend business logic.
- Do not introduce page-local visual systems when a shared primitive or token can solve the problem.
- Keep primary CRM actions orange, AI actions plum/violet and status colors semantic.
- Do not mark a checkbox complete until implementation and the listed verification are both done.
- After finishing one checked item, continue directly to the next unchecked item.

## Phase 9 Checklist

### 9.1 Visual QA Tooling

Goal: make the visual QA pass repeatable instead of relying on one-off Playwright snippets.

Tasks:

- [x] Add a real `npm run audit:visual` implementation for authenticated `/app` routes.
- [x] Capture desktop screenshots for primary `/app` routes.
- [x] Capture structured JSON with horizontal overflow, transparent surface issues and primary button color usage.
- [x] Make the audit tolerant of intentionally transparent inputs, overlays and embedded table rows.
- [x] Document the output path and known local auth/test caveats.

Verification:

- `cd frontend && npm run audit:visual`
- `git diff --check -- frontend/scripts/visual-audit.mjs actual_docs/APP_2_PHASE_9_UI_UX_POLISH_PLAN.md`

### 9.2 Shared Surface And Typography Polish

Goal: remove visible old-style residue from shared `/app` components that affects many pages.

Tasks:

- [x] Replace old `slate`, `midnight`, `font-black`, glass and oversized-radius classes in shared app UI components where they affect `/app`.
- [x] Align shared empty/error/forbidden states with Warm Premium tokens.
- [x] Align shared AI hint/navigator surfaces with the AI plum system without decorative glass styling.
- [x] Align shared pagination and language/control primitives with Warm Premium surfaces.
- [x] Keep platform/admin-only styling out of scope unless the shared component leaks into `/app`.

Verification:

- targeted `rg` check for old shared `/app` residue.
- `cd frontend && npm run build`

### 9.3 Legacy Drawer And Fallback Detail Polish

Goal: make transitional drawers and old fallback detail surfaces visually compatible with App 2.0 until they are fully retired.

Tasks:

- [x] Align CRM drawer shell/header/tabs with Warm Premium drawer surfaces.
- [x] Align CRM drawer shared cards, timeline and detail panels with Warm Premium tokens.
- [x] Align task drawer fallback surfaces enough that it does not look like the old product when opened.
- [x] Keep the new full workspace routes as the primary deep-work path.

Verification:

- targeted `rg` check for old drawer/fallback residue.
- `cd frontend && npm run build`

### 9.4 Forms, Inline Calendars And Secondary Operational Components

Goal: remove old visual residue from secondary `/app` forms and simple operational components that still appear in modals or setup flows.

Tasks:

- [x] Align service/resource/working-hours form hint panels and checkbox rows with shared tokens.
- [x] Align `SimpleCalendar` with the calendar workbench visual system.
- [x] Check long Russian labels in these secondary components for truncation/spacing.

Verification:

- targeted `rg` check for form/calendar residue.
- `cd frontend && npm run build`

### 9.5 Page-Level Density And Hierarchy Pass

Goal: improve the remaining premium SaaS feeling on pages that are visually unified but still too dense or too flat.

Tasks:

- [x] Dashboard: reduce equal-weight card noise and make urgent daily work easier to scan.
- [x] Tasks: reduce competing visual weight between metrics, workload, table and inspector.
- [x] Conversations: reduce right context rail nesting and make primary operator actions clearer.
- [x] Integrations: remove internal-roadmap feeling and emphasize provider status plus next action.
- [x] Settings: reduce the feeling of one long form by improving section rhythm where safe.
- [x] Deals: confirm kanban plus inspector density remains usable on desktop.

Verification:

- `cd frontend && npm run audit:visual`
- desktop screenshot review for changed routes.
- `cd frontend && npm run build`

### 9.6 Deep Link And Auth Guard QA

Goal: verify that production users can deep-link into primary `/app` workspaces without getting dropped into a confusing login loop.

Tasks:

- [x] Reproduce direct route navigation for dashboard, leads, deals, clients, tasks, calendar, conversations, integrations, analytics and settings.
- [x] Identify whether any `/login` redirect is a real route/auth bug or a local Playwright token-refresh caveat.
- [x] Fix frontend route/auth handling only if the issue is in the frontend.
- [x] Document backend/test-environment blockers separately if the issue is not frontend-owned.

Verification:

- `cd frontend && npm run audit:visual`
- targeted Playwright route smoke if needed.
- `cd frontend && npm run build`

### 9.7 Final Phase 9 Cutover QA

Goal: close the polish phase with evidence.

Tasks:

- [x] Run final visual audit.
- [x] Run frontend production build.
- [x] Run bundle check.
- [x] Update this document with completed checkboxes and verification notes.
- [x] Record remaining risks that should move into a future Phase 10 rather than hiding them.

Verification:

- `git diff --check`
- `cd frontend && npm run audit:visual`
- `cd frontend && npm run build`
- `cd frontend && npm run check:bundle`

## Checkpoint Log

Add dated entries here as each item is completed.

### 2026-07-21: 9.1 Visual QA Tooling Completed

Implemented `frontend/scripts/visual-audit.mjs` and connected the existing `npm run audit:visual` script to a real authenticated visual QA pass.

The audit now writes route screenshots and JSON under:

```text
output/playwright/visual-audit-<timestamp>/
```

Latest verified output:

```text
output/playwright/visual-audit-2026-07-21T18-59-11/
```

Verification:

- `cd frontend && npm run audit:visual`: passed.

Known caveat moved to 9.6:

- `/app/deals` can intermittently report `authRedirected: true` in the audit while other authenticated routes restore normally. This is tracked as a deep-link/auth guard QA item, not as a visual tooling failure.

### 2026-07-21: 9.2 Shared Surface And Typography Polish Completed

Aligned high-impact shared `/app` UI components with Warm Premium tokens:

- shared loading, empty, error and forbidden states;
- shared primitives, metric cards, page headers, dialogs and app/route error boundaries;
- AI hint and AI navigator surfaces;
- CRM pagination and language selector;
- action confirmation dialog body/error text.

Verification:

- targeted `rg` check for old shared `/app` residue: no matches in the scoped shared group.
- `cd frontend && npm run build`: passed; i18n parity OK with 4445 keys across RU, KK and EN.

### 2026-07-21: 9.3 Legacy Drawer And Fallback Detail Polish Completed

Aligned transitional CRM drawer and fallback detail surfaces with the same Warm Premium surface system used by App 2.0 workbench pages:

- CRM drawer shell, header and tab states;
- drawer shared cards, timeline entries and detail panels;
- old CRM inspector/fallback surfaces;
- task drawer fallback surfaces.

Verification:

- targeted `rg` check for old drawer/fallback residue: no matches in the scoped drawer/detail group.
- `cd frontend && npm run build`: passed; i18n parity OK with 4445 keys across RU, KK and EN.

### 2026-07-21: 9.4 Forms, Inline Calendars And Secondary Operational Components Completed

Aligned secondary `/app` form and inline calendar surfaces with shared Warm Premium tokens:

- service/resource/working-hours hint panels and checkbox rows;
- appointment, lead and client form warning/error surfaces;
- appointment reschedule current-time notice;
- `SimpleCalendar` shell, rows and appointment cards.

Verification:

- targeted `rg` check for old form/calendar residue: no matches in the scoped forms/calendar group.
- `cd frontend && npm run build`: passed; i18n parity OK with 4445 keys across RU, KK and EN.

### 2026-07-22: 9.5 Page-Level Density And Hierarchy Pass Completed

Aligned remaining high-impact page-level surfaces with the Warm Premium CRM system:

- dashboard warning and secondary KPI surfaces;
- tasks metrics, workload panel, table rows and inspector weight;
- conversations list/detail/context rail density;
- integrations provider cards and import/status panels;
- settings section rhythm and semantic warning/success surfaces;
- CRM workspace shell and deals kanban desktop density.

Latest verified output:

```text
output/playwright/visual-audit-2026-07-22T05-11-01/
```

Verification:

- targeted `rg` check for old page-level visual residue: no matches in the scoped page group.
- `cd frontend && npm run audit:visual`: passed; all audited routes had `authRedirected: false`, `horizontalOverflow: 0` and `transparentSurfaceIssues: 0`.
- `cd frontend && npm run build`: passed; i18n parity OK with 4445 keys across RU, KK and EN.

### 2026-07-22: 9.6 Deep Link And Auth Guard QA Completed

Reworked `frontend/scripts/visual-audit.mjs` so direct-route QA is stable and evidence-backed:

- the audit starts local Django/Vite when needed;
- each route opens in a fresh authenticated browser context;
- direct links are treated as failures if they land on `/login`;
- the audit records API issues in route JSON;
- Playwright injects owner Authorization headers for real API calls, matching the existing e2e smoke pattern.

The frontend route/auth guard itself did not require a product-code fix. The failing redirects were traced to a local SQLite test-environment blocker: `apps.businesses.access.ensure_owner_memberships_for_user()` could write during `/api/auth/me/`, and repeated browser route checks could hit `django.db.utils.OperationalError: database is locked`. This blocker was fixed after Phase 9 by making the owner-membership repair helper skip valid memberships without writing.

Verification:

- `cd frontend && npm run audit:visual`: passed; dashboard, leads, deals, clients, tasks, calendar day/month, conversations, outreach, AI agents, integrations, analytics and settings all stayed inside `/app`.
- `cd frontend && npm run build`: passed; i18n parity OK with 4445 keys across RU, KK and EN.

### 2026-07-22: 9.7 Final Phase 9 Cutover QA Completed

Closed Phase 9 with the final polish gate.

Latest final visual audit output:

```text
output/playwright/visual-audit-2026-07-22T05-13-54/
```

Verification:

- `git diff --check`: passed.
- `cd frontend && npm run audit:visual`: passed; all audited `/app` routes stayed authenticated, had `horizontalOverflow: 0`, `transparentSurfaceIssues: 0`, `apiIssues: 0` and `authApiIssues: 0`.
- `cd frontend && npm run build`: passed; i18n parity OK with 4445 keys across RU, KK and EN.
- `cd frontend && npm run check:bundle`: passed; no JS chunks exceed 500 kB before gzip.

Remaining risks for a future phase:

- Phase 9 verifies desktop screenshots and direct workbench routes. Mobile visual polish and deeper click-through interaction QA should become a separate Phase 10 if needed.

### 2026-07-22: Post-Phase 9 Auth Read-Path Stability Fix

Resolved the local visual/e2e blocker recorded during Phase 9:

- `apps.businesses.access.ensure_owner_memberships_for_user()` no longer rewrites a valid active owner membership on every `/api/auth/me/` read.
- The helper still creates missing owner memberships and repairs wrong/inactive owner memberships.
- `frontend/scripts/visual-audit.mjs` no longer needs to cache `/api/auth/me/`; it validates routes against the real backend current-user endpoint.

Verification:

- focused auth/access regression tests for `/api/auth/me/`: passed.
- `apps.businesses.tests_access`: passed.
- `manage.py check`: passed.
- `manage.py makemigrations --check --dry-run`: passed.
- `cd frontend && npm run audit:visual`: passed with real `/api/auth/me/`, `apiIssues: 0` and `authMeServerErrors: 0` on all audited routes.
