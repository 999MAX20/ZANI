# CRM Production Layer Plan

Дата: 2026-06-19

Цель: довести бизнес-логику CRM до production-уровня слоями по всему домену, а не полировать одну страницу за другой. Этот документ является основным рабочим планом для CRM backend hardening.

## 1. Главный Подход

Текущий проект уже имеет сильный CRM foundation:

- клиенты, заявки, сделки, воронки, записи, задачи, inbox;
- tenant-aware API;
- роли и permissions;
- audit/activity;
- custom fields;
- duplicate check и merge;
- lead forms;
- appointment availability;
- inbox -> client/lead/deal/task pipeline.

Главная проблема не в отсутствии сущностей, а в том, что business rules распределены между serializers, views, services и frontend. Для production это риск: один endpoint может соблюдать правило, а другой endpoint может его обойти.

Новый принцип:

```text
Business rules live in domain services/state machines.
Views orchestrate HTTP only.
Frontend consumes backend decisions, not reimplements CRM rules.
```

## 2. Почему Не Страница За Страницей

Старый подход: довести `/dashboard/clients` до идеала, потом `/dashboard/leads`, потом `/dashboard/deals`.

Почему это больше не подходит:

- одна и та же логика используется на разных страницах;
- frontend-only правила легко обходятся через API;
- CRM card, dashboard, inbox и entity pages должны показывать одинаковое состояние;
- ускорение достигается общим backend-контрактом, а не локальной полировкой одного экрана.

Правильный подход:

```text
Layer 1: domain invariants
Layer 2: state machines
Layer 3: audit/activity/timeline
Layer 4: API contracts
Layer 5: frontend integration
Layer 6: E2E business flows
```

## 3. Текущая Оценка CRM Backend

### Client

Оценка: 7/10.

Сильное:

- tenant-bound `Client`;
- duplicate check по phone/email/provider IDs;
- merge переносит связанные leads, deals, appointments, tasks, conversations, notes, activity, analytics, notifications;
- list summary/facets;
- CRM card context.

Production gaps:

- merge сейчас hard-deletes duplicate client;
- нет отдельного `ClientMergeLog`;
- phone/email не нормализованы в отдельные поля;
- consent/source attribution неполные;
- merge не имеет dry-run endpoint.

### Lead

Оценка: 7/10.

Сильное:

- statuses, source, responsible user, lost reason;
- public lead forms;
- UTM/source context;
- duplicate warning;
- conversion to deal/appointment;
- notifications, automations, activity.

Production gaps:

- нет единого lead lifecycle service;
- часть transition rules в view/serializer;
- SLA/no-response rules не являются доменной моделью;
- next action не закреплён серверно для нужных переходов;
- generic update может разойтись с action endpoints.

### Deal / Pipeline

Оценка: 7/10.

Сильное:

- pipeline/stages;
- probability, SLA minutes, required fields JSON;
- won/lost/reopen;
- board/summary/facets;
- risk fields;
- sensitive amount/notes masking.

Production gaps:

- `move-stage` проверяет rules, но generic update не должен обходить stage engine;
- нет stage history table;
- transition permissions слабые и частично завязаны на user role string;
- required fields пока простые native fields, custom fields не включены полноценно;
- no-task/overdue rules считаются в views, а не в selector/service.

### Appointment / Scheduling

Оценка: 7/10.

Сильное:

- service/resource/working hours;
- available slots;
- overlap validation;
- followup notifications;
- cancel/complete handling.

Production gaps:

- нет единого appointment lifecycle service;
- reschedule/cancel/no-show/complete должны быть отдельными domain actions;
- нет status history;
- нет capacity/multi-resource rules;
- timezone policy нужно закрепить тестами и контрактом.

### Task

Оценка: 6.5/10.

Сильное:

- linked to client/lead/deal/appointment;
- assignee/watchers/comments;
- due/reminder/snooze;
- quick actions and notifications.

Production gaps:

- нет task lifecycle service;
- recurrence rule не реализован как engine;
- reminder delivery не доведён до production loop;
- generic update может обходить action semantics.

### Inbox / Conversation Pipeline

Оценка: 6.5/10.

Сильное:

- idempotent `run_conversation_pipeline`;
- create/link client, lead, deal, task;
- duplicate warning for client creation;
- AI qualification foundation;
- message registration updates unread/last timestamps.

Production gaps:

- no realtime/SLA queues;
- часть actions напрямую мутирует conversation;
- no unified audit/activity standard for all inbox actions;
- provider delivery is still not production-grade.

### Activity / CRM Card

Оценка: 7.5/10.

Сильное:

- unified CRM card payload around client/lead/deal/appointment;
- timeline, notes, tags, attachments, custom fields;
- strong product direction.

Production gaps:

- event taxonomy не формализована;
- не каждое важное business action гарантированно пишет activity;
- timeline completeness не тестируется как общий контракт.

## 4. Non-Negotiable CRM Invariants

Эти правила должны быть enforced на backend независимо от страницы:

- все CRM-сущности scoping через `Business`;
- все related objects должны принадлежать тому же business;
- owner/assignee/responsible/watcher должен быть active business member;
- stage принадлежит pipeline и business сделки;
- terminal deal status меняется только через domain actions;
- lost lead/deal требует reason;
- appointment не может пересекаться с active appointment;
- appointment не может быть outside working hours;
- archived critical CRM records не hard-delete по умолчанию;
- merge клиентов разрешён только внутри одного business;
- sensitive actions пишут audit;
- user-facing CRM actions пишут activity timeline;
- AI suggestions do not execute critical CRM mutations without permission/confirmation.

## 5. Target Backend Shape

### Write Services

```text
apps/clients/services.py
apps/leads/services.py
apps/crm/services.py
apps/scheduling/services.py
apps/tasks/services.py
apps/bots/inbox_service.py
apps/conversations/pipeline.py
```

Views call service functions. Services own business rules and side effects.

Required service functions:

```text
clients:
- find_duplicate_clients
- merge_clients
- merge_clients_dry_run
- normalize_client_identity

leads:
- assign_lead
- take_lead_in_work
- mark_lead_contacted
- mark_lead_lost
- reopen_lead
- convert_lead_to_deal
- book_lead_appointment

deals:
- create_deal
- move_deal_stage
- mark_deal_won
- mark_deal_lost
- reopen_deal
- validate_stage_requirements
- compute_deal_risk

scheduling:
- book_appointment
- reschedule_appointment
- cancel_appointment
- complete_appointment
- mark_no_show
- validate_appointment_availability

tasks:
- create_task
- assign_task
- start_task
- complete_task
- cancel_task
- reopen_task
- snooze_task
- add_task_comment

inbox:
- assign_conversation
- handoff_conversation
- close_conversation
- reopen_conversation
- send_outbound_message
- link_client/lead/deal
```

### Read Selectors

Add selectors when list/summary logic grows:

```text
apps/clients/selectors.py
apps/leads/selectors.py
apps/crm/selectors.py
apps/tasks/selectors.py
apps/conversations/selectors.py
```

Selectors own:

- filters;
- facets;
- summaries;
- SLA/work queue calculations;
- risk/attention states.

## 6. Implementation Layers

### Layer 0: Stabilization Gate

Purpose: start from a trustworthy baseline.

Tasks:

- apply pending migrations;
- fix frontend build;
- fix AI mock/provider test drift;
- run backend CRM subset tests;
- document current known red checks if not fixed in this phase.

Checks:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py migrate
.venv/bin/python -m pytest apps.clients.tests apps.leads.tests_forms apps.crm.tests apps.scheduling.tests apps.tasks.tests apps.core.tests_tenant_isolation -q
cd frontend && npm run build
```

Definition of done:

- migrations applied locally;
- baseline checks are green or explicitly documented;
- no CRM hardening starts from unknown broken state.

### Layer 1: Domain Invariants

Purpose: make invalid CRM state impossible through API.

Tasks:

- add shared validation helpers for business relation checks;
- block unsafe direct status/stage changes through generic update where action endpoint/service is required;
- enforce active-member checks for assignee/responsible/watcher/owner;
- enforce lost reason and terminal state rules;
- enforce appointment availability in all create/update paths.

Tests:

- cross-business related object rejected;
- non-member assignee rejected;
- direct deal stage patch cannot bypass required fields;
- direct lead lost patch cannot bypass lost reason;
- direct appointment update cannot bypass overlap rules.

Definition of done:

- every CRM mutation path preserves core invariants;
- errors are deterministic and frontend-friendly.

Progress 2026-06-19:

- generic `PATCH` can no longer mutate lifecycle fields for deals: `stage`, `status`, `probability`, `lost_reason`, terminal timestamps/history;
- generic `PATCH` can no longer mutate lifecycle fields for leads: `status`, `lost_reason`, lost/history fields;
- generic `PATCH` can no longer mutate appointment `status`; appointment status changes now have explicit `confirm`, `cancel`, `complete`, `no-show` endpoints;
- generic `PATCH` can no longer mutate task `status` or completion fields;
- regression tests cover direct bypass attempts for deal, lead, appointment and task lifecycle changes.

### Layer 2: State Machines / Lifecycle Services

Purpose: every CRM lifecycle has one source of truth.

Tasks:

- move lead actions from views into `apps/leads/services.py`;
- move deal stage/status actions into `apps/crm/services.py`;
- move appointment lifecycle actions into `apps/scheduling/services.py`;
- move task actions into `apps/tasks/services.py`;
- update views to call services only.

Required behavior:

- Lead: assign, contact, take in work, close, lost, reopen, create deal, create appointment.
- Deal: move stage, won, lost, reopen.
- Appointment: book, reschedule, cancel, complete, no-show.
- Task: start, complete, cancel, reopen, snooze, assign, comment.

Definition of done:

- views contain HTTP orchestration only;
- services write audit/activity/notifications consistently;
- existing tests still pass;
- new bypass tests pass.

Progress 2026-06-19:

- deal lifecycle actions moved from private `DealViewSet` methods into `apps/crm/services.py`: move stage, mark won, mark lost, reopen;
- lead lifecycle actions moved from private `LeadViewSet` methods into `apps/leads/services.py`: assign, take in work, mark contacted, close, lost, reopen, create deal;
- lead/deal views now handle permissions, request parsing and serialization, while services own state mutations and side effects;
- scoped backend regression suite is green after the refactor: clients, leads, deals, scheduling, tasks and tenant isolation tests;
- appointment lifecycle actions moved into `apps/scheduling/services.py`: created side effects, update sync, confirm, cancel, complete, no-show;
- task lifecycle actions moved into `apps/tasks/services.py`: start, complete, cancel, reopen, snooze, assign, assign to me, due today, due tomorrow, watcher add;
- appointment reschedule is now an explicit lifecycle action endpoint (`POST /api/appointments/{id}/reschedule/`) with working-hours/overlap validation, audit log, activity event and follow-up requeue;
- task assignment, watcher and snooze changes are protected behind task action endpoints; generic update is limited to safe editable task fields;
- backend tests now use action endpoints for lifecycle timeline checks instead of unsafe generic `PATCH`;
- Layer 2 backend lifecycle extraction is complete for lead, deal, appointment and task;
- remaining production work moves to Layer 3: normalize status history, audit/activity taxonomy, and complete backend links after the `/app/*` route migration.

Route contract cleanup 2026-06-19:

- backend-generated frontend links now use canonical `/app/*` paths instead of `/dashboard/*`;
- updated analytics actions, AI analyst actions, notifications, inbox/conversation actions, onboarding/pilot links, integration redirect defaults, outreach/pricing links and demo/check commands;
- AI analyst action normalizer still accepts legacy `/dashboard/*` from model output and converts it to `/app/*`;
- `/dashboard/*` remains supported on the frontend only as a legacy redirect to `/app/*`.

### Layer 3: Audit, Activity, Timeline Completeness

Purpose: every important CRM action is visible and traceable.

Tasks:

- create event taxonomy for CRM actions;
- update `apps/activities/services.py` to expose canonical helper names;
- ensure every lifecycle action writes `ActivityEvent`;
- ensure sensitive/destructive actions write `AuditLog`;
- ensure CRM card timeline includes all relevant events.

Canonical event examples:

```text
client_created
client_updated
client_merged
lead_created
lead_assigned
lead_status_changed
lead_lost
deal_created
deal_stage_changed
deal_won
deal_lost
appointment_created
appointment_rescheduled
appointment_cancelled
task_created
task_completed
message_received
message_sent
```

Definition of done:

- core business flow creates a complete timeline;
- tests assert activity creation for each lifecycle action;
- audit metadata is sanitized.

Progress 2026-06-19:

- added canonical activity taxonomy in `apps/activities/taxonomy.py`;
- `create_activity_event` now normalizes legacy aliases before writing timeline events;
- old aliases like `deal_marked_won`, `deal_marked_lost`, `lead_marked_lost` are stored as canonical `deal_won`, `deal_lost`, `lead_lost`;
- lead, deal, appointment and task lifecycle services now use taxonomy constants instead of ad hoc event strings;
- regression tests cover alias normalization and canonical lifecycle event writes.

Audit progress 2026-06-19:

- risky lifecycle action endpoints now write `AuditLog` in addition to `ActivityEvent`;
- deal terminal/reopen actions audit `deal_won`, `deal_lost`, `deal_reopened`;
- lead lifecycle audit metadata now marks `kind=lifecycle`, including lost/reopen details;
- appointment cancel/complete/no-show actions write lifecycle audit records;
- task cancel/reassignment/assign-to-me write audit records;
- lifecycle audit records are inferred as `medium` risk by default.

CRM card completeness 2026-06-19:

- CRM card entity references now expand from the primary object to related leads, deals, appointments and tasks;
- timeline and notes now match both canonical model names (`Deal`) and lowercase entity names (`deal`);
- attachments and tags use the same entity reference matching as timeline/notes;
- regression tests verify client CRM card includes linked client/lead/deal/appointment/task events, lowercase notes and attachments.

### Layer 4: Duplicate / Merge Production

Purpose: data quality becomes a production feature, not a helper.

Tasks:

- add normalized identity logic for phone/email/provider IDs;
- add `ClientMergeLog` or equivalent immutable audit model;
- add merge dry-run endpoint;
- change merge from silent hard delete to traceable merge policy;
- ensure merge transfers custom fields, files, tags and future related objects.

Definition of done:

- merge can be explained after the fact;
- tenant isolation tested;
- duplicate detection works consistently in clients, leads, public forms and inbox.

Progress 2026-06-19:

- added immutable `ClientMergeLog` model for merge traceability;
- merge result now returns `merge_log_id` and writes it into activity/audit metadata;
- added `merge-dry-run` endpoint for client merge preview without mutating data;
- dry-run reports transfer counts across leads, appointments, conversations, bot conversations, tasks, deals, notes, activity, analytics and notifications;
- merge remains behavior-compatible for now: duplicate is transferred then hard-deleted, but the full duplicate snapshot is preserved in `ClientMergeLog`;
- regression tests cover dry-run immutability, merge log creation, audit metadata and transferred relation counts.

Entity-linked merge progress 2026-06-19:

- merge now transfers client-level tags, file attachments and custom field values from duplicate to target;
- dry-run now reports tags, attachments and custom field values;
- conflicting tags/custom field values are de-duplicated and recorded in `ClientMergeLog.metadata.skipped`;
- regression tests cover moved and skipped tags/custom fields plus attachment reassignment.

### Layer 5: Custom Fields In Workflows

Purpose: custom fields participate in real CRM rules.

Tasks:

- validate custom field value type by field definition;
- enforce required custom fields in stage requirements;
- support required fields for lead/deal/appointment workflows;
- enforce role-based view/edit in read and write paths;
- add transition readiness endpoint for deal/lead stage actions if needed.

Definition of done:

- custom fields are not just display data;
- required custom field can block stage transition;
- tests cover owner/manager/operator visibility and edit.

Deal stage requirement progress 2026-06-19:

- deal stage engine now reads `PipelineStage.required_fields_json.custom_fields`;
- required custom fields can be referenced by custom field `key` or definition `id`;
- missing or empty active custom fields block `move-stage` with `required_custom_fields`;
- inactive custom field definitions are ignored so archived fields do not freeze active pipelines;
- regression tests cover native + custom required fields, id references and inactive definitions.

Custom field value validation progress 2026-06-19:

- custom field write paths now validate `value_json.value` against definition `field_type`;
- `number` and `money` values are normalized to decimal strings;
- `date`, `datetime`, `email`, `url`, `boolean`, `select` and `multiselect` reject invalid payloads;
- `select` and `multiselect` are constrained by `options_json.options`;
- bulk upsert is atomic, so one invalid field value does not partially save the request.

### Layer 6: SLA, Next Action, Work Queues

Purpose: backend defines what needs attention.

Tasks:

- centralize no-response/stale/overdue/risk calculations in selectors;
- unify `next_action_at` and task-derived next action rules;
- create work queue selector/API for:
  - hot leads;
  - stale deals;
  - overdue tasks;
  - unread conversations;
  - appointments requiring confirmation;
  - integration failures if relevant.

Definition of done:

- dashboard, leads, deals, tasks and inbox use same server-side definitions;
- frontend no longer invents independent attention logic.

Work queue selector progress 2026-06-19:

- added backend work queue selector for overdue tasks, stale leads, SLA-overdue deals, deals without next action and upcoming appointments;
- added `/api/work-queues/` endpoint scoped by `business`;
- deal SLA/risk helpers are centralized for reuse by serializers and queue logic;
- archived open tasks no longer count as an active next action;
- regression tests cover queue counts, item payloads and tenant isolation.

Existing endpoint alignment progress 2026-06-19:

- deals `quick=overdue`, `quick=no_tasks` and summary counts now use the shared work queue selectors;
- lead `attention=true` and lead summary attention count now use the shared stale lead selector;
- task `tab=overdue` and owner dashboard overdue task count now use the shared overdue task selector;
- snoozed and archived overdue tasks are excluded consistently across work queues, tasks and analytics;
- regression tests cover SLA-minute accuracy, attention count alignment and overdue task consistency.

Inbox and appointment queue progress 2026-06-19:

- work queues now include unread conversations and handoff-required conversations;
- inbox summary unread/handoff counts now use the same conversation selectors as work queues;
- work queues now include appointment confirmation actions for future `created` appointments;
- upcoming appointments remain a calendar queue, while appointment confirmations are counted as attention work;
- regression tests cover work queue and inbox summary alignment.

Team performance alignment progress 2026-06-19:

- team performance overdue tasks now use the shared overdue task selector;
- team performance SLA deal count now uses the shared SLA overdue deal selector and only counts open deals as actionable;
- overdue handoff and missed chat calculations are centralized in conversation selectors;
- regression tests cover snoozed/done task exclusion, closed deal exclusion and separate overdue handoff/missed chat counts.

### Layer 7: API Contract Cleanup

Purpose: stable API, safer serializers.

Tasks:

- replace `fields = "__all__"` in core CRM serializers with explicit fields;
- split read/write serializers where needed;
- make lifecycle-only fields read-only in generic serializers;
- add consistent response envelopes for summary/facets/warnings/actions;
- document action endpoints.

Serializer contract progress 2026-06-19:

- CRM serializers for pipelines, stages, deals and stage transitions now use explicit fields;
- custom field definition/value serializers now use explicit fields;
- contract tests prevent `fields = "__all__"` from returning in these CRM-critical serializers;
- existing list, board, CRM card and custom field tests verify the serialized API shape remains compatible.

Lifecycle serializer contract progress 2026-06-19:

- lead, appointment and task serializers now use explicit fields;
- lifecycle-only write guards remain in place for status/lost/completed fields;
- appointment schedule fields (`client`, `lead`, `service`, `resource`, `start_at`, `end_at`) are blocked in generic update and must use the reschedule action when changing time/resource;
- task generic update now blocks assignment/watchers/snooze fields, while task create rejects lifecycle/snooze/watchers seed state and validates initial assignee membership;
- contract tests now cover these serializers to prevent `fields = "__all__"` regressions.

Protected state write-guard progress 2026-06-19:

- generic PATCH/PUT for deal, lead, appointment and task can no longer write archive state directly;
- `is_archived`, `archive_reason`, `archived_at` and `archived_by` must go through archive/restore endpoints;
- behavioral tests cover archive bypass attempts for all four primary CRM entities.

Adjacent CRM serializer contract progress 2026-06-19:

- client, conversation, activity/timeline, segment and bot serializers now use explicit fields;
- config, metadata and payload JSON serializers still run existing sanitization;
- contract tests now cover adjacent CRM serializers so future model fields are not auto-exposed.

Operational settings and security serializer contract progress 2026-06-19:

- lead form, lead form field, submission and submission error serializers now use explicit fields;
- scheduling resource, working hours and appointment message setting serializers now use explicit fields;
- audit log, login history and support access grant serializers now use explicit fields while preserving secret sanitization;
- contract tests cover these operational serializers to prevent accidental exposure of new model fields.

Platform module serializer contract progress 2026-06-19:

- billing, analytics, automation, notification and outreach serializers now use explicit fields;
- automation run, notification state, outreach campaign state and outreach recipient delivery state are no longer writable through generic endpoints;
- existing sanitization for automation payload/results/errors, analytics metadata and outreach delivery/provider errors is preserved;
- contract and behavioral tests cover these modules so runtime/system fields do not become writable by accident.

Action contract documentation progress 2026-06-19:

- `API_ACTION_CONTRACT.md` now documents protected fields and action endpoints for frontend/backend alignment;
- CRM lifecycle, archive/restore, notifications, outreach, automations, billing, integrations, inbox and operational settings have documented action contracts;
- frontend rule is explicit: lifecycle/status/runtime/delivery fields must use action endpoints, not generic CRUD writes.

Definition of done:

- adding a model field does not expose it by accident;
- frontend receives predictable shape;
- tests cover response contracts.

### Layer 8: Permissions Matrix Enforcement

Purpose: backend permissions are complete across roles.

Tasks:

- test owner/manager/operator/staff/accountant/support for:
  - clients;
  - leads;
  - deals;
  - appointments;
  - tasks;
  - inbox;
  - custom fields;
  - files;
- enforce field masking consistently;
- align AI permissions with source entity permissions.

Definition of done:

- frontend hiding is not relied on for security;
- every role-sensitive action has forbidden tests.

### Layer 9: Frontend Integration Pass

Purpose: pages consume production backend rules.

Tasks:

- replace frontend-only lifecycle logic with backend action calls;
- show backend validation warnings/errors;
- unify CRM drawer actions across clients/leads/deals/appointments;
- use server summaries/facets/work queues;
- remove duplicated page-specific business rules.

Definition of done:

- same business action behaves the same from dashboard, list page, CRM card and inbox;
- frontend does not bypass backend state machines.

### Layer 10: E2E Business Flows

Purpose: production quality is measured by workflows, not pages.

Required flows:

1. public form -> client -> lead -> task notification;
2. inbox message -> client/lead/deal/task;
3. lead -> deal -> won/lost/reopen;
4. lead -> appointment -> reminder -> complete -> thank you;
5. duplicate client -> merge -> timeline preserved;
6. manager/operator permission boundaries;
7. archive/restore critical CRM records;
8. custom required field blocks stage transition.

Definition of done:

- backend tests cover service behavior;
- API tests cover permissions and tenant isolation;
- frontend E2E covers owner/manager daily flows.

## 7. PR / Task Split

Recommended order:

### PR 1: Stabilization And Guard Rails

- apply/verify migrations;
- fix current build/test blockers;
- add initial bypass tests for deal/lead/appointment direct updates.

### PR 2: Deal Pipeline Service

- introduce deal service/state machine;
- move `move-stage`, won/lost/reopen into service;
- block generic stage/status bypass;
- add stage requirement tests.

### PR 3: Lead Lifecycle Service

- introduce lead service;
- move assign/status/lost/reopen/create-deal/create-appointment;
- add next-action and lost reason rules.

### PR 4: Appointment Lifecycle Service

- introduce book/reschedule/cancel/complete/no-show service;
- preserve followup scheduling/cancellation;
- add status history or activity completeness tests.

### PR 5: Task Lifecycle Service

- move task actions to service;
- enforce assignee/watcher membership;
- prepare recurrence/reminder extension points.

### PR 6: Timeline And Audit Completeness

- event taxonomy;
- consistent activity/audit writes;
- CRM card timeline tests.

### PR 7: Duplicate / Merge Production

- dry-run;
- merge log;
- normalized identity;
- expanded transfer coverage.

### PR 8: Custom Fields In Workflow Rules

- type validation;
- stage required custom fields;
- role-based edit/view tests.

### PR 9: Work Queues And SLA Selectors

- central selectors;
- attention endpoints;
- dashboard/list pages consume the same definitions later.

### PR 10: API Serializer Contract Cleanup

- explicit fields;
- read/write serializers;
- action endpoint documentation.

### PR 11+: Frontend Integration By Workflow

- connect backend lifecycle actions;
- remove page-specific business rules;
- add E2E workflow tests.

## 8. Anti-Patterns To Avoid

- Do not make one page perfect while backend rules are bypassable.
- Do not put new CRM business rules in React components.
- Do not add another endpoint if an existing service/action can be extended.
- Do not update `status`, `stage`, `lost_at`, `won_at`, `completed_at` casually in generic views.
- Do not expose provider tokens or sensitive CRM metadata through `fields = "__all__"`.
- Do not mark a flow production-ready without tenant, permission and regression tests.
- Do not create mock/demo behavior that hides missing production logic.

## 9. Required Checks Per Layer

Backend-focused layer:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
.venv/bin/python -m pytest apps.clients.tests apps.leads.tests_forms apps.crm.tests apps.scheduling.tests apps.tasks.tests apps.core.tests_tenant_isolation -q
```

Full meaningful change:

```bash
scripts/codex_verify.sh
```

Frontend integration layer:

```bash
cd frontend && npm run build
```

If migrations are added:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py migrate
```

## 10. Current Decision

The next production step is not more UI polish. The next step is CRM backend hardening by layers:

```text
state services -> bypass protection -> timeline/audit -> duplicate/merge -> custom fields -> work queues -> API contracts -> frontend workflows
```

This should become the default implementation route for all CRM production work until the core business flows are stable end to end.
