# ZANI Documentation Index

This folder is the single entry point for ZANI technical documentation.

[Root project status](../STATUS.md) is the owner-approved compact entry point
for recovering context in a new chat. It routes to existing checkpoints and
contracts; detailed technical documentation and evidence retain their owners.

## Current backend boundary and documentation status

- [Local CRM completion and clinic admission, 2026-09-21](pilot/local-crm-completion.md) — finite remaining business cycles, existing IDs/code, current verification and two acceptance boundaries; not automatic implementation authorization.
- [Backend development audit, 2026-09-14](pilot/backend-development-audit.md) — implemented vs WIP vs missing evidence; not a second task queue.
- [Backend open logic register](pilot/backend-open-logic-register.md) — canonical backend gap IDs.
- [Technical documentation audit](operations/technical-documentation-audit.md) — 105 source documents and archive decisions.
- [Archive manifest](../archive_docs/2026-09-14/README.md) — 26 historical/superseded records; not implementation authorization.
- [Active execution authority](../actual_docs/README.md) — pre-pilot, fallback and certification owners.

Use this index first when you need to understand where a document belongs. Keep new technical documentation inside the closest matching section instead of adding more root-level Markdown files.

## Core project rules

- `../AGENTS.md` — repository instructions for Codex and AI agents.
- `../plan/clean_code_rules/zani_required_clean_code_rules.md` — mandatory engineering rules.
- `../plan/README.md` — planning-folder index and deprecated plan references.

## Main sections

### Approved first paid release

- [V1 product rules](product/V1_PRODUCT_RULES.md) — owner-approved questionnaire decisions: dental administrative CRM, required channels, controlled AI, per-employee subscription and separately metered AI without a monetary cap. Defines target scope and open decisions, not implementation readiness. Read before interpreting older plans or the entity-behavior draft.

### CRM

Use `crm/` for current CRM domain plans and lifecycle rules. Completed checklists are historical evidence, not a second backlog.

- `crm/CRM_PRODUCTION_LAYER_PLAN.md`
- [Специалист и отсутствие](crm/specialist-scheduling.md) — индивидуальный график,
  разбор записей при форс-мажоре и отдельно желаемая рассылка клиентам.
- [CRM entity behavior contract](crm/CRM_ENTITY_BEHAVIOR_CONTRACT.md) — draft rules for entity relationships, lifecycles, AI boundaries and cross-product audit acceptance; proposals require approval.
- `crm/CRM_IMPLEMENTATION_TASKS.md` — archive redirect; completed checklist.
- `crm/CRM_AUDIT_REQUIRED_CHANGES.md` — archive redirect; closed audit.
- `crm/client-payments.md` — manual client payment journal, permissions and verification.

### Integrations

Use `integrations/` for connector architecture, provider rollout, marketplace/API onboarding, external channels and import connectors.

- `integrations/README.md`
- `integrations/CONNECTOR_BLUEPRINT.md`
- [Verified financial source contract](integrations/financial-source-contract.md)
- `integrations/integrations.md`
- `integrations/provider-rollout.md`
- `integrations/marketplace-integrations.md`
- `integrations/marketplace-onboarding-runbook.md`
- `integrations/marketplace-inventory-write-plan.md`

### Frontend

Use `frontend/` for UI architecture, design system, authenticated app UX and product UI reform.

- `frontend/design-system.md`
- `frontend/product-ui-reform.md`
- `frontend/ui-ux-implementation-standard.md`
- `frontend/ui-ux-polish-phase-10.md` — archive redirect; historical delivery.

### Production

Use `production/` for deployment, readiness, backups, monitoring, storage, Celery/Redis, paid beta and staging runbooks.

- `production/production-readiness.md`
- `production/production-readiness-10000-audit.md`
- `production/deployment.md`
- `production/paid-beta-gate.md`
- `production/staging/`

### Security

Use `security/` for permissions, rate limits and access-control documentation.

- `security/PERMISSION_MATRIX.md`
- `security/aud027-crm-projections.md` — bounded secondary-read correction, local snapshot and verification evidence; not integrated.
- `security/privileged-mfa.md`
- `security/rate-limits.md`

### Testing

Use `testing/` for test strategy, Codex task format, regression reports and scale/e2e baselines.

- `testing/testing.md`
- `testing/ui-testing-toolkit.md` — local component QA and guarded visual-service setup.
- `testing/CODEX_TASK_TEMPLATE.md`
- `testing/regression-report.md` — archive redirect; historical regression evidence.
- `testing/e2e-scale-baseline.md`

### Other focused sections

- `ai/` — AI assistant behavior and source-grounding rules.
- `analytics/` — analytics and reporting.
- `api/` — API action contracts.
- `architecture/` — cross-cutting architecture decisions.
- `auth/` — authentication and social login.
- `automation/` — automation runtime.
- `billing/` — entitlements and billing limits.
- `operations/` — platform/support operations.
- `pilot/` — current pilot contracts/runbooks and historical report redirects.
- `pilot/backend-open-logic-register.md` — active backend register for
  unimplemented, partial, environment-gated and roadmap behavior.
- `product/` — product positioning, landing and competitive notes.

## Documentation placement rule

When adding a new document:

1. Put it under the closest section in `docs/`.
2. Add it to the section README or this index if it is a long-lived source of truth.
3. Update `AGENTS.md` or `plan/README.md` only if future agents must read it before doing a class of work.
4. Do not create root-level Markdown plans unless they are repository instructions like `AGENTS.md` or the main `README.md`.
