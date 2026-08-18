# ZANI X-401 Local Pilot Readiness Report

Date: 2026-07-31
Certified branch: `codex/project-integration-2026-07`
Production/main status: not changed and not certified

## Decision

The current integrated ZANI foundation is ready for owner review as a local
pilot build. The existing CRM lifecycle, role and tenant boundaries, recovery
states, activity/audit effects, deterministic local verification and core
authenticated UI have passed the required local certification gates.

This decision does not mean production or paid-beta readiness. Live providers,
production credentials, public webhooks, managed infrastructure, monitoring,
backups and deployment smoke remain external prerequisites.

## What the execution plan delivered

### P1 - Correctness and action feedback

- Critical Lead, Client, Deal, Task, Calendar and Inbox actions use consistent
  submitting, success, validation, forbidden, disabled and retry behavior.
- Backend capability checks protect indirect/custom CRM paths, including Deals
  disabled by business profile.
- Denied and tenant-hidden paths are verified to avoid business side effects.

### P2 - Daily workflow actionability

- Owner, manager, operator and doctor workspaces expose real next actions for
  overdue, unread, upcoming, stalled and failed work.
- Lead, Deal, Task, Appointment and Conversation actions consistently create
  the required activity, audit and notification effects.
- Appointment notes use exact object and role scope, including doctor own-scope.

### P3 - accessibility, performance and reproducibility

- Dialogs, drawers, menus and shared controls have keyboard/focus behavior and
  responsive coverage across desktop, tablet and mobile.
- Measured N+1, repeated aggregate, ordering and unbounded-query issues were
  corrected on CRM cards, Inbox, tasks, calendar, dashboard and analytics.
- The app-shell was reduced and protected by bundle and request-waterfall
  budgets.
- One deterministic local gate now covers migrations, backend, frontend,
  browser, dependency/security and Git hygiene without production credentials.

### P4 - local pilot certification

- Frontend role/capability navigation was certified for owner, manager,
  operator and doctor.
- Settings navigation and Command Palette discovery now use the same backend
  permission, action and capability contract as the target routes.
- Retry verification requires a real click and a new post-click request, which
  removes a prior false-green.
- Both business-member list endpoints now use deterministic primary-key
  ordering. Regressions cross the configured pagination boundary and preserve
  tenant/role scope.

## Existing CRM foundation audit

| Area | Locally verified behavior | Classification |
| --- | --- | --- |
| Conversation / Inbox | Conversation handling, provider-unavailable recovery, assignment and Inbox-to-CRM flow | Locally ready |
| Leads | Capture, qualification, ownership, assignment, lifecycle restrictions and conversion paths | Locally ready |
| Clients | Client records, duplicate/merge behavior, tenant isolation and linked CRM history | Locally ready |
| Deals | Pipeline/stage progression, won/lost rules, disabled-module enforcement and role visibility | Locally ready when enabled |
| Appointments | Booking, reschedule, cancel/no-show, overlap/working-hour rules, doctor own-scope and notes | Locally ready |
| Tasks / follow-up | Creation, assignment, completion/cancellation, overdue queues and entity linking | Locally ready |
| Activity / audit | Important lifecycle actions create traceable activity and sensitive actions create audit evidence | Locally ready |
| Notifications | Representative lifecycle effects, preferences, retry/idempotency and denied-path silence | Locally ready with local providers |
| Dashboard / reporting | Operational queues, deduplicated appointment metrics, analytics summary and role-aware navigation | Locally ready |
| AI assistance | Source/no-data behavior, explicit approval for critical mutations, provider-disabled behavior and audit trail | Locally ready with mocked/disabled provider |
| Integrations | Connector status, normalized events, retry/idempotency and safe local failure states | Locally ready with mocks; live rollout external |

The tested end-to-end chain is:

`Conversation/Inbox -> Lead -> Client -> Deal when enabled and/or Appointment
-> Task/follow-up -> activity/audit/notification -> operational metrics`.

The backend business-flow suite includes owner login/dashboard/lead assignment,
Lead-to-Appointment-to-Task, Lead-to-Deal won/lost, Inbox-to-AI qualification,
duplicate merge, appointment lifecycle, BusinessEvent timeline, AI approval and
command idempotency/recovery scenarios.

## Final X-401 evidence

- Fresh disposable SQLite database migrations: passed.
- Deterministic browser seed: the Playwright Django harness ran
  `prepare_e2e_smoke_data` for business `Zani E2E Quality Gate`
  (`zani-e2e-gate`) and prepared platform admin, owner, manager, operator and
  doctor identities plus niche CRM data, default pipeline, appointments,
  subscription and first-channel conversation data.
- Migration drift: `No changes detected`.
- Django system check: no issues.
- Complete backend suite: `846/846` passed in `1011.098s`.
- Frontend build: passed with `4481` aligned RU/KK/EN i18n keys and `2105`
  transformed modules; widget build passed.
- Bundle budget: no JavaScript chunk above `500 kB`; app-shell remained below
  its `400 kB` budget.
- Mobile owner/manager Playwright smoke: `2/2` passed.
- Accepted F-401 browser evidence: desktop/mobile role matrix, Command Palette,
  recoverable queue/calendar/provider states, accessibility, interaction and
  visual route audits passed.
- Final focused Playwright surface inspection passed `5/5`: the real task dialog,
  header-filter drawer, conditionally unmounted CRM entity drawer,
  notifications popover and recoverable queue/calendar/provider failure-state
  scenarios. The checks include visibility, keyboard focus/trap/restoration,
  Escape close behavior and serious/critical Axe findings where applicable.
- Python production/development hash-lock installability: passed.
- `pip-audit`: no known vulnerabilities.
- npm audit at moderate severity: `0` vulnerabilities.
- High-confidence tracked secret scan: `0` matches.
- Working-tree, index and committed-range diff hygiene: passed.
- Post-gate pagination correction: independent review accepted; focused manager
  regression `2/2` passed; affected browser gate passed without
  `UnorderedObjectListWarning`.

## Findings remediated during final certification

All four findings below were classified as **missing or defective existing CRM
business logic/verification**, remediated inside X-401, and then reverified:

1. Settings could be discoverable under a weaker UI condition than its route.
   Navigation now requires `settings:update`.
2. Command Palette could surface commands or cached entities without applying
   the complete current business/user capability contract. Discovery, queries
   and caching are now scoped.
3. A retry browser test could pass without proving a successful user click and
   new request. It now fails unless both occur.
4. Generic and team business-member pagination used unordered querysets. Both
   endpoints now have deterministic ordering with warning-as-error regressions.

No unresolved pilot-critical defect was found in the existing local CRM
foundation after these corrections and the affected reruns.

## Known non-blocking local debt

- On this Windows host, the consolidated wrapper intermittently exited with OS
  access violation `0xC0000005` while spawning Python children. The approved
  shared virtualenv commands were stable, and the final consolidated full gate
  also completed successfully. This is local runtime/tooling debt, not an
  observed application failure.

## External production prerequisites

These items are intentionally outside local completion and require live systems
or credentials:

- managed PostgreSQL with TLS and production connection settings;
- Redis plus Celery worker/beat deployment and operational monitoring;
- private production object storage and retention/access policies;
- SMTP/delivery provider setup;
- Sentry or equivalent production error monitoring and alerts;
- public HTTPS domains and webhook endpoints;
- live Telegram/Meta/other provider credentials and provider-side rollout;
- backup/restore evidence against deployed production-like infrastructure;
- deployed staging smoke and production release/rollback validation.

## Deferred new post-pilot features

The following are not defects in the certified existing foundation and were not
authorized or implemented by this plan:

- 1C/MySklad and additional provider-specific connectors;
- payment/acquiring expansion;
- realtime SSE/WebSocket delivery;
- advanced storage antivirus/quota workflows;
- additional industry verticals or a vertical-specific CRM model;
- any new roadmap feature beyond the current master document.

## Final boundary

The implementation is held on `codex/project-integration-2026-07`. `main` was
not modified or pushed. Further feature, integration, vertical or production
work requires a new owner decision after review of this report.
