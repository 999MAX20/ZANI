# CRM Production Layer Plan

Last updated: 2026-07-21

Цель: довести CRM до production-уровня слоями по всему продукту, а не полировать одну страницу изолированно. Этот документ является текущим source-of-truth для CRM hardening.

## 1. Принцип Работы

Zani CRM развивается слоями:

```text
domain invariants -> state machines -> audit/activity -> API contracts -> frontend integration -> E2E flows
```

Страница считается production-ready только когда backend-правила нельзя обойти через другой endpoint, frontend использует реальные API-контракты, а пользовательский flow проверен тестами или smoke-сценарием.

## 2. Текущее Состояние

### Backend Boundaries

Update 2026-07-23: Backend Reliability Phase R5 repository work and verification are complete. Platform operations and paid-beta checks now return a structured critical `database_unavailable` blocker instead of crashing on an unavailable or unmigrated database. Operations health exposes bounded outbox lag/retry/failure and routing/SLA attention counts/ages without customer text, merchant names, connector names, user email or raw errors. The obsolete 145-checkbox backend backlog is replaced by a closed B0-B6 phase summary and points to the current reliability plan. A clean SQLite migration passed, the complete Django suite passed (`459 passed, 7 warnings`), Django check and migration drift passed, and high-confidence secret scan returned zero matches. Local production readiness remains correctly blocked by ten production configuration/infrastructure failures and one email warning; backup readiness has two paid-beta blockers; provider rollout has zero blockers; paid beta remains blocked by ten gates. These are target-environment prerequisites, not hidden repository completion claims.

Update 2026-07-23: Backend Reliability Phase R4 is complete at verified scope. DRF errors now use explicit domain exception classes and a stable `code`, `request_id`, `detail`, `errors` envelope instead of inferring state from English exception text. Lead/task/appointment lifecycle conflicts return `invalid_transition`; appointment working-hours and overlap conflicts return `schedule_conflict`; unavailable assignees, disabled modules and CRM idempotency key conflicts return their own stable codes. Provider and temporary service failure codes are defined for provider/service boundaries. Generic permission and not-found details are sanitized so tenant names and ownership are not enumerable. The UI contract is documented in `API_ACTION_CONTRACT.md`. The formal R4 gate passed (`110 passed, 7 subtests`), with focused task (`39 passed`), scheduling (`40 passed`), idempotency (`11 passed`) and API mismatch checks also passing; Django check, migration drift and diff hygiene passed.

Update 2026-07-21: Backend Phase B6 CRM contract cleanup is complete at verified scope. The automation action API now accepts only actions executed by the current merchant automation builder/runtime contract and rejects zero-delay waits; unsupported model choices remain readable for historical records but cannot be newly persisted through the public API. Task recurrence is explicitly rejected when non-empty and removed from public task responses/types until a real scheduler exists, while blank legacy payloads remain compatible. The obsolete lead `convert-client` action was removed because every lead already requires a client, so the endpoint only returned the existing relation while writing misleading conversion history. Lead-to-appointment/task/deal activity and notification copy affected by this pass is now merchant-readable Russian. No model or migration was removed. Focused CRM contract tests passed (`90 passed, 2 warnings`), the complete Django suite passed (`445 passed, 7 warnings`), Django check and migration drift check passed, frontend i18n/TypeScript/production builds passed, and diff hygiene passed.

Update 2026-07-21: Backend Phases B1-B5 are implemented at local verified scope. Notification delivery, automation runs, approved AI tools and live AI requests now have queue-backed claim/idempotency/retry/checkpoint contracts; role-scoped daily queues, assignment/handoff, absence/fallback and manager escalation are server-enforced; aggregate/error/onboarding contracts are stable; dentistry receives appointment-first capabilities with Deals disabled by default; and disabled modules are enforced by APIs, AI and automations. B5 removes inbox and team/dashboard N+1 query shapes, bounds analytics periods, adds role-scoped synchronous/queued export jobs, hot-path indexes, JSON correlation logs and export queue health. This does not declare paid-beta readiness: real Redis worker/beat, S3, SMTP, Sentry, provider webhooks, backup restore and deployed smoke gates still require target-environment evidence.

Verification snapshot 2026-07-21: the complete Django test suite passed (`441 passed, 7 warnings`), `manage.py check` passed, a clean SQLite migration run passed, `makemigrations --check --dry-run` reported no drift, and `git diff --check` passed. Focused B5 regression budgets cover bounded inbox, team-performance and owner-dashboard query counts. Local eager Celery and private filesystem storage smoke checks passed. Production readiness remains blocked in the local development environment by ten configuration/infrastructure failures: production secrets/hosts/origins/HTTPS, support grants, managed TLS PostgreSQL, TLS Redis with real workers/beat, private object storage and Sentry; SMTP is an additional warning. Paid-beta also requires deployed browser/staging smoke and a tested backup restore drill.

Update 2026-07-21: Backend Phase B0 security and tenant invariants are complete. Deal create/update now rejects cross-business client, lead, pipeline, stage and owner relationships; business roles, memberships and team membership relations are same-business and owner-policy safe; AI request logs and generic bot conversations are server-owned/read-only at their public boundaries; OWN/TEAM scope is enforced against proposed create/update state, including custom AI approval creation; and inbox CRM linking checks both tenant and object permission scope. The focused B0, AI, access, CRM, notification, bot, inbox, tenant, API-contract and E2E suites passed, together with Django check, migration drift check and diff validation. No migration or environment change was required.

Update 2026-07-16: App 2.0 workspace related data strategy is implemented at the API-contract layer. Full entity workspaces should use CRM card payloads for first load/counts/previews/actions, then reuse existing paginated list APIs for deep tabs instead of adding duplicate related endpoints. Deals now support `lead_ids`; appointments support `lead_ids`; tasks support `client_ids`, `lead_ids`, `deal_ids`, `appointment_ids` and `conversation_ids` with conversation-linked task inclusion for client/lead/deal filters; inbox conversations support `client_ids`, `lead_ids` and `deal_ids`. The shared ID parser accepts comma-separated ids and frontend `ids[]` arrays. Workspace related filter tests, task/inbox/CRM-card regressions, Django check, migration drift check and frontend build passed.

Update 2026-07-16: CRM card actions are now user-scoped for App 2.0 workspace readiness. The card builder preserves legacy `available_actions` string ids and adds `available_action_details` with stable id, label key, permission resource/action, allowed flag, scope, denial reason, reason-required flag, destructive flag and confirmation mode. Client, lead, deal and appointment CRM card endpoints pass the current actor into the contract. Backend CRM card tests, cross-entity E2E regression, Django check, migration drift check and frontend build passed.

Update 2026-07-16: Phase 13 backend boundary split is complete at the current scope. Marketplace connector config/status/test/sync HTTP helpers now live in `apps/integrations/view_actions.py`, bot-channel provider actions live in `apps/bots/channel_actions.py`, inbox summary/filter/message pagination/AI-preview helpers live in `apps/conversations/inbox_helpers.py`, and scheduling working-hours/availability logic lives in `apps/scheduling/availability.py` while preserving existing imports through `apps.scheduling.services`. Connector create/request denial remains tenant-safe with `404` for roles without integration manage access. Django check, migration drift check and focused integrations/bots/scheduling/inbox tests passed.

### Roadmap Status Hygiene

Update 2026-07-16: `CRM_IMPLEMENTATION_TASKS.md` phases 0-13 and `CRM_AUDIT_REQUIRED_CHANGES.md` items 1-15 are closed at their current verified scope. Historical "remaining" notes below are follow-up risk/QA notes, not active unchecked checklist work. New product work now belongs in the current product/technical map (`actual_docs/CRM_TECHNICAL_MAP_AND_VERTICAL_MODES.md`), this production plan, the relevant docs, and `API_ACTION_CONTRACT.md`.

### Integrations

Update 2026-07-16: Demo/mock merchant flows are now gated by `ALLOW_DEMO_MERCHANT_FLOWS`; production env templates keep it disabled. Onboarding demo-data responses explicitly declare demo mode, connector mock-sync cannot create BusinessEvents when the demo-flow gate is off, platform placeholder pages are marked internal-only, and marketplace connector setup notices distinguish mock/demo check/sync success from live provider connections. Focused backend tests, Django checks, migration drift check, frontend build and platform route smoke passed for this scope.

Update 2026-07-16: Merchant integration UI now keeps daily workflows out of connector-console mode. Default cards and setup modals show provider value, status, safe check/sync/request actions and merchant-safe recovery messages; account IDs, access keys, webhook verification values and advanced import/provider knobs stay behind owner/admin/support fallback controls. Frontend build and a focused owner/operator Playwright role smoke passed for this scope.

Update 2026-07-14: Provider-specific setup, status, test, sync and OAuth actions are no longer implemented directly in `BusinessConnectorViewSet` or `BotChannelViewSet`. Business connector orchestration now lives in `apps.integrations.services`, bot-channel Telegram/WhatsApp/Instagram orchestration lives in `apps.bots.services`, and DRF viewsets keep the HTTP/serializer/permission boundary. Focused integration and bot API tests passed for the current scope.

Update 2026-07-13: Phase 11 is complete at the current CRM scope. Connector provider logic stays behind provider/service layers, credentials and connector errors are masked in serializers, connector health checks and sync-run retry are tenant-scoped and permission-gated, and the merchant integrations UI now shows the latest sync run with safe retry for failed runs. Website forms/chat and Telegram, WhatsApp and Instagram inbound messages now create source-grounded `BusinessEvent` rows with CRM links where available. Excel/CSV import now maps clients, leads, deals, sales and catalog into CRM/business events. Marketplace/commerce sync endpoints use a provider-neutral sync service before writing `BusinessEvent`.

### Analytics And Reporting

Update 2026-07-13: Phase 12 is complete at the current CRM scope. `apps/analytics/crm_metrics.py` now provides a shared read-only operational metrics layer for owner dashboard and analytics reports. The API returns CRM funnel metrics for lead source/status, lead-to-deal conversion, won/lost value, appointment completion/no-show rates, overdue tasks and unanswered inbox conversations. Manager performance is permission-scoped, connector health includes failed sync/run status and provider breakdown, and AI insight cards are deterministic with source metric keys plus entity ids instead of invented analysis. `/dashboard/analytics` consumes these backend metrics and shows operational answers instead of local vanity calculations. Tests cover metric correctness, tenant isolation and manager scope.

### Calendar

Статус: Phase 6 scheduling checklist is complete at current scope.

Update 2026-07-14: Scheduling resources now support an optional `linked_user` staff owner. Resource API create/update validates that the linked user is the business owner or an active member of the same business, exposes safe display fields for the Resources page, and rejects inactive or cross-tenant assignments. Appointment responsible routing now uses lead responsible user -> linked resource user -> actor -> business owner, so direct resource staff can receive appointment notifications and system follow-ups.

Update 2026-07-14: Appointment confirmation/cancellation replies from Telegram/WhatsApp now call scheduling lifecycle services instead of mutating `appointment.status` inside notification delivery. Client-triggered cancellation records explicit source/channel/reason metadata in activity and request-less system audit, cancels pending appointment follow-ups, triggers appointment-cancelled automations and creates the same follow-up task path as API cancellation.

Update 2026-07-09: Phase 6 pass 2 completed mobile agenda UX. The mobile calendar now exposes a day agenda header, working-hours label, booking/open-slot/task counters, direct new-booking and working-hours actions, row-style appointment items and linked task rows. Mobile Playwright smoke now asserts the agenda header and new-booking action on `/app/calendar`.

Update 2026-07-09: Phase 6 pass 1 hardened appointment lifecycle as a CRM mechanic. Appointment create/reschedule availability rules were reviewed and verified against working-hours, overlap and resource day-off tests. Cancel/no-show now require a reason in API and UI, terminal lifecycle replay is rejected, cancel/no-show activity/audit carries the reason, cancel/no-show/complete creates linked follow-up tasks, and appointment creation/lifecycle emits internal responsible-user notifications. The initial responsible notification route used lead responsible user -> actor -> business owner before Resource -> User mapping was added.

Сделано:

- единый экран вместо отдельной страницы записей;
- day/week/month/list UX;
- date-range API-фильтрация;
- appointment actions через backend;
- drawer/inspector без сдвига основной сетки;
- улучшенная работа с ресурсами и фильтрами;
- service-backed create/reschedule working-hours and overlap validation;
- cancel/no-show reason gate;
- terminal appointment lifecycle guard;
- appointment lifecycle activity/audit coverage;
- follow-up tasks after cancel/no-show/complete;
- internal responsible-user appointment notifications;
- mobile agenda with appointments, tasks and day actions.

Current follow-up after completed phase:

- final QA on production-like merchant data.

### Tasks

Статус: Phase 7 task operations checklist is complete at current scope; production-like scale QA and broader E2E can continue as follow-up.

Update 2026-07-09: Phase 7 pass 5 completed task notification routing by role and assignee. Assigned tasks now create targeted notifications for the active assignee, while unassigned or invalid-assignee tasks route to manager/admin/operator roles with owner fallback. Normal task notifications respect business-scoped notification preferences, and high/urgent task notifications bypass disabled preferences as escalation notifications. Task events no longer create business-wide `recipient=null` notifications by default.

Update 2026-07-09: Phase 7 pass 4 added the task workload view by assignee. `GET /api/tasks/workload/?business=<id>` is `tasks:view` gated, tenant-scoped and groups active tasks by active business member plus unassigned work, including overdue, due-today, high-priority and capacity status metadata. The Tasks page now renders this workload panel above the table and uses workload cards as assignee filter controls.

Update 2026-07-09: Phase 7 pass 3 added server-defined overdue task escalation rules. Work queues now return `overdue_minutes`, `escalation_level` and `escalation_reason` for overdue tasks, with watch/escalate/critical levels based on overdue age and priority. The manager dashboard uses this backend metadata as a severity badge and links queue rows to the exact task route.

Update 2026-07-09: Phase 7 pass 2 added API-backed system task templates for common CRM follow-ups. `GET /api/tasks/templates/?business=<id>` is `tasks:view` gated and returns templates for call client, qualify lead, send offer, confirm appointment, recover no-show and payment follow-up. The Tasks modal now loads templates through the tasks API and uses them only to prefill the form; the user still explicitly submits the task through the normal create/update contract.

Update 2026-07-09: Phase 7 pass 1 added first-class task-to-conversation linking. Tasks now support `conversation` alongside client, lead, deal and appointment links; the field is tenant-validated, indexed, exposed in API responses, searchable/filterable through `relation=conversation`, included in work queues, shown in the Tasks form/table/drawer and routed to the inbox conversation. Manual inbox create-task and the conversation auto-pipeline now save the conversation FK, and client CRM cards include tasks linked only through related conversations. A view-only task role test proves assign/watch/comment actions require `tasks:update`.

Сделано:

- backend lifecycle actions: take/start, complete, cancel with reason, snooze, assign, watch, archive;
- comments create/delete;
- task links for client, lead, deal, appointment and conversation;
- inbox and auto-pipeline task creation preserves conversation source;
- API-backed system templates for common task follow-ups;
- server-defined overdue escalation metadata in work queues and manager dashboard;
- workload view by assignee/unassigned tasks in API and Tasks UI;
- role/assignee-aware task notification routing with preference handling;
- action confirmation/undo pattern на frontend;
- task drawer с редактированием и быстрыми действиями;
- table-based UX вместо тяжелых карточек;
- pagination foundation и backend indexes;
- тесты на ключевые task scenarios.

Current follow-up after completed phase:

- проверить список задач на 500-2000 записей;
- расширить E2E smoke.

### Conversations

Update 2026-07-16: Manual inbox `create-task` is now service-backed at the conversation domain boundary. `InboxConversationViewSet.create_task` delegates to `apps.conversations.services.create_task_from_conversation`, preserving title/default title, client/lead/deal/conversation links, assignee/creator, priority, due date and timeline activity. Focused inbox task tests cover happy path, default title, permission denial and tenant isolation; CRM card and cross-entity E2E regression tests passed.

Update 2026-07-09: Phase 5 pass 8 completed the current Conversations -> CRM pipeline checklist. Work queues now include unread and handoff SLA-overdue conversation queues, inbox summary exposes SLA-overdue counts and urgent next actions, and conversation queue items include SLA due/overdue metadata. Phase 5 is complete at the current scope; deeper UI polish for appointment creation can continue in Scheduling.

Update 2026-07-09: Phase 5 pass 7 hardened handoff safety. Auto pipeline now exits before AI qualification, CRM mutations, booking or bot auto-replies when a conversation is handed off, bot-paused or inactive. Handoff skip decisions are stored as `auto_pipeline_skipped_handoff` activity and `auto_crm_pipeline.status=skipped_handoff`.

Update 2026-07-09: Phase 5 pass 6 defined auto-pipeline confirmation modes. Legacy `mode` settings now normalize into explicit `suggest_only`, `auto_lead_task`, `draft_deal` and `appointment_explicit` policies. Auto-pipeline metadata/activity includes `confirmation_policy`; tests prove suggest-only does not create CRM records, lead/task and draft deal modes remain guarded, and appointments are booked only after the client selects an offered slot.

Update 2026-07-09: Phase 5 pass 5 added a pre-action AI qualification contract for inbox CRM automation. `POST /api/inbox/conversations/{id}/qualify/` requires `conversations:update` and `ai_pipeline:suggest`, stores a no-mutation `conversation_qualification_preview` with the AI log and last message id, and writes `conversation_qualification_previewed` activity. AI-driven `run-pipeline` now requires a fresh preview before creating CRM entities; the Conversations UI exposes the preview action and disables CRM link updates until preview exists.

Update 2026-07-09: Phase 5 pass 4 added appointment creation from inbox conversations. `POST /api/inbox/conversations/{id}/create-appointment/` requires a linked client, a business service, optional business resource and a valid available slot; it creates the appointment, links client/lead context, updates lead appointment state, schedules existing follow-ups and writes `appointment_created` activity with `conversation_id`. `frontend/src/api/inbox.ts` exposes the endpoint for later UI wiring.

Update 2026-07-09: Phase 5 pass 3 hardened manual inbox CRM actions. Link/create client, link/create lead, link/create deal and create task flows are covered by backend API tests; manual link/create actions now write timeline activity with `conversation_id`, while pipeline-created CRM entities continue to write service-backed activity from `apps/conversations/pipeline.py`.

Update 2026-07-09: Phase 5 pass 2 hardened quick replies management in Settings. The Settings quick replies section and mutations now require `conversations:manage`, backend tests cover view-only denial for create/update/delete, and frontend build plus route smoke passed.

Update 2026-07-09: Phase 5 pass 1 hardened the inbox action/activity layer. Manual inbox actions now leave timeline activity for assign, handoff, retry, close, reopen, unread marking and priority changes; outbound message activity records the authenticated actor; provider delivery errors/results are sanitized before storage/API responses. Existing role-aware inbox summary and CRM link/create actions were reviewed against backend tests.

Статус: Phase 5 conversations-to-CRM checklist is complete at current scope.

Сделано:

- быстрые ответы вынесены в модалку;
- composer textarea динамически растет без перекрытия всего экрана;
- правый context inspector можно открывать/закрывать;
- CRM-действия: связать клиента/лид/сделку, создать задачу;
- app header освобожден от лишней кнопки ответа клиенту.

Current follow-up after completed phase:

- deeper inline appointment UX can continue only if product needs richer scheduling inside the inbox; backend appointment creation from conversations is already available and covered by the current CRM flow.

### Leads

Update 2026-07-14: Lead appointment-created lifecycle transitions are centralized in `apps.leads.services`. Lead API create-appointment, scheduling service `create_appointment_from_lead`, inbox conversation appointment creation and auto-booking now call the same lead lifecycle helper instead of assigning `lead.status`/`lead.service` directly. The helper validates allowed transitions and same-business service/resource/appointment links, writes taxonomy-backed lead activity/audit metadata, preserves responsible-user notification routing and emits the lead status automation trigger. Focused tests cover happy path, permission denial, tenant-related service rejection, invalid closed-lead no-side-effect behavior and backend E2E CRM flows.

Update 2026-07-04: Phase 1 UI alignment and Phase 2 lead lifecycle are complete. Leads now have service-backed lifecycle actions with explicit allowed transitions, protected generic update paths for lifecycle/archive fields, lost-reason enforcement, active business member validation, lead -> deal, lead -> appointment and lead -> follow-up task API contracts, activity/audit coverage for key actions, normalized phone/email duplicate detection through the client identity layer, and focused backend tests for lifecycle, permission denial, tenant isolation and cross-entity flows. Leads are client-backed at creation; the historical no-op lead -> client action was removed in B6. Historical follow-ups from this pass were later advanced by the Phase 8 activity/audit mapping, Phase 10 automation runtime, Phase 13 cross-entity E2E gates and 2026-07-15 pilot-critical UX polish.

Статус: Phase 1/2 lead lifecycle foundation is complete at current scope; remaining lead work is production-like QA or future UX refinement, not an unimplemented lifecycle foundation.

Сделано:

- базовый table UX;
- lead drawer foundation;
- фильтры и pagination foundation.

Historical remaining notes, superseded or narrowed by later phases:

- unified CRM table/list and drawer work continued through later page-splitting and pilot UX passes;
- lead lifecycle service and lead conversion contracts are service-backed and covered by focused backend/E2E checks;
- lead activity/audit and automation coverage was advanced by Phase 8 and Phase 10.

### Clients

Update 2026-07-09: Phase 4 pass 2 closed consent/source attribution at the current CRM scope. Clients now store `source_detail` and `source_context_json`; public lead forms copy campaign/domain/form attribution into client records; merge snapshots preserve source attribution; CRM card payloads include `OutreachConsent` status summaries for outreach channels; the client drawer shows source attribution and consent status. Migration `clients.0005_client_source_attribution` was applied to the local dev database.

Update 2026-07-09: Phase 4 pass 1 validated and closed the client identity, dedup, merge, archive/restore and CRM card baseline. Client create/update normalizes phone/email identity, duplicate detection is business-scoped, frontend create/edit flows warn on possible duplicates, merge has dry-run and confirmation UX, merge writes `ClientMergeLog`, transfers related leads, deals, appointments, tasks, conversations, notes and activity, and archives the duplicate with audit/activity output. Client CRM cards have coverage for related leads, deals, appointments, tasks, conversations and timeline activity.

Статус: Phase 4 client production layer checklist is complete at current scope.

Сделано:

- normalized identity fields;
- selectors/service foundation;
- тесты на identity behavior.
- business-scoped duplicate detection by phone/email;
- frontend duplicate warning in client create/edit;
- merge dry-run and confirmation flow;
- `ClientMergeLog` with transfer counts;
- safe transfer of related leads, deals, appointments, tasks, conversations, notes and activity;
- client archive/restore;
- client CRM card related context and test coverage.
- client source attribution fields and lead form source context copy;
- CRM card outreach consent summary.

Current follow-up after completed phase:

- broader browser/manual smoke once Browser runtime input is available again;
- deeper consent-management UX inside the client drawer, if merchant roles need inline opt-in/out editing beyond the existing outreach consent import/API workflow.

### Deals

Update 2026-07-09: Phase 3 pass 5 completed the current deal drawer production scope. The CRM drawer now shows linked client, lead, open tasks, appointments, latest activity and latest conversation context; shared drawer tabs include counters and a dedicated appointments tab; `/api/deals/{id}/crm-card/` has contract coverage for linked entities and cross-business activity isolation. Phase 3 deal production checklist is complete at the current scope.

Update 2026-07-09: Phase 3 pass 4 hardened deal summary metrics. The summary API now calculates open value, won value, lost value/count, conversion rate and stale deals through `apps/crm/selectors.py`, keeps inherited ordering out of grouped counts, and uses the same stale-deal definition for summary and quick `hot` filtering. At that point drawer polishing remained open; it is closed by pass 5.

Update 2026-07-09: Phase 3 pass 3 added persistent `DealValueHistory` and `deal_value_changed` activity/audit output for deal amount/currency changes. Generic deal edits and final amount updates during `mark-won` now leave a business-scoped value trace with before/after amount, currency, actor, source and metadata.

Update 2026-07-09: Phase 3 pass 2 added persistent `DealStageHistory` for service-backed stage/status transitions. `move-stage`, `mark-won`, `mark-lost` and `reopen` now leave a business-scoped history row with from/to stage, from/to status, actor, source and amount before/after snapshots.

Update 2026-07-04: Phase 3 pass 1 is complete. Deals now have explicit backend permission gates on lifecycle actions, active-business owner validation, service/action-only terminal lifecycle changes, and focused tests for move stage, won/lost/reopen, foreign stage rejection, permission denial and tenant isolation.

Status: Phase 3 deal production layer checklist is complete at current scope.

Current follow-up after completed phase:

- frontend E2E baseline exists through Phase 13; expand full-browser deal coverage only when deal UI behavior changes;
- deeper automation/BusinessEvent mapping for deal lifecycle remains a product-extension follow-up beyond the current domain foundation;
- pipeline configuration UX for merchant-facing setup.

## 3. Non-Negotiable CRM Invariants

- Все CRM-сущности scoped к `Business`.
- Related objects должны принадлежать одному business.
- Assignee/owner/responsible/watcher должен быть active business member.
- Terminal states меняются через domain actions, а не generic update.
- Lost/cancel destructive flows требуют reason, где это важно для бизнеса.
- Appointment booking/rescheduling respects working hours and overlap rules.
- Critical CRM data архивируется вместо hard-delete по умолчанию.
- User-facing business actions пишут activity timeline.
- Sensitive/destructive actions пишут audit.
- Frontend не считается security boundary.

## 4. Следующий Слой Работ

### Layer 0: Stabilization Checkpoint

Обязательно перед новой крупной фичей:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py migrate
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
cd frontend && npm run build
```

Дополнительно:

- проверить targeted backend tests по `tasks`, `clients`, `conversations`, `bots`, `core`;
- убедиться, что API не возвращают HTML traceback вместо JSON;
- зафиксировать изменения небольшими commit-группами при возможности.

### Layer 1: Shared CRM UI Pattern

Единый UX для `Leads`, `Deals`, `Clients`, `Tasks`:

- compact table surface;
- row click opens entity drawer;
- filters не перекрывают рабочий контент;
- pagination/load-more;
- empty/loading/error states;
- shared confirmation/undo for destructive actions.

### Layer 2: Entity Lifecycle Contracts

Закрепить backend services:

- lead lifecycle;
- deal stage transitions;
- client merge/dedup;
- task lifecycle;
- appointment lifecycle;
- conversation CRM actions.

### Layer 3: Activity And Audit Completeness

Update 2026-07-09: Phase 8 pass 1 added an explicit ActivityEvent taxonomy contract. Core CRM timeline events now have a server-side definition with category, domain, label, timeline visibility and audit/importance flags. This is the foundation for mapping remaining lead/deal/client/appointment/conversation/AI/integration actions consistently instead of adding ad hoc event strings.

Update 2026-07-09: Phase 8 pass 2 aligned lead lifecycle activity/audit output with the taxonomy contract. Lead take/contact/close/lost/reopen audit rows now carry taxonomy `event_type`, lost/reopen events preserve reason history, assignment/conversion audit metadata is source-traceable, and lead notes use the `ActivityEvents` constant instead of a raw string.

Update 2026-07-09: Phase 8 pass 3 aligned deal lifecycle activity/audit output with the taxonomy contract. Deal stage moves, won/lost/reopen and value changes now record taxonomy event metadata, ordinary stage moves write lifecycle audit, lost/reopen preserve reason history, and value changes distinguish `deal_value_changed` from the source lifecycle event.

Update 2026-07-09: Phase 8 pass 4 aligned client merge/archive activity/audit output with the taxonomy contract. Client merge, archive and restore now carry taxonomy event metadata, merge logs include duplicate client ids, and generic client archive/restore events attach to the client timeline.

Update 2026-07-09: Phase 8 pass 5 aligned appointment lifecycle activity/audit output with the taxonomy contract. Confirm, cancel, complete, no-show and reschedule timeline events now carry taxonomy `event_type`, normalized `lifecycle_action`, from/to status and reason where applicable; request-backed cancel, complete, no-show and reschedule audit rows carry the same source-traceable lifecycle metadata.

Update 2026-07-09: Phase 8 pass 6 aligned conversation send/link/create activity with the taxonomy contract. Inbox send/retry/link/create events and conversation pipeline-created client/lead/deal/task events now carry taxonomy `event_type` plus `conversation_id` metadata, with constants covering message retry, AI qualification preview and client/lead/deal link events.

Update 2026-07-09: Phase 8 pass 7 added security audit coverage for AI tool execution and approvals. Tool execution attempts now write sanitized `AuditLog` rows with tool/status/source metadata and safe output refs, while approval request creation, approval and rejection write audit rows without raw payload values.

Update 2026-07-09: Phase 8 pass 8 mapped CRM-linked integration BusinessEvents into ActivityEvent timeline. `normalize_business_event` now writes one `integration_event` timeline row for new BusinessEvents that safely resolve to a same-business client, lead, deal or appointment, while non-CRM integration signals remain BusinessEvent-only.

Update 2026-07-09: Phase 8 pass 9 added the unified CRM card timeline display. The shared drawer timeline now renders grouped dates, visible/total event counts, category/source/event badges and allowlisted lifecycle/integration/entity metadata from the existing CRM card payload without adding a new endpoint or exposing raw provider metadata.

Update 2026-07-09: Phase 8 pass 10 closed the activity/audit test-hardening checklist at current scope. Task timeline events now carry taxonomy metadata for lifecycle, assignment, schedule and watcher actions; task cancel/undo/assign audit rows carry taxonomy `event_type`; tests assert critical task timeline/audit records plus denial and tenant-hidden no-side-effect behavior. Phase 8 activity, audit and unified timeline checklist is complete at current scope.

Каждое важное CRM-действие должно оставлять след:

- activity event for user-facing timeline;
- audit event for sensitive/destructive action;
- notification only where it adds real operational value.

### Layer 3.5: AI Source-Grounded CRM Assistance

Update 2026-07-09: Phase 9 pass 1 reviewed the AI core model and API contracts. `AIRequestLog`, `BusinessKnowledgeItem`, `AgentProfile`, `AIToolCallLog` and `ApprovalRequest` are business-scoped, AI assistant/analyst/tool/approval endpoints are permission-gated, tool/approval responses and audits sanitize secret-like payloads, and approval decisions are audited. Follow-up hardening is required for user-scope-aware AI context, source-scoped analyst inputs, API-safe AI request log serialization and explicit approval gates for critical AI tool execution.

Update 2026-07-09: Phase 9 pass 2 made AI assistant CRM context user-scope aware. Assistant prompt/log context now applies the existing `clients:view`, `leads:view` and `appointments:view` backend scopes before summarizing CRM state, and tests prove a manager does not leak another owner's lead into assistant context.

Update 2026-07-09: Phase 9 pass 3 aligned AI analyst source citations with source permissions. BusinessEvent sources are now available to analyst only when the invoking user has `integrations:view`; users with AI analyst access but without integration access get the explicit no-data analyst fallback, and tests prove hidden BusinessEvent ids/payloads do not enter analyst responses or logs.

Update 2026-07-10: Phase 9 pass 4 completed the AI layer over real CRM data. ZANI now has a deterministic source-grounded owner daily brief and next-best-action API over stale leads, overdue tasks, unanswered conversations, stalled deals and failed connectors. Recommendations cite real CRM/connector sources, no-data states are explicit, owner dashboard consumes the live brief, AI request log responses mask secret-like data, and critical mutating AI tools require a matching approved `ApprovalRequest` before execution while read-only tools continue to audit execution.

Update 2026-07-14: AI approval creation and tool execution were hardened. `ApprovalRequest` create/update API paths no longer accept client-controlled decision state, new approvals start as `pending`, and malicious `status=approved` payloads remain unable to execute critical tools. Mutating AI tools now re-check the underlying CRM create permission before execution and AI-created task records go through the task service so routed notifications/activity remain consistent. Client, lead and deal AI tool paths now write source-tagged activity metadata, and lead creation emits the normal lead-created automation trigger.

Update 2026-07-14: Authenticated CRM UI copy was tightened so deterministic local hints are not presented as AI insight. The client inspector now shows a neutral CRM next-step card sourced from the selected client's leads/appointments, and local calendar/deal/inbox hint labels no longer use visible AI wording unless a future surface is connected to source-grounded AI/backend recommendation data.

Update 2026-07-14: AI source/no-data presentation was tightened on authenticated owner and assistant surfaces. Owner dashboard no longer falls back to local pseudo-AI recommendations when the backend owner brief is unavailable; it now shows loading, no-data, unavailable or no-access states explicitly. Source-backed owner brief recommendations expose their backend `source_ids`, and AI Assistant shows a visible provider-not-ready warning when the live provider is disabled or unconfigured.

### Layer 3.6: Automation Runtime

Update 2026-07-13: Phase 10 completed the current automation runtime layer. CRM automations now run through business-scoped `AutomationRun` records with idempotency, retry/cancel controls, per-business noisy-rule protection and an owner-facing run detail drawer. Supported triggers are lead created/status changed, deal stage changed, appointment cancelled/completed, task overdue and conversation unread. Supported safe actions are create task, create notification, assign user, add note, create follow-up and wait. Mutating actions execute through CRM/task/activity/notification domain services instead of direct view or model mutations, and tests cover service-emitted triggers, idempotency, retry, cancellation, permission denial and throttling.

### Outreach

Update 2026-07-14: Outreach campaign cancellation is now service-backed. `POST /api/outreach/campaigns/{id}/cancel/` delegates to `apps.outreach.services.cancel_campaign`, which cancels queued/pending recipients, cancels pending outreach notifications, records campaign activity, writes an audit lifecycle row and emits a source-grounded `BusinessEvent` for `outreach.campaign_cancelled`. Tests cover owner happy path, non-outreach role denial and cross-tenant hidden access.

### Layer 4: E2E Business Flows

Update 2026-07-15: Pilot-critical UX polish for Leads, Inbox, Dashboard and Settings is complete at the current scope. Leads already exposes real empty-state next actions and operational lead rows; Inbox now uses localized role-denial messages for AI reply, AI CRM preview and AI CRM execution attempts; owner dashboard AI states were reviewed against source-grounded/no-data/provider-unavailable behavior; Settings billing copy was moved into i18n, and the operator Playwright smoke asserts the forbidden settings surface does not expose billing/developer/API/webhook/payload/provider technical noise. Frontend build, operator settings smoke, mobile owner/manager smoke and diff hygiene passed.

Update 2026-07-14: Controlled pilot QA was tightened around the existing pilot launch package. `seed_pilot_demo` and `prepare_pilot_demo` now include owner, manager and operator logins; the operator receives a real task-queue item, and `pilot_launch_quality_gate` logs in as the operator and verifies operator task and inbox-summary reachability. `docs/testing.md` now defines the Windows-safe controlled pilot QA gate and manual fallback, while `docs/paid-beta-gate.md` keeps the boundary clear: local mock/dev pilot green is not paid-beta readiness.

Update 2026-07-13: Phase 13 is complete at the current CRM scope. `apps/core/tests_business_flows_e2e.py` now proves the main cross-entity CRM flows through authenticated API contracts: owner login/dashboard/lead assignment, client-backed lead -> appointment -> task, lead -> deal -> won/lost, inbox AI qualification -> lead/task, duplicate warning -> merge dry-run -> merge, appointment reschedule/cancel/no-show, integration BusinessEvent -> CRM timeline and AI suggestion -> approval -> tool execution -> audit. Mobile Playwright smoke now covers both owner and manager daily CRM routes with deterministic seed users from `prepare_e2e_smoke_data`. AI-created tasks suggested from a conversation now keep the originating `BotConversation` link.

Проверяем не страницы, а реальные сценарии:

- [x] owner login -> dashboard -> leads -> create/assign lead;
- [x] client-backed lead -> appointment -> task;
- [x] lead -> deal -> won/lost;
- [x] inbox message -> AI qualification -> lead/task;
- [x] client duplicate warning -> merge dry-run -> merge;
- [x] appointment reschedule/cancel/no-show;
- [x] integration event -> BusinessEvent -> CRM timeline action;
- [x] AI suggests action -> user approves -> service executes -> audit exists;
- [x] mobile smoke for owner/manager daily flows.

Remaining follow-up after Phase 13:

- keep expanding full-browser E2E only when UI behavior changes, because backend cross-entity gates now cover the core CRM invariants;
- fixed 2026-07-13: Playwright local `webServer` setup now uses `frontend/e2e/django-e2e.mjs`, which resolves the Windows/Unix virtualenv Python path, applies safe local env defaults, runs migrations, prepares smoke data and starts Django without Unix-style env-prefix commands.

## 5. Ближайший Приоритет

Update 2026-07-24: completed frontend/backend phase plans are frozen as
evidence. The active local pre-pilot queue, autonomous two-track execution
protocol, Git rules and external-production boundary live in
`actual_docs/PROJECT_EXECUTION_MASTER.md`.

The old page-by-page priority list above has been superseded by completed phase notes, the closed audit checklist and the current product/technical map. Current near-term priorities are:

1. Keep the provider live/mock readiness matrix current and make merchant-facing connector labels follow it.
2. Keep `API_ACTION_CONTRACT.md` synchronized with actual DRF router/actions before frontend work uses an endpoint.
3. Run production-like merchant data QA for calendar, tasks, client/deal/inbox daily workflows and AI source-grounded summaries.
4. Implement the dentistry-first product profile/capability layer before promising a dentistry workspace where Deals are disabled by default.
5. Expand full-browser E2E only when UI behavior changes; backend cross-entity gates already cover core CRM invariants.
6. Continue provider rollout only through readiness gates, rollback notes and support-visible status.
