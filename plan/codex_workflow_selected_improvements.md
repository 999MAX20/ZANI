# Selected Codex Workflow Improvements For ZANI

Дата: 2026-05-28

Источник анализа: `plan/codex_zani_upgrade`

Цель этого документа: выбрать только те улучшения workflow, которые сейчас реально помогут реформе ZANI, а не распылить работу на большой wishlist.

## Текущий статус

В проекте уже есть несколько важных основ:

- `AGENTS.md` в корне проекта с правилами работы Codex.
- Папка `docs/` с документацией по интеграциям, production readiness, monitoring, testing, deployment, design system и другим зонам.
- GitHub repo подключен к Codex.
- GitHub Actions CI уже есть в `.github/workflows/ci.yml`.
- Frontend build уже включает `check:i18n`, TypeScript build, Vite build и widget build.
- Playwright уже установлен и есть `frontend/playwright.config.ts`.
- Есть `plan/readiness_plan.md`, который мы используем как основной production readiness ledger.

Значит, сейчас не нужно начинать с нуля. Нужно усилить рабочий процесс вокруг уже существующей базы.

## 1. Перейти на правило: одна задача = одна ветка = один PR

### Почему это важно

За последние сутки изменения стали большими: AI pipeline, integrations, notifications, outreach, pricing, settings, frontend screens. Когда всё пушится напрямую в `main`, сложнее понять:

- какая задача сломала сборку;
- какие файлы относятся к конкретному изменению;
- что нужно ревьюить;
- что можно откатить без риска.

### Как внедрить

Для каждой новой крупной задачи:

1. Создавать ветку от актуального `main`.
2. Делать только один логически связанный блок работ.
3. Запускать проверки.
4. Пушить ветку.
5. Создавать PR в `main`.

Пример веток:

- `feature/chat-notification-routing`
- `feature/integrations-setup-wizard`
- `feature/ai-analyst-business-events`
- `fix/conversations-unread-reset`

### Definition of Done

PR считается готовым только если:

- CI зеленый;
- локальные проверки прошли;
- в PR есть короткое описание;
- перечислены измененные бизнес-зоны;
- указаны ручные проверки;
- нет unrelated файлов.

## 2. Добавить единый backend/frontend verify workflow

### Почему это важно

Сейчас проверки запускаются вручную разными командами. Это нормально для опытного разработчика, но для Codex workflow лучше иметь одну каноническую команду, которую агент запускает перед коммитом или PR.

### Что сделать

Добавить скрипт уровня репозитория, например:

```bash
scripts/codex_verify.sh
```

Команда должна выполнять минимум:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
.venv/bin/python manage.py test
cd frontend && npm run build
```

Позже можно расширить:

- security dependency audit;
- smoke runtime checks;
- Playwright e2e;
- connector readiness checks.

### Правило для Codex

Перед коммитом/PR Codex должен запускать `scripts/codex_verify.sh`, если задача затрагивает backend или frontend. Если задача маленькая, можно запускать scoped tests, но в PR summary нужно явно написать, какие проверки были выполнены.

## 3. Создать шаблоны задач для Codex

### Почему это важно

Много проблем возникало не из-за кода, а из-за слишком широких промптов: “реализуй 1000 строк задач” приводило к перегруженным страницам, лишним блокам и разрозненной логике.

Шаблоны задач помогают держать Codex в узком коридоре.

### Что создать

Файл:

```text
docs/CODEX_TASK_TEMPLATE.md
```

Минимальные шаблоны:

- Изучи проект без изменений.
- Реализуй frontend page.
- Добавь API endpoint.
- Сделай safe refactor.
- Добавь tests.
- Проверь UX flow.
- Подготовь PR summary.
- Проверь security/roles.
- Проверь integration readiness.

### Что должен содержать каждый шаблон

- Цель задачи.
- Страницы/модули, которые можно менять.
- Файлы, которые нельзя трогать.
- Какие бизнес-правила сохранить.
- Какие роли проверить.
- Какие команды запустить.
- Что написать в финальном отчете.

### Практическое правило

Если задача больше одной страницы или одного API flow, сначала разбивать ее на этапы. Codex реализует текущий этап, а не весь roadmap сразу.

## 4. Усилить `AGENTS.md` актуальными ZANI-правилами

### Почему это важно

`AGENTS.md` уже есть и полезен, но его нужно привести к текущей продуктовой формуле ZANI после реформы:

ZANI - это CRM foundation + AI business control layer, а не ERP и не Bitrix-like кабинет.

### Что добавить

1. Lightweight integrations:
   - не строить full ERP/full sync;
   - собирать только business-critical события;
   - все внешние данные нормализовать в `BusinessEvent`;
   - merchant не должен видеть техническую сложность.

2. UI/UX rules:
   - страницы должны быть рабочими инструментами, а не презентацией;
   - никаких лишних маркетинговых блоков;
   - основная информация и действия должны быть видны сразу;
   - mobile-first, но desktop должен быть плотным и удобным для работы.

3. AI rules:
   - AI не должен выдумывать данные;
   - AI должен ссылаться на реальные события/источники;
   - критичные действия требуют подтверждения роли с правами;
   - автодействия должны быть настраиваемыми и наблюдаемыми.

4. PR rules:
   - не пушить крупные задачи напрямую в `main`;
   - один PR = одна бизнес-задача;
   - в PR summary указывать проверки и риски.

## 5. Описать Connector Blueprint

### Почему это важно

Интеграции - ядро будущего AI-аналитика. Сейчас есть Telegram, WhatsApp, Instagram, Kaspi, MoySklad, Ozon, Wildberries и другие направления. Без единого blueprint каждая интеграция будет расти по-своему.

### Что создать

Файл:

```text
docs/CONNECTOR_BLUEPRINT.md
```

### Что описать

Каждый connector должен иметь:

- UI card на странице `Подключения`;
- setup modal/wizard;
- masked credentials;
- health check;
- connection status;
- last sync;
- error state;
- retry action;
- webhook/sync entrypoint;
- normalizer в `BusinessEvent`;
- role-based permissions;
- audit trail для важных действий.

### Принцип ZANI

Интеграция должна выглядеть для merchant так:

```text
Нажал Подключить -> авторизовался/вставил нужный ключ -> ZANI проверил -> появились события/данные/рекомендации.
```

Технические ключи, webhooks и ошибки должны быть спрятаны в понятный setup/help flow.

## 6. Описать AI Assistant / AI Analyst Rules

### Почему это важно

AI Analyst должен стать главным отличием ZANI. Но без правил он легко превратится в “чат с красивым текстом”, который не связан с реальными бизнес-данными.

### Что создать

Файл:

```text
docs/AI_ASSISTANT_RULES.md
```

### Что описать

AI Analyst может:

- читать `BusinessEvent`;
- цитировать источники;
- находить проблемы;
- предлагать действия;
- объяснять владельцу бизнес-ситуацию простым языком;
- готовить drafts для сообщений;
- подсвечивать риски по продажам, складу, записям и интеграциям.

AI Analyst не может:

- выдумывать продажи, остатки, клиентов или записи;
- выполнять критичные действия без подтверждения;
- показывать данные не той роли;
- раскрывать токены, ключи, внутренние webhook details;
- заменять audit trail.

### Особое правило

Каждая рекомендация AI должна быть связана с одним из источников:

- conversation;
- lead;
- deal;
- appointment;
- order;
- stock event;
- connector health event;
- outreach campaign;
- pricing event.

## 7. Создать минимальный UI component preview вместо полного Storybook

### Почему это важно

Storybook полезен, но сейчас может отвлечь. Быстрее сделать внутреннюю preview-страницу для ключевых компонентов, чтобы Codex и человек видели единый стиль.

### Что сделать сначала

Создать internal route только для dev/staging, например:

```text
/dashboard/dev/ui-kit
```

Показать там:

- Button;
- Input;
- Select;
- Modal;
- Badge;
- Tabs;
- Card;
- EmptyState;
- LoadingState;
- ErrorState;
- IntegrationCard;
- AIInsightCard;
- StatCard;

### Польза

Это снизит риск, что каждая новая страница будет иметь свои карточки, фильтры, кнопки и модалки.

## 8. Ввести обязательные UX checks после изменения страниц

### Почему это важно

Главная проблема старых страниц была не в том, что “не было компонентов”, а в том, что страницы не выполняли рабочую задачу пользователя.

### Минимальный checklist для UI-задач

После изменения страницы Codex должен проверить:

- есть ли понятный primary action;
- не дублируются ли действия;
- не перегружена ли страница;
- есть ли empty/loading/error states;
- все ли фильтры выглядят в стиле проекта;
- не ломается ли mobile;
- не появляется ли горизонтальный scroll;
- sidebar/header/bottom-nav не конфликтуют;
- role restrictions не исчезли;
- тексты не выглядят как marketing filler.

### Техническая проверка

Для больших UI-изменений запускать:

```bash
cd frontend && npm run build
```

Для критичных экранов дополнительно:

```bash
cd frontend && npm run e2e
```

или Browser/Playwright-проверка конкретного URL.

## 9. Сделать seed/demo data для стабильной проверки

### Почему это важно

UI и бизнес-логики нельзя нормально проверять на случайных локальных данных. Для CRM нужны стабильные сценарии:

- владелец;
- менеджер;
- клиент;
- lead;
- deal;
- appointment;
- conversation;
- integration event;
- BusinessEvent;
- notification.

### Что сделать

Создать management command:

```bash
python manage.py seed_demo_business
```

Она должна создавать:

- demo business;
- owner user;
- manager user;
- 5-10 clients;
- leads/deals в разных статусах;
- conversations с unread/read состояниями;
- appointments с разными датами;
- connector statuses;
- BusinessEvents для AI Analyst.

### Польза

Codex сможет проверять UI и workflow не “на пустой базе”, а на понятной демо-картине бизнеса.

## 10. Добавить role/permission matrix как обязательный reference

### Почему это важно

Мы уже добавляем уведомления, рассылки, интеграции, AI-действия и pricing. Все это зависит от ролей. Ошибка в ролях может быть хуже, чем визуальный баг.

### Что создать

Файл:

```text
docs/PERMISSION_MATRIX.md
```

### Минимальные роли

- platform_admin;
- platform_manager;
- business_owner;
- manager;
- employee;
- support.

### Что описать

Для каждой зоны:

- кто видит страницу;
- кто может создать;
- кто может редактировать;
- кто может запускать действие;
- кто получает уведомление;
- кто видит AI-рекомендации;
- кто может подключать paid/advanced services.

Зоны:

- conversations;
- leads;
- deals;
- clients;
- appointments;
- integrations;
- outreach;
- pricing;
- AI analyst;
- settings;
- notifications.

## 11. Ввести production-readiness scan перед крупными merge

### Почему это важно

`readiness_plan.md` уже работает как ledger, но нужен повторяемый scan перед крупными PR.

### Что проверять

- migrations есть и применяются;
- новые env vars добавлены в `.env.example`;
- роли проверены;
- tokens masked;
- нет логирования секретов;
- notifications не спамят владельца/директора без правил;
- BusinessEvents создаются для важных действий;
- AI не выполняет критичные действия без confirmation;
- UI states есть;
- docs/readiness обновлены.

### Формат результата

В PR summary добавлять:

```text
Production readiness:
- Migrations: yes/no
- Env vars: yes/no
- Permissions: checked/not applicable
- Notifications: checked/not applicable
- BusinessEvents: checked/not applicable
- AI actions: safe/not applicable
- Manual checks: ...
```

## 12. Что пока отложить

Эти пункты полезны, но не являются первыми для текущего этапа:

- Полный Storybook. Сначала хватит UI preview page.
- Figma MCP. Нужен, когда появятся стабильные Figma-макеты ZANI.
- Sentry MCP. Сначала нужно стабилизировать staging/prod observability.
- Supabase/Postgres MCP. Полезен позже, но сейчас Django models/migrations достаточно для локальной разработки.
- Полная генерация frontend types из OpenAPI. Хорошая цель, но сначала нужно стабилизировать API контракты.
- Большой набор custom Codex Skills. Сначала достаточно усилить `AGENTS.md` и `docs/CODEX_TASK_TEMPLATE.md`.

## Рекомендуемый порядок внедрения

1. Перейти на branch/PR workflow для всех новых крупных задач.
2. Добавить `scripts/codex_verify.sh`.
3. Создать `docs/CODEX_TASK_TEMPLATE.md`.
4. Обновить `AGENTS.md` правилами PR, lightweight integrations и AI safety.
5. Создать `docs/CONNECTOR_BLUEPRINT.md`.
6. Создать `docs/AI_ASSISTANT_RULES.md`.
7. Создать `docs/PERMISSION_MATRIX.md`.
8. Добавить seed/demo data command.
9. Сделать internal UI kit preview page.
10. Включить production-readiness scan в каждый крупный PR.

## Главный принцип

Workflow должен помогать быстрее доводить ZANI до боевого продукта, а не создавать новую бюрократию.

Поэтому внедряем только те правила, которые:

- уменьшают хаос в задачах;
- защищают бизнес-логику;
- защищают роли и данные;
- делают UI стабильнее;
- помогают Codex проверять результат;
- ускоряют PR/review/debug cycle.
