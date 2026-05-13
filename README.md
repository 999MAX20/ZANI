# NeuroBoost

NeuroBoost — AI-first CRM / Business OS для малого и среднего бизнеса. Сейчас проект содержит Django + DRF backend, React + TypeScript frontend, multi-tenant Merchant CRM и foundation для будущего Platform Admin.

Работа ведется по этапам из документа:

```text
plan/neuroboost_codex_step_prompts.docx
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
  src/features/public/ # Public NeuroBoost website shell
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
cd /Users/maksim/Desktop/neuroboost
cp .env.example .env
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver 0.0.0.0:8000
```

Если `.venv` отсутствует:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### Frontend

Во втором терминале:

```bash
cd /Users/maksim/Desktop/neuroboost/frontend
npm install
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
- `/platform` — Platform Admin placeholder.

Auth:

- `POST /api/auth/token/`
- `POST /api/auth/token/refresh/`
- `GET /api/auth/me/`

Billing:

- `GET /api/billing/plans/`
- `GET /api/billing/current-subscription/`

Platform:

- `GET /api/platform/ping/`

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

Scheduling helpers:

- `GET /api/appointments/available-slots/?business_id=&service_id=&date=&resource_id=`
- `POST /api/leads/{id}/create-appointment/`

Healthchecks:

- `GET /health/`
- `GET /health/db/`

## Проверка после каждого этапа

```bash
python manage.py check
python manage.py test
cd frontend && npm run build
```

Manual smoke:

1. `platform_admin` -> `/platform`.
2. `platform_manager` -> `/platform`.
3. `business_owner` -> merchant dashboard.
4. Merchant user cannot open `/platform`.
5. Merchant CRM pages still work.

## Ближайшие этапы из roadmap

1. Telegram Integration Skeleton.
2. AI Core Foundation.
