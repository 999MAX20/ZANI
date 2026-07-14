# Permission Matrix

This file is the working reference for role-aware behavior in ZANI.

## Roles

- `platform_admin`: manages the platform and all operational tooling.
- `platform_manager`: supports merchants with limited platform operations.
- `business_owner`: owns a merchant workspace and business settings.
- `manager`: handles clients, conversations, leads, deals and appointments.
- `employee`: performs assigned operational work with limited access.
- `support`: helps troubleshoot with explicit grants and audit requirements.

## Principles

- Backend permissions are mandatory. Frontend hiding is not security.
- Every merchant entity must be scoped to `Business`.
- Role checks must happen before state-changing actions.
- Support access should be explicit, limited and auditable.
- AI must follow the same role restrictions as the user who invokes it.

## Page And Action Matrix

| Area | View | Create/Edit | Critical Actions | Notifications |
| --- | --- | --- | --- | --- |
| Dashboard | business_owner, manager, employee scoped | business_owner for settings widgets | business_owner | role-scoped alerts |
| Conversations | business_owner, manager, assigned employee | manager, assigned employee | send, close, assign, AI pipeline require allowed role | managers/employees, not owner by default |
| Leads | business_owner, manager | business_owner, manager | convert/link/assign | assigned manager |
| Deals | business_owner, manager | business_owner, manager | won/lost, value changes, pipeline move | owner for high-value/risk, manager for assigned |
| Clients | business_owner, manager | business_owner, manager | merge/delete/archive require owner or explicit permission | assigned manager |
| Appointments | business_owner, manager, assigned employee | business_owner, manager | book/reschedule/cancel/no-show/complete; cancel and no-show require reason | lead responsible user, actor or owner; direct resource employee requires future Resource -> User mapping |
| Tasks | business_owner, manager, assigned employee | business_owner, manager | lifecycle, assign, watch and comment require backend `tasks:update`; cancel requires reason; task links may point to client, lead, deal, appointment or conversation; overdue work queues expose backend watch/escalate/critical metadata; workload view is `tasks:view` gated and tenant-scoped | assigned task notifications target the active assignee; unassigned tasks route to manager/admin/operator roles with owner fallback; normal task notifications respect preferences, high/urgent bypass them |
| Integrations | business_owner, platform_admin, support with grant | business_owner, platform_admin | connect/disconnect/rotate token, health check, failed sync retry | owner/admin/support by event |
| Outreach | business_owner, manager with permission | business_owner, authorized manager | launch campaign, bulk import | campaign owner and approved operators |
| Pricing | business_owner, authorized manager | business_owner, authorized manager | autopilot/write price | owner and pricing operator |
| AI Analyst | business_owner, manager scoped | n/a | execute suggestions requires underlying permission | same as source events |
| Settings | business_owner | business_owner | roles, billing, automations | owner/admin |
| Automations | business_owner, authorized manager with `automations:view` | business_owner or `automations:create/update` | retry/cancel/manage runs require `automations:manage`; actions execute through domain services | routed by the action service, not by the automation engine directly |
| Platform Operations | platform_admin, platform_manager | platform_admin | support grants, merchant ops | platform team |

## Notification Rules

- Directors/owners should not receive every chat message by default.
- Managers and assigned employees should receive unread conversation notifications.
- Owners should receive escalations, business risks, connector failures and high-value events.
- Support should receive notifications only for granted support sessions or platform incidents.
- Notification preferences must be business-scoped and role-aware.

## AI Action Permission Rules

AI can only perform or suggest actions within the user's permissions.

Examples:

- A manager can request reply drafts and CRM pipeline suggestions for assigned conversations.
- A manager cannot connect integrations unless granted.
- An employee cannot launch outreach campaigns unless explicitly allowed.
- An owner can approve automation settings, connector setup and campaign launch.
- Platform support cannot inspect merchant data without a support grant.
- Critical mutating AI tool execution must have both backend execute permission and a matching approved `ApprovalRequest` for the exact tool call.

## Automation Permission Rules

- Automation rule and run queries must be scoped to the current business.
- Run retry and cancel endpoints require `automations:manage`.
- Automation-created CRM changes must use the same domain services as user actions.
- Automation action targets must resolve to same-business entities before mutation.
- Assignee, owner and manager assignment actions must validate active business membership.
- Automation notification actions must route through notification services so role preferences and owner fallback stay centralized.

## Integration Permission Rules

- Connector, BusinessEvent, IntegrationEventLog and ConnectorSyncRun reads must stay business-scoped.
- Connector health checks and `POST /api/connector-sync-runs/{id}/retry/` require `integrations:manage`.
- Users without `integrations:view` may receive a tenant-safe 404 for sync-run detail/retry before the manage check is reached.
- Integration retries must not perform provider write-back; only failed health checks and read-only pull/manual sync runs are safe to retry.

## Review Checklist For New Features

Before merging a feature that touches business state:

- Is every query scoped to business/access?
- Are serializers masking sensitive fields?
- Are state-changing endpoints protected by backend permissions?
- Are notifications routed by role?
- Does AI follow the same permission boundary?
- Are tests covering forbidden access?
- Is audit or BusinessEvent output needed?
