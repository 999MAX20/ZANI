# API Action Contract

Last updated: 2026-07-23

Purpose: keep frontend and backend aligned on which fields are regular CRUD fields and which fields are state-machine fields that must only change through action endpoints/services.

This document is a working source of truth for CRM/frontend integration. If a field is listed as protected, frontend must not send it in generic `POST`, `PUT` or `PATCH` payloads. Backend serializers reject protected writes where the entity has a guarded state contract.

Current sync note 2026-07-16: refreshed against the current DRF router/actions for CRM, inbox, tasks, AI, onboarding, bot channels and integrations. Runtime code remains the final source of truth when this document and implementation differ.

## General Rules

- Use regular CRUD endpoints for editable descriptive fields: names, titles, notes, message text, schedule times, settings, owner/assignee where allowed.
- Use action endpoints for lifecycle, delivery, archive, runtime and billing state changes.
- Use `DELETE /api/<resource>/<id>/` for soft archive on archive-supported CRM resources, or `POST /api/<resource>/<id>/archive/` when the UI needs to pass a reason.
- Use `POST /api/<resource>/<id>/restore/` for restore. Restore is restricted to owner/admin-level permissions for critical CRM records.
- Do not write `created_at`, `updated_at`, `archived_at`, `archived_by`, system timestamps, runtime errors, provider payloads, delivery results or audit metadata from frontend.
- Treat `400` with `{ "fields": [...] }` as a contract violation: switch to the listed action endpoint instead of retrying the generic update.

## Error Envelope

All DRF error responses use this stable shape:

```json
{
  "code": "schedule_conflict",
  "request_id": "request-correlation-id",
  "detail": "The requested appointment time is not available.",
  "errors": {
    "start_at": "Select another available time."
  }
}
```

- `code` is the UI decision key. Do not branch on English `detail` text.
- `request_id` is safe to show in support UI and must be included in incident reports.
- `detail` is a safe user-facing fallback. Frontend localization may replace it by `code`.
- `errors` contains field/action context and is `{}` when no safe structured context exists.
- Existing serializer field keys can also remain at the top level for backward compatibility.

Stable domain codes:

| Code | HTTP | UI behavior |
| --- | ---: | --- |
| `validation_error` | 400 | Highlight fields from `errors`; do not retry unchanged input. |
| `authentication_required` | 401 | Start the login/session recovery flow. |
| `permission_denied` | 403 | Show a generic access message; do not reveal whether another tenant owns an object. |
| `module_disabled` | 403 | Offer module enablement only to users allowed to manage settings. |
| `not_found` | 404 | Show a generic missing/unavailable state. |
| `invalid_transition` | 409 | Refresh the entity and show the allowed next action. |
| `schedule_conflict` | 409 | Keep form data and ask the user to choose another slot. |
| `assignee_unavailable` | 409 | Keep the work item and ask for another assignee/fallback. |
| `idempotency_conflict` | 409 | Do not repeat the mutation with changed data under the same key. |
| `rate_limited` | 429 | Retry only after the server-provided wait window. |
| `provider_unavailable` | 503 | Preserve the draft and show provider-specific retry/status UI. |
| `temporary_service_failure` | 503 | Preserve user input and allow a bounded retry. |

`permission_denied` and `not_found` use sanitized details. Tenant names, object
ownership, credentials, provider payloads, and raw exception text must not be
included in the envelope.

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

- `PATCH /api/tasks/{id}/update-details/`
  - Use for editable task details while task is open/in-progress.
  - Allowed body: descriptive fields, due date, priority and valid related objects/assignee.
  - Backend writes audit/activity for changed fields.
- `POST /api/tasks/{id}/start/`
- `POST /api/tasks/{id}/complete/`
- `POST /api/tasks/{id}/cancel/`
  - Required body: `reason`.
- `POST /api/tasks/{id}/undo-cancel/`
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
- `DELETE /api/tasks/{id}/comments/{comment_id}/`
- `POST /api/tasks/{id}/archive/`
  - Optional body: `reason`.
- `POST /api/tasks/{id}/restore/`

Read/helper endpoints:

- `GET /api/tasks/summary/`
- `GET /api/tasks/templates/?business=<id>`
- `GET /api/tasks/workload/?business=<id>`

Frontend rule: use `update-details` for task detail edits that need audit/activity consistency. Use `templates` only to prefill a user-confirmed create/update form; templates do not create tasks by themselves.

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

## AI

Resources:

- `/api/ai/request-logs/`
- `/api/ai/knowledge-items/`
- `/api/ai/agent-profiles/`
- `/api/ai/approval-requests/`

AI action/helper endpoints:

- `GET /api/ai/assistant/status/`
  - Required query: `business`.
- `POST /api/ai/assistant/chat/`
  - Required body: `business`, `message`.
  - Returns answer, provider/mode metadata, `log_id` and CRM context summary.
- `GET /api/ai/analyst/brief/`
  - Required query: `business`.
- `GET /api/ai/owner-brief/daily/`
  - Required query: `business`.
- `POST /api/ai/tools/suggest/`
  - Required body: `business`.
  - Optional body: `conversation`, `message`.
- `POST /api/ai/tools/{log_id}/execute/`
  - Required body for approval-gated tools: `approval_id`.
- `POST /api/ai/approval-requests/{id}/approve/`
  - Optional body: `reason`.
- `POST /api/ai/approval-requests/{id}/reject/`
  - Optional body: `reason`.

Protected `ApprovalRequest` generic write fields:

- `status`
- `requested_by`
- `approved_by`
- `approved_at`
- `rejected_by`
- `rejected_at`

Frontend rule: AI can suggest actions, but critical mutating tools must be executed only through `tools/{log_id}/execute/` with a matching approved `ApprovalRequest` when the tool requires approval. Do not directly mutate CRM state from AI UI.

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

## Onboarding And Platform Setup

Onboarding action/helper endpoints:

- `GET /api/onboarding/templates/`
- `GET /api/onboarding/status/`
  - Required query: `business`.
- `POST /api/onboarding/apply-template/`
  - Required body: `business`, template identifier.
- `POST /api/onboarding/demo-data/`
  - Required body: `business`.
  - Only valid when demo merchant flows are enabled by environment.
- `POST /api/onboarding/setup-channel/`
  - Required body: `business`, channel/setup fields.
- `POST /api/onboarding/first-message/`
  - Required body: `business`.

Platform helper endpoint:

- `GET /api/platform/ping/`
- `GET /api/platform/overview/`
- `GET /api/platform/operations-health/`
- `GET /api/platform/merchants/`
- `GET /api/platform/merchants/{business_id}/`
- `POST /api/platform/merchants/{business_id}/support-actions/`
- `POST /api/platform/activate-landing/`

Platform frontend rule: platform operations endpoints are internal/support surfaces, not daily merchant CRM pages. Keep them out of role-scoped merchant navigation unless the user has platform-level access.

Frontend rule: onboarding may apply templates and demo/setup actions, but production merchant UI must clearly distinguish demo/mock flows from live business data.

## Conversations And Inbox

Primary CRM inbox resource:

- `/api/inbox/conversations/`
- `/api/bot-conversations/`

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
- `POST /api/inbox/conversations/{id}/create-appointment/`
  - Required body: `service`, `start_at`.
  - Optional body: `resource`, `notes`.
- `POST /api/inbox/conversations/{id}/qualify/`
  - Creates a no-mutation AI qualification preview for the latest conversation state.
- `POST /api/inbox/conversations/{id}/run-pipeline/`
- `POST /api/inbox/conversations/{id}/link-lead/`
- `POST /api/inbox/conversations/{id}/link-client/`
- `POST /api/inbox/conversations/{id}/create-client/`
- `POST /api/inbox/conversations/{id}/create-lead/`
- `POST /api/inbox/conversations/{id}/link-deal/`
- `POST /api/inbox/conversations/{id}/create-deal/`
- `POST /api/bot-conversations/{id}/suggest-reply/`

Frontend rule: inbox is action-heavy. Avoid mutating bot/conversation state directly from generic bot endpoints unless the UI is an admin settings screen. AI-driven `run-pipeline` must respect the backend confirmation policy; when the policy requires a fresh qualification preview, call `qualify` first and show the user what will happen before mutation.

## Integrations

Connector resources:

- `/api/business-connectors/`
- `/api/connector-credentials/`
- `/api/business-events/`
- `/api/connector-sync-runs/`
- `/api/integration-event-logs/`
- `/api/bot-channels/`

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
- `POST /api/business-connectors/{id}/connect/`
- `POST /api/business-connectors/{id}/disconnect/`
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
- `POST /api/connector-sync-runs/{id}/retry/`

Bot channel provider actions:

- `POST /api/bot-channels/{id}/telegram-config/`
- `POST /api/bot-channels/{id}/set-telegram-webhook/`
- `GET /api/bot-channels/{id}/telegram-status/`
- `POST /api/bot-channels/{id}/telegram-test-connection/`
- `POST /api/bot-channels/{id}/sync-telegram-updates/`
- `POST /api/bot-channels/{id}/whatsapp-config/`
- `POST /api/bot-channels/{id}/whatsapp-test-connection/`
- `GET /api/bot-channels/{id}/whatsapp-status/`
- `POST /api/bot-channels/{id}/instagram-config/`
- `POST /api/bot-channels/{id}/instagram-test-connection/`
- `GET /api/bot-channels/{id}/instagram-status/`

API token and webhook actions:

- `POST /api/api-tokens/{id}/rotate/`
- `POST /api/api-tokens/{id}/revoke/`
- `POST /api/webhook-endpoints/{id}/test-delivery/`
- `POST /api/webhook-deliveries/{id}/retry/`

Frontend rule: never display or store raw credential values after submission. Use masked values and connector/bot-channel status endpoints. Provider credentials belong in connector credential/provider service layers; UI should show safe status, setup state and recovery actions, not raw tokens, webhook secrets or provider payloads.

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
