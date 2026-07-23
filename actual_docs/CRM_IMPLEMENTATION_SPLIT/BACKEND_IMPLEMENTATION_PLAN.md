# ZANI CRM Backend Implementation Plan

Date: 2026-07-21

Status: implementation backlog

Scope: Django/DRF domain, permissions, runtime, APIs and production services

Owner: backend workstream

## 1. Purpose

This document isolates the backend work identified by the deep CRM audit. It is the recommended implementation track for this chat while frontend redesign continues separately.

The order is deliberate:

```text
tenant and permission invariants
-> lifecycle and concurrency safety
-> background runtime
-> role/work-queue contracts
-> trustworthy aggregates and errors
-> dentistry product profile
-> performance and production readiness
```

Do not begin with new screens or new vertical models while cross-tenant writes and non-atomic runtime actions remain possible.

Primary sources:

- `CRM_PRODUCTION_LAYER_PLAN.md`;
- `CRM_AUDIT_REQUIRED_CHANGES.md`;
- `actual_docs/CRM_CORE_WORKFLOW_AUDIT.md`;
- `actual_docs/CRM_TECHNICAL_MAP_AND_VERTICAL_MODES.md`;
- `docs/PERMISSION_MATRIX.md`;
- `docs/AI_ASSISTANT_RULES.md`;
- `docs/automation-runtime.md`;
- `docs/entitlements.md`;
- `docs/production-readiness.md`;
- `docs/provider-rollout.md`;
- `API_ACTION_CONTRACT.md`.

## 2. Current Backend Foundation To Preserve

The project already has substantial CRM infrastructure:

- `Business` tenant workspace and memberships;
- business roles, permission presets and scoped access concepts;
- clients, leads, deals, pipelines, tasks, appointments and resources;
- conversations, messages, bot channels, handoff and CRM linking actions;
- domain services for many lead, deal, task and appointment transitions;
- lifecycle serializers that block some direct status changes;
- activity timeline, audit logs and archive/restore patterns;
- scheduling working-hours, overlap and resource validation;
- notification models, preferences, role routing and delivery service;
- automations rules/runs and action execution foundation;
- integration adapters, encrypted credentials, webhook verification, idempotency and normalized `BusinessEvent` records;
- source-grounded AI rules, no-data fallback, approvals and usage entitlements;
- health/readiness checks and production audit commands;
- onboarding status/channel/message services and APIs.

The plan below hardens and connects this foundation. It is not a request to rewrite the backend.

## 3. Backend Non-Negotiable Rules

1. Every merchant read and write is tenant-scoped.
2. Related objects in one mutation must belong to the same `Business`.
3. Owners, assignees, watchers and responsible users must be active members of that business.
4. Permission scope applies to create as well as read/update/delete.
5. Lifecycle state changes go through services/state machines.
6. Important actions write activity; sensitive actions write audit.
7. Background work must be idempotent, claimable, retryable and observable.
8. Critical AI mutations require approval and execute at most once.
9. Provider-specific behavior stays behind connector/provider services.
10. A frontend capability flag is not security; disabled modules are guarded in the backend.

## 4. P0: Tenant Isolation And Authorization

### BE-P0-01. Validate all Deal relations against the request business

Confirmed gap:

- Deal serializer validates parts of pipeline/stage and membership behavior but does not consistently prove that `client`, `lead` and `pipeline` belong to the selected business.

Required implementation:

- [ ] validate `client.business == business`;
- [ ] validate `lead.business == business`;
- [ ] validate `pipeline.business == business`;
- [ ] validate stage belongs to the selected pipeline and business;
- [ ] validate owner/responsible membership is active in the same business;
- [ ] centralize relation validation in reusable domain/serializer helpers where appropriate;
- [ ] ensure update cannot retain or introduce a foreign relation.

Acceptance tests:

- same-business create/update succeeds;
- foreign client, lead, pipeline, stage and owner are rejected;
- guessed foreign IDs do not reveal object details;
- existing deal lifecycle tests remain green.

Evidence area:

- `apps/crm/serializers.py`.

### BE-P0-02. Prevent cross-business role/team/member relationships

Confirmed gap:

- membership/team serializers do not consistently ensure that business role, team and member belong to the same business.

Required implementation:

- [ ] validate role belongs to the target business;
- [ ] validate team belongs to the target business;
- [ ] validate team member's membership belongs to the same business;
- [ ] prevent a manager from assigning relationships outside delegated scope;
- [ ] ensure direct membership creation cannot bypass invitation/owner policy where that policy is required;
- [ ] add database constraints where they can safely express the invariant;
- [ ] keep service-layer validation for constraints that span indirect relationships.

Acceptance tests:

- owner/admin can create valid same-business relationships;
- foreign role/team/member IDs are rejected;
- manager scope denial is covered;
- invitation acceptance still creates the intended membership.

Evidence area:

- `apps/businesses/serializers.py`;
- membership and invitation services/views.

### BE-P0-03. Close AIRequestLog create access bypass

Confirmed gap:

- custom create behavior bypasses the tenant viewset's normal business-access enforcement;
- broad serializer fields increase the blast radius.

Required implementation:

- [ ] route creation through tenant access enforcement;
- [ ] derive user/business/server-owned fields from request context;
- [ ] make log status/result/sensitive metadata read-only where applicable;
- [ ] prevent users from creating logs for another tenant or another user;
- [ ] prefer service-owned log creation if direct public creation is not a real merchant use case.

Acceptance tests:

- valid tenant request succeeds only for allowed action;
- foreign business/user payload is ignored or rejected;
- serializer cannot set server-owned fields;
- logs remain sanitized.

Evidence area:

- `apps/ai_core/views.py`;
- AI request serializers and services.

### BE-P0-04. Enforce OWN/TEAM scope on create

Confirmed systemic gap:

- generic permission checks receive no object during create, so object-dependent OWN/TEAM scope can be skipped.

Required implementation:

- [ ] define create-scope rules per resource;
- [ ] evaluate validated relationships before persistence;
- [ ] reject creation on behalf of another member when role scope is `OWN`;
- [ ] restrict `TEAM` creates to active memberships inside the caller's team scope;
- [ ] derive creator/owner/assignee server-side where the resource contract requires it;
- [ ] audit all tenant viewsets using generic `perform_create`;
- [ ] include notification preferences and similar user-owned records in the audit.

Acceptance tests:

- owner/admin broad create remains valid;
- OWN user can create only an owned record;
- TEAM user cannot create for a foreign team or business;
- create, update and custom action scopes behave consistently.

Evidence area:

- `apps/businesses/access.py`;
- `apps/core/viewsets.py`;
- tenant-scoped serializers/viewsets.

### BE-P0-05. Close generic BotConversation mutation bypasses

Confirmed gap:

- the generic conversation serializer exposes lifecycle, assignment, unread, bot/handoff and linking fields that should be controlled by inbox/domain actions;
- linked deal business validation is incomplete.

Required implementation:

- [ ] make lifecycle and assignment fields read-only on generic CRUD;
- [ ] route assign, handoff, close/reopen, read/unread, priority and CRM-link actions through services;
- [ ] validate every linked client/lead/deal/task/appointment against conversation business;
- [ ] write activity/audit/notifications from the service actions;
- [ ] deprecate or narrow generic update endpoints that duplicate inbox actions.

Acceptance tests:

- direct PATCH cannot bypass controlled actions;
- allowed inbox actions still work;
- foreign CRM entity links are rejected;
- duplicate link/conversion is idempotent;
- role and tenant denials are covered.

Evidence area:

- `apps/bots/serializers.py`;
- `apps/bots/views.py`;
- `apps/conversations` inbox services/views.

## 5. P0/P1: Atomic Runtime And Delivery Reliability

### BE-RUN-01. Schedule notification delivery

Confirmed gap:

- due-notification processing exists as a service/manual management command;
- no guaranteed Celery task and beat schedule runs it continuously.

Required implementation:

- [ ] add a Celery task for due notification delivery;
- [ ] add periodic schedule with configurable batch size/frequency;
- [ ] atomically claim pending notifications;
- [ ] make delivery idempotent;
- [ ] apply retry/backoff and terminal failure policy;
- [ ] record attempts, last error, delivered/failed timestamps and provider reference where applicable;
- [ ] preserve urgent-notification preference bypass rules;
- [ ] expose safe health/lag data for operations.

Acceptance tests:

- due notification is delivered once;
- two workers cannot deliver the same record twice;
- transient failure retries;
- permanent failure becomes visible and recoverable;
- appointment reminders and outreach notifications work without manual command execution.

Evidence area:

- `apps/notifications/delivery.py`;
- `apps/notifications/management/commands/process_due_notifications.py`;
- Celery configuration and beat schedule.

### BE-RUN-02. Make automation runs claimable, retryable and ordered

Confirmed gaps:

- due runs can be selected concurrently without a claim lock;
- failed runs receive `next_retry_at`, but the due selector processes only pending runs;
- WAIT behavior delays a run rather than reliably advancing through ordered action state.

Required implementation:

- [ ] implement atomic claim using row lock or conditional status transition;
- [ ] define `pending`, `running`, `waiting`, `retry_scheduled`, `succeeded`, `failed` and terminal semantics;
- [ ] include eligible retry runs in due selection;
- [ ] persist current action index/checkpoint;
- [ ] resume after WAIT without replaying completed actions;
- [ ] make side effects idempotent with action/run keys;
- [ ] cap retries and record merchant-safe failure reason;
- [ ] publish activity/notification/BusinessEvent impact consistently;
- [ ] add stale-running recovery.

Acceptance tests:

- concurrent workers execute one run once;
- failed transient action retries automatically;
- WAIT resumes at the next action;
- completed actions are not replayed;
- permanent failure and recovery are observable.

Evidence area:

- `apps/automations/engine.py`;
- `docs/automation-runtime.md`.

### BE-RUN-03. Make approved AI tool execution exactly-once

Confirmed gap:

- approved tool execution is not protected by a transaction/lock or equivalent idempotency claim.

Required implementation:

- [ ] atomically claim an approved action before execution;
- [ ] reject or return the stored result for duplicate execution;
- [ ] bind approval to business, user, tool, arguments and source snapshot;
- [ ] run CRM mutations through domain services;
- [ ] store sanitized result, failure and audit information;
- [ ] define retry behavior only for explicitly retry-safe tools.

Acceptance tests:

- double submit executes one mutation;
- approval cannot be reused with changed arguments;
- tenant/user mismatch is rejected;
- failed execution has deterministic retry/terminal behavior;
- activity/audit remains complete.

Evidence area:

- `apps/ai_core/views.py`;
- AI approval/tool services.

### BE-RUN-04. Queue live AI provider calls

Current risk:

- live provider calls are synchronous in request handling despite queue-oriented production guidance.

Required implementation:

- [ ] classify quick read-only AI calls versus long-running analysis;
- [ ] move long-running/live provider work to Celery;
- [ ] return job state and polling/result contract;
- [ ] configure timeout, retry and circuit-breaker behavior;
- [ ] preserve no-data and source-grounding rules;
- [ ] account usage once per accepted execution;
- [ ] sanitize provider failures before returning them to merchants.

Acceptance:

- API workers are not held by long provider calls;
- duplicate requests do not double-charge or duplicate tools;
- job failure and retry state are observable.

Evidence area:

- `apps/ai_core/services.py`;
- Celery task modules.

## 6. P1: Role, Ownership, Queue And Handoff Mechanics

### BE-ROLE-01. Define authoritative daily work queues

Required implementation:

- [ ] define unassigned, own, team, overdue, SLA-risk and attention-needed selectors;
- [ ] keep visibility separate from assignment and ownership;
- [ ] add permission-aware queue endpoints for owner, manager, operator and specialist workspaces;
- [ ] provide stable filters, ordering and pagination;
- [ ] include enough entity summary to avoid frontend N+1 request waterfalls;
- [ ] prevent restricted roles from learning aggregate counts outside their scope.

### BE-ROLE-02. Complete reassignment and handoff rules

Required implementation:

- [ ] validate target assignee is an active business member with an eligible role/team;
- [ ] define who can self-assign, assign within team and assign across teams;
- [ ] support unassigned queues intentionally;
- [ ] make conversation handoff, lead owner, task assignee and appointment responsibility consistent;
- [ ] require reason where reassignment is operationally sensitive;
- [ ] write activity and audit;
- [ ] notify old/new responsible users and managers according to policy;
- [ ] make duplicate requests idempotent.

### BE-ROLE-03. Define absence and fallback behavior

Required implementation:

- [ ] represent temporary unavailable/out-of-office state only if it changes routing behavior;
- [ ] define manual manager reassignment first;
- [ ] optionally add simple round-robin or least-loaded assignment after queue selectors are trustworthy;
- [ ] escalate unassigned/SLA-risk work to a manager;
- [ ] avoid a complex workforce-management subsystem for the first launch.

Acceptance for role mechanics:

- every work item has intentional ownership or an intentional queue;
- managers can see and redistribute team work without seeing other businesses;
- operators cannot reassign outside allowed scope;
- handoff/reassignment is visible immediately through API state, activity and notification.

## 7. P1: Trustworthy Dashboard And API Contracts

### BE-API-01. Add permission-aware aggregate endpoints

Problem:

- frontend list helpers unwrap only the first paginated page, so list length is not a valid total;
- dashboards need role-scoped aggregates, not broad entity downloads.

Required implementation:

- [ ] define metric contracts with period, timezone and currency semantics;
- [ ] return counts and sums from database aggregates;
- [ ] scope aggregates by business, role, team and ownership;
- [ ] distinguish unavailable/not-permitted from numeric zero;
- [ ] expose source timestamp and freshness where useful;
- [ ] cover more than one-page datasets in tests.

### BE-API-02. Stabilize merchant-safe error codes

Required implementation:

- [ ] define stable codes for validation, permission, tenant mismatch, conflict, lifecycle transition, schedule conflict, provider failure and temporary service failure;
- [ ] return structured field and non-field errors;
- [ ] include correlation/request ID without exposing stack traces;
- [ ] keep server logs technical and merchant responses safe;
- [ ] maintain RU/KK/EN mapping in frontend/i18n rather than hardcoding every transport error;
- [ ] remove mojibake from backend validation strings and generated notes.

Evidence area:

- API exception handler and serializer validation;
- `apps/leads/services.py`;
- frontend error client contract.

## 8. P1: Onboarding And Business Setup Backend

The onboarding service foundation exists. The remaining backend work is contract completion, not a rewrite.

Required implementation:

- [ ] define authoritative onboarding steps for owner and invited employee;
- [ ] make completion state idempotent and resumable;
- [ ] bind team invitations to business, role preset and optional team;
- [ ] ensure expired/revoked/used invitation states are explicit;
- [ ] return next recommended setup action without inventing business data;
- [ ] keep demo data behind explicit non-production entitlement/configuration;
- [ ] apply business type to a product profile only after the capability model below exists;
- [ ] emit audit/activity for critical workspace setup actions.

Acceptance:

- signup creates a valid owner workspace;
- owner can invite five employees into permitted roles/teams;
- each employee accepts once and receives the correct business membership;
- foreign and expired invitation attempts fail safely;
- onboarding can be resumed across sessions.

Evidence area:

- `apps/onboarding/services.py`;
- signup and invitation services/views;
- onboarding URL configuration.

## 9. P1/P2: Dentistry-First Product Profile And Module Capabilities

Business type currently records merchant classification but does not authoritatively change enabled CRM modules. Dentistry needs a capability layer, not a separate codebase.

### BE-VERT-01. Add a product profile/capability model

Required implementation:

- [ ] define a stable module registry: inbox, requests/leads, clients, appointments, tasks, deals, analytics, AI, automations and integrations;
- [ ] define business-level enabled/disabled capabilities;
- [ ] provide defaults by `business_type`;
- [ ] default dentistry to appointment-first workflow with Deals optional/disabled;
- [ ] preserve existing data when a module is disabled;
- [ ] record who changed module configuration and when;
- [ ] expose capabilities in bootstrap/auth-me or a dedicated endpoint;
- [ ] add migration/backfill defaults for existing businesses.

### BE-VERT-02. Enforce capabilities in the backend

- [ ] reject API access and mutations for disabled modules;
- [ ] omit disabled-module actions from available-action contracts;
- [ ] remove disabled-module results from global search and dashboard aggregates;
- [ ] prevent automations and AI tools from targeting disabled modules;
- [ ] keep owner/admin capability changes permission-controlled;
- [ ] define re-enable behavior without destructive data migration.

### BE-VERT-03. Add dentistry appointment-first contract

- [ ] expose appointment/request operational aggregates;
- [ ] support responsible doctor/resource and optional user mapping;
- [ ] support reminder, cancellation, no-show and follow-up workflow;
- [ ] keep activity across conversation, client, request and appointment;
- [ ] avoid clinical/EHR fields in CRM core.

Acceptance:

- new dentistry business receives an appointment-first profile;
- Deals endpoints/actions/search are unavailable when disabled;
- enabling Deals restores access without data loss;
- owner/operator/doctor roles receive only capability-compatible actions;
- AI and automations respect the same module state.

## 10. P2: Performance And Scalability

### BE-PERF-01. Fix inbox query shape

Current risk:

- conversation lists prefetch large message collections while serializers still query latest messages and attachments per conversation.

Required implementation:

- [ ] annotate or prefetch only the latest-message data needed by the list;
- [ ] prefetch attachments in bounded form;
- [ ] keep full message history behind paginated conversation detail;
- [ ] measure query count and payload size;
- [ ] preserve tenant filtering in every optimized queryset.

Evidence area:

- `apps/conversations/inbox_views.py`;
- `apps/conversations/inbox_serializers.py`.

### BE-PERF-02. Replace team-performance query loops

- [ ] aggregate member metrics in grouped queries;
- [ ] avoid `.count()` loops per member/resource;
- [ ] scope all aggregates by business and permitted team;
- [ ] add query-count regression tests for realistic team sizes.

Evidence area:

- `apps/businesses/views.py` team performance endpoint.

### BE-PERF-03. Protect heavy endpoints

- [ ] paginate all merchant lists and histories;
- [ ] cap date ranges and export sizes;
- [ ] index hot tenant/status/assignee/due-date fields based on measured queries;
- [ ] queue large exports/reports;
- [ ] add load tests for dashboard, inbox, queue and calendar paths.

## 11. P2/P3: Observability And Production Runtime

Required implementation:

- [ ] structured logs with business-safe identifiers, request/correlation ID and release ID;
- [ ] Sentry for Django, Celery and frontend release correlation;
- [ ] Redis TLS and production Celery worker/beat;
- [ ] queue depth, retry, stale-run and notification-lag metrics;
- [ ] connector/webhook success, latency, duplicate and failure metrics;
- [ ] AI provider latency, failure and usage metrics without prompt/PII leakage;
- [ ] database TLS, backups and tested restore drill;
- [ ] S3-compatible object storage for production media/attachments;
- [ ] transactional SMTP/email provider;
- [ ] uptime checks and actionable alerts;
- [ ] documented incident and rollback ownership;
- [ ] execute production readiness and paid-beta gates in the target environment.

Provider rollout remains gated:

- website/public forms and Excel/CSV can be first candidates;
- Telegram requires real webhook, secrets, Redis/Celery and Sentry;
- WhatsApp/Instagram remain pilot until Meta setup and readiness gates pass;
- marketplace connectors remain read-only beta until their rollout gates pass.

Do not show a provider as live solely because adapter code exists.

## 12. Backend Execution Phases

The phase stop gate from `AGENTS.md` applies. One user `continue` authorizes only the current/next phase.

### Phase B0: Security and tenant invariants

Tasks:

- BE-P0-01 Deal relations;
- BE-P0-02 business role/team/member relations;
- BE-P0-03 AIRequestLog access;
- BE-P0-04 create-scope enforcement;
- BE-P0-05 conversation mutation boundary.

Required proof:

- happy path;
- permission denial;
- tenant isolation;
- lifecycle regression tests;
- `manage.py check` and migration check.

### Phase B1: Runtime reliability

Tasks:

- BE-RUN-01 scheduled notification delivery;
- BE-RUN-02 automation claim/retry/order;
- BE-RUN-03 exactly-once AI tools;
- BE-RUN-04 queued long-running AI.

Required proof:

- concurrency/idempotency tests;
- retry and terminal failure tests;
- Celery eager-mode tests plus one real worker/beat smoke where available.

### Phase B2: Roles, queues and handoffs

Tasks:

- BE-ROLE-01 daily queues;
- BE-ROLE-02 reassignment/handoff;
- BE-ROLE-03 simple absence/fallback.

Required proof:

- owner, manager, operator and specialist API scenarios;
- team/own scope denial;
- notifications/activity/audit assertions.

### Phase B3: Dashboard, errors and onboarding contracts

Tasks:

- BE-API-01 aggregates;
- BE-API-02 errors;
- onboarding/invitation contract completion.

Required proof:

- datasets larger than one page;
- role-scoped metrics;
- resume/accept/expired invitation flows;
- frontend contract fixtures or schema assertions.

### Phase B4: Dentistry product profile

Tasks:

- BE-VERT-01 capability model;
- BE-VERT-02 backend enforcement;
- BE-VERT-03 appointment-first API contract.

Required proof:

- migration/backfill;
- module-disabled permission tests;
- owner/operator/doctor scenarios;
- AI, automation, search and aggregate capability tests.

### Phase B5: Performance and production readiness

Tasks:

- inbox and team query optimization;
- heavy endpoint protection;
- observability and infrastructure gates;
- provider rollout validation.

Required proof:

- query counts and load evidence;
- production audit/gate outputs from the target environment;
- worker/beat, email, storage, monitoring and restore smoke evidence.

## 13. Recommended First Backend Task

Start with Phase B0, but execute it as bounded branches/PRs under the repository rule `one task = one branch = one PR`.

Recommended first PR:

```text
BE-P0-01: harden Deal cross-tenant relation validation
```

Why first:

- direct tenant-integrity risk;
- narrow, testable change;
- no frontend dependency;
- establishes a reusable same-business relation-validation pattern for later tasks.

Do not combine frontend redesign changes with this backend PR. The current worktree already contains unrelated frontend/design-document modifications from another workstream, so backend implementation must preserve them and isolate its own diff.

## 14. Backend Definition Of Done

A backend task is complete only when:

- tenant and role behavior is explicitly defined;
- related business invariants are validated server-side;
- lifecycle changes use a domain service where applicable;
- notification, activity, audit, BusinessEvent and AI impacts were assessed;
- migration and environment impacts were assessed;
- happy path, permission denial and tenant isolation tests pass;
- concurrency/retry tests exist for background or critical mutation work;
- API errors are stable and merchant-safe;
- `manage.py check` passes;
- `makemigrations --check --dry-run` passes unless an intentional migration is included;
- relevant scoped pytest suites pass;
- documentation/source-of-truth plan is updated after behavior changes;
- checks run and skipped are reported exactly.

## 15. Explicitly Out Of Scope

- public landing page;
- ERP/accounting/warehouse expansion;
- clinical dentistry/EHR records;
- separate backend codebase per vertical;
- provider write-back for marketplace beta connectors;
- frontend-only permission or module enforcement;
- replacing existing domain services with view-level logic;
- declaring production readiness from local mock/provider-disabled tests alone.
