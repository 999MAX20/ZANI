# ZANI Pre-Pilot Execution Master

Status: completed; paused for owner review
Owner: Chat Manager  
Execution tracks: UI/UX and Features/Backend  
Integration branch: `codex/project-integration-2026-07`  
Target: a coherent, polished and fully verified local product before controlled pilot setup

## 1. Purpose

This document is the single execution queue for the current pre-pilot cycle.

The previous frontend and backend plans remain implementation evidence and design
history. Agents must not add new work to those closed plans. Durable engineering
rules still come from `AGENTS.md`, the clean-code rules, the CRM production plan,
the permission matrix, the design system and the testing documentation.

The manager owns prioritization, cross-track coordination, independent
verification, integration and the final readiness decision. UI/UX and
Features/Backend each take only the next `READY` item assigned to their track.

## 2. Current Baseline

The integrated baseline already contains:

- completed UI/UX Phase 9 and interaction/workflow QA Phase 10;
- completed backend CRM production layers B0-B6;
- completed backend runtime/reliability phases R0-R5;
- CRM lifecycle services, tenant isolation, permissions, activity/audit,
  source-grounded AI controls and local cross-entity E2E coverage;
- a local SQLite development path and a working Telegram integration;
- frontend dependencies updated to a zero-finding npm audit snapshot.

Closed source documents:

- `actual_docs/APP_2_PHASE_9_UI_UX_POLISH_PLAN.md`;
- `actual_docs/APP_2_PHASE_10_INTERACTION_WORKFLOW_QA_PLAN.md`;
- `actual_docs/CRM_IMPLEMENTATION_SPLIT/BACKEND_IMPLEMENTATION_PLAN.md`;
- `actual_docs/CRM_IMPLEMENTATION_SPLIT/BACKEND_RELIABILITY_EXECUTION_PLAN.md`.

They are references, not active queues.

## 3. Scope Boundary

### In scope now

- local product correctness and end-to-end workflow completeness;
- role-aware, responsive, accessible and consistent authenticated UI;
- immediate and useful feedback for user actions;
- API/domain contract correctness, capability enforcement and tenant isolation;
- valuable notifications, activity and audit behavior;
- measured performance improvements;
- deterministic builds, migrations, tests and local pilot seed flows;
- documentation required to reproduce and verify the local baseline.

### Explicitly deferred

The following require external accounts, credentials or production
infrastructure and do not block this local pre-pilot cycle:

- managed PostgreSQL and production backup/restore;
- managed Redis and real Celery worker infrastructure;
- private S3-compatible object storage;
- production SMTP and Sentry configuration;
- Meta, WhatsApp, Instagram, Kaspi, 1C, MoySklad and other live provider
  credentials, webhooks or production traffic tests;
- production deployment, DNS, TLS and paid-beta certification.

Agents may improve mocks, adapters, validation and failure states, but must not
invent credentials or claim live readiness.

### Product constraints confirmed on 2026-07-24

This cycle hardens the existing CRM foundation. It must not expand into a new
feature roadmap or a new industry-specific CRM architecture.

- Keep one shared CRM domain and preserve the existing core entities: Lead,
  Client, Deal, Task, Appointment and Conversation.
- Do not globally rename or merge Lead and Appointment. A Lead remains an
  inbound request or commercial interest; an Appointment remains a confirmed
  booking for a concrete time and resource.
- Do not remove the Deals domain, its data or its standard-CRM workflows.
- Preserve the already implemented dentistry capability profile: it may use
  `appointment_first` and disable Deals by default through the real backend and
  frontend capability layer. Owners may re-enable Deals, and disabling the
  module must never delete existing deal data.
- Do not add more vertical hiding, terminology remapping or dentistry-specific
  workflow changes during this cycle unless required to correct an existing
  broken contract.
- Prioritize completeness, correctness, permissions, tenant isolation,
  lifecycle integrity, activity/audit, notifications, recoverability,
  accessibility, performance and verification of existing workflows.
- Findings that are genuinely new product features belong after the pilot and
  must not be pulled into this execution queue.

## 4. Autonomous Operating Model

### Git topology

| Track | Worktree | Branch |
| --- | --- | --- |
| Manager/integration | `C:\Users\user\Desktop\ZANI-integration` | `codex/project-integration-2026-07` |
| UI/UX | `C:\Users\user\Desktop\ZANI-ui-pilot` | `codex/frontend-pilot-readiness` |
| Features/Backend | `C:\Users\user\Desktop\ZANI-backend-pilot` | `codex/backend-pilot-readiness` |

Rules:

1. Each execution task works only in its assigned worktree and branch.
2. One assigned item produces one focused commit.
3. After its required checks pass, the task pushes its branch to `origin`.
4. Neither execution task may push, merge or rebase `main`.
5. The manager independently verifies every handoff before integration.
6. The manager integrates accepted commits into
   `codex/project-integration-2026-07` and pushes that branch.
7. `main` remains untouched until the project owner explicitly authorizes a
   final promotion after visual review.
8. Preserve unrelated user changes.
9. If frontend and backend need a contract change, backend defines and tests the
   contract first; frontend consumes only the integrated contract.
10. External production blockers are reported as `EXTERNAL_BLOCKED`, not worked
    around with fake production behavior.

### Task states

- `LOCKED`: dependency is not yet integrated.
- `READY`: manager may assign it.
- `IN_PROGRESS`: an execution task is implementing it.
- `VERIFY`: committed, pushed and ready for manager review.
- `BLOCKED`: a local technical blocker prevents completion.
- `EXTERNAL_BLOCKED`: external credentials or infrastructure are required.
- `INTEGRATED`: manager accepted and integrated the commit.
- `DONE`: integrated and the independent gate passed.

Only the manager may set `INTEGRATED` or `DONE`.

### Handoff contract

Every UI/UX or Features/Backend handoff must include:

- task ID and business outcome;
- commit SHA, pushed branch and changed files;
- exact checks run and results;
- checks skipped and the reason;
- permission, tenant, notification, BusinessEvent, AI, migration and env impact;
- manual verification;
- remaining risks or a precise blocker.

The manager reviews the diff and reruns a proportionate gate. If accepted, the
manager integrates it, pushes the integration branch and assigns the next
unblocked item. No technical approval from the project owner is required between
items.

The manager pauses for the owner only when work requires:

- a product/business choice with materially different outcomes;
- external credentials, paid services or live accounts;
- production deployment or mutation of live data;
- destructive or difficult-to-recover action outside the agreed repository
  workflow.

## 5. Required Skills

UI/UX must use:

- `zani-review-frontend`;
- `zani-run-verification`;
- `zani-analyze-crm-product` for workflow/product comparisons;
- Playwright for browser-level verification of user-facing work.

Features/Backend must use:

- `zani-change-crm-domain`;
- `zani-review-access`;
- `zani-run-verification`;
- `zani-review-performance` for measured performance work;
- `zani-evaluate-ai-grounding` when AI behavior is touched;
- `zani-build-integration-reliability` when connector behavior is touched.

The external `agency-agents-main` library is a reference roster, not a substitute
for repository rules. The manager selects relevant profiles per task instead of
loading every profile into every prompt. Default references:

- UI/UX: Frontend Developer, UI Designer, UX Architect, Accessibility Auditor,
  Test Automation Engineer and Reality Checker;
- Features/Backend: Backend Architect, API Tester, Database Optimizer, Code
  Reviewer, Test Results Analyzer and Git Workflow Master;
- manager: Product Manager, Senior Project Manager, Software Architect and
  Evidence Collector.

Repository-local ZANI skills and `AGENTS.md` take precedence over generic agent
profiles.

## 6. Product Completion Standard

A task is not complete merely because a page renders or an endpoint returns
`200`. The affected workflow must satisfy, where applicable:

- a reachable user entry point and clear next action;
- real data or an honest no-data state;
- loading, submitting, success, validation, domain error, forbidden, empty and
  retry behavior;
- keyboard and mobile usability;
- backend permission, Business tenant isolation and capability enforcement;
- service-backed lifecycle mutations;
- activity/audit/notification behavior without duplicate noise;
- stable API error codes consumed through `frontend/src/api/*`;
- tests for happy path, denial, tenant isolation and important failure states.

The product is judged as an end-to-end operating loop:

```text
capture -> qualify -> act -> follow up -> measure -> recover
```

Every suggestion inside authenticated UI must be actionable and grounded in real
application state. Decorative, marketing or fake-demo content is prohibited.

## 7. Active Execution Queue

### Phase P1 — Correctness and Action Feedback

Frontend and backend run in parallel. P1 closes only after both items are
integrated and the manager gate passes.

#### F-101 — Critical Action Feedback and Recovery UX

Status: `DONE`
Owner: UI/UX  
Depends on: integrated baseline

Assignment: 2026-07-24, `codex/frontend-pilot-readiness` at `b312390`.

Goal: make core authenticated actions predictable and recoverable.

Required work:

- inventory create/update/archive/restore/assign/status actions in Leads,
  Clients, Deals, Tasks, Calendar and Inbox;
- apply one interaction contract using existing primitives and i18n:
  submitting state, duplicate-submit prevention, success confirmation, field
  validation, known domain-error mapping, forbidden/unavailable handling,
  retry/recovery, mandatory confirmations/reasons and focus restoration;
- remove silent failures, stale optimistic state and raw technical errors;
- keep network calls in `frontend/src/api/*`;
- do not add decorative explanations or fake recommendations.

Acceptance:

- representative actions in every listed workspace follow the same contract;
- API failure leaves the user in a recoverable state without unnecessary data
  loss;
- successful mutations refresh affected lists/cards/counters predictably;
- disabled modules and denied actions do not look like broken pages;
- tests cover success, validation/domain failure and transient failure.

Required gates:

- relevant frontend unit/component tests;
- targeted Playwright workflow checks;
- `cd frontend && npm run build`;
- mobile owner/manager smoke from `docs/testing.md`.

Completion evidence (2026-07-24):

- accepted source commits:
  `db1496a62fe92e26bba9c6d0123d1c279afe4ed5` and
  `55819a8f0879ad82fab9f9e598ba779652de02a0`;
- integration commits:
  `07d4562` and `7874590` on
  `codex/project-integration-2026-07`;
- execution and manager verification:
  `npm run test:action-feedback` (`3 passed`), `npm run build` with `4460`
  i18n keys across RU/KK/EN, and `npm run check:bundle` with the largest JS
  chunk at `465.3 kB`;
- manager Playwright verification:
  representative action-feedback matrix `1 passed`, Calendar reschedule
  recovery/focus `1 passed`, and mobile owner/manager smoke `2 passed`;
- no backend permission, tenant, BusinessEvent, AI, migration, provider or
  environment change; backend and live-provider checks were skipped as
  out-of-scope for the frontend-only task.

#### B-101 — Capability Enforcement for CRM Custom Actions

Status: `DONE`
Owner: Features/Backend  
Depends on: integrated baseline

Assignment: 2026-07-24, `codex/backend-pilot-readiness` at `b312390`.

Goal: prevent indirect/custom actions from bypassing the product
capability/profile layer.

Required work:

- inventory DRF custom actions, AI tools and automation paths that create, link,
  read or mutate module-owned CRM resources;
- enforce the shared capability contract at backend and service boundaries;
- close the confirmed gap where a business with Deals disabled can create a deal
  through a Lead custom action;
- cover equivalent Inbox, automation and AI-assisted paths without duplicating
  permission logic;
- return the established module-disabled contract without leaking tenant data;
- keep views thin and lifecycle mutations service-backed.

Acceptance:

- a dentistry/profile business with Deals disabled cannot create, link, list or
  mutate Deals through indirect paths;
- enabled businesses retain their current happy path;
- role denial and cross-tenant access remain distinct and safe;
- denied actions produce no side effect, activity, audit or notification;
- focused tests cover happy path, capability denial, permission denial and
  tenant isolation.

Required gates:

- `manage.py check`;
- migration drift check;
- scoped CRM, Inbox, automation and AI tests affected by the inventory;
- full backend suite when shared capability/permission helpers change.

Completion evidence (2026-07-24):

- accepted source commits:
  `8d6a1156b913e867c9267e225291cc2c26cabf03` and
  `694b780a32c09b08fe68491972e072a3783a8420`;
- integration commits:
  `4fd4bb6` and `91dad9d` on
  `codex/project-integration-2026-07`;
- execution verification: focused capability paths `10 passed`; affected CRM,
  Inbox, automation and AI scope `193 passed` with one independently reproduced
  baseline status-code expectation excluded; correction scope `68 passed`;
- manager verification: the three correction regressions `3 passed`,
  `manage.py check` passed, migration drift reported `No changes detected`, and
  `git diff --check` passed;
- no migration, environment, provider or frontend change; no external provider
  call; the full backend suite was skipped because shared permission/capability
  helpers were not changed and the unrelated closed-lead appointment baseline
  still expects HTTP 400 while the established domain contract returns HTTP 409.

#### X-101 — P1 Integration Gate

Status: `DONE`
Owner: Manager  
Depends on: F-101 and B-101 integrated

- inspect both diffs for contract conflicts;
- verify frontend handling of module-disabled, permission, validation and
  transient errors;
- run combined backend/frontend gates and focused browser flows;
- record evidence before unlocking P2.

Completion evidence (2026-07-24):

- F-101 and B-101 diffs were independently reviewed and integrated without
  conflicts;
- combined backend gate: `manage.py check`, migration drift check, and focused
  capability/automation/AI regression suite (`9 passed`);
- combined frontend gate: action-feedback unit tests (`3 passed`), production
  build, bundle budget, desktop action matrix, Calendar recovery/focus and
  mobile owner/manager smoke all passed;
- known baseline warnings remain non-blocking: local JWT key length, React
  Router future flag, unordered BusinessMember pagination, and the separately
  documented closed-lead HTTP 400/409 expectation mismatch.

### Phase P2 — Daily Workflow Actionability

#### F-201 — Role-Aware Daily Workspaces

Status: `DONE`
Owner: UI/UX  
Depends on: X-101

Assignment: 2026-07-24, `codex/f201-role-aware-daily-workspaces` from integrated
P1 baseline `7874590`.

Refine Dashboard, Tasks, Inbox and Calendar around real overdue, unread,
upcoming, stalled and failed states. Every priority item must expose a direct
next action. AI recommendations appear only with real sources. Owner, manager,
operator and doctor routes require targeted desktop/mobile Playwright coverage.

Completion evidence (2026-07-24):

- source branch `codex/f201-role-aware-daily-workspaces` is clean and pushed
  through `524641204489543aa9f9f8660d30bfe3dd9e2d62`; integrated as
  `f2c0b97`, `7c9cd1a` and `bd6c27a`;
- owner, manager, operator and doctor daily workspaces now expose direct actions
  for real overdue, unread, upcoming, stalled and failed states;
- Inbox connector readiness uses real status queries with non-blocking
  loading/error recovery; a provider-status 503 does not hide conversations or
  working actions;
- dentistry keeps the shared CRM model while doctor actions are constrained to
  own appointments; disabled capabilities remain explicitly gated;
- deterministic repeated seed coverage resets appointment status and archive
  fields;
- independent review accepted the final diff; manager verification passed the
  daily-workspace unit suite (`4 passed`), production build with `4480` aligned
  i18n keys, bundle budget (largest chunk `466.3 kB`) and desktop/mobile
  Playwright (`4 passed`, `2` project-specific skips).

#### B-201 — Action Side-Effect Consistency

Status: `DONE`
Owner: Features/Backend  
Depends on: X-101

Assignment: 2026-07-24, `codex/b201-action-side-effects` from integrated P1
baseline `7874590`.

Make pilot-critical Lead, Deal, Task, Appointment and Conversation actions
produce consistent activity, audit, notification and automation effects across
API, Inbox, automation and approved AI entry points. Retries must not create
duplicate notifications or timeline noise. Denied and tenant-hidden paths must
have no side effects.

Completion evidence (2026-07-24):

- source branch `codex/b201-action-side-effects` is clean and pushed through
  `b916a463d7e40cc0aba07b859dcf81ac64993558`; integrated as `65e1b47`,
  `871345d`, `42fe486` and `ddc661f`;
- pilot-critical mutations keep activity, audit and notification behavior
  atomic and tenant-safe; denied or tenant-hidden paths create no side effects;
- Appointment note creation is an executable API action guarded by exact
  `appointments:update` object scope, including doctor `OWN` scope through the
  active same-business linked resource;
- Note, appointment activity and audit creation roll back together on failure;
  the frontend drawer calls the dedicated appointment action without changing
  the generic note flow;
- the stale closed-lead appointment test now matches the established
  `409 invalid_transition` contract; production behavior did not change;
- independent review accepted the diff; manager verification passed the exact
  correction test (`1 passed`), its full test class (`15 passed`), focused
  appointment-note tests (`6 passed`), `manage.py check`, migration drift and
  diff hygiene.

#### X-201 — P2 Workflow Gate

Status: `DONE`
Owner: Manager  
Depends on: F-201 and B-201 integrated

- role-by-role daily workflow smoke;
- side-effect evidence for representative mutations;
- no-data, disabled-module and provider-unavailable checks;
- full integration regression before P3.

Completion evidence (2026-07-24):

- F-201 and B-201 were independently reviewed, accepted and integrated without
  conflicts into `codex/project-integration-2026-07`;
- combined frontend verification passed daily-workspace tests (`4 passed`),
  action-feedback tests (`3 passed`), production build, `4480`-key i18n parity,
  bundle budget (`466.3 kB`) and desktop/mobile role workflow Playwright
  (`4 passed`, `2` project-specific skips);
- the first full backend run exposed only the already documented stale
  closed-lead HTTP 400 expectation while production correctly returned the
  established HTTP 409 contract; the test-only correction was independently
  verified and integrated;
- the final integration rerun passed all `842` backend tests in `1118.752s`;
- `manage.py check`, migration drift and integration diff hygiene passed;
- non-blocking local warnings remain limited to refresh-before-login 400,
  development HMAC key length and the React Router future flag.

### Phase P3 — Performance, Accessibility and Reproducibility

#### F-301 — Accessibility and Responsive Interaction

Status: `DONE`
Owner: UI/UX  
Depends on: X-201

Verify keyboard navigation, visible focus, dialog/drawer focus behavior, labels,
error announcements, contrast and core forms/tables/menus at mobile, tablet and
desktop breakpoints. Pilot-critical flows must be keyboard operable with no new
serious or critical automated accessibility findings.

Assignment: 2026-07-24, `codex/f301-accessibility-responsive` from the green
X-201 integration baseline.

Completion evidence (2026-07-24):

- source branch is clean and pushed through
  `330d6684510dbca99cf4a317465b24f14a6aabfa`; integrated as `d0d2ffa` and
  `de01d93`;
- shared dialogs/drawers now establish and trap focus, handle only the topmost
  overlay, close on Escape and restore the exact visible opener even after
  conditional unmount;
- MobileNav and header filters use the shared modal contract; shared form
  controls expose labels, invalid/error relationships and keyboard-complete
  Select/listbox behavior;
- contrast and responsive overflow were corrected with existing design tokens;
  calendar lifecycle smoke now uses a deterministic action locator;
- the first independent review rejected three keyboard/modal gaps; the
  correction closed every finding and the second review accepted the result;
- manager browser verification passed the desktop/tablet/mobile accessibility
  suite (`10 passed`, `5` intentional viewport skips), including five
  pilot-critical route axe scans with zero serious/critical findings, and the
  corrected calendar lifecycle smoke (`2 passed`);
- production build, `4481`-key i18n parity, action/daily policy tests and bundle
  budget passed; the largest chunk was `471.6 kB`.

#### B-301 — Measured API and Query Performance

Status: `DONE`
Owner: Features/Backend  
Depends on: X-201

Profile owner dashboard, Inbox list/summary, task queues, CRM card/timeline,
Calendar and core analytics at representative seed volumes. Fix only measured
N+1, missing-index, repeated-aggregate, unbounded-query or oversized-payload
problems. Record before/after evidence and regression budgets.

Assignment: 2026-07-24, `codex/b301-measured-performance` from the green X-201
integration baseline.

Completion evidence (2026-07-24):

- source branch is clean and pushed through
  `930a0f1ca7f26e10f2f79885a619f9601a80af06`; integrated as `54f3040` and
  `cc881a6`;
- measured query fixes replaced client-card Cartesian counts, CRM-card N+1,
  repeated task-summary queries and repeated work-queue counts without changing
  tenant, permission or API contracts;
- Inbox list ordering is now deterministic after scope/filter/distinct using
  `-updated_at, -id`;
- CRM-card related predicates remain database-side and fixed-shape instead of
  materializing unbounded related IDs in Python;
- the strict independent review rejected the first handoff for ordering and
  unbounded-predicate gaps; the correction closed both and the same reviewer
  accepted it;
- manager verification passed the tied-ordering and B-301 performance suite
  (`4 passed`), including tenant denials and all nine measured read surfaces;
- scaling from `60` to `300` rows per related entity kept maximum SQL at
  `13,837` characters and queries at `28` to `29`, while far-end activity,
  note, tag and attachment evidence remained visible;
- the source focused regression passed `78/78`, CRM E2E passed `11/11`,
  `manage.py check`, migration drift and diff hygiene passed; no migrations,
  dependencies, environment or external systems changed.

#### F-302 — Frontend Runtime and Maintainability

Status: `DONE`
Owner: UI/UX  
Depends on: F-301 integrated

Measure route chunks, request waterfalls and render churn. Split or refactor only
demonstrated hotspots while preserving API separation, i18n, design-system,
role, loading, error and responsive behavior.

Assignment: 2026-07-24, `codex/f302-runtime-maintainability` from the integrated
F-301/B-301 baseline.

Completion evidence (2026-07-30):

- source branch is clean and pushed through
  `7b2689c49c01e1c2494d1e01b9cf34e402b96bfb`; integrated as `2c3b2b8`,
  `b2dbb7c` and `b3d433f`;
- measured refactoring reduced the app-shell from `471.6 kB` to `353.9 kB`
  before gzip and removed the Framer Motion runtime chunk while preserving
  role, capability, responsive and i18n behavior;
- request budgets now wait for route-local successful workspace state, observe
  longer than the one-second waterfall budget and reject late, duplicate or
  missing API evidence; Deals requires exact list, board and summary requests;
- bundle verification requires exactly one `app-shell-*` chunk and has
  regression fixtures for missing, renamed, duplicate and oversized chunks;
- the first independent review rejected two false-green verification gaps; the
  correction closed both and the same reviewer accepted the final result;
- manager verification passed bundle fixtures (`5/5`), daily-workspace policy
  (`4/4`), production build with `4481` aligned i18n keys, bundle budget,
  runtime Playwright desktop/mobile (`6/6`) and focused role-workspace
  regression (`2 passed`, `2` intentional cross-project skips);
- no backend permission, tenant, BusinessEvent, AI, migration, dependency,
  provider or production-environment change.

#### B-302 — Deterministic Local Quality Gate

Status: `DONE`
Owner: Features/Backend  
Depends on: B-301 integrated

Audit Python dependency pinning and frontend lockfile; consolidate deterministic
migration, backend test, frontend build, browser smoke and dependency/security
commands that require no production credentials.

Assignment: 2026-07-24, `codex/b302-deterministic-quality-gate` from the
integrated F-301/B-301 baseline.

Completion evidence (2026-07-30):

- source branch is clean and pushed through
  `e881d6aba1b9715b6bad5fba74f478497659c94f`; integrated as `4ef9950`,
  `06737f6` and `c040174`;
- the quality gate uses a unique disposable SQLite database, dedicated browser
  ports, safe allowlisted environment values and disabled external providers;
- Python production and verification dependencies are fully pinned with hashes,
  the frontend lock matches its manifest, React/React DOM are pinned to
  `19.2.8`, React Router is pinned to `8.3.0`, and CI uses Node `22.22.0`;
- every run requires a resolved non-HEAD ancestor `--base-ref`; working-tree,
  index and committed-range diff hygiene, migration drift, backend, frontend,
  browser and security modes are consolidated in `scripts/codex_verify.py`;
- source verification passed the full local gate with `845` backend tests,
  production frontend build, mobile owner/manager smoke, hashed-lock
  installability, `pip-audit` and npm audit;
- integration exposed a React Router navigation race that could return a user
  from Integrations to an AI-agent profile; focused correction
  `2ce96f21e2fe34ae3abde9b79310be00f45e9dbe` was independently accepted and
  integrated as `fc425fe`;
- manager integration verification passed quality-gate unit tests (`15/15`),
  static, frontend, browser and security modes; npm and pip audits reported no
  known vulnerabilities, migration drift was empty and Django check was clean;
- no production credentials, live providers, migrations or `main` changes were
  used.

#### X-301 — P3 Quality Gate

Status: `DONE`
Owner: Manager  
Depends on: F-301, B-301, F-302 and B-302 integrated

- independent accessibility, responsive, query-budget and clean-gate review;
- full backend suite;
- frontend build and required Playwright smoke;
- dependency and diff-hygiene review.

Completion evidence (2026-07-30):

- the independent review first rejected dashboard duplicate appointment rows
  and an accessibility false-green that could scan loading UI; corrections
  `5a80ef832be637cb8f1a5144a661017016ff13cb` and
  `7265dcd8e6ab5b67e5038be99b45325226ae451d` were accepted and integrated as
  `c6aa753` and `7599f35`;
- owner and manager dashboards now deduplicate overlapping appointment queues
  by id before the four-row slice and expose readiness only after core data
  loading; the focused policy/unit gate passed `6/6` and rendered dashboard
  regression passed `1/1`;
- accessibility waits for route-local ready state, absence of busy/error state
  and completion of finite animations before Axe and overflow checks; the
  desktop/tablet/mobile suite passed `10` runnable tests with `5` intentional
  viewport skips and zero serious or critical Axe findings;
- confirmed Inbox contrast defects were corrected locally without redesign;
  mobile navigation race regression passed `1/1`, and mobile owner/manager
  smoke passed `2/2`;
- the full backend gate passed `845/845` tests in `1097.254s`; migration drift,
  Django system check and committed-range hygiene passed;
- production frontend build passed with `4481` aligned i18n keys; app-shell was
  `254.9 kB` against the `400 kB` budget and no JavaScript chunk exceeded
  `500 kB`;
- hashed Python locks, `pip-audit`, npm audit and safe Vite environment
  isolation passed with zero known dependency vulnerabilities;
- non-blocking follow-up evidence remains for deterministic ordering of the
  paginated `BusinessMember` queryset and explicit clean-tree enforcement
  outside `git diff --check`; both are recorded for certification review and do
  not invalidate the green P3 gates.

### Phase P4 — Local Pilot Certification

#### F-401 — Frontend Role and Workflow Certification

Status: `DONE`
Owner: UI/UX  
Depends on: X-301

Certify owner, manager, operator and doctor navigation and visibility across
Leads, Clients, Deals where enabled, Tasks, Calendar, Inbox, Dashboard and
Settings. Cover success, empty, forbidden, disabled-module,
provider-unavailable and recoverable failure states on desktop and mobile.
Fix only certification defects; no unrelated redesign.

Assignment: 2026-07-31, `codex/f401-frontend-certification` from the accepted
P3 integration baseline `9067d8b`.

Completion evidence (2026-07-31):

- source branch is clean and pushed through
  `f92225b49380b00dbf7095d65729bd851c0402a5`; integrated as `9533a86` and
  `fdf4d1a`;
- Settings navigation now requires the same `settings:update` permission as
  the route, and Command Palette commands, entity queries and cached dynamic
  results use the current business permission/action/capability contract;
- owner, manager, operator and doctor role visibility, dentistry-disabled
  Deals, recoverable queue/calendar/provider states and real retry interaction
  are covered in the focused browser matrix;
- the first independent review rejected an unconditional Command Palette path
  and a retry false-green; the focused correction closed both and the same
  reviewer accepted the corrected result;
- source verification passed daily-workspace policy `6/6`, the final
  desktop/mobile correction matrix `4` runnable tests with `2` intentional
  project skips, accessibility `10` runnable tests, interaction audit across
  `12` routes, visual audit across `13` route captures and the complete
  frontend quality gate;
- manager integration verification passed daily-workspace policy `6/6`, the
  production app/widget build with `4481` aligned i18n keys, bundle budget
  (`254.9 kB` app shell, no JavaScript chunk above `500 kB`) and committed-range
  diff hygiene;
- no backend domain/API, migration, dependency, notification, BusinessEvent,
  AI, live-provider, production-environment, redesign or new-feature change.

#### B-401 — Backend Business-Flow Certification

Status: `DONE`
Owner: Features/Backend  
Depends on: X-301

Certify clean migrations, full suite, cross-entity E2E, permission/tenant/
capability matrix, AI approval/no-data/provider-unavailable behavior, integration
mock retry/idempotency and secret/config safety. Live-provider checks stay
`EXTERNAL_BLOCKED`.

Assignment: 2026-07-31, `codex/b401-backend-certification` from the accepted
P3 integration baseline `9067d8b`.

Completion evidence (2026-07-31):

- source branch is clean and pushed at
  `153c8b039493ec1b009d1e66dd210230b055cf9d`; integrated as `72d280a`;
- platform-admin business-member pagination now has explicit primary-key
  ordering, with a 55-member/two-page API regression proving stable complete
  results without changing tenant, permission or capability scoping;
- the B-401 business-flow pack passed `265/265`, the complete backend suite
  passed `846/846`, and the focused pagination regression passed `1/1`;
- fresh SQLite migrations, migration drift and Django system checks passed;
  Python production/development hash locks were installable, `pip-audit` and
  npm audit reported zero known vulnerabilities, and the tracked secret scan
  returned zero high-confidence matches;
- AI approval/no-data/provider-disabled, integration retry/idempotency,
  capability, permission and tenant-isolation paths were included in the green
  certification pack; live-provider checks remain `EXTERNAL_BLOCKED`;
- an independent reviewer accepted the focused diff and independently passed
  migration drift, Django check, the warning-as-error pagination regression
  and two manager/cross-tenant denial tests; manager integration verification
  passed the same three focused pagination/access tests and diff hygiene;
- the consolidated Windows wrapper intermittently exited with OS access
  violation `0xC0000005` while spawning Python children; equivalent documented
  commands through the approved shared virtualenv were stable and green, so
  this is recorded as local runtime debt rather than an application failure.

#### X-401 — Final Integrated Pre-Pilot Gate

Status: `DONE`
Owner: Manager  
Depends on: F-401 and B-401 integrated

Assignment: 2026-07-31, manager certification on
`codex/project-integration-2026-07` after accepted F-401/B-401 integration.

The manager must:

1. create a clean local database and apply migrations;
2. prepare deterministic pilot users/data;
3. run the full backend suite;
4. run the frontend production build;
5. run role/mobile/browser workflows;
6. run dependency, secret and repository hygiene checks;
7. use Playwright to inspect actual pages, components, dialogs, drawers,
   popovers and failure states;
8. compare implemented mechanics against practical SMB CRM workflows;
9. publish a complete work report covering every integrated phase and accepted
   correction;
10. audit the existing CRM foundation entity by entity and end to end:
    Conversation/Inbox -> Lead -> Client -> Deal when enabled and/or
    Appointment -> Task/follow-up -> activity/audit/notification -> operational
    metrics;
11. classify every material finding as:
    verified locally ready, missing or defective existing CRM business logic,
    non-blocking quality debt, external production prerequisite, or genuinely
    new post-pilot feature;
12. remediate missing or defective foundational CRM logic before declaring the
    local cycle complete, then rerun the affected manager gate;
13. publish a local readiness report separating locally ready behavior, known
    non-blocking risks, external prerequisites and deferred new features.

Completion evidence (2026-07-31):

- the final full deterministic gate passed on
  `codex/project-integration-2026-07`: fresh disposable SQLite migrations,
  migration drift, Django check, the complete backend suite (`846/846` in
  `1011.098s`), frontend production/widget build, `4481`-key RU/KK/EN i18n
  parity, bundle budget, mobile owner/manager Playwright (`2/2`), hashed-lock
  installability, Python/npm dependency audits, tracked secret scan and Git
  diff hygiene were green;
- the Playwright Django harness deterministically ran
  `prepare_e2e_smoke_data` for `Zani E2E Demo` (`zani-e2e-demo`), preparing
  platform admin, owner, manager, operator and doctor identities together with
  niche CRM data, default pipeline, appointments, subscription and first
  conversation/channel data;
- accepted F-401 evidence additionally covered owner, manager, operator and
  doctor desktop/mobile visibility, Command Palette, disabled Deals,
  recoverable queue/calendar/provider states, accessibility, interaction and
  visual route audits;
- final focused Playwright inspection passed `5/5`: the task dialog,
  header-filter drawer, conditionally unmounted CRM entity drawer,
  notifications popover and recoverable queue/calendar/provider failure states,
  including focus, keyboard close/restoration and applicable Axe checks;
- the full browser run exposed deterministic pagination debt in the separate
  `/api/team/members/` endpoint; correction
  `27ed32e086639553092424fb4a9f395b484b56aa` was independently accepted and
  integrated as `15e54e9`;
- the correction adds stable primary-key ordering and a warning-as-error test
  across the 50-row page boundary while preserving same-tenant membership and
  staff/manager scope; manager migration/check plus focused access regression
  passed `2/2`, and the affected browser gate passed without
  `UnorderedObjectListWarning`;
- the existing local CRM chain was audited from Conversation/Inbox through
  Lead, Client, Deal when enabled and/or Appointment, Task/follow-up,
  activity/audit/notification and operational metrics; no remaining
  pilot-critical defect was found in the existing foundation;
- all material findings are classified in
  `actual_docs/X401_LOCAL_PILOT_READINESS_REPORT.md` as locally ready behavior,
  missing or defective existing CRM business logic (the four remediated
  certification defects), non-blocking local debt, external production
  prerequisites or deferred new post-pilot features;
- no production credential, live-provider rollout, new feature, new vertical,
  production environment or `main` change was made.

X-401 must not describe the CRM as locally complete while a pilot-critical gap
remains in capture, qualification, ownership, conversion, pipeline progression,
booking, follow-up, communication history, permissions, tenant isolation,
activity/audit, notifications, recovery or reporting. This is a completeness
gate for the existing product foundation, not authorization to invent new
features.

P4 completes the local product cycle. It does not claim production or paid-beta
readiness and does not authorize a push to `main`.

### Terminal stop gate

After X-401 is `DONE` and the final required checks are green, the manager must:

1. publish the final completion and readiness report;
2. stop all UI/UX, Features/Backend and review agents for this execution plan;
3. stop or delete the autonomous execution automation for this plan;
4. leave `main` untouched and keep the accepted result on the integration
   branch;
5. not create, assign or implement a new roadmap, feature, vertical change or
   post-pilot task without a new explicit instruction from the project owner.

The audit may document deferred new features and external prerequisites, but
they are not authorization to continue implementation. Once the current
document is complete, work stops for owner review and a separate prioritization
decision.

## 8. Manager Review Checklist

Before integration:

- [ ] task stayed inside its track and scope;
- [ ] unrelated user changes were preserved;
- [ ] existing services, API clients and design primitives were reused;
- [ ] permission, tenant and capability behavior was considered;
- [ ] user-facing states and accessibility were considered;
- [ ] migrations/env/dependency impact is explicit;
- [ ] targeted checks passed;
- [ ] manager verification passed;
- [ ] focused commit is pushed and traceable to one task ID.

After integration:

- [ ] update task status and evidence here;
- [ ] push the integration branch;
- [ ] synchronize the next track branch only by manager instruction;
- [ ] assign only the next unblocked item.

## 9. External Production Gates

- [ ] managed PostgreSQL with TLS and tested backup/restore;
- [ ] Redis/Celery worker and retry monitoring in production-like infrastructure;
- [ ] private object storage and retention policy;
- [ ] production email delivery and Sentry/error monitoring;
- [ ] live provider credentials, webhook validation and provider load tests;
- [ ] deployment, TLS, DNS, rollback and incident drills;
- [ ] privacy, legal, support and commercial launch approvals.

These must never be silently converted into local mock completion.
