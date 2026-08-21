# ZANI Pre-Pilot Code Readiness Master

- Status: **ACTIVE / ANALYSIS COMPLETE / EXECUTION NOT STARTED**
- Created: 2026-08-21
- Baseline branch: `codex/fallback-fb-002-safe-envelope-sanitization`
- Baseline revision: `9cde5ec78120453bfe972496599e1d86fa7733ad`
- Scope: final repository work required before a controlled pilot, excluding live infrastructure and new product features
- Owner: ZANI manager workflow

## 1. Purpose

This document is the final code-readiness master before the controlled ZANI
pilot. It consolidates the current backend, security, CRM, frontend, fallback
and certification evidence into one ordered execution boundary.

It answers four questions:

1. What is already implemented and independently verified?
2. What remains functionally incomplete or insufficiently proven?
3. What is a hard pilot blocker rather than optional polish?
4. What exact gates must pass before the code can be called pilot-ready?

This document does not authorize implementation by itself. Execution starts
only after explicit owner approval and follows the phase stop gate.

## 2. Scope Boundary

Included:

- backend application logic and server-enforced invariants;
- authentication, sessions, MFA, tenant isolation, permissions and secrets;
- canonical CRM entities and their daily workflows;
- merchant frontend and daily UX;
- error, fallback, recovery and draft-preservation behavior;
- browser, API, persistence, accessibility and build certification;
- remediation of source-backed security findings discovered by this review.

Excluded from the code-readiness percentage:

- domain, DNS, CDN, TLS and hosting;
- live PostgreSQL, Redis, Celery workers/beat and private object storage;
- production SMTP, Sentry and backup/restore infrastructure;
- real Meta, Telegram, marketplace, payment or other provider credentials;
- production load evidence and live provider certification;
- dentistry or another vertical adaptation;
- new CRM features, new integrations and product roadmap expansion.

Those items form a separate deployment gate after the code gate is closed.

## 3. Executive Verdict

### 3.1 Current readiness

The repository has a strong functional foundation, but it is **not currently
safe to call pilot-code-ready**.

Two different percentages must not be mixed:

- functional implementation completeness: **76-82%**;
- blocker-weighted readiness for a controlled pilot: **62-68%**.

The lower pilot-readiness figure is deliberate. A critical security path, five
high-severity paths, an unfinished frontend recovery layer and incomplete
UI-to-database failure certification cap the release even though most CRM
features and backend tests already exist.

### 3.2 Layer assessment

| Layer | Current assessment | After this master is closed |
| --- | ---: | ---: |
| Backend implementation and architecture | 88-92% | 95%+ |
| Backend and security as one pilot gate | 72-78% | 90-93% |
| Core CRM logic | 80-85% | 90-95% |
| Frontend and daily UX | 70-75% | 85-90%, subject to owner visual sign-off |
| Fallback and recovery | 35-40% | 90%+ |
| Functional certification | 65-70% | 95%+ |
| Overall pilot-code readiness | 62-68% | 90-95% |

These values are evidence-weighted, not an arithmetic average. Any open
critical/high security finding or failed final gate keeps the overall release
below pilot-ready regardless of the number of implemented screens.

### 3.3 Correction to the previous assessment

The earlier estimate of `90-93%` for backend and security described the known
hardening baseline before an independent source-to-sink security review. The
2026-08-21 review found concrete bypasses at invitation, platform, support,
webhook, automation and outbound-network boundaries. The architecture remains
strong, but the combined backend/security release score is reduced to
`72-78%` until those findings are remediated and regression-tested.

## 4. Assessment Method

Each layer is evaluated on five levels of proof:

1. implementation exists in current source;
2. server-authoritative permissions and invariants exist;
3. focused tests cover the behavior;
4. the real UI, API and persisted state agree end to end;
5. validation, denial, timeout, offline, conflict and recovery behavior is
   proven.

A feature that satisfies only levels 1-3 is implemented but not fully
certified. A pilot-critical journey is complete only at level 5.

Evidence reviewed:

- current Git revision and active documentation;
- backend access, session, MFA, error, secrets and tenant boundaries;
- CRM models, services, viewsets and cross-entity tests;
- frontend route registry, API inventory and browser suites;
- accepted full backend result `906/906` after FB-002;
- frontend build, bundle, dependency and migration gates from the same accepted
  revision;
- prior `138`-scenario Playwright run across desktop, tablet and mobile;
- fallback inventory: `43` routes, `580` frontend API operations, `13`
  background-task surfaces, `83` async/provider statuses and `27` stable
  backend error codes;
- independent Codex Security scan
  `d09b8e41-0fcb-4c8c-b47a-1676792d7958` against the frozen baseline.

The security scan was risk-focused static review. It covered the critical
authentication, tenant, platform, support, webhook, integration, automation,
AI, credential and frontend-token surfaces, but it was not a manual line-by-line
closure of all `1198` repository files and did not test a deployed system.

## 5. Layer A - Backend And Security

### 5.1 Confirmed strengths

The backend is not a collection of thin CRUD endpoints. Its main architecture
already has the right production-oriented foundations:

- default DRF authentication is JWT and default access is authenticated;
- normal tenant viewsets scope querysets through accessible businesses;
- resource/action permissions are server-enforced through a centralized
  catalog;
- canonical business roles are Owner, Administrator, Manager, Operator and
  Specialist;
- OWN, TEAM and BUSINESS scopes exist and are applied to proposed write state;
- representative serializers reject cross-business relations and inactive
  assignments;
- archive/restore, audit and activity behavior is centralized;
- refresh tokens use HttpOnly cookies, rotate and are blacklisted;
- password reset is enumeration-resistant and password policy is centralized;
- TOTP MFA uses encrypted secrets, hashed single-use recovery codes, challenge
  expiry, attempt limits and replay prevention;
- privileged MFA is enabled by default in production-like environments for the
  roles currently included by the predicate;
- connector credentials have an AES-256-GCM keyring, key IDs, authenticated
  context and rotation support;
- unknown API failures use a safe envelope and request correlation rather than
  returning exception strings or stack traces;
- persisted error fields pass through shared sanitization boundaries;
- dependency locks, pip/npm audits, Django checks, migration drift, frontend
  build and bundle gates passed at the accepted FB-002 revision;
- AI mutation tools are permission-checked at execution time and require
  payload-bound approvals where applicable;
- background runs use tenant-scoped idempotency, atomic claims, bounded retries
  and stale-lock recovery.

### 5.2 Confirmed security blockers

The security scan confirmed `11` open findings: `1 critical`, `5 high` and `5
medium`. No controlled pilot may start while the critical or high findings are
open.

| ID | Severity | Finding | Pilot consequence |
| --- | --- | --- | --- |
| SEC-001 | Critical | `platform_manager` can call landing activation, reset an existing user's password/role and reassign an existing tenant owner by `landing_id` | direct account and tenant takeover path |
| SEC-002 | High | a support grant can be moved from an authorized business to another business because update authorizes only the old state | support-grant tenant boundary bypass |
| SEC-003 | High | public invitation acceptance can set a password and global role on an existing social-only account | account takeover by a malicious inviter |
| SEC-004 | High | `platform_manager` is omitted from mandatory privileged MFA | globally privileged password-only session |
| SEC-005 | High | WhatsApp HMAC verification can be bypassed with an arbitrary non-empty internal-secret header | forged conversations, statuses and automations |
| SEC-006 | High | Instagram webhook verification succeeds when signing secrets are absent | unauthenticated CRM message injection |
| SEC-007 | Medium | logout/password/session revocation invalidates refresh tokens but not already issued access JWTs | up to 15 minutes of residual stolen-token access |
| SEC-008 | Medium | outbound webhook validation is vulnerable to redirect or DNS-rebinding SSRF | requests to private, metadata or internal services |
| SEC-009 | Medium | automation conditions traverse arbitrary dotted model attributes and expose match results | sensitive-field comparison oracle, including password hashes |
| SEC-010 | Medium | generic connector/channel `config_json` accepts plaintext credentials outside the encrypted service | credential exposure through DB or backup compromise |
| SEC-011 | Medium | outbound webhook code reads the complete response before truncation | worker memory exhaustion by a controlled endpoint |

### 5.3 Source boundaries for remediation

The principal source locations are:

- platform activation: `apps/core/platform_views.py`,
  `apps/businesses/activation.py`, `apps/accounts/models.py`;
- support grants: `apps/core/security_views.py`,
  `apps/core/serializers.py`, `apps/core/permissions.py`;
- invitation acceptance: `apps/businesses/views.py`,
  `apps/businesses/serializers.py`, `apps/accounts/social_auth.py`;
- platform MFA: `apps/accounts/mfa.py`;
- session revocation: `apps/accounts/session_security.py`,
  `apps/accounts/auth_views.py`, `config/settings.py`;
- Meta webhooks: `apps/integrations/views.py`,
  `apps/integrations/providers/whatsapp.py`,
  `apps/integrations/providers/instagram.py`;
- outbound webhooks: `apps/integrations/webhooks.py`;
- automation fields: `apps/automations/serializers.py`,
  `apps/automations/engine.py`;
- plaintext connector configuration: `apps/integrations/serializers.py`,
  `apps/bots/serializers.py`, `apps/core/viewsets.py`.

### 5.4 Required backend/security closeout

The backend/security layer becomes pilot-ready only when:

- every critical/high finding is fixed with happy, denial, tenant and replay
  tests;
- medium findings are fixed or explicitly risk-accepted by the owner with a
  dated rationale; the preferred path is to fix all eleven before pilot;
- platform mutations are administrator-only and consume recent MFA step-up;
- activation cannot mutate an existing user password or existing tenant owner;
- support-grant creation/update validates both current and proposed state;
- invitations never mutate an existing account without ownership proof;
- every globally privileged role is MFA-protected;
- access/session revocation semantics are explicit and tested;
- all provider webhooks fail closed before parsing or tenant resolution;
- outbound connections revalidate redirects/peers and bound response bytes;
- automation condition fields use explicit safe extractors;
- generic JSON configuration cannot persist secrets;
- the full backend, security, migration and dependency gates pass again;
- a second security scan reports no unresolved critical/high finding.

## 6. Layer B - Core CRM Logic

### 6.1 Canonical foundation

The generic product foundation remains:

```text
Inbox -> Leads -> Clients -> Deals -> Appointments/Calendar -> Tasks -> Analytics
```

Business type is descriptive metadata. The current foundation does not hide
Deals, rename Leads for dentistry or add medical records. Vertical adaptation
remains future owner-approved product work.

### 6.2 Implemented entities and mechanics

| Area | Implemented foundation | Current proof | Remaining proof |
| --- | --- | --- | --- |
| Inbox | conversations, messages, ownership, handoff, status, CRM links, bot/operator flows | backend services and representative browser flows | provider failure, retry, duplicate/out-of-order and full delivery recovery |
| Leads | source, status, responsible user, contact/close/lost/reopen, follow-up, deal/appointment creation | service-backed actions and API tests | full UI-to-persistence qualification journey in every role and failure state |
| Clients | contacts, status, relations, CRM card, duplicate warning and merge | merge/dry-run and cross-entity backend evidence | browser merge conflicts, validation and recovery |
| Deals | canonical six-stage pipeline, owner, value, tasks, won/lost/reopen and reason rules | canonicalization migration, backend actions and kanban browser coverage | complete drag/action/persistence/error certification |
| Appointments | working hours, availability, overlap, resource, responsible user, confirm/reschedule/cancel/complete/no-show | lifecycle services, conflict tests and calendar browser coverage | all role/mobile/failure and draft-preservation scenarios |
| Tasks | assignment, take/start/complete/cancel/snooze/watch/comments, entity links, workload and escalation | service and role tests, representative UI coverage | full operator/specialist daily queue and recovery certification |
| Analytics/dashboard | CRM metrics, funnel, appointment, overdue, unanswered, manager performance and connector health | backend metrics and tests | owner dashboard UX redesign and final visual/product sign-off |
| Imports | validation, mapping, duplicate handling and job status | backend/import evidence and inventory | end-to-end browser validation, partial failure and recovery |
| AI/automation | suggestions, approvals, tool execution, runs, retries and audit | backend approval/idempotency evidence | fix security findings, then certify every merchant-visible failure/recovery path |

### 6.3 Server invariants already present

- every core record is business-scoped;
- related objects must belong to the same business;
- assignees must be active same-business members;
- disabled capabilities are rejected by backend paths;
- lifecycle transitions use domain actions rather than arbitrary UI state;
- lost/cancel/no-show paths require reasons where defined;
- appointment creation/rescheduling enforces working hours and conflicts;
- archive is the default destructive behavior for business records;
- actions generate activity, audit, notifications or BusinessEvents where the
  domain contract requires them;
- AI and automation mutations reuse permission/domain boundaries rather than
  receiving blanket bypasses.

### 6.4 What is not yet fully proved

The repository has backend cross-entity evidence, including representative
lead-to-deal, lead-to-appointment/task, deal terminal, inbox qualification,
duplicate merge, appointment lifecycle, BusinessEvent and AI approval flows.
That is not yet equal to complete application certification.

The following ten merchant journeys still need complete UI -> API -> database
proof for happy, validation, permission, tenant and infrastructure/provider
failure paths:

1. Inbox conversation -> lead -> responsible user -> next action.
2. Lead -> qualification -> client -> deal.
3. Deal -> stage -> task -> won/lost with reason.
4. Client -> appointment -> reschedule -> confirm -> complete/cancel/no-show.
5. Conversation -> linked CRM record -> task/follow-up.
6. Import -> validation -> duplicates -> visible CRM records.
7. Owner/administrator -> team access and role change.
8. Manager -> workload, overdue, funnel and team actions.
9. Operator/specialist -> assigned queue without owner-only data.
10. AI suggestion -> evidence -> approval -> audited mutation.

### 6.5 CRM conclusion

Core CRM is substantially implemented. The remaining work is primarily
security remediation, recovery behavior and proof of completeness rather than
creation of missing top-level CRM entities. The `80-85%` score reflects that
the foundation exists but all ten daily journeys are not yet certified from
the real browser through persisted state.

## 7. Layer C - Frontend And Daily UX

### 7.1 Confirmed foundation

- active route coverage registry exists for the merchant application;
- shared loading, empty, forbidden and error primitives exist;
- shared CRM overlay preserves list context for Leads, Clients and Deals;
- Leads and Clients use full-width data workspaces and compact actions;
- Deals use a canonical, denser six-stage kanban;
- search/filter interaction contracts have dedicated regression coverage;
- public login/signup clarity work is complete at its verified scope;
- desktop, tablet, mobile, accessibility, interaction, visual and bundle gates
  have passed representative automated runs;
- RU/KK/EN key alignment and production builds have passed the accepted gate.

### 7.2 Completed UI/UX scope

- UX-1: CRM entity workspace foundation is done;
- UX-2: deal pipeline language, duplicate-stage cleanup and kanban density are
  done;
- Leads toolbar density follow-up is done;
- public auth-page clarity follow-up is done.

### 7.3 Open UI/UX scope

- UX-3 owner/administrator dashboard redesign is planned;
- UX-4 final browser certification is planned;
- Tasks, Calendar, Inbox and Settings have broad implementation but have not
  received the same complete owner-led visual polishing pass;
- additional pages, forms, overlays, responsive layouts and empty/error states
  require page-by-page owner review;
- very large page components increase regression and maintainability risk,
  especially Settings, Conversations and Calendar;
- automated visual checks prove stability against the chosen baselines, not
  that the product design is subjectively complete.

### 7.4 Owner collaboration lane

Frontend completion is intentionally shared work:

1. run the current local frontend and backend;
2. inspect each route on desktop and mobile;
3. record owner observations in the defect knowledge base;
4. generalize every shared defect across all affected pages;
5. implement one bounded UX phase at a time;
6. rerun focused interaction, visual, accessibility, build and bundle gates;
7. perform owner sign-off after the automated gates are green.

The owner visual lane may run in parallel with non-overlapping backend security
work, but final certification waits for both.

## 8. Layer D - Errors, Fallback And Recovery

### 8.1 Current state

`FB-001` and `FB-002` are done:

- the route/action/failure inventory exists;
- the backend has a stable safe error envelope;
- request correlation and taxonomy/retry metadata exist;
- persisted error fields use shared sanitization;
- the backend, static, security, frontend and migration gates passed at FB-002.

`FB-003` is ready. `FB-004` through `FB-010` are not started.

### 8.2 Confirmed gaps

- `getApiErrorMessage` is still referenced `126` times in frontend source;
- it can return raw strings, raw backend detail or arbitrary object values;
- crash boundaries can render runtime `error.message` or route `statusText`;
- direct technical fields remain in merchant-facing code paths, including
  `last_error`, `response_body` and `error_code` consumers;
- shared action feedback is not universal;
- session-expiry recovery is not fully standardized;
- offline/reconnect behavior and stale-response handling are not fully proven;
- form/message drafts are not consistently preserved;
- unsafe mutations do not yet have one consistent no-auto-retry policy in the
  UI layer;
- provider and async-job recovery differs by page;
- RU/KK/EN fallback copy and accessibility are not complete across every
  surface;
- full cross-role failure injection has not run.

### 8.3 Remaining fallback phases

| Phase | Required result |
| --- | --- |
| FB-003 | typed `AppError` normalization; raw parsing retired |
| FB-004 | one shared visual family for page, panel, form, toast and inline recovery |
| FB-005 | safe app/route crash boundaries with no runtime text leakage |
| FB-006 | migrate every direct technical-error consumer |
| FB-007 | standardized session expiry, offline/reconnect and draft preservation |
| FB-008 | standardized async job, provider and Inbox delivery recovery |
| FB-009 | complete RU/KK/EN copy and accessibility review |
| FB-010 | cross-role browser failure certification |

### 8.4 Fallback conclusion

The backend contract is ready for a unified frontend layer, but the user-facing
recovery experience is not. The current `35-40%` score is appropriate because
inventory and server safety are complete while most normalization,
presentation, recovery and browser failure proof remains open.

## 9. Layer E - Functional Certification

### 9.1 Accepted certification state

| Phase | State | Meaning |
| --- | --- | --- |
| FC-001 | PASS | route/action registry and guard exist |
| FC-002 | PASS | shared search/filter/sort/pagination contracts pass |
| FC-003 | PARTIAL | representative form/mutation/dialog/session contracts pass; exhaustive recovery is open |
| FC-004 | PARTIAL | deterministic role/tenant/data fixtures exist; full fault matrix is open |
| FC-005 | PASS | role/capability/tenant browser matrix passes at accepted scope |
| FC-006 | PARTIAL | representative merchant journeys pass; all ten are not UI/API/persistence certified |
| FC-007 | PASS | viewport, accessibility, focus, request/render and bundle budgets pass |
| FC-008 | BLOCKED | committed-range gate passed, but fallback and final journey prerequisites remain open |

### 9.2 Strong existing evidence

- `138` Playwright scenarios previously passed across desktop, tablet and
  mobile projects;
- the latest accepted backend result is `906/906`;
- Django system check and migration drift are clean at the accepted revision;
- frontend build, bundle and localization gates passed;
- npm and Python dependency audits passed at the accepted dependency baseline;
- interaction and visual audit workspaces were clean for the certified views;
- role and tenant authorization are independently covered by backend tests.

### 9.3 Why certification remains blocked

Broad green tests do not prove every interaction outcome. The final gate must
cover, where applicable:

- `400` validation;
- `401` session expiry and reauthentication;
- `403` capability/permission denial;
- tenant-safe `404`;
- `409` conflict and stale state;
- `429` throttling;
- unknown `500` recovery;
- timeout, offline and reconnect;
- duplicate, stale and out-of-order provider events;
- provider failure and retry;
- crash containment;
- draft, focus, filters, scroll and working-context preservation.

The newly confirmed security findings also invalidate a final PASS until their
attack paths are closed and added to regression suites.

## 10. Ordered Pre-Pilot Execution Queue

### Gate P0 - Security blockers

| ID | Work item | Priority | Status |
| --- | --- | --- | --- |
| PP-SEC-001 | lock platform activation to administrator + MFA step-up; separate provisioning, recovery and ownership transfer | P0 | DONE |
| PP-SEC-002 | make support grants proposed-state safe and tenant-immutable | P0 | READY |
| PP-SEC-003 | make invitation acceptance safe for existing accounts | P0 | READY |
| PP-SEC-004 | cover every platform/support role with MFA and step-up enforcement | P0 | READY |
| PP-SEC-005 | make WhatsApp and Instagram webhook authentication fail closed | P0 | READY |

### Gate P1 - Security completion

| ID | Work item | Priority | Status |
| --- | --- | --- | --- |
| PP-SEC-006 | add access-token session/auth epoch revocation | P1 | READY after PP-SEC-004 |
| PP-SEC-007 | harden outbound webhook redirects, peer validation and response limits | P1 | READY |
| PP-SEC-008 | replace automation dotted traversal with safe field extractors | P1 | READY |
| PP-SEC-009 | prohibit plaintext credentials in generic connector/channel JSON and migrate existing data | P1 | READY |
| PP-SEC-010 | rerun full security, dependency, backend and migration gates | P0 | BLOCKED by PP-SEC-001..009 |

### Gate P2 - Unified fallback and recovery

Execute `FB-003` through `FB-009` in their existing order. Do not duplicate
their detailed contracts here. After each phase, update the fallback plan and
defect knowledge base with exact evidence.

### Gate P3 - Owner-led frontend polish

- complete UX-3 dashboard redesign;
- inspect Tasks, Calendar, Inbox and Settings;
- inspect all remaining active routes on desktop and mobile;
- record and generalize every confirmed defect;
- receive explicit owner visual sign-off.

This lane may run alongside P0-P2 only when worktrees and changed files do not
overlap.

### Gate P4 - Failure and journey certification

- execute FB-010;
- certify the ten merchant journeys through real UI -> API -> database;
- cover the complete failure/recovery matrix;
- rerun desktop/tablet/mobile, accessibility, interaction and visual audits;
- rerun full backend, frontend, bundle, dependency and migration gates;
- rerun the security scan;
- close BE-REM-007 and FC-008 only after every result is green.

## 11. Phase Acceptance Rules

Every implementation phase must provide:

- focused branch and reviewable commit;
- clean working tree;
- exact changed behavior and affected roles;
- happy-path tests;
- validation and permission-denial tests;
- tenant-denial tests where business data is involved;
- expiry/replay/idempotency tests where sessions, webhooks or jobs are involved;
- no raw credentials, provider payloads, stack traces or customer data in
  evidence;
- `git diff --check`;
- proportional Django/frontend/browser gates;
- exact skipped checks and reason;
- source-of-truth documentation update.

No phase is accepted based only on an agent statement that tests are green.

## 12. Definition Of Pilot-Code-Ready

The code is ready for a controlled pilot only when all conditions are true:

- [ ] zero open critical/high security finding;
- [ ] all medium findings fixed or explicitly owner-accepted;
- [ ] full current backend suite passes;
- [ ] dependency audits pass at the agreed severity threshold;
- [ ] Django check and migration drift pass;
- [ ] frontend production build, localization and bundle budgets pass;
- [ ] FB-003 through FB-010 are complete;
- [ ] all ten merchant journeys pass UI -> API -> database proof;
- [ ] the full failure/recovery matrix passes;
- [ ] role, capability and tenant-denial matrices pass;
- [ ] desktop, tablet, mobile, accessibility and focus gates pass;
- [ ] owner visual/product review passes;
- [ ] defect knowledge base has no unresolved pilot-relevant blocker;
- [ ] final evidence report records commands, outputs, exclusions and risks;
- [ ] release candidate is a clean committed branch and `main` remains untouched
  until explicit owner approval.

## 13. What Remains After Code Readiness

If this master is closed successfully, the remaining work before a real public
deployment should be limited to the separate environment/release gate:

- provision and verify production data, queue and storage services;
- configure live credentials and provider consoles;
- deploy TLS, observability, email and backups;
- execute restore, worker, webhook and provider smoke drills;
- run production-like load and operational readiness checks;
- perform the owner-approved merge/release procedure.

New features, vertical adaptation and product expansion remain optional future
roadmap work. They are not hidden inside this pre-pilot foundation queue.

## 14. Documentation Precedence

This master owns overall sequencing and release readiness. Detailed task
contracts remain in:

- `UNIFIED_FALLBACK_EXPERIENCE_PLAN.md` for FB-001..FB-010;
- `APP_FUNCTIONAL_CERTIFICATION.md` for FC-001..FC-008;
- `BACKEND_AUDIT_REMEDIATION_PLAN.md` for BE-REM closure evidence;
- `CRM_WORKSPACE_UX_REFORM.md` for UX-3 and UX-4;
- `DEFECT_KNOWLEDGE_BASE.md` for regression precedents;
- `docs/security/PERMISSION_MATRIX.md` for role and support invariants;
- `docs/crm/CRM_PRODUCTION_LAYER_PLAN.md` for canonical CRM boundaries.

If a historical report conflicts with a current execution state, this master
and the active task-level plan take precedence. Historical documents remain
evidence and are not deleted.

## 15. Analysis Evidence

- Security scan ID: `d09b8e41-0fcb-4c8c-b47a-1676792d7958`.
- Security result: `1 critical`, `5 high`, `5 medium`.
- Accepted current backend evidence: `906/906` tests after FB-002.
- Accepted fallback state: `FB-001 DONE / FB-002 DONE / FB-003 READY`.
- Accepted certification state: four PASS, three PARTIAL, one BLOCKED.
- Accepted UX state: UX-1 and UX-2 complete; UX-3 and UX-4 planned.
- No implementation, migration, dependency or environment change was made by
  this analysis document.

### 15.1 PP-SEC-001 closure evidence

Status: `DONE` on `codex/pre-pilot-sec-001-platform-activation`.

Implemented invariants:

- only `platform_admin` can call landing activation;
- every call requires a recent MFA step-up token in
  `X-Zani-MFA-Step-Up`, and the account must still have confirmed MFA;
- `platform_manager` and merchant roles are denied before provisioning runs;
- an existing `landing_id` cannot be rebound to another owner;
- activation never changes an existing user's password, global role or active
  state;
- new passwords pass the shared Django password policy;
- legitimate same-owner retries remain idempotent;
- successful creates and retries write a sanitized critical security audit row;
- account recovery and ownership transfer remain separate from provisioning.

Verification:

- `python manage.py test apps.businesses.tests_activation -v 1` -> `10/10`
  passed, including endpoint-level `401`, `403`, `409`, password-policy,
  immutable-owner and immutable-account-state regressions;
- `python manage.py test apps.businesses.tests_activation apps.accounts.tests_mfa -v 1`
  -> `21/21` passed;
- `python manage.py test apps.core.tests_b3_contracts apps.core.tests_security apps.businesses.tests_access -v 1`
  -> `49/49` passed;
- `python manage.py check` -> no issues;
- `python manage.py makemigrations --check --dry-run` -> no changes detected;
- `python -m compileall -q apps` -> passed;
- `git diff --check` -> clean.

No schema or dependency change was required. Full browser and full repository
gates remain assigned to PP-SEC-010 after PP-SEC-002 through PP-SEC-009.
