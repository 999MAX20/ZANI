# ZANI Backend Reliability Execution Plan

Date: 2026-07-23

Status: in progress

Scope: backend-only CRM reliability and delivery. Frontend implementation belongs to the UI/UX workstream.

## 1. Goal

Deliver the already implemented B0-B6 backend into a clean branch, then close the remaining reliability gaps that can duplicate messages or CRM records, leave work unassigned, or return unstable errors.

Execution order:

```text
integrate B0-B6
-> outbound message outbox
-> CRM command idempotency
-> routing and SLA escalation
-> domain error taxonomy
-> production-gate resilience
```

External production credentials and managed services are deployment prerequisites, not repository implementation tasks. This plan adds or verifies the code paths required to use them safely, but it does not invent Redis, S3, SMTP, Sentry, PostgreSQL or provider secrets.

## 2. Completion Rules

- A checkbox becomes `[x]` only after implementation and the phase verification gate pass.
- Every merchant mutation remains tenant-scoped and permission-aware.
- Important user-facing actions write activity; sensitive actions write audit.
- Provider calls stay behind provider adapters.
- Background work is claimable, retryable, idempotent and observable.
- No frontend redesign files are edited in this backend track.
- Each phase is committed separately before the next phase starts.

## 3. Phase R0: Backend Integration Baseline

- [x] preserve the B0-B5 hardening commit `e45d119`;
- [x] create a backend-only B6 contract cleanup commit;
- [x] exclude B6 frontend files from backend history;
- [x] create a clean sequential backend implementation worktree;
- [x] preserve the verified B6 regression snapshot;
- [ ] push the final sequential backend branches after all phases pass.

Baseline evidence:

- B0-B5 complete Django suite: `441 passed, 7 warnings`;
- B6 complete Django suite: `445 passed, 7 warnings`;
- B6 focused contract tests: `90 passed, 2 warnings`;
- Django check, migration drift, frontend contract build and diff hygiene passed at B6 verification time.

## 4. Phase R1: Transactional Outbound Message Outbox

Business outcome: a manager reply is stored before provider delivery and cannot be sent twice because of HTTP retries, worker races or partial failures.

- [x] persist outbound `BotMessage` before calling a provider;
- [x] add explicit claim/running/retry/terminal delivery state;
- [x] add delivery attempts, next retry, lock and provider reference fields;
- [x] support a stable client idempotency key for send/retry requests;
- [x] move provider delivery to a Celery task with local eager-compatible fallback;
- [x] resume transient failures with bounded retry/backoff;
- [x] keep permanent failures visible and manually retryable;
- [x] preserve provider delivery/read webhook reconciliation;
- [x] expose safe queue health without message text or provider secrets;
- [x] cover happy path, duplicate request, concurrent claim, transient retry, permanent failure, permission denial and tenant isolation.

Phase gate:

```text
pytest apps/bots/tests.py apps/integrations/tests.py apps/core/tests_b1_runtime.py
manage.py check
makemigrations --check --dry-run
git diff --check
```

R1 verification evidence:

- `pytest apps/bots/tests.py apps/integrations/tests.py apps/core/tests_b1_runtime.py -q`: `134 passed`;
- `manage.py check`: passed;
- `manage.py makemigrations --check --dry-run`: no changes detected;
- clean SQLite `manage.py migrate --noinput`: passed through `bots.0010`;
- `git diff --check`: passed.

## 5. Phase R2: Idempotent CRM Create Commands

Business outcome: repeated HTTP requests return the first result instead of creating duplicate appointments, tasks or other critical records.

- [x] add a tenant-scoped CRM command idempotency record/service;
- [x] accept and normalize `Idempotency-Key` on critical create actions;
- [x] bind a key to business, actor, action and canonical request fingerprint;
- [x] return the stored result for an exact replay;
- [x] reject key reuse with different arguments;
- [x] protect lead -> appointment creation;
- [x] protect lead -> follow-up task creation;
- [x] protect other critical create actions identified by the implementation audit;
- [x] expire or prune old command keys safely;
- [x] cover replay, mismatch, concurrent claim, permission denial and cross-tenant key isolation.

Phase gate:

```text
pytest apps/leads/tests_crm_light.py apps/scheduling/tests.py apps/tasks/tests.py apps/core/tests_business_flows_e2e.py
manage.py check
makemigrations --check --dry-run
git diff --check
```

Protected R2 create actions:

- lead -> deal;
- lead -> appointment;
- lead -> follow-up task;
- inbox conversation -> appointment;
- inbox conversation -> task;
- direct appointment create;
- direct task create.

Inbox client/lead/deal creation keeps its existing linked-entity replay behavior and was not given a redundant second implementation.

R2 verification evidence:

- phase regression including the documented gate plus inbox coverage: `120 passed, 2 warnings`;
- targeted idempotency scenarios: `10 passed`;
- compatibility sample for keyed and unkeyed direct creates: `4 passed`;
- `manage.py check`: passed;
- `manage.py makemigrations --check --dry-run`: no changes detected;
- clean SQLite `manage.py migrate --noinput`: passed through `core.0010`;
- `git diff --check`: passed.

## 6. Phase R3: Automatic Routing And SLA Escalation

Business outcome: new work has an intentional queue or eligible owner, unavailable employees are skipped, and managers receive one actionable escalation when SLA expires.

- [x] define business routing policies `manual`, `round_robin` and `least_loaded`;
- [x] scope routing by business, resource and optional team;
- [x] select only active, available and role-eligible members;
- [x] make routing selection and assignment atomic;
- [x] preserve manual self-claim and manager reassignment;
- [x] support fallback reassignment policy without silently moving work by default;
- [x] add a periodic SLA attention scan for unassigned/stale work;
- [x] create idempotent manager escalation notifications;
- [x] record activity/audit for automatic assignment and reassignment;
- [x] expose bounded operational health counters;
- [x] cover owner, manager, operator, specialist, unavailable, team denial and tenant isolation scenarios.

Phase gate:

```text
pytest apps/core/tests_b2_roles_queues.py apps/core/tests_work_queues.py apps/businesses/tests_access.py apps/bots/tests.py apps/tasks/tests.py
manage.py check
makemigrations --check --dry-run
git diff --check
```

R3 implementation notes:

- `manual` is the default and never reassigns unavailable work;
- fallback reassignment requires `member_fallback` on the policy and an eligible same-business fallback member;
- business-wide policies are processed by the periodic unassigned-work sweep;
- team policies are selected explicitly through the routing service so multiple departments cannot race for the same unscoped item;
- eligible roles can be narrowed per policy; default worker pools prioritize managers/operators/staff/doctors rather than routing normal work to owners;
- an available owner is used only when an automatic business-wide policy has no eligible worker, preserving the solo-business workflow;
- the SLA incident row is unique per business/resource/entity/reason and only a new or reopened incident emits manager notifications.

R3 verification evidence:

- focused role/routing/SLA tests: `13 passed`;
- phase regression across roles, queues, business access, inbox and tasks: `139 passed`;
- `manage.py check`: passed;
- `manage.py makemigrations --check --dry-run`: no changes detected;
- clean SQLite `manage.py migrate --noinput`: passed through `businesses.0009`;
- `git diff --check`: passed.

## 7. Phase R4: Explicit Domain Error Taxonomy

Business outcome: the API returns stable machine-readable codes without guessing from English exception text.

- [ ] add domain API exceptions with explicit codes;
- [ ] preserve the shared `code`, `request_id`, `detail` and `errors` envelope;
- [ ] add `invalid_transition`;
- [ ] add `schedule_conflict`;
- [ ] add `assignee_unavailable`;
- [ ] add `module_disabled`;
- [ ] add `idempotency_conflict`;
- [ ] add `provider_unavailable`;
- [ ] add `temporary_service_failure`;
- [ ] keep tenant denials non-enumerable;
- [ ] replace string-heuristic mappings in the changed critical paths;
- [ ] document the backend code contract for the UI/UX workstream;
- [ ] cover error code, field errors, request ID, safe detail and tenant denial behavior.

Phase gate:

```text
pytest apps/core/tests_b3_contracts.py apps/core/tests_api_contracts.py apps/scheduling/tests.py apps/bots/tests.py
manage.py check
makemigrations --check --dry-run
git diff --check
```

## 8. Phase R5: Production Gate Resilience And Final Verification

Business outcome: readiness commands report actionable blockers instead of crashing, and the complete backend branch has a reproducible release gate.

- [ ] make operations/paid-beta health checks tolerate an unmigrated or unavailable database with a structured blocker;
- [ ] include outbound outbox lag/retry/failure health;
- [ ] include routing/SLA escalation lag/failure health;
- [ ] keep health payloads bounded and free of customer content;
- [ ] update production and backend source-of-truth documentation;
- [ ] update the old backend backlog so completed B0-B6 work is not shown as 145 open tasks;
- [ ] run a clean SQLite migration;
- [ ] run the complete Django suite;
- [ ] run production readiness, provider rollout and paid-beta commands;
- [ ] run diff hygiene and secret scan;
- [ ] commit and push the final sequential branches.

External deployment gates that must remain visibly pending until real infrastructure exists:

- [ ] managed TLS PostgreSQL and tested backup restore;
- [ ] TLS Redis with real Celery worker and beat;
- [ ] private S3-compatible storage;
- [ ] transactional SMTP;
- [ ] Sentry/release monitoring;
- [ ] real Telegram/WhatsApp/Instagram credentials and webhook smoke.

These external items do not block completion of repository code, but they block a paid-beta production declaration.

## 9. Deferred After Initial Dentistry Pilot

- recurring task scheduler;
- webhook automation action;
- complex workforce scheduling;
- marketplace write-back;
- clinical/EHR records;
- separate backend implementations per vertical.
