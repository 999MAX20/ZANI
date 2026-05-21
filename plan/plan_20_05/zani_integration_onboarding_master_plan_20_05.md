# Zani Integration & Onboarding Master Plan — 20.05

Источник:

- `plan/plan_20_05/tehpan_20_05_1`
- `plan/plan_20_05/teh_plan_20_05_2`

Назначение документа: объединить продуктовую и техническую модель интеграций Zani в один рабочий план реализации. Этот план не заменяет общий `teh plan 13.05.md`, а добавляет отдельное стратегическое направление: invisible integrations, AI-native onboarding и event-first connector architecture.

## 1. Главная Идея

Zani не должен ощущаться как сложная CRM, ERP или проект внедрения.

Пользователь не должен:

- разбираться в API;
- вручную копировать токены;
- настраивать webhooks;
- общаться с интеграторами;
- ждать недели внедрения;
- понимать техническую архитектуру внешних систем.

Пользователь должен видеть понятные бизнес-действия:

- `Подключить WhatsApp`;
- `Подключить Instagram`;
- `Подключить Kaspi`;
- `Подключить МойСклад`;
- `Включить AI-ответы`;
- `Показывать продажи в realtime`;
- `Получать вечерний AI-отчет`;
- `Включить AI-мониторинг конкурентов`.

Главная формула:

```text
integration must feel invisible
```

Мы продаем не “интеграции”, а включение новых возможностей бизнеса.

## 2. Позиционирование

Рынок интеграций часто работает по enterprise-модели:

- созвоны;
- аудит инфраструктуры;
- выяснение систем клиента;
- ручная настройка;
- интеграторы;
- долгий onboarding;
- высокая стоимость поддержки;
- недели внедрения.

Zani должен работать иначе:

- merchant нажимает кнопку;
- проходит простой auth flow;
- onboarding agent валидирует доступ;
- connector запускает sync/webhooks;
- CRM автоматически получает рабочую структуру;
- AI объясняет результат понятным языком.

Цель: value в первый день, полное подключение бизнеса постепенно.

## 3. Архитектурный Принцип

Zani не должен становиться дублем 1С, МойСклад, Poster, Kaspi, CRM или ERP клиента.

Мы не строим тяжелую ERP-синхронизацию и не копируем всю базу бизнеса.

Мы строим:

```text
AI visibility layer + CRM action layer + event-first integration layer
```

Zani получает только те данные и события, которые нужны для:

- CRM-действий;
- AI-аналитики;
- операционного контроля;
- коммуникаций;
- уведомлений;
- автоматизаций;
- отчетов владельцу.

## 4. Event-First Model

Главная техническая сущность интеграций — не внешняя таблица, а business event.

Примеры событий:

- `sale_completed`;
- `lead_created`;
- `message_received`;
- `inventory_low`;
- `employee_response_slow`;
- `competitor_price_changed`;
- `campaign_performance_drop`;
- `appointment_created`;
- `payment_received`;
- `order_cancelled`;
- `refund_created`.

Все внешние системы должны приводиться к unified event format.

Пример:

```json
{
  "type": "sale_completed",
  "source": "kaspi",
  "external_id": "order_123",
  "amount": 125000,
  "currency": "KZT",
  "employee": "manager_1",
  "occurred_at": "2026-05-20T12:00:00+05:00",
  "payload": {}
}
```

## 5. Две Модели Получения Данных

### Model A — Webhook Mode

Идеальный вариант.

Внешняя система сама отправляет события в Zani:

```text
Kaspi / Poster / Telegram / WhatsApp / CRM
→ webhook
→ Zani Event Bus
→ normalization
→ CRM / analytics / AI / notifications
```

Преимущества:

- realtime;
- низкая нагрузка;
- нет постоянного polling;
- проще масштабировать;
- быстро реагируют AI и CRM.

### Model B — Pull / Sync Mode

Если webhooks недоступны, connector периодически запрашивает данные:

```text
Zani connector
→ GET /orders
→ GET /inventory
→ GET /employees
→ normalize into business events
```

Частота sync должна быть настраиваемой:

- 5 минут;
- 15 минут;
- 1 час;
- nightly sync;
- manual sync.

Важно: даже pull/sync результат должен превращаться в unified business events, а не в хаотичное копирование внешней базы.

## 6. User Flow Интеграции

1. Merchant открывает страницу подключений.
2. Видит не технические integration cards, а business capability cards.
3. Нажимает кнопку, например `Подключить Kaspi`.
4. Проходит понятный authorization flow:
   - OAuth;
   - QR auth;
   - login-based auth;
   - partner API authorization;
   - lightweight local connector для сложных локальных систем.
5. Zani получает access credentials.
6. Onboarding agent:
   - проверяет permissions;
   - валидирует доступ;
   - создает connector;
   - сохраняет encrypted tokens;
   - запускает webhook/sync;
   - определяет schema;
   - создает pipelines/stages/labels;
   - включает monitoring;
   - включает AI summaries;
   - создает alerts;
   - предлагает следующие шаги.
7. Merchant получает human-readable результат:

```text
Kaspi подключен.
AI monitoring активирован.
Обнаружено:
3 менеджера
124 товара
2 канала продаж
```

## 7. Progressive Onboarding

Zani не должен просить подключить всё сразу.

Сценарий первого дня:

- CRM;
- WhatsApp/Telegram;
- AI Inbox;
- AI summaries;
- базовые заявки и клиенты.

Дальше AI предлагает следующее действие по контексту:

- `Чтобы видеть остатки — подключите МойСклад`;
- `Чтобы видеть рекламу — подключите Instagram`;
- `Чтобы видеть продажи Kaspi — подключите marketplace`;
- `Чтобы AI отвечал клиентам — включите AI support`;
- `Чтобы видеть эффективность сотрудников — подключите телефонию`.

Onboarding становится не painful setup, а постепенным раскрытием ценности.

## 8. Системы Для Подключения

### Communications

- WhatsApp;
- Instagram;
- Telegram;
- Email;
- телефония;
- website chat.

### Marketplace / Ecommerce

- Kaspi;
- Wildberries;
- Ozon;
- Shopify;
- интернет-магазины;
- ecommerce CMS.

### Inventory / CRM / ERP-lite

- МойСклад;
- 1С;
- Poster;
- POS systems;
- ERP-lite systems;
- vertical CRM systems.

### Vertical Systems

- ресторанные POS;
- медицинские CRM;
- beauty/salon CRM;
- фитнес CRM;
- образовательные CRM;
- гостиничные системы;
- logistics/delivery systems;
- service CRM.

## 9. Lightweight Connector Для Сложных Систем

Для старых 1С, локальных ERP и on-prem систем нужен отдельный Zani Connector.

Это маленький desktop/service agent, который:

- устанавливается у клиента;
- подключается к локальной базе/API;
- читает только нужные operational signals;
- отправляет events в Zani;
- не раскрывает пользователю сложную техническую настройку;
- имеет health status и self-diagnostics.

На раннем этапе connector не должен быть приоритетнее cloud integrations. Его нужно проектировать как V2/V3 направление.

## 10. Что Должен Видеть Пользователь

Пользователь не видит:

- API;
- токены;
- webhook URLs;
- technical scopes;
- provider payloads;
- очереди;
- retry policy.

Пользователь видит:

- понятный статус подключения;
- бизнес-возможность;
- что уже работает;
- что требует внимания;
- что Zani нашел автоматически;
- что можно включить дальше.

Пример UI cards:

- `AI-ответы клиентам`
- `Продажи Kaspi в realtime`
- `Остатки и предупреждения`
- `Вечерний отчет владельцу`
- `Скорость ответов менеджеров`
- `AI-мониторинг рекламы`

## 11. Backend Architecture

### 11.1. Integration Connector Layer

Нужны доменные модели/слои:

- `ConnectorProvider`;
- `BusinessConnector`;
- `ConnectorCredential`;
- `ConnectorCapability`;
- `ConnectorSyncRun`;
- `ConnectorHealthCheck`;
- `ConnectorEventMapping`.

Правило: provider-specific logic не должен попадать в CRM views.

Все провайдеры идут через:

```text
provider registry
→ provider adapter
→ connector service
→ event normalizer
→ event bus
```

### 11.2. Credentials

Токены должны:

- храниться encrypted at rest;
- не возвращаться во frontend;
- иметь masked display;
- иметь rotation/reconnect flow;
- иметь audit trail;
- иметь scope/permission validation.

Минимум для MVP:

- field-level encryption или отдельный encrypted JSON;
- masked serializer;
- audit при создании/обновлении/отключении;
- permission `integrations.manage`.

### 11.3. Event Bus

Нужна единая модель события:

- `BusinessEvent`;
- `event_type`;
- `business`;
- `source`;
- `source_connector`;
- `external_id`;
- `occurred_at`;
- `processed_at`;
- `payload`;
- `deduplication_key`;
- `status`;
- `error_message`.

Event Bus должен поддерживать:

- idempotency;
- deduplication;
- retry;
- replay;
- processing logs;
- routing в analytics/CRM/AI/notifications/automations.

### 11.4. Sync Runtime

Webhook events обрабатываются быстро, тяжелая работа уходит в Celery.

Очереди:

- `integrations_webhooks`;
- `integrations_sync`;
- `automations`;
- `notifications`;
- `ai`;
- `webhooks_outbound`.

Для pull/sync:

- scheduled jobs;
- manual sync;
- sync locks;
- rate limit per connector;
- incremental cursors;
- last successful sync.

### 11.5. Health And Monitoring

Каждый connector должен иметь:

- `connected`;
- `needs_attention`;
- `syncing`;
- `failed`;
- `disabled`;
- `expired_credentials`.

Нужно показывать:

- последний sync;
- последнюю ошибку;
- next retry;
- provider latency;
- количество полученных events;
- количество failed events.

## 12. Frontend Architecture

### 12.1. Integrations UX

Frontend должен показывать не технический список API, а catalog business capabilities.

Страницы:

- `/dashboard/integrations`
- `/dashboard/integrations/:connector`
- `/dashboard/onboarding`
- `/dashboard/integration-health`

Разделы:

- Recommended for your business;
- Connected;
- Needs attention;
- Available capabilities;
- AI suggested next setup;
- Connection history.

### 12.2. Connect Flow

Компоненты:

- `IntegrationCatalogPage`;
- `IntegrationCapabilityCard`;
- `ConnectorSetupDrawer`;
- `ConnectorStatusBadge`;
- `ConnectorHealthPanel`;
- `ConnectorActivityTimeline`;
- `ReconnectConnectorButton`;
- `ProgressiveOnboardingChecklist`.

UI должен говорить на языке бизнеса:

- плохо: `OAuth scopes missing`;
- хорошо: `Нет доступа к заказам. Подключите разрешение “Продажи”.`

### 12.3. Progressive Suggestions

AI/logic layer должен предлагать следующий шаг:

- based on business type;
- based on missing data;
- based on connected channels;
- based on owner goals;
- based on failed/slow workflows.

## 13. AI Onboarding Agents

На старте мы не строим собственное сложное AI-agent ядро.

Используем:

- существующие LLM providers;
- Codex/GPT/OpenRouter/OpenAI по необходимости;
- provider-specific runtime;
- Celery jobs;
- строгие service boundaries.

AI onboarding agent на MVP может быть rule-based + LLM-assisted:

- checklist generator;
- schema summary;
- next-best-setup suggestion;
- connection issue explanation;
- evening business summary.

Не делать сейчас:

- автономных агентов без ограничений;
- AI, который сам меняет критичные настройки без подтверждения;
- скрытое выполнение опасных действий;
- vendor lock-in на конкретную AI API.

## 14. Приоритеты Реализации

### Phase 1 — Integration Foundation Hardening

Цель: подготовить текущий integrations layer к production-like connector architecture.

Must build:

- unified connector models;
- encrypted credential storage;
- provider registry hardening;
- connector health status;
- integration activity timeline;
- idempotent inbound event model;
- Celery queue boundaries for integration jobs;
- tests for permissions, tenant isolation, token masking, idempotency.

Do not:

- подключать все реальные провайдеры сразу;
- хранить raw tokens в открытом виде;
- показывать технические токены merchant user;
- дублировать CRM logic в provider adapters.

Acceptance:

- owner видит подключенные/доступные capabilities;
- operator без прав не управляет integrations;
- connector может быть connected/failed/needs_attention;
- webhook/pull events нормализуются в один формат;
- backend tests зеленые;
- frontend build зеленый.

### Phase 2 — Communication-First Onboarding

Цель: дать merchant value в первый день через CRM + communication channel + AI inbox.

Must build:

- simplified connect flow for Telegram/WhatsApp mock/provider;
- website chat as first stable channel;
- AI inbox summary placeholder/rule-based summary;
- onboarding checklist by business type;
- connection success screen;
- failed connection recovery UX.

Do not:

- начинать с тяжелой 1С/Kaspi интеграции;
- строить сложный marketplace data layer раньше communication flow;
- заставлять пользователя видеть raw provider config.

Acceptance:

- merchant может подключить первый канал за понятный flow;
- CRM получает messages/leads/events;
- inbox показывает источник;
- owner видит результат подключения;
- есть audit/integration log.

### Phase 3 — Marketplace / Operational Signals MVP

Цель: начать получать продажи, заказы, остатки и revenue-события без тяжелого ERP-дублирования.

Must build:

- generic marketplace connector interface;
- event types for sales/orders/inventory;
- sync cursor;
- manual sync;
- nightly sync;
- operational dashboard widgets;
- AI evening summary from events.

Do not:

- копировать полный каталог товаров без необходимости;
- строить data warehouse;
- смешивать external IDs между tenants;
- делать provider-specific dashboard.

Acceptance:

- connector sends/loads sale events;
- duplicate events do not double-count revenue;
- dashboard shows simple operational signals;
- owner получает понятное summary.

### Phase 4 — Progressive Onboarding Engine

Цель: Zani сам предлагает следующие подключения и настройки.

Must build:

- onboarding recommendation service;
- business-type based recommendations;
- missing-signal detection;
- next-best-setup cards;
- completion progress;
- “why this matters” business copy;
- snooze/dismiss recommendation.

Do not:

- показывать 50 integrations сразу;
- превращать onboarding в enterprise setup wizard;
- давать AI право включать paid providers без подтверждения.

Acceptance:

- owner видит 3-5 релевантных следующих шагов;
- рекомендации зависят от business_type and current connectors;
- dismissed recommendations не мешают работе;
- UI остается простым.

### Phase 5 — Local / Heavy Systems Connector Strategy

Цель: подготовить путь для 1С/on-prem/legacy systems.

Must build:

- connector installation concept doc;
- lightweight connector auth model;
- secure event push API;
- connector heartbeat;
- connector version tracking;
- local connector risk model.

Do not:

- начинать этот этап до стабильных cloud integrations;
- пытаться поддержать все версии 1С сразу;
- хранить локальные database credentials в Zani cloud без шифрования.

Acceptance:

- есть архитектурный протокол local connector;
- есть API для heartbeat/events;
- есть security checklist;
- понятны ограничения V1.

## 15. Примерные Сроки Onboarding

Целевые ориентиры:

- Communication-first merchant: 15-60 минут.
- Kaspi/WB merchant: 1-3 часа.
- МойСклад/Poster merchant: 2-5 часов.
- 1С-heavy merchant: 1-3 дня.
- Полный onboarding бизнеса: до 5 дней.

Важно: merchant должен получить value в первый день, даже если полное подключение занимает дольше.

## 16. Метрики Успеха

Product metrics:

- time to first value;
- connection success rate;
- failed setup recovery rate;
- % merchants with first channel connected;
- % merchants with CRM events in first day;
- % merchants activating second capability;
- support tickets per onboarding;
- average setup duration.

Technical metrics:

- inbound events per connector;
- duplicate event rate;
- failed event rate;
- sync lag;
- webhook latency;
- connector health failure rate;
- queue processing time;
- token expiration/reconnect rate.

Business metrics:

- activation rate;
- retention after first 7 days;
- number of connected capabilities per merchant;
- AI summary usage;
- owner dashboard usage;
- support cost per merchant.

## 17. Главные Риски

1. Слишком рано строить тяжелые ERP-интеграции.
   Это съест время и превратит Zani в интеграторскую компанию.

2. Показать пользователю техническую сложность.
   Если merchant видит токены/webhooks/API, мы проигрываем UX.

3. Хранить слишком много чужих данных.
   Это увеличит стоимость, ответственность, риски безопасности и сложность.

4. Смешать provider logic с CRM logic.
   Это сделает систему хрупкой и дорогой в поддержке.

5. Сделать AI слишком автономным.
   AI должен помогать, объяснять и предлагать, но критичные действия должны подтверждаться.

6. Недооценить credentials security.
   Интеграционные токены — критичный актив merchant. Нужны encryption, audit, permissions и masking.

## 18. Что Нельзя Делать Архитектурно

- Нельзя строить дубль ERP клиента.
- Нельзя хранить raw provider tokens в открытом виде.
- Нельзя bypass tenant isolation ради скорости.
- Нельзя писать provider-specific логику прямо во frontend pages.
- Нельзя делать “универсальную интеграцию со всем” без event normalization.
- Нельзя отправлять AI сырые credentials или чувствительные payloads без фильтрации.
- Нельзя превращать onboarding в 20-шаговый enterprise wizard.
- Нельзя делать integrations page похожей на developer console для обычного merchant.

## 19. Definition Of Done Для Integration Tasks

Любой новый connector/capability считается готовым только если есть:

- backend model/API/service layer;
- tenant isolation;
- permission checks;
- audit/integration logs;
- masked credentials;
- health status;
- user-facing frontend flow;
- loading/error/empty/success states;
- tests for happy path;
- tests for forbidden access;
- tests for cross-tenant isolation;
- README/docs update;
- no raw provider secrets in code.

Обязательные проверки:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

## 20. Рекомендуемый Первый Execution Prompt

```text
Реализуй Phase 1 — Integration Foundation Hardening из
plan/plan_20_05/zani_integration_onboarding_master_plan_20_05.md.

Сначала проанализируй текущие apps/integrations, apps/bots, apps/onboarding,
apps.core audit/file layers и frontend settings/bots/onboarding pages.

Цель этапа:
подготовить production-like connector architecture без подключения реальных платных провайдеров.

Must Build:
- unified connector models;
- encrypted/masked credential storage;
- provider registry hardening;
- connector health status;
- integration activity timeline;
- idempotent inbound event model;
- Celery-ready service boundaries for integration jobs;
- frontend page/section for business-friendly integration capabilities;
- tests for permissions, tenant isolation, token masking, idempotency.

Do Not:
- подключать реальные WhatsApp/Kaspi/Meta/OpenAI credentials;
- показывать raw tokens merchant user;
- ломать существующие bot/channel/integration APIs;
- смешивать provider-specific code with CRM views.

Acceptance:
- backend checks/tests pass;
- frontend build passes;
- README/docs updated;
- merchant owner can see integration capabilities;
- merchant operator without permission cannot manage integrations;
- platform admin access remains separated;
- all integration data is tenant-scoped.
```

## 21. Итог

Zani должен конкурировать не количеством технических integration screens, а простотой включения бизнес-возможностей.

Главная продуктовая мысль:

```text
Merchant should feel: “I turned on a business function”,
not: “I implemented an integration”.
```

Главная техническая мысль:

```text
Zani stores and processes operational events,
not full duplicated ERP databases.
```

Именно эта связка — invisible onboarding + event-first architecture — может стать одним из главных moat Zani.
