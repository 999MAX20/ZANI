# ZANI Plan Index

Last cleaned: 2026-06-19

This folder contains planning documents and engineering rules that are still useful for implementation. Historical prompt packs and missing roadmap references must not be treated as source of truth.

## Current Source Of Truth

For all work, start with:

```text
../AGENTS.md
clean_code_rules/zani_required_clean_code_rules.md
```

For CRM backend/business logic production work:

```text
../CRM_PRODUCTION_LAYER_PLAN.md
../docs/PERMISSION_MATRIX.md
../docs/AI_ASSISTANT_RULES.md
../docs/automation-runtime.md
../docs/entitlements.md
```

For product/page readiness context:

```text
readiness_plan.md
```

For frontend UI/design work:

```text
../docs/design-system.md
ui_ux_design_system_reform.md
```

For production infrastructure and deployment:

```text
../docs/production-readiness.md
../docs/production-readiness-10000-audit.md
../docs/deployment.md
../docs/paid-beta-gate.md
```

For integrations and providers:

```text
../docs/CONNECTOR_BLUEPRINT.md
../docs/integrations.md
../docs/provider-rollout.md
```

For testing:

```text
../docs/testing.md
../docs/CODEX_TASK_TEMPLATE.md
```

## Active Documents In This Folder

### Product Readiness

```text
readiness_plan.md
```

Use for broad product readiness, page status, known gaps and prioritization context.

### UI / UX Reform

```text
ui_ux_design_system_reform.md
```

Use for frontend structure, CRM UI consistency, component reuse and visual cleanup direction.

### Clean Code Rules

```text
clean_code_rules/zani_required_clean_code_rules.md
```

Use as the engineering contract for implementation:

- reuse existing layers first;
- preserve tenant isolation;
- keep business logic out of bloated views;
- avoid frontend page monoliths;
- keep API clients/types separate from UI;
- test permissions and critical workflows.

## Removed Or Deprecated References

Do not reference these old paths unless they are recreated intentionally:

```text
plan/ZANI_MASTER_TECH_PLAN.md
plan/ZANI_PRODUCTION_HARDENING_ROADMAP.md
plan/ZANI_UI_REFERENCES_DEEP_ANALYSIS_26_05_UPDATED.md
plan/ZANI_UI_UX_PRODUCTION_MASTER_PLAN_26_05.md
plan/ui_ux_unification_tech_plan.md
plan/business_logic_implementation_plan.md
plan/auto_crm_pipeline_plan.md
plan/role_permissions_production_plan.md
```

Their current replacements are:

- CRM business logic: `../CRM_PRODUCTION_LAYER_PLAN.md`
- UI/design system: `../docs/design-system.md` and `ui_ux_design_system_reform.md`
- production/deployment: `../docs/production-readiness.md`, `../docs/deployment.md`, `../docs/paid-beta-gate.md`
- permissions: `../docs/PERMISSION_MATRIX.md`

## Working Rule

Read only the documents relevant to the task. If a doc points to a missing historical plan, do not chase it. Use `AGENTS.md` and this index to select the current document set.
