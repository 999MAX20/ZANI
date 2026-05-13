# Zani Technical Implementation Prompts — Phases A/B/C/D

Основано на документе:

- `/Users/maksim/Desktop/Zani/plan/zani_competitive_crm_product_tasks.md`

Актуализировано после сравнения с текущей кодовой базой `/Users/maksim/Desktop/Zani`.

Цель: поэтапно довести Zani до уровня сильной CRM/Business OS, которая не уступает amoCRM/Bitrix24 по критичной бизнес-логике, но остаётся простой, быстрой и понятной для МСБ.

Главный принцип реализации:

Не добавлять “сложность ради сложности”. Каждая новая enterprise-функция должна иметь простой default mode для малого бизнеса и advanced mode для растущих команд.

## Общие правила для каждого prompt

Перед началом каждого этапа:

1. Прочитать текущие модели/API/frontend modules, которые затрагиваются.
2. Не ломать tenant isolation.
3. Не удалять существующие рабочие функции.
4. Не смешивать Merchant CRM и Platform Admin.
5. Не добавлять paid providers без явного запроса.
6. Не делать тяжёлый UI в стиле Bitrix24.
7. После реализации обновить README или relevant docs.
8. После реализации выполнить проверки.

Обязательные проверки:

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

UI/UX smoke после frontend-изменений:

- проверить desktop;
- проверить mobile viewport;
- проверить пустые состояния;
- проверить loading/error states;
- проверить, что основное действие доступно за 1-3 клика.

## Текущее состояние проекта на момент актуализации

Уже реализовано и не должно дублироваться:

- базовый Django/DRF backend;
- JWT auth;
- Merchant CRM routes;
- Platform Admin foundation и real dashboard;
- tenant isolation;
- businesses, clients, leads, services, resources, working hours, appointments;
- pipelines, stages, deals, stage move action;
- tasks с priorities/status/due/reminder/recurrence и actions `start/complete/cancel`;
- notifications summary/actions;
- activity events, notes, tags, tagged objects;
- automation foundation: rules, conditions, actions, runs, engine;
- bots foundation;
- website chat widget foundation;
- Telegram provider/config/webhook skeleton;
- provider abstraction and IntegrationEventLog;
- unified inbox backend and frontend;
- inbox actions: assign, handoff, mark-read, send outbound, create task, create/link lead;
- AI assistant mock, AI request logs, knowledge items;
- AI agent profiles;
- AI tool registry skeleton;
- billing plans/subscription/usage foundation;
- file safety foundation and private file endpoint;
- production baseline docs/Docker/Gunicorn/Celery-ready setup;
- public website shell;
- responsive frontend shell with sidebar/header/mobile nav.

Частично реализовано, но требует усиления:

- activity timeline есть, но нужны richer hooks, filters и более понятный UI;
- deals kanban есть, но нет full stage validation, required fields, win/loss reasons и SLA UX;
- inbox есть, но UX ещё недостаточно “messenger-grade” и нет quick replies/internal notes/attachments;
- tasks есть, но нет comments/watchers/reopen/snooze/team tabs;
- tags есть, но нет saved segments/smart filters;
- notifications есть, но нет read state/action URLs/priority/category UX;
- audit/support grants есть foundation, но нет security center UI;
- mobile UX есть базово, но нужен отдельный polish pass.

Не реализовано:

- full CRM entity drawers/cards;
- CRM card aggregate endpoints;
- duplicate detection/merge;
- custom fields;
- quick replies;
- WhatsApp webhook/provider production foundation;
- attachments model/API;
- role presets/team access UI;
- import/export;
- forms/lead capture;
- public API tokens/webhooks;
- onboarding templates.

Важно: дальнейшие prompts должны быть delta-oriented: дорабатывать существующие слои, а не переписывать их заново.

---

# PHASE A — CRM Daily Work Foundation

Цель: сделать Zani полноценной ежедневной CRM, в которой бизнес быстро работает с клиентами, лидами, сделками и записями.

Эта фаза закрывает главный разрыв с amoCRM: карточки, история, дубли, custom fields, pipeline UX.

---

## PROMPT A1 — Unified CRM Entity Drawer

Ты — senior fullstack engineer и senior product designer.

### Цель

Создать единый UX-паттерн карточек CRM-сущностей через drawer/modal, чтобы пользователь мог быстро открыть клиента, заявку, сделку или запись без ухода со страницы.

### Backend

Пока не добавлять новые модели, если текущих данных достаточно.

В текущем frontend уже есть отдельные страницы и формы, но нет единого drawer/card слоя. Это главный UI/UX gap.

Проверить и при необходимости расширить serializers для:

- Client;
- Lead;
- Deal;
- Appointment;
- Task;
- ActivityEvent;
- BotConversation.

Нужно, чтобы frontend мог получить связанные данные:

- клиент;
- заявки клиента;
- сделки клиента;
- записи клиента;
- задачи клиента;
- сообщения/диалоги клиента;
- timeline events.

Если существующих endpoints недостаточно, добавить lightweight detail endpoints:

- `GET /api/clients/{id}/crm-card/`
- `GET /api/leads/{id}/crm-card/`
- `GET /api/deals/{id}/crm-card/`
- `GET /api/appointments/{id}/crm-card/`

Каждый endpoint строго tenant-filtered.

### Frontend

Создать reusable components:

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
- `EntityQuickActions`.
- `EntityNotesPanel`.

Интегрировать drawer в страницы:

- Clients;
- Leads;
- Deals;
- Appointments;
- Calendar.

### UI/UX

Drawer должен:

- открываться быстро;
- не ломать текущий контекст страницы;
- иметь короткий header с именем, статусом и быстрыми действиями;
- показывать primary action:
  - для лида: “Создать запись” / “Написать”;
  - для клиента: “Создать заявку” / “Создать запись”;
  - для сделки: “Следующий шаг” / “Сменить этап”;
  - для записи: “Подтвердить” / “Перенести” / “Отменить”.

Не делать тяжелую страницу с десятками вкладок. Использовать понятные tabs:

- Overview;
- Timeline;
- Tasks;
- Messages;
- Notes.

### Acceptance criteria

- Пользователь может открыть карточку клиента из списка клиентов.
- Пользователь может открыть карточку лида из списка лидов.
- Пользователь может открыть карточку сделки из kanban.
- В карточке видны связанные задачи, записи, сообщения и timeline.
- Нет full page reload.
- Mobile drawer удобен и занимает почти весь экран.

---

## PROMPT A2 — Activity Timeline Unification

Ты — senior backend engineer.

### Цель

Сделать activity timeline центральным источником истории по клиенту/лиду/сделке.

### Backend

Проверить текущую модель `ActivityEvent`.

В текущем проекте уже есть:

- `ActivityEvent`;
- `Note`;
- `Tag`;
- `TaggedObject`;
- `write_activity_event(...)`;
- API `/api/activity-events/`, `/api/notes/`, `/api/tags/`, `/api/tagged-objects/`.

Не создавать эти модели заново. Нужно усилить существующий слой.

Доработать event creation hooks для:

- client_created;
- lead_created;
- lead_status_changed;
- deal_created;
- deal_stage_changed;
- task_created;
- task_completed;
- appointment_created;
- appointment_cancelled;
- message_received;
- message_sent;
- note_created;
- automation_run.

Добавить service-layer:

- `create_activity_event(...)` как более явную обёртку над текущим `write_activity_event(...)` или рефакторинг без поломки existing callers;
- `activity_for_client(client)`;
- `activity_for_entity(entity_type, entity_id)`.

### API

Добавить фильтры:

- `business`;
- `client` и совместимость с текущим `client_id`;
- `entity_type`;
- `entity_id`;
- `category`;
- `event_type`;
- date range.

Endpoint:

- `GET /api/activity-events/?client=&entity_type=&entity_id=`

### Frontend

Обновить `TimelinePage`.

Добавить timeline внутри CRM drawer:

- compact item;
- icon per category;
- date grouping;
- empty state.

### UI/UX

Timeline должен отвечать на вопрос:

“Что происходило с этим клиентом?”

Не показывать технический мусор. Для системных событий использовать человекочитаемые тексты.

### Acceptance criteria

- Создание лида пишет timeline event.
- Смена статуса лида пишет timeline event.
- Создание записи пишет timeline event.
- Создание/закрытие задачи пишет timeline event.
- Входящее/исходящее inbox-сообщение пишет timeline event, если есть client/link.
- В карточке клиента видна история событий.
- Текущая `TimelinePage` не ломается.
- Tenant isolation сохранён.

---

## PROMPT A3 — Duplicate Detection Foundation

Ты — senior backend engineer.

### Цель

Предотвратить хаос в CRM из-за дублей клиентов и заявок.

### Backend

Добавить service-layer:

- `find_duplicate_clients(business, phone=None, email=None, whatsapp_id=None, telegram_id=None, instagram_id=None)`;
- `normalize_phone(phone)`;
- `normalize_email(email)`.

Добавить endpoints:

- `POST /api/clients/check-duplicates/`
- `POST /api/leads/check-duplicates/`

Response:

```json
{
  "duplicates": [
    {
      "id": 1,
      "full_name": "Client",
      "phone": "+7701...",
      "email": "client@example.com",
      "matched_fields": ["phone"]
    }
  ]
}
```

Добавить merge foundation:

- `POST /api/clients/{id}/merge/`

На первом этапе merge может:

- переносить leads;
- переносить appointments;
- переносить conversations;
- переносить tasks;
- архивировать/удалять duplicate client только после проверки.

Обязательно писать audit/activity event.

### Frontend

В ClientForm и LeadForm:

- проверять дубли при вводе phone/email;
- показывать warning;
- кнопка “Открыть существующего клиента”;
- кнопка “Создать всё равно”;
- merge UI можно сделать простым modal.

### UI/UX

Не блокировать пользователя агрессивно. Сначала предупреждать и помогать выбрать.

### Acceptance criteria

- Дубли ищутся только внутри business.
- Поиск по телефону работает с нормализацией.
- При создании клиента с дублем пользователь видит предупреждение.
- Merge переносит связанные сущности.
- Действие логируется.

---

## PROMPT A4 — Custom Fields Foundation

Ты — senior backend architect.

### Цель

Добавить настраиваемые поля для CRM-сущностей без хаоса в схемах БД.

### Backend

Добавить app или models в `core/crm`:

`CustomFieldDefinition`:

- business;
- entity_type;
- key;
- label;
- field_type;
- options_json;
- is_required;
- is_active;
- sort_order;
- created_at;
- updated_at.

`CustomFieldValue`:

- business;
- definition;
- entity_type;
- entity_id;
- value_json;
- created_at;
- updated_at.

Field types:

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

### API

- `/api/custom-fields/`
- `/api/custom-field-values/`
- `GET /api/custom-fields/?entity_type=client`
- bulk update endpoint for entity card:
  - `POST /api/custom-field-values/bulk-upsert/`

### Frontend

Добавить:

- settings page section “Custom fields”;
- simple field builder;
- render custom fields in CRM drawers;
- edit custom fields from drawer.

### UI/UX

Сделать simple mode:

- “Добавить поле”;
- название;
- тип;
- варианты, если select.

Advanced options спрятать.

### Acceptance criteria

- Business может создать custom field для clients.
- Значение custom field сохраняется для клиента.
- Поле видно в drawer.
- Tenant isolation сохранён.

---

## PROMPT A5 — Pipeline and Stage Engine Upgrade

Ты — principal CRM backend/frontend engineer.

### Цель

Довести pipeline engine до зрелого состояния: stages, SLA, probability, required fields, win/loss reasons.

### Backend

В текущем проекте уже есть:

- color;
- probability;
- sla_minutes;
- is_won;
- is_lost;

Не добавлять эти поля повторно. Нужно расширить существующие `PipelineStage`, `Deal`, `StageTransition` и `move-stage`.

Добавить в PipelineStage:

- required_fields_json;
- allowed_roles_json.

Расширить Deal:

- lost_reason;
- won_at;
- lost_at;
- stage_entered_at;
- next_action_at.

Добавить:

- stage transition validation;
- required fields check before moving stage;
- activity event on stage change;
- SLA overdue flag.
- автоматическое обновление `stage_entered_at`;
- корректную установку `won_at/lost_at`;
- опциональный `lost_reason` при переходе в lost stage.

### API

Обновить:

- `/api/deals/{id}/move-stage/`

Добавить:

- `GET /api/pipelines/{id}/board/`
- `POST /api/pipelines/templates/apply/`

### Frontend

В текущем проекте `DealsPage` уже содержит kanban и drag/drop. Не переписывать страницу полностью.

Улучшить `DealsPage`:

- stage settings;
- visible SLA indicators;
- win/loss modal;
- required fields warning;
- better drag/drop feedback;
- mobile kanban compact mode.
- preserved scroll/column state after mutation;
- clearer empty columns;
- deal drawer integration from A1.

### UI/UX

По умолчанию воронка должна быть простой. Advanced настройки этапа открываются отдельно.

### Acceptance criteria

- Сделку нельзя переместить в этап с required fields без заполнения.
- Stage change пишет activity event.
- Kanban показывает SLA/overdue.
- Win/loss reasons сохраняются.

---

## PROMPT A6 — Owner Analytics Dashboard MVP

Ты — senior product analyst и frontend engineer.

### Цель

Сделать аналитику для владельца бизнеса без BI-перегруза.

### Backend

Добавить endpoint:

- `GET /api/analytics/owner-dashboard/`

Метрики:

- new_leads;
- leads_by_source;
- appointments_today;
- appointments_completed;
- no_show_count;
- conversion_lead_to_appointment;
- open_tasks;
- overdue_tasks;
- manager_response_time placeholder;
- revenue_estimate.

### Frontend

Обновить DashboardPage/AnalyticsPage:

- 5-7 KPI cards;
- блок “Что требует внимания”;
- последние лиды;
- ближайшие записи;
- простые source breakdowns.

### UI/UX

Не делать сложные графики. Основной вопрос:

“Что происходит в бизнесе и что нужно сделать?”

### Acceptance criteria

- Dashboard грузит реальные метрики.
- Empty state выглядит полезно.
- Mobile dashboard читабелен.

---

# PHASE B — Communication OS

Цель: сделать Zani сильным communication-first продуктом для SMB, где CRM и общение соединены в одном рабочем процессе.

---

## PROMPT B1 — Inbox UX Polish

Ты — senior frontend engineer и product designer.

### Цель

Довести Inbox до уровня современного мессенджера.

### Frontend

В текущем проекте уже есть `ConversationsPage` с:

- list/detail/context layout;
- filters;
- assign/handoff/mark-read;
- outbound manager reply;
- create task;
- create/link lead;
- AI draft notice.

Не переписывать всё с нуля. Нужно улучшить UX и закрыть недостающие messenger patterns.

Улучшить `ConversationsPage`:

- cleaner 3-column layout desktop;
- mobile inbox layout;
- conversation search;
- channel filters;
- unread filters;
- priority filters;
- assigned filters;
- message composer;
- quick actions;
- internal notes;
- better empty/loading/error states.
- persistent selected conversation via URL/search param;
- visible linked client/lead/deal cards;
- clear unread/handoff/SLA indicators;
- message grouping by date;
- failed/queued message state.

### Backend

Если нужно, добавить:

- filter `assigned_to=me`;
- filter `unread=true`;
- filter `priority`;
- endpoint for internal note message.
- filter `q`;
- filter `channel`;
- filter `handoff_required=true`.

### UI/UX

Менеджер должен за 3 секунды понять:

- кто написал;
- откуда;
- что хочет;
- срочно ли;
- кто отвечает;
- что можно сделать дальше.

### Acceptance criteria

- Inbox удобен на desktop и mobile.
- Есть фильтр unread.
- Есть назначение на себя.
- Есть быстрый переход к клиенту/лиду.
- AI suggestion не просто notice, а вставляется в composer.
- Создание task/lead не выглядит как техническое действие.

---

## PROMPT B2 — Quick Replies and Templates

Ты — senior fullstack engineer.

### Цель

Добавить шаблоны быстрых ответов для менеджеров и AI.

### Backend

Модель `QuickReplyTemplate`:

- business;
- title;
- text;
- channel;
- category;
- is_active;
- sort_order.

API:

- `/api/quick-replies/`

### Frontend

В Inbox composer:

- кнопка quick replies;
- поиск шаблона;
- вставка текста;
- управление шаблонами в settings.

### UI/UX

Шаблоны должны быть быстрыми, а не отдельным сложным модулем.

### Acceptance criteria

- Можно создать quick reply.
- Можно вставить quick reply в сообщение.
- Templates tenant-filtered.

---

## PROMPT B3 — WhatsApp Integration Foundation

Ты — senior integrations engineer.

### Цель

Подготовить WhatsApp как production-ready provider abstraction без привязки к конкретному paid provider.

### Backend

В текущем provider layer уже есть mock providers, включая WhatsApp mock registration. Не создавать отдельную параллельную систему.

Расширить существующий provider layer:

- WhatsApp provider interface;
- mock mode;
- inbound webhook placeholder;
- outbound send abstraction;
- IntegrationEventLog.

Endpoints:

- `POST /api/integrations/whatsapp/webhook/`
- channel config actions for BotChannel.

### Frontend

В BotDetailPage:

- WhatsApp setup section;
- provider status;
- webhook URL;
- mock/disabled state.

### Acceptance criteria

- WhatsApp mock inbound создаёт conversation/message.
- Outbound через provider layer логируется.
- Без env/provider credentials dev не ломается.
- Telegram provider продолжает работать после изменений.

---

## PROMPT B4 — Conversation to CRM Linking

Ты — senior CRM product engineer.

### Цель

Сделать связь диалога с CRM-сущностями простой и полезной.

### Backend

В текущем inbox backend уже есть:

- create task from conversation;
- create lead from conversation;
- link existing lead;
- private helper create client from conversation.

Нужно не дублировать их, а расширить:

- link conversation to client;
- link conversation to lead;
- link conversation to deal;
- create client from conversation;
- create lead from conversation;
- create deal from conversation.

Добавить duplicate check before create.

### Frontend

В Inbox context panel:

- linked client card;
- linked lead/deal;
- buttons:
  - “Создать клиента”;
  - “Создать заявку”;
  - “Создать сделку”;
  - “Привязать к существующему”.

### Acceptance criteria

- Из диалога можно создать клиента/лид/сделку.
- Если есть дубль, показывается предупреждение.
- Timeline обновляется.
- Existing create/link lead actions продолжают работать.

---

## PROMPT B5 — AI Reply Suggestions MVP

Ты — senior AI product engineer.

### Цель

Сделать AI suggestions полезными внутри inbox, без автодействий.

### Backend

В текущем проекте уже есть:

- `POST /api/bots/{id}/suggest-reply/`;
- `suggest_bot_reply(...)`;
- AgentProfile support;
- mock response without OpenAI key.

Нужно добавить conversation-first endpoint для Inbox, не ломая bot endpoint.

Endpoint:

- `POST /api/inbox/conversations/{id}/suggest-reply/`

Использовать:

- последние сообщения;
- linked client/lead data;
- AgentProfile;
- BusinessKnowledgeItem.

Без OPENAI_API_KEY возвращать mock response.

### Frontend

В composer:

- кнопка “AI reply”;
- AI suggestion panel;
- insert suggestion;
- regenerate;
- never auto-send.
- replace текущий notice-only UX на real draft insertion.

### Acceptance criteria

- AI suggestion появляется.
- Пользователь может вставить текст.
- Сообщение не отправляется без ручного действия.
- Старый bot suggest endpoint остаётся рабочим.

---

## PROMPT B6 — Attachments MVP

Ты — senior backend/frontend engineer.

### Цель

Добавить вложения к сообщениям и CRM timeline на базе file safety foundation.

### Backend

Модель `FileAttachment`:

- business;
- uploaded_by;
- file;
- original_name;
- content_type;
- size;
- entity_type;
- entity_id;
- visibility;
- created_at.

Использовать `validate_file_upload`.

API:

- `/api/file-attachments/`
- private download endpoint with object permission.

### Frontend

- upload button in inbox;
- attachments list in CRM drawer;
- preview/download action.

### Acceptance criteria

- Allowed file загружается.
- Forbidden extension отклоняется.
- Merchant не видит чужой файл.

---

# PHASE C — Team Operations and Control

Цель: сделать Zani удобным для команд 10-100+ человек без потери простоты.

---

## PROMPT C1 — Role Presets and Team Access

Ты — senior security/backend engineer.

### Цель

Создать понятную RBAC foundation.

### Backend

Модели:

- RolePreset;
- Permission;
- Team;
- TeamMember.

Permissions:

- view_all;
- view_team;
- view_own;
- create;
- edit;
- delete;
- export;
- manage_users;
- manage_integrations;
- manage_automations;
- manage_billing;
- view_financials.

На первом этапе можно хранить permissions в JSON на BusinessMember, но с clear service-layer.

### Frontend

Settings → Team:

- список сотрудников;
- роль;
- активность;
- invite placeholder;
- simple permissions view.

### UI/UX

Simple roles:

- Owner;
- Admin;
- Manager;
- Specialist.

Advanced permissions скрыть.

### Acceptance criteria

- Owner может видеть сотрудников.
- Manager не может управлять billing/integrations.
- Tenant isolation сохранён.

---

## PROMPT C2 — Task Management Upgrade

Ты — senior fullstack engineer.

### Цель

Сделать задачи полноценным рабочим инструментом команды.

### Backend

В текущем проекте `Task` уже содержит:

- priority;
- status;
- assignee;
- created_by;
- due_at;
- reminder_at;
- recurrence_rule;
- completed_at;
- links to client/lead/deal/appointment;
- actions `start`, `complete`, `cancel`.

Не добавлять эти поля повторно. Расширить Task:

- comments;
- watchers;
- parent_task;
- completed_by;

API actions:

- reopen;
- snooze;
- assign;
- add-comment;
- add-watcher/remove-watcher.

### Frontend

TasksPage:

- tabs: My, Today, Overdue, Team;
- task drawer;
- comments;
- reminders;
- quick complete.

### UI/UX

Задачи должны быть action-oriented. Не показывать всё подряд.

### Acceptance criteria

- Пользователь видит свои задачи.
- Можно завершить задачу.
- Можно открыть завершенную задачу заново.
- Можно отложить reminder.
- Есть комментарии.
- Overdue явно выделены.
- Task linked to client/lead/deal.

---

## PROMPT C3 — Automation Builder UI Simple Mode

Ты — senior frontend/backend engineer.

### Цель

Сделать автоматизации доступными не только разработчику.

### Backend

Использовать существующие AutomationRule/Condition/Action.

Добавить templates:

- new lead -> create task;
- new message -> notify manager;
- appointment created -> reminder;
- stage changed -> create follow-up.

Endpoint:

- `GET /api/automation-templates/`
- `POST /api/automation-templates/{id}/apply/`

### Frontend

AutomationsPage:

- simple templates view;
- enabled/disabled rules;
- run logs;
- create from template.

### UI/UX

Не показывать сложный builder первым экраном. Сначала шаблоны.

### Acceptance criteria

- Business can apply automation template.
- Rule appears in list.
- Run logs visible.

---

## PROMPT C4 — Automation Builder Advanced Mode

Ты — principal frontend engineer.

### Цель

Добавить trigger-condition-action builder.

### Frontend

UI:

- trigger selector;
- condition rows;
- action rows;
- delay action;
- validation;
- test run button.

### Backend

Validate automation config before save.

### Acceptance criteria

- Можно создать rule вручную.
- Невалидный rule не сохраняется.
- Test run показывает preview.

---

## PROMPT C5 — Manager Performance and SLA

Ты — senior analytics engineer.

### Цель

Добавить контроль команды без перегруза.

### Backend

Endpoint:

- `GET /api/analytics/team-performance/`

Metrics:

- assigned leads;
- closed leads;
- response time;
- overdue tasks;
- appointments completed;
- no-show;
- conversion.

### Frontend

AnalyticsPage:

- Team tab;
- manager table;
- simple badges;
- no heavy BI.

### Acceptance criteria

- Owner/admin видит team performance.
- Manager видит свои метрики.

---

## PROMPT C6 — Import and Export Foundation

Ты — senior backend engineer.

### Цель

Подготовить переезд из Excel/amoCRM/Bitrix24.

### Backend

ImportJob:

- business;
- created_by;
- entity_type;
- status;
- source_file;
- mapping_json;
- summary_json;

Endpoints:

- upload CSV/XLSX;
- preview mapping;
- confirm import.

Export:

- clients;
- leads;
- deals.

Write audit log on export.

### Frontend

Settings → Import/Export:

- upload;
- mapping;
- preview duplicates;
- import history;
- export buttons with permission check.

### Acceptance criteria

- CSV clients import works.
- Duplicate preview shown.
- Export requires permission.

---

# PHASE D — Growth, Integrations and Enterprise Readiness

Цель: расширить Zani до Growth OS без превращения в перегруженный портал.

---

## PROMPT D1 — Forms and Lead Capture

Ты — senior fullstack engineer.

### Цель

Создать формы захвата заявок.

### Backend

Models:

- LeadForm;
- LeadFormField;
- LeadFormSubmission.

Public endpoint:

- `POST /api/public/forms/{public_id}/submit/`

Features:

- UTM capture;
- source tracking;
- duplicate check;
- auto-create client/lead.

### Frontend

Settings/Forms:

- list forms;
- create from template;
- copy embed code;
- submissions list.

### Acceptance criteria

- Public form creates lead.
- UTM/source saved.
- Duplicate warning internally.

---

## PROMPT D2 — Tags and Smart Segments

Ты — senior CRM backend/frontend engineer.

### Цель

Добавить сегментацию клиентов.

### Backend

В текущем проекте уже есть `Tag` и `TaggedObject`.

Использовать/расширить existing tags. Не создавать второй tagging layer.

Add:

- Segment;
- SegmentFilter;
- saved filters.
- dynamic segment evaluation service;
- optional cached counts.

### Frontend

ClientsPage:

- tags;
- saved segments;
- quick filters.

### Acceptance criteria

- Можно создать segment.
- Segment filters clients.
- Tags visible in card.
- Existing tags/tagged objects API остаётся совместимым.

---

## PROMPT D3 — Public API Tokens and Webhooks

Ты — senior platform engineer.

### Цель

Подготовить интеграционную платформу.

### Backend

Models:

- ApiToken;
- WebhookEndpoint;
- WebhookDeliveryLog.

Features:

- scoped token;
- rate limiting;
- event delivery;
- retries;
- idempotency keys.

### Frontend

Settings → Developers:

- create token;
- webhook URL;
- delivery logs;
- copy secret.

### Acceptance criteria

- Token can access scoped API.
- Webhook logs delivery.
- Failed webhook is logged.

---

## PROMPT D4 — Notification Center Upgrade

Ты — senior fullstack engineer.

### Цель

Сделать уведомления единым рабочим центром.

### Backend

В текущем проекте уже есть Notification model, summary endpoint, `mark-sent` и `cancel`.

Расширить существующий Notification:

- category;
- action_url;
- action_label;
- read_at;
- priority.

Endpoints:

- summary;
- mark read;
- mark all read.
- unread count;
- list filters by category/read/priority.

### Frontend

Header notification dropdown:

- grouped notifications;
- action buttons;
- read/unread;
- mobile view.

### Acceptance criteria

- Уведомления можно прочитать.
- Action ведёт к нужной сущности.
- Existing reminder/appointment notifications не ломаются.

---

## PROMPT D5 — Security and Audit Center

Ты — senior security engineer.

### Цель

Дать владельцу контроль безопасности.

### Backend

В текущем проекте уже есть:

- `AuditLog`;
- `SupportAccessGrant`;
- audit helper;
- support grant permission foundation.

Нужно расширить и вывести в UI, а не создавать parallel audit system.

Add/extend:

- login history;
- export history;
- permission change audit;
- support access grant.

Endpoints:

- `/api/security/audit-log/`
- `/api/security/login-history/`
- `/api/security/support-grants/`

### Frontend

Settings → Security:

- audit table;
- login history;
- support access toggle/grant;
- export logs.

### Acceptance criteria

- Owner sees audit events.
- Support access requires explicit grant if enabled.
- Existing audit writes continue working.

---

## PROMPT D6 — Onboarding Templates by Niche

Ты — senior product engineer.

### Цель

Сделать запуск бизнеса за 5-10 минут.

### Backend

Templates:

- dentistry;
- beauty;
- sauna;
- autoservice;
- education;
- medical;
- other.

Template includes:

- pipeline;
- services examples;
- working hours;
- quick replies;
- automation templates;
- dashboard defaults.

Endpoint:

- `POST /api/onboarding/apply-template/`

### Frontend

Onboarding wizard:

- choose niche;
- confirm business details;
- apply template;
- setup checklist.

### Acceptance criteria

- New business can apply niche template.
- CRM becomes usable immediately.

---

## PROMPT D7 — Mobile-First Polish Pass

Ты — senior mobile web product designer.

### Цель

Сделать Zani удобным на телефоне как основной рабочий инструмент.

### Frontend

Проверить и доработать:

- header;
- sidebar/mobile nav;
- dashboard;
- leads;
- deals kanban;
- client drawer;
- inbox;
- calendar;
- task actions;
- forms.

### UI/UX

Mobile primary actions:

- call;
- WhatsApp;
- reply;
- create appointment;
- change status;
- create task.

### Acceptance criteria

- Нет горизонтального скролла.
- Основные действия доступны большим пальцем.
- Drawer/modals не обрезаются.
- Text не вылезает из кнопок/cards.

---

## PROMPT D8 — Final Competitive QA Pass

Ты — principal QA/product engineer.

### Цель

Проверить Zani против competitive checklist amoCRM/Bitrix24.

### Проверить

- CRM cards;
- pipelines;
- inbox;
- roles;
- tasks;
- automations;
- analytics;
- mobile UX;
- import/export;
- integrations;
- security;
- onboarding.

### Output

Создать:

- `docs/competitive-regression-report.md`

Содержимое:

- что готово;
- что частично готово;
- что уступает amoCRM;
- что уступает Bitrix24;
- что сильнее конкурентов;
- next critical tasks.

### Acceptance criteria

- Документ создан.
- Все critical flows проверены.
- Нет незадокументированных critical gaps.

---

# Recommended Execution Order

Лучший порядок реализации после сравнения с текущей версией проекта:

1. A1 — Unified CRM Entity Drawer.
2. A2 — Activity Timeline Unification.
3. B1 — Inbox UX Polish.
4. B5 — AI Reply Suggestions MVP.
5. B4 — Conversation to CRM Linking.
6. A3 — Duplicate Detection Foundation.
7. A4 — Custom Fields Foundation.
8. A5 — Pipeline and Stage Engine Upgrade.
9. A6 — Owner Analytics Dashboard MVP.
10. B2 — Quick Replies and Templates.
11. C2 — Task Management Upgrade.
12. C3 — Automation Builder UI Simple Mode.
13. C4 — Automation Builder Advanced Mode.
14. C1 — Role Presets and Team Access.
15. C5 — Manager Performance and SLA.
16. C6 — Import and Export Foundation.
17. D1 — Forms and Lead Capture.
18. D2 — Tags and Smart Segments.
19. D4 — Notification Center Upgrade.
20. D5 — Security and Audit Center.
21. B3 — WhatsApp Integration Foundation.
22. B6 — Attachments MVP.
23. D3 — Public API Tokens and Webhooks.
24. D6 — Onboarding Templates by Niche.
25. D7 — Mobile-First Polish Pass.
26. D8 — Final Competitive QA Pass.

Почему порядок изменён:

- CRM drawers и timeline нужны первыми, потому что почти все будущие функции должны отображаться в единой карточке.
- Inbox UX и AI draft insertion идут раньше WhatsApp, потому что текущий inbox уже есть и быстро даст пользователю ценность.
- WhatsApp отложен после product UX, чтобы не строить интеграцию поверх слабого интерфейса.
- Mobile polish оставлен ближе к концу, но mobile constraints должны проверяться на каждом frontend prompt.

## Notes For Future Codex Runs

Если пользователь говорит “приступай к следующему этапу из teh plan 13.05”, нужно:

1. Найти последний выполненный prompt в README/docs.
2. Взять следующий prompt из этого файла.
3. Реализовать только этот prompt.
4. Провести проверки.
5. Обновить README.
6. Дать короткий отчёт.

Если проверки падают:

1. Остановиться.
2. Исправить проблему.
3. Повторить проверки.
4. Не начинать следующий prompt, пока текущий не зелёный.
