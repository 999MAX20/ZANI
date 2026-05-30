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
| Appointments | business_owner, manager, assigned employee | business_owner, manager | book/reschedule/cancel | assigned manager/employee |
| Tasks | business_owner, manager, assigned employee | business_owner, manager | overdue/escalation | assignee and manager |
| Integrations | business_owner, platform_admin, support with grant | business_owner, platform_admin | connect/disconnect/rotate token | owner/admin/support by event |
| Outreach | business_owner, manager with permission | business_owner, authorized manager | launch campaign, bulk import | campaign owner and approved operators |
| Pricing | business_owner, authorized manager | business_owner, authorized manager | autopilot/write price | owner and pricing operator |
| AI Analyst | business_owner, manager scoped | n/a | execute suggestions requires underlying permission | same as source events |
| Settings | business_owner | business_owner | roles, billing, automations | owner/admin |
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

## Review Checklist For New Features

Before merging a feature that touches business state:

- Is every query scoped to business/access?
- Are serializers masking sensitive fields?
- Are state-changing endpoints protected by backend permissions?
- Are notifications routed by role?
- Does AI follow the same permission boundary?
- Are tests covering forbidden access?
- Is audit or BusinessEvent output needed?
