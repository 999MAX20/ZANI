# Access review checklist

## Surface map

- List every affected model and its direct or derived `Business` path.
- List roles allowed to read, create, update, archive, restore, delete, export, or run custom actions.
- Identify platform, support, automation, and background-job access separately.

## Query and object checks

- Scope list and detail querysets before object lookup.
- Avoid unscoped `.objects.all()`, `.get(pk=...)`, bulk IDs, or related-object lookup in merchant APIs.
- Scope search, autocomplete, counts, aggregates, exports, and workload endpoints.
- Validate request-supplied foreign keys against the current Business.
- Validate owners, assignees, watchers, and responsible users as active members.
- Validate stage and pipeline ownership together.
- Recheck scope inside service entry points used outside HTTP views.
- Carry Business identity in task payloads and re-resolve records safely.

## Mutation checks

- Enforce permissions before calling the service.
- Route lifecycle transitions through the domain service or state machine.
- Prevent mass assignment of protected ownership, role, status, and audit fields.
- Prefer archive/restore for critical CRM data.
- Write audit records for destructive or sensitive operations.
- Keep failed cross-tenant lookups non-enumerable.

## Minimum tests

- Allowed role succeeds within its Business.
- Disallowed role receives the intended denial.
- A member of Business A cannot read or mutate Business B data.
- A request cannot attach a Business B related object to Business A data.
- Bulk and custom actions remain scoped.
- Background or automation entry points preserve tenant context.
- Existing allowed behavior has regression coverage when extended.

## Review output

- Report only confirmed vulnerabilities as findings.
- Give each finding a severity, affected path, evidence, impact, and minimal remediation.
- Separate missing evidence and hardening suggestions from confirmed defects.
