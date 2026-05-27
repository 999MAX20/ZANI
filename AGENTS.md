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
plan/ZANI_UI_REFERENCES_DEEP_ANALYSIS_26_05_UPDATED.md
plan/ZANI_UI_UX_PRODUCTION_MASTER_PLAN_26_05.md
references/
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
DATABASE_URL=sqlite:///db.sqlite3 \
SECURE_SSL_REDIRECT=False \
SESSION_COOKIE_SECURE=False \
CSRF_COOKIE_SECURE=False \
REDIS_URL=memory:// \
CELERY_TASK_ALWAYS_EAGER=True \
CELERY_TASK_STORE_EAGER_RESULT=False \
AUTOMATIONS_RUN_INLINE=True \
.venv/bin/python manage.py test
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
plan/ZANI_PRODUCTION_HARDENING_ROADMAP.md
```

Current status:

```text
Core/pilot master-plan scope is complete.
Production hardening H1-H9 is code/docs ready.
```

Next work should focus on:

- provisioning and verifying real staging/production dependencies;
- keeping paid-beta gates red until Redis/Celery, object storage, Sentry, email, backups, support grants and smoke/E2E checks are green;
- small reliability/security fixes discovered during local or deployed smoke;
- UI/UX polish only when it reduces merchant/operator confusion.

# ZANI UI CONTENT RULE — NO FILLER / NO FAKE MARKETING BLOCKS

Codex must NOT create decorative, marketing, demo, motivational, or explanatory UI blocks unless they are explicitly required in the task specification.

Forbidden examples:
- "ZANI E2E DEMO"
- "Бизнес под контролем"
- "Все заявки, записи и задачи собраны в одной рабочей панели"
- "Полный контроль владельца"
- "Доступны деньги, команда, подключения, аналитика и настройки бизнеса"
- Any similar generic blocks, banners, cards, slogans, badges, empty promo sections, or artificial explanations.

Every visible block on a ZANI page must have a clear product purpose:
1. Navigation
2. KPI / metric
3. Real business data
4. Action button
5. Form
6. Table/list/entity card
7. Chart/analytics
8. Integration status
9. Empty state with a real next action
10. System notification or alert

Codex must not invent static Russian text for pages.
All visible page text must come only from:
- the current task prompt;
- existing page structure;
- approved ZANI copy/content map;
- i18n/constants file;
- real API/data model fields.

If the task does not provide exact text, Codex must use neutral functional labels only, for example:
- "Заявки"
- "Сделки"
- "Клиенты"
- "Задачи"
- "Подключения"
- "Аналитика"
- "Настройки"

Inside the authenticated ZANI app, the interface is NOT a marketing landing page.
Dashboard pages must not explain what ZANI is.
They must show business state, actions, metrics, tasks, leads, deals, alerts, integrations, and AI recommendations.

Before finishing any UI task, Codex must check:
- Did I add any static headline or paragraph that was not requested?
- Does every new card/block have a real business function?
- Is this block connected to data, action, navigation, empty state, or setting?
- Would this text look like fake demo/landing content inside a real SaaS cabinet?

If the answer is no, Codex must remove the block.

IMPORTANT UI RULE:
Do not add any extra marketing/demo/filler blocks or invented Russian text.
Only implement the requested functional UI.
If a block does not display data, action, navigation, setting, status, or a real empty state — do not create it.
