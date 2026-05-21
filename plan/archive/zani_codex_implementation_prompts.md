# ZANI — ПОЭТАПНЫЕ PROMPTS ДЛЯ CODEX

Этот файл — рабочая карта дальнейшей реализации Zani через Codex.  
Каждый prompt давать отдельно. Не переходить к следующему этапу, пока текущий не прошёл проверки.

---

## Общие правила для каждого prompt

Перед началом любого этапа Codex должен:

1. Проанализировать текущую структуру проекта.
2. Не переписывать рабочие модули без необходимости.
3. Не ломать Merchant CRM.
4. Не ломать Platform access.
5. Не смешивать public product core и internal developer tools.
6. Соблюдать tenant isolation по `business`.
7. Проверять backend permissions, а не полагаться только на frontend guards.
8. В конце дать список изменённых файлов, что сделано, как проверить, какие риски остались.

Базовые проверки после каждого этапа:

```bash
python manage.py check
python manage.py test
cd frontend && npm run build
```

Если тесты падают или зависают — следующий feature-этап не давать. Сначала отдельный fix prompt.

---

# PROMPT 00 — Zani Rename + Repository Hygiene + Stability Fix

Ты — senior fullstack engineer и SaaS architect.

Проект теперь называется **Zani**. Больше не использовать NeuroBoost/SMB AI CRM как имя продукта.

Текущий проект:
- Django + DRF backend;
- React + TypeScript frontend;
- Merchant CRM;
- Platform access;
- Billing foundation;
- Bots foundation;
- Website chat;
- Telegram skeleton;
- AI Core;
- AI Assistant;
- Automations.

Это fix/stabilization этап. Не добавлять новые продуктовые модули.

## Задачи

1. Переименовать публичные и документационные упоминания старого имени в `Zani`:
   - README;
   - frontend public pages;
   - env examples;
   - package metadata where safe;
   - docs/plan titles.

2. Не трогать migration names и исторические технические файлы, если переименование может сломать миграции.

3. Обновить `.gitignore`, чтобы исключить:
   - `.env`;
   - `.env.*` кроме `.env.example`;
   - `.venv/`;
   - `venv/`;
   - `node_modules/`;
   - `frontend/node_modules/`;
   - `frontend/dist/`;
   - `dist/`;
   - `build/`;
   - `db.sqlite3`;
   - `__pycache__/`;
   - `*.pyc`;
   - `.DS_Store`;
   - `__MACOSX/`;
   - `*.tsbuildinfo`;
   - `.pytest_cache/`;
   - coverage files.

4. Добавить clean archive script:
   - `scripts/make_clean_archive.sh`
   - он должен создавать архив без `.env`, `.venv`, `node_modules`, `dist`, `db.sqlite3`, `__MACOSX`, `.DS_Store`, `__pycache__`.

5. Проверить наличие management command:

```bash
python manage.py create_platform_admin --email admin@zani.local --password admin12345
```

Если команды нет — добавить в `apps/accounts/management/commands/create_platform_admin.py`.

Команда должна быть idempotent:
- если user отсутствует — создать;
- если есть — обновить role=`platform_admin`;
- пароль хешировать корректно.

6. Проверить `getCurrentUser()` во frontend.

Если он использует прямой axios/fetch и обходит `apiClient`, перевести его на общий `apiClient`, чтобы refresh-token interceptor работал при `/api/auth/me/`.

7. В README добавить команды:
   - backend install;
   - migrate;
   - create platform admin;
   - frontend npm ci/build;
   - clean archive.

## Не делать

- не добавлять Unified Inbox;
- не добавлять новых моделей CRM;
- не добавлять AI-логику;
- не добавлять parser/landing generator/outreach;
- не подключать OAuth;
- не подключать платежи.

## Проверка

```bash
python manage.py check
python manage.py test
cd frontend
rm -rf node_modules
npm ci
npm run build
```

## Acceptance criteria

- В публичных местах используется Zani.
- Архив/репозиторий не содержит мусорные generated files.
- `.env` не должен попадать в архив.
- `create_platform_admin` работает.
- `/api/auth/me/` использует общий auth refresh flow.
- Frontend build проходит после чистого `npm ci`.

---

# PROMPT 01 — Test Stabilization and No External Network in Tests

Ты — senior fullstack engineer и SaaS architect.

Задача: стабилизировать test baseline. В текущем окружении `python manage.py check` проходит, frontend build проходит после `npm ci`, но `python manage.py test` может зависать/не завершаться вовремя. Нужно найти причину.

## Что сделать

1. Запустить тесты подробно:

```bash
python manage.py test -v 2
```

2. Найти, какой test case тормозит или ходит во внешний API.

3. Убедиться, что тесты не делают реальные network calls:
   - OpenAI;
   - Telegram;
   - WhatsApp;
   - Instagram;
   - email;
   - payment provider.

4. Все external integrations в tests должны быть:
   - mocked;
   - disabled через settings;
   - controlled fallback.

5. Если `TELEGRAM_ENABLED` или `OPENAI_API_KEY` могут быть включены из `.env`, tests должны переопределять эти настройки.

6. Добавить safe defaults для test settings:
   - `OPENAI_API_KEY=""`;
   - `TELEGRAM_ENABLED=False`;
   - `WHATSAPP_ENABLED=False`;
   - `EMAIL_BACKEND=django.core.mail.backends.locmem.EmailBackend`.

7. Добавить короткий документ:
   - `docs/testing.md`
   - команды запуска;
   - как отключаются внешние вызовы;
   - что делать при зависании тестов.

## Не делать

- не удалять тесты ради прохождения;
- не отключать важные permission/tenant tests;
- не добавлять новый функционал.

## Проверка

```bash
python manage.py check
python manage.py test -v 2
cd frontend && npm run build
```

## Acceptance criteria

- Tests стабильно завершаются.
- Нет реальных внешних API calls в тестах.
- Документация по тестам добавлена.

---

# PROMPT 02 — Unified Inbox Backend Core

Ты — senior fullstack engineer и SaaS architect.

Контекст: в Zani уже есть `apps/conversations` и `apps/bots`. Сейчас диалоги разделены, а frontend ConversationsPage частично демо. Нужно создать backend-ядро единого omnichannel inbox, не ломая текущие API.

## Цель

Сделать единый inbox для:
- website chat;
- Telegram;
- будущего WhatsApp;
- будущего Instagram;
- manual channel.

## Что сделать

1. Не удалять существующие модели `Conversation`, `Message`, `BotConversation`, `BotMessage`.

2. Расширить `BotConversation`, если безопасно:
   - `assigned_to` FK User nullable;
   - `priority`: low, normal, high, urgent;
   - `bot_enabled` boolean default true;
   - `handoff_required` boolean default false;
   - `handoff_reason` text blank;
   - `last_message_at` nullable datetime;
   - `last_inbound_at` nullable datetime;
   - `last_outbound_at` nullable datetime;
   - `unread_count` positive int default 0;
   - `external_thread_id` blank;
   - `metadata_json` JSONField default dict.

3. Расширить `BotMessage`, если безопасно:
   - `sender_type`: client, bot, manager, system, ai;
   - `external_message_id` blank;
   - `error_text` blank;
   - `sent_at` nullable;
   - `delivered_at` nullable;
   - `read_at` nullable.

4. Добавить service:
   - `apps/conversations/inbox_service.py` или `apps/bots/inbox_service.py`.

5. Добавить endpoints:
   - `GET /api/inbox/conversations/`
   - `GET /api/inbox/conversations/{id}/`
   - `GET /api/inbox/conversations/{id}/messages/`
   - `POST /api/inbox/conversations/{id}/assign/`
   - `POST /api/inbox/conversations/{id}/handoff/`
   - `POST /api/inbox/conversations/{id}/mark-read/`

6. Фильтры:
   - channel;
   - status;
   - assigned_to;
   - priority;
   - bot_enabled;
   - unread;
   - search by text/client/external_user_id.

7. Tenant isolation:
   - merchant users видят только conversations своего business;
   - platform users не получают merchant inbox без явного platform endpoint;
   - anonymous forbidden.

8. При создании inbound BotMessage обновлять conversation counters/timestamps.

## Не делать

- не делать realtime/websocket;
- не подключать WhatsApp/Instagram;
- не делать AI auto-replies;
- не переписывать весь conversations module.

## Проверка

```bash
python manage.py makemigrations --check --dry-run
python manage.py makemigrations
python manage.py check
python manage.py test
```

## Acceptance criteria

- Есть единый inbox API.
- Старые bots/conversations endpoints не сломаны.
- Tenant isolation покрыт тестами.
- Можно получить список диалогов и сообщения из BotConversation.

---

# PROMPT 03 — Unified Inbox Frontend

Ты — senior frontend/fullstack engineer.

Контекст: backend Unified Inbox Core уже реализован. Нужно заменить демо ConversationsPage на реальный inbox UI.

## Что сделать

1. Создать API layer:
   - `frontend/src/api/inbox.ts`

2. Переписать `frontend/src/features/conversations/ConversationsPage.tsx`, чтобы она брала данные из:
   - `/api/inbox/conversations/`
   - `/api/inbox/conversations/{id}/messages/`

3. UI:
   - список диалогов слева;
   - фильтры по channel/status/assigned/unread;
   - поиск;
   - центральная лента сообщений;
   - правая панель context;
   - badges по каналам;
   - unread count;
   - priority badge.

4. Actions:
   - assign to me;
   - handoff to manager;
   - mark read;
   - toggle bot enabled;
   - open/create lead;
   - open/create task;
   - suggest AI reply кнопка, если endpoint уже есть.

5. Если backend endpoint для отправки менеджерского сообщения ещё отсутствует — сделать кнопку disabled/placeholder с понятным текстом.

## Не делать

- не делать websocket;
- не подключать внешние каналы;
- не делать auto-send AI;
- не ломать existing bots page.

## Проверка

```bash
cd frontend
npm run build
```

## Acceptance criteria

- ConversationsPage больше не демо.
- UI работает на реальном backend inbox API.
- Нет падения при пустых данных.
- Merchant видит только свои диалоги.

---

# PROMPT 04 — Manager Outbound Reply + Conversation Actions

Ты — senior fullstack engineer.

Контекст: Unified Inbox backend/frontend уже есть. Нужно добавить ручные ответы менеджера и CRM actions из диалога.

## Что сделать

1. Backend endpoint:
   - `POST /api/inbox/conversations/{id}/messages/`

Payload:

```json
{
  "text": "Здравствуйте, можем записать вас на завтра",
  "sender_type": "manager"
}
```

2. Сообщение должно сохраняться как outbound manager message.

3. Если channel provider не подключен, message status = `queued` или `sent_mock`/`sent` по текущей модели.

4. Добавить service layer:
   - `send_outbound_message(conversation, text, user)`

5. Добавить CRM actions endpoints:
   - create task from conversation;
   - link lead;
   - create lead if missing.

6. Frontend:
   - input для ответа;
   - send button;
   - create task button;
   - create/link lead button.

## Не делать

- не отправлять реальные WhatsApp/Instagram сообщения;
- не делать auto AI;
- не делать payment/billing.

## Проверка

```bash
python manage.py check
python manage.py test
cd frontend && npm run build
```

## Acceptance criteria

- Менеджер может отправить ручной ответ внутри inbox.
- Ответ сохраняется в backend.
- Tenant isolation работает.
- Можно создать задачу/лид из диалога.

---

# PROMPT 05 — AI Agent Profile Foundation

Ты — senior backend/fullstack engineer и AI product architect.

Контекст: Zani уже имеет `ai_core`, `bots`, `BusinessKnowledgeItem`, `AIRequestLog`, AI assistant и suggested replies. Нужно создать управляемый Agent Profile, но без auto-send.

## Что сделать

1. Добавить модель `AgentProfile` в `apps/ai_core` или `apps/bots`:
   - business;
   - bot nullable;
   - name;
   - role_description;
   - tone: friendly, expert, formal, sales, support;
   - language;
   - is_active;
   - system_prompt;
   - rules_json;
   - allowed_tools_json;
   - escalation_rules_json;
   - created_at/updated_at.

2. Добавить serializer/viewset:
   - `/api/ai/agent-profiles/`

3. Tenant isolation.

4. Frontend:
   - route `/dashboard/ai-agents` или section inside bot detail;
   - create/edit agent profile;
   - tone/language/rules fields;
   - placeholder for tools.

5. Existing suggest reply должен уметь использовать AgentProfile, если он привязан к Bot.

## Не делать

- не делать auto-send;
- не делать function calling;
- не делать embeddings/vector DB;
- не подключать WhatsApp/Instagram.

## Проверка

```bash
python manage.py check
python manage.py test
cd frontend && npm run build
```

## Acceptance criteria

- Merchant может создать AI agent profile.
- Profile используется при генерации suggested reply.
- Данные из чужого business недоступны.

---

# PROMPT 06 — AI Tool Registry Skeleton

Ты — senior backend engineer и AI architect.

Контекст: AgentProfile уже есть. Нужно заложить tool registry, чтобы AI мог предлагать CRM-действия, но не выполнять критичные действия без подтверждения.

## Что сделать

1. Добавить service:
   - `apps/ai_core/tool_registry.py`

2. Зарегистрировать tools:
   - `create_lead`;
   - `create_client`;
   - `create_task`;
   - `create_deal`;
   - `summarize_conversation`;
   - `qualify_lead`.

3. Добавить модель `AIToolCallLog`:
   - business;
   - user nullable;
   - conversation nullable;
   - tool_name;
   - input_json;
   - output_json;
   - status: suggested, executed, failed, rejected;
   - error;
   - created_at.

4. Endpoint:
   - `POST /api/ai/tools/suggest/`

Возвращает список suggested actions, но не выполняет их.

5. Endpoint:
   - `POST /api/ai/tools/{log_id}/execute/`

Выполняет только если user имеет доступ к business.

## Не делать

- не давать AI самостоятельно выполнять действия;
- не делать auto-send;
- не подключать внешние API.

## Проверка

```bash
python manage.py check
python manage.py test
```

## Acceptance criteria

- AI может предложить CRM action.
- Менеджер может подтвердить выполнение.
- Все tool calls логируются.
- Tenant isolation покрыт тестами.

---

# PROMPT 07 — Deal/Pipeline UX Upgrade

Ты — senior fullstack engineer и product designer.

Контекст: в Zani уже есть deals/pipeline/stages. Нужно сделать CRM ближе к amoCRM по удобству, но без перегруза Bitrix24.

## Что сделать

1. Улучшить `/dashboard/deals`:
   - kanban board;
   - drag & drop stages;
   - deal cards;
   - source/channel badge;
   - amount/status;
   - next task;
   - last activity.

2. Добавить deal detail drawer/page:
   - main info;
   - client;
   - linked lead;
   - tasks;
   - notes;
   - timeline;
   - conversations;
   - AI next action placeholder.

3. Backend:
   - если нужных fields нет, добавить минимально и безопасно;
   - не ломать existing API.

4. Add tests for stage change permissions if backend changes.

## Не делать

- не делать сложную телефонию;
- не делать full Bitrix portal;
- не подключать payments;
- не делать AI auto decisions.

## Проверка

```bash
python manage.py check
python manage.py test
cd frontend && npm run build
```

## Acceptance criteria

- Deals выглядят как рабочая sales pipeline.
- Drag/drop или stage change работает.
- Existing CRM flows не сломаны.

---

# PROMPT 08 — Channel Provider Abstraction

Ты — senior backend engineer.

Контекст: есть Telegram skeleton и website chat. Нужно подготовить единый слой providers для будущих WhatsApp/Instagram/Email.

## Что сделать

1. Создать app/service layer `apps/integrations/providers/`.

2. Добавить абстрактный интерфейс:
   - `send_message(channel, recipient_id, text, payload)`;
   - `parse_webhook(provider, payload, headers)`;
   - `verify_webhook(provider, request)`.

3. Provider implementations:
   - website mock;
   - telegram;
   - whatsapp_mock;
   - instagram_mock;
   - email_mock.

4. Модель `IntegrationEventLog`:
   - business nullable;
   - provider;
   - channel;
   - direction;
   - payload_json;
   - status;
   - error;
   - created_at.

5. Обновить Telegram code так, чтобы он использовал provider layer, но не ломать existing webhook.

## Не делать

- не подключать реальные WhatsApp/Instagram API;
- не хранить tokens в .env, если токен мерчанта;
- не делать массовые рассылки.

## Проверка

```bash
python manage.py check
python manage.py test
```

## Acceptance criteria

- Есть единый provider abstraction.
- Telegram продолжает работать.
- WhatsApp/Instagram представлены mock providers.
- Events логируются.

---

# PROMPT 09 — Website Widget SDK MVP

Ты — senior frontend/fullstack engineer.

Контекст: website chat endpoints уже есть. Нужно создать embeddable widget MVP для сайтов клиентов, но без production CDN.

## Что сделать

1. Создать frontend package/folder:
   - `frontend/widget/` или `widget/`.

2. Виджет должен:
   - принимать `publicToken`;
   - показывать chat bubble;
   - открывать chat window;
   - создавать conversation;
   - отправлять message;
   - показывать basic response/status.

3. Build output:
   - один JS bundle;
   - инструкция embed:

```html
<script src="https://cdn.zani.kz/widget.js" data-zani-token="..."></script>
```

4. Пока можно хранить bundle локально в проекте, без CDN.

5. Добавить docs:
   - `docs/widget-sdk.md`.

## Не делать

- не делать realtime;
- не делать AI auto replies;
- не подключать CDN;
- не делать multi-widget themes beyond basic settings.

## Проверка

```bash
cd frontend && npm run build
```

## Acceptance criteria

- Есть MVP widget bundle/source.
- Есть инструкция подключения.
- Widget использует public website chat endpoints.

---

# PROMPT 10 — Telegram Production Pass

Ты — senior backend/fullstack engineer.

Контекст: Telegram skeleton уже есть. Нужно сделать Telegram канал пригодным для beta, но без массовых рассылок.

## Что сделать

1. UI in bot detail:
   - bot token input;
   - webhook secret;
   - set webhook button;
   - status check;
   - last error.

2. Backend:
   - store merchant bot token in `BotChannel.config_json`;
   - never log full token;
   - add `set_webhook` service;
   - outbound reply from inbox through provider layer;
   - IntegrationEventLog on errors.

3. Tests:
   - mock Telegram API;
   - no real network calls.

## Не делать

- не делать broadcast;
- не делать WhatsApp;
- не делать auto AI send.

## Проверка

```bash
python manage.py check
python manage.py test
cd frontend && npm run build
```

## Acceptance criteria

- Merchant can configure Telegram bot.
- Webhook can be set with mocked provider in tests.
- Manager can send outbound Telegram reply from inbox.

---

# PROMPT 11 — Billing Usage Limits Foundation

Ты — senior backend/fullstack engineer.

Контекст: Billing plans/subscriptions уже есть. Нужно добавить usage limits без реальных оплат.

## Что сделать

1. Модель `UsageCounter`:
   - business;
   - period_start;
   - period_end;
   - metric: ai_requests, bot_messages, users, conversations;
   - value;

2. Service:
   - `increment_usage(business, metric, amount=1)`;
   - `check_limit(business, metric)`.

3. Hook usage increments:
   - AIRequestLog creation;
   - BotMessage inbound/outbound;
   - new BotConversation.

4. Frontend settings/billing page:
   - show current plan;
   - show usage placeholders/counters.

## Не делать

- не подключать платежи;
- не блокировать критичные операции жёстко без UX;
- не делать MRR dashboard yet.

## Проверка

```bash
python manage.py check
python manage.py test
cd frontend && npm run build
```

## Acceptance criteria

- Usage counters считаются.
- Limits можно читать из plan.features/limits.
- Merchant видит usage summary.

---

# PROMPT 12 — Platform Admin Real Dashboard

Ты — senior fullstack engineer и SaaS product architect.

Контекст: Platform routes пока placeholder. Нужен настоящий dashboard владельцев Zani, но без internal dev tools.

## Что сделать

1. Backend endpoint:
   - `GET /api/platform/overview/`

Возвращает:
   - total_businesses;
   - active_businesses;
   - trial_businesses;
   - active_subscriptions;
   - mrr_estimate;
   - total_users;
   - bot_count;
   - active_bot_channels;
   - ai_requests_30d;
   - conversations_30d;
   - errors placeholder.

2. Endpoint:
   - `GET /api/platform/merchants/`

List businesses with:
   - name;
   - owner;
   - status;
   - plan;
   - subscription_status;
   - created_at;
   - usage summary.

3. Permissions:
   - only platform_admin/platform_manager.

4. Frontend:
   - real `/platform` overview;
   - real `/platform/merchants` table;
   - keep other platform pages placeholders.

## Не делать

- не добавлять prospects;
- не добавлять parser;
- не добавлять landing generator;
- не делать payment provider.

## Проверка

```bash
python manage.py check
python manage.py test
cd frontend && npm run build
```

## Acceptance criteria

- Platform dashboard shows real product metrics.
- Merchant users cannot access platform API.
- Platform users do not need business membership.

---

# PROMPT 13 — Production Infrastructure Baseline

Ты — senior DevOps/fullstack engineer.

Контекст: Zani уже имеет Django/React/PostgreSQL/Redis/Celery-ready structure. Нужно подготовить production baseline.

## Что сделать

1. Update `docker-compose.yml`:
   - backend web;
   - postgres;
   - redis;
   - celery worker;
   - celery beat optional;
   - frontend build/serve notes.

2. Add/verify health endpoints:
   - `/health/`;
   - `/health/db/`.

3. Update `.env.example` with all needed variables:
   - Django;
   - DB;
   - Redis/Celery;
   - JWT;
   - CORS/CSRF;
   - Telegram;
   - OpenAI;
   - Email;
   - Sentry;
   - Storage placeholders.

4. Add Sentry optional init if DSN exists.

5. Add `docs/deployment.md`.

## Не делать

- не делать Kubernetes;
- не делать CI/CD;
- не подключать paid providers forcibly.

## Проверка

```bash
python manage.py check
python manage.py test
cd frontend && npm run build
```

## Acceptance criteria

- Clean deployment docs.
- Docker services defined.
- Env example complete.
- Health endpoints usable.

---

# PROMPT 14 — Object Storage and File Safety Foundation

Ты — senior backend engineer.

Цель: подготовить безопасное хранение файлов, вложений и будущих медиа сообщений.

## Что сделать

1. Add optional S3-compatible settings:
   - local media for dev;
   - S3/R2/Yandex compatible for production.

2. Env:
   - `USE_S3`;
   - `AWS_ACCESS_KEY_ID`;
   - `AWS_SECRET_ACCESS_KEY`;
   - `AWS_STORAGE_BUCKET_NAME`;
   - `AWS_S3_ENDPOINT_URL`;
   - `AWS_S3_REGION_NAME`.

3. Add file validation helpers:
   - max size;
   - allowed extensions;
   - content type.

4. Prepare private file serving pattern through backend endpoint.

## Не делать

- не мигрировать existing files;
- не подключать paid provider;
- не делать CDN.

## Проверка

```bash
python manage.py check
python manage.py test
```

## Acceptance criteria

- Local media still works.
- Empty S3 env does not break dev.
- File validation helpers exist.

---

# PROMPT 15 — Internal Dev Tools Boundary Document

Ты — senior SaaS architect.

Цель: зафиксировать, что parser, landing generator и developer outreach не являются public product core.

## Что сделать

1. Создать:
   - `docs/internal-dev-tools-boundary.md`

2. Описать:
   - parser;
   - landing generator;
   - developer outreach;
   - prospect scraping;
   - почему это отдельно от Zani product core.

3. Описать варианты будущей интеграции:
   - отдельный repo;
   - отдельная БД;
   - read/write через API;
   - импорт лидов в CRM только через controlled endpoints.

4. Не писать backend/frontend код.

## Acceptance criteria

- Документ создан.
- Product core не изменён.

---

# PROMPT 16 — Final Regression Pass

Ты — senior QA/fullstack engineer.

Цель: провести общий regression pass после серии этапов.

## Что проверить

1. Backend:
   - `python manage.py check`;
   - `python manage.py test`;
   - migrations check.

2. Frontend:
   - `npm ci`;
   - `npm run build`.

3. Manual flows:
   - platform_admin → `/platform`;
   - business_owner → `/dashboard`;
   - merchant cannot access `/platform`;
   - public pages open without auth;
   - pricing page works;
   - dashboard opens;
   - leads/clients/deals/tasks/calendar work;
   - bots page works;
   - website chat public endpoint works;
   - Telegram webhook with mock works;
   - AI assistant mock works without OPENAI_API_KEY;
   - automations create task/notification.

4. Security:
   - no `.env` in archive;
   - no real tokens in docs;
   - no external calls in tests.

## Не делать

- не добавлять новый функционал;
- исправлять только найденные ошибки отдельными targeted changes.

## Acceptance criteria

- Есть regression report.
- Все критичные проверки зелёные или задокументированы с точной причиной.
