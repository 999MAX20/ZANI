# AGENTS.md

This file defines how Codex/AI agents must work in the Zani repository.

## Current Source Of Truth

Before non-trivial work, read only the documents that are relevant to the task. Do not follow references to missing historical plan files.

Required for all work:

1. `AGENTS.md`
2. `plan/clean_code_rules/zani_required_clean_code_rules.md`
3. Relevant app/frontend files for the task

For CRM business logic work:

```text
CRM_PRODUCTION_LAYER_PLAN.md
docs/PERMISSION_MATRIX.md
docs/AI_ASSISTANT_RULES.md
docs/automation-runtime.md
docs/entitlements.md
```

For frontend UI work:

```text
docs/design-system.md
plan/ui_ux_design_system_reform.md
```

For integrations:

```text
docs/CONNECTOR_BLUEPRINT.md
docs/integrations.md
docs/provider-rollout.md
```

For production infrastructure:

```text
docs/production-readiness.md
docs/production-readiness-10000-audit.md
docs/deployment.md
docs/paid-beta-gate.md
```

For testing and task format:

```text
docs/testing.md
docs/CODEX_TASK_TEMPLATE.md
```

## Product Direction

Zani is an AI-first CRM and business control layer for SMB.

Do not turn it into:

- a heavy ERP;
- a full-sync data warehouse;
- a Bitrix-style admin maze;
- a developer console for merchants;
- a mock-only demo product.

Daily merchant workflows must stay simple, fast, role-aware and action-oriented.

## Current CRM Production Strategy

For CRM production work, use `CRM_PRODUCTION_LAYER_PLAN.md`.

The current implementation strategy is layer-based, not page-based:

```text
domain invariants -> state machines -> audit/activity -> API contracts -> frontend integration -> E2E flows
```

Do not make one page perfect while backend business rules remain bypassable.

## Non-Negotiable Engineering Rules

1. Tenant isolation is mandatory.
   Every merchant entity must be scoped to `Business` or safely derive business access from related objects.

2. Backend permissions are mandatory.
   Frontend hiding is not security.

3. Business logic must live in services/selectors/state-machine helpers, not in bloated views.
   Views should accept request, validate serializer, check permissions, call service, return response.

4. CRM lifecycle changes must go through domain services.
   Do not casually mutate `status`, `stage`, `won_at`, `lost_at`, `completed_at`, `archived_at`, `responsible_user`, `owner`, or `assignee` in views or frontend.

5. Do not put raw API calls in React components.
   Use `frontend/src/api/*`.

6. Do not expose provider tokens or secrets.
   Use env/config, encrypted credentials and masked serializers.

7. Do not hard-delete critical CRM data by default.
   Prefer archive/restore with audit. Merge/delete flows must be traceable.

8. Provider-specific code must stay behind provider/connector layers.
   CRM logic must not depend directly on WhatsApp/Telegram/Meta/OpenAI implementations.

9. Do not create duplicate models/endpoints/components before searching existing layers.

10. Do not mark foundation work as complete without user-facing flow, permissions and tests where applicable.

11. Keep AI optional and controlled.
    AI may summarize, suggest and assist. Critical changes need explicit user confirmation.

12. AI must be source-grounded.
    AI analyst and assistant output must cite real entities/events or clearly say that data is missing.

13. Merchant setup must hide technical complexity.
    Connector keys, webhook details and provider errors should live in setup/help flows, not dominate daily UI.

## CRM Domain Rules

For any CRM business action, preserve these invariants:

- all related entities belong to the same `Business`;
- assignees, owners, watchers and responsible users are active business members;
- stage belongs to the deal pipeline and business;
- terminal deal status changes only through deal service actions;
- lost lead/deal requires a reason;
- appointment booking/rescheduling respects working hours and overlap rules;
- important CRM actions write activity timeline;
- sensitive/destructive actions write audit logs;
- role restrictions are enforced on the backend;
- frontend-only validation is never enough.

## Required Checks

Run after meaningful backend/frontend changes:

```bash
scripts/codex_verify.sh
```

For narrow backend CRM changes, scoped checks are acceptable:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
.venv/bin/python -m pytest apps.clients.tests apps.leads.tests_forms apps.crm.tests apps.scheduling.tests apps.tasks.tests apps.core.tests_tenant_isolation -q
```

For frontend changes:

```bash
cd frontend && npm run build
```

If migrations are intentionally added:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py migrate
```

Final responses and PR summaries must list exactly what was run and what was skipped.

## Task Completion Gate

For checklist-driven work such as `CRM_IMPLEMENTATION_TASKS.md`, Codex must not mark a task as complete until the relevant implementation and verification are both done.

Rules:

- A checkbox may be changed to `[x]` only after the task's required test gate has passed.
- For every completed task, record or report exactly what checks were run and what was skipped with the reason.
- Before starting a task, identify the affected areas when relevant:
  - permissions impact;
  - notification impact;
  - BusinessEvent impact;
  - AI impact;
  - migration/env impact.
- If tests fail because of a pre-existing or unrelated baseline issue, do not hide it. Record it as a baseline failure and do not mark the current task complete unless the task's own acceptance criteria are still provably satisfied.
- If `.git` is missing, the branch/PR rule is temporarily not executable locally. State that explicitly in summaries instead of pretending a branch or PR exists.
- If a task is user-facing, it is not complete without a reachable UI/API flow, not only backend foundation code.
- If a task changes CRM lifecycle behavior, the verification must include happy path, permission denial and tenant isolation coverage where applicable.

## Phase Execution Stop Gate

For phase-based checklist work, one completed phase is the default stopping point.

Rules:

- Codex may complete all checklist items inside the current or next named phase in one assistant run, but must stop after that phase is implemented, verified, documented and marked complete.
- A user message like "continue" or "продолжай" authorizes only the current/next phase. It expires after that phase is complete.
- Codex must not automatically start the next phase after closing the current phase unless the latest user message explicitly requested multi-phase autonomous work.
- Within a phase, Codex may mark multiple checkboxes `[x]`, but each checkbox still requires its own implementation and relevant verification gate before being marked complete.
- After completing a phase, Codex must stop and report:
  - which phase was completed;
  - which checklist items were completed inside the phase;
  - what changed;
  - checks run;
  - checks skipped and why;
  - known risks or baseline failures;
  - the next unchecked phase or next unfinished item.
- If work on one phase runs longer than 60 minutes, Codex must provide a checkpoint summary and continue the same phase unless the user asks to stop.
- If the conversation resumes after context compaction, treat the current user message as the active authorization boundary. Do not infer permission to continue multiple old phases from earlier "continue" messages.

## Documentation Rule

After a completed phase or meaningful behavior change:

- update `CRM_PRODUCTION_LAYER_PLAN.md` if CRM production scope/status changes;
- update relevant docs in `docs/`;
- update `README.md` only when setup, behavior, or public project status changes;
- do not add new historical roadmap files when one current plan can be updated.

## Work Style

- One bounded task at a time.
- Inspect before editing.
- Preserve unrelated user changes.
- Never revert work you did not make unless explicitly requested.
- If checks fail, fix the current task before starting another one.
- Prefer small services/selectors/components over large God files.
- Do not mix unrelated UI, backend, integration and docs changes in the same PR unless the task explicitly requires the full workflow.

## Pull Request Rule

For feature or production-hardening work:

```text
one task = one branch = one PR
```

Every PR summary should include:

- business areas changed;
- checks run;
- migration/env changes;
- permission impact;
- notification impact;
- BusinessEvent/AI impact;
- manual checks and known risks.

## UI Content Rule

Codex must not create decorative, marketing, demo, motivational, or explanatory UI blocks unless explicitly required.

Every visible block on an authenticated Zani page must have a clear product purpose:

1. navigation;
2. KPI / metric;
3. real business data;
4. action button;
5. form;
6. table/list/entity card;
7. chart/analytics;
8. integration status;
9. empty state with a real next action;
10. system notification or alert.

Do not invent static Russian text for pages. Visible text must come from:

- the task prompt;
- existing page structure;
- approved copy/content map;
- i18n/constants file;
- real API/data model fields.

Inside the authenticated app, dashboard pages must not explain what Zani is. They must show business state, actions, metrics, tasks, leads, deals, alerts, integrations and AI recommendations.

Before finishing any UI task, check:

- Did I add static headline or paragraph text that was not requested?
- Does every new block have a real business function?
- Is this block connected to data, action, navigation, empty state, or setting?
- Would this look like fake demo/landing content inside a real SaaS cabinet?

If the answer is no, remove the block.
