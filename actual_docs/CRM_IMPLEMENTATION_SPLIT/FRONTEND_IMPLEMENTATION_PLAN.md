# ZANI CRM Frontend Implementation Plan

Date: 2026-07-21

Status: implementation backlog

Scope: authenticated `/app` only

Owner: frontend workstream

## 1. Purpose

This document isolates the frontend part of the deep CRM audit. It describes what still needs to be implemented in the user interface and what must not be faked or solved only by hiding controls.

The public landing page is outside this plan.

Primary sources:

- `actual_docs/APP_2_WORKBENCH_EXECUTION_ROADMAP.md`;
- `actual_docs/APP_UI_UX_REDESIGN_TASK.md`;
- `actual_docs/CRM_CORE_WORKFLOW_AUDIT.md`;
- `actual_docs/CRM_TECHNICAL_MAP_AND_VERTICAL_MODES.md`;
- `docs/design-system.md`;
- `docs/WARM_PREMIUM_CRM_REDESIGN_BRIEF.md`;
- `docs/PERMISSION_MATRIX.md`;
- `API_ACTION_CONTRACT.md`.

The active App 2.0 roadmap remains the detailed source of truth for design-system phases. This file is the product-level frontend backlog and the boundary between frontend and backend responsibility.

## 2. Current Frontend Foundation To Preserve

The following foundation already exists and should be evolved rather than rebuilt:

- authenticated React application and route tree;
- frontend API modules under `frontend/src/api/*`;
- role and permission gates for routes and navigation;
- desktop sidebar, header, mobile navigation and global search;
- clients, leads, deals, tasks, calendar, inbox, integrations, analytics, AI and settings pages;
- full client, lead and deal workspace routes;
- shared `EntityWorkspace` primitives;
- shared buttons and part of the common UI primitive layer;
- RU, KK and EN locale files with parity verification;
- Warm Premium CRM direction and component contract in documentation;
- loading, empty and error handling on part of the application surfaces.

This does not mean every workflow is complete. A route or component is only a foundation until it uses real data, respects the current user's permissions and exposes a complete action flow.

## 3. Frontend Non-Negotiable Rules

1. Frontend hiding is not authorization. The backend must reject forbidden reads and writes.
2. No fake business metrics, trends, provider states, AI conclusions or success messages.
3. Components must use `frontend/src/api/*`; no raw HTTP calls inside pages.
4. Every visible authenticated block must support a real job: data, action, navigation, status, alert, form, analytics or useful empty state.
5. Role-specific pages must not request resources the role cannot read.
6. A mutation is incomplete without pending, success, validation-error and recovery states.
7. A disabled business module must be guarded by the backend before it is hidden in navigation.
8. Shared controls and surfaces must come from the design system, not page-local copies.
9. Russian and Kazakh labels, validation messages and long names must fit at desktop and mobile widths.
10. Settings must expose merchant decisions, not internal implementation details.

## 4. P0: Trustworthy Data And Role-Aware UI

### FE-P0-01. Remove fake dashboard metrics

Problem:

- owner dashboard currently contains fallback revenue, average check and hardcoded trend values;
- those values can look like real merchant data when APIs return no data.

Required implementation:

- [ ] remove numeric business fallbacks from production dashboard cards;
- [ ] show a real no-data state when the backend has no metric;
- [ ] show demo data only behind an explicit demo mode and visible demo label;
- [ ] consume authoritative aggregate endpoints instead of calculating totals from the first list page;
- [ ] display metric period, currency and source semantics consistently;
- [ ] distinguish `0`, `not available`, `not permitted` and `failed to load`.

Acceptance:

- no production dashboard number is invented by the frontend;
- counts remain correct when an entity list has more than 50 records;
- a forbidden metric never appears as a misleading zero.

Evidence area:

- `frontend/src/features/dashboard/OwnerDashboard.tsx`;
- `frontend/src/hooks/useEntityData.ts`;
- dashboard API modules.

### FE-P0-02. Build real role-specific daily surfaces

Problem:

- dashboard behavior is effectively split into owner and everyone else;
- manager, operator and specialist workflows are materially different;
- generic data loading can request entities unavailable to the current role.

Required implementation:

- [ ] owner/director dashboard: business KPIs, operational risks, team load, unassigned work, integrations and high-priority alerts;
- [ ] manager/team lead dashboard: team queues, overdue items, SLA breaches, reassignment and workload;
- [ ] sales manager dashboard: owned leads/deals, next actions, overdue follow-ups and appointments;
- [ ] messenger operator dashboard: inbox queue, assigned conversations, unread/SLA state, handoffs, own requests and tasks;
- [ ] specialist/doctor dashboard: today's appointments, own tasks, client context and permitted follow-up actions;
- [ ] load only resources allowed by the backend permission matrix;
- [ ] keep route, navigation, action menu and empty state consistent with the same permission source;
- [ ] provide a clear forbidden state when a bookmarked route is not accessible.

Acceptance:

- each preset role lands on a useful daily workspace;
- restricted roles do not see empty cards for resources they are not allowed to read;
- role navigation and action availability agree with backend responses.

Evidence area:

- `frontend/src/features/dashboard/DashboardPage.tsx`;
- `frontend/src/hooks/useEntityData.ts`;
- navigation and route permission components;
- `docs/PERMISSION_MATRIX.md`.

### FE-P0-03. Normalize mutation feedback and error UX

Required implementation:

- [ ] map backend error codes to merchant-safe RU/KK/EN messages;
- [ ] attach field validation errors to the correct control;
- [ ] use page-level or inline errors for recoverable workflow failures;
- [ ] reserve technical details and request IDs for an expandable support block;
- [ ] show visible success feedback after assignment, handoff, status change, booking, archive, restore and invitation actions;
- [ ] prevent duplicate clicks while a mutation is pending;
- [ ] provide retry where the operation is safe to retry;
- [ ] replace raw JavaScript/backend errors in the global error boundary with a safe recovery screen.

Acceptance:

- users never need to interpret a Python/DRF/JavaScript error;
- success is visible in the current work context, not only in a notification dropdown;
- validation, permission, conflict, provider and temporary service errors are visually distinct.

Evidence area:

- `frontend/src/api/client.ts`;
- app error boundary;
- shared toast, alert and form components.

## 5. P0/P1: Shared App 2.0 Interface Foundation

Detailed checkboxes live in `actual_docs/APP_2_WORKBENCH_EXECUTION_ROADMAP.md`. The required product outcome is:

### FE-UI-01. Finish shared design-system primitives

- [ ] authenticated font loading and Manrope Variable or approved equivalent;
- [ ] shared `Switch`;
- [ ] harmonized `Input`, `Textarea`, `Select` and searchable select;
- [ ] tabs, segmented controls, filter chips, badges and status badges;
- [ ] table, card/surface, drawer, modal, popover, toast and state-view surfaces;
- [ ] consistent focus, hover, active, disabled, loading, success and error states;
- [ ] remove remaining blue/slate/decorative legacy styles from authenticated shared primitives;
- [ ] validate long RU/KK text and keyboard navigation.

### FE-UI-02. Finish AppShell 2.0

- [ ] one warm neutral workspace background across sidebar, header and page viewport;
- [ ] compact route-first desktop sidebar;
- [ ] consistent active, hover, collapsed and mobile states;
- [ ] simplified header with aligned search, notifications and account actions;
- [ ] consistent desktop/mobile page container;
- [ ] shell-level loading, forbidden and route error states;
- [ ] keep platform/admin layout separate where needed.

### FE-UI-03. Introduce WorkbenchLayout

- [ ] shared operational page header;
- [ ] compact metric/status strip;
- [ ] search/filter/view toolbar;
- [ ] view tabs or saved-view-ready contract;
- [ ] main workspace pattern for table, kanban, inbox, calendar and analytics;
- [ ] optional quick inspector only where it improves work;
- [ ] shared loading, empty, filtered-empty, error and forbidden placement.

Acceptance for the interface foundation:

- new pages can be assembled without one-off control styling;
- pages use at most the workspace background plus intentional surface levels;
- content density matches an operational CRM, not a landing page;
- no nested decorative card stacks;
- desktop and mobile layouts are visually checked with real route content.

## 6. P1: Entity And Workflow Experiences

### FE-WF-01. Complete entity workspaces

For clients, leads and deals:

- [ ] show identity, owner/responsible user, status/stage and next action;
- [ ] show activity timeline, notes, tasks, appointments and communication context;
- [ ] show only backend-provided available actions;
- [ ] keep edit, assign, archive/restore and lifecycle actions in consistent locations;
- [ ] provide direct navigation among related entities without losing list context;
- [ ] standardize unsaved, pending, conflict and stale-data behavior;
- [ ] make mobile entity actions usable without opening several nested menus.

### FE-WF-02. Complete inbox-to-CRM flow

- [ ] make assigned, unassigned, unread, priority, bot and handoff states easy to scan;
- [ ] show operator ownership and queue state;
- [ ] support manager reassignment with immediate visible confirmation;
- [ ] create or link lead/client/task/appointment through backend actions;
- [ ] prevent duplicate conversion when an entity is already linked;
- [ ] expose message delivery/retry state in merchant-safe language;
- [ ] keep AI qualification source-grounded and clearly separated from confirmed CRM data.

### FE-WF-03. Complete task and appointment workspaces

- [ ] show own/team/unassigned work according to role scope;
- [ ] make due date, overdue, assignee and linked entity visible in lists;
- [ ] provide controlled complete/reopen/reassign actions;
- [ ] display schedule conflicts and working-hours errors next to the relevant fields;
- [ ] make reschedule, cancel and no-show reasons explicit;
- [ ] expose reminder state and recovery action when delivery fails.

### FE-WF-04. Make notifications operational

- [ ] show assignment, handoff, mention, due/overdue, appointment and automation events;
- [ ] deep-link each notification to the affected entity or action;
- [ ] support unread/read state without losing current context;
- [ ] provide near-realtime refresh using the approved polling/SSE strategy;
- [ ] keep personal preferences understandable and separate from business-wide message settings;
- [ ] do not imply external delivery succeeded until backend status confirms it.

## 7. P1: Settings Simplification

The current settings surface contains too many unrelated concepts in one page. The target information architecture is:

### Everyday settings

- personal profile and language;
- personal notification preferences;
- basic business profile: name, timezone, contacts, language and currency;
- team members and invitations for owner/admin;
- simple role assignment using approved presets;
- appointment/reminder message settings where scheduling is enabled;
- billing and usage for owner/admin.

### Advanced settings

- granular permission editor;
- teams/departments and complex visibility rules;
- audit, login/security history and support access grants;
- custom fields;
- technical identifiers such as slug;
- direct logo URL or low-level branding parameters;
- connector/provider recovery details;
- advanced booking, cancellation and prepayment rules.

### Required implementation

- [ ] split the large settings page into route-level sections or bounded feature modules;
- [ ] render sections and controls according to role and enabled business modules;
- [ ] remove or hide parameters that have no working backend behavior;
- [ ] explain risky settings by consequence, not by technical implementation;
- [ ] provide save state per section instead of one ambiguous global state;
- [ ] preserve unsaved changes and show validation close to fields;
- [ ] use searchable role/member selectors when lists grow;
- [ ] keep daily users away from owner/admin system settings;
- [ ] add product modules/profile UI only after backend enforcement exists.

Acceptance:

- an operator sees personal settings only;
- a manager sees only delegated team controls;
- owner/admin can configure the business without encountering a developer console;
- no visible setting is decorative or non-functional.

Evidence area:

- `frontend/src/features/settings/SettingsPage.tsx`;
- `frontend/src/features/settings/BusinessSettingsForm.tsx`.

## 8. P1: Onboarding And Invitations

### FE-ONB-01. Owner onboarding

- [ ] after signup, fetch onboarding status instead of navigating to an unexplained full CRM;
- [ ] collect or confirm business type and basic business profile;
- [ ] guide the owner through team invitations and role presets;
- [ ] guide the owner to the first relevant channel/integration without exposing raw credentials in the daily UI;
- [ ] create the first real client/request/appointment or import data;
- [ ] allow skip/resume and show progress;
- [ ] avoid generating fake business data unless explicit demo mode is selected.

### FE-ONB-02. Invited employee onboarding

- [ ] accept invitation and explain assigned role in simple language;
- [ ] land on the correct role workspace;
- [ ] show only the first actions relevant to that role;
- [ ] provide understandable expired/used/revoked invitation states;
- [ ] avoid exposing owner-only setup steps.

Frontend dependency:

- use existing onboarding and invitation APIs where complete;
- product-profile/module selection depends on the backend capability layer defined in the backend plan.

## 9. P1/P2: Dentistry-First Frontend Mode

This work must start only after the backend returns authoritative enabled modules and rejects disabled-module APIs.

Required implementation:

- [ ] consume a product-profile/capabilities payload in app bootstrap;
- [ ] hide Deals by default for dentistry only when backend capability says it is disabled;
- [ ] make requests, inbox, clients, calendar and appointments the primary navigation;
- [ ] provide appointment-first owner and operator dashboards;
- [ ] adapt onboarding steps and empty states to dentistry workflow;
- [ ] suppress AI tools and command results for disabled modules;
- [ ] let authorized owner/admin enable optional modules in Advanced settings;
- [ ] preserve data and restore navigation safely if a module is re-enabled.

Target dentistry flow:

```text
message/call/form
-> qualification
-> request/client
-> appointment
-> responsible doctor/resource
-> reminder
-> visit/no-show/cancel
-> follow-up task
-> activity and dashboard
```

Do not add clinical records, treatment charts, diagnoses, insurance or EHR functionality to the CRM core.

## 10. P2: Language, Accessibility And Frontend Quality

- [ ] remove remaining mojibake and corrupted separators/placeholders;
- [ ] move remaining authenticated hardcoded copy into i18n;
- [ ] verify RU/KK/EN semantic parity, not only key parity;
- [ ] add accessible labels, focus order and keyboard behavior to dialogs, menus, tabs and switches;
- [ ] keep touch targets usable on mobile;
- [ ] verify contrast in light and future dark themes;
- [ ] split oversized feature files by product responsibility without changing behavior;
- [ ] remove redundant API waterfalls and duplicate list requests;
- [ ] keep the main app bundle below the configured budget;
- [ ] visually inspect critical routes at desktop and mobile widths.

Known evidence areas:

- `frontend/src/features/settings/SettingsPage.tsx`;
- conversations, calendar, outreach and AI assistant feature files;
- `frontend/src/features/leads/hooks/useLeadInteractions.ts`;
- `frontend/src/styles.css`;
- `frontend/tailwind.config.ts`.

## 11. Frontend Execution Order

The recommended sequence for the frontend chat is:

1. Finish shared design-system primitives.
2. Finish AppShell 2.0 and WorkbenchLayout.
3. Remove fake dashboard values and introduce role-aware loading/states.
4. Complete role dashboards and daily queues.
5. Simplify Settings information architecture.
6. Complete owner and invited-user onboarding.
7. Complete entity, inbox, task, appointment and notification feedback flows.
8. Add dentistry UI only after backend capabilities are delivered.
9. Complete i18n, accessibility, bundle and visual QA.

The active frontend phase and its verification status must continue to be tracked in `actual_docs/APP_2_WORKBENCH_EXECUTION_ROADMAP.md`.

## 12. Backend Dependencies

Frontend must not close these items without backend delivery:

| Frontend capability | Required backend contract |
| --- | --- |
| Correct role dashboards | permission-aware aggregate and work-queue endpoints |
| Accurate counts | server aggregates, not first-page list length |
| Reassignment and handoff | atomic domain action with audit/activity/notification |
| Notification status | scheduled delivery worker and authoritative delivery state |
| Safe AI action UX | idempotent approval/tool execution and source references |
| Automation run UX | claimed runs, retry state and deterministic action order |
| Dentistry mode | product profile, module capabilities and backend route guards |
| Merchant-safe errors | stable error codes and structured field/non-field errors |
| Module-aware onboarding | onboarding status plus authoritative capabilities |

## 13. Frontend Definition Of Done

A frontend task is complete only when:

- the route is reachable for an allowed role;
- a forbidden role receives the correct UI state;
- real data, empty, loading, error and filtered-empty states are covered;
- mutations show pending, success and failure states;
- the frontend uses an API module and backend-provided permissions/actions;
- RU/KK/EN text fits and does not overlap;
- desktop and mobile behavior is checked;
- `npm run build` passes;
- `npm run check:bundle` passes for bundle-affecting work;
- relevant Playwright/manual role smoke is recorded;
- the active App 2.0 roadmap checkbox is updated only after verification.

## 14. Explicitly Out Of Scope

- public landing redesign;
- frontend-only authorization;
- frontend-only business-module hiding;
- fake/demo metrics presented as real;
- clinical dentistry/EHR features;
- theme marketplace or per-user custom color builder before core launch;
- ERP-style settings and provider developer consoles in daily merchant screens.
