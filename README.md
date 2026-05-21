# Zani

Zani — AI-first CRM / Business OS для малого и среднего бизнеса. Сейчас проект содержит Django + DRF backend, React + TypeScript frontend, multi-tenant Merchant CRM и foundation для будущего Platform Admin.

Работа ведется по актуальному мастер-плану:

```text
plan/ZANI_MASTER_TECH_PLAN.md
AGENTS.md
plan/clean_code_rules/zani_required_clean_code_rules.md
```

Правило проекта: один bounded phase/task = один изолированный набор изменений. После каждого этапа запускаются backend checks/tests и frontend build. `AGENTS.md` и clean-code rules обязательны для всех следующих задач.

## Текущий статус

### Реализовано до этапного плана

- Django + DRF backend-core.
- React + TypeScript frontend CRM.
- JWT auth через `djangorestframework-simplejwt`.
- Multi-tenant ядро вокруг `Business`.
- Merchant CRM: clients, leads, deals, tasks, appointments, calendar, services, resources, conversations, analytics, settings.
- Tenant-aware permissions и queryset filtering.
- `BusinessMember` для доступа пользователей к бизнесам.
- Audit log и временный support access foundation.
- Scheduling service-layer:
  - `get_available_slots(...)`
  - `create_appointment_from_lead(...)`
- REST API для основных CRM-сущностей.
- Django Admin.
- Docker-ready структура.
- Celery-ready конфигурация, но Celery/Redis пока не обязательны для минимального запуска.

### Phase 1 — Production Readiness Baseline

Статус: **готово**.

Добавлено:

- Readiness endpoint:
  - `GET /ready/`
- Production safety checks для staging/production:
  - `zani.W001` — `DEBUG=True`;
  - `zani.W002` — weak/placeholder `SECRET_KEY`;
  - `zani.W003` — unrestricted `ALLOWED_HOSTS`;
  - `zani.W004` — empty `CORS_ALLOWED_ORIGINS`;
  - `zani.W005` — empty `CSRF_TRUSTED_ORIGINS`;
  - `zani.W006` — missing `SENTRY_DSN`.
- Celery production baseline:
  - default queue;
  - integration queues;
  - AI worker profile;
  - safer worker prefetch/acks defaults.
- Docker healthcheck теперь использует `/ready/`.
- Production documentation:
  - `docs/production-readiness.md`;
  - `docs/backup-restore.md`;
  - обновлен `docs/deployment.md`.
- `.env.example` дополнен logging/Celery production variables.

Не добавлялось:

- реальные платные провайдеры;
- Kubernetes;
- payment provider;
- storage quotas;
- realtime WebSocket/SSE.

Проверки:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Phase 2 — Storage And File Safety

Статус: **готово**.

Добавлено:

- Storage usage accounting по `FileAttachment.size`.
- `GET /api/billing/usage-summary/` теперь возвращает `storage_mb`.
- Plan-aware storage quota:
  - лимит читается из `SubscriptionPlan.limits_json.storage_mb`;
  - fallback defaults: `start=100 MB`, `growth=2048 MB`, `platform=10240 MB`;
  - загрузка файла блокируется до сохранения при превышении лимита.
- Audit для файлов:
  - upload пишет create audit;
  - download пишет `AuditLog.action=download`;
  - download помечается как `security / medium`.
- Settings usage UI показывает `Storage`.
- Обновлена storage-документация:
  - `docs/file-storage.md`.

Не добавлялось:

- реальный S3/Supabase Storage provider;
- antivirus scan;
- CDN;
- retention jobs;
- storage billing payments.

Проверки:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Phase 3 — Realtime Or Reliable Polling

Статус: **готово**.

Решение этапа: начать с reliable polling, не с WebSocket/SSE.

Добавлено:

- Единые polling intervals:
  - `frontend/src/lib/realtime.ts`
- Header notifications:
  - summary/list обновляются каждые 20 секунд;
  - refetch on focus/reconnect.
- Inbox:
  - conversation list обновляется каждые 12 секунд;
  - selected messages обновляются каждые 7 секунд;
  - refetch on focus/reconnect.
- Документация:
  - `docs/realtime-strategy.md`.

Не добавлялось:

- WebSocket;
- SSE;
- push notifications;
- typing indicators;
- live collaboration.

Проверки:

```bash
cd frontend && npm run build
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
```

### Phase 4 — Integration Foundation Hardening

Статус: **готово**.

Добавлено:

- Merchant connector foundation:
  - `BusinessConnector`;
  - `ConnectorCredential`;
  - `BusinessEvent`;
  - `ConnectorSyncRun`.
- API для коннекторов:
  - `GET /api/business-connectors/capabilities/`;
  - CRUD `/api/business-connectors/`;
  - `POST /api/business-connectors/{id}/health-check/`;
  - `POST /api/business-connectors/{id}/events/`;
  - CRUD `/api/connector-credentials/`;
  - read-only `/api/business-events/`;
  - read-only `/api/connector-sync-runs/`.
- Credentials safety:
  - raw secrets write-only;
  - API возвращает только `masked_value`;
  - encrypted/signed credential envelope на backend.
- Idempotent inbound events через `normalize_business_event`.
- Provider registry теперь явно отклоняет неизвестных providers.
- Django Admin для новых integration-моделей.
- Frontend:
  - `/dashboard/integrations`;
  - карточки capabilities;
  - сохранение секретов без повторного показа raw values;
  - health-check/recovery state.
- Документация:
  - `docs/integrations.md`.

Проверки:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Phase 5 — Queue-Backed Automation Runtime

Статус: **готово**.

Добавлено:

- `AutomationRun` стал полноценным runtime-record:
  - `idempotency_key`;
  - `attempts` / `max_attempts`;
  - `run_after`;
  - `next_retry_at`;
  - `locked_at`;
  - `action_results`.
- Idempotency:
  - повторное CRM-событие не создает duplicate run;
  - automation actions не дублируют задачи/уведомления.
- Celery-ready tasks:
  - `automations.process_automation_run`;
  - `automations.process_due_automation_runs`.
- Runtime mode:
  - `AUTOMATIONS_RUN_INLINE=True` для локальной работы без Redis/Celery;
  - `AUTOMATIONS_RUN_INLINE=False` для staging/production queue mode.
- Delayed/WAIT actions:
  - выставляют `run_after`;
  - не исполняются inline в HTTP request.
- Retry API:
  - `POST /api/automation-runs/{id}/retry/`.
- Frontend:
  - журнал запусков показывает attempts/retry time;
  - failed run можно перезапустить из UI.
- Документация:
  - `docs/automation-runtime.md`.

Проверки:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Phase 6 — Communication-First Onboarding

Статус: **готово**.

Добавлено:

- Onboarding теперь ведёт мерчанта к первому communication flow:
  - шаблон ниши;
  - первый канал;
  - первое сообщение;
  - клиент/заявка/inbox.
- Новые API:
  - `POST /api/onboarding/setup-channel/`;
  - `POST /api/onboarding/first-message/`.
- `setup-channel` создаёт:
  - active bot;
  - active bot channel;
  - `BusinessConnector`;
  - normalized `BusinessEvent`.
- `first-message` создаёт:
  - website conversation;
  - inbound message;
  - client;
  - lead;
  - handoff-required inbox state.
- Checklist дополнен пунктами:
  - первый канал;
  - первое сообщение.
- Frontend `/dashboard/onboarding` получил блоки:
  - “Первый канал”;
  - “Первое сообщение”;
  - переходы в Диалоги и Интеграции.
- Документация:
  - `docs/communication-onboarding.md`.

Проверки:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Phase 7 — Entitlements And Billing Enforcement

Статус: **готово**.

Добавлено:

- централизованный entitlement service:
  - `apps/billing/entitlements.py`;
  - `check_entitlement`;
  - `assert_entitlement_allows`;
  - `entitlement_summary`.
- Единые тарифные лимиты для:
  - пользователей;
  - ботов;
  - automation rules;
  - AI requests;
  - bot messages;
  - conversations;
  - storage.
- Backend enforcement в:
  - AI requests;
  - bot creation;
  - bot messages/conversations;
  - automation rule creation;
  - business member creation;
  - storage quota.
- Новый API:
  - `GET /api/billing/entitlements/`.
- Frontend `/dashboard/settings` показывает:
  - usage;
  - limit;
  - remaining quota.
- Документация:
  - `docs/entitlements.md`.

Проверки:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Phase 8 — E2E QA And Scale Baseline

Статус: **готово**.

Добавлено:

- Playwright setup:
  - `frontend/playwright.config.ts`;
  - `frontend/e2e/smoke.spec.ts`.
- Frontend scripts:
  - `npm run e2e`;
  - `npm run e2e:ui`.
- Idempotent seed command:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py prepare_e2e_smoke_data`.
- Smoke coverage:
  - platform admin login and `/platform`;
  - business owner login and core merchant pages;
  - merchant user cannot open `/platform`;
  - operator sees restricted settings section;
  - mobile dashboard -> calendar flow.
- Basic scale/load plan:
  - `docs/e2e-scale-baseline.md`.

Проверки:

```bash
cd frontend && npx playwright install chromium
cd frontend && npm run e2e
```

Последний E2E результат:

```text
9 passed, 1 intentionally skipped
```

### Phase 9 — Analytics / Reporting Depth

Статус: **готово**.

Добавлено:

- Reporting foundation:
  - `ReportWidget`;
  - `ScheduledReport`.
- Новые API:
  - `GET /api/analytics/reports/summary/`;
  - `GET /api/analytics/reports/export/`;
  - `/api/report-widgets/`;
  - `/api/scheduled-reports/`.
- Отчеты:
  - source ROI;
  - funnel velocity;
  - manager performance export;
  - retention/LTV estimates.
- Frontend `/dashboard/analytics` показывает:
  - операционные отчеты;
  - repeat rate;
  - LTV estimate;
  - stage velocity;
  - scheduled reports;
  - CSV export.
- Экспорт отчетов пишет audit log.
- Документация:
  - `docs/analytics-reporting.md`.

Проверки:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Этап 1.1 — Platform Access Foundation

Статус: **готово**.

Добавлено:

- Роли `platform_manager` и `business_manager`.
- Legacy роль `manager` сохранена как alias для `business_manager`.
- Helper flags в `User`:
  - `is_platform_user`
  - `is_merchant_user`
  - `is_business_manager`
- Endpoint:
  - `GET /api/auth/me/`
  - `GET /api/platform/ping/`
- Permissions:
  - `IsPlatformUser`
  - `IsPlatformAdmin`
- Frontend auth state:
  - `user`
  - `role`
  - `businesses`
  - `isPlatformUser`
  - `isMerchantUser`
- Frontend routes:
  - `PlatformRoute`
  - `MerchantRoute`
  - `/platform` placeholder
- Login redirect:
  - platform users -> `/platform`
  - merchant users -> `/`

Проверено:

```bash
python manage.py check
python manage.py test
cd frontend && npm run build
python manage.py makemigrations --check --dry-run
python manage.py migrate
```

Результат: backend tests проходят, frontend build проходит.

### Этап 1.2 — Platform Layout Polish

Статус: **готово**.

Добавлено:

- Отдельный `PlatformLayout` для platform users.
- Отдельный platform sidebar/header.
- Защищенные placeholder routes:
  - `/platform`
  - `/platform/merchants`
  - `/platform/prospects`
  - `/platform/billing`
  - `/platform/analytics`
  - `/platform/settings`
- Все platform routes остаются под `PlatformRoute`.
- Merchant CRM sidebar/header не рендерятся в Platform Admin.
- Platform пункты не добавлялись в Merchant CRM sidebar.

Не добавлялось:

- реальные merchants/prospects API;
- модели prospects/subscriptions;
- графики;
- платежная логика.

Проверено:

```bash
cd frontend && npm run build
```

### Этап 1.3 — Security Hardening — Auth Baseline

Статус: **готово**.

Добавлено:

- SimpleJWT refresh token rotation.
- SimpleJWT refresh token blacklist.
- Scoped throttling для auth endpoints:
  - `auth_login`
  - `auth_refresh`
- Custom token views:
  - `ThrottledTokenObtainPairView`
  - `ThrottledTokenRefreshView`
- CORS settings через env:
  - `CORS_ALLOWED_ORIGINS`
  - `CORS_ALLOW_CREDENTIALS`
- CSRF trusted origins остаются env-controlled через `CSRF_TRUSTED_ORIGINS`.
- Frontend refresh flow теперь сохраняет новый rotated refresh token.
- Backend tests на:
  - login;
  - refresh rotation;
  - запрет повторного использования старого refresh token;
  - throttling login endpoint.

Не добавлялось:

- Google OAuth;
- Apple OAuth;
- 2FA;
- Supabase Auth;
- переписывание auth с нуля.

Проверено:

```bash
python manage.py check
python manage.py test
python manage.py makemigrations --check --dry-run
python manage.py migrate
cd frontend && npm run build
```

### Этап 2.1 — Public Website Shell

Статус: **готово**.

Добавлено:

- Публичный `PublicLayout` внутри frontend.
- Публичные страницы без обязательной авторизации:
  - `/`
  - `/pricing`
  - `/bots`
  - `/crm`
  - `/contacts`
- CTA:
  - открыть CRM;
  - подключить CRM;
  - связаться;
  - посмотреть тарифы.
- Merchant CRM перенесена на `/dashboard`.
- Merchant nested routes:
  - `/dashboard/leads`
  - `/dashboard/clients`
  - `/dashboard/deals`
  - `/dashboard/appointments`
  - остальные CRM-разделы.
- Старые merchant routes `/leads`, `/clients`, `/calendar` и т.д. сохранены как совместимые aliases.
- После login merchant users идут на `/dashboard`.
- Platform users по-прежнему идут на `/platform`.

Не добавлялось:

- billing logic;
- платежи;
- bots API;
- AI API;
- backend models.

Проверено:

```bash
python manage.py check
cd frontend && npm run build
```

### Этап 2.2 — Billing Foundation

Статус: **готово**.

Добавлено:

- Backend app `apps.billing`.
- Модели `SubscriptionPlan` и `Subscription`.
- Seed migration с базовыми планами `Start`, `Growth`, `Platform`.
- Django Admin для тарифов и подписок.
- API:
  - `GET /api/billing/plans/`
  - `GET /api/billing/current-subscription/`
- Public pricing page получает тарифы из backend API.
- Merchant settings page показывает текущий тариф или состояние "тариф не назначен".
- Backend tests для тарифов и текущей подписки.

Не добавлялось:

- реальная оплата;
- payment webhooks;
- MRR analytics;
- Platform subscriptions dashboard.

Проверено:

```bash
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
python manage.py migrate
cd frontend && npm run build
```

### Этап 2.3 — Merchant CRM UI Upgrade

Статус: **готово**.

Добавлено:

- Улучшен Merchant CRM dashboard:
  - KPI cards для заявок, записей, клиентов, конверсии и задач;
  - быстрые действия: создать заявку, клиента, запись;
  - блок "Что требует внимания";
  - улучшенные списки последних заявок и ближайших записей.
- Улучшены общие UI-состояния:
  - loading skeletons;
  - более полезные empty states;
  - визуально аккуратные error states.
- Улучшен общий `DataTable`:
  - premium card styling;
  - empty actions;
  - loading state;
  - cleaner footer/count.
- Улучшены empty states и CTA на страницах:
  - clients;
  - appointments;
  - services;
  - resources;
  - working hours;
  - tasks;
  - automations.
- Header получил более аккуратный notifications dropdown.
- Page headers получили более явную CRM-визуальную иерархию.

Не добавлялось:

- новые backend models;
- новые API endpoints;
- AI/bots/billing/platform pages;
- изменения tenant isolation.

Проверено:

```bash
python manage.py check
cd frontend && npm run build
```

### Этап 3.1 — Bots Foundation

Статус: **готово**.

Добавлено:

- Backend app `apps.bots`.
- Модели:
  - `Bot`;
  - `BotChannel`;
  - `BotConversation`;
  - `BotMessage`.
- Django Admin для всех bot-сущностей.
- Tenant-safe API:
  - `GET/POST /api/bots/`
  - `GET/POST /api/bot-channels/`
  - `GET/POST /api/bot-conversations/`
  - `GET/POST /api/bot-messages/`
- Tenant isolation расширена на bot-related objects через общий `TenantModelViewSet`.
- Frontend Merchant CRM:
  - `/dashboard/bots` — список ботов;
  - `/dashboard/bots/:id` — detail placeholder;
  - раздел "Боты" в merchant sidebar и mobile nav.
- Frontend API/types:
  - `botsApi`;
  - `botChannelsApi`;
  - `botConversationsApi`;
  - `botMessagesApi`.
- Backend tests на создание, tenant filtering и доступ к bot conversations/messages.

Не добавлялось:

- Telegram webhook;
- WhatsApp/Instagram API;
- AI responses;
- website widget;
- auto-replies.

Важно:

- Публичная страница `/bots` остается частью website shell.
- Merchant bots находятся в `/dashboard/bots`, чтобы не ломать публичный сайт.

Проверено:

```bash
python manage.py check
python manage.py test
cd frontend && npm run build
```

### Этап 3.2 — Website Chat Widget Foundation

Статус: **готово**.

Добавлено:

- Public token для `BotChannel`.
- Public ID для `BotConversation`.
- Public website chat API без авторизации:
  - `GET /api/public/website-chat/{public_token}/`
  - `POST /api/public/website-chat/{public_token}/conversations/`
  - `POST /api/public/website-chat/{public_token}/conversations/{conversation_id}/messages/`
- Создание `BotConversation` и `BotMessage` через public website channel.
- Если в первом сообщении есть `phone` или `email`, backend создаёт:
  - `Client` со source `website`;
  - `Lead` со source `website`.
- Merchant CRM bot detail получил website chat preview:
  - создание website channel;
  - отображение public token;
  - отправка тестового сообщения через public API;
  - обновление conversations/messages/leads/clients после теста.
- Backend tests на:
  - public conversation create;
  - public message append;
  - запрет использования non-website channel в public endpoint.

Не добавлялось:

- websocket/realtime;
- AI responses;
- Telegram/WhatsApp/Instagram;
- production embed SDK script.

Проверено:

```bash
python manage.py check
python manage.py test
cd frontend && npm run build
```

### Этап 3.3 — Telegram Integration Skeleton

Статус: **готово**.

Добавлено:

- Backend app `apps.integrations`.
- Telegram service layer:
  - проверка webhook secret;
  - определение merchant telegram channel по `BotChannel.config_json.webhook_secret`;
  - сохранение inbound Telegram update в `BotConversation` и `BotMessage`;
  - outbound helper `send_telegram_message(...)` с mock fallback, если Telegram выключен или нет `bot_token`.
- Endpoint:
  - `POST /api/integrations/telegram/webhook/`
- ENV:
  - `TELEGRAM_ENABLED`
  - `TELEGRAM_BASE_API_URL`
  - `TELEGRAM_WEBHOOK_SECRET`
- Merchant bot tokens остаются в БД:
  - `BotChannel.config_json.bot_token`
  - не в `.env`.
- Tests для:
  - сохранения inbound message;
  - отказа при неверном secret;
  - mock outbound при выключенном Telegram.

Не добавлялось:

- AI replies;
- массовые рассылки;
- WhatsApp;
- Instagram.

Проверено:

```bash
python manage.py makemigrations --check --dry-run
python manage.py check
python manage.py test
cd frontend && npm run build
```

### Этап 4.1 — AI Core Foundation

Статус: **готово**.

Добавлено:

- Backend app `apps.ai_core`.
- Модели:
  - `AIRequestLog`;
  - `BusinessKnowledgeItem`.
- Django Admin для AI logs и knowledge base.
- Tenant-safe API:
  - `GET/POST /api/ai/request-logs/`
  - `GET/POST /api/ai/knowledge-items/`
- AI service layer:
  - `ai_client.py` — abstraction над OpenAI Responses API;
  - `prompt_service.py` — сборка prompt;
  - `context_service.py` — business knowledge context;
  - `services.py` — `run_ai_request(...)` с логированием.
- Controlled behavior без ключа:
  - при пустом `OPENAI_API_KEY` возвращается mock response;
  - при `allow_mock=False` возвращается controlled `AIClientError`.
- ENV:
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL`
  - `OPENAI_TEMPERATURE`
- Tests для mock/error behavior, logging и tenant isolation.

Не добавлялось:

- AI assistant UI;
- auto-replies для ботов;
- embeddings/vector DB;
- voice.

Проверено:

```bash
python manage.py check
python manage.py test
cd frontend && npm run build
```

### Этап 4.2 — AI Assistant for CRM

Статус: **готово**.

Добавлено:

- Endpoint:
  - `POST /api/ai/assistant/chat/`
- Tenant-safe CRM context для AI:
  - business summary;
  - количество клиентов;
  - новые заявки;
  - открытые записи;
  - последние leads;
  - ближайшие appointments.
- Ответ ассистента сохраняется в `AIRequestLog`.
- Если `OPENAI_API_KEY` пустой, endpoint возвращает controlled mock response.
- Frontend page `/dashboard/ai-assistant` теперь вызывает реальный API:
  - custom question;
  - quick prompts;
  - daily brief;
  - история последних ответов;
  - отображение mock/model/log id/context metrics.

Не добавлялось:

- AI auto-replies для ботов;
- billing usage limits;
- voice;
- embeddings/vector DB.

Проверено:

```bash
python manage.py check
python manage.py test
cd frontend && npm run build
```

### Этап 4.3 — AI Bot Replies MVP

Статус: **готово**.

Добавлено:

- Endpoint:
  - `POST /api/bot-conversations/{id}/suggest-reply/`
- Генерация suggested reply использует:
  - `BusinessKnowledgeItem`;
  - последние сообщения `BotConversation`;
  - `AIRequestLog` с source `bot`.
- Ответ возвращается как черновик `suggested_reply`.
- Ответ **не отправляется автоматически** и не создаёт outbound `BotMessage`.
- Frontend `/dashboard/bots/:id` получил блок:
  - последние сообщения диалога;
  - кнопка "Сгенерировать";
  - draft reply с model/log metadata.
- Tests проверяют:
  - генерацию mock suggested reply;
  - логирование AIRequestLog;
  - отсутствие auto-send;
  - tenant isolation для чужого conversation.

Не добавлялось:

- auto-send;
- WhatsApp/Instagram;
- voice;
- массовые сценарии.

Проверено:

```bash
python manage.py check
python manage.py test
cd frontend && npm run build
```

### Этап 5.1 — Automation Foundation

Статус: **готово**.

Добавлено:

- Новый trigger `bot_message_received` в `AutomationRule.TriggerTypes`.
- Service-layer:
  - `apps/automations/engine.py`
  - `run_automations_for_event(...)`
- Поддержанные триггеры текущего этапа:
  - `lead_created`;
  - `appointment_created`;
  - `bot_message_received`.
- Поддержанные actions текущего этапа:
  - `create_task`;
  - `create_notification`.
- Event hooks:
  - создание лида через `/api/leads/`;
  - создание записи через `/api/appointments/`;
  - создание записи из лида;
  - inbound `BotMessage`;
  - public website chat;
  - Telegram inbound webhook skeleton.
- `AutomationRun` используется как run log:
  - `success`;
  - `skipped`;
  - `failed`.
- Ошибки action не ломают основной пользовательский flow, а фиксируются в `AutomationRun.error`.
- Автоматизации выполняются синхронно, поэтому MVP работает без Redis/Celery worker.

Не добавлялось:

- визуальный workflow builder;
- AI automation;
- внешняя отправка WhatsApp/Telegram/email;
- delay/wait orchestration;
- Celery worker pipeline.

Проверено:

```bash
python manage.py check
python manage.py test
cd frontend && npm run build
```

### Этап 5.2 — Notifications and Tasks Polish

Статус: **готово**.

Добавлено:

- `Task` теперь может быть связан с записью:
  - `appointment`;
  - nullable FK, безопасно для существующих данных.
- `TaskSerializer` валидирует, что связанные `client`, `lead`, `deal`, `appointment` принадлежат тому же `Business`.
- Backend actions для задач:
  - `POST /api/tasks/{id}/start/`;
  - `POST /api/tasks/{id}/complete/`;
  - `POST /api/tasks/{id}/cancel/`.
- Backend actions для уведомлений:
  - `POST /api/notifications/{id}/mark-sent/`;
  - `POST /api/notifications/{id}/cancel/`;
  - `GET /api/notifications/summary/`.
- Frontend:
  - notification center в header;
  - badge count для pending notifications;
  - быстрый просмотр последних уведомлений;
  - быстрый mark-sent из dropdown;
  - улучшенная страница `/dashboard/tasks`;
  - quick create task с привязкой к client / lead / appointment;
  - фильтр задач по статусу;
  - cards со счётчиками активных, просроченных и high-priority задач.

Не добавлялось:

- external push;
- email notifications;
- bots logic;
- AI logic;
- отдельный сложный notification inbox.

Проверено:

```bash
python manage.py check
python manage.py test
cd frontend && npm run build
```

### Prompt 00 — Repo Cleanup and Zani Baseline

Статус: **готово**.

Добавлено:

- Публичные упоминания старых названий заменены на `Zani` в README/frontend/package metadata.
- `.gitignore` расширен для безопасного GitHub-коммита:
  - `.env`;
  - `.venv/`;
  - `db.sqlite3`;
  - `node_modules/`;
  - `dist/`;
  - cache/build artifacts.
- Скрипт чистого архива:
  - `scripts/make_clean_archive.sh`
- Management command:
  - `python manage.py create_platform_admin --email ... --password ...`
- Frontend auth refresh flow стабилизирован через единый token client.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
cd frontend && npm ci && npm run build
scripts/make_clean_archive.sh
```

### Prompt 01 — Test Stabilization and No External Network in Tests

Статус: **готово**.

Добавлено:

- Test-safe defaults для внешних интеграций:
  - `OPENAI_API_KEY=""`;
  - `TELEGRAM_ENABLED=False`;
  - `WHATSAPP_ENABLED=False`;
  - `INSTAGRAM_ENABLED=False`;
  - local-memory email backend в test mode.
- `.env.example` дополнен минимальными flags для integrations/email backend.
- Документация:
  - `docs/testing.md`
- Полный `manage.py test -v 2` проходит без зависания и без внешних сетевых вызовов.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test -v 2
cd frontend && npm run build
```

### Prompt 02 — Unified Inbox Backend Core

Статус: **готово**.

Добавлено:

- `BotConversation` расширен для unified inbox:
  - `assigned_to`;
  - `priority`;
  - `bot_enabled`;
  - `handoff_required`;
  - `handoff_reason`;
  - `last_message_at`;
  - `last_inbound_at`;
  - `last_outbound_at`;
  - `unread_count`;
  - `external_thread_id`;
  - `metadata_json`.
- `BotMessage` расширен:
  - `sender_type`;
  - `external_message_id`;
  - `error_text`;
  - `sent_at`;
  - `delivered_at`;
  - `read_at`.
- Service-layer:
  - `apps/bots/inbox_service.py`
- Merchant-only inbox API:
  - `GET /api/inbox/conversations/`
  - `GET /api/inbox/conversations/{id}/`
  - `GET /api/inbox/conversations/{id}/messages/`
  - `POST /api/inbox/conversations/{id}/assign/`
  - `POST /api/inbox/conversations/{id}/handoff/`
  - `POST /api/inbox/conversations/{id}/mark-read/`
- Фильтры inbox:
  - `channel`;
  - `status`;
  - `assigned_to`;
  - `priority`;
  - `bot_enabled`;
  - `unread`;
  - `search`.
- Tenant isolation:
  - merchant users видят только свой business inbox;
  - platform users не получают merchant inbox через `/api/inbox/...`;
  - anonymous users запрещены.
- Inbound `BotMessage` обновляет unread counter и timestamps через service-layer.
- Telegram/public website chat также обновляют inbox counters.

Не добавлялось:

- websocket/realtime;
- WhatsApp/Instagram;
- AI auto-replies;
- переписывание старых `Conversation`, `Message`, `BotConversation`, `BotMessage`.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt 03 — Unified Inbox Frontend

Статус: **готово**.

Добавлено:

- Frontend API layer:
  - `frontend/src/api/inbox.ts`
- `ConversationsPage` больше не использует demo data.
- Conversations UI работает с реальными endpoints:
  - `GET /api/inbox/conversations/`
  - `GET /api/inbox/conversations/{id}/messages/`
- UI содержит:
  - список диалогов;
  - поиск;
  - фильтры по channel/unread/assigned/priority;
  - ленту сообщений;
  - context panel;
  - channel badges;
  - unread count;
  - priority badges.
- Actions:
  - assign to me;
  - handoff to manager;
  - mark read;
  - pause/enable bot через существующий bot-conversation endpoint;
  - suggest AI reply через существующий endpoint.
- Outbound reply, create task и create lead оставлены как controlled placeholders до следующего backend этапа.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt 04 — Manager Outbound Reply + Conversation Actions

Статус: **готово**.

Добавлено:

- Backend endpoint:
  - `POST /api/inbox/conversations/{id}/messages/`
- Service-layer:
  - `send_outbound_message(conversation, text, user)`
- Ручной ответ менеджера сохраняется как:
  - `direction=outbound`;
  - `sender_type=manager`;
  - `status=queued`.
- CRM actions из inbox:
  - `POST /api/inbox/conversations/{id}/create-task/`
  - `POST /api/inbox/conversations/{id}/link-lead/`
  - `POST /api/inbox/conversations/{id}/create-lead/`
- Frontend inbox:
  - активный input ответа;
  - send button;
  - create task;
  - create lead;
  - link lead by ID.
- Tenant isolation и проверки business ownership покрыты backend tests.

Не добавлялось:

- реальная отправка в WhatsApp/Instagram/Telegram provider;
- websocket/realtime;
- AI auto-send;
- billing/payment logic.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt 05 — AI Agent Profile Foundation

Статус: **готово**.

Добавлено:

- Модель `AgentProfile` в `apps.ai_core`:
  - `business`;
  - `bot`;
  - `name`;
  - `role_description`;
  - `tone`;
  - `language`;
  - `is_active`;
  - `system_prompt`;
  - `rules_json`;
  - `allowed_tools_json`;
  - `escalation_rules_json`.
- Django Admin для Agent Profiles.
- Tenant-safe API:
  - `GET/POST /api/ai/agent-profiles/`
- `suggest_bot_reply` использует active AgentProfile:
  - сначала profile конкретного бота;
  - затем fallback profile бизнеса без bot.
- Frontend:
  - `/dashboard/ai-agents`;
  - создание/редактирование agent profile;
  - выбор bot;
  - tone/language/system prompt/rules/escalation rules;
  - safe tools placeholder.

Не добавлялось:

- auto-send;
- function calling;
- embeddings/vector DB;
- WhatsApp/Instagram integrations.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt 06 — AI Tool Registry Skeleton

Статус: **готово**.

Добавлено:

- Service-layer:
  - `apps/ai_core/tool_registry.py`
- Зарегистрированные tools:
  - `create_lead`;
  - `create_client`;
  - `create_task`;
  - `create_deal`;
  - `summarize_conversation`;
  - `qualify_lead`.
- Модель `AIToolCallLog`:
  - business/user/conversation;
  - tool name;
  - input/output JSON;
  - status;
  - error;
  - created_at.
- Django Admin для tool call logs.
- Endpoints:
  - `POST /api/ai/tools/suggest/`
  - `POST /api/ai/tools/{log_id}/execute/`
- Suggest endpoint только создаёт suggested logs и возвращает действия.
- Execute endpoint выполняет только после явного запроса пользователя и проверки доступа к business.
- Tests покрывают:
  - создание suggested actions без выполнения;
  - подтверждённое выполнение `create_task`;
  - запрет выполнения tool call чужого business.

Не добавлялось:

- autonomous AI execution;
- auto-send;
- внешние API providers.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt 07 — Deal/Pipeline UX Upgrade

Статус: **готово**.

Добавлено:

- `/dashboard/deals` переработан в рабочий sales kanban.
- Drag & drop stage changes через существующий endpoint:
  - `POST /api/deals/{id}/move-stage/`
- Deal cards показывают:
  - client;
  - amount/currency;
  - source/channel badge;
  - probability;
  - status;
  - next task;
  - last activity.
- Stage columns показывают:
  - цвет стадии;
  - probability;
  - SLA;
  - количество сделок;
  - сумму по стадии.
- Deal detail modal:
  - main info;
  - client;
  - linked lead;
  - tasks;
  - conversations;
  - timeline;
  - AI next action placeholder.
- Backend не менялся: существующая API-архитектура уже покрывала stage change и tenant filtering.

Не добавлялось:

- телефония;
- платежи;
- full portal UX;
- AI auto decisions.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt 08 — Channel Provider Abstraction

Статус: **готово**.

Добавлено:

- Provider service layer:
  - `apps/integrations/providers/`
- Общий интерфейс:
  - `send_message(channel, recipient_id, text, payload)`
  - `parse_webhook(provider, payload, headers)`
  - `verify_webhook(provider, request)`
- Providers:
  - `website` mock;
  - `telegram`;
  - `whatsapp` mock;
  - `instagram` mock;
  - `email` mock.
- Модель `IntegrationEventLog`:
  - business nullable;
  - provider/channel;
  - direction;
  - payload JSON;
  - status;
  - error;
  - created_at.
- Django Admin для integration event logs.
- Telegram webhook продолжает работать, но теперь использует provider parsing/verification.
- Telegram outbound helper использует общий `send_message(...)`.
- Tests проверяют:
  - Telegram inbound webhook;
  - event logging;
  - Telegram mock outbound;
  - регистрацию mock providers.

Не добавлялось:

- реальные WhatsApp/Instagram API;
- merchant tokens в `.env`;
- массовые рассылки.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt 09 — Website Widget SDK MVP

Статус: **готово**.

Добавлено:

- Widget source:
  - `frontend/widget/src/index.ts`
- Widget build config:
  - `frontend/widget/vite.config.ts`
- `npm run build` теперь собирает:
  - основное frontend приложение;
  - widget bundle `frontend/dist/widget/zani-widget.js`.
- Widget умеет:
  - читать `data-zani-token`;
  - показывать chat bubble;
  - открывать chat window;
  - создавать conversation через public website chat API;
  - отправлять последующие сообщения;
  - показывать basic status.
- Документация:
  - `docs/widget-sdk.md`

Embed target:

```html
<script
  src="https://cdn.zani.kz/widget.js"
  data-zani-token="PUBLIC_WEBSITE_CHANNEL_TOKEN"
  data-zani-api="https://api.zani.kz"
></script>
```

Не добавлялось:

- realtime;
- AI auto replies;
- CDN deployment;
- advanced themes.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt 10 — Telegram Production Pass

Статус: **готово**.

Добавлено:

- Merchant UI в bot detail:
  - Telegram channel creation;
  - bot token input;
  - webhook secret input;
  - webhook URL input;
  - save config;
  - set webhook;
  - status check;
  - last error через status endpoint.
- Backend channel actions:
  - `POST /api/bot-channels/{id}/telegram-config/`
  - `POST /api/bot-channels/{id}/set-telegram-webhook/`
  - `GET /api/bot-channels/{id}/telegram-status/`
- Merchant bot token хранится в `BotChannel.config_json`.
- `IntegrationEventLog` не пишет полный token, только `token_configured`.
- Telegram provider получил `set_webhook`.
- Inbox outbound reply теперь проходит через provider layer, если у conversation есть channel и external user id.
- Tests покрывают:
  - Telegram config;
  - mock set webhook;
  - отсутствие token в logs;
  - outbound Telegram reply через provider layer.

Не добавлялось:

- broadcast;
- WhatsApp;
- AI auto-send.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt 11 — Billing Usage Limits Foundation

Статус: **готово**.

Добавлено:

- Модель `UsageCounter`:
  - business;
  - period_start / period_end;
  - metric;
  - value.
- Metrics:
  - `ai_requests`;
  - `bot_messages`;
  - `users`;
  - `conversations`.
- Service-layer:
  - `increment_usage(business, metric, amount=1)`
  - `check_limit(business, metric)`
  - `usage_summary(business)`
- Usage hooks:
  - `AIRequestLog` через `run_ai_request`;
  - `BotMessage` через inbox registration;
  - new `BotConversation` через bot/public/Telegram create flows.
- API:
  - `GET /api/billing/usage-summary/`
- Settings page показывает:
  - текущий план;
  - usage counters;
  - лимит из `SubscriptionPlan.limits_json`;
  - soft over-limit indicator.

Не добавлялось:

- реальные платежи;
- жёсткая блокировка операций;
- MRR dashboard.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt 12 — Platform Admin Real Dashboard

Статус: **готово**.

Добавлено:

- Backend API:
  - `GET /api/platform/overview/`
  - `GET /api/platform/merchants/`
- Platform overview возвращает реальные агрегированные метрики:
  - businesses;
  - active/trial merchants;
  - active subscriptions;
  - MRR estimate;
  - users;
  - bots/channels;
  - AI requests за 30 дней;
  - conversations за 30 дней;
  - errors placeholder.
- Platform merchants API возвращает:
  - business;
  - owner;
  - status;
  - plan;
  - subscription status;
  - usage summary.
- Доступ ограничен `platform_admin` и `platform_manager`.
- Merchant users получают `403` на platform API.
- Frontend:
  - настоящий `/platform` dashboard;
  - настоящая `/platform/merchants` таблица;
  - остальные platform routes оставлены placeholders.

Не добавлялось:

- prospects;
- parser;
- landing generator;
- payment provider.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt 13 — Production Infrastructure Baseline

Статус: **готово**.

Добавлено:

- `docker-compose.yml` обновлен под production baseline:
  - `web`;
  - `db`;
  - `redis`;
  - `celery`;
  - optional `celery-beat` через profile `beat`.
- `Dockerfile` теперь по умолчанию запускает Django через `gunicorn`.
- `requirements.txt` дополнен `gunicorn`.
- `config/settings.py` дополнен:
  - `STATIC_ROOT`;
  - `MEDIA_ROOT`;
  - `MEDIA_URL`;
  - SMTP email settings;
  - optional Sentry init уже работает через `SENTRY_DSN`.
- `.env.example` расширен переменными для:
  - Django;
  - PostgreSQL;
  - Redis/Celery;
  - JWT/throttling;
  - CORS/CSRF/security;
  - Telegram/OpenAI/email/Sentry;
  - storage placeholders;
  - frontend API URL.
- Добавлен `docs/deployment.md`.
- Health endpoints сохранены:
  - `/health/`;
  - `/health/db/`.

Не добавлялось:

- Kubernetes;
- CI/CD;
- обязательные paid providers.

Проверено:

```bash
docker compose config
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py collectstatic --noinput --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt 14 — Object Storage and File Safety Foundation

Статус: **готово**.

Добавлено:

- Optional S3-compatible settings:
  - `USE_S3`;
  - `AWS_ACCESS_KEY_ID`;
  - `AWS_SECRET_ACCESS_KEY`;
  - `AWS_STORAGE_BUCKET_NAME`;
  - `AWS_S3_ENDPOINT_URL`;
  - `AWS_S3_REGION_NAME`;
  - `AWS_QUERYSTRING_AUTH`.
- Local media остаётся дефолтом для development.
- Private media root:
  - `PRIVATE_MEDIA_ROOT`.
- File validation helpers:
  - `validate_file_upload`;
  - extension validation;
  - content type validation;
  - max size validation.
- Private file serving pattern:
  - `GET /api/files/private/<path:file_path>/`
  - endpoint требует auth;
  - путь защищён от directory traversal.
- Документация:
  - `docs/file-storage.md`.

Не добавлялось:

- миграция existing files;
- paid storage provider;
- CDN;
- attachment models.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
```

### Prompt 15 — Internal Dev Tools Boundary Document

Статус: **готово**.

Добавлено:

- Документ `docs/internal-dev-tools-boundary.md`.
- Зафиксировано, что не является public product core:
  - parser;
  - landing generator;
  - developer outreach;
  - prospect scraping.
- Описаны безопасные будущие варианты интеграции:
  - отдельный repo;
  - отдельная БД;
  - API-based integration;
  - controlled import endpoints.

Product core не изменялся.

### Prompt 16 — Final Regression Pass

Статус: **готово**.

Добавлено:

- Финальный отчёт `docs/regression-report.md`.

Проверено:

- backend migrations/check/tests;
- frontend `npm ci`;
- frontend build;
- browser smoke основных public/platform/merchant routes;
- API smoke для website chat, Telegram webhook, AI assistant mock, automation task/notification;
- clean archive без `.env`, `.venv`, `node_modules`, `frontend/dist`, `db.sqlite3`;
- отсутствие реальных токенов в docs/env examples.

Итог:

- Backend: `76 tests OK`;
- Frontend build: OK;
- Critical smoke: OK.

### Prompt A1 — Unified CRM Entity Drawer

Статус: **готово**.

Повторно сверено по `plan/zani_execution_prompts_from_13_05.md` как `01 — A1 Unified CRM Entity Drawer`: **готово и проверено 14.05.2026**.

Добавлено:

- Backend CRM-card endpoints:
  - `GET /api/clients/{id}/crm-card/`
  - `GET /api/leads/{id}/crm-card/`
  - `GET /api/deals/{id}/crm-card/`
  - `GET /api/appointments/{id}/crm-card/`
- Единый backend-сборщик CRM-контекста:
  - client;
  - lead;
  - deal;
  - appointment;
  - связанные leads/deals/appointments;
  - tasks;
  - conversations;
  - timeline;
  - notes.
- Tenant filtering сохранён через существующий `TenantModelViewSet` и `get_object()`.
- Frontend API layer:
  - `frontend/src/api/crmCards.ts`
- Frontend unified drawer:
  - `CrmEntityDrawer`;
  - `CrmEntityHeader`;
  - `CrmEntityTabs`;
  - `ClientCardContent`;
  - `LeadCardContent`;
  - `DealCardContent`;
  - `AppointmentCardContent`;
  - `EntityTimeline`;
  - `EntityTasksPanel`;
  - `EntityConversationsPanel`;
  - `EntityQuickActions`;
  - `EntityNotesPanel`.
- Unified drawer подключён к:
  - clients;
  - leads;
  - deals;
  - appointments;
  - calendar appointment cards.
- Старые формы создания/редактирования сохранены, карточка открывается без full page reload.

Не добавлялось:

- новые модели;
- autonomous AI actions;
- сложный portal UX;
- изменение tenant isolation.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt A2 — Activity Timeline Unification

Статус: **готово**.

Добавлено:

- Усилен существующий `ActivityEvent` слой без создания новых моделей.
- Service-layer:
  - `create_activity_event(...)`;
  - `activity_for_client(client)`;
  - `activity_for_entity(entity_type, entity_id)`.
- `write_activity_event(...)` сохранён как совместимая обёртка для existing callers.
- Timeline hooks для:
  - `client_created`;
  - `lead_created`;
  - `lead_status_changed`;
  - `deal_created`;
  - `deal_stage_changed`;
  - `task_created`;
  - `task_completed`;
  - `appointment_created`;
  - `appointment_cancelled`;
  - `message_received`;
  - `message_sent`;
  - `note_created`;
  - `automation_run`.
- `GET /api/activity-events/` получил фильтры:
  - `business`;
  - `client` и legacy `client_id`;
  - `entity_type`;
  - `entity_id`;
  - `category`;
  - `event_type`;
  - `date_from` / `date_to`;
  - `created_after` / `created_before`;
  - `q`.
- `TimelinePage` обновлён:
  - группировка по датам;
  - иконки по категориям;
  - улучшенный empty state;
  - более человекочитаемое отображение событий.
- Timeline внутри `CrmEntityDrawer` обновлён:
  - compact items;
  - grouping by date;
  - icons per category.

Не добавлялось:

- новые timeline models;
- realtime/websocket;
- внешние analytics providers;
- сложный event bus.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt A3 — Duplicate Detection Foundation

Статус: **готово**.

Добавлено:

- Service-layer:
  - `normalize_phone(phone)`;
  - `normalize_email(email)`;
  - `find_duplicate_clients(...)`;
  - `merge_clients(...)`.
- Backend endpoints:
  - `POST /api/clients/check-duplicates/`;
  - `POST /api/leads/check-duplicates/`;
  - `POST /api/clients/{id}/merge/`.
- Duplicate detection:
  - работает только внутри выбранного `Business`;
  - нормализует телефон;
  - сравнивает email case-insensitive;
  - поддерживает channel ids: WhatsApp, Telegram, Instagram.
- Merge foundation переносит на target client:
  - leads;
  - appointments;
  - classic conversations;
  - bot conversations;
  - tasks;
  - deals;
  - notes;
  - activity events;
  - analytics events;
  - notifications.
- После merge duplicate client удаляется, а действие пишется в audit/activity log.
- Frontend:
  - `ClientForm` проверяет дубли по phone/email;
  - `LeadForm` предупреждает о похожем клиенте или существующей истории;
  - предупреждения не блокируют создание;
  - есть действие “Открыть существующего клиента”;
  - при редактировании клиента доступно базовое “Объединить в текущего”.

Не добавлялось:

- автоматическое объединение без подтверждения;
- сложный conflict-resolution UI;
- fuzzy matching по имени;
- фоновые задачи deduplication.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt A4 — Custom Fields Foundation

Статус: **готово**.

Добавлено:

- Модели:
  - `CustomFieldDefinition`;
  - `CustomFieldValue`.
- Field types:
  - text;
  - textarea;
  - number;
  - money;
  - date;
  - datetime;
  - select;
  - multiselect;
  - boolean;
  - phone;
  - email;
  - url.
- Django Admin для custom fields и values.
- Tenant-safe API:
  - `GET/POST /api/custom-fields/`;
  - `GET/POST /api/custom-field-values/`;
  - `GET /api/custom-fields/?entity_type=client`;
  - `POST /api/custom-field-values/bulk-upsert/`.
- CRM card payload теперь возвращает `custom_fields` для текущей сущности.
- Frontend:
  - Settings page получил simple field builder;
  - custom fields отображаются в CRM drawer;
  - значения custom fields можно редактировать и сохранять из drawer.

Не добавлялось:

- сложный form builder;
- conditional fields;
- permissions per field;
- advanced validation engine.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt A5 — Pipeline and Stage Engine Upgrade

Статус: **готово**.

Добавлено:

- `PipelineStage` расширен:
  - `required_fields_json`;
  - `allowed_roles_json`.
- `Deal` расширен:
  - `lost_reason`;
  - `won_at`;
  - `lost_at`;
  - `stage_entered_at`;
  - `next_action_at`.
- `/api/deals/{id}/move-stage/` усилен:
  - проверяет required fields;
  - проверяет allowed roles;
  - сохраняет `lost_reason`;
  - выставляет `won_at` / `lost_at`;
  - обновляет `stage_entered_at`;
  - пишет activity event.
- `DealSerializer` отдаёт `sla_overdue`.
- Новые endpoints:
  - `GET /api/pipelines/{id}/board/`;
  - `POST /api/pipelines/templates/apply/`.
- Template apply создаёт простую sales pipeline со стадиями и базовыми SLA/required fields.
- Frontend `DealsPage` улучшен без полного переписывания:
  - видны required fields на стадиях;
  - виден SLA overdue на deal cards;
  - lost stage запрашивает причину потери;
  - A1 drawer integration сохранён.

Не добавлялось:

- сложный визуальный stage builder;
- granular field-level permissions UI;
- прогнозирование SLA через AI;
- полная аналитика pipeline velocity.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt A6 — Owner Analytics Dashboard MVP

Статус: **готово**.

Добавлено:

- Backend endpoint:
  - `GET /api/analytics/owner-dashboard/`
- Метрики владельца:
  - `new_leads`;
  - `total_leads`;
  - `leads_by_source`;
  - `appointments_today`;
  - `appointments_completed`;
  - `no_show_count`;
  - `conversion_lead_to_appointment`;
  - `open_tasks`;
  - `overdue_tasks`;
  - `manager_response_time` placeholder;
  - `revenue_estimate`.
- Endpoint tenant-safe: merchant видит только свой business.
- Frontend:
  - `DashboardPage` грузит реальные owner metrics;
  - `AnalyticsPage` грузит реальные owner metrics;
  - сохранены простые lists последних лидов и ближайших записей;
  - добавлены source breakdown и блок “Что требует внимания”.

Не добавлялось:

- BI-графики;
- сложные cohorts;
- manager response time calculation;
- revenue из платежей.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt B1 — Inbox UX Polish

Статус: **готово**.

Повторно сверено по `plan/zani_execution_prompts_from_13_05.md` как `03 — B1 Inbox UX Polish`: **готово и проверено 14.05.2026**.

Добавлено:

- Backend inbox filters усилены:
  - `q` как alias для поиска;
  - `handoff_required=true/false`.
- Backend test покрывает поиск через `q` вместе с `handoff_required`.
- Frontend `ConversationsPage` улучшен без полного переписывания:
  - выбранный диалог сохраняется в URL через `?conversation=`;
  - добавлен фильтр handoff;
  - в header диалога видны handoff/unread indicators;
  - сообщения сгруппированы по датам;
  - `queued` / `failed` состояния сообщений отображаются прямо в bubble;
  - AI suggestion теперь вставляется в composer как черновик, а не только выводится notice;
  - context panel явно показывает linked client и linked lead state.

Не добавлялось:

- WebSocket/realtime;
- полноценная B5 conversation-first AI endpoint;
- WhatsApp production provider;
- полная Conversation → Deal linking логика.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt B5 — AI Reply Suggestions MVP

Статус: **готово**.

Сверено по `plan/zani_execution_prompts_from_13_05.md` как `04 — B5 AI Reply Suggestions MVP`: **готово и проверено 14.05.2026**.

Добавлено:

- Новый conversation-first endpoint:
  - `POST /api/inbox/conversations/{id}/suggest-reply/`
- Endpoint использует существующий AI service-layer и не создаёт второй AI-слой.
- AI context расширен:
  - последние сообщения диалога;
  - linked client data;
  - linked lead data, если есть;
  - AgentProfile;
  - BusinessKnowledgeItem через `run_ai_request`.
- Без `OPENAI_API_KEY` сохраняется mock response.
- Frontend inbox теперь вызывает inbox endpoint, а не legacy bot-conversation endpoint.
- AI suggestion вставляется в composer как черновик.
- Legacy endpoint сохранён:
  - `POST /api/bot-conversations/{id}/suggest-reply/`
- Backend tests покрывают:
  - новый inbox suggest endpoint;
  - client context в AI request log;
  - совместимость legacy bot endpoint.

Не добавлялось:

- auto-send AI replies;
- realtime streaming;
- OpenAI provider configuration UI;
- advanced prompt editor.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt B4 — Conversation to CRM Linking

Статус: **готово**.

Сверено по `plan/zani_execution_prompts_from_13_05.md` как `05 — B4 Conversation to CRM Linking`: **готово и проверено 14.05.2026**.

Добавлено:

- `BotConversation` получил связь со сделкой:
  - `deal`.
- Новая миграция:
  - `apps/bots/migrations/0004_botconversation_deal.py`.
- Inbox conversation serializer теперь отдаёт `deal`.
- Backend endpoints:
  - `POST /api/inbox/conversations/{id}/create-client/`;
  - `POST /api/inbox/conversations/{id}/link-client/`;
  - `POST /api/inbox/conversations/{id}/create-lead/`;
  - `POST /api/inbox/conversations/{id}/link-lead/`;
  - `POST /api/inbox/conversations/{id}/create-deal/`;
  - `POST /api/inbox/conversations/{id}/link-deal/`.
- `create-client` проверяет дубли через существующий duplicate service-layer.
- `create-deal` создаёт сделку на default pipeline/stage или создаёт простой pipeline/stage, если у бизнеса их ещё нет.
- `link-deal` подтягивает client/lead context из сделки, если в диалоге он ещё не заполнен.
- Frontend inbox context panel:
  - показывает linked client/lead/deal state;
  - умеет создать клиента;
  - умеет создать заявку;
  - умеет создать сделку;
  - умеет привязать client/lead/deal по ID.
- Backend tests покрывают:
  - duplicate warning при создании клиента из диалога;
  - link client;
  - forced create client;
  - create deal;
  - link deal.

Не добавлялось:

- полноценный search modal для выбора существующего client/lead/deal;
- complex duplicate merge UI внутри inbox;
- Conversation → classic `Conversation` model bridge;
- визуальный CRM card opening из context panel.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt C1 — RBAC/ABAC Foundation and Team Access

Статус: **готово**.

Сверено по `plan/zani_execution_prompts_from_13_05.md` как `10 — C1 RBAC/ABAC Foundation and Team Access`: **готово и проверено 14.05.2026**.

Добавлено:

- Расширен `BusinessMember` без поломки старых ролей:
  - `owner`;
  - `admin`;
  - `manager`;
  - `operator`;
  - `marketer`;
  - `accountant`;
  - `support`;
  - `staff`.
- Добавлены модели:
  - `RolePreset`;
  - `BusinessRole`;
  - `RolePermission`;
  - `Team`;
  - `TeamMember`.
- Добавлен service-layer `apps.businesses.access`:
  - `can(...)`;
  - `assert_can(...)`;
  - `scope_queryset(...)`;
  - `user_scope_for(...)`;
  - `effective_permissions_for(...)`;
  - default role presets;
  - dangerous action restrictions for billing/integrations/team.
- Добавлены team/access endpoints:
  - `/api/team/members/`;
  - `/api/team/roles/`;
  - `/api/team/role-permissions/`;
  - `/api/team/departments/`;
  - `/api/team/department-members/`;
  - `/api/team/permissions/catalog/`.
- `GET /api/auth/me/` теперь отдаёт:
  - memberships;
  - effective permissions per business.
- Settings получил:
  - `Team & Access`;
  - управление ролями сотрудников;
  - базовые отделы;
  - `Roles simple mode`.
- Permission changes пишутся в `AuditLog`.
- Миграция:
  - `apps/businesses/migrations/0002_rolepreset_alter_businessmember_role_businessrole_and_more.py`.

Не добавлялось:

- полное object-level ограничение всех CRM queryset по own/team scope;
- сложная technical permission matrix в UI;
- invite emails;
- SSO/SCIM;
- payroll/HR logic.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py migrate
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt C1.1 — Scoped CRM Querysets and Object-Level Permissions

Статус: **готово**.

Сверено по `plan/zani_execution_prompts_from_13_05.md` как `11 — C1.1 Scoped CRM Querysets and Object-Level Permissions`: **готово и проверено 14.05.2026**.

Добавлено:

- `TenantModelViewSet` теперь применяет RBAC/ABAC на backend:
  - list/retrieve через `view`;
  - create через `create`;
  - update/partial_update через `update`;
  - destroy через `delete`.
- Scoped queryset filtering подключен для ключевых CRM сущностей:
  - clients;
  - leads;
  - deals;
  - appointments;
  - tasks;
  - conversations;
  - analytics;
  - automations;
  - settings/custom fields.
- `scope_queryset(...)` теперь поддерживает own scope через поля:
  - `responsible_user`;
  - `assigned_to`;
  - `owner`;
  - `assignee`;
  - `created_by`;
  - `user`.
- Inbox actions защищены backend permissions:
  - send message;
  - assign;
  - handoff;
  - mark-read;
  - create/link client;
  - create/link lead;
  - create/link deal;
  - create task.
- Owner analytics endpoint проверяет `analytics.view` и использует scoped querysets.
- Billing usage/current subscription endpoint проверяет `billing.view`.
- Business settings update проверяет `settings.update`.
- Frontend sidebar скрывает разделы по `effective_permissions` из `/api/auth/me/`.
- Добавлены backend tests:
  - own-scope manager видит только свои deals;
  - operator не открывает owner analytics;
  - staff не открывает billing usage.

Не добавлялось:

- визуальный редактор сложной permission matrix;
- row-level policies на уровне PostgreSQL;
- exports permissions;
- invite flow;
- audit diff для каждого поля CRM.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt C1.2 — Soft Delete, Archive and Accountability Guardrails

Статус: **готово**.

Сверено по `plan/zani_execution_prompts_from_13_05.md` как `12 — C1.2 Soft Delete, Archive and Accountability Guardrails`: **готово и проверено 14.05.2026**.

Добавлено:

- Soft archive fields для критичных CRM сущностей:
  - Client;
  - Lead;
  - Deal;
  - Appointment;
  - Task;
  - Conversation;
  - BotConversation.
- Общий archive service-layer:
  - `archive_instance(...)`;
  - `restore_instance(...)`;
  - `can_hard_delete(...)`.
- `TenantModelViewSet` теперь:
  - скрывает archived records по умолчанию;
  - поддерживает `include_archived=true`;
  - добавляет `POST /archive/`;
  - добавляет `POST /restore/`;
  - превращает обычный `DELETE` в soft archive для archive-capable сущностей;
  - разрешает hard delete только owner/admin через `hard_delete=true`.
- Lead lost flow:
  - `lost_reason` обязателен;
  - фиксируются `lost_by`, `lost_at`, `previous_status`.
- Deal lost flow:
  - `lost_reason` обязателен;
  - фиксируются `lost_by`, `lost_at`, `previous_status`, `previous_stage`.
- Audit/activity пишутся при archive/restore/lost updates.
- Frontend:
  - CRUD API получил `archive(...)` и `restore(...)`;
  - Clients page использует archive вместо delete;
  - Appointments page использует archive вместо delete;
  - Leads kanban требует reason при переводе в lost;
  - Lead cards получили archive action.
- Backend tests покрывают:
  - manager archive вместо hard delete;
  - archived records скрыты по умолчанию;
  - owner restore;
  - lost lead требует reason и фиксирует актёра.

Не добавлялось:

- отдельная красивая reason modal вместо нативного prompt во всех местах;
- bulk archive;
- full archived records management screen;
- PostgreSQL RLS.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py migrate
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt B2 — Quick Replies and Templates

Статус: **готово**.

Сверено по `plan/zani_execution_prompts_from_13_05.md` как `13 — B2 Quick Replies and Templates`: **готово и проверено 15.05.2026**.

Добавлено:

- Backend model `QuickReplyTemplate` для tenant-safe быстрых ответов:
  - `business`;
  - `title`;
  - `text`;
  - `category`;
  - `channel`;
  - `sort_order`;
  - `is_active`.
- API:
  - `/api/quick-replies/`
  - фильтры по `channel`, `is_active`, `q`.
- Django Admin для quick replies.
- Inbox composer:
  - поиск по шаблонам;
  - фильтрация по каналу выбранного диалога;
  - вставка шаблона в draft;
  - шаблон не отправляется автоматически.
- Settings → Quick replies:
  - создание шаблона;
  - категория;
  - канал;
  - многострочный текст;
  - редактирование;
  - включение/отключение;
  - удаление.
- Backend test подтверждает tenant filtering quick replies.

Не добавлялось:

- автогенерация шаблонов через AI;
- массовый импорт/экспорт шаблонов;
- approval workflow для шаблонов;
- мультиязычные варианты шаблонов.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt C2 — Task Management Upgrade

Статус: **готово**.

Сверено по `plan/zani_execution_prompts_from_13_05.md` как `14 — C2 Task Management Upgrade`: **готово и проверено 15.05.2026**.

Добавлено:

- Backend task upgrade:
  - `parent_task`;
  - `watchers`;
  - `completed_by`;
  - `snoozed_until`;
  - `TaskComment`.
- API actions:
  - `POST /api/tasks/{id}/reopen/`;
  - `POST /api/tasks/{id}/snooze/`;
  - `POST /api/tasks/{id}/assign/`;
  - `POST /api/tasks/{id}/add-watcher/`;
  - `POST /api/tasks/{id}/add-comment/`;
  - `GET /api/tasks/{id}/comments/`.
- Task filters foundation:
  - `tab=my`;
  - `tab=today`;
  - `tab=overdue`.
- Existing status actions hardened with backend permission checks.
- Task completion now stores `completed_by`.
- Tasks page:
  - tabs: Мои, Сегодня, Просрочены, Команда;
  - task details modal;
  - comments;
  - assign-to-me;
  - watch task;
  - snooze task;
  - reopen completed/cancelled task.
- CRM drawer already shows linked tasks through the unified CRM card payload.
- Dashboard already surfaces open and overdue tasks through owner dashboard metrics.

Не добавлялось:

- heavy project management;
- complex dependencies graph;
- calendar sync;
- recurring task materialization;
- advanced watcher management UI by user picker.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py migrate
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt C3 — Automation Builder UI Simple Mode

Статус: **готово**.

Сверено по `plan/zani_execution_prompts_from_13_05.md` как `15 — C3 Automation Builder UI Simple Mode`: **готово и проверено 15.05.2026**.

Добавлено:

- Простой режим автоматизаций поверх существующего engine.
- Backend endpoint:
  - `GET /api/automation-rules/templates/`;
  - `POST /api/automation-rules/apply-template/`.
- Curated templates:
  - новая заявка -> задача менеджеру;
  - новая запись -> подготовить визит;
  - новое сообщение -> задача ответить.
- Применение шаблона создает:
  - `AutomationRule`;
  - связанные `AutomationAction`;
  - условия, если они появятся в шаблоне.
- Backend permission check через `automations.create`.
- Automations page:
  - блок шаблонов;
  - добавить черновик;
  - добавить и сразу включить;
  - включить/отключить существующее правило;
  - журнал последних запусков.
- Backend test подтверждает список шаблонов и применение шаблона.

Не добавлялось:

- advanced trigger-condition-action builder;
- preview/test-run UI;
- сложная визуальная canvas-схема;
- webhook delivery implementation.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt C4 — Automation Builder Advanced Mode

Статус: **готово**.

Сверено по `plan/zani_execution_prompts_from_13_05.md` как `16 — C4 Automation Builder Advanced Mode`: **готово и проверено 15.05.2026**.

Добавлено:

- Advanced builder после simple mode, без второго automation engine.
- Backend endpoints:
  - `POST /api/automation-rules/preview/`;
  - `POST /api/automation-rules/create-manual/`.
- Manual payload validation:
  - trigger validation;
  - condition rows;
  - action rows;
  - минимум одно действие;
  - запрет unsupported actions текущего engine.
- Поддержанные advanced actions:
  - `create_task`;
  - `create_notification`;
  - `wait`.
- `wait` подключен в engine как безопасный no-op/delay placeholder для будущего async исполнения.
- Preview возвращает:
  - валидность;
  - trigger summary;
  - количество условий;
  - количество действий;
  - steps для проверки перед сохранением.
- Frontend Automations page:
  - отдельный Advanced builder modal;
  - trigger selector;
  - condition rows;
  - action rows;
  - delay seconds;
  - JSON config для actions;
  - обязательный preview/test-run перед сохранением.
- Backend tests покрывают:
  - preview manual rule;
  - create manual rule;
  - invalid manual rule rejection.

Не добавлялось:

- canvas/drag-and-drop builder;
- реальное отложенное выполнение `wait` через Celery;
- webhook delivery;
- AI action execution;
- сложный visual debugger.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt C1.3 — Department Analytics Visibility and Manager Accountability

Статус: **готово**.

Сверено по `plan/zani_execution_prompts_from_13_05.md` как `17 — C1.3 Department Analytics Visibility and Manager Accountability`: **готово и проверено 19.05.2026**.

Добавлено:

- Backend endpoint:
  - `GET /api/team/performance/`.
- Metrics:
  - assigned leads;
  - contacted leads;
  - lost leads;
  - lost reason breakdown;
  - overdue handoffs;
  - missed chat handoffs;
  - avg response time placeholder;
  - appointments created;
  - deals won/lost;
  - tasks overdue/completed.
- Filters foundation:
  - `business`;
  - `start`;
  - `end`;
  - `team`;
  - `manager`;
  - `source`;
  - `pipeline`.
- Visibility rules:
  - owner/admin see all active business members;
  - team lead sees own department/team;
  - manager/marketer/accountant with analytics permission see own metrics;
  - operator/staff without permission get `403`.
- Warning list:
  - lost без причины;
  - handoff просрочен;
  - чат без ответа;
  - задачи просрочены.
- Frontend Analytics page:
  - Team performance section;
  - totals cards;
  - employee cards;
  - warning list;
  - friendly forbidden state.
- Backend tests покрывают:
  - owner sees all;
  - team lead sees own team;
  - operator cannot open team performance.

Не добавлялось:

- тяжелый BI dashboard;
- точный response-time calculation;
- SLA by stage deepening;
- scheduled reports;
- exports.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

## Структура проекта

```text
apps/
  accounts/        # User, auth profile endpoints, roles
  ai_core/         # AI request logs, business knowledge and AI service abstraction
  billing/         # Subscription plans and subscriptions
  bots/            # AI bot foundation, channels, bot conversations/messages
  businesses/      # Business, BusinessMember, teams, RBAC/ABAC roles
  clients/         # Merchant clients
  crm/             # Pipelines, stages, deals
  leads/           # Leads and lead actions
  scheduling/      # Resources, working hours, appointments, slot services
  services/        # Merchant services
  conversations/   # Conversations and messages
  notifications/   # Notifications and reminders
  analytics/       # Analytics events
  activities/      # Timeline/activity events, tags, notes
  automations/     # Automation foundation
  integrations/    # Telegram and future integration skeletons
  tasks/           # CRM tasks
  core/            # Shared permissions, audit, health, base viewsets

config/            # Django settings, urls, celery config
frontend/          # React + TypeScript app
  src/features/public/ # Public Zani website shell
plan/              # Product/implementation roadmap prompts
```

Планируемые будущие product apps по roadmap:

- AI Assistant for CRM.
- AI Bot Replies MVP.

Internal developer tools не должны смешиваться с public product core. Parser, landing generator и developer outreach будут вынесены отдельно на соответствующем этапе.

## Минимальные сервисы для работы сейчас

Для локальной минимальной работы **без Redis, Sentry, Celery и внешних AI-сервисов** достаточно:

1. **Python 3.11+ / Django**
   - Запускает backend API и Django Admin.

2. **SQLite или PostgreSQL**
   - Для локального MVP можно использовать текущий SQLite `db.sqlite3`.
   - Для командной работы или деплоя лучше сразу PostgreSQL/Supabase.

3. **Node.js + npm**
   - Запускает React frontend через Vite.

4. **Браузер**
   - Merchant CRM: `http://localhost:5173/` или порт, который выберет Vite.
   - Backend/Admin: `http://localhost:8000/admin/`.

Минимально необязательные на текущем этапе:

- Redis — пока не нужен, если не запускаем Celery worker и фоновые задачи.
- Celery — пока не нужен для ручной работы CRM.
- Sentry — пока не нужен для локального MVP.
- OpenAI API — необязателен для локального MVP: без ключа AI-сервисы возвращают mock/draft ответы.
- Telegram/WhatsApp/Instagram APIs — пока не нужны, integrations stages еще не реализованы.
- Object storage/S3 — пока не нужен, если нет файлов и вложений.

## Локальный запуск

### Backend

```bash
cd /Users/maksim/Desktop/Zani
cp .env.example .env
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py create_platform_admin --email admin@zani.local --password admin12345
.venv/bin/python manage.py runserver 0.0.0.0:8000
```

Если `.venv` уже создан:

```bash
.venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate
```

### Frontend

Во втором терминале:

```bash
cd /Users/maksim/Desktop/Zani/frontend
npm ci
npm run dev
```

Vite проксирует `/api` на `http://localhost:8000`.

## API

Frontend routes:

- `/` — public home.
- `/pricing` — public pricing shell.
- `/bots` — public bots shell.
- `/crm` — public CRM shell.
- `/contacts` — public contacts shell.
- `/dashboard` — Merchant CRM dashboard.
- `/platform` — Platform Admin overview.
- `/platform/merchants` — Platform Admin merchants table.

Auth:

- `POST /api/auth/token/`
- `POST /api/auth/token/refresh/`
- `GET /api/auth/me/`

Billing:

- `GET /api/billing/plans/`
- `GET /api/billing/current-subscription/`

Platform:

- `GET /api/platform/ping/`
- `GET /api/platform/overview/`
- `GET /api/platform/merchants/`

Merchant CRM:

- `/api/businesses/`
- `/api/business-members/`
- `/api/clients/`
- `/api/pipelines/`
- `/api/pipeline-stages/`
- `/api/deals/`
- `/api/tasks/`
- `/api/services/`
- `/api/leads/`
- `/api/resources/`
- `/api/working-hours/`
- `/api/appointments/`
- `/api/conversations/`
- `/api/messages/`
- `/api/notifications/`
- `/api/analytics-events/`
- `/api/activity-events/`
- `/api/notes/`
- `/api/tags/`
- `/api/automation-rules/`

Unified Inbox:

- `/api/inbox/conversations/`
- `/api/inbox/conversations/{id}/messages/`
- `/api/inbox/conversations/{id}/assign/`
- `/api/inbox/conversations/{id}/handoff/`
- `/api/inbox/conversations/{id}/mark-read/`

Team & Access:

- `/api/team/members/`
- `/api/team/roles/`
- `/api/team/role-permissions/`
- `/api/team/departments/`
- `/api/team/department-members/`
- `/api/team/permissions/catalog/`

Import / Export:

- `GET /api/import-jobs/`
- `POST /api/import-jobs/`
- `POST /api/import-jobs/{id}/preview/`
- `POST /api/import-jobs/{id}/confirm/`
- `GET /api/export/clients/?business=`
- `GET /api/export/leads/?business=`
- `GET /api/export/deals/?business=`

Lead Forms:

- `GET/POST /api/lead-forms/`
- `POST /api/lead-forms/create-template/`
- `GET/POST /api/lead-form-fields/`
- `GET /api/lead-form-submissions/`
- `GET /api/public/forms/{public_id}/`
- `POST /api/public/forms/{public_id}/submit/`

### Prompt C1.4 — Security UX for Roles Without Bitrix Complexity

Что добавлено:

- В `Settings -> Команда и доступы` добавлен простой поток настройки: сотрудник -> preset role -> видимость.
- При смене роли сотруднику назначается совместимый `BusinessRole` preset, чтобы frontend-роль и backend permissions не расходились.
- Сырые permissions скрыты за кнопкой `Advanced`; первый экран показывает бизнес-смысл роли, а не техническую матрицу.
- Advanced-группы оформлены понятными блоками: Продажи, Клиенты, Чаты, Календарь, Задачи, Аналитика, Настройки, Экспорт, Безопасность.
- Уровни доступа показываются человеческими labels: нет доступа, только своё, своя команда, весь бизнес.
- Direct route access теперь защищён на frontend: если пользователь открыл скрытый раздел по URL, он видит понятный forbidden state с объяснением.
- Sidebar продолжает скрывать недоступные разделы по `effective_permissions`.

Что важно:

- Backend permission layer остаётся источником истины.
- Advanced-изменения роли применяются ко всем сотрудникам, использующим этот preset.
- Новый сотрудник по модели `BusinessMember` остаётся на безопасном default `staff`, если владелец не назначил другую роль.

### Prompt C5 — Manager Performance and SLA Deepening

Что добавлено:

- `/api/team/performance/` расширен без дублирования endpoint.
- Метрики по сотрудникам:
  - среднее время ответа в чатах;
  - contacted/closed/lost leads;
  - conversion lead -> appointment;
  - lost rate;
  - no-show appointments;
  - overdue handoffs;
  - missed chat handoffs;
  - overdue tasks;
  - SLA overdue deals;
  - won/lost deals.
- Добавлены team aggregates: показатели по отделам/командам для owner/admin и team lead scope.
- Добавлен `action_items` list: короткий список того, что руководителю нужно сделать прямо сейчас.
- `AnalyticsPage` получила расширенный Team Performance блок:
  - conversion/SLA/no-show;
  - manager cards;
  - team tab;
  - кликабельный action list.
- RBAC/visibility сохранены:
  - owner/admin видят команду;
  - team lead видит свою команду;
  - manager с analytics scope видит себя;
  - operator/staff не видят чужую аналитику.

Что не добавлялось:

- тяжёлый BI dashboard;
- прогнозирование SLA;
- realtime analytics;
- отдельный новый endpoint вместо уже существующего.

### Prompt C6 — Import and Export Foundation

Что добавлено:

- Модель `ImportJob` для истории импорта:
  - business;
  - actor;
  - entity_type;
  - source_file;
  - mapping_json;
  - preview_json;
  - duplicates_json;
  - status;
  - total/imported counters.
- CSV/XLSX upload foundation:
  - CSV работает из коробки;
  - XLSX поддерживается через `openpyxl` из `requirements.txt`;
  - если зависимость не установлена локально, ошибка появляется только при XLSX import, а не при старте Django.
- Controlled import flow:
  - upload;
  - mapping preview;
  - duplicate preview;
  - confirm import.
- На текущем этапе подтверждённый импорт создаёт клиентов.
- Duplicate preview использует существующий duplicate detection service.
- Export endpoints:
  - clients;
  - leads;
  - deals.
- Export проверяет permissions и пишет `AuditLog`.
- Settings page получила компактный блок `Import / Export`:
  - загрузка CSV/XLSX клиентов;
  - preview mapping;
  - duplicate count;
  - confirm import;
  - история последних import jobs;
  - CSV export clients/leads/deals.
- Миграция:
  - `apps/core/migrations/0003_importjob.py`.

Ограничение rollback:

- На этом foundation-этапе rollback не удаляет импортированные записи автоматически.
- Безопасная стратегия сейчас: импорт виден в истории, экспорт/импорт логируются в audit, ошибочные записи можно архивировать через существующий soft archive механизм.
- Полный rollback по job будет отдельным этапом, если понадобится массовый импорт для больших клиентских баз.

Что не добавлялось:

- массовый import leads/deals;
- сложный column mapping editor;
- background import через Celery;
- дедупликация с merge wizard во время импорта.

### Prompt D1 — Forms and Lead Capture

Что добавлено:

- Модели:
  - `LeadForm`;
  - `LeadFormField`;
  - `LeadFormSubmission`.
- Public endpoints:
  - `GET /api/public/forms/{public_id}/`;
  - `POST /api/public/forms/{public_id}/submit/`.
- Authenticated setup endpoints:
  - `/api/lead-forms/`;
  - `/api/lead-form-fields/`;
  - `/api/lead-form-submissions/`;
  - `POST /api/lead-forms/create-template/`.
- Public submit flow:
  - валидирует required fields;
  - собирает UTM fields;
  - проверяет дубли через существующий duplicate detection service;
  - переиспользует найденного клиента или создаёт нового;
  - создаёт `Lead`;
  - назначает default responsible user или owner бизнеса;
  - сохраняет `LeadFormSubmission`;
  - создаёт `AnalyticsEvent.form_submitted`;
  - создаёт activity event;
  - запускает automation trigger `lead_created`.
- Settings page получила блок `Формы заявок`:
  - создание формы из template;
  - список форм;
  - fields preview;
  - embed code;
  - последние submissions.
- Миграция:
  - `apps/leads/migrations/0003_leadform_leadformfield_leadformsubmission_and_more.py`.

Что не добавлялось:

- визуальный form builder;
- anti-spam/captcha;
- custom thank-you page;
- полноценный hosted public form frontend;
- A/B tests и analytics по конверсии форм.

### Prompt D2 — Tags and Smart Segments

Что добавлено:

- Расширен существующий tagging layer в `activities`, без второго параллельного механизма тегов.
- Новые модели:
  - `Segment`;
  - `SegmentFilter`.
- Segment filters поддерживают клиентов по:
  - имени;
  - телефону;
  - email;
  - источнику;
  - заметкам;
  - тегу;
  - дате создания.
- API:
  - `/api/tags/`;
  - `/api/tagged-objects/`;
  - `/api/segments/`;
  - `/api/segment-filters/`;
  - `GET /api/segments/{id}/evaluate/`;
  - `POST /api/segments/{id}/refresh-count/`.
- `/api/clients/` получил tenant-safe filters:
  - `q`;
  - `source`;
  - `tag`;
  - `segment`.
- CRM card теперь возвращает `tags`, а drawer показывает теги клиента.
- Clients page получила:
  - быстрый поиск;
  - фильтр по источнику;
  - фильтр по тегу;
  - фильтр по сохранённому сегменту;
  - быстрый add tag для клиента;
  - создание простого сегмента из UI.
- Сегменты имеют cached count и могут быть пересчитаны через API.
- Миграции:
  - `apps/activities/migrations/0002_segment_segmentfilter_and_more.py`;
  - `apps/activities/migrations/0003_alter_taggedobject_options.py`.

Что не добавлялось:

- сложный visual segment builder;
- nested AND/OR groups;
- outreach campaigns;
- AI auto-tagging;
- background refresh segment counts через Celery.

### Prompt D4 — Notification Center Upgrade

Что добавлено:

- Существующая модель `Notification` расширена без создания параллельной системы уведомлений.
- Новые поля:
  - `category`;
  - `priority`;
  - `action_url`;
  - `action_label`;
  - `read_at`.
- `client` теперь может быть пустым, чтобы поддерживать системные/командные уведомления без привязки к клиенту.
- Категории:
  - sales;
  - finance;
  - system;
  - ai_alerts;
  - outreach;
  - tasks.
- Приоритеты:
  - low;
  - normal;
  - high;
  - urgent.
- API:
  - filters: `status`, `channel`, `category`, `priority`, `unread`, `due`;
  - `POST /api/notifications/{id}/mark-read/`;
  - `POST /api/notifications/{id}/mark-unread/`;
  - `POST /api/notifications/mark-all-read/`;
  - расширенный `GET /api/notifications/summary/` с unread/urgent/category counters.
- Header notification dropdown обновлён:
  - unread badge;
  - grouped notifications по category;
  - priority chips;
  - action buttons с deep-link;
  - mark read;
  - mark all read;
  - mobile-friendly dropdown size.
- Старые reminder notifications продолжают работать через `status/channel/send_at`.
- Миграция:
  - `apps/notifications/migrations/0002_alter_notification_options_notification_action_label_and_more.py`.

Что не добавлялось:

- realtime WebSocket notifications;
- push notifications;
- email delivery provider;
- user-specific notification subscriptions;
- notification digest scheduler.

### Prompt D5 — Security and Audit Center

Что добавлено:

- Существующий `AuditLog` расширен без создания второй audit-системы.
- Новые поля `AuditLog`:
  - `category`;
  - `risk_level`.
- Новая модель `LoginHistory`:
  - business;
  - user;
  - email;
  - status;
  - ip;
  - user_agent.
- Login history пишется при JWT login:
  - successful login;
  - failed login.
- Добавлен ресурс прав `audit_logs`:
  - `view`;
  - `manage`.
- Owner/admin получают доступ через существующий wildcard manage.
- Custom roles могут получить явный `audit_logs.view`.
- Security API:
  - `GET /api/security/audit/`;
  - `GET /api/security/login-history/`;
  - `GET /api/security/risk-summary/`;
  - `/api/security/support-grants/`.
- Фильтры audit stream:
  - actor;
  - entity_type;
  - action;
  - risk;
  - category;
  - date_from/date_to.
- Support access grants:
  - создаются через owner/admin/audit manage;
  - пишут audit log с high risk.
- Risk inference:
  - export/permission/support access = high;
  - archive/restore/lost = medium;
  - delete/hard delete = critical;
  - обычные create/update = low.
- Settings page получила блок `Security center`:
  - high/critical counters;
  - failed login counter;
  - active support grants counter;
  - recent audit stream;
  - login history;
  - support grants.
- Миграция:
  - `apps/core/migrations/0004_loginhistory_auditlog_category_auditlog_risk_level_and_more.py`.

Что не добавлялось:

- полноценная SOC/SIEM интеграция;
- realtime security alerts;
- device fingerprinting;
- геолокация IP;
- принудительное MFA.

### Prompt B3 — WhatsApp Integration Foundation

Что добавлено:

- WhatsApp подключён через существующий provider layer, без привязки к paid provider.
- Новый `WhatsAppProvider` поддерживает:
  - `mock` mode;
  - `disabled` mode;
  - inbound webhook parsing;
  - outbound send abstraction;
  - запись outbound events в `IntegrationEventLog`.
- Новый service-layer `apps/integrations/whatsapp.py`:
  - проверка webhook secret;
  - резолв `BotChannel`;
  - создание/переиспользование `BotConversation`;
  - создание inbound `BotMessage`;
  - запись inbound `IntegrationEventLog`;
  - запуск automation trigger `bot_message_received`.
- API:
  - `POST /api/integrations/whatsapp/webhook/`;
  - `POST /api/bot-channels/{id}/whatsapp-config/`;
  - `GET /api/bot-channels/{id}/whatsapp-status/`;
  - `GET /api/integration-event-logs/`.
- Логи интеграций доступны tenant-safe:
  - фильтры `provider`, `channel`, `status`, `direction`;
  - merchant видит только логи своих businesses;
  - доступ идёт через `integrations.view`.
- BotDetail получил отдельный WhatsApp setup блок:
  - provider mode;
  - webhook secret;
  - phone number id;
  - webhook URL;
  - health/status;
  - inbound/outbound logs.
- Telegram provider сохранён и покрыт regression tests.

Что не добавлялось:

- Meta Cloud API / Wazzup / 360dialog credentials;
- реальные paid provider calls;
- WebSocket realtime status;
- retry queue через Celery.

### Prompt B6 — Attachments MVP

Что добавлено:

- Новая модель `FileAttachment`:
  - business;
  - uploaded_by;
  - private file;
  - original_name;
  - content_type;
  - size;
  - entity_type/entity_id;
  - visibility;
  - created_at.
- Файлы проходят через существующий `validate_file_upload`:
  - allowed extensions;
  - allowed content types;
  - max upload size.
- API:
  - `GET /api/file-attachments/`;
  - `POST /api/file-attachments/`;
  - `GET /api/file-attachments/{id}/download/`.
- Private download идёт через backend endpoint и object-level permission check.
- Поддержанные сущности:
  - client;
  - lead;
  - deal;
  - appointment;
  - task;
  - bot_conversation;
  - bot_message.
- Inbox получил upload button в composer.
- Вложения выбранного диалога отображаются в правом context panel.
- Вложения сообщений отображаются внутри message bubble, если файл привязан к `bot_message`.
- CRM drawer показывает вложения в overview клиента/сущности.
- Tenant isolation:
  - merchant не видит чужие файлы в списке;
  - merchant не может скачать файл чужого бизнеса;
  - forbidden extension отклоняется до сохранения.
- Миграция:
  - `apps/core/migrations/0005_fileattachment.py`.

Что не добавлялось:

- публичные file URLs;
- S3/Supabase credentials;
- thumbnail generation;
- virus scanning;
- per-plan storage quotas;
- audit on every download.

### Prompt D3 — Public API Tokens and Webhooks

Что добавлено:

- Новые integration-модели:
  - `ApiToken`;
  - `WebhookEndpoint`;
  - `WebhookDeliveryLog`.
- API tokens работают как scoped tokens:
  - raw token показывается только один раз;
  - в базе хранится hash и prefix;
  - unscoped token нельзя создать;
  - поддержаны rotate/revoke;
  - `last_used_at` обновляется при успешном использовании.
- Public API foundation:
  - `GET /api/public-api/clients/`;
  - доступ только по `X-Zani-Api-Key` или `Authorization: Bearer`;
  - scope `clients:read`;
  - tenant isolation: токен видит только данные своего `business`;
  - rate limit через DRF throttle scope `public_api`.
- Webhooks foundation:
  - endpoints с events list и signing secret;
  - delivery logs;
  - idempotency key;
  - attempts;
  - retry failed delivery;
  - dev URLs `mock://success` и `mock://fail` для безопасного тестирования без внешних сервисов.
- API:
  - `GET/POST /api/api-tokens/`;
  - `POST /api/api-tokens/{id}/rotate/`;
  - `POST /api/api-tokens/{id}/revoke/`;
  - `GET/POST /api/webhook-endpoints/`;
  - `POST /api/webhook-endpoints/{id}/test-delivery/`;
  - `GET /api/webhook-deliveries/`;
  - `POST /api/webhook-deliveries/{id}/retry/`.
- Settings получил отдельный блок `Developers`:
  - создание API token;
  - copy raw token once;
  - rotate/revoke token;
  - создание webhook endpoint;
  - copy webhook secret;
  - test delivery;
  - delivery logs;
  - retry failed delivery.
- Admin:
  - `ApiToken`;
  - `WebhookEndpoint`;
  - `WebhookDeliveryLog`.
- Security:
  - dangerous developer actions требуют `integrations.manage`;
  - operator не может управлять developer tokens/webhooks;
  - другой merchant не видит tokens/webhooks/deliveries чужого бизнеса.
- Миграция:
  - `apps/integrations/migrations/0002_webhookendpoint_webhookdeliverylog_apitoken_and_more.py`.

Что не добавлялось:

- OAuth2 app marketplace;
- публичная OpenAPI-документация;
- background retry через Celery;
- production webhook queue;
- write public API endpoints;
- per-token IP allowlist.

### Prompt D6 — Onboarding Templates by Niche

Что добавлено:

- Новый backend-модуль `apps.onboarding` без отдельной таблицы состояния:
  - шаблоны ниш хранятся как curated config;
  - checklist считается по реальным CRM-данным бизнеса;
  - demo flow создаёт реальные CRM-сущности.
- Поддержанные niche templates:
  - dentistry;
  - beauty;
  - sauna;
  - autoservice;
  - education;
  - medical;
  - other.
- Каждый шаблон включает:
  - pipeline stages;
  - услуги;
  - ресурсы;
  - общий график работы;
  - quick replies;
  - базовые automation rules/actions.
- API:
  - `GET /api/onboarding/templates/`;
  - `GET /api/onboarding/status/?business=`;
  - `POST /api/onboarding/apply-template/`;
  - `POST /api/onboarding/demo-data/`.
- `apply-template`:
  - обновляет `business_type`;
  - применяет структуру CRM;
  - не требует внешних сервисов;
  - работает tenant-safe через `settings.update`.
- `demo-data` создаёт первый рабочий сценарий:
  - demo client;
  - lead;
  - deal;
  - appointment;
  - task.
- Frontend:
  - новая страница `/dashboard/onboarding`;
  - пункт `Быстрый старт` в sidebar;
  - выбор шаблона ниши;
  - preview услуг/ресурсов/pipeline/replies;
  - кнопка применить шаблон;
  - кнопка создать demo flow;
  - setup checklist с progress percent;
  - dashboard показывает CTA, если быстрый старт не завершён.
- Permissions:
  - owner/admin могут применять шаблон;
  - operator не может применять onboarding template;
  - чужой merchant не может читать checklist другого бизнеса.

Что не добавлялось:

- отдельная таблица onboarding-сессий;
- сложный multi-step form builder;
- AI-generated onboarding;
- paid provider setup;
- email/SMS wizard.

### Prompt D7 — Mobile-First Polish Pass

Что улучшено:

- Общий mobile overflow guard:
  - `html`, `body`, `#root` больше не дают горизонтальный scroll из-за случайного широкого блока.
- `Modal`:
  - на mobile открывается как bottom-friendly panel;
  - высота ограничена `100dvh`;
  - header закреплён сверху;
  - title не ломает layout;
  - close target остаётся крупным.
- `CrmEntityDrawer`:
  - на mobile занимает полный экран без странного левого радиуса;
  - desktop drawer сохранил rounded left style.
- `GlobalSearch`:
  - mobile results теперь fixed относительно viewport;
  - popup не вылезает за экран из-за вложенного absolute контейнера.
- `MobileNav`:
  - увеличены touch targets;
  - подписи центрируются и не распирают кнопку;
  - нижняя навигация стала чуть плотнее и стабильнее.
- `PageHeader`:
  - длинные заголовки переносятся;
  - action area на mobile занимает доступную ширину и не создаёт горизонтальный overflow.

Что не делалось:

- полный визуальный редизайн всех страниц;
- ручная проверка каждого device/browser;
- изменение бизнес-логики CRM;
- замена kanban/inbox/calendar layout.

### Prompt D8 — Final Competitive QA Pass

Что добавлено:

- Создан финальный competitive QA report:
  - `docs/competitive-regression-report.md`.
- Отчёт проверяет ключевые зоны:
  - CRM core;
  - clients/leads/appointments;
  - deals/pipelines/kanban;
  - CRM card;
  - inbox/conversations;
  - tasks;
  - RBAC;
  - audit/security;
  - notifications;
  - automations;
  - analytics;
  - import/export;
  - custom fields;
  - tags/segments;
  - integrations;
  - public API/webhooks;
  - file storage;
  - onboarding;
  - platform admin;
  - billing;
  - mobile UX;
  - production infra;
  - realtime.
- Каждая зона классифицирована как:
  - Ready;
  - Partial;
  - Gap;
  - Stronger-than-competitors opportunity.
- Зафиксированы critical gaps для 10,000 merchants:
  - production infrastructure;
  - storage readiness;
  - realtime layer;
  - automation runtime hardening;
  - provider production contracts;
  - reporting depth;
  - e2e QA;
  - performance/load testing;
  - data lifecycle;
  - entitlement enforcement.
- Зафиксированы next critical tasks и архитектурные запреты.

Проверки:

- последний backend suite: `176 tests OK`;
- последний frontend build: `npm run build OK`;
- последний E2E smoke: `9 passed, 1 intentionally skipped`;
- `manage.py check OK`.

### Phase 10 — UI/UX Competitive Polish

Статус: **готово**.

Добавлено:

- role-aware dashboard:
  - owner/admin видят управленческие KPI, конверсию и выручку;
  - operator/staff видят рабочий фокус на заявках, чатах, задачах и записях.
- Settings разбиты быстрыми секциями-якорями, чтобы не искать team/security/billing/custom fields в длинной странице.
- CRM drawer получил inline-edit для статусов и заметок заявок, сделок и записей.
- Mobile polish:
  - inbox composer стал закрепленным и удобным для длинных ответов;
  - quick replies в inbox стали горизонтальной лентой;
  - kanban заявок получил snap-scroll колонки;
  - calendar date picker стал нормального размера на телефоне.
- Integrations cards получили recommended next step.
- Onboarding copy стал ближе к рабочему сценарию первого запуска.
- Документация:
  - `docs/ui-ux-polish-phase-10.md`.

Проверки:

- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test OK` — `176 tests`;
- `cd frontend && npm run build OK`;
- `cd frontend && npm run e2e OK` — `9 passed, 1 intentionally skipped`.

### Production Readiness Audit For 10,000 Merchants

Статус: **готово**.

Добавлено:

- backend audit service:
  - `apps/core/production_audit.py`;
  - проверяет env/security/database/queue/storage/observability/email/rate-limits.
- management command:
  - `python manage.py production_readiness_audit`;
  - `python manage.py production_readiness_audit --format=json`;
  - `python manage.py production_readiness_audit --fail-on-critical`.
- тесты:
  - critical failures для unsafe production settings;
  - command failure mode;
  - JSON output.
- Документация:
  - `docs/production-readiness-10000-audit.md`;
  - обновлен `docs/production-readiness.md`.

Проверки:

- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py production_readiness_audit OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.core.tests_production_audit OK`.
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test OK` — `179 tests`;
- `cd frontend && npm run build OK`;
- `cd frontend && npm run e2e -- --project=desktop-chromium OK` — `4 passed, 1 skipped`.

### CI/CD And Staging Gate

Статус: **готово**.

Добавлено:

- GitHub Actions workflow:
  - `.github/workflows/ci.yml`;
  - backend migration check, system check, production audit JSON smoke and tests;
  - frontend `npm ci` and `npm run build`.
- Local CI script:
  - `scripts/check_local_ci.sh`.
- Staging checklist:
  - `docs/staging-ci-cd-checklist.md`.
- `docs/deployment.md` теперь ссылается на staging/CI checklist и local CI command.

Проверки:

- `bash -n scripts/check_local_ci.sh OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test OK` — `179 tests`;
- `cd frontend && npm run build OK`;
- workflow YAML добавлен без secrets и без production credentials.

### Production Env Templates And Provider Selection

Статус: **готово**.

Добавлено:

- backend env templates:
  - `.env.staging.example`;
  - `.env.production.example`.
- frontend env templates:
  - `frontend/.env.staging.example`;
  - `frontend/.env.production.example`.
- `.gitignore` теперь разрешает tracked env templates, но продолжает игнорировать реальные `.env.*`.
- Provider selection doc:
  - `docs/staging-provider-selection.md`.
- Обновлены:
  - `docs/deployment.md`;
  - `docs/staging-ci-cd-checklist.md`;
  - `docs/production-readiness-10000-audit.md`.

Рекомендованный staging stack:

- Supabase Postgres или Neon;
- Upstash Redis или Redis Cloud;
- Supabase Storage или Cloudflare R2;
- Cloudflare Pages или Vercel для frontend;
- Render/Railway/Fly.io/DigitalOcean App Platform для Django/Celery;
- Sentry;
- Resend/Postmark/SendGrid.

Проверки:

- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test OK` — `179 tests`;
- `cd frontend && npm run build OK`.

### Staging Deployment Smoke Kit

Статус: **готово**.

Добавлено:

- Production-like smoke script:
  - `scripts/staging_smoke.sh`.
- Staging Playwright config:
  - `frontend/playwright.staging.config.ts`;
  - `npm run e2e:staging`.
- Staging smoke runbook:
  - `docs/staging-smoke-runbook.md`.
- Обновлены:
  - `docs/deployment.md`;
  - `docs/staging-ci-cd-checklist.md`;
  - `docs/staging-provider-selection.md`.

Smoke проверяет:

- health/readiness endpoints;
- platform admin login and `/api/platform/ping/`;
- merchant owner login and core merchant API;
- frontend root response.
- deployed browser smoke for platform, owner, operator and mobile flows.

Пример запуска:

```bash
API_BASE_URL=https://api-staging.zani.example \
FRONTEND_URL=https://app-staging.zani.example \
PLATFORM_ADMIN_EMAIL=platform_admin@example.com \
PLATFORM_ADMIN_PASSWORD='***' \
MERCHANT_OWNER_EMAIL=business_owner@example.com \
MERCHANT_OWNER_PASSWORD='***' \
scripts/staging_smoke.sh
```

Browser staging smoke:

```bash
cd frontend
E2E_BASE_URL=https://app-staging.zani.example \
E2E_PLATFORM_EMAIL=platform_admin@example.com \
E2E_OWNER_EMAIL=business_owner@example.com \
E2E_OPERATOR_EMAIL=business_operator@example.com \
E2E_PASSWORD='***' \
npm run e2e:staging
```

Проверки:

- `bash -n scripts/staging_smoke.sh OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test OK` — `179 tests`;
- `cd frontend && npm run build OK`;
- `cd frontend && npm run e2e -- --project=desktop-chromium OK` — `4 passed, 1 skipped`.

### Rate Limit And Abuse Guardrails

Статус: **готово**.

Добавлено:

- Scoped throttles для публичного периметра:
  - public lead forms;
  - website chat/widget;
  - Telegram/WhatsApp webhooks;
  - public API tokens;
  - AI assistant.
- Новые env-переменные:
  - `PUBLIC_FORM_RATE`;
  - `PUBLIC_WIDGET_RATE`;
  - `INTEGRATION_WEBHOOK_RATE`;
  - `AI_ASSISTANT_RATE`.
- Production audit теперь проверяет наличие всех обязательных throttle scopes.
- Документация:
  - `docs/rate-limits.md`.

Проверки:

- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.core.tests_rate_limits OK`.
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py production_readiness_audit OK` — `api.rate_limits PASS`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test OK` — `181 tests`;
- `cd frontend && npm run build OK`.

### Render Docker Deploy Fix

Статус: **готово**.

Исправлено:

- `Dockerfile` теперь использует `${PORT:-8000}`, который Render передает в runtime.
- Web startup выполняет:
  - `python manage.py migrate`;
  - `python manage.py collectstatic --noinput`;
  - `gunicorn config.wsgi:application`.
- Добавлен `.dockerignore`, чтобы локальный `.env`, SQLite, media, node modules и build artifacts не попадали в Docker image.
- Обновлен `docs/deployment.md` с Render-specific env checklist.

Проверки:

- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py production_readiness_audit OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.core.tests_rate_limits apps.core.tests_production_audit OK`.

### Render Supabase Env Builder

Статус: **готово**.

Добавлено:

- Django теперь может собрать Postgres URL из понятных `SUPABASE_*` переменных, если `DATABASE_URL` пустой.
- Пароль Supabase автоматически URL-encode, поэтому спецсимволы в database password не ломают connection string.
- Восстановлены env templates:
  - `.env.example`;
  - `.env.staging.example`;
  - `.env.production.example`.
- `frontend/.env.staging.example` указывает на текущий Render backend:
  - `https://zani-9lnp.onrender.com`.
- `docs/deployment.md` обновлен под Render + Supabase split env.

Для Render можно использовать:

```env
DATABASE_URL=
SUPABASE_PROJECT_REF=jjpenskqmomrbjqofbss
SUPABASE_DB_PASSWORD=<database-password-not-anon-key>
SUPABASE_DB_CONNECTION_MODE=pooler
SUPABASE_DB_POOLER_HOST=<copy-from-supabase-transaction-pooler>
SUPABASE_DB_PORT=6543
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres.jjpenskqmomrbjqofbss
```

Проверки:

- `env DATABASE_URL='' SUPABASE_* ... .venv/bin/python manage.py check OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.core.tests_rate_limits apps.core.tests_production_audit OK`.

Files:

- `GET /api/files/private/<path:file_path>/`

Scheduling helpers:

- `GET /api/appointments/available-slots/?business_id=&service_id=&date=&resource_id=`
- `POST /api/leads/{id}/create-appointment/`

Healthchecks:

- `GET /health/`
- `GET /health/db/`

## Проверка после каждого этапа

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend
npm ci
npm run build
```

## Локальные тестовые аккаунты

Для просмотра frontend, ролей и бизнес-логик в локальной SQLite-базе подготовлены тестовые аккаунты.

Общий пароль:

```text
ZaniTest123!
```

Аккаунты:

- `platform_admin@example.com` — platform admin, superuser/staff, доступ к Django Admin и `/platform`.
- `business_owner@example.com` — владелец бизнеса `Zani Demo Business`, membership `owner`, видит все реализованные merchant-разделы и функции.
- `business_operator@example.com` — оператор бизнеса `Zani Demo Business`, global role `business_operator`, membership `operator`, видит только ограниченный рабочий набор: clients, leads, conversations, tasks.

В `Zani Demo Business` добавлены минимальные demo-данные для проверки UI:

- клиент;
- услуга;
- ресурс;
- рабочее время;
- заявка;
- сделка;
- запись;
- задача;
- WhatsApp bot channel в mock mode;
- тестовый WhatsApp conversation/message.

## Clean archive

Для передачи проекта без локальных секретов, окружений и build artifacts:

```bash
cd /Users/maksim/Desktop/Zani
scripts/make_clean_archive.sh
```

Manual smoke:

1. `platform_admin` -> `/platform`.
2. `platform_manager` -> `/platform`.
3. `business_owner` -> merchant dashboard.
4. Merchant user cannot open `/platform`.
5. Merchant CRM pages still work.

## Ближайшие этапы из roadmap

1. Production infrastructure baseline.
2. Object storage and file safety foundation.
3. Final regression pass.
