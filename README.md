# Zani

Zani — AI-first CRM / Business OS для малого и среднего бизнеса. Сейчас проект содержит Django + DRF backend, React + TypeScript frontend, multi-tenant Merchant CRM и foundation для будущего Platform Admin.

Работа ведется по этапам из документа:

```text
plan/zani_codex_implementation_prompts.md
```

Правило проекта: один этап = один изолированный набор изменений. После каждого этапа запускаются backend checks/tests и frontend build.

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

## Структура проекта

```text
apps/
  accounts/        # User, auth profile endpoints, roles
  ai_core/         # AI request logs, business knowledge and AI service abstraction
  billing/         # Subscription plans and subscriptions
  bots/            # AI bot foundation, channels, bot conversations/messages
  businesses/      # Business, BusinessMember
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
