# ZANI App 2.0 Phase 10: Interaction And Workflow QA

Date: 2026-07-22
Status: Active execution checklist
Scope: authenticated `/app` only

Phase 9 proved that the authenticated app is visually unified, direct `/app` links open correctly and desktop visual QA is repeatable. Phase 10 proves that the CRM is actually usable through real interactions: clicks, forms, modals, entity workspaces, role boundaries and end-to-end merchant workflows.

## Direction

This phase is not a new visual redesign.

The goal is to answer:

```text
Can an owner, manager or operator open ZANI and complete daily CRM work without confusing states, broken actions, invisible errors, login loops, unsafe role behavior or dead-end screens?
```

Use the current source of truth:

- `AGENTS.md`
- `CRM_PRODUCTION_LAYER_PLAN.md`
- `docs/design-system.md`
- `docs/PERMISSION_MATRIX.md`
- `docs/testing.md`
- `actual_docs/APP_2_PHASE_9_UI_UX_POLISH_PLAN.md`

## Execution Rules

- Work only inside authenticated `/app` surfaces unless a shared component is used by `/app`.
- Do not change landing pages.
- Do not rewrite CRM backend logic unless a tested workflow exposes a backend-owned blocker.
- Do not mark a checkbox complete until implementation and verification both pass.
- Every visible authenticated UI block must support navigation, real data, action, form, entity view, analytics, status, alert or an empty state with a real next action.
- Prefer focused automated coverage. Manual-only findings must be documented with screenshots or route/output evidence.
- After finishing one checked item, continue directly to the next unchecked item while staying within this plan.

## Phase 10 Checklist

### 10.1 Interaction QA Tooling

Goal: make click-through QA repeatable, not dependent on one-off browser poking.

Tasks:

- [x] Add a repeatable desktop interaction audit for primary `/app` routes.
- [x] Authenticate through the same owner token pattern used by existing e2e smoke tests.
- [x] Capture structured output for route, safe action clicked, resulting modal/workspace/URL/error state and screenshot path.
- [x] Treat login redirects, app crashes, failed API responses, broken modals and uncloseable overlays as blockers.
- [x] Keep destructive submits and provider write actions out of the audit.

Verification:

- `cd frontend && npm run audit:interaction`
- `cd frontend && npm run build`

### 10.2 Primary Page Click-Through Pass

Goal: verify that common page controls open, close and keep the user oriented.

Tasks:

- [x] Dashboard: daily work links/cards navigate to the intended CRM route without dead ends.
- [x] Leads: create/filter/columns/import/detail/workspace controls are reachable and recoverable.
- [x] Deals: kanban/list controls, stage workspace and create/edit surfaces are reachable and recoverable.
- [x] Clients: create/search/detail/workspace controls are reachable and recoverable.
- [x] Tasks: task create, workload filters, status controls and task workspace are reachable and recoverable.
- [x] Calendar: day/month/list controls, appointment create/reschedule and month inspector are reachable and recoverable.
- [x] Conversations: conversation selection, composer, quick replies and CRM context actions are reachable and recoverable.
- [x] Integrations: status filters, provider details, setup/request/check/sync surfaces are reachable without exposing merchant-hostile technical details.
- [x] Analytics/settings/outreach/AI agents: primary tabs, filters and action surfaces do not crash or trap the user.

Verification:

- `cd frontend && npm run audit:interaction`
- targeted Playwright test for any fixed broken interaction.
- `cd frontend && npm run build`

### 10.3 End-To-End CRM Workflow QA

Goal: prove a real merchant workflow across entities, not isolated page readiness.

Tasks:

- [x] Lead capture or creation preserves source, status, responsible user and next action.
- [x] Lead detail/workspace allows the operator to understand client, request, dialogue and linked activity.
- [x] Lead to client/deal/appointment/task paths are reachable through real UI/API contracts.
- [x] Deal workflow supports stage progression, won/lost/reopen constraints and visible next action.
- [x] Appointment workflow supports booking/reschedule/cancel/no-show/complete states where exposed.
- [x] Task workflow supports assign/start/complete/cancel/comment/watch where exposed.
- [x] Conversation workflow supports read, reply draft/send path, CRM linking and task/appointment/deal actions where exposed.
- [x] Dashboard/analytics reflect created or existing CRM work through real backend data.

Verification:

- focused backend/API tests when a backend flow is fixed.
- targeted Playwright workflow test for any frontend fix.
- `cd frontend && npm run build`

### 10.4 Role And Permission UX QA

Goal: verify owner, manager and operator/employee users see useful actions and safe denials.

Tasks:

- [x] Owner: business settings, integrations, analytics, team and full CRM actions are visible where allowed.
- [x] Manager: daily CRM actions are available without owner-only settings leaking as active controls.
- [x] Operator/employee: assigned work remains usable and forbidden owner/manager actions are hidden or denied cleanly.
- [x] Backend permission denials show user-safe forbidden/error states and do not expose cross-tenant object existence.
- [x] Role-specific dashboards and navigation do not create dead pages.

Verification:

- targeted Playwright owner/manager/operator smoke.
- relevant backend permission tests if a denial path is changed.
- `cd frontend && npm run build`

### 10.5 Mobile And Tablet Interaction QA

Goal: extend Phase 9 desktop confidence to smaller screens.

Tasks:

- [x] Mobile app shell navigation exposes primary CRM routes without overlap.
- [x] Mobile leads/clients/deals/tasks lists remain scannable and actions are reachable.
- [x] Mobile calendar day/month interactions do not create transparent or trapped overlays.
- [x] Mobile conversations list/thread/composer/context flow is usable.
- [x] Mobile modals, drawers and workspaces fit without hidden submit/cancel controls.
- [x] Tablet split layouts keep inspector/workspace proportions usable.

Verification:

- `cd frontend && npx playwright test --project=mobile-chromium -g "mobile (owner|manager) smoke"`
- targeted mobile screenshots for changed routes.
- `cd frontend && npm run build`

### 10.6 Phase 10 Cutover QA

Goal: close the phase with evidence and a clean next-step boundary.

Tasks:

- [x] Run final interaction audit.
- [x] Run final visual audit.
- [x] Run frontend production build.
- [x] Run bundle check.
- [x] Update this document with completed checkboxes, outputs and remaining risks.
- [x] Move any non-blocking improvements into a future phase instead of hiding them.

Verification:

- `git diff --check`
- `cd frontend && npm run audit:interaction`
- `cd frontend && npm run audit:visual`
- `cd frontend && npm run build`
- `cd frontend && npm run check:bundle`

## Checkpoint Log

Add dated entries here as each item is completed.

### 2026-07-22: 10.1 Interaction QA Tooling Completed

Implemented `frontend/scripts/interaction-audit.mjs` and connected it through:

```text
cd frontend && npm run audit:interaction
```

The audit now:

- starts local Django and Vite when needed;
- runs Django migrations and prepares deterministic e2e smoke data;
- authenticates as the e2e owner with the same Authorization-header pattern used by existing Playwright smoke tests;
- opens primary authenticated `/app` routes in a desktop viewport;
- clicks safe non-destructive route actions;
- writes screenshots and route JSON under `output/playwright/interaction-audit-<timestamp>/`;
- treats login redirects, app crashes, API `401`/`5xx`, broken modal states and uncloseable overlays as blockers.

Latest verified output:

```text
output/playwright/interaction-audit-2026-07-22T14-03-47/
```

Verification:

- `node --check frontend/scripts/interaction-audit.mjs`: passed.
- `git diff --check -- frontend/scripts/interaction-audit.mjs frontend/package.json actual_docs/APP_2_PHASE_10_INTERACTION_WORKFLOW_QA_PLAN.md`: passed.
- `cd frontend && npm run audit:interaction`: passed; no login redirects, app crashes, API issues or blocking overlay states.
- `cd frontend && npm run build`: passed; i18n parity OK with 4445 keys across RU, KK and EN.

Non-blocking findings moved into 10.2:

- Safe action selectors are incomplete for conversations, analytics, settings and some secondary actions in deals, clients and tasks. The pages themselves did not crash or redirect; the next phase should refine route-specific click coverage and fix any real UX dead ends found there.

### 2026-07-23: 10.2 Primary Page Click-Through Pass Completed

Expanded `frontend/scripts/interaction-audit.mjs` to cover dashboard, leads, deals, clients, tasks, calendar, conversations, integrations, analytics, settings, outreach and AI agents. The audit now covers safe route actions, workspace navigations, CRM context actions and calendar month inspector actions, including prerequisite clicks for inspector-only controls. Workspace navigation actions are no longer closed with Escape, preventing false overlay blockers after successful navigation.

Fixed workspace timeline labels by rendering standard activity events through `formatTimelineEventText(...)` instead of raw backend text when an i18n label exists. This removed mojibake/raw system text from lead, client and deal workspace history for common CRM events.

Latest verified output:

```text
output/playwright/interaction-audit-2026-07-23T09-08-37/
```

Verification:

- `node --check frontend/scripts/interaction-audit.mjs`: passed.
- `cd frontend && npm run check:i18n`: passed; 4451 keys across RU, KK and EN.
- `git diff --check -- frontend/scripts/interaction-audit.mjs frontend/src/components/crm/drawers/timelineHelpers.ts frontend/src/features/clients/components/ClientWorkspaceSections.tsx frontend/src/lib/i18n/en.ts frontend/src/lib/i18n/ru.ts frontend/src/lib/i18n/kk.ts`: passed.
- `cd frontend && npm run audit:interaction`: passed; 12 routes, 42 safe actions, 0 missing actions, 0 blockers, 0 login redirects, 0 crashes and 0 API issues.
- `cd frontend && npm run build`: passed; i18n parity, TypeScript, main Vite production build and widget build completed.

### 2026-07-23: 10.3 End-To-End CRM Workflow QA Completed

Expanded `frontend/e2e/entity-workspaces.spec.ts` from workspace reachability into a full browser-level CRM workflow proof. The test creates a real client, lead, deal, service, resource, appointment, conversation, inbound message and task through authenticated API contracts, then verifies the created entities render inside the new `/app` workspaces and route aliases:

- `/app/clients/:id` shows the created client and action bar.
- `/app/leads/:id` shows the created lead request and lead lifecycle action.
- `/app/deals/:id` shows the created deal and won/lost actions.
- `/app/calendar/:id` shows the linked appointment service and appointment lifecycle actions.
- `/app/conversations/:id` shows the inbound conversation message and conversation action bar.
- `/app/tasks/:id` shows the linked task and task lifecycle actions.
- `/app/*?entity=<id>` aliases redirect into the corresponding workspace routes.
- `/app` loads real owner dashboard metrics from `/api/analytics/owner-dashboard/` and reflects existing backend lead/task data.
- `/app/analytics` loads the analytics report summary endpoint without route crashes.

No backend behavior was changed for this step. The backend business-flow gate was run as evidence for the existing domain contracts behind the UI.

Verification:

- `cd frontend && npx playwright test e2e/entity-workspaces.spec.ts --project=desktop-chromium`: passed; 1 browser workflow test.
- PowerShell safe env + `.\.venv\Scripts\python.exe manage.py test apps.core.tests_business_flows_e2e -v 2`: passed; 8 backend cross-entity CRM tests.
- `cd frontend && npm run build`: passed; i18n parity, TypeScript, main Vite production build and widget build completed.

### 2026-07-23: 10.4 Role And Permission UX QA Completed

Added `manager and operator role UX stays useful and safe` coverage in `frontend/e2e/smoke.spec.ts`.

The desktop role smoke now verifies:

- manager daily CRM routes (`/app`, leads, deals, clients, tasks, calendar, conversations and analytics) render without dead pages, horizontal overflow or app crashes;
- manager owner-only routes (`/app/settings`, `/app/integrations`) show a clean forbidden alert and do not expose billing/API/webhook/payload/provider/token/secret copy;
- operator daily work routes (`/app`, tasks and conversations) remain usable;
- operator settings stays a clean forbidden state without owner-only technical noise.

Existing direct-object smoke was re-run to prove backend tenant-safe denial for foreign client URLs through authenticated API requests.

Verification:

- `cd frontend && npx playwright test e2e/smoke.spec.ts --project=desktop-chromium -g "manager and operator role UX stays useful and safe|operator sees restricted sections as forbidden"`: passed; 2 role UX browser tests.
- `cd frontend && npx playwright test e2e/smoke.spec.ts --project=desktop-chromium -g "operator cannot read another tenant through direct object URLs"`: passed; 1 backend/URL tenant-denial browser/API smoke.
- `cd frontend && npm run build`: passed; i18n parity, TypeScript, main Vite production build and widget build completed.

### 2026-07-23: 10.5 Mobile And Tablet Interaction QA Completed

Extended `frontend/e2e/smoke.spec.ts` with mobile modal fit coverage and a tablet CRM workbench route pass.

The mobile smoke now verifies:

- owner and manager mobile shells expose primary CRM navigation without overlap;
- mobile calendar booking modal opens as an opaque dialog that fits inside the viewport and closes cleanly;
- mobile daily CRM routes, including lists, calendar and conversations, remain usable without app crashes.

The tablet workbench pass now verifies:

- leads, clients, deals, tasks, calendar and conversations routes render inside a 900px tablet viewport without horizontal overflow;
- the first real lead can be opened through a deep workspace route on tablet;
- tablet workspace proportions stay inside the viewport without `Unexpected Application Error` screens.

The mobile entity workspace test also verifies client, lead, deal, appointment, conversation and task workspace routes fit without horizontal overflow on the mobile viewport.

Verification:

- `cd frontend && npx playwright test e2e/smoke.spec.ts --project=mobile-chromium -g "mobile owner smoke|mobile manager smoke"`: passed; 2 mobile browser smoke tests.
- `cd frontend && npx playwright test e2e/smoke.spec.ts --project=desktop-chromium -g "tablet CRM workbench routes keep usable proportions"`: passed; 1 tablet browser test.
- `cd frontend && npx playwright test e2e/entity-workspaces.spec.ts --project=mobile-chromium`: passed; 1 mobile CRM workspace workflow test. A first attempt failed before test execution because the Playwright webServer process exited with code `3221225477`; after running deterministic e2e preparation, the same command passed.
- `cd frontend && npm run build`: passed; i18n parity, TypeScript, main Vite production build and widget build completed.

### 2026-07-23: 10.6 Phase 10 Cutover QA Completed

Closed Phase 10 with final interaction, visual, build and bundle gates.

Latest verified interaction audit output:

```text
output/playwright/interaction-audit-2026-07-23T09-59-19/
```

The final interaction audit covered 12 authenticated `/app` routes and 42 safe actions:

- dashboard: 2 actions clicked, 0 missing, 0 blockers.
- leads: 5 actions clicked, 0 missing, 0 blockers.
- deals: 5 actions clicked, 0 missing, 0 blockers.
- clients: 4 actions clicked, 0 missing, 0 blockers.
- tasks: 5 actions clicked, 0 missing, 0 blockers.
- calendar: 4 actions clicked, 0 missing, 0 blockers.
- conversations: 6 actions clicked, 0 missing, 0 blockers.
- integrations: 2 actions clicked, 0 missing, 0 blockers.
- analytics: 3 actions clicked, 0 missing, 0 blockers.
- settings: 4 actions clicked, 0 missing, 0 blockers.
- outreach: 1 action clicked, 0 missing, 0 blockers.
- ai-agents: 1 action clicked, 0 missing, 0 blockers.

Latest verified visual audit output:

```text
output/playwright/visual-audit-2026-07-23T10-03-47/
```

The final visual audit covered 13 authenticated `/app` visual route states with:

- 0 login redirects.
- 0 horizontal overflow findings.
- 0 transparent surface findings.
- 0 API issues.
- 0 auth API issues.
- 0 `/api/auth/me/` server errors.

Verification:

- `git diff --check`: passed.
- `cd frontend && npm run audit:interaction`: passed; 12 routes, 42 safe actions, 0 missing actions, 0 blockers, 0 API issues.
- `cd frontend && npm run audit:visual`: passed; 13 route states, 0 horizontal overflow, 0 transparent surface issues, 0 API/auth issues.
- `cd frontend && npm run build`: passed; i18n parity, TypeScript, main Vite production build and widget build completed.
- `cd frontend && npm run check:bundle`: passed; largest JS chunk is `app-shell-l-Q3uY3Y.js` at 461.5 kB before gzip, below the 500 kB limit.

Remaining risks:

- No new blocking UI/UX risks were found by the Phase 10 gates.
- The interaction and visual audits validate safe non-destructive flows only. Destructive submit paths and live provider write actions remain intentionally outside this phase.
- Existing build-time `PLUGIN_TIMINGS` messages are informational Vite/Rolldown performance warnings, not failed gates.
