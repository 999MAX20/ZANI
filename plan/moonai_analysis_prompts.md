# NeuroBoost × MoonAI: аудит текущего проекта и промпты для Codex

Дата: 12 мая 2026  
Архив проекта: `neuroboost.zip`

---

## 0. Краткий вывод

Текущий NeuroBoost уже имеет хорошее ядро для SMB CRM:

- Django + DRF backend;
- React/Vite frontend;
- роли `platform_admin`, `platform_manager`, `business_owner`, `business_manager`, `manager`, `staff`;
- multi-tenant модель через `Business` и `BusinessMember`;
- CRM-модули: leads, clients, deals, pipeline, tasks, appointments, services, resources;
- AI-модули: `ai_core`, AI logs, knowledge base;
- bots-модули: Bot, BotChannel, BotConversation, BotMessage;
- public website chat endpoints;
- Telegram webhook;
- automation rules/runs/actions;
- billing plans/subscriptions;
- platform route `/platform` и merchant route `/dashboard`.

По сравнению с MoonAI, главный разрыв сейчас не в наличии CRM, а в отсутствии полноценного **omnichannel inbox + agent runtime**. У MoonAI логика выглядит так:

```text
Канал → общий inbox → AI agent → qualification/tools → handoff manager → CRM/deal → analytics/billing
```

В NeuroBoost пока есть части этой схемы, но они разделены:

```text
apps/conversations      — обычные CRM conversation/message
apps/bots               — bot_conversations/bot_messages
frontend conversations  — демо-экран, не полноценная работа с backend
integrations/telegram   — принимает входящие, но нет полноценного outbound/runtime
ai_core                 — есть AI request, но нет agent orchestration/tools/function calling
```

Главная задача ближайших этапов: превратить проект из CRM с демо-ботами в **CRM-first AI communication platform**, где все каналы, боты, менеджеры, лиды и сделки живут в одной системе.

---

## 1. Сравнение с MoonAI

| Блок | MoonAI-подход | Текущее состояние NeuroBoost | Что нужно добавить |
|---|---|---|---|
| Общий inbox | Все соцсети и мессенджеры в одном окне | Есть демо `ConversationsPage`, backend разделён на `conversations` и `bot_conversations` | Единый inbox API, единая модель статусов, фильтры, assignment, handoff |
| AI-агенты | Agent builder: prompt, channels, tools, integrations | Есть Bot + settings_json, AI assistant, knowledge items | Agent profile, prompt builder, behavior settings, runtime orchestration |
| Каналы | Telegram, WhatsApp, Instagram, web-chat, агрегаторы | Website chat + Telegram webhook | Channel connector abstraction, outbound sending, provider configs, webhook events |
| Manager takeover | Менеджер подключается в переписку | Фронт имитирует отправку менеджера | `assigned_to`, `bot_enabled`, `handoff_reason`, manager outbound endpoint |
| Tools/functions | Создание лидов/сделок/записей через функции | Automations есть, но нет AI tool calling | Tool registry: create_lead, create_deal, create_appointment, save_client_data |
| Knowledge base | База знаний для ответов агента | `BusinessKnowledgeItem` есть | Retrieval/context builder для агента |
| CRM-интеграция | Лид/сделка создаётся из диалога | Leads/deals есть отдельно | Conversation → lead/deal binding + автоматическая квалификация |
| Analytics | Ошибки, диалоги, эффективность AI | Есть analytics events и AI logs | Метрики inbox/AI/handoff/conversion/token usage |
| Billing | Подписка + usage/tokens | Billing plans есть | Token/usage лимиты по тарифам, counters, overage |

---

## 2. Приоритеты разработки

### P0 — обязательно перед масштабированием

1. Единый omnichannel inbox backend.
2. Связать `BotConversation` и/или `Conversation` в одну понятную модель.
3. Реальный frontend inbox вместо демо-сообщений.
4. Manager takeover: назначение, статусы, отключение/включение AI.
5. AI agent runtime: входящее сообщение → контекст → AI ответ → запись → отправка/черновик.
6. Outbound отправка хотя бы для Telegram и website chat.
7. Тесты backend и frontend build.

### P1 — конкурентный уровень MoonAI

1. Agent builder UI.
2. Knowledge base retrieval.
3. AI tools/function calling.
4. CRM actions из диалога: create lead/deal/client/task/appointment.
5. WhatsApp/Instagram provider abstraction через Wazzup/360dialog/Meta placeholders.
6. Inbox analytics.
7. Usage/token billing.

### P2 — наше преимущество над MoonAI

1. Platform admin аналитика по всем мерчантам.
2. Prospect/parser/landing generator как внутренний growth-модуль.
3. Автоматические офферы и рассылки по базе CRM.
4. Контроль качества менеджеров и AI.
5. Vertical templates для ниш: медицина, салоны, образование, услуги.

---

# 3. Промпты для Codex

Ниже промпты нужно давать Codex по очереди. Каждый промпт рассчитан на один этап. Не смешивать этапы, чтобы не сломать ядро.

---

## PROMPT 01 — Аудит и подготовка проекта перед изменениями

```text
Ты работаешь в проекте NeuroBoost: Django + DRF backend, React/Vite frontend.

Задача: провести техническую подготовку перед добавлением omnichannel inbox и AI-agent runtime.

Контекст:
- Backend apps: accounts, businesses, crm, leads, clients, conversations, bots, ai_core, automations, integrations, billing, analytics.
- Frontend: React/Vite, routes `/dashboard`, `/platform`, страницы bots/conversations/ai-assistant.
- Сейчас `frontend/src/features/conversations/ConversationsPage.tsx` содержит демо-данные, а реальные модели диалогов разделены между `apps/conversations` и `apps/bots`.

Что сделать:
1. Ничего функционально не ломать.
2. Проверить структуру проекта, импорты, миграции, urls, serializers, viewsets.
3. Удалить из архива/репозитория мусорные файлы, если они попали в проект:
   - `.DS_Store`
   - `__MACOSX/`
   - временные Word lock files типа `~$*.docx`
   - `.venv/`
   - `db.sqlite3`, если он не должен быть в git
   - `__pycache__/`
4. Обновить `.gitignore`, чтобы эти файлы больше не попадали.
5. Добавить короткий файл `docs/architecture/current_state.md`, где описать текущие модули и границы ответственности.
6. Запустить/проверить:
   - backend tests: `pytest`
   - frontend build: `npm run build`
7. Если тесты не запускаются из-за окружения, не переписывать весь проект — указать причину и минимальные команды для запуска.

Acceptance criteria:
- Проект не сломан.
- `.gitignore` обновлён.
- Мусорные файлы удалены из рабочей структуры.
- Есть `docs/architecture/current_state.md`.
- В отчёте Codex указал, какие проверки прошли, какие нет и почему.
```

---

## PROMPT 02 — Единый omnichannel inbox backend

```text
Задача: добавить полноценный backend для единого omnichannel inbox, похожего на MoonAI Dialogue Manager, но встроенного в CRM NeuroBoost.

Важно:
- Не удалять существующие `apps/conversations` и `apps/bots` без необходимости.
- Не ломать текущие API.
- Можно расширять модели `BotConversation`/`BotMessage` или создать отдельные inbox DTO/API поверх текущих моделей.
- Цель: единый API для фронта, который показывает все диалоги из website/telegram/whatsapp/instagram/manual.

Текущее состояние:
- `apps/conversations.models.Conversation/Message` — CRM conversation.
- `apps/bots.models.BotConversation/BotMessage` — bot conversation.
- `frontend/src/features/conversations/ConversationsPage.tsx` — пока демо.

Что реализовать:
1. Создать backend service `apps/conversations/inbox_service.py` или `apps/bots/inbox_service.py`, который собирает inbox из `BotConversation` и при необходимости обычных `Conversation`.
2. Добавить/расширить поля в `BotConversation`:
   - `assigned_to` FK User nullable;
   - `priority`: low/normal/high/urgent;
   - `bot_enabled`: bool default true;
   - `handoff_required`: bool default false;
   - `handoff_reason`: char/text blank;
   - `last_message_at` datetime nullable;
   - `last_inbound_at` datetime nullable;
   - `last_outbound_at` datetime nullable;
   - `unread_count` positive int default 0;
   - `external_thread_id` char blank;
   - `metadata_json` JSONField default dict.
3. Расширить `BotMessage`:
   - `sender_type`: client/bot/manager/system;
   - `external_message_id` blank;
   - `error_text` blank;
   - `sent_at` nullable;
   - `delivered_at` nullable;
   - `read_at` nullable.
4. Добавить миграции.
5. Добавить endpoints:
   - `GET /api/inbox/conversations/`
   - `GET /api/inbox/conversations/{id}/`
   - `GET /api/inbox/conversations/{id}/messages/`
   - `POST /api/inbox/conversations/{id}/assign/`
   - `POST /api/inbox/conversations/{id}/toggle-bot/`
   - `POST /api/inbox/conversations/{id}/close/`
   - `POST /api/inbox/conversations/{id}/reopen/`
6. Фильтры для list endpoint:
   - channel
   - status
   - assigned_to
   - handoff_required
   - bot_enabled
   - search by client/lead/text/external_user_id
7. Сортировка по `last_message_at desc`.
8. При создании входящего сообщения обновлять conversation timestamps/unread_count/handoff flags.
9. Tenant security: пользователь видит только business, к которому имеет доступ.
10. Добавить тесты на:
   - tenant isolation;
   - создание/обновление inbox conversation;
   - assign;
   - toggle bot;
   - filters.

Acceptance criteria:
- Есть единый backend API для inbox.
- Existing bots endpoints не сломаны.
- Миграции применяются.
- Тесты покрывают основные сценарии.
```

---

## PROMPT 03 — Реальный frontend inbox вместо демо-экрана

```text
Задача: заменить демо-страницу `frontend/src/features/conversations/ConversationsPage.tsx` на реальный omnichannel inbox, работающий через backend API.

Контекст:
- Сейчас страница использует `initialMessages` и локальный state.
- Нужно сделать страницу как Dialogue Manager: список диалогов, окно сообщений, AI context, manager reply.

Что сделать:
1. Создать API module `frontend/src/api/inbox.ts`:
   - listConversations(filters)
   - getConversation(id)
   - listMessages(conversationId)
   - sendManagerMessage(conversationId, text)
   - assignConversation(conversationId, userId)
   - toggleBot(conversationId, enabled)
   - closeConversation(conversationId)
   - reopenConversation(conversationId)
2. Обновить types в `frontend/src/types/index.ts`:
   - InboxConversation
   - InboxMessage
   - InboxFilters
   - ConversationPriority
   - ConversationChannel
3. Переписать `ConversationsPage.tsx`:
   - слева список диалогов;
   - сверху фильтры: channel/status/handoff/bot_enabled/search;
   - в центре сообщения выбранного диалога;
   - справа карточка клиента/лида + AI context;
   - input менеджера снизу;
   - кнопка `AI draft reply`;
   - кнопка `Take over` или `Disable bot`;
   - кнопка `Close`.
4. Использовать React Query для загрузки и invalidation.
5. Состояния:
   - loading;
   - empty;
   - error;
   - selected conversation not found;
   - optimistic send manager reply.
6. Визуально сохранить текущий современный стиль NeuroBoost.
7. Не добавлять WebSocket на этом шаге, но подготовить структуру так, чтобы позже можно было добавить polling/WebSocket.

Acceptance criteria:
- Страница conversations больше не использует demo initialMessages.
- Данные приходят из API.
- Менеджер может выбрать диалог, увидеть сообщения, отправить ответ, отключить/включить бота.
- Frontend build проходит.
```

---

## PROMPT 04 — Manager outbound message и отправка в каналы

```text
Задача: реализовать отправку сообщений менеджера из inbox обратно в канал клиента.

Контекст:
- В MoonAI менеджер может подключиться к переписке из dashboard.
- В NeuroBoost есть Telegram inbound webhook и функция `send_telegram_message`, но нет нормального manager outbound endpoint из inbox.

Что сделать:
1. Создать service `apps/integrations/channel_router.py`:
   - `send_channel_message(conversation, text, sender_user=None)`.
2. Поддержать channel routing:
   - website: сохранить outbound message, статус `sent`, без внешнего API;
   - telegram: найти BotChannel, взять `external_user_id` как chat_id, вызвать `send_telegram_message`;
   - whatsapp/instagram: пока mock provider, статус `queued` или `sent` с metadata `mock: true`.
3. Создать endpoint:
   - `POST /api/inbox/conversations/{id}/messages/manager/`
   payload: `{ "text": "..." }`.
4. Endpoint должен:
   - проверить tenant access;
   - создать `BotMessage` direction outbound, sender_type manager;
   - вызвать `send_channel_message`;
   - обновить status/sent_at/error_text;
   - обновить conversation last_outbound_at/last_message_at/unread_count;
   - автоматически поставить `bot_enabled=false`, если это ручной takeover.
5. Добавить system message при takeover:
   - “Manager joined the conversation”.
6. Добавить tests:
   - website outbound;
   - telegram mock outbound при `TELEGRAM_ENABLED=false`;
   - no access for another tenant;
   - bot_enabled отключается после ручного ответа.

Acceptance criteria:
- Менеджер может отправить сообщение через inbox API.
- Telegram отправка использует существующий интеграционный слой.
- WhatsApp/Instagram пока безопасно mock-нуты.
- Ошибки внешнего канала сохраняются в message.error_text.
```

---

## PROMPT 05 — AI agent runtime: автоответ на входящее сообщение

```text
Задача: добавить AI-agent runtime, который обрабатывает входящие сообщения и может создавать AI-ответ/черновик.

Важно:
- Не отправлять AI-ответ всегда без контроля. Сделать режимы: draft_only и auto_reply.
- Учитывать `bot_enabled`, статус бота и канала.

Что сделать:
1. Создать service `apps/bots/runtime.py`:
   - `handle_inbound_message(message_id)`;
   - `build_agent_context(conversation)`;
   - `generate_agent_reply(conversation, mode="draft_only" | "auto_reply")`.
2. Источники контекста:
   - последние 12-20 сообщений;
   - Bot settings_json;
   - Business profile;
   - активные `BusinessKnowledgeItem`;
   - lead/client data;
   - services/resources/working hours, если есть.
3. Добавить в `Bot.settings_json` поддерживаемые настройки:
   - `system_prompt`;
   - `tone`;
   - `business_description`;
   - `handoff_triggers`;
   - `auto_reply_enabled`;
   - `draft_only`;
   - `max_context_messages`;
   - `allowed_tools`.
4. При входящем сообщении:
   - сохранить inbound;
   - если bot disabled или conversation handoff_required — не отвечать автоматически;
   - если auto_reply_enabled — создать outbound bot message и отправить через channel_router;
   - если draft_only — создать AI draft в отдельной модели или message со статусом queued/draft.
5. Добавить новую модель, если удобно:
   - `AIDraftReply` with conversation, message, text, status, model, tokens_used, created_by_runtime.
6. Подключить runtime к website chat и Telegram inbound.
7. Пока можно запускать синхронно, но заложить Celery task wrapper `process_inbound_message_task`.
8. Логировать AIRequestLog.
9. Добавить tests:
   - no auto reply when bot disabled;
   - draft created in draft_only;
   - outbound bot message in auto_reply;
   - knowledge base included in input_json;
   - tenant isolation.

Acceptance criteria:
- Входящее сообщение может породить AI draft или AI auto reply.
- Runtime использует knowledge base и историю диалога.
- Все AI действия логируются.
```

---

## PROMPT 06 — Agent builder: prompt, каналы, режимы работы

```text
Задача: улучшить страницу ботов до уровня простого Agent Builder, как у MoonAI.

Что сделать на frontend:
1. В `BotDetailPage` добавить вкладки:
   - Overview;
   - Prompt;
   - Knowledge;
   - Channels;
   - Test chat;
   - Runtime settings;
   - Logs.
2. Prompt tab:
   - system_prompt textarea;
   - tone select;
   - business_description textarea;
   - forbidden_topics textarea/list;
   - fallback_message;
3. Runtime settings:
   - auto_reply_enabled toggle;
   - draft_only toggle;
   - handoff triggers:
     - client asks for human;
     - negative sentiment;
     - price objection;
     - appointment requested;
     - unknown question;
   - max_context_messages;
4. Channels tab:
   - website channel public token;
   - copy embed snippet;
   - Telegram webhook info;
   - WhatsApp/Instagram placeholders with status `coming soon/provider required`.
5. Test chat:
   - отправка тестового сообщения в runtime без внешнего канала;
   - вывод AI draft/answer.

Что сделать на backend:
1. Добавить serializer validation для `Bot.settings_json`.
2. Добавить endpoint:
   - `POST /api/bots/{id}/test-message/`
   payload `{ "text": "..." }`.
3. Endpoint создаёт/использует test conversation и возвращает AI reply/draft.
4. Добавить tests.

Acceptance criteria:
- Бота можно настроить не только названием, но и поведением.
- Можно тестировать агента без подключения реального канала.
- Website embed snippet доступен из UI.
```

---

## PROMPT 07 — Knowledge base retrieval для AI-агента

```text
Задача: сделать базу знаний бизнеса реально используемой AI-агентом.

Текущее состояние:
- Есть `BusinessKnowledgeItem` с title/content/category/is_active.
- Нужно добавить retrieval service.

Что сделать:
1. Создать `apps/ai_core/knowledge_retrieval.py`.
2. Реализовать простой retrieval без embeddings на первом этапе:
   - keyword scoring по text/title/category;
   - нормализация RU/KZ/EN текста;
   - top N active knowledge items;
   - fallback: последние/важные items.
3. Добавить настройки:
   - max_knowledge_items default 5;
   - max_knowledge_chars default 4000.
4. Подключить retrieval в `apps/bots/runtime.py`.
5. Добавить endpoint для preview retrieval:
   - `POST /api/ai/knowledge-items/preview-context/`
   payload `{ "query": "...", "business": id optional }`.
6. Добавить tests:
   - inactive items ignored;
   - relevant item appears higher;
   - context length limited;
   - tenant isolation.

Acceptance criteria:
- AI runtime получает релевантные знания, а не всю базу подряд.
- Есть preview endpoint для отладки.
```

---

## PROMPT 08 — AI tools/function calling: CRM actions из диалога

```text
Задача: добавить безопасный слой AI tools/function calling, похожий на MoonAI functions, но без риска автоматических опасных действий.

Цель:
AI должен уметь предлагать или выполнять разрешённые действия:
- создать лид;
- обновить клиента;
- создать сделку;
- создать задачу;
- предложить запись;
- создать appointment после подтверждения.

Что сделать:
1. Создать app/service:
   - `apps/ai_core/tools.py`
   - `apps/ai_core/tool_registry.py`
2. Описать tool schema:
   - name;
   - description;
   - input_schema;
   - permission_level: suggest_only / auto_allowed / requires_manager_confirmation;
   - handler.
3. Реализовать tools:
   - `create_lead_from_conversation`;
   - `update_client_contact_data`;
   - `create_deal_from_conversation`;
   - `create_task_for_manager`;
   - `suggest_appointment_slots`;
   - `create_appointment_after_confirmation`.
4. Создать модель `AIToolCall`:
   - business;
   - conversation;
   - tool_name;
   - input_json;
   - output_json;
   - status: suggested/approved/executed/failed/rejected;
   - requires_confirmation bool;
   - approved_by nullable;
   - executed_at nullable;
5. Runtime должен уметь создать suggested tool call, но не выполнять опасное действие без подтверждения, если tool requires confirmation.
6. Добавить endpoints:
   - `GET /api/ai/tool-calls/`
   - `POST /api/ai/tool-calls/{id}/approve/`
   - `POST /api/ai/tool-calls/{id}/reject/`
7. В inbox right panel показывать suggested actions.
8. Добавить tests:
   - tool call suggested;
   - approve executes;
   - reject does not execute;
   - tenant isolation;
   - no duplicate lead if existing client/lead linked.

Acceptance criteria:
- AI может не просто отвечать, а связывать диалог с CRM.
- Опасные действия требуют подтверждения менеджера.
```

---

## PROMPT 09 — Handoff logic: когда AI передаёт менеджеру

```text
Задача: реализовать автоматическую передачу диалога менеджеру.

Что сделать:
1. Создать `apps/bots/handoff.py`:
   - `detect_handoff_need(conversation, latest_message, ai_result=None)`.
2. Handoff triggers:
   - клиент просит человека/оператора/менеджера;
   - AI не уверен или нет ответа в базе знаний;
   - клиент ругается/негатив;
   - клиент готов купить/записаться;
   - клиент отправил телефон;
   - VIP/high priority lead;
   - запрещённая тема;
   - больше N сообщений без результата.
3. При handoff:
   - `handoff_required=true`;
   - `bot_enabled=false`, если настройка требует;
   - `handoff_reason`;
   - создать notification для менеджера;
   - создать system message.
4. Добавить endpoint:
   - `POST /api/inbox/conversations/{id}/handoff/`
   - `POST /api/inbox/conversations/{id}/resolve-handoff/`
5. Frontend:
   - badge “Needs human”;
   - фильтр handoff;
   - кнопка “Take over”;
   - кнопка “Return to bot”.
6. Tests:
   - human request phrase triggers handoff;
   - manager takeover disables bot;
   - resolve handoff can enable bot back;
   - notification created.

Acceptance criteria:
- AI не ведёт рискованные диалоги бесконечно.
- Менеджер видит, где нужно вмешаться.
```

---

## PROMPT 10 — Channel connector abstraction: WhatsApp/Instagram placeholders

```text
Задача: подготовить архитектуру подключений каналов, чтобы позже легко добавить WhatsApp/Instagram через Wazzup/Meta/360dialog.

Что сделать:
1. Создать интерфейс provider:
   - `apps/integrations/providers/base.py`
   - methods: parse_webhook, send_message, verify_webhook, normalize_contact, get_channel_type.
2. Реализовать providers:
   - `TelegramProvider` на базе текущего telegram.py;
   - `WebsiteProvider`;
   - `MockWhatsAppProvider`;
   - `MockInstagramProvider`;
   - `WazzupProvider` placeholder.
3. Создать `ProviderEvent` model или использовать raw payload в BotMessage, но добавить единый event normalization:
   - channel;
   - external_chat_id;
   - external_user_id;
   - text;
   - attachments;
   - raw_payload.
4. Добавить generic webhook endpoint:
   - `POST /api/integrations/{provider_slug}/webhook/`
5. Telegram старый endpoint оставить совместимым, но внутри направить в общий provider router.
6. Добавить env.example переменные:
   - WAZZUP_API_URL;
   - WAZZUP_API_KEY;
   - META_VERIFY_TOKEN;
   - WHATSAPP_PROVIDER;
   - INSTAGRAM_PROVIDER.
7. Добавить docs:
   - `docs/integrations/channel_providers.md`.
8. Tests:
   - provider resolution;
   - normalized inbound event;
   - mock outbound;
   - old telegram endpoint still works.

Acceptance criteria:
- Каналы подключаются через единый слой, а не хаотично.
- Можно позже добавить реального провайдера без переписывания inbox/runtime.
```

---

## PROMPT 11 — Inbox analytics и AI quality metrics

```text
Задача: добавить аналитику по диалогам, AI и менеджерам.

Что сделать:
1. Добавить metrics service:
   - conversations_count;
   - inbound_count;
   - outbound_count;
   - avg_first_response_time;
   - avg_resolution_time;
   - handoff_count;
   - bot_auto_replies_count;
   - manager_replies_count;
   - leads_created_from_conversations;
   - deals_created_from_conversations;
   - AI token usage by business/bot/channel;
   - failed outbound messages.
2. Добавить endpoint:
   - `GET /api/analytics/inbox-summary/?from=&to=&business=&channel=`.
3. Добавить frontend widgets на AnalyticsPage:
   - Inbox volume;
   - AI automation rate;
   - Handoff rate;
   - Avg response time;
   - Leads from chats;
   - Failed messages.
4. Добавить Platform analytics placeholder/endpoint для platform_admin:
   - total merchants;
   - active bots;
   - total conversations;
   - token usage;
   - top businesses by usage.
5. Tests на tenant access и correct aggregation.

Acceptance criteria:
- Мерчант видит эффективность inbox/AI.
- Platform admin видит usage по платформе.
```

---

## PROMPT 12 — Usage/token billing limits

```text
Задача: связать AI usage с тарифами и биллингом.

Текущее состояние:
- Есть billing plans/subscriptions.
- Есть AIRequestLog с tokens_used.

Что сделать:
1. Расширить SubscriptionPlan:
   - max_ai_tokens_per_month;
   - max_conversations_per_month;
   - max_bots;
   - max_channels;
   - allow_auto_reply bool;
   - allow_integrations JSON/list.
2. Добавить usage service:
   - current_month_token_usage(business);
   - current_month_conversation_usage(business);
   - can_run_ai(business);
   - can_create_bot/channel;
3. Runtime должен проверять лимиты перед AI request.
4. Если лимит превышен:
   - не вызывать AI;
   - создать system message;
   - notification владельцу;
   - вернуть понятную ошибку/API response.
5. Frontend Billing page/current subscription:
   - usage bars;
   - token usage;
   - conversations usage;
   - bots/channels usage.
6. Tests:
   - AI blocked after limit;
   - auto_reply blocked if plan disallows;
   - owner notified;
   - platform admin not blocked in support mode.

Acceptance criteria:
- AI usage контролируется тарифами.
- Нельзя бесконечно тратить токены без учёта.
```

---

## PROMPT 13 — WebSocket или polling для live inbox

```text
Задача: добавить near-real-time обновления inbox.

Важно:
- Если Channels/WebSocket слишком тяжело сейчас, сделать polling 5-10 секунд как первый этап.
- Не ломать текущий frontend.

Вариант A — простой polling:
1. На ConversationsPage добавить refetch interval для списка диалогов и сообщений выбранного диалога.
2. Не перезатирать draft input менеджера.
3. Показывать indicator “new messages”.

Вариант B — WebSocket позже:
1. Добавить Django Channels dependency.
2. Создать consumer `/ws/inbox/{business_id}/`.
3. Broadcast при создании BotMessage.
4. Frontend подписка и update cache.

На этом этапе выбери polling, если WebSocket требует слишком много изменений.

Acceptance criteria:
- Новые сообщения появляются без ручного refresh.
- UX не ломает ввод менеджера.
```

---

## PROMPT 14 — Security hardening для public chat/webhooks

```text
Задача: усилить безопасность public website chat и webhooks.

Что сделать:
1. Rate limit public website chat endpoints:
   - per IP;
   - per public_token;
   - per external_user_id/session.
2. Добавить simple spam protection:
   - max message length;
   - block empty messages;
   - block too many messages per minute.
3. Проверить Telegram webhook secret logic.
4. Для generic providers добавить signature/secret validation placeholder.
5. Не хранить секреты в response serializers.
6. Проверить CORS/env settings.
7. Добавить tests:
   - public chat rejects long message;
   - rate limit works if possible;
   - wrong webhook secret rejected;
   - config_json secret fields not exposed.

Acceptance criteria:
- Public endpoints не являются открытой дырой.
- Секреты не утекут во frontend.
```

---

## PROMPT 15 — Финальный regression pass после всех этапов

```text
Задача: после реализации этапов omnichannel inbox + AI agent провести regression pass.

Что проверить:
1. Backend:
   - migrations;
   - pytest;
   - API urls;
   - tenant isolation;
   - auth roles;
   - public endpoints;
   - Telegram webhook backward compatibility.
2. Frontend:
   - npm run build;
   - login;
   - merchant route `/dashboard`;
   - platform route `/platform`;
   - conversations page;
   - bots page;
   - bot detail page;
   - analytics/billing/settings pages.
3. Документация:
   - docs/architecture/current_state.md update;
   - docs/architecture/omnichannel_inbox.md;
   - docs/integrations/channel_providers.md;
   - .env.example актуален.
4. Не оставлять demo-only тексты там, где уже есть backend.
5. Не удалять старые endpoints без совместимости.

Acceptance criteria:
- Проект собирается.
- Backend tests проходят.
- Основной пользовательский flow работает:
  - create bot;
  - create website channel;
  - send public website message;
  - see inbox conversation;
  - generate AI draft;
  - manager sends reply;
  - close conversation.
```

---

# 4. Рекомендуемый порядок запуска Codex

1. PROMPT 01 — очистка/аудит.
2. PROMPT 02 — inbox backend.
3. PROMPT 03 — inbox frontend.
4. PROMPT 04 — manager outbound.
5. PROMPT 05 — AI runtime.
6. PROMPT 06 — agent builder.
7. PROMPT 07 — knowledge retrieval.
8. PROMPT 08 — AI tools/function calling.
9. PROMPT 09 — handoff.
10. PROMPT 10 — channel providers.
11. PROMPT 11 — analytics.
12. PROMPT 12 — billing limits.
13. PROMPT 13 — live updates.
14. PROMPT 14 — security.
15. PROMPT 15 — regression.

---

# 5. Важные архитектурные правила для Codex

```text
1. Не превращать проект в набор несвязанных apps.
2. CRM остаётся центром данных.
3. Inbox становится центром коммуникаций.
4. AI agent — слой автоматизации поверх CRM + inbox, а не отдельная игрушка.
5. Все действия должны быть tenant-safe.
6. Platform admin не должен случайно смешиваться с merchant UI.
7. Для опасных AI-действий всегда нужен approve/reject.
8. WhatsApp/Instagram сначала делать через provider abstraction/mock, не хардкодить конкретного поставщика.
9. Website chat и Telegram — первые реальные каналы.
10. Любой новый endpoint должен иметь tests.
11. Любой новый frontend screen должен проходить `npm run build`.
12. Не ломать существующие маршруты `/dashboard`, `/platform`, `/api/auth/me/`, `/api/platform/ping/`.
```

---

# 6. Самый важный вывод

NeuroBoost уже ближе к полноценной платформе, чем к простому chatbot SaaS. Поэтому копировать MoonAI один-в-один не нужно. Правильная стратегия:

```text
MoonAI = AI agent + omnichannel inbox.
NeuroBoost = CRM-first AI OS для малого бизнеса:
CRM + Inbox + AI agents + Automations + Billing + Platform admin + Growth tools.
```

Первый большой milestone:

```text
Merchant может создать бота → подключить website/telegram → получить сообщение → увидеть его в inbox → AI даст черновик → менеджер ответит → лид/сделка создастся в CRM.
```

Когда этот flow будет работать стабильно, проект уже станет коммерчески демонстрируемым MVP уровня выше обычного CRM.
