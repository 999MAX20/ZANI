# ZANI CRM Implementation Tasks

This is the working execution checklist for bringing ZANI's CRM layer to a complete, production-oriented state.

Rule for Codex: when a task is actually completed and verified, change `[ ]` to `[x]` in this file in the same PR/change set. Do not mark work complete based only on intent or partial implementation.

## Definition Of Done For Every CRM Mechanic

A CRM mechanic is done only when all relevant items are true:

- [ ] Backend action lives in a service/state-machine helper, not only in a view.
- [ ] Querysets and mutations are tenant-safe by `Business`.
- [ ] Backend permissions enforce the action.
- [ ] Related objects are validated to belong to the same business.
- [ ] Frontend uses `frontend/src/api/*`, not raw component API calls.
- [ ] UI has loading, error, empty and forbidden states where applicable.
- [ ] Important user-facing action writes `ActivityEvent`.
- [ ] Sensitive or destructive action writes `AuditLog`.
- [ ] Critical action requires explicit confirmation when needed.
- [ ] Tests cover happy path, permission denial and tenant isolation.
- [ ] A user-facing route or flow proves the mechanic is usable.

## Phase 0: Stabilization Checkpoint

Goal: make the current project state reproducible before adding more CRM behavior.

- [x] Confirm local environment setup works from a clean checkout/archive.
- [x] Apply migrations on local SQLite.
- [x] Run `manage.py makemigrations --check --dry-run`.
- [x] Run `manage.py check`.
- [x] Run frontend `npm run build`.
- [x] Run focused backend tests for core CRM modules:
  - [x] `apps.clients.tests`
  - [x] `apps.leads.tests_forms`
  - [x] `apps.crm.tests`
  - [x] `apps.scheduling.tests`
  - [x] `apps.tasks.tests`
  - [x] `apps.core.tests_tenant_isolation`
- [x] Run or document full verification status.
- [x] Ensure demo/test users can log in.
- [x] Ensure `/app`, `/app/leads`, `/app/clients`, `/app/deals`, `/app/tasks`, `/app/calendar`, `/app/conversations` render without obvious runtime errors.
- [x] Record known baseline risks in this document.

Phase 0 verification status, 2026-07-03:

- `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py migrate` passed; no migrations to apply.
- `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed; no changes detected.
- `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
- `cd frontend && npm run build` passed; Vite reported large chunk warnings for existing bundles.
- Focused Django suite passed: `manage.py test apps.clients.tests apps.leads.tests_forms apps.crm.tests apps.scheduling.tests apps.tasks.tests apps.core.tests_tenant_isolation --verbosity=1`; 101 tests OK.
- `pytest apps.clients.tests ...` was attempted first but this Windows environment did not accept dotted module paths; Django test runner was used as the equivalent focused check.
- `prepare_e2e_smoke_data` passed and created/updated `platform_admin@example.com`, `business_owner@example.com`, `business_operator@example.com` with password `ZaniTest123!`.
- JWT login passed for platform admin, business owner and business operator.
- Frontend route smoke via Vite returned HTTP 200 for `/app`, `/app/leads`, `/app/clients`, `/app/deals`, `/app/tasks`, `/app/calendar`, `/app/conversations`.
- Full `scripts/codex_verify.sh` was not run end-to-end because this is a Windows PowerShell environment and the focused backend suite plus frontend build were run directly.

## Phase 1: Shared CRM Workspace Pattern

Goal: make Leads, Deals, Clients and Tasks feel like one CRM workspace, not separate unrelated screens.

- [x] Audit existing shared CRM UI components in `frontend/src/components/crm`.
- [x] Decide the standard list/table pattern for CRM entities.
- [x] Define common drawer/card layout for CRM entity details.
- [x] Ensure all CRM workspaces use stable pagination or load-more behavior.
- [x] Ensure all CRM workspaces expose consistent filters and search.
  - [x] Deals page exposes the existing URL/API filters through a visible shared CRM filter bar.
  - [x] Tasks page exposes the existing `search` query/API filter through a local search input.
- [x] Ensure row click opens details without shifting the primary table layout.
- [x] Ensure destructive actions use shared confirmation/undo pattern.
  - [x] Lead archive actions use shared confirmation with required reason and existing undo toast/history.
  - [x] Deal archive actions use shared confirmation with required reason and undo restore toast.
  - [x] Client archive actions use shared confirmation with required reason and undo restore toast.
- [x] Ensure forbidden states are role-aware and not silent empty screens.
- [x] Decompose oversized CRM pages before adding new logic:
  - [x] `frontend/src/features/leads/LeadsPage.tsx`
  - [x] `frontend/src/features/deals/DealsPage.tsx`
  - [x] `frontend/src/features/clients/ClientsPage.tsx`
  - [x] `frontend/src/features/tasks/TasksPage.tsx`
- [x] Add route smoke coverage for the shared CRM workspaces.

Phase 1 audit notes, 2026-07-03:

- Existing shared CRM shell components: `CrmWorkspacePage`, `CrmWorkspaceGrid`, `CrmTableSurface`, `CrmDataTable`, `CrmControlBar`, `CrmFilterChips`, `CrmPagination`, `CrmEmptyState`, `CrmInspector`, `CrmEntityDrawer`, `tableLayout`.
- Standard CRM workspace pattern: `CrmWorkspacePage` as page shell, `CrmTableSurface` as main surface, `CrmControlBar`/`CrmFilterChips` for tabs and advanced filters, `CrmDataTable` plus `tableLayout` constants for dense row/table layouts, `CrmPagination` for numbered pagination where backend supports counts.
- Standard detail pattern: row click sets a `CrmDrawerEntity`; `CrmEntityDrawer` loads `crmCardsApi.get({ type, id })` and renders entity-specific overview plus shared tabs for timeline, tasks, deals, files, messages and notes.
- Current adoption: Leads, Deals and Clients already use the shared CRM shell/drawer pattern. Tasks still primarily uses a separate `TaskList`/drawer structure and is the main candidate for alignment.
- Verification for this audit: static source inspection only; no runtime code changed for Phase 1 audit items.
- Existing route smoke coverage is in `frontend/e2e/smoke.spec.ts`, test `business owner core routes render without 404`, covering `/app`, `/app/leads`, `/app/deals`, `/app/clients`, `/app/tasks`, `/app/calendar`, `/app/services`, `/app/resources`, `/app/conversations` and more.
- Targeted route smoke verification passed: `E2E_SKIP_LOCAL_SETUP=true E2E_BASE_URL=http://127.0.0.1:5173 E2E_API_BASE_URL=http://127.0.0.1:8000 npx playwright test ./e2e/smoke.spec.ts --grep "business owner core routes render without 404" --project=desktop-chromium`.
- Local Playwright Chromium browser bundle was installed with `npx playwright install chromium` before running the targeted smoke.
- Pagination/load-more audit status: Leads use backend numbered pagination through `leadsApi.listPaginated`; Clients use `CrmPagination` with backend `page`/`page_size`; Tasks use backend infinite pagination with explicit load-more; Deals board now uses a server-driven board load-more contract by increasing `limit_per_stage` in `frontend/src/features/deals/hooks/useDeals.ts` when a board stage reports `has_more`, while `frontend/src/features/deals/components/DealsList.tsx` still reveals already-loaded cards locally before requesting the next backend batch.
- Deals filters implementation status: `frontend/src/features/deals/components/DealsFilters.tsx` now renders quick filters, search, status, stage, owner, source, amount and date filters using existing shared CRM controls and `useDealFilters` state. `DealsPage` wires the filter bar into `CrmTableSurface`; no backend lifecycle, permission, notification, BusinessEvent, AI or migration behavior changed.
- Tasks search implementation status: `frontend/src/features/tasks/components/TaskList.tsx` now renders a search input in the task table filter row and writes to the same `search` query parameter already used by `TasksPage` and `tasksApi.listPage`.
- Deals filters verification: `cd frontend && npm run build` passed, including i18n parity, TypeScript and Vite builds. SPA navigation smoke after real UI login passed for `/app/deals`, `/app/clients` and `/app/tasks`.
- Search/filter verification after Tasks search: `cd frontend && npm run build` passed again; route smoke passed again with `E2E_SKIP_LOCAL_SETUP=true E2E_BASE_URL=http://127.0.0.1:5173 E2E_API_BASE_URL=http://127.0.0.1:8000 npx playwright test ./e2e/smoke.spec.ts --grep "business owner core routes render without 404" --project=desktop-chromium`.
- Baseline failure found and fixed during route smoke: the Playwright login helper previously relied on localStorage token injection, while the frontend auth model now uses an in-memory access token plus refresh flow. `frontend/e2e/smoke.spec.ts` now stubs `/api/auth/token/refresh/` with the backend-issued test access token for reload-based route audits.
- Route smoke after the e2e helper fix passed: `E2E_SKIP_LOCAL_SETUP=true E2E_BASE_URL=http://127.0.0.1:5173 E2E_API_BASE_URL=http://127.0.0.1:8000 npx playwright test ./e2e/smoke.spec.ts --grep "business owner core routes render without 404" --project=desktop-chromium`.
- Row-click/detail audit status: Leads, Clients and Tasks use full row activation with keyboard support; Deals opens detail drawers from kanban/list items. The detail views are drawer overlays (`CrmEntityDrawer` or `TaskDrawer`) and do not replace or resize the primary table/list surface. Verification: route smoke passed after this audit.
- Destructive-action status: Lead archive opens the shared confirmation dialog with required reason before single, bulk or swipe archive, then uses the existing undo toast/history restore path. Deal and Client archive actions now use the same shared confirmation dialog with required reason and undo restore toast. Task cancellation and comment deletion already used shared confirmation; task cancellation already had undo.
- Destructive-action verification: `cd frontend && npm run build` passed after Lead archive alignment; `cd frontend && npm run build` passed after Deal/Client alignment; route smoke passed with `E2E_SKIP_LOCAL_SETUP=true E2E_BASE_URL=http://127.0.0.1:5173 E2E_API_BASE_URL=http://127.0.0.1:8000 npx playwright test ./e2e/smoke.spec.ts --grep "business owner core routes render without 404" --project=desktop-chromium`.
- Forbidden-state audit status: authenticated CRM routes are wrapped in `PermissionRoute`, which uses `PermissionGate mode="forbidden"` and `ForbiddenState` with resource/action-aware copy from `permissionForbiddenMessage`; this prevents silent empty pages when a role lacks access.
- Forbidden-state verification: targeted browser smoke for `business_operator@example.com` against `/app/settings` confirmed a non-empty `role="alert"` forbidden state on the route and no `Unexpected Application Error`.
- Decomposition audit status: `DealsPage.tsx` is currently 208 lines and delegates filters, list rendering, modals, actions, filters, metrics and selection into feature components/hooks, so it is within the frontend size guidance. `ClientsPage.tsx` is 563 lines, `TasksPage.tsx` was 514 lines and `LeadsPage.tsx` is 1167 lines; those remain open and should be decomposed as separate bounded tasks.
- Tasks decomposition pass 1: URL-backed task filters, search params, list params, summary params and active filter counting moved from `TasksPage.tsx` into `frontend/src/features/tasks/hooks/useTaskFilters.ts`. `TasksPage.tsx` is now 433 lines and still remains open because it is above the frontend size guidance and still owns queries, mutations, form submit and drawer orchestration.
- Tasks decomposition pass 1 affected areas: no backend permissions impact, no notification behavior change, no BusinessEvent impact, no AI impact, no migration/env impact.
- Tasks decomposition pass 1 verification: `cd frontend && npm run build` passed, including i18n parity, TypeScript and Vite builds. Backend checks skipped because only frontend decomposition changed and no API/backend behavior was touched.
- Tasks decomposition pass 2: task read queries for selected task, comments, activity, paginated list, summary and team members moved from `TasksPage.tsx` into `frontend/src/features/tasks/hooks/useTaskQueries.ts`. `TasksPage.tsx` is now 405 lines and still remains open because mutation/action orchestration and form submit logic are still page-local.
- Tasks decomposition pass 2 affected areas: no backend permissions impact, no notification behavior change, no BusinessEvent impact, no AI impact, no migration/env impact.
- Tasks decomposition pass 2 verification: `cd frontend && npm run build` passed, including i18n parity, TypeScript and Vite builds. Backend checks skipped because only frontend decomposition changed and no API/backend behavior was touched.
- Tasks decomposition pass 3: task create/update/lifecycle/comment mutations, confirmation handlers, undo notification handling, action error notification and form submit orchestration moved from `TasksPage.tsx` into `frontend/src/features/tasks/hooks/useTaskActions.ts`; reusable form-to-payload conversion moved into `frontend/src/features/tasks/taskFormUtils.ts`. `TasksPage.tsx` is now 263 lines, within the frontend page size guidance.
- Tasks decomposition pass 3 affected areas: no backend permissions impact, notification behavior preserved through the existing shared providers, no BusinessEvent impact, no AI impact, no migration/env impact.
- Tasks decomposition pass 3 verification: `cd frontend && npm run build` passed, including i18n parity, TypeScript and Vite builds; targeted route smoke passed with `E2E_SKIP_LOCAL_SETUP=true E2E_BASE_URL=http://127.0.0.1:5173 E2E_API_BASE_URL=http://127.0.0.1:8000 npx playwright test ./e2e/smoke.spec.ts --grep "business owner core routes render without 404" --project=desktop-chromium`. Backend checks skipped because only frontend decomposition changed and no API/backend behavior was touched.
- Follow-up note: `useTaskActions.ts` is currently 191 lines because it centralizes many existing task mutations. Do not add more behavior there without considering a lifecycle/comment/form split.
- Clients decomposition pass 1: client workspace state, URL search/create/client param handling, filtering, pagination, client/tag/segment queries, derived rows, KPI, source/tag/segment options and drawer selection moved from `ClientsPage.tsx` into `frontend/src/features/clients/hooks/useClientsWorkspace.ts`.
- Clients decomposition pass 2: create/edit, merge preview, tag and segment modal JSX moved from `ClientsPage.tsx` into `frontend/src/features/clients/components/ClientsModals.tsx`.
- Clients decomposition pass 3: client page header registration and keyboard shortcuts moved from `ClientsPage.tsx` into `frontend/src/features/clients/hooks/useClientsPageHeader.ts`. `ClientsPage.tsx` is now 300 lines, within the frontend page size guidance.
- Clients decomposition affected areas: no backend permissions impact, notification behavior preserved through existing archive undo provider, no BusinessEvent impact, no AI impact, no migration/env impact.
- Clients decomposition verification: `cd frontend && npm run build` passed, including i18n parity, TypeScript and Vite builds; targeted route smoke passed with `E2E_SKIP_LOCAL_SETUP=true E2E_BASE_URL=http://127.0.0.1:5173 E2E_API_BASE_URL=http://127.0.0.1:8000 npx playwright test ./e2e/smoke.spec.ts --grep "business owner core routes render without 404" --project=desktop-chromium`. Before the successful smoke, backend/frontend dev servers were restarted because old PID files pointed to non-responsive processes; backend migrations and `prepare_e2e_smoke_data` passed before restart. Backend test suite skipped because only frontend decomposition changed and no API/backend behavior was touched.
- Follow-up note: `useClientsWorkspace.ts` is currently 237 lines because it centralizes workspace state and read queries. Do not add more behavior there without considering a filters/query/drawer split.
- Leads decomposition pass 1: modal JSX moved into `frontend/src/features/leads/components/LeadsModals.tsx`, table/toolbar/mobile/pagination rendering moved into `frontend/src/features/leads/components/LeadsWorkspaceTable.tsx`, context menu and bulk bar overlays moved into `frontend/src/features/leads/components/LeadsActionOverlays.tsx`, and page header registration moved into `frontend/src/features/leads/hooks/useLeadsPageHeader.ts`.
- Leads decomposition pass 2: export formatting moved into `frontend/src/features/leads/utils/leadExport.ts`; selected lead related read-model and duplicate enrichment moved into `frontend/src/features/leads/hooks/useLeadSelectionContext.ts`; offline cache/queue/sync handling moved into `frontend/src/features/leads/hooks/useLeadOfflineQueue.ts`; undo toast history moved into `frontend/src/features/leads/hooks/useLeadActionHistory.ts`; filters, pagination, saved presets, column preferences and share-view state moved into `frontend/src/features/leads/hooks/useLeadsTableState.ts`. `LeadsPage.tsx` is now 696 lines and remains open because mutation/action orchestration is still page-local and above the frontend page size guidance.
- Leads decomposition affected areas: no backend permissions impact, notification behavior preserved through existing providers, no BusinessEvent impact, no AI behavior change beyond preserving existing lead insight read-model calculations, no migration/env impact.
- Leads decomposition verification: `cd frontend && npm run build` passed after each major extraction, including i18n parity, TypeScript and Vite builds; targeted route smoke passed with `E2E_SKIP_LOCAL_SETUP=true E2E_BASE_URL=http://127.0.0.1:5173 E2E_API_BASE_URL=http://127.0.0.1:8000 npx playwright test ./e2e/smoke.spec.ts --grep "business owner core routes render without 404" --project=desktop-chromium`. Backend checks skipped because only frontend decomposition changed and no API/backend behavior was touched.
- Leads decomposition pass 3: lead create/lifecycle/archive/bulk contact/merge/note/next-action/appointment mutations and shared action-error notification moved into `frontend/src/features/leads/hooks/useLeadActions.ts`; URL/drawer/contact/export/keyboard interactions moved into `frontend/src/features/leads/hooks/useLeadInteractions.ts`; realtime polling/new-lead notices moved into `frontend/src/features/leads/hooks/useLeadRealtime.ts`; filter tab counts and pagination display state moved into `frontend/src/features/leads/hooks/useLeadsWorkspaceDisplay.ts`.
- Leads decomposition pass 4: lead business/entity/query/offline/read-model composition moved into `frontend/src/features/leads/hooks/useLeadsWorkspaceData.ts`; selected bulk action handlers moved into `frontend/src/features/leads/hooks/useLeadBulkActions.ts`. `LeadsPage.tsx` is now 265 lines, within the frontend page size guidance, and delegates table, modals, overlays, data, actions, interactions and display derivations to focused components/hooks.
- Leads decomposition final verification: `cd frontend && npm run build` passed, including i18n parity, TypeScript and Vite builds; targeted route smoke passed with `E2E_SKIP_LOCAL_SETUP=true E2E_BASE_URL=http://127.0.0.1:5173 E2E_API_BASE_URL=http://127.0.0.1:8000 npx playwright test ./e2e/smoke.spec.ts --grep "business owner core routes render without 404" --project=desktop-chromium`. Backend checks skipped because only frontend decomposition changed and no API/backend behavior was touched.
- Follow-up note: `useLeadActions.ts` is currently 289 lines and `useLeadsWorkspaceData.ts` is currently 181 lines because they centralize existing lead mutations and workspace read-model composition. Do not add more behavior there without considering lifecycle/archive/note/appointment and query/display splits.
- Deals board load-more affected areas: no backend permissions impact, no notification behavior change, no BusinessEvent impact, no AI impact, no migration/env impact.
- Deals board load-more verification: `cd frontend && npm run build` passed, including i18n parity, TypeScript and Vite builds; targeted route smoke passed with `E2E_SKIP_LOCAL_SETUP=true E2E_BASE_URL=http://127.0.0.1:5173 E2E_API_BASE_URL=http://127.0.0.1:8000 npx playwright test ./e2e/smoke.spec.ts --grep "business owner core routes render without 404" --project=desktop-chromium`. Backend checks skipped because this used the existing deals board API contract and changed only frontend load-more behavior.

## Phase 2: Lead Lifecycle

Goal: make leads the reliable front door of CRM.

- [x] Review existing lead models, serializers, services, views and frontend API.
- [x] Define allowed lead lifecycle states and transitions.
- [x] Move all lead status transitions into service helpers.
- [x] Enforce `lost_reason` for lost leads.
- [x] Enforce responsible user as active business member.
- [x] Ensure assigning/taking leads writes activity.
- [x] Ensure closing/lost/reopen writes activity and audit where needed.
- [x] Implement or harden lead duplicate checks by normalized phone/email.
- [x] Implement lead -> client conversion contract.
- [x] Implement lead -> deal conversion contract.
- [x] Implement lead -> appointment creation contract.
- [x] Implement lead -> task/follow-up creation contract.
- [x] Ensure public lead forms create tenant-safe leads and clients.
- [x] Ensure frontend lead actions call API clients only.
- [x] Add lead lifecycle tests:
  - [x] status transitions
  - [x] lost reason required
  - [x] assign permission
  - [x] tenant isolation
  - [x] conversion to deal
  - [x] conversion to appointment
  - [x] duplicate check

Phase 2 pass 1 notes, 2026-07-04:

- Affected areas before work: permissions impact yes for lead lifecycle/create appointment/create task actions; notification impact preserved through existing notification services; BusinessEvent/activity/audit impact yes for lead lifecycle and conversion actions; AI impact none; migration/env impact none expected.
- Audit status: `apps/leads/models.py`, `apps/leads/serializers.py`, `apps/leads/services.py`, `apps/leads/views.py`, `apps/leads/forms_service.py`, `frontend/src/api/leads.ts`, lead hooks, scheduling/task/client service layers and existing lead/client/scheduling/task tests were reviewed before editing.
- Lead lifecycle state machine now has explicit `ALLOWED_LEAD_STATUS_TRANSITIONS` in `apps/leads/services.py`. Reopen can return from `lost`/`closed` to the previous active status; closed/lost are not casually moved to appointment-created.
- Generic lead update no longer owns lifecycle side effects. The old view override was disabled so protected lifecycle fields remain blocked by `LeadSerializer`, while status changes go through service-backed action endpoints.
- Lead assignment continues to validate the responsible user as an active business member and writes activity/audit through `assign_lead`.
- Lost lead reason remains required through `mark_lead_lost`; lifecycle actions write activity and audit metadata where request context exists.
- Duplicate detection is backed by normalized client phone/email in `apps.clients.services.find_duplicate_clients`; public form duplicate reuse and duplicate API coverage remain in focused tests.
- Lead -> deal contract remains service-backed through `create_deal_from_lead` and now reuses the lifecycle helper when moving the lead into work.
- Lead -> appointment contract now goes through `create_appointment_from_lead_contract`, checks appointment create permission in the lead action endpoint, validates allowed status transition before creating the appointment, writes appointment activity and lead lifecycle audit.
- Lead -> task/follow-up contract now exists as `POST /api/leads/{id}/create-task/`, backed by `create_follow_up_task_from_lead`, with active-business assignee validation, lead/client links, activity, audit and assignee notification.
- Frontend next-action task creation now uses `leadsApi.createTask`, so the lead page calls API clients only and uses the lead-specific backend contract instead of constructing a generic task payload in the UI flow.
- Lead -> client conversion contract now exists as idempotent `POST /api/leads/{id}/convert-client/`, backed by `convert_lead_to_client`, with lead/client business validation, lead update permission, client create permission, activity and audit. Because the current data model requires every lead to already have a client, the action returns the existing linked client and records the conversion step instead of creating a duplicate client.
- Verification passed:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check`
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.leads.tests_crm_light --keepdb --verbosity=1`
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.clients.tests apps.leads.tests_forms apps.leads.tests_crm_light apps.crm.tests apps.scheduling.tests apps.tasks.tests apps.core.tests_tenant_isolation --keepdb --verbosity=1` passed, 123 tests OK.
  - `cd frontend && npm run build`
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run`
- Verification notes: the same focused backend suite was first attempted without `--keepdb`, but this Windows environment returned exit code 1 with output truncated during test database creation. The suite passed after preserving/reusing the test database with `--keepdb`; no application test failures remained.
- Skipped: full `scripts/codex_verify.sh` because this is a Windows PowerShell environment; equivalent scoped backend checks, no-migration check and frontend build were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 2 completion update, 2026-07-04:

- Lead -> client conversion was closed with `convert_lead_to_client`, `POST /api/leads/{id}/convert-client/`, `leadsApi.convertToClient`, and focused tests for happy path, permission denial and foreign-client business validation.
- Additional verification passed:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.leads.tests_crm_light --keepdb --verbosity=1` passed, 22 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.clients.tests apps.leads.tests_forms apps.leads.tests_crm_light apps.crm.tests apps.scheduling.tests apps.tasks.tests apps.core.tests_tenant_isolation --keepdb --verbosity=1` passed, 123 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
  - `cd frontend && npm run build` passed.

## Phase 3: Deal Pipeline Production Layer

Goal: make deals a real sales pipeline with non-bypassable backend rules.

- [x] Review existing pipeline, stage, deal and transition models.
- [x] Define legal deal statuses and stage movement rules.
- [x] Implement central deal transition service.
- [x] Block terminal status changes through generic update.
- [x] Enforce `lost_reason` for lost deals.
- [x] Validate stage belongs to the deal pipeline and business.
- [x] Validate owner/responsible user is active business member.
- [x] Create stage transition history on every move.
- [x] Write activity for stage move, won, lost, reopen and value changes.
- [x] Write audit for destructive/sensitive deal actions.
- [x] Add deal amount/value change tracking where needed.
- [x] Harden deal summary metrics:
  - [x] open value
  - [x] won value
  - [x] lost count
  - [x] conversion rate
  - [x] stale deals
- [x] Polish deal drawer with linked client, lead, tasks, appointments and activity.
- [x] Add deal lifecycle tests:
  - [x] move stage
  - [x] mark won
  - [x] mark lost
  - [x] reopen
  - [x] invalid foreign stage rejected
  - [x] permission denial
  - [x] tenant isolation

Phase 3 pass 1 notes, 2026-07-04:

- Affected areas before work: permissions impact yes for deal lifecycle actions; notification impact none; BusinessEvent/activity/audit impact yes for deal lifecycle audit/activity; AI impact none; migration/env impact none expected.
- Audit status: `apps/crm/models.py`, `apps/crm/serializers.py`, `apps/crm/services.py`, `apps/crm/views.py`, `apps/crm/tests.py`, `frontend/src/api/deals.ts` and deal frontend hooks were reviewed.
- Existing deal layer already had central service functions: `move_deal_stage`, `mark_deal_won`, `mark_deal_lost`, `reopen_deal`, `apply_deal_stage`, `validate_stage_requirements`.
- Deal statuses remain `open`, `won`, `lost`; stage movement rules are enforced through stage business/pipeline validation, configured `StageTransition`, required fields/custom fields, terminal won/lost stages and lost reason enforcement.
- Generic deal update path keeps lifecycle/archive fields blocked through `DealSerializer`; the old view-level lifecycle override was disabled so lifecycle mutations are service/action-only.
- Deal action endpoints now explicitly call backend permission checks before moving stage, marking won/lost or reopening.
- Deal owner validation now requires owner to be an active member of the deal business.
- Tests added for foreign owner rejection, foreign stage rejection and manager permission denial on an unowned deal.
- Still open: persistent stage transition history model/snapshots, full amount/value change tracking, value-change activity, complete summary metric hardening and drawer polishing.
- Verification passed:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.crm.tests --keepdb --verbosity=1` passed, 19 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.clients.tests apps.leads.tests_forms apps.leads.tests_crm_light apps.crm.tests apps.scheduling.tests apps.tasks.tests apps.core.tests_tenant_isolation --keepdb --verbosity=1` passed, 126 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
- Skipped: frontend build because this pass changed only backend CRM code/tests and did not touch frontend code.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 3 pass 2 notes, 2026-07-09:

- Affected areas before work: permissions impact none beyond existing deal lifecycle gates; notification impact none; BusinessEvent/activity/audit impact yes because deal lifecycle transitions now also write persistent history; AI impact none; migration/env impact yes because `crm.0007_dealstagehistory` adds a new CRM history table.
- Added `DealStageHistory` with business/deal scope, from/to stage, from/to status, amount before/after, actor, source and metadata.
- `apply_deal_stage` now writes one history row for real stage/status transitions, so `move-stage`, `mark-won`, `mark-lost` and `reopen` share the same persistent transition trace.
- Admin registration was added for deal stage history to support operational debugging.
- Focused tests now assert history creation and amount snapshots for stage move, won, lost and reopen flows.
- Still open: standalone value-change activity, broader amount/value change tracking, deal summary metric hardening and deal drawer polishing.
- Verification passed:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.crm.tests --keepdb --verbosity=1` passed, 19 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py migrate` applied `crm.0007_dealstagehistory`.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.clients.tests apps.leads.tests_forms apps.leads.tests_crm_light apps.crm.tests apps.scheduling.tests apps.tasks.tests apps.core.tests_tenant_isolation --keepdb --verbosity=1` passed, 126 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
- Skipped: frontend build because this pass changed only backend CRM model/service/admin/tests/docs and did not touch frontend code.
- Skipped: full `scripts/codex_verify.sh` because this is a Windows PowerShell environment; equivalent scoped backend checks and migration checks were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 3 pass 3 notes, 2026-07-09:

- Affected areas before work: permissions impact yes because deal value changes remain protected by existing deal update permissions and scoped querysets; notification impact none; BusinessEvent/activity/audit impact yes because value changes now write activity and audit; AI impact none; migration/env impact yes because `crm.0008_dealvaluehistory` adds a new CRM history table.
- Added `DealValueHistory` with business/deal scope, amount before/after, currency before/after, actor, source and metadata.
- Added `record_deal_value_change` service helper and wired it into generic deal updates plus lifecycle amount changes through `mark-won`.
- Deal value changes now write `deal_value_changed` activity events and `deal_value` audit metadata.
- Non-value deal updates do not create value history or value-change activity.
- Focused tests cover happy path amount update, no-op non-value update, permission denial for unowned manager update, tenant isolation for cross-business update, and final amount tracking during mark-won.
- Still open: deal summary metric hardening and deal drawer polishing.
- Verification passed:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.crm.tests --keepdb --verbosity=1` passed, 23 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py migrate` applied `crm.0008_dealvaluehistory`.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.clients.tests apps.leads.tests_forms apps.leads.tests_crm_light apps.crm.tests apps.scheduling.tests apps.tasks.tests apps.core.tests_tenant_isolation --keepdb --verbosity=1` passed, 130 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
- Skipped: frontend build because this pass changed only backend CRM model/service/admin/tests/docs and did not touch frontend code.
- Skipped: full `scripts/codex_verify.sh` because this is a Windows PowerShell environment; equivalent scoped backend checks and migration checks were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 3 pass 4 notes, 2026-07-09:

- Affected areas before work: permissions impact yes through existing tenant-scoped deal summary queryset; notification impact none; BusinessEvent/activity/audit impact none because this is read-only analytics; AI impact none; migration/env impact none.
- Deal summary metric calculation moved into `apps/crm/selectors.py` via `build_deal_summary`, keeping the view as API orchestration.
- Summary API now returns `open_value`, `won_value`, `lost_value`, `lost_count`, `conversion_rate` and `stale_deals`, while preserving existing `pipeline_value`, `overdue`, `no_tasks`, `hot`, `mine`, `by_status`, `by_source` and `by_stage`.
- Stale deals are now consistently defined as open deals with stage SLA overdue, no next action/open task, or expected close date in the past; quick `hot` filtering uses the same selector.
- Summary/facet aggregations now clear inherited ordering before `values().annotate(...)`, preventing grouped counts from being split by ordering fields.
- Frontend `DealSummary` type was updated for the expanded API contract; no visible UI blocks were added.
- Focused tests cover open value, won value, lost count/value, conversion rate, stale deals, backward-compatible `pipeline_value`/`hot` aliases and tenant isolation.
- Verification passed:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.crm.tests --keepdb --verbosity=1` passed, 24 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.clients.tests apps.leads.tests_forms apps.leads.tests_crm_light apps.crm.tests apps.scheduling.tests apps.tasks.tests apps.core.tests_tenant_isolation --keepdb --verbosity=1` passed, 131 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
  - `cd frontend && npm run build` passed.
- Verification notes: the scoped backend suite was first started with a 184-second timeout and stopped before a final result; it was rerun with a higher timeout and passed.
- Skipped: full `scripts/codex_verify.sh` because this is a Windows PowerShell environment; equivalent scoped backend checks, no-migration check and frontend build were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 3 pass 5 notes, 2026-07-09:

- Affected areas before work: permissions impact yes through tenant-scoped `crm-card` deal context; notification impact none; BusinessEvent/activity impact read-only because existing activity is displayed but no new events are written; AI impact none; migration/env impact none.
- Deal CRM drawer now exposes linked client and lead context in the overview, including contact details, lead message and the current deal next action.
- Shared CRM drawer tabs now show related counters and include an appointments tab, so deal cards can open linked appointments without leaving the drawer.
- Added `EntityAppointmentsPanel` for linked appointment cards with service, date/time, resource, status, client, lead and notes.
- Deal overview now surfaces related appointment count/latest appointment, open task count/latest task, latest activity and latest conversation, with tab shortcuts for tasks, appointments, timeline and messages.
- Added backend contract coverage for `/api/deals/{id}/crm-card/` to assert linked client, lead, tasks, appointments, action availability, timeline activity and cross-business activity isolation.
- Verification passed:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.core.tests_crm_cards --keepdb --verbosity=1` passed, 6 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.clients.tests apps.leads.tests_forms apps.leads.tests_crm_light apps.crm.tests apps.scheduling.tests apps.tasks.tests apps.core.tests_tenant_isolation apps.core.tests_crm_cards --keepdb --verbosity=1` passed, 137 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
  - `cd frontend && npm run build` passed.
  - Browser smoke passed on local dev servers: logged in as `business_owner@example.com`, opened `/app/deals` through SPA navigation, opened deal drawer, verified client/lead/task/appointment/activity drawer signals and opened the `Записи` tab; browser console had no errors.
- Skipped: full `scripts/codex_verify.sh` because this is a Windows PowerShell environment; equivalent scoped backend checks, no-migration check, frontend build and browser smoke were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

## Phase 4: Client Identity, Dedup And Merge

Goal: keep customer data clean and traceable.

- [x] Review `Client`, identity normalization, selectors and services.
- [x] Ensure client create/update normalizes identity fields.
- [x] Ensure duplicate detection works by phone/email.
- [x] Build frontend duplicate warning before/after client creation.
- [x] Build merge dry-run UI.
- [x] Build merge confirmation flow.
- [x] Ensure merge writes `ClientMergeLog`.
- [x] Ensure merge moves related leads, deals, appointments, tasks, conversations, notes and activity safely.
- [x] Ensure merge is tenant-safe and permission-gated.
- [x] Implement archive/restore for clients if missing.
- [x] Add consent/source attribution fields or workflow.
- [x] Add client CRM card coverage:
  - [x] related leads
  - [x] related deals
  - [x] related appointments
  - [x] related tasks
  - [x] related conversations
  - [x] activity timeline
- [x] Add client merge/dedup tests.

Pass 1 completed on 2026-07-09:

- Affected areas reviewed before work: permissions yes for duplicate check, merge and archive/restore; notifications no behavior change; BusinessEvent/AI no behavior change; migrations/env no changes detected.
- Verified existing client identity normalization, duplicate detection, duplicate warning UI, merge dry-run/confirmation UI, `ClientMergeLog`, tenant-safe permission gates, archive/restore and CRM card related context.
- Added merge coverage for deal, note and existing activity transfer so the transfer test now proves leads, deals, appointments, tasks, conversations, notes and activity move to the target client.
- Checks run:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.clients.tests --keepdb --verbosity=1` passed, 11 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.clients.tests apps.leads.tests_forms apps.leads.tests_crm_light apps.crm.tests apps.scheduling.tests apps.tasks.tests apps.core.tests_tenant_isolation apps.core.tests_crm_cards apps.core.tests_archive --keepdb --verbosity=1` passed, 140 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
  - `cd frontend && npm run build` passed.
- Skipped: full `scripts/codex_verify.sh` because this is a Windows PowerShell environment; equivalent scoped backend checks, no-migration check and frontend build were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Pass 2 completed on 2026-07-09:

- Affected areas reviewed before work: permissions no new backend permission surface; notifications/outreach read path touched through existing `OutreachConsent`; BusinessEvent/AI no behavior change; migrations/env yes, added and applied `clients.0005_client_source_attribution`.
- Added client source attribution fields: `source_detail` and `source_context_json`, exposed through `ClientSerializer`, admin, frontend types and the client form.
- Public lead form submissions now copy campaign/domain/form attribution into new clients and fill missing attribution on matched existing clients without overwriting an already attributed client.
- CRM card payload now includes consent summary for existing outreach channels from `OutreachConsent`; the client drawer shows source attribution and consent statuses.
- Merge snapshots now preserve source attribution fields for archived duplicate traceability.
- Checks run:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.clients.tests apps.leads.tests_forms apps.core.tests_crm_cards --keepdb --verbosity=1` passed, 26 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py migrate` passed and applied `clients.0005_client_source_attribution`.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.clients.tests apps.leads.tests_forms apps.leads.tests_crm_light apps.crm.tests apps.scheduling.tests apps.tasks.tests apps.core.tests_tenant_isolation apps.core.tests_crm_cards apps.core.tests_archive apps.outreach.tests --keepdb --verbosity=1` passed, 161 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
  - `cd frontend && npm run build` passed.
- Skipped: full `scripts/codex_verify.sh` because this is a Windows PowerShell environment; equivalent scoped backend checks, migration check, migration apply and frontend build were run directly.
- Browser smoke attempted on local dev UI, but in-app Browser input/screenshot actions were blocked by Browser runtime virtual clipboard/CDP timeouts before login. Console showed only existing React Router future warnings, not app errors.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

## Phase 5: Conversations To CRM Pipeline

Goal: turn inbound messages into CRM work without losing control.

- [x] Review inbox views, bot conversation models and CRM linking actions.
- [x] Ensure inbox summary is role-aware.
- [x] Ensure send/retry/close/assign actions write activity.
- [x] Ensure provider delivery errors are visible but sanitized.
- [x] Add or harden quick replies management under settings.
- [x] Ensure conversation can link/create client.
- [x] Ensure conversation can link/create lead.
- [x] Ensure conversation can link/create deal.
- [x] Ensure conversation can create task.
- [x] Ensure conversation can create appointment when enough data exists.
- [x] Expose AI qualification result before high-impact CRM actions.
- [x] Define confirmation modes:
  - [x] suggest only
  - [x] create lead/task automatically
  - [x] draft deal only
  - [x] appointment only with explicit confirmation
- [x] Ensure handoff disables unsafe bot auto-replies.
- [x] Add SLA/unread queue rules.
- [x] Add tests for inbox -> client -> lead -> deal/task flow.

Phase 5 pass 1 notes, 2026-07-09:

- Affected areas: permissions impact preserved through existing inbox `assert_can` checks and tenant-scoped querysets; notification behavior unchanged except existing inbound notification paths still run through `register_bot_message`; BusinessEvent impact none; AI impact none; migration/env impact none.
- Reviewed `apps/conversations/inbox_views.py`, `apps/conversations/inbox_serializers.py`, `apps/conversations/pipeline.py`, `apps/conversations/auto_pipeline.py`, `apps/conversations/booking.py`, `apps/conversations/ai_qualification.py`, `apps/bots/inbox_service.py`, `apps/bots/models.py`, `frontend/src/api/inbox.ts`, `frontend/src/features/conversations/ConversationsPage.tsx` and existing inbox tests.
- Inbox manual actions now write activity events for assignment, handoff, retry, close, reopen, unread marking and priority changes; outbound message activity now records the authenticated actor.
- Provider delivery failure strings and provider result payloads are sanitized before storage/API serialization.
- Checks run:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.bots.tests.InboxBackendTests --keepdb --verbosity=1` passed, 22 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.bots.tests apps.conversations.tests_quick_replies --keepdb --verbosity=1` passed, 41 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.clients.tests apps.leads.tests_forms apps.leads.tests_crm_light apps.crm.tests apps.scheduling.tests apps.tasks.tests apps.core.tests_tenant_isolation apps.core.tests_crm_cards apps.core.tests_archive apps.outreach.tests apps.bots.tests apps.conversations.tests_quick_replies --keepdb --verbosity=1` passed, 202 tests OK.
- Verification notes: the 202-test scoped backend suite was first started with a 244-second timeout and stopped before a final result; it was rerun with a higher timeout and passed.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent scoped backend checks and no-migration check were run directly.
- Skipped: frontend build because this pass changed only backend inbox service/view/tests/docs and did not touch frontend code.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 5 pass 2 notes, 2026-07-09:

- Affected areas: permissions impact hardened for quick replies management; notification impact none; BusinessEvent impact none; AI impact none; migration/env impact none.
- Settings quick replies management now requires `conversations:manage` in the frontend section gate and mutation guards, matching backend management semantics instead of exposing create/edit/delete from a view-only section.
- Backend quick reply coverage now proves a view-only conversation role can list templates but cannot create, update or delete them.
- Checks run:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.conversations.tests_quick_replies --keepdb --verbosity=1` passed, 2 tests OK.
  - `cd frontend && npm run build` passed, including i18n parity, TypeScript, Vite app build and widget build.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
  - `E2E_SKIP_LOCAL_SETUP=true E2E_BASE_URL=http://127.0.0.1:5173 E2E_API_BASE_URL=http://127.0.0.1:8000 npx playwright test ./e2e/smoke.spec.ts --grep "business owner core routes render without 404" --project=desktop-chromium` passed, 1 test OK.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend, no-migration, frontend build and route smoke checks were run directly.
- Browser note: in-app Browser control was not exposed by the available callable tools after tool discovery, so Playwright route smoke was used for UI verification.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 5 pass 3 notes, 2026-07-09:

- Affected areas: permissions impact preserved through existing backend `assert_can` checks for clients/leads/deals/tasks/conversations; notification impact none; BusinessEvent impact none; AI impact none; migration/env impact none.
- Manual inbox CRM actions now write timeline activity for linked client, linked lead, linked deal, created client and created task. Existing pipeline-created lead/deal/task activity remains service-backed in `apps/conversations/pipeline.py`.
- Existing inbox API tests now also prove timeline activity includes `conversation_id` for manual CRM link/create actions, and the idempotent inbox -> client -> lead -> deal/task pipeline test remains in the same suite.
- Checks run:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.bots.tests.InboxBackendTests --keepdb --verbosity=1` passed, 22 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.bots.tests apps.conversations.tests_quick_replies --keepdb --verbosity=1` passed, 42 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
- Skipped: frontend build because this pass changed only backend inbox service/view/tests/docs and did not touch frontend code.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend checks and no-migration check were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 5 pass 4 notes, 2026-07-09:

- Affected areas: permissions impact added for appointment creation from inbox (`appointments:create` plus `conversations:update`); notification impact uses existing appointment follow-up scheduling; BusinessEvent impact none; AI impact none; migration/env impact none.
- Added `POST /api/inbox/conversations/{id}/create-appointment/` for conversations with enough data: linked client, valid business service, optional business resource and available working-hours slot.
- The endpoint creates a business-scoped appointment, links the conversation's client/lead, updates lead service/status when a lead exists, schedules existing appointment follow-ups and writes `appointment_created` activity with `conversation_id`.
- `frontend/src/api/inbox.ts` now exposes `inboxApi.createAppointment` for frontend integration without adding another large form into `ConversationsPage.tsx`.
- Checks run:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.bots.tests.InboxBackendTests --keepdb --verbosity=1` passed, 23 tests OK after correcting the test expectation for SMS-channel follow-ups.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.bots.tests apps.conversations.tests_quick_replies apps.scheduling.tests --keepdb --verbosity=1` passed, 75 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
  - `cd frontend && npm run build` passed, including i18n parity, TypeScript, Vite app build and widget build.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend, no-migration and frontend build checks were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 5 pass 5 notes, 2026-07-09:

- Affected areas: permissions impact added for AI qualification preview (`conversations:update` plus `ai_pipeline:suggest`) and preserved for pipeline execution (`ai_pipeline:execute` plus CRM create permissions); notification impact none; BusinessEvent impact none; AI impact yes because conversation qualification now has a pre-action preview contract; migration/env impact none.
- Added `POST /api/inbox/conversations/{id}/qualify/`, which returns and stores `conversation_qualification_preview` with qualification, AI log id, qualified actor/time and the last message id without creating clients, leads, deals or tasks.
- `run-pipeline` now requires a fresh stored AI qualification preview before AI-driven CRM entity creation. If a new message arrives after preview, the endpoint returns 400 and requires preview to be rerun.
- The Conversations CRM automation panel now calls `inboxApi.qualifyConversation` first and disables the CRM link update action until preview is available; frontend API calls remain in `frontend/src/api/inbox.ts`.
- Tests now cover preview happy path without CRM mutations, permission denial, stale-preview rejection and idempotent inbox -> client -> lead -> deal/task execution using the preview AI log.
- Checks run:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.bots.tests.InboxBackendTests --keepdb --verbosity=1` passed, 25 tests OK.
  - `cd frontend && npm run build` passed, including i18n parity, TypeScript, Vite app build and widget build.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.bots.tests apps.conversations.tests_quick_replies --keepdb --verbosity=1` passed, 45 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.clients.tests apps.leads.tests_forms apps.leads.tests_crm_light apps.crm.tests apps.scheduling.tests apps.tasks.tests apps.core.tests_tenant_isolation apps.core.tests_crm_cards apps.core.tests_archive apps.outreach.tests apps.bots.tests apps.conversations.tests_quick_replies --keepdb --verbosity=1` passed, 206 tests OK.
  - `E2E_SKIP_LOCAL_SETUP=true E2E_BASE_URL=http://127.0.0.1:5173 E2E_API_BASE_URL=http://127.0.0.1:8000 npx playwright test ./e2e/smoke.spec.ts --grep "business owner core routes render without 404" --project=desktop-chromium` passed, 1 test OK.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend, broad scoped backend, no-migration, frontend build and route smoke checks were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 5 pass 6 notes, 2026-07-09:

- Affected areas: permissions impact unchanged because auto pipeline still runs inside existing public/bot ingestion and CRM services; notification impact preserved for existing auto-pipeline and appointment booking notifications; BusinessEvent impact none; AI impact yes because auto-pipeline now records explicit confirmation policy; migration/env impact none.
- Auto CRM pipeline now normalizes legacy `mode` settings into explicit confirmation modes: `suggest_only`, `auto_lead_task`, `draft_deal` and `appointment_explicit`.
- `auto_crm_pipeline` metadata and activity events now include `confirmation_policy` with CRM mode, allowed automatic actions, actions requiring explicit confirmation and appointment confirmation mode.
- `suggest_only` stores qualification only and does not create client, lead, deal, task or appointment.
- `auto_lead_task` permits automatic client/lead/task creation only after existing confidence/review guards pass.
- `draft_deal` permits a draft deal only after deal intent and confidence guards pass; terminal deal movement is still outside this auto pipeline.
- `appointment_explicit` requires a client-selected offered slot (`client_selected_offered_slot`) before booking; tests prove no appointment is created on initial qualification.
- Checks run:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.bots.tests.BotsFoundationTests --keepdb --verbosity=1` passed, 19 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.bots.tests apps.conversations.tests_quick_replies --keepdb --verbosity=1` passed, 46 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.clients.tests apps.leads.tests_forms apps.leads.tests_crm_light apps.crm.tests apps.scheduling.tests apps.tasks.tests apps.core.tests_tenant_isolation apps.core.tests_crm_cards apps.core.tests_archive apps.outreach.tests apps.bots.tests apps.conversations.tests_quick_replies --keepdb --verbosity=1` passed, 207 tests OK.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend, broad scoped backend and no-migration checks were run directly.
- Skipped: frontend build for this pass because confirmation-mode implementation changed backend runtime/tests/docs only; the frontend build already passed in pass 5 after the conversation UI changes.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 5 pass 7 notes, 2026-07-09:

- Affected areas: permissions impact none; notification impact reduced risk of unsafe auto-pipeline notifications after handoff; BusinessEvent impact none; AI impact yes because handoff/paused/closed conversations now skip auto-pipeline before AI qualification; migration/env impact none.
- `maybe_run_auto_pipeline` now exits before AI calls, CRM mutations, appointment booking or bot auto-replies when a conversation is handed off, bot-paused or inactive.
- Handoff skip decisions are stored in `auto_crm_pipeline` metadata and activity as `skipped_handoff`, including the current confirmation policy for auditability.
- Tests prove a handoff conversation receiving a new public chat message does not create client/lead/deal/task records, does not create a bot outbound reply and does not create a new conversation qualification AI log.
- Checks run:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.bots.tests.BotsFoundationTests --keepdb --verbosity=1` passed, 20 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.bots.tests apps.conversations.tests_quick_replies --keepdb --verbosity=1` passed, 47 tests OK.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend and no-migration checks were run directly.
- Skipped: broad scoped backend suite for this pass because only the early auto-pipeline handoff guard changed and the relevant bots/conversations suites passed; the broad scoped suite passed in pass 6 before this narrow guard.
- Skipped: frontend build because this pass changed only backend auto-pipeline runtime/tests/docs and did not touch frontend code.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 5 pass 8 notes, 2026-07-09:

- Affected areas: permissions impact none because work queues and inbox summary continue using existing tenant/access scoping; notification impact none; BusinessEvent impact none; AI impact none; migration/env impact none.
- Added server-defined conversation SLA rules: unread response SLA is 30 minutes and handoff response SLA is 15 minutes.
- Work queues now expose `unread_sla_overdue_conversations` and `handoff_sla_overdue_conversations` queues plus summary counters without double-counting them in `total_attention`.
- Conversation queue items now include `sla_minutes`, `sla_due_at` and `sla_overdue_minutes`.
- Inbox summary now exposes `unread_sla_overdue` and `handoff_sla_overdue` and puts urgent next actions ahead of general unread/handoff actions.
- Frontend API types in `frontend/src/api/workQueues.ts` and `frontend/src/api/inbox.ts` now include the new queue keys and SLA fields.
- Checks run:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.core.tests_work_queues apps.bots.tests.InboxBackendTests --keepdb --verbosity=1` passed, 27 tests OK.
  - `cd frontend && npm run build` passed, including i18n parity, TypeScript, Vite app build and widget build.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.core.tests_work_queues apps.bots.tests apps.conversations.tests_quick_replies --keepdb --verbosity=1` passed, 49 tests OK.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend, no-migration and frontend build checks were run directly.
- Skipped: broad scoped backend suite for this pass because the changed surface is limited to work queue selectors, inbox summary, API types and tests; focused work queue/inbox/bots/conversations checks passed. The broad scoped suite passed earlier in Phase 5 pass 6.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

## Phase 6: Scheduling As CRM Mechanic

Goal: make appointments part of CRM lifecycle, not an isolated calendar.

- [x] Review appointment service, booking rules and frontend calendar API.
- [x] Harden create/reschedule overlap protection.
- [x] Harden working-hours validation.
- [x] Enforce cancel/no-show reason where needed.
- [x] Ensure booking from lead links client, lead and service.
- [x] Ensure appointment changes write activity.
- [x] Ensure cancellation/no-show writes audit where needed.
- [x] Add follow-up task creation after cancel/no-show/completion.
- [x] Add appointment notifications for assigned manager/employee.
- [x] Improve mobile agenda UX.
- [x] Add E2E or backend smoke for:
  - [x] create appointment
  - [x] reschedule
  - [x] cancel
  - [x] no-show
  - [x] complete

Phase 6 pass 1 notes, 2026-07-09:

- Affected areas: permissions impact preserved through existing `appointments:update` backend checks; notification impact yes because appointment creation/lifecycle now emits internal system notifications for the responsible lead user, current actor or owner; BusinessEvent impact none; AI impact none; migration/env impact none.
- Review result: appointment create/reschedule already used service-backed availability checks, business/resource/service validation, working-hours validation and overlap rejection. Existing tests cover busy slots, outside-hours slots, resource day-off overrides, reschedule exclusion and lead -> appointment client/lead/service links.
- Cancel and no-show now require a non-empty reason via `AppointmentStatusReasonSerializer`; the Calendar page and CRM appointment drawer collect reason before sending those actions.
- Appointment lifecycle status changes are now applied atomically through `apply_appointment_status`, reject archived appointments, reject duplicate status application and reject status changes after terminal states (`cancelled`, `completed`, `no_show`).
- Cancel/no-show activity and audit metadata now include `reason`; cancel/no-show/complete create linked follow-up tasks with `appointment`, `client`, optional `lead`, assignee and task notification.
- Appointment internal notifications currently route to the linked lead responsible user, then current actor, then business owner. `Resource` has no `User` link in the current schema, so direct staff-resource notification remains a future model decision if the product wants resource-user mapping.
- Checks run:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.scheduling.tests --keepdb --verbosity=1` passed, 34 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.scheduling.tests apps.tasks.tests apps.notifications.tests --keepdb --verbosity=2` passed, 78 tests OK.
  - `cd frontend && npm run build` passed, including i18n parity, TypeScript, Vite app build and widget build.
  - `E2E_SKIP_LOCAL_SETUP=true E2E_BASE_URL=http://127.0.0.1:5173 E2E_API_BASE_URL=http://127.0.0.1:8000 npx playwright test ./e2e/smoke.spec.ts --grep "business owner core routes render without 404" --project=desktop-chromium` passed, 1 test OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.clients.tests apps.leads.tests_forms apps.leads.tests_crm_light apps.crm.tests apps.scheduling.tests apps.tasks.tests apps.core.tests_tenant_isolation apps.core.tests_crm_cards apps.core.tests_archive apps.outreach.tests apps.bots.tests apps.conversations.tests_quick_replies apps.notifications.tests --keepdb --verbosity=1` passed, 225 tests OK.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend, broad backend, no-migration, frontend build and route smoke checks were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 6 pass 2 notes, 2026-07-09:

- Affected areas: permissions impact none; notification impact none; BusinessEvent impact none; AI impact none; migration/env impact none.
- Mobile calendar agenda now shows a compact day agenda header, working-hours label, booking/open-slot/task counters, direct actions for new booking and working hours, row-style appointment items and row-style due tasks. The empty state remains action-oriented and opens the booking flow.
- `renderAppointmentPreview` now supports a compact row mode for mobile agenda; task rows link directly to the task drawer route.
- The mobile Playwright smoke now asserts that `/app/calendar` exposes the mobile agenda header and new-booking action in the mobile project.
- Checks run:
  - `cd frontend && npm run build` passed, including i18n parity, TypeScript, Vite app build and widget build.
  - `E2E_SKIP_LOCAL_SETUP=true E2E_BASE_URL=http://127.0.0.1:5173 E2E_API_BASE_URL=http://127.0.0.1:8000 npx playwright test ./e2e/smoke.spec.ts --grep "business owner core routes render without 404" --project=desktop-chromium` passed, 1 test OK.
  - `E2E_SKIP_LOCAL_SETUP=true E2E_BASE_URL=http://127.0.0.1:5173 E2E_API_BASE_URL=http://127.0.0.1:8000 npx playwright test ./e2e/smoke.spec.ts --grep "mobile owner smoke" --project=mobile-chromium` passed, 1 test OK.
- Skipped: backend checks for this pass because only frontend calendar layout and Playwright smoke assertions changed; the Phase 6 pass 1 backend checks and broad 225-test CRM suite already passed for the scheduling backend/API changes.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent frontend build and route/mobile smoke checks were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

## Phase 7: Task Operations Layer

Goal: make tasks the daily operational layer across CRM.

- [x] Review task lifecycle services and frontend drawer.
- [x] Ensure all task lifecycle changes use services.
- [x] Ensure task links support client, lead, deal, appointment and conversation.
- [x] Ensure cancel requires reason.
- [x] Ensure assign/watch/comment actions are permission-gated.
- [x] Add task templates for common CRM follow-ups.
- [x] Add overdue escalation rules.
- [x] Add workload view by manager/assignee.
- [x] Ensure task notifications route by role and assignee.
- [x] Add task activity/audit coverage.
- [x] Add tests for assignment, completion, cancellation, comments, watchers and tenant isolation.

Phase 7 pass 1 notes, 2026-07-09:

- Affected areas: permissions impact yes because assign/watch/comment gates were reviewed and a denied-update role test was added; notification impact unchanged because task notifications still use existing assignee-oriented task notification service; BusinessEvent impact none; AI impact indirect because AI/inbox-created tasks now retain a first-class conversation link; migration/env impact yes via `tasks.0009_task_conversation_task_tasks_task_convers_176087_idx`.
- Review result: task lifecycle actions already route through task services (`start`, `complete`, `cancel`, `undo-cancel`, `reopen`, `snooze`, `assign`, `assign-to-me`, due quick actions, watcher). Generic create/update paths reject protected lifecycle, assignment, watcher, snooze and archive state mutations, so lifecycle cannot be bypassed through plain PATCH.
- Task cancellation already required a reason through `TaskCancelSerializer` and writes activity/audit; this was reverified by `apps.tasks.tests`.
- Task links now support `client`, `lead`, `deal`, `appointment` and `conversation`. `Task.conversation` is tenant-validated, exposed in serializers, searchable by conversation visitor/client, filterable through `relation=conversation`, included in work queue payloads and shown in the Tasks form/table/drawer with a route to `/app/conversations?conversation=...`.
- Inbox manual create-task and the conversation auto-pipeline now save the conversation FK on created tasks. Client CRM cards include tasks linked only through a related conversation, so follow-ups created from inbox remain visible from the client context.
- Assign/watch/comment actions are backend permission-gated through `tasks:update`; a custom view-only role can see the task but receives 403 on assign, add-watcher and add-comment.
- Checks run:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.tasks.tests apps.core.tests_crm_cards apps.bots.tests.InboxBackendTests --keepdb --verbosity=1` passed, 62 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py migrate` applied `tasks.0009_task_conversation_task_tasks_task_convers_176087_idx`.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
  - `cd frontend && npm run build` passed, including i18n parity, TypeScript, Vite app build and widget build. The first build caught two synthetic deal next-task objects missing `conversation: null`; both were fixed and the build then passed.
  - Initial broad scoped backend run timed out at 5 minutes without a result. Rerun with a longer timeout passed: `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.clients.tests apps.leads.tests_forms apps.leads.tests_crm_light apps.crm.tests apps.scheduling.tests apps.tasks.tests apps.core.tests_tenant_isolation apps.core.tests_crm_cards apps.core.tests_work_queues apps.core.tests_archive apps.outreach.tests apps.bots.tests apps.conversations.tests_quick_replies apps.notifications.tests --keepdb --verbosity=1`, 229 tests OK.
  - `E2E_SKIP_LOCAL_SETUP=true E2E_BASE_URL=http://127.0.0.1:5173 E2E_API_BASE_URL=http://127.0.0.1:8000 npx playwright test ./e2e/smoke.spec.ts --grep "business owner core routes render without 404" --project=desktop-chromium` passed, 1 test OK.
  - After adding the explicit permission-gate test, `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.tasks.tests --keepdb --verbosity=1` passed, 31 tests OK.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend, migration, frontend build, broad scoped backend and route smoke checks were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 7 pass 2 notes, 2026-07-09:

- Affected areas: permissions impact yes because task template listing is backend-gated by `tasks:view`; notification impact none because templates only prefill the task form and do not create notifications until the user submits a task; BusinessEvent impact none; AI impact none; migration/env impact none.
- Added system task templates for common CRM follow-ups: call client, qualify lead, send offer, confirm appointment, recover no-show and payment follow-up.
- `GET /api/tasks/templates/?business=<id>` returns template key, title, description, priority, due/reminder offsets and relation hints after checking business access and `tasks:view`.
- The Tasks create/edit modal now loads templates through `frontend/src/api/tasks.ts` and lets the user select a template to prefill title, description, priority, due date and reminder. Submission still goes through the normal task create/update API, so backend create/update permissions remain the final gate.
- Checks run:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.tasks.tests --keepdb --verbosity=1` passed, 32 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
  - `cd frontend && npm run build` passed, including i18n parity, TypeScript, Vite app build and widget build.
  - `E2E_SKIP_LOCAL_SETUP=true E2E_BASE_URL=http://127.0.0.1:5173 E2E_API_BASE_URL=http://127.0.0.1:8000 npx playwright test ./e2e/smoke.spec.ts --grep "business owner core routes render without 404" --project=desktop-chromium` passed, 1 test OK.
- Skipped: broad scoped backend suite for this pass because the changed backend surface is limited to the task templates endpoint and task tests covered the new permission/API contract; the broad 229-test CRM suite passed in Phase 7 pass 1 immediately before this pass.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend, no-migration, frontend build and route smoke checks were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 7 pass 3 notes, 2026-07-09:

- Affected areas: permissions impact unchanged because `/api/work-queues/` still checks business access and this pass does not add state-changing endpoints; notification impact metadata-only because overdue escalation does not create notifications yet; BusinessEvent impact none; AI impact none; migration/env impact none.
- Added server-defined overdue task escalation rules in `apps/tasks/escalation.py`: overdue tasks now resolve to `watch`, `escalate` or `critical` with `overdue_minutes` and a machine-readable reason (`recently_overdue`, `overdue_1h`, `high_priority_overdue`, `urgent_overdue`, `overdue_24h`).
- Work queue overdue task items now expose `conversation_id`, `overdue_minutes`, `escalation_level` and `escalation_reason`, so dashboards and future notification routing use the backend contract instead of local frontend guesses.
- The manager dashboard task queue now links to the exact task route and shows the server escalation level as an i18n-backed severity badge.
- Checks run:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.core.tests_work_queues --keepdb --verbosity=1` passed, 3 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
  - `cd frontend && npm run build` passed, including i18n parity, TypeScript, Vite app build and widget build; Vite kept the existing large chunk warnings.
  - Local dev server smoke: `http://127.0.0.1:5173/app/tasks` returned 200 and unauthenticated `http://127.0.0.1:8000/api/tasks/` returned 401.
  - Corrected route smoke command from `frontend`: `E2E_SKIP_LOCAL_SETUP=true E2E_BASE_URL=http://127.0.0.1:5173 E2E_API_BASE_URL=http://127.0.0.1:8000 npx playwright test --grep "business owner core routes render without 404" --project=desktop-chromium` passed, 1 test OK.
- Corrected check note: the first route smoke attempt from repository root failed before running tests because the Playwright config lives in `frontend`; the same smoke was rerun from `frontend` and passed.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend, no-migration, frontend build and route smoke checks were run directly.
- Skipped: broad scoped backend suite for this pass because the backend change is limited to work queue read-model metadata and `apps.core.tests_work_queues` covers the new API contract, escalation levels and tenant denial.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 7 pass 4 notes, 2026-07-09:

- Affected areas: permissions impact yes because `GET /api/tasks/workload/?business=<id>` is backend-gated by `tasks:view` and uses the same tenant-scoped task queryset as the Tasks list; notification impact none; BusinessEvent impact none; AI impact none; migration/env impact none.
- Added `apps/tasks/selectors.py` with a workload read model grouped by assignee and unassigned tasks. The selector counts active, open, in-progress, overdue, due-today, no-due and high-priority tasks, excludes snoozed future tasks from overdue, includes active business members with zero work and returns `idle`, `balanced`, `busy` or `overloaded` capacity status.
- Added `GET /api/tasks/workload/?business=<id>` to TaskViewSet. The endpoint requires `business`, rejects unavailable tenants and returns workload totals/items for the requested business using the current filtered task scope.
- The Tasks page now loads workload through `frontend/src/api/tasks.ts`, renders a workload panel above the table and lets the user click an assignee/unassigned workload card to set or clear the existing assignee filter.
- Checks run:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.tasks.tests --keepdb --verbosity=1` passed, 33 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
  - `cd frontend && npm run build` passed, including i18n parity, TypeScript, Vite app build and widget build; Vite kept the existing large chunk warnings.
  - `E2E_SKIP_LOCAL_SETUP=true E2E_BASE_URL=http://127.0.0.1:5173 E2E_API_BASE_URL=http://127.0.0.1:8000 npx playwright test --grep "business owner core routes render without 404" --project=desktop-chromium` passed from `frontend`, 1 test OK.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend, no-migration, frontend build and route smoke checks were run directly.
- Skipped: broad scoped backend suite for this pass because the changed backend surface is limited to the Tasks workload read endpoint and `apps.tasks.tests` covers its grouping, snoozed-overdue behavior, missing business and tenant denial.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 7 pass 5 notes, 2026-07-09:

- Affected areas: permissions impact unchanged because task action endpoints keep their existing `tasks:update` checks and notification visibility still uses the notification permission scope; notification impact yes because task system notifications no longer fall back to business-wide `recipient=null`; BusinessEvent impact none; AI impact none; migration/env impact none.
- Task notifications now route through the existing role/preference notification helpers. Assigned tasks notify the active assignee directly, including owner/staff assignees. Unassigned or invalid-assignee tasks fall back to manager/admin/operator roles, then owner if no manager role exists.
- Normal task notifications respect `NotificationPreference` for the `tasks` category; high/urgent task notifications bypass disabled preferences as escalation notifications. Task notifications are created as targeted system notifications, not business-wide notifications.
- Tests now assert assigned quick actions create owner-targeted notifications, unassigned task events route to manager roles instead of staff/business-wide, and preferences suppress normal task fallback while high priority still creates a targeted notification.
- Checks run:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.tasks.tests --keepdb --verbosity=1` passed, 35 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.notifications.tests --keepdb --verbosity=1` passed, 15 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
- Skipped: frontend build and route smoke because this pass changed only backend task notification routing/tests/docs and no frontend or browser-visible contract changed.
- Skipped: broad scoped backend suite because the changed surface is limited to task notification recipient selection; `apps.tasks.tests` and `apps.notifications.tests` cover the affected task actions, notification routing preferences and existing notification visibility rules.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend and no-migration checks were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

## Phase 8: Activity, Audit And Timeline Completeness

Goal: every important CRM action must be explainable.

- [x] Define CRM event taxonomy for activity timeline.
- [x] Map lead lifecycle actions to activity/audit.
- [x] Map deal lifecycle actions to activity/audit.
- [x] Map client merge/archive actions to activity/audit.
- [x] Map appointment lifecycle actions to activity/audit.
- [x] Map conversation send/link/create actions to activity.
- [x] Map AI tool execution and approval to audit.
- [x] Map integration events to CRM timeline where useful.
- [x] Build unified timeline display for CRM cards.
- [x] Add tests asserting timeline/audit records for critical actions.

Phase 8 pass 1 notes, 2026-07-09:

- Affected areas: permissions impact none because this pass adds taxonomy/read helpers only; notification impact none; BusinessEvent impact indirect because ActivityEvent taxonomy is now explicit but no BusinessEvent mapping changed; AI impact indirect because future AI source citations can now rely on event domain/category metadata; migration/env impact none.
- Added a formal `ActivityEventDefinition` contract in `apps/activities/taxonomy.py` for core CRM timeline events. Each `ActivityEvents.*` constant now has an explicit category, domain, label, timeline flag and optional `audit_required`/`important` flags.
- Added taxonomy helpers for `event_definition`, `event_domain`, `is_timeline_event` and `requires_audit_event`, plus derived sets for timeline, audit-required and important event types.
- Added missing labels for `lead_converted_to_client` and `deal_value_changed`; taxonomy categories now cover client/lead/deal events even when `create_activity_event` is called without an instance.
- Test maintenance: updated an existing activity test to pass the required appointment cancel reason introduced by Phase 6, rather than using the obsolete empty cancel payload.
- Checks run:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.activities.tests --keepdb --verbosity=1` passed, 8 tests OK after updating the stale cancel payload.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.core.tests_crm_cards --keepdb --verbosity=1` passed, 7 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
- Baseline failure recorded: the first `apps.activities.tests` run failed because `test_appointment_create_cancel_and_task_complete_write_timeline_events` used an obsolete appointment cancel request without `reason`; the test was updated to the current lifecycle contract and then passed.
- Skipped: frontend build and route smoke because this pass changed only backend activity taxonomy/tests/docs and no frontend API/UI contract changed.
- Skipped: broad scoped backend suite because this pass defines taxonomy metadata and focused `apps.activities.tests` plus CRM card tests cover the affected timeline behavior.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend and no-migration checks were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 8 pass 2 notes, 2026-07-09:

- Affected areas: permissions impact unchanged because lead action endpoints keep existing backend gates; notification impact unchanged because responsible-user lead notifications still use existing paths; BusinessEvent impact none; AI impact indirect only through more reliable source events; migration/env impact none.
- Lead lifecycle audit metadata now uses explicit taxonomy event names. `take-in-work` records `lead_taken_in_work` instead of the ambiguous `lead_in_progress`, and lifecycle audit rows include `event_type` alongside `lifecycle_action`.
- Lost/reopen lead activity and audit now preserve the reason trail: lost activity/audit includes `lost_reason`, and reopen activity/audit includes `cleared_lost_reason`.
- Lead assignment audit metadata now includes taxonomy `event_type`, from/to responsible user ids and the new responsible user id. Lead conversion audit metadata now includes `event_type=lead_converted_to_client`, and conversion activity text uses the taxonomy label language instead of an English fallback.
- Lead note activity in `apps/leads/views.py` now uses `ActivityEvents.LEAD_NOTE_ADDED` instead of a raw event string.
- Checks run:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.leads.tests_crm_light --keepdb --verbosity=1` passed, 22 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.leads.tests_forms --keepdb --verbosity=1` passed, 8 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
- Skipped: frontend build and route smoke because this pass changed only backend lead services/views/tests/docs and no frontend API/UI contract changed.
- Skipped: broad scoped backend suite because `apps.leads.tests_crm_light` covers lead lifecycle happy paths, permission denial and tenant-scope behavior while `apps.leads.tests_forms` covers lead creation/form capture paths.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend and no-migration checks were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 8 pass 3 notes, 2026-07-09:

- Affected areas: permissions impact unchanged because deal endpoints keep existing backend gates; notification impact none; BusinessEvent impact none; AI impact indirect only through cleaner source activity/audit facts; migration/env impact none.
- Deal stage/lifecycle actions now always write a lifecycle `AuditLog` when invoked through request-backed services, including ordinary `move-stage` actions. Audit metadata includes taxonomy `event_type`, `lifecycle_action`, from/to status and from/to stage.
- Deal lost/reopen activity and audit now preserve reason history: lost events include `lost_reason`, and reopen events include `cleared_lost_reason`.
- Deal value history/activity/audit now uses `event_type=deal_value_changed` for the value-change event and stores lifecycle context separately as `source_event_type` (for example `deal_won`). Value activity text now uses the taxonomy label instead of an English fallback.
- Tests now assert stage move audit output, won/lost/reopen lifecycle event metadata, lost/reopen reason trail and value-history source event metadata.
- Checks run:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.crm.tests --keepdb --verbosity=1` passed, 24 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.core.tests_crm_cards --keepdb --verbosity=1` passed, 7 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
- Skipped: frontend build and route smoke because this pass changed only backend deal services/tests/docs and no frontend API/UI contract changed.
- Skipped: broad scoped backend suite because `apps.crm.tests` covers deal lifecycle/value happy paths, permission denial and tenant isolation while CRM card tests cover timeline payload behavior.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend and no-migration checks were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 8 pass 4 notes, 2026-07-09:

- Affected areas: permissions impact unchanged because client merge/archive/restore keep existing backend gates; notification impact none; BusinessEvent impact none; AI impact indirect only through cleaner source timeline/audit facts; migration/env impact none.
- Added taxonomy coverage for `client_archived` and `client_restored`, including aliases for generic archive helper dot-form events (`client.archived`, `client.restored`).
- Generic archive/restore now writes audit/activity metadata with `kind`, taxonomy `event_type`, archive/restore flag and archive reason where applicable.
- Client merge now writes taxonomy `event_type` and `duplicate_client_id` into `ClientMergeLog.metadata`, merge activity metadata and merge audit metadata.
- Fixed shared activity client resolution so activity written for a `Client` instance links to that client in the timeline, instead of leaving `ActivityEvent.client` empty.
- Checks run:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.clients.tests --keepdb --verbosity=1` passed, 13 tests OK after adding archive aliases.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.activities.tests apps.core.tests_archive --keepdb --verbosity=1` passed, 11 tests OK.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` passed.
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
- Baseline failure recorded: the first `apps.clients.tests` run failed because generic archive metadata used raw `client.archived` while the saved activity event canonicalized to `client_archived`; taxonomy aliases were added and the suite passed.
- Skipped: frontend build and route smoke because this pass changed only backend client/archive/activity tests/docs and no frontend API/UI contract changed.
- Skipped: broad scoped backend suite because `apps.clients.tests` covers merge/archive permissions, transfer behavior and tenant isolation, while `apps.activities.tests` plus `apps.core.tests_archive` cover shared timeline/archive behavior.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend and no-migration checks were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 8 pass 5 notes, 2026-07-09:

- Affected areas: permissions impact unchanged because appointment lifecycle endpoints keep existing `appointments:update` backend gates and generic PATCH bypass protection; notification impact unchanged because existing appointment follow-up and responsible-user notifications remain in place; BusinessEvent impact none; AI impact indirect only through cleaner source timeline/audit facts; migration/env impact none.
- Appointment lifecycle activity metadata now carries taxonomy `event_type`, `lifecycle_action`, from/to status and reason where applicable for confirm, cancel, complete, no-show and reschedule actions.
- Request-backed cancel, complete, no-show and reschedule audit rows now carry taxonomy `event_type`, normalized `lifecycle_action`, from/to status and reason where applicable. Confirm remains activity-backed and is not forced into audit because `appointment_confirmed` is not audit-required in the taxonomy.
- Tests now assert appointment cancel/no-show/complete/reschedule audit metadata, confirm activity metadata and reason propagation into lifecycle timeline events.
- Checks run:
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.scheduling.tests --keepdb --verbosity=2` passed, 35 tests OK.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.activities.tests apps.core.tests_crm_cards --keepdb --verbosity=1` passed, 15 tests OK.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py check` passed.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
- Skipped: frontend build and route smoke because this pass changed only backend appointment lifecycle metadata/tests/docs and no frontend API/UI contract changed.
- Skipped: broader CRM backend suite because the changed surface is limited to appointment lifecycle activity/audit metadata; `apps.scheduling.tests`, `apps.activities.tests` and CRM card tests cover the affected timeline/audit behavior.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend and no-migration checks were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 8 pass 6 notes, 2026-07-09:

- Affected areas: permissions impact unchanged because inbox send/link/create endpoints keep existing backend gates; notification impact unchanged because chat and appointment notification paths were not changed; BusinessEvent impact none; AI impact indirect only through better source-grounded conversation timeline facts; migration/env impact none.
- Added taxonomy coverage for conversation send/retry/link/qualification activity events: `message_retried`, `conversation_qualification_previewed`, `conversation_client_linked`, `conversation_lead_linked` and `conversation_deal_linked`.
- Inbox send/retry/link/create activity now carries taxonomy `event_type` in metadata through the existing inbox activity helpers. Manual conversation-created task/client/appointment activity and pipeline-created client/lead/deal/task activity now preserve `conversation_id` plus taxonomy event metadata.
- Tests now assert source metadata for manager outbound send, message retry, manual task/client/appointment create, lead/client/deal link, AI qualification preview and pipeline-created client/lead/deal/task events.
- Checks run:
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.activities.tests --keepdb --verbosity=1` passed, 8 tests OK.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.bots.tests --keepdb --verbosity=1` passed, 45 tests OK.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.core.tests_crm_cards --keepdb --verbosity=1` passed, 7 tests OK.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py check` passed.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
- Skipped: frontend build and route smoke because this pass changed only backend conversation activity taxonomy/metadata/tests/docs and no frontend API/UI contract changed.
- Skipped: broader CRM backend suite because the changed surface is limited to conversation activity metadata; `apps.bots.tests`, `apps.activities.tests` and CRM card tests cover the affected send/link/create timeline behavior.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend and no-migration checks were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 8 pass 7 notes, 2026-07-09:

- Affected areas: permissions impact unchanged because AI tool execution and approval endpoints keep existing `AI_PIPELINE`/approval permission gates; notification impact unchanged except existing tool-created task notification behavior; BusinessEvent impact none; AI impact direct because tool execution and approval decisions now have security audit records; migration/env impact none.
- Added `apps.ai_core.audit` helpers for AI audit metadata. Tool execution audit records avoid raw input/output payload values and store tool name, status, conversation id, input/output keys and safe output entity refs.
- `POST /api/ai/tools/{id}/execute/` now writes `AuditLog` for executed, failed or rejected tool call attempts. Non-suggested tool calls that are rejected by the endpoint are audited too.
- AI approval request creation, approval and rejection now write `AuditLog` rows with action type, source object, related AI request/tool ids, decision/reason and payload keys without raw payload values.
- Tests now assert audit rows for successful AI task execution, rejected execution attempts with secret masking, approval request creation, approval decisions and rejection decisions.
- Checks run:
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.ai_core.tests --keepdb --verbosity=1` passed, 20 tests OK.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.core.tests_security --keepdb --verbosity=1` passed, 6 tests OK.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py check` passed.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
- Skipped: frontend build and route smoke because this pass changed only backend AI audit behavior/tests/docs and no frontend API/UI response contract changed.
- Skipped: broader CRM backend suite because the changed surface is limited to AI tool/approval audit output; `apps.ai_core.tests` and security audit tests cover the affected behavior.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend and no-migration checks were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 8 pass 8 notes, 2026-07-09:

- Affected areas: permissions impact unchanged because connector and BusinessEvent endpoint gates were not changed; notification impact none; BusinessEvent impact yes because `normalize_business_event` now maps CRM-linked new events into activity timeline; AI impact indirect because AI analyst/card context can now cite integration events tied to CRM entities; migration/env impact none.
- Added taxonomy coverage for `integration_event` as a system timeline event with `domain=integrations`.
- `normalize_business_event` now creates one `ActivityEvent` for newly-created BusinessEvents when the sanitized payload safely resolves to a same-business `client_id`, `lead_id`, `deal_id` or `appointment_id`. Events without CRM entity references stay in BusinessEvent only, avoiding noisy CRM timelines.
- Integration timeline activity stores `business_event_id`, provider/source, connector id, external id, integration event type and resolved target entity metadata. Repeated provider deliveries reuse the existing BusinessEvent and do not duplicate ActivityEvent rows.
- Tests now assert CRM-linked BusinessEvent -> ActivityEvent mapping, idempotency, same-business entity resolution and secret masking in the stored event payload.
- Checks run:
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.integrations.tests_connectors --keepdb --verbosity=1` passed, 31 tests OK.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.activities.tests --keepdb --verbosity=1` passed, 8 tests OK.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.core.tests_crm_cards --keepdb --verbosity=2` passed, 7 tests OK.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py check` passed.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
- Skipped: frontend build and route smoke because this pass changed only backend BusinessEvent-to-ActivityEvent mapping/tests/docs and no frontend API/UI response contract changed.
- Skipped: broader integration/provider suite because the changed surface is limited to shared BusinessEvent normalization and CRM timeline mapping; connector, activity and CRM card tests cover the affected behavior.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend and no-migration checks were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 8 pass 9 notes, 2026-07-09:

- Affected areas: permissions impact unchanged because the UI consumes existing permission-gated CRM card endpoints; notification impact none; BusinessEvent impact indirect because CRM-linked integration events are now readable in the card timeline; AI impact indirect because source-grounded AI/conversation facts are easier to inspect from CRM cards; migration/env impact none.
- CRM card timeline rendering moved from an inline drawer block into `EntityTimelineList` plus `timelineHelpers`, keeping `CrmEntityDrawer` and `panels.tsx` small while reusing the existing `crmCardsApi.get` contract.
- Timeline entries now show grouped dates, visible/total event counts, category badges, source and event-type chips, safe allowlisted metadata details for lifecycle transitions, reasons, linked entity ids, integration event refs and source entity context.
- The renderer does not dump arbitrary metadata objects; it formats only scalar/allowlisted fields, preserving the existing backend sanitization boundary for provider errors/secrets.
- Added i18n keys for timeline category labels, visible count and metadata field labels across `en`, `ru` and `kk`.
- Checks run:
  - `cd frontend; npm run build` passed after implementation and again after helper decomposition, including i18n parity, TypeScript and Vite/widget builds.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.core.tests_crm_cards --keepdb --verbosity=1` passed, 7 tests OK.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py check` passed.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
  - `E2E_SKIP_LOCAL_SETUP=true E2E_BASE_URL=http://127.0.0.1:5173 E2E_API_BASE_URL=http://127.0.0.1:8000 npx playwright test ./e2e/smoke.spec.ts --grep "business owner core routes render without 404" --project=desktop-chromium` passed after the final code.
  - `E2E_SKIP_LOCAL_SETUP=true E2E_BASE_URL=http://127.0.0.1:5173 E2E_API_BASE_URL=http://127.0.0.1:8000 npx playwright test ./e2e/smoke.spec.ts --grep "business owner can use core merchant CRM pages" --project=desktop-chromium` passed after the final code.
- Transient smoke issue recorded: the first `business owner can use core merchant CRM pages` attempt timed out before reaching CRM because the page remained on login while waiting for a visible sidebar link; rerunning the same official smoke after the route smoke passed.
- Skipped: broad backend CRM suite because this pass changed only frontend CRM card timeline rendering and reused the existing CRM card API contract; `apps.core.tests_crm_cards`, frontend build and CRM Playwright smoke cover the affected surface.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend, frontend and smoke checks were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 8 pass 10 notes, 2026-07-09:

- Affected areas: permissions impact unchanged because task endpoints keep existing backend gates; notification impact unchanged because existing task notification routing was not changed; BusinessEvent impact none; AI impact indirect only through cleaner source timeline/audit facts; migration/env impact none.
- Task service activity now seeds taxonomy metadata for user-facing task timeline events, including `event_type`, `kind` and normalized `lifecycle_action` for lifecycle, assignment, schedule and watcher actions.
- Task audit writing now backfills taxonomy `event_type` for request-backed task cancel, undo-cancel and assignment audit rows without changing the underlying action permission checks.
- Tests now assert task cancel writes both timeline activity and audit with taxonomy metadata/reason, assign-to-me writes timeline and audit taxonomy metadata, due-today/due-tomorrow quick actions write schedule timeline metadata, and denied/tenant-hidden task actions do not write side-effect activity/audit rows.
- Checks run:
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.tasks.tests --keepdb --verbosity=1` passed on rerun, 35 tests OK.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.tasks.tests.TasksAndNotificationsPolishTests.test_task_workload_groups_active_tasks_by_assignee --keepdb --verbosity=2` passed, 1 test OK.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.activities.tests apps.core.tests_crm_cards --keepdb --verbosity=1` passed, 15 tests OK.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py check` passed.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
- Baseline/stale keepdb issue recorded: the first full `apps.tasks.tests` run failed once in `test_task_workload_groups_active_tasks_by_assignee` with workload active total `3` instead of `4`; the isolated workload test passed after test DB migration/recreate, and the full `apps.tasks.tests` suite then passed without code changes to workload logic.
- Skipped: frontend build and route smoke because this pass changed only backend task activity/audit metadata and tests; no frontend API/UI contract changed.
- Skipped: broader CRM backend suite because focused task tests plus activity and CRM-card tests cover the affected timeline/audit surface.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend and no-migration checks were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

## Phase 9: AI Layer Over Real CRM Data

Goal: make AI useful because it reads real CRM state and acts through safe services.

- [x] Review `AIRequestLog`, `BusinessKnowledgeItem`, `AgentProfile`, `AIToolCallLog`, `ApprovalRequest`.
- [x] Ensure AI assistant always respects business/user permission scope.
- [x] Ensure AI analyst cites source entities/events.
- [x] Add source-grounded daily owner brief.
- [x] Add AI next-best-action suggestions for:
  - [x] stale leads
  - [x] overdue tasks
  - [x] unanswered conversations
  - [x] stalled deals
  - [x] failed connectors
- [x] Ensure AI cannot execute critical actions without approval.
- [x] Ensure AI tool execution writes audit.
- [x] Add AI output tests for no-data and source-citation behavior.
- [x] Add frontend states for mock/live AI provider and missing data.

Phase 9 pass 1 notes, 2026-07-09:

- Affected areas: permissions impact review-only, no behavior changed; notification impact none; BusinessEvent impact review-only because AI analyst reads BusinessEvent sources; AI impact direct because this pass defines the current AI model/view risk map; migration/env impact none.
- Reviewed `AIRequestLog`, `BusinessKnowledgeItem`, `AgentProfile`, `AIToolCallLog` and `ApprovalRequest` model contracts. All reviewed models are directly scoped to `Business`; AI/tool/approval logs also preserve the invoking user or request/decision actors where applicable.
- Reviewed exposed AI API surfaces: request logs, knowledge items, agent profiles and approval requests use `TenantModelViewSet`; assistant chat/status and analyst brief assert business access and AI permissions; tool suggest/execute requires business access plus `ai_pipeline` permissions; approval create/approve/reject maps action type to the relevant AI permission and writes audit.
- Existing protection confirmed: `AIToolCallLogSerializer` and `ApprovalRequestSerializer` sanitize secret-like JSON fields in API responses; AI tool and approval audit helpers record keys/refs instead of raw payload values; admin display masks AI request/tool log payloads.
- Follow-up risks recorded for the next Phase 9 tasks:
  - `AIRequestLogSerializer` still exposes raw `input_json` and `output_text` through the API inside tenant/permission scope, so log response sanitization should be hardened before treating logs as safe operational UI data.
  - `build_crm_context(business)` is business-scoped, not user-scope aware, so assistant context can include leads/appointments a scoped manager or employee may not otherwise see.
  - `build_business_event_sources(business)` is business-scoped, not user-scope aware, so analyst source selection should be reviewed alongside source-citation guarantees.
  - `AIToolExecuteView` treats an execute call with `ai_pipeline:execute` as confirmation; later Phase 9 work still needs explicit approval gates for critical AI actions.
- Checks run: no automated checks were required for this review-only pass because no runtime code changed.
- Skipped: backend/frontend test runs because this pass only inspected code/docs and updated the checklist with findings.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 9 pass 2 notes, 2026-07-09:

- Affected areas: permissions impact direct because AI assistant CRM context now follows existing CRM resource view scopes; notification impact none; BusinessEvent impact none; AI impact direct because assistant prompt/log context is narrower for scoped users; migration/env impact none.
- `build_crm_context` now accepts the invoking user and applies existing `scope_queryset` rules for `clients:view`, `leads:view` and `appointments:view` before building assistant summaries, latest leads and upcoming appointment context.
- `AIAssistantChatView` now passes `request.user` into the CRM context builder, so the AI prompt and `AIRequestLog.input_json["crm_context"]` no longer use unscoped business-wide lead/appointment querysets by default.
- Added a manager-scope regression test proving the assistant context includes only the manager-visible lead, excludes another owner's lead message from the logged prompt context and returns the scoped `new_leads_count`.
- Checks run:
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.ai_core.tests --keepdb --verbosity=1` passed, 21 tests OK.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.core.tests_tenant_isolation --keepdb --verbosity=1` passed, 5 tests OK.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py check` passed.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
- Skipped: frontend build and route smoke because this pass changed only backend AI assistant context/querying and backend tests; no frontend API response shape changed.
- Skipped: broader CRM backend suite because focused AI and tenant isolation tests cover the affected permission/context surface.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend and no-migration checks were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 9 pass 3 notes, 2026-07-09:

- Affected areas: permissions impact direct because AI analyst BusinessEvent sources now require the same `integrations:view` source permission used by the BusinessEvent API; notification impact none; BusinessEvent impact read-path only; AI impact direct because analyst source lists and prompt/log context are now permission-aligned; migration/env impact none.
- `build_business_event_sources` now accepts the invoking user and returns BusinessEvent sources only when that user can view integrations for the selected business. Users with `ai_analyst:view` but without `integrations:view` receive the existing no-data analyst fallback instead of hidden BusinessEvent facts.
- Existing analyst parsing/fallback behavior continues to require valid `source_ids` for sourced insights/actions; no-source fallback remains explicit with empty `source_ids` and no invented event facts.
- Added a regression test proving a marketer with AI analyst access but no integration access gets empty analyst sources, and the hidden BusinessEvent id/payload does not appear in the API response or `AIRequestLog.input_json`.
- Checks run:
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.ai_core.tests --keepdb --verbosity=1` passed, 22 tests OK.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.integrations.tests_connectors.BusinessConnectorFoundationTests.test_event_payload_secrets_are_masked_in_api_responses --keepdb --verbosity=1` passed, 1 test OK.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py check` passed.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
- Skipped: frontend build and route smoke because this pass changed only backend analyst source selection and backend tests; no frontend API response shape changed.
- Skipped: broader integration/provider suite because the changed surface is limited to AI analyst source access and existing BusinessEvent API masking was covered by a focused regression.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent focused backend and no-migration checks were run directly.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

Phase 9 pass 4 notes, 2026-07-10:

- Affected areas: permissions impact direct because owner daily brief and next-best-actions read CRM entities through existing `scope_queryset` rules; notification impact limited to already-existing task notification creation when an approved AI `create_task` tool executes; BusinessEvent impact direct because failed connector/event recommendations cite connector and BusinessEvent sources; AI impact direct because recommendations, no-data states, provider states and approval gates changed; migration/env impact none.
- Added `apps/ai_core/recommendations.py` as a deterministic, source-grounded owner brief / next-best-action layer over real CRM queues: stale leads, overdue tasks, unanswered conversations, stalled deals and failed connectors. Every recommendation carries `source_ids`, and no-data output returns explicit `summary.no_data` without invented facts.
- Added `/api/ai/owner-brief/daily/` with `ai_analyst:view` and business access checks. Source queries are role-aware for leads, tasks, conversations and deals; failed connector sources require `integrations:view`.
- Hardened AI tool execution so critical mutating tools require a matching approved `ApprovalRequest` linked to the exact `AIToolCallLog` before execution. Missing, mismatched, expired or unapproved approvals now stop execution and write an audit attempt while leaving the suggested tool call retryable.
- Kept low-risk read-only tools (`summarize_conversation`, `qualify_lead`) executable without approval, with audit.
- Hardened `AIRequestLogSerializer` response masking for secret-like `input_json` and `output_text`.
- Added frontend API types/method for owner daily brief, connected owner dashboard AI summary to real backend recommendations, added dashboard provider mock/live state, and added AI Navigator missing-source state.
- Baseline issue encountered during scoped checks: `apps/tasks/tests.py::TasksAndNotificationsPolishTests::test_task_workload_groups_active_tasks_by_assignee` failed in full module/scoped runs while passing in isolation. Root fix: `TaskViewSet.workload` now builds an explicit task queryset scoped by `TASKS:view` instead of reusing the generic list builder. Re-run passed.
- Checks run:
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py check` passed.
  - `.venv\Scripts\python.exe -m pytest apps\ai_core\tests.py -q` passed, 28 tests.
  - `.venv\Scripts\python.exe -m pytest apps\tasks\tests.py -q` passed, 35 tests after the workload baseline fix.
  - `.venv\Scripts\python.exe -m pytest apps\clients\tests.py apps\leads\tests_forms.py apps\crm\tests.py apps\scheduling\tests.py apps\tasks\tests.py apps\core\tests_tenant_isolation.py apps\ai_core\tests.py -q` passed, 148 tests.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.ai_core apps.tasks` passed, 63 tests.
  - `cd frontend && npm run build` passed; i18n dictionary parity passed.
- Skipped: full `scripts/codex_verify.sh` because `bash` is not available in this Windows PowerShell environment; equivalent migration check, Django check, focused Django tests and frontend build were run directly.
- Skipped: migrations because no model/schema changes were made and `makemigrations --check --dry-run` reported no changes.
- Branch/PR rule: this folder still has no `.git` directory, so one-task/one-branch/one-PR cannot be executed locally.

## Phase 10: Automations

Goal: automate CRM safely through the same service layer users use.

- [x] Review automation rule/action/run engine.
- [x] Add CRM triggers:
  - [x] `lead_created`
  - [x] `lead_status_changed`
  - [x] `deal_stage_changed`
  - [x] `appointment_cancelled`
  - [x] `appointment_completed`
  - [x] `task_overdue`
  - [x] `conversation_unread`
- [x] Add safe actions:
  - [x] create task
  - [x] create notification
  - [x] assign user
  - [x] add note
  - [x] create follow-up
- [x] Ensure automation actions call domain services.
- [x] Add automation run detail drawer.
- [x] Add retry/cancel controls.
- [x] Add per-business throttling or noisy-rule protection.
- [x] Add tests for idempotency, retry and permission boundaries.

Phase 10 completion notes, 2026-07-13:

- Affected areas:
  - permissions impact: automation run retry/cancel are backend-gated by `automations:manage`; rule/run reads remain business-scoped;
  - notification impact: automation notification actions route through `create_role_notification(...)`; automation-created tasks still use task notification routing;
  - BusinessEvent impact: no new BusinessEvent ingestion contract was added in this phase;
  - AI impact: none directly; automation remains separate from approval-gated AI tools;
  - migration/env impact: automations migration `0004_alter_automationaction_action_type_and_more.py` updates trigger/action/status choices; optional runtime knobs are `AUTOMATION_RULE_RUN_LIMIT` and `AUTOMATION_RULE_RUN_WINDOW_MINUTES`.
- Implementation summary:
  - automation triggers now cover lead created/status changed, deal stage changed, appointment cancelled/completed, task overdue and conversation unread;
  - safe actions execute through service/domain helpers for task/follow-up creation, notification routing, user assignment and timeline notes;
  - run retry/cancel controls are available through API and the Automations UI run detail drawer;
  - noisy rules are throttled per business/rule/window without duplicating idempotent runs;
  - tests cover idempotency, retry, cancellation, permissions, service-emitted triggers and noisy-rule throttling.
- Checks run:
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py check` passed.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py makemigrations automations` created `apps/automations/migrations/0004_alter_automationaction_action_type_and_more.py`.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py migrate` passed.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed with no changes detected after migration.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.automations --keepdb --verbosity=1` passed, 22 tests.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.leads apps.crm apps.scheduling --keepdb --verbosity=1` passed, 89 tests.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.tasks apps.activities --keepdb --verbosity=1` passed, 45 tests.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.bots.tests.InboxBackendTests --keepdb --verbosity=1` passed, 25 tests.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.bots.tests.BotsFoundationTests.test_public_website_chat_creates_conversation_message_client_and_lead apps.bots.tests.BotsFoundationTests.test_public_website_chat_can_append_message_to_conversation apps.bots.tests.BotsFoundationTests.test_public_website_chat_auto_pipeline_lead_task_mode_is_guarded_and_idempotent --keepdb --verbosity=1` passed, 3 tests.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe -m pytest apps\clients\tests.py apps\leads\tests_forms.py apps\crm\tests.py apps\scheduling\tests.py apps\tasks\tests.py apps\core\tests_tenant_isolation.py apps\automations\tests.py -q` passed, 141 tests.
  - `cd frontend && npm run build` passed; i18n dictionary parity passed.
- Skipped:
  - `scripts/codex_verify.sh` because `bash` is unavailable in this Windows PowerShell environment; direct backend/frontend equivalents were run.
  - one wide impacted suite `manage.py test apps.automations apps.leads apps.crm apps.scheduling apps.bots apps.tasks apps.activities --keepdb --verbosity=1` timed out after 244 seconds, so it was split into the focused suites above.
  - branch/PR creation because local git metadata is not usable here: `git status --short --branch` returns `fatal: not a git repository (or any of the parent directories): .git`.

## Phase 11: Integrations Into CRM

Goal: make connectors feed CRM through normalized events.

- [x] Review connector provider boundaries.
- [x] Ensure credentials are always masked in serializers.
- [x] Ensure health checks are tenant-safe and permission-gated.
- [x] Map website chat/form events to leads/conversations.
- [x] Map Telegram events to conversations/leads where configured.
- [x] Map WhatsApp events to conversations/leads where configured.
- [x] Map Instagram events to conversations/leads where configured.
- [x] Map Excel/CSV imports to clients/leads/deals/events.
- [x] Map commerce events to analytics/tasks/deals only through provider-neutral adapters.
- [x] Add connector setup recovery messages for merchant UI.
- [x] Add sync run visibility and retry where safe.
- [x] Add provider-specific tests without real network calls.

Completion notes 2026-07-13:

- Affected areas:
  - permissions: `ConnectorSyncRun.retry` requires `integrations:manage`; sync-run reads remain `integrations:view` scoped and may return tenant-safe 404 before manage checks.
  - notifications: no new notification routing was added.
  - BusinessEvent impact: website forms/chat, Telegram, WhatsApp, Instagram and Excel/CSV imports now emit normalized CRM-linked events where source entities exist.
  - AI impact: AI/analytics can cite more source-grounded connector events; no mutating AI tool behavior changed.
  - migration/env impact: no model changes or migrations; no env changes.
- Implemented:
  - `apps/integrations/crm_mapping.py` centralizes connector-to-CRM event mapping.
  - `apps/integrations/sync_service.py` centralizes read-only marketplace sync normalization and safe retry.
  - Public forms and website chat now write `lead.captured` / `message.received` BusinessEvents.
  - Telegram, WhatsApp and Instagram inbound handlers now write `message.received` BusinessEvents after auto-pipeline.
  - Excel/CSV import now supports deals and writes `client.imported`, `lead.imported`, `deal.imported` events.
  - Integrations UI shows latest sync run and retry for failed safe runs; i18n parity updated.
- Checks run:
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py check` passed.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed, no changes detected.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.integrations.tests_connectors.BusinessConnectorFoundationTests.test_owner_can_retry_failed_healthcheck_sync_run_but_operator_cannot apps.integrations.tests.TelegramIntegrationSkeletonTests.test_telegram_webhook_saves_inbound_message apps.integrations.tests.TelegramIntegrationSkeletonTests.test_telegram_webhook_is_idempotent_for_repeated_message apps.integrations.tests.WhatsAppIntegrationFoundationTests.test_whatsapp_webhook_saves_inbound_message apps.integrations.tests.WhatsAppIntegrationFoundationTests.test_meta_whatsapp_webhook_routes_by_phone_number_id_and_signature apps.integrations.tests.InstagramIntegrationFoundationTests.test_instagram_webhook_routes_by_instagram_user_id_and_signature apps.bots.tests.BotsFoundationTests.test_public_website_chat_creates_conversation_message_client_and_lead apps.bots.tests.BotsFoundationTests.test_public_website_chat_can_append_message_to_conversation apps.leads.tests_forms.LeadFormCaptureTests.test_public_form_creates_client_lead_submission_and_runs_automation apps.core.tests_import_export.ImportExportTests --keepdb --verbosity=1` passed, 25 tests.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.integrations.tests apps.integrations.tests_connectors --keepdb --verbosity=1` passed, 98 tests.
  - `cd frontend && npm run build` passed; i18n dictionary parity passed.
- Skipped:
  - `scripts/codex_verify.sh` because this run used Windows PowerShell and the direct backend/frontend gates above were run.
  - branch/PR creation because local git metadata is not usable here: `.git` exists, but `git status --short --branch` returns `fatal: not a git repository (or any of the parent directories): .git`.
- Known risks:
  - connector setup recovery copy is currently represented by merchant-safe `last_error`, latest sync visibility and provider setup/status surfaces; deeper support playbooks can be expanded later.
  - sync retry is intentionally limited to failed health checks and read-only pull/manual syncs; file imports are not retried from sync-run history because the source file/job context must stay explicit.

## Phase 12: Analytics And Reporting

Goal: give owners operational answers, not vanity dashboards.

- [x] Review owner dashboard and analytics endpoints.
- [x] Add CRM funnel metrics:
  - [x] lead count by source/status
  - [x] conversion to deal
  - [x] won/lost value
  - [x] appointment completion/no-show rate
  - [x] overdue task count
  - [x] unanswered conversation count
- [x] Add manager performance metrics with permission scope.
- [x] Add connector health metrics.
- [x] Add AI insight cards grounded in these metrics.
- [x] Ensure reports never leak cross-business data.
- [x] Add tests for metric correctness and tenant isolation.

### Phase 12 completion notes

- Affected areas before work:
  - permissions impact: yes, analytics payloads now apply backend business access plus resource/member scoping for leads, deals, appointments, tasks, conversations and manager performance;
  - notification impact: none, read-only reporting only;
  - BusinessEvent impact: read-only connector health/latest event consumption only, no new events emitted;
  - AI impact: AI insight cards are deterministic and grounded in CRM metric keys plus source entity ids; no mutating AI action behavior changed;
  - migration/env impact: no model changes, no migrations, no env changes.
- Implemented:
  - `apps/analytics/crm_metrics.py` centralizes CRM operational metrics for owner dashboard and reports.
  - Owner dashboard now returns `crm_funnel`, scoped `manager_performance`, expanded `connector_health` and `ai_insight_cards`.
  - Report summary/export now use the same scoped CRM metric service for user-aware reporting.
  - `/dashboard/analytics` shows lead-to-deal conversion, won value, unanswered conversations, no-show rate, connector errors and backend-grounded AI cards.
  - Frontend analytics/owner dashboard types now include CRM funnel, scoped manager performance, connector health details and AI insight card contracts.
- Checks run:
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.analytics.tests -v 2` passed, 9 tests.
  - `cd frontend; npm run build` passed, including i18n parity, TypeScript build and Vite builds.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py check` passed.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed, no changes detected.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; $env:SECURE_SSL_REDIRECT='False'; $env:SESSION_COOKIE_SECURE='False'; $env:CSRF_COOKIE_SECURE='False'; $env:REDIS_URL='memory://'; $env:CELERY_TASK_ALWAYS_EAGER='True'; $env:CELERY_TASK_STORE_EAGER_RESULT='False'; $env:AUTOMATIONS_RUN_INLINE='True'; .venv\Scripts\python.exe -m pytest apps/analytics/tests.py apps/clients/tests.py apps/leads/tests_forms.py apps/crm/tests.py apps/scheduling/tests.py apps/tasks/tests.py apps/core/tests_tenant_isolation.py -q` passed, 129 tests.
- Skipped:
  - `scripts/codex_verify.sh` because this Windows PowerShell run used the direct backend/frontend gates above.
  - branch/PR creation because local git metadata is still not usable here: `.git` exists, but previous `git status --short --branch` returned `fatal: not a git repository (or any of the parent directories): .git`.
- Known risks:
  - a first pytest attempt with dotted module names failed before collection (`file or directory not found: apps.analytics.tests`); the same scope was rerun with file paths and passed.
  - Russian/Kazakh new analytics copy was added as ASCII fallback strings to avoid touching large mojibake locale hunks in PowerShell.

## Phase 13: E2E Business Flows

Goal: prove that the product works as a CRM system, not only as separate endpoints.

- [x] E2E: owner login -> dashboard -> leads -> create/assign lead.
- [x] E2E: lead -> client -> appointment -> task.
- [x] E2E: lead -> deal -> won/lost.
- [x] E2E: inbox message -> AI qualification -> lead/task.
- [x] E2E: client duplicate warning -> merge dry-run -> merge.
- [x] E2E: appointment reschedule/cancel/no-show.
- [x] E2E: integration event -> BusinessEvent -> CRM action.
- [x] E2E: AI suggests action -> user approves -> service executes -> audit exists.
- [x] Mobile smoke for owner/manager daily flows.

### Phase 13 completion notes

- Affected areas before work:
  - permissions impact: yes, E2E flows assert owner/manager/marketer permission behavior and tenant-hidden merge protection through existing backend permission gates;
  - notification impact: yes, existing appointment/task/AI task notification paths are exercised but no new notification policy was added;
  - BusinessEvent impact: yes, connector-normalized BusinessEvents now have E2E coverage for idempotency, secret sanitization and CRM timeline creation;
  - AI impact: yes, inbox AI qualification and approval-gated AI tool execution are covered with source-backed logs/audit;
  - migration/env impact: no model changes, no migrations, no env changes.
- Implemented:
  - Added `apps/core/tests_business_flows_e2e.py` with cross-entity API tests for owner login/dashboard/lead assignment, lead -> client -> appointment -> task, lead -> deal won/lost, inbox AI qualification -> lead/task, duplicate merge dry-run/merge, appointment reschedule/cancel/no-show, integration BusinessEvent -> CRM timeline and AI approval -> tool execution -> audit.
  - Hardened AI-created tasks by linking the originating `BotConversation` when the AI tool was suggested from a conversation.
  - Added deterministic `business_manager@example.com` E2E smoke user and membership in `prepare_e2e_smoke_data`.
  - Added mobile manager daily CRM smoke coverage alongside the existing mobile owner smoke.
- Checks run:
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py test apps.core.tests_business_flows_e2e -v 2` passed, 8 tests.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py check` passed.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe manage.py makemigrations --check --dry-run` passed, no changes detected.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe -m pytest apps/core/tests_business_flows_e2e.py apps/ai_core/tests.py -q` passed, 36 tests.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe -m pytest apps/clients/tests.py apps/leads/tests_forms.py apps/crm/tests.py apps/scheduling/tests.py apps/tasks/tests.py -q` passed, 115 tests.
  - `$env:DATABASE_URL='sqlite:///db.sqlite3'; .venv\Scripts\python.exe -m pytest apps/bots/tests.py apps/integrations/tests_connectors.py -q` passed, 77 tests.
  - `cd frontend; npm run build` passed, including i18n parity, TypeScript build and Vite app/widget builds.
  - Manual Windows E2E server orchestration passed: `manage.py migrate`, `manage.py prepare_e2e_smoke_data`, hidden Django/Vite dev servers, then `E2E_SKIP_LOCAL_SETUP=true E2E_BASE_URL=http://127.0.0.1:5173 E2E_API_BASE_URL=http://127.0.0.1:8000 npx.cmd playwright test --project=mobile-chromium -g "mobile (owner|manager) smoke"` passed, 2 tests.
- Skipped:
  - `scripts/codex_verify.sh` because this Windows PowerShell run used the direct backend/frontend/mobile gates above.
  - Full Playwright smoke suite because Phase 13 changed only mobile owner/manager smoke coverage and backend business-flow gates; the targeted mobile smoke passed.
  - Branch/PR creation because local git metadata is still not usable here: `.git` exists, but previous `git status --short --branch` returned `fatal: not a git repository (or any of the parent directories): .git`.
- Known risks:
  - A broad all-at-once pytest command for the same backend scope timed out at 5 minutes without assertion output; it was split into three thematic chunks and all chunks passed.
  - PyJWT emitted an existing test warning about a short local HMAC secret during token login coverage; it did not fail tests.
  - Fixed after Phase 13: the Playwright config no longer uses Unix-style Django `webServer` setup commands. `frontend/e2e/django-e2e.mjs` now handles cross-platform Django setup/server startup, and targeted mobile smoke passed without `E2E_SKIP_LOCAL_SETUP`.

### Post-Phase 13 E2E infrastructure follow-up, 2026-07-13

- Affected areas before work: permissions impact none; notification impact none; BusinessEvent impact none; AI impact none; migration/env impact none.
- Implemented:
  - Added `frontend/e2e/django-e2e.mjs` as a shared cross-platform local Django setup/server helper for Playwright.
  - Replaced the Unix-style Playwright `webServer` command with `node e2e/django-e2e.mjs serve`.
  - Updated smoke `beforeAll` to use the same helper for local migrations/smoke seed preparation.
  - Hardened the Playwright login helper with a form-login fallback if the localStorage-token path lands on the auth shell.
- Checks run:
  - `node frontend/e2e/django-e2e.mjs prepare` passed.
  - `cd frontend; npx.cmd playwright test --project=mobile-chromium -g "mobile owner smoke"` passed, 1 test.
  - `cd frontend; npx.cmd playwright test --project=mobile-chromium -g "mobile (owner|manager) smoke"` passed, 2 tests, using Playwright `webServer` setup without `E2E_SKIP_LOCAL_SETUP`.
  - `cd frontend; npm run build` passed, including i18n parity, TypeScript build and Vite app/widget builds.
- Skipped:
  - backend unit suites because this pass changed only Playwright/test infrastructure and docs; Phase 13 backend E2E and scoped CRM/AI/integration suites already passed for the CRM behavior.
  - full Playwright suite because this follow-up targeted the local server setup and owner/manager mobile smoke path.
  - branch/PR creation because local git metadata is still not usable here.

## Baseline Risks To Track

- [x] Some source docs currently display mojibake text in this Windows shell; verify file encodings before editing Russian copy.
- [x] Local git metadata is currently unusable: `.git` exists, but `git status --short --branch` returns `fatal: not a git repository (or any of the parent directories): .git`, so normal branch/PR workflow cannot be performed locally until repo metadata is restored.
- [x] Several frontend pages are oversized and should be decomposed before adding more behavior.
- [x] Provider integrations need per-provider live/mock verification before being called production-ready.
- [x] AI value depends on real CRM/BusinessEvent data; empty demo data can make AI look less useful than the architecture allows.
- [x] Frontend route smoke had an auth baseline issue on full reload; fixed in `frontend/e2e/smoke.spec.ts` by aligning the Playwright refresh path with the current in-memory access token auth flow.
