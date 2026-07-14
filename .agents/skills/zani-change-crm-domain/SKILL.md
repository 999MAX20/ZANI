---
name: zani-change-crm-domain
description: Implement or review ZANI CRM business behavior through domain services, selectors, state machines, audit/activity, API contracts, frontend integration, and tests. Use when changing lead, deal, client, appointment, task, conversation, pipeline, owner, assignee, archive/restore, terminal status, or cross-entity lifecycle behavior.
---

# Change ZANI CRM Domain Behavior

Preserve ZANI as a simple, action-oriented multi-tenant CRM. Follow the repository's layer strategy instead of perfecting one page while business rules remain bypassable.

## Establish the change contract

1. Read `AGENTS.md`, the clean-code rules, `CRM_PRODUCTION_LAYER_PLAN.md`, `docs/PERMISSION_MATRIX.md`, `docs/AI_ASSISTANT_RULES.md`, `docs/automation-runtime.md`, and `docs/entitlements.md` as relevant.
2. State the business outcome, allowed scope, non-goals, affected roles, and acceptance criteria.
3. Record permission, notification, BusinessEvent, AI, migration, and environment impact before editing. Use [references/change-impact.md](references/change-impact.md).
4. Search models, services, selectors, state-machine helpers, permissions, serializers, views, frontend API clients, components, and tests for the existing flow.

## Implement through layers

1. Preserve domain invariants in services or state-machine helpers.
2. Keep complex reads and scoped query construction in selectors.
3. Keep views thin: validate, authorize, call the domain layer, and return the contract.
4. Never mutate lifecycle fields casually in a view or React component.
5. Validate same-Business relationships and active membership for owners, assignees, watchers, and responsible users.
6. Require reasons for lost lead or deal states and enforce appointment working-hour and overlap rules.
7. Write activity timeline entries for important CRM actions and audit logs for sensitive or destructive actions.
8. Emit or update BusinessEvent behavior where downstream automation, analytics, or AI depends on the action.
9. Keep provider-specific behavior behind connector/provider layers.

## Complete the user-facing flow

1. Define a stable API contract with explicit validation and forbidden states.
2. Use `frontend/src/api/*`; do not place raw requests in components.
3. Preserve role guards and loading, error, empty, and forbidden states.
4. Keep visible text in i18n and avoid decorative or explanatory authenticated-app blocks.
5. Make AI output source-grounded and require explicit approval for critical actions.

## Verify and close

Use `$zani-run-verification` to select the gate. Include happy path, permission denial, tenant isolation, and regression coverage where applicable. Update current plans or docs only after implementation and verification agree. Never mark a checklist item complete before its gate passes, and stop after the authorized phase.

Report files changed, checks run, checks skipped with reasons, migrations or environment changes, permission impact, notification impact, BusinessEvent or AI impact, and known risks.
