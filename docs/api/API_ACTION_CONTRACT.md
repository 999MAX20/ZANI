# API Action Contract

Last updated: 2026-06-19

Purpose: keep frontend and backend aligned on which fields are regular CRUD fields and which fields are state-machine fields that must only change through action endpoints/services.

This document is a working source of truth for CRM/frontend integration. If a field is listed as protected, frontend must not send it in generic `POST`, `PUT` or `PATCH` payloads. Backend serializers reject protected writes where the entity has a guarded state contract.

## General Rules

- Use regular CRUD endpoints for editable descriptive fields: names, titles, notes, message text, schedule times, settings, owner/assignee where allowed.
- Use action endpoints for lifecycle, delivery, archive, runtime and billing state changes.
- Use `DELETE /api/<resource>/<id>/` for soft archive on archive-supported CRM resources, or `POST /api/<resource>/<id>/archive/` when the UI needs to pass a reason.
- Use `POST /api/<resource>/<id>/restore/` for restore. Restore is restricted to owner/admin-level permissions for critical CRM records.
- Do not write `created_at`, `updated_at`, `archived_at`, `archived_by`, system timestamps, runtime errors, provider payloads, delivery results or audit metadata from frontend.
- Treat `400` with `{ "fields": [...] }` as a contract violation: switch to the listed action endpoint instead of retrying the generic update.

## Core CRM

### Deals

Resource: `/api/deals/`

Protected generic write fields:

- `stage`
- `status`
- `probability`
- `lost_reason`
- `lost_by`
- `won_at`
- `lost_at`
- `previous_status`
- `previous_stage`
- `stage_entered_at`
- `is_archived`
- `archive_reason`
- `archived_at`
- `archived_by`

Action endpoints:

- `POST /api/deals/{id}/move-stage/`
  - Use for pipeline stage movement.
  - Required body: `stage`.
  - Optional body: required stage fields such as `amount`, `lost_reason`.
- `POST /api/deals/{id}/mark-won/`
  - Use for quick win.
  - Optional body: `amount`.
- `POST /api/deals/{id}/mark-lost/`
  - Use for quick loss.
  - Required body: `lost_reason`.
- `POST /api/deals/{id}/reopen/`
  - Use to reopen a won/lost deal.
- `POST /api/deals/{id}/archive/`
  - Optional body: `reason`.
- `POST /api/deals/{id}/restore/`

Read/helper endpoints:

- `GET /api/deals/summary/`
- `GET /api/deals/board/`
- `GET /api/deals/{id}/crm-card/`

### Leads

Resource: `/api/leads/`

Protected generic write fields:

- `status`
- `previous_status`
- `lost_reason`
- `lost_at`
- `lost_by`
- `is_archived`
- `archive_reason`
- `archived_at`
- `archived_by`

Action endpoints:

- `POST /api/leads/{id}/assign/`
  - Required body: `user_id`.
- `POST /api/leads/{id}/take-in-work/`
- `POST /api/leads/{id}/mark-contacted/`
- `POST /api/leads/{id}/mark-closed/`
- `POST /api/leads/{id}/mark-lost/`
  - Required body: `lost_reason`.
- `POST /api/leads/{id}/reopen/`
- `POST /api/leads/{id}/create-deal/`
- `POST /api/leads/{id}/add-note/`
  - Required body: `text`.
- `POST /api/leads/{id}/create-appointment/`
  - Required body: `service`, `start_at`.
  - Optional body: `resource`.
- `POST /api/leads/{id}/archive/`
  - Optional body: `reason`.
- `POST /api/leads/{id}/restore/`

Read/helper endpoints:

- `GET /api/leads/summary/`
- `GET /api/leads/{id}/crm-card/`
- `POST /api/leads/check-duplicates/`

### Appointments

Resource: `/api/appointments/`

Protected generic write fields:

- `status`
- `is_archived`
- `archive_reason`
- `archived_at`
- `archived_by`

Action endpoints:

- `POST /api/appointments/{id}/confirm/`
- `POST /api/appointments/{id}/cancel/`
- `POST /api/appointments/{id}/complete/`
- `POST /api/appointments/{id}/no-show/`
- `POST /api/appointments/{id}/archive/`
  - Optional body: `reason`.
- `POST /api/appointments/{id}/restore/`

Read/helper endpoints:

- `GET /api/appointments/available-slots/`
  - Required query: `business_id`, `service_id`, `date`.
  - Optional query: `resource_id`.
- `GET /api/appointments/{id}/crm-card/`

### Tasks

Resource: `/api/tasks/`

Protected generic write fields:

- `status`
- `completed_at`
- `completed_by`
- `is_archived`
- `archive_reason`
- `archived_at`
- `archived_by`

Action endpoints:

- `POST /api/tasks/{id}/start/`
- `POST /api/tasks/{id}/complete/`
- `POST /api/tasks/{id}/cancel/`
- `POST /api/tasks/{id}/reopen/`
- `POST /api/tasks/{id}/snooze/`
  - Required body: `snoozed_until`.
- `POST /api/tasks/{id}/assign/`
  - Required body: `user_id`.
- `POST /api/tasks/{id}/assign-to-me/`
- `POST /api/tasks/{id}/due-today/`
- `POST /api/tasks/{id}/due-tomorrow/`
- `POST /api/tasks/{id}/add-watcher/`
  - Required body: `user_id`.
- `POST /api/tasks/{id}/add-comment/`
  - Required body: `text`.
- `GET /api/tasks/{id}/comments/`
- `POST /api/tasks/{id}/archive/`
  - Optional body: `reason`.
- `POST /api/tasks/{id}/restore/`

## Clients

Resource: `/api/clients/`

Action endpoints:

- `POST /api/clients/check-duplicates/`
- `POST /api/clients/{id}/merge/`
- `POST /api/clients/{id}/merge-dry-run/`
- `GET /api/clients/{id}/crm-card/`
- `POST /api/clients/{id}/archive/`
  - Optional body: `reason`.
- `POST /api/clients/{id}/restore/`

Frontend rule: run `merge-dry-run` before destructive merge UI confirmation.

## Custom Fields And Files

Custom fields:

- `POST /api/custom-field-values/bulk-upsert/`
  - Use for CRM card custom field edits.
  - Backend validates custom field type and entity compatibility.

Files:

- `GET /api/file-attachments/{id}/download/`
  - Use for private file download links.

## Work Queues

Resource: `/api/work-queues/`

Read-only operational queue endpoint. Use this for dashboard/operator queues instead of recomputing stale/overdue logic in frontend.

Common queue concepts:

- overdue tasks
- stale leads
- SLA-overdue deals
- deals without next action
- upcoming appointments
- appointment confirmations
- unread/handoff conversations

## Notifications

Resource: `/api/notifications/`

Protected generic write fields:

- `status`
- `read_at`

Action endpoints:

- `POST /api/notifications/{id}/mark-read/`
- `POST /api/notifications/{id}/mark-unread/`
- `POST /api/notifications/mark-all-read/`
- `POST /api/notifications/{id}/mark-sent/`
  - Manage-level action.
- `POST /api/notifications/{id}/cancel/`
  - Manage-level action.
- `POST /api/notifications/{id}/retry/`
  - Manage-level action.
  - Only failed notifications can be retried.

Read/helper endpoints:

- `GET /api/notifications/summary/`

## Outreach

### Campaigns

Resource: `/api/outreach/campaigns/`

Protected generic write fields:

- `status`
- `started_at`
- `finished_at`

Action endpoints:

- `GET /api/outreach/campaigns/{id}/preview-audience/`
- `POST /api/outreach/campaigns/{id}/prepare/`
- `POST /api/outreach/campaigns/{id}/launch/`
- `POST /api/outreach/campaigns/{id}/refresh-status/`
- `GET /api/outreach/campaigns/{id}/stats/`
- `GET /api/outreach/campaigns/{id}/launch-checklist/`
- `POST /api/outreach/campaigns/{id}/retry-failed/`
- `POST /api/outreach/campaigns/{id}/cancel/`
- `GET /api/outreach/campaigns/appointment-automation-status/`

Frontend rule: show `launch-checklist` before enabling `launch`.

### Recipients

Resource: `/api/outreach/recipients/`

Protected generic write fields:

- `status`
- `error`
- `error_code`
- `provider_result`
- `skipped_reason`
- `sent_at`

Frontend rule: recipients are delivery results. Do not mutate delivery state from UI.

### Consents

Resource: `/api/outreach/consents/`

Action endpoints:

- `POST /api/outreach/consents/bulk-import/`
- `POST /api/outreach/consents/bulk-import-file/`

Regular CRUD can manage consent `status`; serializer stamps `opted_in_at` and `opted_out_at`.

## Automations

Resources:

- `/api/automation-rules/`
- `/api/automation-conditions/`
- `/api/automation-actions/`
- `/api/automation-runs/`

Automation runs are runtime logs. They are not manually mutable from generic update endpoints.

Protected `AutomationRun` generic write fields:

- `status`
- `payload`
- `action_results`
- `error`
- `attempts`
- `max_attempts`
- `next_retry_at`
- `locked_at`
- `started_at`
- `finished_at`

Action endpoints:

- `GET /api/automation-rules/templates/`
- `POST /api/automation-rules/apply-template/`
- `POST /api/automation-rules/preview/`
- `POST /api/automation-rules/create-manual/`
- `POST /api/automation-runs/{id}/retry/`

Frontend rule: use `preview` before `create-manual` in automation builder.

## Billing

Resource: `/api/billing/current-subscription/`

Subscription state and plan change fields are managed only through billing actions.

Action endpoints:

- `PATCH /api/billing/current-subscription/settings/`
  - Allowed body fields: `billing_email`, `payment_method`, `invoice_details_json`.
- `POST /api/billing/current-subscription/change-plan/`
  - Required body: `plan`.
- `POST /api/billing/current-subscription/pause/`
- `POST /api/billing/current-subscription/resume/`
- `POST /api/billing/current-subscription/cancel/`

Read/helper endpoints:

- `GET /api/billing/plans/`
- `GET /api/billing/usage-summary/`
- `GET /api/billing/entitlements/`

## Scheduling Settings

Resources:

- `/api/resources/`
- `/api/working-hours/`
- `/api/appointment-message-settings/`

Action/helper endpoints:

- `POST /api/working-hours/apply-preset/`
  - Required body: `business`, `preset`.
  - Optional body: `resource`.

Frontend rule: prefer `apply-preset` for preset UX; use row CRUD only for manual working-hours editing.

## Lead Forms

Resources:

- `/api/lead-forms/`
- `/api/lead-form-fields/`
- `/api/lead-form-submissions/`
- `/api/lead-form-submission-errors/`

Action/helper endpoints:

- `POST /api/lead-forms/create-template/`
- `GET /api/public/forms/{public_id}/`
- `POST /api/public/forms/{public_id}/submit/`

Frontend rule: submissions and submission errors are operational records. Admin UI may read them, but public form submission should only use public endpoints.

## Conversations And Inbox

Primary CRM inbox resource:

- `/api/inbox/conversations/`

Important action endpoints:

- `GET|POST /api/inbox/conversations/{id}/messages/`
- `POST /api/inbox/conversations/{id}/retry-message/`
- `POST /api/inbox/conversations/{id}/assign/`
- `POST /api/inbox/conversations/{id}/take-over/`
- `POST /api/inbox/conversations/{id}/mark-read/`
- `POST /api/inbox/conversations/{id}/mark-unread/`
- `POST /api/inbox/conversations/{id}/set-priority/`
- `POST /api/inbox/conversations/{id}/close/`
- `POST /api/inbox/conversations/{id}/reopen/`
- `POST /api/inbox/conversations/{id}/suggest-reply/`
- `POST /api/inbox/conversations/{id}/create-task/`
- `POST /api/inbox/conversations/{id}/run-pipeline/`
- `POST /api/inbox/conversations/{id}/link-lead/`
- `POST /api/inbox/conversations/{id}/link-client/`
- `POST /api/inbox/conversations/{id}/create-client/`
- `POST /api/inbox/conversations/{id}/create-lead/`
- `POST /api/inbox/conversations/{id}/link-deal/`
- `POST /api/inbox/conversations/{id}/create-deal/`

Frontend rule: inbox is action-heavy. Avoid mutating bot/conversation state directly from generic bot endpoints unless the UI is an admin settings screen.

## Integrations

Connector resources:

- `/api/business-connectors/`
- `/api/connector-credentials/`
- `/api/business-events/`
- `/api/connector-sync-runs/`
- `/api/integration-event-logs/`

Logs and sync runs are read-only API resources. Connector status changes should come from connector action endpoints/services.

Important action endpoints:

- `GET /api/business-connectors/capabilities/`
- `POST /api/business-connectors/kaspi-config/`
- `POST /api/business-connectors/moysklad-config/`
- `POST /api/business-connectors/wildberries-config/`
- `POST /api/business-connectors/ozon-config/`
- `POST /api/business-connectors/whatsapp-request/`
- `POST /api/business-connectors/whatsapp-embedded-signup/start/`
- `POST /api/business-connectors/whatsapp-embedded-signup/complete/`
- `POST /api/business-connectors/instagram-oauth/start/`
- `POST /api/business-connectors/instagram-oauth/complete/`
- `POST /api/business-connectors/{id}/enable/`
- `POST /api/business-connectors/{id}/disable/`
- `POST /api/business-connectors/{id}/health-check/`
- `GET /api/business-connectors/{id}/kaspi-status/`
- `GET /api/business-connectors/{id}/moysklad-status/`
- `GET /api/business-connectors/{id}/wildberries-status/`
- `GET /api/business-connectors/{id}/ozon-status/`
- `POST /api/business-connectors/{id}/kaspi-test-connection/`
- `POST /api/business-connectors/{id}/moysklad-test-connection/`
- `POST /api/business-connectors/{id}/wildberries-test-connection/`
- `POST /api/business-connectors/{id}/ozon-test-connection/`
- `POST /api/business-connectors/{id}/kaspi-sync-orders/`
- `POST /api/business-connectors/{id}/moysklad-sync/`
- `POST /api/business-connectors/{id}/wildberries-sync/`
- `POST /api/business-connectors/{id}/ozon-sync/`
- `POST /api/business-connectors/{id}/events/`
- `POST /api/business-connectors/{id}/mock-sync/`

API token and webhook actions:

- `POST /api/api-tokens/{id}/rotate/`
- `POST /api/api-tokens/{id}/revoke/`
- `POST /api/webhook-endpoints/{id}/test-delivery/`
- `POST /api/webhook-deliveries/{id}/retry/`

Frontend rule: never display or store raw credential values after submission. Use masked values and connector status endpoints.

## Analytics

Resources:

- `/api/analytics-events/`
- `/api/report-widgets/`
- `/api/scheduled-reports/`

Scheduled report protected/read-only fields:

- `created_by`
- `last_run_at`
- `created_at`
- `updated_at`

Frontend rule: analytics event metadata is sanitized on output; do not depend on secrets or raw provider payloads being available.

## Response Contract Notes

- List endpoints generally use DRF pagination: `count`, `next`, `previous`, `results`.
- Some list endpoints add extra keys such as `facets`; frontend must preserve compatibility with extra response keys.
- Action endpoints usually return the updated entity or `{ entity, result }` style payload. Treat the returned payload as authoritative after action success.
- For state actions, update local UI from the action response rather than predicting status transitions client-side.

## Backend Maintenance Rules

- New serializers for CRM or operational modules must use explicit `Meta.fields`.
- New system/runtime/status fields must be either read-only or protected by a validation guard that returns `400` with `fields`.
- New lifecycle behavior must live in a service or action endpoint, not in frontend-only state transitions.
- Add behavioral tests for every protected-state bypass that could be attempted through generic create/update.
