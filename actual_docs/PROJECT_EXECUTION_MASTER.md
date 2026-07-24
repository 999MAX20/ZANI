# ZANI Pre-Pilot Execution Master

Status: active source of truth  
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

Status: `IN_PROGRESS`
Owner: UI/UX  
Depends on: X-101

Assignment: 2026-07-24, `codex/f201-role-aware-daily-workspaces` from integrated
P1 baseline `7874590`.

Refine Dashboard, Tasks, Inbox and Calendar around real overdue, unread,
upcoming, stalled and failed states. Every priority item must expose a direct
next action. AI recommendations appear only with real sources. Owner, manager,
operator and doctor routes require targeted desktop/mobile Playwright coverage.

#### B-201 — Action Side-Effect Consistency

Status: `IN_PROGRESS`
Owner: Features/Backend  
Depends on: X-101

Assignment: 2026-07-24, `codex/b201-action-side-effects` from integrated P1
baseline `7874590`.

Make pilot-critical Lead, Deal, Task, Appointment and Conversation actions
produce consistent activity, audit, notification and automation effects across
API, Inbox, automation and approved AI entry points. Retries must not create
duplicate notifications or timeline noise. Denied and tenant-hidden paths must
have no side effects.

#### X-201 — P2 Workflow Gate

Status: `LOCKED`  
Owner: Manager  
Depends on: F-201 and B-201 integrated

- role-by-role daily workflow smoke;
- side-effect evidence for representative mutations;
- no-data, disabled-module and provider-unavailable checks;
- full integration regression before P3.

### Phase P3 — Performance, Accessibility and Reproducibility

#### F-301 — Accessibility and Responsive Interaction

Status: `LOCKED`  
Owner: UI/UX  
Depends on: X-201

Verify keyboard navigation, visible focus, dialog/drawer focus behavior, labels,
error announcements, contrast and core forms/tables/menus at mobile, tablet and
desktop breakpoints. Pilot-critical flows must be keyboard operable with no new
serious or critical automated accessibility findings.

#### B-301 — Measured API and Query Performance

Status: `LOCKED`  
Owner: Features/Backend  
Depends on: X-201

Profile owner dashboard, Inbox list/summary, task queues, CRM card/timeline,
Calendar and core analytics at representative seed volumes. Fix only measured
N+1, missing-index, repeated-aggregate, unbounded-query or oversized-payload
problems. Record before/after evidence and regression budgets.

#### F-302 — Frontend Runtime and Maintainability

Status: `LOCKED`  
Owner: UI/UX  
Depends on: F-301 integrated

Measure route chunks, request waterfalls and render churn. Split or refactor only
demonstrated hotspots while preserving API separation, i18n, design-system,
role, loading, error and responsive behavior.

#### B-302 — Deterministic Local Quality Gate

Status: `LOCKED`  
Owner: Features/Backend  
Depends on: B-301 integrated

Audit Python dependency pinning and frontend lockfile; consolidate deterministic
migration, backend test, frontend build, browser smoke and dependency/security
commands that require no production credentials.

#### X-301 — P3 Quality Gate

Status: `LOCKED`  
Owner: Manager  
Depends on: F-301, B-301, F-302 and B-302 integrated

- independent accessibility, responsive, query-budget and clean-gate review;
- full backend suite;
- frontend build and required Playwright smoke;
- dependency and diff-hygiene review.

### Phase P4 — Local Pilot Certification

#### F-401 — Frontend Role and Workflow Certification

Status: `LOCKED`  
Owner: UI/UX  
Depends on: X-301

Certify owner, manager, operator and doctor navigation and visibility across
Leads, Clients, Deals where enabled, Tasks, Calendar, Inbox, Dashboard and
Settings. Cover success, empty, forbidden, disabled-module,
provider-unavailable and recoverable failure states on desktop and mobile.
Fix only certification defects; no unrelated redesign.

#### B-401 — Backend Business-Flow Certification

Status: `LOCKED`  
Owner: Features/Backend  
Depends on: X-301

Certify clean migrations, full suite, cross-entity E2E, permission/tenant/
capability matrix, AI approval/no-data/provider-unavailable behavior, integration
mock retry/idempotency and secret/config safety. Live-provider checks stay
`EXTERNAL_BLOCKED`.

#### X-401 — Final Integrated Pre-Pilot Gate

Status: `LOCKED`  
Owner: Manager  
Depends on: F-401 and B-401 integrated

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
