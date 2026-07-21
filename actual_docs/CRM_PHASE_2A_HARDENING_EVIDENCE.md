# ZANI CRM Phase 2A Hardening And Evidence Pass

Date: 2026-07-16
Status: Complete
Scope: core CRM backend/frontend contract before App 2.0 entity workspaces

## 1. Business Outcome

Before rebuilding `/app` visually, ZANI must prove that the new App 2.0 screens can rely on stable CRM backend contracts instead of recreating business logic in React.

This phase checks:

- critical CRM actions are routed through explicit backend endpoints;
- lifecycle mutations are service-backed or identified as hardening debt;
- entity workspace data can reuse the existing CRM card contract;
- frontend uses API clients rather than raw network calls for CRM flows;
- verification covers cross-entity business workflows.

## 2. Allowed Scope

Allowed in this phase:

- inspect backend CRM action handlers;
- inspect frontend CRM route/API usage;
- document exact hardening gaps;
- run scoped backend verification;
- define the data contract for upcoming entity workspaces.

Not allowed in this phase:

- redesign `/app` UI;
- implement vertical business modes;
- rewrite backend models;
- make broad refactors across every CRM module;
- mark App 2.0 UI phases complete.

## 3. Impact Record

Business outcome: validate the backend/frontend contract for App 2.0.

Primary users and roles:

- owner/director;
- manager/team lead;
- sales manager;
- messenger operator;
- staff/specialist.

Entities and Business ownership paths:

- Client -> Business;
- Lead -> Business and Client;
- Deal -> Business, Client, Lead, Pipeline, Stage;
- Appointment -> Business, Client, Lead, Service, Resource;
- Task -> Business, Client, Lead, Deal, Appointment, Conversation;
- BotConversation -> Business, Client, Lead, Deal;
- ActivityEvent/Note/FileAttachment/CustomField -> Business plus entity refs.

Lifecycle fields or transitions:

- Lead: status, responsible user, lost reason, conversion actions.
- Deal: stage, status, won/lost timestamps, lost reason, owner.
- Appointment: status, start, resource, cancel/no-show reason.
- Task: status, assignee, snooze, cancellation, archive.
- Conversation: assignment, handoff, priority, read/unread, close/reopen, CRM link/create actions.

Permission impact:

- No code permission changes in this phase.
- Future App 2.0 must keep backend permission gates as source of truth.
- Frontend route/sidebar hiding remains UX only.

Notification impact:

- No notification code changes in this phase.
- Future entity workspaces must use existing service-backed notification behavior instead of local UI assumptions.

BusinessEvent/activity/audit impact:

- No activity/audit code changes in this phase.
- Phase identified where activity exists and where service extraction should preserve audit/timeline behavior.

AI source or approval impact:

- No AI code changes in this phase.
- Future AI UI must show source/no-data/provider/approval states from backend contracts.

Integration/provider impact:

- None for this phase.

Migration impact:

- None for this phase.

Environment impact:

- None for this phase.

API contract impact:

- Defines the existing CRM card contract as the base for entity workspaces.
- Identifies missing workspace requirements before UI implementation.

Frontend route/API client impact:

- No frontend code changes in this phase.
- Future App 2.0 should add URL-addressable entity workspaces that reuse `crmCardsApi`.

i18n impact:

- None for this phase.
- Future UI copy must live in i18n/constants.

## 4. Critical Action Routing Audit

### 4.1 Strong Service-Backed Paths

| Domain | Action path | Current evidence | Verdict |
| --- | --- | --- | --- |
| Leads | assign, take-in-work, mark-contacted, mark-closed, mark-lost, reopen | `LeadViewSet` delegates to `assign_lead`, `take_lead_in_work`, `mark_lead_contacted`, `mark_lead_closed`, `mark_lead_lost`, `reopen_lead` | Strong |
| Leads | create deal | `LeadViewSet.create_deal` calls `create_deal_from_lead` | Strong |
| Leads | convert client | `LeadViewSet.convert_client` calls `convert_lead_to_client` | Strong |
| Leads | create appointment | `LeadViewSet.create_appointment` validates serializer and calls `create_appointment_from_lead_contract` | Strong |
| Leads | create task | `LeadViewSet.create_task` calls `create_follow_up_task_from_lead` | Strong |
| Deals | move stage, won, lost, reopen | `DealViewSet` calls `move_deal_stage`, `mark_deal_won`, `mark_deal_lost`, `reopen_deal` | Strong |
| Clients | archive | `ClientViewSet.archive` calls `archive_instance` | Strong |
| Clients | merge | `ClientViewSet.merge` validates serializer and writes merge audit | Acceptable; serializer/service boundary should be checked before workspace actions |
| Tasks | complete, start, cancel, undo-cancel, reopen, snooze, assign, assign-to-me, due today/tomorrow, watcher | `TaskViewSet` delegates lifecycle actions to `apps.tasks.services` | Strong |
| Appointments | confirm, cancel, complete, no-show, reschedule | `AppointmentViewSet` delegates lifecycle actions to scheduling services | Strong |
| Inbox | assign, handoff, retry, priority, close/reopen, suggest reply, appointment creation, AI pipeline | Inbox actions call conversation, provider, AI and scheduling services | Strong |
| Automations | create task/follow-up/notifications/assign/note | `apps.automations.engine` calls service helpers such as `create_automation_task` | Strong |

### 4.2 Hardening Debt Before App 2.0

These are not blockers for starting UI planning, but they should be handled before making the new workspace the primary production UI.

| Area | Finding | Risk | Recommended action |
| --- | --- | --- | --- |
| Inbox create task | Resolved on 2026-07-16: `InboxConversationViewSet.create_task` delegates to `create_task_from_conversation` | Reduced; future workspace can reuse the service-backed contract | Keep service covered as workspace actions are added |
| Inbox create client | `InboxConversationViewSet.create_client` directly creates `Client` in the view after duplicate check | Client creation behavior can drift from other create flows | Extract or reuse a client creation service that preserves duplicate/source behavior |
| Inbox link client/lead/deal | Link actions mutate conversation FKs in view | Acceptable today but should become a small service for consistent activity/audit and future workspace use | Extract `link_conversation_to_*` helpers before full inbox/entity redesign |
| Lead add note | `LeadViewSet.add_note` creates `Note` directly in view | Existing behavior writes audit/activity, but view owns business logic | Route through `create_note_for_entity` or a lead note service |
| Task update details | `TaskViewSet.update_details` owns detail update/audit diff inside view | Works today, but view is heavier than desired | Move diff/update/audit into task service before adding workspace inline editing |
| CRM card available actions | Resolved on 2026-07-16: CRM card payloads now include user-scoped `available_action_details` while preserving legacy `available_actions` strings | Reduced; future workspace can render allowed/disabled actions without guessing backend permissions | Keep backend denial authoritative and use the metadata for App 2.0 action bars |
| CRM card pagination | Related lists are capped at 25 and timeline/notes at 50 | Full workspace needs "view all" routes and paginated related tabs | Keep CRM card for overview; add paginated related endpoints or reuse list APIs with filters |
| CRM card conversations | Conversation relation is client/lead based, not deal/appointment based | Deal/appointment workspaces may miss relevant conversations indirectly tied through deal or appointment | Add relation rules or explicit related conversation APIs if product needs them |
| Frontend navigation | Some CRM cross-links use `window.location.assign` / `window.location.href` | Hard reloads and query-param deep links weaken App 2.0 feel | Replace with router navigation during UI rebuild |

## 5. Existing CRM Card Contract

Current frontend entrypoint:

```text
frontend/src/api/crmCards.ts
crmCardsApi.get({ type, id }) -> /api/{entity}/{id}/crm-card/
```

Current supported entity types:

- `client`
- `lead`
- `deal`
- `appointment`

Current backend endpoints:

- `GET /api/clients/{id}/crm-card/`
- `GET /api/leads/{id}/crm-card/`
- `GET /api/deals/{id}/crm-card/`
- `GET /api/appointments/{id}/crm-card/`

Current payload shape:

- `primary_entity`
- `available_actions`
- `available_action_details`
- `meta.related_counts`
- `meta.limits`
- `meta.has_more`
- `client`
- `lead`
- `deal`
- `appointment`
- `leads`
- `deals`
- `appointments`
- `tasks`
- `conversations`
- `timeline`
- `notes`
- `tags`
- `attachments`
- `consents`
- `custom_fields`

This is a good base for App 2.0 entity workspaces.

## 6. Required Entity Workspace Contract

The future workspace should reuse the current CRM card contract, but needs a stricter split between overview data and deep tab data.

### 6.1 Quick Inspector

Use existing CRM card data for:

- title/subtitle/status;
- primary entity summary;
- related counts;
- top related tasks/appointments/deals/conversations;
- latest timeline items;
- safe quick actions.

### 6.2 Full Entity Workspace

Use existing CRM card data for the first load, but add or reuse paginated APIs for:

- all conversations for client/lead/deal;
- all tasks by relation;
- all appointments by relation;
- all deals/leads by client;
- full timeline;
- notes and attachments;
- audit-sensitive actions.

Decision implemented on 2026-07-16:

- use CRM card payloads for the first workspace load, top related records, counts, timeline preview and safe actions;
- use existing paginated list APIs for deep workspace tabs instead of adding dedicated related endpoints at this stage;
- keep dedicated related endpoints as a later option only for relationships that cannot be expressed by existing tenant-scoped list APIs.

Current related data API map:

| Workspace tab | API contract |
| --- | --- |
| Client leads | `GET /api/leads/?client_ids=<id>` |
| Client deals | `GET /api/deals/?client_ids=<id>` |
| Client appointments | `GET /api/appointments/?client_ids=<id>` |
| Client tasks | `GET /api/tasks/?client_ids=<id>` |
| Client conversations | `GET /api/inbox/conversations/?client_ids=<id>` |
| Lead deals | `GET /api/deals/?lead_ids=<id>` |
| Lead appointments | `GET /api/appointments/?lead_ids=<id>` |
| Lead tasks | `GET /api/tasks/?lead_ids=<id>` |
| Lead conversations | `GET /api/inbox/conversations/?lead_ids=<id>` |
| Deal tasks | `GET /api/tasks/?deal_ids=<id>` |
| Deal conversations | `GET /api/inbox/conversations/?deal_ids=<id>` |
| Appointment tasks | `GET /api/tasks/?appointment_ids=<id>` |
| Conversation tasks | `GET /api/tasks/?conversation_ids=<id>` |

The shared ID parser now accepts both comma-separated query params such as `lead_ids=1,2` and frontend array params such as `lead_ids[]=1&lead_ids[]=2`.

### 6.3 Action Metadata

CRM card payloads now preserve the legacy string-only `available_actions` and add safer `available_action_details` metadata:

```text
available_action_details: [
  {
    id: "lost",
    label_key: "crm.actions.lost",
    resource: "leads",
    action: "update",
    allowed: true,
    scope: "business",
    reason: "",
    requires_reason: true,
    destructive: false,
    confirmation: "reason"
  }
]
```

This is enough for App 2.0 to render consistent action bars, disabled states, destructive confirmations and reason-required flows while keeping backend permission denial authoritative.

## 7. Frontend Contract Findings

Strong:

- `/app` routes cover the main CRM modules.
- Route permissions are enforced through `PermissionRoute`.
- Sidebar visibility uses permission checks.
- CRM card data is centralized through `frontend/src/api/crmCards.ts`.
- The shared `CrmEntityDrawer` already uses one query key: `["crm-card", type, id]`.
- Most network calls found in CRM UI go through API clients/hooks.

Hardening before App 2.0:

- replace hard reload navigation in CRM cross-links with router navigation;
- introduce URL-addressable entity workspaces instead of relying on query params only;
- keep drawer as quick inspector;
- define shared loading/empty/error/forbidden states for every workspace tab;
- avoid adding raw API calls to workspace components;
- keep all visible copy in i18n.

## 8. Recommended Phase 2A Implementation Backlog

This is the exact hardening backlog to complete before or during the first entity workspace implementation.

### P0. Create Conversation Task Service

Status: Complete on 2026-07-16.

Extract from `InboxConversationViewSet.create_task`:

- title/default title;
- description;
- client/lead/deal/conversation links;
- assignee;
- creator;
- priority;
- due date;
- timeline activity;
- routed task notification if required by product.

Acceptance:

- happy path create task from inbox;
- permission denial remains;
- tenant isolation remains;
- activity timeline still written;
- task appears in CRM card and task list.

Implementation result:

- added `apps/conversations/services.py`;
- added `create_task_from_conversation`;
- `InboxConversationViewSet.create_task` now validates/authorizes and delegates task creation to the service;
- API response shape and HTTP status are unchanged;
- focused tests cover happy path, default title, permission denial and tenant isolation.

### P0. Define User-Scoped Action Metadata

Status: Complete on 2026-07-16.

Replace or supplement string-only `available_actions`.

Acceptance:

- action ids remain stable;
- UI gets permission/action/resource metadata;
- actions requiring reason are explicit;
- destructive/confirmation behavior is explicit;
- backend denial still remains authoritative.

Implementation result:

- `apps/core/crm_cards.py` now returns `available_action_details` next to the legacy `available_actions`;
- each action detail includes stable id, label key, permission resource/action, allowed flag, scope, denial reason, reason requirement, destructive flag and confirmation mode;
- CRM card endpoints for clients, leads, deals and appointments pass `request.user` into the card builder;
- `frontend/src/types/index.ts` exposes `CrmCardActionDetail`;
- focused tests cover owner-allowed action metadata, support-role denied metadata and reason-required lead loss metadata.

### P0. Workspace Related Data Strategy

Status: Complete on 2026-07-16.

Decide whether full workspaces use:

1. CRM card first-load plus existing list APIs with relation filters; or
2. dedicated paginated related endpoints.

Recommended:

- CRM card for first load and counts;
- existing list APIs where filters already exist;
- add dedicated related endpoints only where current filters cannot express the relationship.

Implementation result:

- chose CRM card first-load plus existing paginated list APIs for full workspace tabs;
- extended deals list with `lead_ids`;
- extended appointments list with `lead_ids`;
- extended tasks list with `lead_ids`, `deal_ids`, `appointment_ids` and `conversation_ids`;
- extended tasks `client_ids`, `lead_ids` and `deal_ids` filters to include conversation-linked tasks, matching CRM card related task behavior;
- extended inbox conversation list with `client_ids`, `lead_ids` and `deal_ids`;
- updated frontend API parameter types for tasks, deals, appointments and inbox;
- added workspace related filter contract tests that prove happy path, `ids[]` frontend params and tenant-scoped filtering.

### P1. Extract Conversation Link Services

Extract:

- link client;
- link lead;
- link deal;
- create client from conversation.

Acceptance:

- same-business validation remains;
- activity timeline remains;
- duplicate confirmation remains for client creation.

### P1. Move Task Detail Update Into Service

Acceptance:

- update-details behavior unchanged;
- closed task rejection unchanged;
- assignee validation unchanged;
- audit diff unchanged.

### P1. Replace Hard Reload CRM Navigation

Acceptance:

- `window.location.assign` / `window.location.href` cross-app navigation replaced with router navigation where practical;
- tel/mailto links remain allowed;
- deep links preserve selected entity state.

## 9. Phase 2A Acceptance Criteria

- [x] Critical CRM action paths inspected.
- [x] Service-backed paths identified.
- [x] Non-service-backed hardening debt identified.
- [x] Entity workspace contract base identified.
- [x] Frontend API/navigation risks identified.
- [x] Vertical adaptation excluded from this phase.
- [x] Scoped verification passed.

## 10. Verification Plan

The narrow gate that proves current cross-entity CRM contracts still hold was run:

```powershell
$env:DATABASE_URL = 'sqlite:///db.sqlite3'
$env:SECURE_SSL_REDIRECT = 'False'
$env:SESSION_COOKIE_SECURE = 'False'
$env:CSRF_COOKIE_SECURE = 'False'
$env:REDIS_URL = 'memory://'
$env:CELERY_TASK_ALWAYS_EAGER = 'True'
$env:CELERY_TASK_STORE_EAGER_RESULT = 'False'
$env:AUTOMATIONS_RUN_INLINE = 'True'
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py test apps.core.tests_crm_cards apps.core.tests_business_flows_e2e -v 2
```

Result:

- `manage.py check`: passed, no issues.
- `manage.py test apps.core.tests_crm_cards apps.core.tests_business_flows_e2e -v 2`: passed, 15 tests OK.

Additional P0 action metadata verification on 2026-07-16:

- `manage.py test apps.core.tests_crm_cards -v 2`: passed, 9 tests OK.
- `manage.py check`: passed, no issues.
- `manage.py makemigrations --check --dry-run`: passed, no changes detected.
- `manage.py test apps.core.tests_crm_cards apps.core.tests_business_flows_e2e -v 2`: passed, 17 tests OK.
- `cd frontend; npm run build`: passed, including i18n parity, TypeScript build, app build and widget build.

Additional P0 workspace related data verification on 2026-07-16:

- `manage.py test apps.core.tests_workspace_related_filters -v 2`: passed, 2 tests OK.
- `manage.py check`: passed, no issues.
- `manage.py makemigrations --check --dry-run`: passed, no changes detected.
- `manage.py test apps.core.tests_workspace_related_filters apps.tasks.tests apps.core.tests_crm_cards apps.bots.tests.InboxBackendTests -v 2`: first run timed out at 180s, rerun with a larger timeout passed, 72 tests OK.
- `cd frontend; npm run build`: passed, including i18n parity, TypeScript build, app build and widget build.

Expected warnings observed during tests:

- intentional forbidden/bad-request cases for permission and validation coverage;
- local JWT insecure key length warning from the test environment.

Checks skipped for the original evidence pass:

- frontend build was skipped because no frontend code changed;
- Playwright/browser visual QA was skipped because this phase did not change UI;
- migration drift check was skipped because no model or migration files changed.

Checks skipped for the P0 action metadata implementation:

- Playwright/browser visual QA was skipped because the current change only extends the CRM card data contract and TypeScript type; it does not change visible UI.

Checks skipped for the P0 workspace related data implementation:

- Playwright/browser visual QA was skipped because this change extends API filters and frontend API types only; no visible UI changed.

## 11. Phase Decision

Phase 2A is complete as an evidence and hardening-planning phase.

The next implementation phase should be:

1. start the entity workspace foundation on top of the settled CRM card action/data contract;
2. keep P1 service extractions in scope only when a workspace action directly depends on them.

The entity action/data contract is now settled enough to start the first App 2.0 workspace foundation without adding duplicate related endpoints.
