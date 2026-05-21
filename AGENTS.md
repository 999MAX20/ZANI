# AGENTS.md

This file defines how Codex/AI agents must work in the Zani repository.

## Source Of Truth

Read these files before non-trivial work:

1. `plan/ZANI_MASTER_TECH_PLAN.md`
2. `plan/clean_code_rules/zani_required_clean_code_rules.md`
3. `README.md`
4. Relevant app/frontend files for the task

For UI work, also read:

```text
plan/ui-ux/reference_analysis.md
```

For integrations/onboarding work, also read:

```text
plan/plan_20_05/zani_integration_onboarding_master_plan_20_05.md
```

## Core Product Direction

Zani is an AI-first CRM / Business OS for SMB.

Do not turn it into:

- a heavy ERP;
- a Bitrix-style admin maze;
- a developer console for merchants;
- a mock-only demo product.

Daily merchant workflows must stay simple, fast and role-aware.

## Non-Negotiable Engineering Rules

1. Tenant isolation is mandatory.
   Every merchant entity must be scoped to `Business` or safely derive business access from related objects.

2. Backend permissions are mandatory.
   Frontend hiding is not security.

3. Do not put business logic in views.
   Use services/selectors/providers/tasks where the logic belongs.

4. Do not put raw API calls in React components.
   Use `frontend/src/api/*`.

5. Do not expose provider tokens or secrets.
   Use env/config and masked serializers.

6. Do not hard-delete critical CRM data by default.
   Prefer archive/restore with audit.

7. Provider-specific code must stay behind provider/connector layers.
   CRM logic must not depend directly on WhatsApp/Telegram/Meta/OpenAI implementations.

8. Do not create duplicate models/endpoints/components before searching existing layers.

9. Do not mark foundation work as complete without user-facing flow, permissions and tests where applicable.

10. Keep AI optional and controlled.
    AI may summarize, suggest and assist. Critical changes need explicit user confirmation.

## Required Checks

Run after meaningful backend/frontend changes:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

If migrations are intentionally added:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py migrate
```

## Documentation Rule

After each completed phase or meaningful feature:

- update `README.md` when behavior/setup changes;
- update relevant docs in `docs/`;
- update plan/status notes if the roadmap changes.

## Work Style

- One bounded task at a time.
- Inspect before editing.
- Preserve unrelated user changes.
- Never revert work you did not make unless explicitly requested.
- If checks fail, fix the current task before starting another one.
- Prefer small, composable services/components over large God files.

## Immediate Roadmap

Follow:

```text
plan/ZANI_MASTER_TECH_PLAN.md
```

Current recommended next phase:

```text
Phase 1 — Production Readiness Baseline
```
