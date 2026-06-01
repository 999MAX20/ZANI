# ZANI Role Permissions Production Plan

Last updated: 2026-06-01

## Implementation Status

Status after the 2026-06-01 implementation pass:

- `Done`: frontend permission resolution now uses active business membership and `effective_permissions` instead of trusting global merchant roles.
- `Done`: shared frontend `PermissionGate` exists and route protection now uses it.
- `Done`: UI labels show backend `admin` as `Директор` / `Director`.
- `Done`: Settings data queries are permission-aware and do not fetch team/billing/audit/settings data when the role lacks access.
- `Done`: true backend `TEAM` scope filters records by users in the current user's teams instead of returning the whole business.
- `Done`: AI permission resources are in the backend permission catalog.
- `Done`: AI assistant, AI analyst, AI tool suggestion/execution, inbox AI reply, and conversation CRM pipeline actions enforce role permissions on the backend.
- `Done`: AI-related routes/buttons are guarded in the frontend.
- `Done`: basic approval queue foundation exists through `ApprovalRequest`.
- `Done`: sensitive deal fields are masked for low-access roles.
- `Done`: targeted backend tests and frontend build pass.

Remaining production hardening:

- Expand field-level privacy beyond `Deal.amount`, `currency`, `notes`, and `lost_reason`.
- Wire `ApprovalRequest` execution into campaign launch, automatic CRM pipeline activation, appointment changes, exports, and bulk automation.
- Add owner/director approval inbox UI.
- Add explicit `RecordAccess` model for manual per-record sharing.
- Add full audit UI and retention policy for role/security events.
- Add browser E2E checks for every role surface.

## Purpose

This document defines the technical plan for bringing ZANI role logic to a production-ready CRM level.

Target result:

```text
Every employee sees only the pages, records, actions, AI tools, notifications, and sensitive fields that match their role inside a merchant business.
```

Production readiness target after this plan:

```text
80-85% ready for first SMB production release
```

Remaining enterprise-level work after that:

- advanced org hierarchy;
- manual record sharing;
- complex approval chains;
- deep field-level security;
- full compliance-grade audit policies.

## Current State

Current implementation is a strong base, but not yet a complete production access model.

Already implemented:

- Global user roles in `apps/accounts/models.py`.
- Per-business roles in `BusinessMember`.
- Custom business roles via `BusinessRole` and `RolePermission`.
- Permission matrix in `apps/businesses/access.py`.
- Backend enforcement through `TenantModelViewSet`.
- `effective_permissions` in `/api/auth/me/`.
- Sidebar visibility based on permissions.
- Role-aware dashboards.
- Role-aware notifications for chat and operational events.
- Outreach restrictions by role.

Main current weakness:

```text
Permissions, visibility, UI access, AI actions, and sensitive data rules are not separated enough.
```

## Target Access Model

ZANI should use four layers of role logic.

```text
BusinessMember.role
→ PermissionPolicy: what the user can do
→ VisibilityPolicy: which records the user can see
→ FieldPolicy: which sensitive fields the user can see
→ AIActionPolicy: which AI/automation actions the user can run or approve
```

This keeps the CRM flexible:

- a manager can edit own deals but only view team deals;
- an operator can answer conversations but not see revenue analytics;
- a marketer can launch approved campaigns but not manage billing;
- a director can control employees and reports without receiving every chat alert;
- an owner can see and manage everything.

## Target Roles

### Owner

Business owner. Full access.

Must be able to:

- manage business settings;
- manage billing;
- manage employees and roles;
- see all records;
- manage integrations;
- approve high-risk AI and automation actions;
- view audit logs;
- override blocked operations.

Must not receive routine chat notifications by default.

### Director

Operational business director.

Implementation note:

```text
Backend role can remain `admin`, but UI should display it as `Директор`.
```

Must be able to:

- see all CRM records;
- manage team members except the owner;
- view analytics;
- manage integrations;
- manage automations;
- approve campaigns and AI actions;
- review audit logs.

Should not manage billing unless explicitly allowed by custom permission.

### Manager

Sales or service manager.

Must be able to:

- work with assigned leads and deals;
- see assigned clients;
- create tasks and appointments;
- answer conversations assigned to them;
- use AI suggestions;
- create draft CRM actions from conversations.

Should not:

- manage billing;
- edit role settings;
- launch mass campaigns without approval;
- see full company-wide financial analytics unless allowed.

### Operator

Chat operator or front desk employee.

Must be able to:

- answer assigned conversations;
- create or update client contact information;
- create lead draft from a conversation;
- schedule appointments if allowed;
- use AI answer drafts.

Should not:

- close deals as won/lost unless allowed;
- launch campaigns;
- see sensitive financial fields;
- manage integrations;
- manage employees.

### Marketer

Campaign and communication role.

Must be able to:

- prepare outreach campaigns;
- manage campaign templates;
- view audience segments allowed by policy;
- view campaign analytics;
- request approval for campaign launch.

Should not:

- manage sales deals;
- see sensitive client notes unless needed;
- manage billing;
- change CRM pipeline settings without permission.

### Accountant

Finance observer.

Must be able to:

- see invoices/payments/revenue exports when implemented;
- view financial reports;
- export financial records if allowed.

Should not:

- manage conversations;
- change deals;
- launch campaigns;
- manage integrations.

### Support

Customer support role.

Must be able to:

- work with assigned conversations;
- view client history;
- create tasks;
- escalate to manager or director.

Should not:

- edit deals and revenue fields;
- launch campaigns;
- manage settings.

## Implementation Phases

## Phase 1. Stabilize Existing Role Checks

Goal:

```text
Remove over-permission risk and make frontend behavior match backend behavior.
```

Tasks:

- Audit `frontend/src/lib/permissions.ts`.
- Change `hasPermission` to prefer active business membership and `effective_permissions`.
- Avoid granting full access from global `user.role` when the user is inside a specific business context.
- Keep platform roles separate from merchant business roles.
- Add tests for:
  - owner access;
  - director/admin access;
  - manager limited access;
  - operator limited access;
  - user with global role but no active membership.

Backend checks:

- Confirm `TenantModelViewSet` is used by all sensitive CRM endpoints.
- Identify endpoints that bypass tenant permission checks.
- Add `assert_can` where business mutation happens outside `TenantModelViewSet`.

Frontend checks:

- Sidebar and mobile nav should hide unavailable sections.
- Buttons should be disabled or hidden based on permission.
- Forbidden pages should show a clean blocked state, not crash or silently load empty data.

Definition of done:

- Frontend never gives access that backend rejects in normal flows.
- Backend still remains the final authority.
- A user without membership cannot operate inside a business.

## Phase 2. Director Role UX

Goal:

```text
Make roles understandable for merchants without risky database renaming.
```

Tasks:

- Display backend `admin` role as `Директор` in the UI.
- Keep backend value `admin` for compatibility.
- Update role labels in:
  - team/member settings;
  - invites;
  - user profile surfaces;
  - permissions screens;
  - dashboard badges;
  - notification routing labels.
- Add helper:

```text
formatBusinessRole(role)
```

Recommended labels:

```text
owner → Владелец
admin → Директор
manager → Менеджер
operator → Оператор чатов
marketer → Маркетолог
accountant → Бухгалтер
support → Поддержка
staff → Сотрудник
```

Definition of done:

- Merchant never sees unclear `admin` naming in product UI.
- Existing backend, permissions, tests, and migrations stay stable.

## Phase 3. PermissionGate And Route Protection

Goal:

```text
Every role-restricted UI block should use one predictable access component.
```

Tasks:

- Add shared frontend component:

```text
frontend/src/components/auth/PermissionGate.tsx
```

Required behavior:

- Accept `resource`, `action`, optional `fallback`, optional `mode`.
- Support `hide`, `disable`, and `forbidden` modes.
- Read permissions from active business membership.
- Avoid duplicated role checks inside page components.

Example API:

```tsx
<PermissionGate resource="deals" action="create" mode="hide">
  <Button>Создать сделку</Button>
</PermissionGate>
```

Apply it to:

- CRM action buttons;
- outreach launch buttons;
- integration settings buttons;
- automation buttons;
- analytics exports;
- team management controls;
- billing controls;
- AI action buttons.

Definition of done:

- Main pages do not manually duplicate access logic.
- Restricted buttons are either hidden, disabled with reason, or replaced by a proper forbidden state.

## Phase 4. True Visibility Scopes

Goal:

```text
Separate action permission from record visibility.
```

Current problem:

```text
TEAM scope is too close to BUSINESS scope.
```

Target scopes:

```text
OWN: records assigned to or created by current user
TEAM: records owned by users in current user's team
BUSINESS: all records in the business
```

Backend tasks:

- Extend `scope_queryset` in `apps/businesses/access.py`.
- Use `Team` and `TeamMember` to resolve team user ids.
- Apply scope to models with fields like:
  - `owner`;
  - `assigned_to`;
  - `responsible`;
  - `created_by`;
  - `manager`;
  - `operator`.
- Add fallback behavior per model when no ownership field exists.
- Avoid leaking business-wide data for team-scoped roles.

Tests:

- Manager with `OWN` sees only own deals.
- Team lead with `TEAM` sees team deals.
- Operator with `OWN` sees assigned conversations only.
- Director with `BUSINESS` sees all records.
- Owner sees all records.

Definition of done:

- Visibility scopes work consistently across clients, leads, deals, tasks, appointments, and conversations.

## Phase 5. Role-Aware Settings

Goal:

```text
Settings page must become permission-aware, not one large page for everyone.
```

Settings sections:

- Business profile;
- Team and roles;
- Billing;
- Integrations;
- Automations;
- AI settings;
- Notifications;
- Security/audit;
- Developer/API keys.

Tasks:

- Define required permission for every settings section.
- Hide sections unavailable to the current user.
- Prevent data fetching for unavailable sections.
- Add direct route guard if settings are split into tabs/routes.
- Add clean empty/blocked states.

Recommended access:

```text
Owner: all settings
Director: team, integrations, automations, AI settings, audit, notifications
Manager: own notifications, limited workflow settings
Operator: own notifications only
Marketer: campaign/outreach settings, templates
Accountant: billing/finance if allowed
```

Definition of done:

- Operator cannot accidentally see billing or developer settings.
- Manager cannot mutate team roles.
- Director can run business operations without owner-only billing exposure.

## Phase 6. AI Permissions

Goal:

```text
AI should help employees, but risky AI actions must be controlled by role.
```

Add AI permission resources:

```text
ai_assistant
ai_analyst
ai_pipeline
ai_outreach
ai_automation
```

Suggested actions:

```text
view
suggest
execute
approve
manage
```

Role rules:

- Owner:
  - can manage all AI;
  - can approve high-risk actions.
- Director:
  - can manage operational AI;
  - can approve campaigns and automation actions.
- Manager:
  - can use AI reply suggestions;
  - can run conversation qualification;
  - can create draft deal/lead/task actions.
- Operator:
  - can generate AI reply drafts;
  - can run qualification only as draft if allowed.
- Marketer:
  - can generate campaign drafts;
  - can request campaign approval.

High-risk AI actions:

- auto-send client message;
- launch mass campaign;
- change deal stage automatically;
- mark deal won/lost;
- apply discount;
- cancel or move appointment;
- export client list;
- change automation settings.

Backend tasks:

- Add AI resources to permission catalog.
- Add `assert_can` before AI mutation endpoints.
- Log every AI action in `AIToolCallLog`.
- Store:
  - actor;
  - business;
  - role;
  - action;
  - source objects;
  - AI confidence;
  - before/after values;
  - approval status.

Frontend tasks:

- Disable AI action buttons if user lacks permission.
- Show “requires approval” state for risky actions.
- Make AI recommendations explain source and required permission.

Definition of done:

- AI can suggest broadly, but cannot silently perform risky business changes without role permission or approval.

## Phase 7. Approval Queue

Goal:

```text
Important AI and automation actions should be reviewable before execution.
```

Recommended model:

```text
ApprovalRequest
```

Suggested fields:

```text
business
requested_by
required_role
action_type
payload
source_object_type
source_object_id
ai_request_log
status
approved_by
approved_at
rejected_by
rejected_at
reason
created_at
expires_at
```

Approval actions:

- approve;
- reject;
- request changes;
- expire;
- execute after approval.

Initial use cases:

- campaign launch;
- automatic CRM pipeline mode activation;
- AI-generated bulk client action;
- risky appointment changes;
- mass notification sending.

Notifications:

- Owner/director receives approval request.
- Requester receives approved/rejected result.
- Routine directors can opt out of noisy operational notifications, but approval notifications stay enabled.

Definition of done:

- Risky AI/automation work has a human approval path.
- Approval decisions are auditable.

## Phase 8. Field-Level Privacy

Goal:

```text
Sensitive CRM fields should not be visible to every employee.
```

Sensitive fields:

- revenue;
- margin;
- discount;
- payment status;
- internal notes;
- client private notes;
- source acquisition cost;
- API keys/tokens;
- full phone/email if masking is needed;
- exportable client data.

Backend tasks:

- Add field policy helper:

```text
can_view_field(user, business, resource, field)
```

- Mask fields in serializers based on policy.
- Never rely only on frontend hiding.
- Add tests for sensitive fields by role.

Frontend tasks:

- Render masked values cleanly:

```text
••••••
Недоступно для роли
```

- Avoid showing sensitive summaries if all fields are masked.

Recommended first implementation:

- Hide revenue analytics from operators/support.
- Hide integration tokens from everyone except owner/director.
- Hide billing from non-owner unless custom permission allows.
- Hide campaign export from non-marketer/non-director/non-owner.

Definition of done:

- Role-limited users cannot see sensitive fields via API or UI.

## Phase 9. Record Sharing And Ownership

Goal:

```text
CRM records should support clean assignment and transfer rules.
```

Tasks:

- Standardize ownership fields across core models.
- Define who can assign records:
  - owner/director: anyone;
  - manager: own/team depending scope;
  - operator: cannot reassign unless allowed.
- Add transfer audit event.
- Add optional per-record shared access later:

```text
RecordAccess
```

Suggested fields:

```text
business
resource_type
resource_id
user
access_level
granted_by
created_at
expires_at
```

Initial use cases:

- manager shares client with support;
- director temporarily gives access to deal;
- operator escalates conversation to manager.

Definition of done:

- Assignment and visibility rules do not conflict.
- Escalation is controlled and auditable.

## Phase 10. Audit Trail

Goal:

```text
Every important permission, role, AI, and data access event should be traceable.
```

Audit events:

- role changed;
- member invited;
- member deactivated;
- permission changed;
- business setting changed;
- integration token changed;
- AI action executed;
- campaign launched;
- export started;
- record reassigned;
- sensitive field exported;
- approval approved/rejected.

Tasks:

- Ensure existing audit/business event system captures these events.
- Add audit list in settings for owner/director.
- Add filtering:
  - actor;
  - event type;
  - date;
  - resource.
- Add retention plan for production.

Definition of done:

- Owner/director can answer: who changed what, when, and why.

## Phase 11. Tests And Verification

Backend test matrix:

```text
owner
director/admin
manager
operator
marketer
accountant
support
staff
no membership
```

Test every role against:

- clients;
- leads;
- deals;
- conversations;
- appointments;
- tasks;
- analytics;
- integrations;
- automations;
- outreach;
- AI actions;
- settings;
- notifications.

Frontend verification:

- Sidebar visibility per role.
- Main page access per role.
- Button visibility per role.
- Forbidden states.
- Notification behavior.
- AI buttons and approval states.

Required commands:

```bash
python manage.py test apps.businesses apps.accounts apps.conversations apps.notifications apps.outreach apps.ai_core
npm run build
```

Recommended browser checks:

- owner can see all admin surfaces;
- director can operate business but not owner-only billing if restricted;
- manager sees working CRM tools;
- operator sees conversations/tasks only;
- marketer sees outreach tools;
- accountant sees finance-only surfaces when implemented.

## Rollout Order

Recommended implementation order:

1. Stabilize frontend/backend permission mismatch.
2. Rename `admin` to `Директор` in UI labels.
3. Add `PermissionGate`.
4. Make Settings permission-aware.
5. Fix true `TEAM` visibility scope.
6. Add AI permission resources.
7. Add approval queue for risky AI/automation actions.
8. Add field-level privacy for the most sensitive fields.
9. Add record sharing and assignment audit.
10. Expand audit trail.
11. Add full role matrix tests.

## Production Readiness Checklist

Minimum required before first production release:

- [x] Backend rejects forbidden actions for core CRM and AI endpoints.
- [x] Frontend hides or disables key unavailable actions.
- [x] Sidebar and route access match backend permissions for main resources.
- [x] `admin` is shown as `Директор` in UI.
- [ ] Owner and director access are clearly separated.
- [x] Manager/operator cannot access billing/team management through guarded API/UI data fetching.
- [ ] Outreach launch is role-protected.
- [x] AI actions are role-protected.
- [x] Risky AI actions have an approval model foundation and explicit permission checks.
- [ ] Chat notifications respect roles.
- [x] Team scope does not leak all business records in covered querysets.
- [x] Sensitive deal fields are masked for low-access roles.
- [x] Role changes and AI approval/tool actions are auditable at model/API level.
- [x] Backend tests cover the role matrix for implemented scope/AI/privacy rules.
- [x] Frontend build passes.
- [ ] Main role flows verified in browser.

## Expected Result

After completing this plan, ZANI role logic should be strong enough for the first production version of an SMB CRM:

```text
Expected readiness: 80-85%
```

What this means:

- Safe enough for real merchants with small and medium teams.
- Clear enough for owner/director/manager/operator workflows.
- Strong enough to prevent most accidental data exposure.
- Ready for AI-assisted workflows with controlled approvals.
- Not yet full enterprise access control like Salesforce or HubSpot Enterprise.
