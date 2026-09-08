# ZANI Application Functional Certification

- Date: 2026-08-20
- Status: **EXECUTED / PARTIAL - INTEGRATED CLEAN-RANGE GATE PASSED; FC-003/004/006 AND FINAL REPORT OPEN**
- Activation: owner authorized execution on 2026-08-20
- Primary scope: authenticated merchant `/app`
- Secondary scope: public authentication and platform-admin surfaces

## 2026-09-08 Integrated Gate Checkpoint

The committed code candidate `e65e0f4` on
`codex/ux-3-owner-dashboard` passed the full deterministic gate against base
`f142f3e498e4726320fc7de0b6ad0cc27187c57f`. Evidence includes no migration
drift, a clean Django system check, all 954 Django tests, deterministic frontend
install/build/bundle, mobile owner/manager smoke, zero Python and npm dependency
advisories, and final committed-range diff hygiene. This closes the clean-range
prerequisite. FC-008 remains partial until FC-003/004/006 and the final
certification report are reconciled; the pass must not be interpreted as live
provider or paid-beta evidence.

## Purpose

This document defines the future functional certification of ZANI as a SaaS
application. The goal is to find incomplete interactions, hidden regressions
and incorrect basic UI behavior before owner manual review or a controlled
pilot.

The certification is not limited to page reachability or backend business
logic. It must prove that a user can complete each supported action without
losing focus, input, context or feedback and that the result is correct in the
UI, API and persisted business state.

The recent page-search defect is the reference example: the route loaded and
the search control existed, but every character changed server state in a way
that unmounted the input and lost focus. A complete interaction contract would
have detected this automatically.

`actual_docs/DEFECT_KNOWLEDGE_BASE.md` is a mandatory certification input.
Every active regression rule recorded there must be mapped to all relevant
routes and interactions before certification can be closed.

## Relationship To Existing QA

`archive_docs/APP_2_PHASE_10_INTERACTION_WORKFLOW_QA_PLAN.md` already proves broad route
reachability, safe click-through behavior, representative entity workflows,
role boundaries and responsive smoke. This certification extends that work.

Existing evidence remains useful, but a safe click is not treated as proof that
the resulting behavior is correct. Every covered action must have semantic
assertions for its visible result, API result and relevant stored state.

## Non-Goals

- No new CRM features, integrations or vertical adaptations.
- No production credentials or live provider writes.
- No redesign unless a verified usability defect requires a bounded fix.
- No claim that software can be proven to contain zero defects.
- No replacement for owner visual/product judgment.

## Certification Definition Of Done

Certification is complete only when all conditions below are satisfied:

- [x] Every active user-facing route is present in the route coverage registry.
- [ ] Every interactive control has an expected-result contract or an approved
      reason for exclusion.
- [ ] Every critical merchant journey passes through the real frontend and API.
- [x] Owner, administrator, manager, operator and specialist access is checked.
- [x] Desktop, tablet and mobile behavior is checked where the surface exists.
- [ ] Empty, loading, success, validation, forbidden, conflict, offline and
      server-error states are covered where applicable.
- [x] Tenant isolation and backend authorization are proven independently of
      frontend visibility.
- [x] Console errors, unexpected API failures, stuck overlays and unhandled
      promise errors are zero for the certified runs.
- [x] Accessibility, responsive layout, request budgets and bundle budgets pass.
- [x] The deterministic full quality gate passes from a clean committed range.
- [x] A final evidence report records commands, outputs, failures, fixes,
      exclusions and remaining risks.

## FC-0: Build The Coverage Registry

Create a machine-readable registry derived from
`frontend/src/app/router.tsx`. A guard test must fail when a new active route is
added without a certification entry.

Each entry must include:

- route and page/component;
- supported roles and capabilities;
- page-ready marker;
- primary and secondary actions;
- forms, searches, filters, tables, menus, drawers and dialogs;
- API endpoints and affected entities;
- supported viewport classes;
- required data and failure fixtures;
- automated test location;
- current result: `NOT_RUN`, `PASS`, `FAIL`, `BLOCKED` or `EXCLUDED`.

Initial route groups:

| Group | Routes/surfaces |
| --- | --- |
| Authentication | login, signup, forgot/reset password, invitation |
| Daily control | dashboard, account, notifications, global search, command palette |
| CRM intake | leads list/workspace, conversations/inbox |
| CRM records | clients list/workspace, timeline |
| Revenue | deals board/workspace |
| Execution | tasks list/workspace, calendar/appointment workspace |
| Operations | bots, integrations, pricing, outreach, automations |
| AI | assistant, agents and agent detail/sections |
| Business setup | services, resources, working hours, settings, billing redirect |
| Management | analytics and role-specific dashboard states |
| Platform | platform dashboard, operations, merchants and merchant detail |

## FC-1: Universal Interaction Contracts

The following contracts apply to every matching control in the application.

### Search

- Type at least five characters one by one.
- The input remains mounted, focused and contains the complete value.
- The page does not perform a full browser reload.
- Debounce produces the intended number of requests without a request storm.
- Previous content remains stable while new data is loading when appropriate.
- Search composes correctly with filters, sorting and pagination.
- Clear, Escape, browser back/forward, reload and deep-link behavior are proven.
- No stale response may overwrite a newer query result.

### Filters, Sorting And Pagination

- Apply one filter, multiple filters and reset all.
- Verify visible data and transmitted API parameters.
- Verify URL persistence only when the page contract requires it.
- Back/forward navigation restores the expected state.
- Sorting remains stable across pages and repeated requests.
- Pagination handles first, middle, last, empty and changed-result pages.
- Filters do not silently reset selected records or unrelated form state.

### Tables, Lists And Kanban

- Row/card selection opens the intended workspace or overlay.
- Keyboard activation matches pointer activation.
- Selection survives non-destructive background refresh where intended.
- Empty and no-results states expose a real next action.
- Long values, Cyrillic/Kazakh text and large datasets do not hide actions.
- Kanban transitions enforce backend state rules and recover after failure.
- Bulk selection, if present, cannot cross tenant or permission boundaries.

### Forms And Mutations

- Required fields, field formats and business validation are visible.
- Pending state blocks unsafe double submission.
- A failed request preserves user input and returns focus to the error context.
- Success updates the visible record without requiring a manual reload.
- Repeated idempotent actions do not create duplicates.
- Close/cancel warns about unsaved changes where loss would be material.
- Server messages are mapped to safe localized user feedback.

### Dialogs, Drawers, Menus And Popovers

- Open, close button, outside click and Escape follow the component contract.
- Focus enters the surface, remains contained where modal and returns to the
  exact visible trigger after close.
- Stacked surfaces close in the correct order.
- Route changes do not leave an invisible overlay or body scroll lock.
- Mobile surfaces fit the viewport and keep the primary action reachable.

### Navigation And Session

- Direct URL, reload, browser back/forward and internal navigation agree.
- Unsaved or selected context is handled intentionally.
- Login, refresh, logout and reload include at least one non-mocked browser run.
- Expired sessions do not create redirect loops or erase recoverable form data.
- Forbidden and missing objects produce safe states without data leakage.

## FC-2: Data-State Matrix

Every applicable page must be run against:

- empty business/data set;
- one record;
- normal deterministic pilot data;
- paginated/large data set;
- long names, phone numbers, messages and localized text;
- archived, overdue, terminal and unassigned records;
- disabled capability or unavailable provider;
- record from another tenant;
- record changed or deleted after the page was opened.

Fixtures must be deterministic and must not call live providers.

## FC-3: Failure And Recovery Matrix

For relevant reads and mutations, inject and verify:

| Failure | Required UI behavior |
| --- | --- |
| `400` validation | Field or form error; entered values preserved |
| `401` expired session | Safe re-authentication path; no redirect loop |
| `403` forbidden | Localized forbidden state; no hidden retry loop |
| `404` missing/tenant-hidden | Safe not-found state without leaked details |
| `409` conflict/duplicate | Explain conflict and offer a valid recovery action |
| `429` throttled | Calm retry guidance and no request storm |
| `500` server failure | Recoverable error with retry where safe |
| timeout/offline | Stable page, preserved input and deliberate retry |
| stale/out-of-order response | Newest user intent remains authoritative |

Raw stack traces, provider secrets and technical payloads must never appear in
merchant-facing feedback.

## FC-4: Role, Capability And Tenant Matrix

Required profiles:

- business owner;
- administrator;
- manager;
- operator;
- specialist.

For each protected route/action, prove:

- intended role can discover and complete the action;
- restricted role receives a useful UI state;
- direct API and direct-object URL access are denied by the backend;
- disabled business capability is enforced in navigation, search, command
  palette, route access and API behavior;
- foreign-business reads and writes produce no side effects, activity, audit,
  notification or BusinessEvent.

## FC-5: Critical End-To-End Merchant Journeys

The following journeys require real frontend interaction plus API/database
evidence for important side effects:

1. Inbox conversation -> lead -> responsible user -> next action.
2. Lead -> qualification -> client -> deal when enabled.
3. Deal -> stage progression -> task -> won/lost with required reason.
4. Client -> appointment -> reschedule -> confirm -> complete/cancel/no-show.
5. Conversation -> linked CRM record -> task/follow-up.
6. Import -> validation -> duplicate handling -> visible CRM records.
7. Owner/administrator -> team access and role changes.
8. Manager -> workload, overdue work, funnel and team actions.
9. Operator/specialist -> assigned daily queue without owner-only data.
10. AI suggestion -> source evidence -> explicit approval -> audited mutation.

Each journey must include a happy path, validation failure, permission denial,
tenant denial and recoverable infrastructure/provider failure where relevant.

## FC-6: Browser And Non-Functional Matrix

Required browser projects:

- desktop Chromium;
- tablet Chromium;
- mobile Chromium.

Required checks:

- no horizontal overflow or unreachable primary action;
- no serious/critical Axe findings;
- visible focus and keyboard navigation;
- RU, KK and EN dictionary alignment plus representative long-text checks;
- zero console errors and unexpected failed requests;
- request-count/waterfall budgets on operational pages;
- production build and widget build;
- JavaScript bundle budgets;
- screenshot/trace/video retained for failures;
- deterministic cleanup of local processes and temporary databases.

## FC-7: Automation And Release Gates

### Per Change

- focused backend or frontend regression;
- affected Playwright interaction contract;
- migration drift/system check when applicable;
- frontend build and i18n for frontend changes;
- diff hygiene from an explicit base commit.

### Nightly Or Scheduled Full Certification

- complete backend suite;
- all Playwright certification specs on desktop, tablet and mobile;
- route coverage guard;
- interaction and visual audits;
- accessibility and performance budgets;
- Python/npm dependency security checks;
- consolidated evidence artifact.

### Pre-Pilot / Release Candidate

Run from a clean committed range with a fetched base commit:

```powershell
& C:\Users\user\Desktop\ZANI-main\.venv\Scripts\python.exe `
  scripts\codex_verify.py --mode full --base-ref <task-base-sha>
```

Additional certification commands:

```powershell
Push-Location frontend
npm run audit:interaction
npm run audit:visual
npx playwright test --project=desktop-chromium
npx playwright test --project=tablet-chromium
npx playwright test --project=mobile-chromium
npm run build
npm run check:bundle
Pop-Location
```

The full run must use disposable local data and blocked/mocked external
providers. Live provider certification is a separate authorized activity.

## Execution Queue

| ID | Work item | Status |
| --- | --- | --- |
| FC-001 | Generate route/action coverage registry and guard test | PASS |
| FC-002 | Add shared search/filter/sort/pagination contracts | PASS |
| FC-003 | Add form/mutation/dialog/session contracts | PARTIAL - failure contracts depend on fallback layer |
| FC-004 | Add deterministic data-state and fault fixtures | PARTIAL - full fault matrix depends on fallback layer |
| FC-005 | Complete role/capability/tenant browser matrix | PASS |
| FC-006 | Complete ten critical merchant journeys | PARTIAL - representative journeys pass; all ten are not yet UI/API/persistence certified |
| FC-007 | Run desktop/tablet/mobile non-functional matrix | PASS |
| FC-008 | Run clean full gate and publish final report | PARTIAL - integrated clean-range full gate passed on `e65e0f4`; FC-003/004/006 reconciliation and the final report remain open |

## Evidence Rules

For every item record:

- exact branch and commit;
- exact commands and results;
- routes, roles, viewport and fixture used;
- assertions proven rather than only controls clicked;
- screenshots, traces, videos and JSON output for failures;
- defects found, fixes committed and regression tests added;
- skipped checks and explicit reason;
- remaining risk and owner decision if required.

No task becomes `PASS` because a page merely rendered, a control existed or an
action did not crash. The expected user-visible and business result must be
asserted.

## Execution Boundary

The owner authorized BE-REM-007 execution on 2026-08-20. Independent backend,
frontend, browser, accessibility, responsive, performance and dependency gates
were executed. The isolated cross-role failure matrix in
`UNIFIED_FALLBACK_EXPERIENCE_PLAN.md` now passes for the required merchant
roles and desktop/mobile viewports. The integrated committed-range gate,
generated fallback inventory and visual/interaction gates are now current on
`e65e0f4`. FC-008 remains partial until FC-003/004/006 and the final report are
reconciled. The repository pass must not be converted into a live-provider or
paid-beta claim.

Current evidence is recorded in
`actual_docs/APP_FUNCTIONAL_CERTIFICATION_REPORT_2026-08-20.md`.
