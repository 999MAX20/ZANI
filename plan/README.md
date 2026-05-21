# Zani Plan Workspace

Эта папка содержит актуальные технические планы и архив старых документов.

## Главный актуальный техплан

```text
plan/ZANI_MASTER_TECH_PLAN.md
```

Назначение:

- единый source of truth по текущему направлению проекта;
- актуальная roadmap после выполнения prompts 13.05;
- production-readiness путь к 10 000 мерчантов;
- integration/onboarding стратегия 20.05;
- Definition of Done;
- порядок дальнейшей работы.

## Обязательные supporting documents

### 1. Clean code / architecture rules

```text
plan/clean_code_rules/zani_required_clean_code_rules.md
```

Назначение:

- источник правды по архитектурным правилам Codex для Zani;
- tenant isolation, permissions, audit и provider-first подход;
- правила декомпозиции backend/frontend;
- обязательный Definition of Done для новых задач.

### 2. UI/UX reference analysis

```text
plan/ui-ux/reference_analysis.md
```

Назначение:

- направление визуального и UX-развития;
- правила для dashboard, sidebar, inbox, kanban, calendar, CRM card, mobile UX;
- использовать перед frontend/UI задачами.

### 3. Integration/onboarding plan

```text
plan/plan_20_05/zani_integration_onboarding_master_plan_20_05.md
```

Назначение:

- invisible integrations;
- event-first connector architecture;
- AI-native progressive onboarding;
- business capability based integrations UX.

## Исторические планы

```text
plan/teh plan 13.05.md
plan/zani_execution_prompts_from_13_05.md
```

Статус: выполнены как основная очередь prompts 01-30 и больше не являются главным execution-source.

Оставлены как историческая детализация по уже реализованным CRM-модулям.

## Правила выполнения

- Выполнять только один prompt за раз.
- Перед началом читать `plan/ZANI_MASTER_TECH_PLAN.md`.
- Для интеграций читать `plan/plan_20_05/zani_integration_onboarding_master_plan_20_05.md`.
- Для UI читать `plan/ui-ux/reference_analysis.md`.
- Не переходить к следующему prompt, пока текущий не прошёл проверки.
- Если проверки упали, остановиться и исправить текущий этап.
- После каждого этапа обновлять README/docs.
- Не считать `Foundation` или `MVP` завершённой фичей без минимального UI, workflow, permissions и проверок.
- Соблюдать `plan/clean_code_rules/zani_required_clean_code_rules.md` как обязательный clean-code contract.
- Соблюдать корневой `AGENTS.md` как рабочий контракт для Codex/AI agents.

## Обязательные проверки

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

Если добавлены миграции:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py migrate
```

## Архив

Старые и исходные документы лежат в:

```text
plan/archive/
```

Они нужны как история рассуждений и источники, но не являются текущими execution-plan файлами.
