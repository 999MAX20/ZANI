# Zani Unified Technical Implementation Plan — Phases A/B/C/D

Основано на документе:

- `/Users/maksim/Desktop/Zani/plan/zani_competitive_crm_product_tasks.md`
- `/Users/maksim/Desktop/Zani/plan/zani_amocrm_bitrix24_workflow_analysis.md`

Актуализировано после сравнения с текущей кодовой базой `/Users/maksim/Desktop/Zani`.

Цель: поэтапно довести Zani до уровня сильной CRM/Business OS, которая не уступает amoCRM/Bitrix24 по критичной бизнес-логике, но остаётся простой, быстрой и понятной для МСБ.

Этот файл является каноническим execution-plan. Отдельные competitive/analysis документы можно использовать как архив рассуждений, но реализация должна идти по этому unified plan.

Главный принцип реализации:

Не добавлять “сложность ради сложности”. Каждая новая enterprise-функция должна иметь простой default mode для малого бизнеса и advanced mode для растущих команд.

## Product North Star

Zani не должен становиться “ещё одной CRM”.

Мы строим AI-first SMB Growth OS:

- CRM — ядро ежедневной работы;
- Inbox — центр обработки клиентов;
- AI — помощник менеджера, а не декоративный слой;
- Automations — ускоритель рутины, а не тяжёлый BPM;
- Roles/Audit — защита бизнеса от хаоса и скрытия ошибок;
- Dashboard — список действий, а не витрина графиков;
- Mobile UX — основной рабочий режим для многих SMB, а не дополнение.

Если задача не помогает быстрее обработать клиента, безопаснее управлять командой или понятнее видеть бизнес, её нужно упростить или отложить.

## Competitive Product Principles

Zani берёт сильные стороны amoCRM и Bitrix24, но не копирует их буквально.

От amoCRM берём:

- sales-first логику;
- карточку клиента/сделки как рабочий центр;
- простую воронку;
- связь коммуникаций с CRM;
- задачи и следующий шаг;
- автоматизации вокруг этапов и событий.

От Bitrix24 берём:

- структурность для команд;
- роли, отделы и access scopes;
- прозрачность действий сотрудников;
- задачи и дисциплину выполнения;
- security/audit слой;
- enterprise-ready расширяемость.

Что Zani должен делать лучше:

- быть проще в освоении;
- быстрее открывать нужные действия;
- не перегружать интерфейс таблицами и настройками;
- давать owner-control без Bitrix-style матрицы на сотни чекбоксов;
- делать AI полезным внутри рабочего сценария, а не отдельным разделом ради “AI”.

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
9. Зафиксировать, какой пользовательский сценарий считается закрытым.
10. Проверить, что фича встроена в связанные CRM-слои: drawer, timeline, audit, permissions, dashboard, inbox или mobile там, где это применимо.

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

## Definition of Done для каждого prompt

Каждый prompt считается завершённым только если закрыты все уровни готовности.

### 1. Data

- модели и миграции корректны;
- tenant isolation сохранён;
- нет дублей уже существующих моделей/слоёв;
- критичные действия имеют поля для истории, статуса, причины или audit, если это требуется бизнес-логикой.

### 2. API

- endpoints реализованы или существующие endpoints расширены без поломки обратной совместимости;
- serializers возвращают данные, нужные frontend без лишних N+1-запросов;
- permissions проверяются на backend, а не только скрытием кнопок;
- forbidden actions возвращают понятный `403`;
- добавлены или обновлены тесты для ключевого сценария.

### 3. UX

- есть рабочий frontend-flow, а не только backend/API;
- предусмотрены loading, empty, error и forbidden states;
- основной action виден и доступен за 1-3 клика;
- mobile viewport не ломается;
- UI не превращается в админку или Bitrix-style перегруз.

### 4. Workflow

- пользователь может выполнить реальный бизнес-сценарий от начала до конца;
- изменения отражаются в связанных местах: карточка, timeline, audit, dashboard, inbox, analytics или notifications;
- если этап называется `Foundation` или `MVP`, в README/docs явно указано, что уже работает и что намеренно оставлено на следующий этап;
- не остаётся “невидимых” backend-фич, которые нельзя использовать из интерфейса.

Если хотя бы один уровень не закрыт, prompt нельзя считать продуктово завершённым.

## Anti-Rework Rules

Чтобы не возвращаться к одним и тем же задачам по кругу:

- не принимать `Foundation` как готовую фичу без минимального UI и user-flow;
- не делать CRM-фичи изолированно: они должны связываться с карточкой, timeline, permissions и audit там, где это уместно;
- не откладывать mobile до финала: mobile smoke обязателен в каждом frontend prompt;
- не добавлять AI-блоки без действия для пользователя;
- не добавлять аналитику без ответа на вопрос “что делать сейчас?”;
- не добавлять автоматизации без logs, preview/test или понятного safe mode;
- не добавлять export/import без permissions и audit;
- не добавлять delete для critical CRM entities без archive/restore и audit;
- не добавлять настройки ролей без простого preset mode.

## High-Risk Prompt Rules

Следующие prompts особенно легко выполнить формально и получить только часть желаемого результата. При их реализации обязательно использовать усиленные требования ниже.

### A4 — Custom Fields Foundation

Не достаточно создать модели и API.

Готовый результат должен включать:

- field builder в Settings;
- отображение и редактирование custom fields в CRM drawer;
- участие custom fields в required fields validation для pipeline stages;
- tenant-safe values;
- базовое использование в фильтрах хотя бы для clients/leads/deals.

### A6 — Owner Analytics Dashboard MVP

Не достаточно вывести KPI cards.

Готовый результат должен включать:

- блок “Что требует внимания”;
- drill-down или переход к списку сущностей по ключевым метрикам;
- empty state с понятными next steps;
- mobile-friendly layout;
- dashboard отвечает “что происходит и что сделать сейчас?”.

### B2 — Quick Replies and Templates

Не достаточно CRUD-страницы шаблонов.

Готовый результат должен включать:

- быстрый поиск шаблона в inbox composer;
- вставку текста в черновик;
- категории;
- связь с AI suggestion UX;
- возможность использовать шаблоны в niche onboarding позже.

### B3 — WhatsApp Integration Foundation

Не достаточно webhook placeholder.

Готовый результат должен включать:

- provider interface contract;
- mock/disabled/provider states;
- inbound/outbound logs;
- channel health status;
- retry/error state;
- понятный setup UX без обязательного paid provider.

### B6 — Attachments MVP

Не достаточно upload endpoint.

Готовый результат должен включать:

- отображение attachments в inbox;
- отображение attachments в CRM drawer/timeline;
- private download с object-level permissions;
- file validation;
- подготовку audit для чувствительных файлов.

### C2 — Task Management Upgrade

Не достаточно расширить модель Task.

Готовый результат должен включать:

- task drawer;
- быстрые действия из lead/deal/client/inbox;
- отображение задач в CRM drawer;
- overdue в dashboard/team analytics;
- comments/watchers/reopen/snooze в UX.

### C3/C4 — Automation Builder

Не достаточно сохранить trigger-condition-action JSON.

Готовый результат должен включать:

- simple templates-first UX;
- manual builder только после simple mode;
- validation перед сохранением;
- test run/preview;
- run logs;
- permissions на управление автоматизациями.

### C6 — Import and Export Foundation

Не достаточно импортировать CSV.

Готовый результат должен включать:

- mapping preview;
- duplicate preview;
- import history;
- rollback/archive strategy или явно описанное ограничение;
- export permissions;
- audit log на export.

### D1 — Forms and Lead Capture

Не достаточно создать публичный form submit.

Готовый результат должен включать:

- UTM/source capture;
- duplicate detection;
- auto-assignment или понятный default owner;
- automation trigger;
- activity event;
- простой embed/setup UX.

### D2 — Tags and Smart Segments

Не достаточно CRUD tags.

Готовый результат должен включать:

- saved filters;
- segment counts;
- smart views;
- использование сегментов в clients page;
- подготовку к automation/outreach.

### D3 — Public API Tokens and Webhooks

Не достаточно выдать token.

Готовый результат должен включать:

- scopes;
- rate limiting;
- revoke/rotate;
- delivery logs;
- retries;
- idempotency;
- audit.

### D4 — Notification Center Upgrade

Не достаточно списка уведомлений.

Готовый результат должен включать:

- read/unread;
- priority/category;
- action buttons;
- deep links;
- unread count;
- mobile dropdown;
- mark all read.

### D6 — Onboarding Templates by Niche

Не достаточно создать несколько demo-сущностей.

Готовый результат должен включать:

- setup checklist;
- niche-specific pipeline/services/quick replies/automation templates;
- first lead/first appointment flow;
- useful demo data;
- понятный прогресс запуска бизнеса.

### D7 — Mobile-First Polish Pass

D7 не должен быть первой mobile-адаптацией.

Готовый результат должен включать:

- final QA mobile UX;
- исправление накопленных проблем;
- проверку всех core flows на телефоне;
- отсутствие горизонтального скролла;
- крупные touch targets;
- корректные drawer/modal sizes.

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
- granular RBAC/ABAC permissions;
- departments/teams access scopes;
- soft-delete/archive protection for critical CRM entities;
- manager accountability layer for missed chats/leads;
- import/export;
- forms/lead capture;
- public API tokens/webhooks;
- onboarding templates.

Важно: дальнейшие prompts должны быть delta-oriented: дорабатывать существующие слои, а не переписывать их заново.

---

## Access Control Product Principle

Zani должен поддерживать команды от 1 человека до 100+ сотрудников, но не превращаться в перегруженный Bitrix24.

Подход:

- простые preset roles по умолчанию;
- advanced permissions только при необходимости;
- backend-first enforcement: UI скрывает кнопки, но API всегда проверяет права;
- запрет опасных действий по умолчанию;
- soft-delete/archive вместо физического удаления critical CRM data;
- audit trail для всех действий, которые могут скрыть ошибку сотрудника;
- scopes по владельцу, команде, отделу и всему бизнесу.

Конкурентный ориентир:

- amoCRM сильна простотой: права на сделки/контакты/задачи и области “свои / группа / все”;
- Bitrix24 сильнее по enterprise-гибкости: роли, отделы, структура компании, доступ к отдельным инструментам и CRM-разделам;
- Zani должен взять простоту amoCRM и структурность Bitrix24, но не показывать владельцу МСБ матрицу из сотен чекбоксов без необходимости.

Ключевая бизнес-механика:

Если сотрудник упустил заявку или не подключился к чату по handoff/SLA, он не должен иметь возможности удалить лид, чат или историю так, будто события не было.

Такие действия должны быть невозможны или оставлять след:

- удаление клиента/лида/сделки/чата;
- смена статуса на lost;
- закрытие чата;
- отключение бота;
- экспорт данных;
- merge клиентов;
- изменение ответственного;
- изменение permissions;
- выдача support access;
- изменение интеграций.

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

Цель: сделать Zani удобным и безопасным для команд 10-100+ человек без потери простоты.

Эта фаза закрывает критичный gap с amoCRM/Bitrix24: гибкое распределение ролей, видимость по отделам, запрет скрытия ошибок менеджеров и понятный owner-control.

Главный принцип:

- сотрудник видит только то, что нужно для его работы;
- руководитель видит контроль, аналитику и риски;
- опасные действия запрещены или логируются;
- роли не должны превращать интерфейс в Bitrix-style настройку на 300 чекбоксов.

---

## PROMPT C1 — RBAC/ABAC Foundation and Team Access

Ты — principal security/backend engineer и CRM product architect.

### Цель

Создать понятную, расширяемую и tenant-safe RBAC/ABAC foundation для сотрудников бизнеса.

Нужно не просто хранить `role`, а разделить:

- identity/user;
- membership in business;
- role;
- department/team;
- permissions;
- access scope;
- object-level ownership.

Модель должна защищать бизнес от сценариев:

- менеджер удалил упущенный лид;
- оператор закрыл чат без ответа;
- сотрудник экспортировал клиентскую базу;
- подчинённый увидел revenue/аналитику владельца;
- менеджер видит чужие сделки без разрешения;
- сотрудник меняет integrations/billing/roles.

### Backend

В текущем проекте уже есть:

- `BusinessMember`;
- roles на `User`;
- tenant isolation;
- `AuditLog`;
- `SupportAccessGrant`.

Не ломать их. Расширить текущий слой.

Добавить или расширить модели:

- RolePreset;
- BusinessRole;
- RolePermission;
- Team/Department;
- TeamMember.

RolePreset нужен для системных шаблонов:

- owner;
- admin;
- sales_manager;
- sales_lead;
- operator;
- staff;
- marketer;
- accountant;
- viewer.

BusinessRole — кастомная роль внутри конкретного бизнеса.

Permissions должны храниться как resource/action/scope:

Resources:

- clients;
- leads;
- deals;
- tasks;
- appointments;
- calendar;
- conversations;
- analytics;
- automations;
- services;
- resources;
- working_hours;
- settings;
- billing;
- ai_assistant;
- bots;
- integrations;
- exports;
- audit_logs;
- team;
- support_access.

Actions:

- view;
- create;
- update;
- delete;
- archive;
- restore;
- assign;
- export;
- import;
- change_status;
- move_stage;
- merge;
- manage_settings;
- view_sensitive;
- manage_permissions.

Scopes:

- none;
- own;
- assigned;
- team;
- department;
- business.

Добавить service-layer:

- `can(user, business, resource, action, obj=None)`;
- `scope_queryset(user, business, resource, queryset)`;
- `user_scope_for(user, business, resource, action)`;
- `assert_can(...)`;
- `audit_permission_change(...)`.

Object ownership mapping:

- `Lead.responsible_user`;
- `Deal.owner`;
- `Task.assignee`;
- `Appointment.resource` / future staff assignment;
- `BotConversation.assigned_to`;
- `Client` через owner/created_by или через связанные active objects на первом этапе.

На первом этапе можно хранить часть permissions в JSON, но должен быть clear service-layer, чтобы потом перейти на нормализованные таблицы без переписывания API.

Обязательные запреты по умолчанию:

- `delete` для clients/leads/deals/conversations запрещён всем кроме owner/admin;
- `export` запрещён всем кроме owner/admin/explicit role;
- `billing` только owner/admin/accountant;
- `analytics` только owner/admin/sales_lead/explicit role;
- `integrations` только owner/admin;
- `permissions/team` только owner/admin.

### API

Добавить endpoints:

- `GET /api/team/members/`;
- `POST /api/team/members/`;
- `PATCH /api/team/members/{id}/`;
- `GET /api/team/roles/`;
- `POST /api/team/roles/`;
- `PATCH /api/team/roles/{id}/`;
- `GET /api/team/permissions/catalog/`;
- `POST /api/team/roles/{id}/permissions/`;
- `GET /api/team/departments/`;
- `POST /api/team/departments/`.

Endpoint `GET /api/auth/me/` должен возвращать:

- current business membership;
- role;
- scopes;
- effective permissions summary.

### Frontend

Settings → Team & Access:

- список сотрудников;
- роль;
- отдел/команда;
- статус активности;
- invite placeholder;
- quick role selector;
- simple permissions view.

Settings → Roles:

- простые роли;
- кнопка “Настроить детально”;
- grouped permissions:
  - Клиенты;
  - Заявки;
  - Сделки;
  - Чаты;
  - Календарь;
  - Аналитика;
  - Автоматизации;
  - Настройки;
  - Экспорт;
  - Безопасность.

### UI/UX

Simple roles по умолчанию:

- Owner;
- Admin;
- Sales manager;
- Operator;
- Staff;
- Marketer;
- Accountant;
- Viewer.

Advanced permissions спрятать под отдельным раскрытием.

Не показывать пользователю “сырую” техническую матрицу прав в первом экране.

### Acceptance criteria

- Owner может видеть и управлять сотрудниками.
- Owner/Admin может назначать роли.
- Manager не может управлять billing/integrations/team.
- Operator может работать с назначенными чатами, но не видеть analytics/billing.
- Staff видит только назначенные записи/задачи.
- Backend API запрещает действия даже если кнопку вызвать вручную.
- Tenant isolation сохранён.
- Permission changes пишутся в audit log.

---

## PROMPT C1.1 — Scoped CRM Querysets and Object-Level Permissions

Ты — senior backend engineer.

### Цель

Применить RBAC/ABAC не только к UI, но и к queryset/action layer ключевых CRM сущностей.

### Backend

Обновить viewsets и service-layer для:

- clients;
- leads;
- deals;
- appointments;
- tasks;
- conversations/inbox;
- analytics;
- automations;
- settings/billing/integrations.

Добавить scoped queryset filtering:

- owner/admin видят весь business;
- sales_lead видит свой team/department;
- sales_manager видит own/assigned;
- operator видит assigned conversations и linked leads;
- staff видит appointments/tasks, связанные с ним;
- viewer только read-only scope.

Действия:

- create;
- update;
- archive;
- assign;
- move_stage;
- change_status;
- merge;
- export.

Каждое действие должно вызывать `assert_can(...)`.

### Frontend

Frontend должен использовать effective permissions из `/api/auth/me/`:

- скрывать недоступные nav items;
- скрывать buttons/actions;
- показывать friendly “Нет доступа” вместо crash;
- не показывать analytics/billing/settings подчинённым без прав.

### Acceptance criteria

- Менеджер не видит чужие сделки при scope `own`.
- Оператор не видит аналитику.
- Staff не видит billing/settings.
- API возвращает 403 при ручном вызове forbidden action.
- Существующие owner/admin flows не ломаются.

---

## PROMPT C1.2 — Soft Delete, Archive and Accountability Guardrails

Ты — senior CRM backend engineer и security product owner.

### Цель

Запретить скрытие ошибок сотрудников через удаление CRM-данных.

### Backend

Добавить soft-delete/archive foundation для critical entities:

- Client;
- Lead;
- Deal;
- BotConversation / Conversation;
- Task;
- Appointment.

Поля или shared mixin:

- `is_archived`;
- `archived_at`;
- `archived_by`;
- `archive_reason`;

Hard delete:

- запрещён обычным сотрудникам;
- доступен только owner/admin;
- желательно только для явно безопасных случаев;
- всегда audit log.

Добавить actions:

- `POST /api/leads/{id}/archive/`;
- `POST /api/leads/{id}/restore/`;
- аналогично для core CRM entities.

Lost flow:

- lead/deal status `lost` требует reason;
- сохранять:
  - `lost_reason`;
  - `lost_by`;
  - `lost_at`;
  - previous status/stage;
  - linked conversation/task context.

Inbox accountability:

- если `handoff_required=True`, закрытие conversation требует reason;
- если клиент ждал ответа и SLA истёк, закрытие/архив пишется как risk event;
- менеджер не может удалить/скрыть conversation history.

### Frontend

В UI:

- заменить “Удалить” на “Архивировать”;
- показать поле причины;
- owner/admin видит архив и может восстановить;
- в карточке клиента timeline показывает archive/lost events.

### Acceptance criteria

- Manager не может hard-delete лид/клиента/чат.
- Lost lead/deal требует reason.
- Archive пишет audit/activity event.
- Owner видит кто и когда архивировал/пометил lost.
- Данные не исчезают из истории.

---

## PROMPT C1.3 — Department Analytics Visibility and Manager Accountability

Ты — senior product analyst и CRM architect.

### Цель

Дать руководителю контроль качества работы команды без перегруза BI.

### Backend

Добавить manager/team performance metrics:

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

Endpoint:

- `GET /api/team/performance/`

Фильтры:

- date range;
- team/department;
- manager;
- source;
- pipeline.

### Frontend

Analytics → Team:

- видит только owner/admin/sales_lead;
- карточки по сотрудникам;
- warning list:
  - “лиды без ответа”;
  - “handoff просрочен”;
  - “lost без причины”;
  - “задачи просрочены”.

### Acceptance criteria

- Owner видит performance по всем.
- Sales lead видит только свой team.
- Manager видит только свои показатели, если разрешено.
- Operator/staff не видят team analytics без права.

---

## PROMPT C1.4 — Security UX for Roles Without Bitrix Complexity

Ты — senior product designer и frontend architect.

### Цель

Сделать настройку прав понятной для МСБ.

### Frontend

Создать простую UX-модель:

1. Выбрать сотрудника.
2. Выбрать preset role.
3. Выбрать область видимости:
   - только своё;
   - своя команда;
   - весь бизнес.
4. Advanced настройки открыть только по кнопке.

Advanced groups:

- Продажи;
- Клиенты;
- Чаты;
- Календарь;
- Задачи;
- Аналитика;
- Настройки;
- Экспорт;
- Безопасность.

Каждая группа показывает не technical permissions, а понятные уровни:

- Нет доступа;
- Только просмотр;
- Работа со своими;
- Работа с командой;
- Полное управление.

### Acceptance criteria

- Owner может настроить роль без чтения документации.
- Новый сотрудник получает безопасный default.
- Подчинённый не видит скрытые разделы sidebar/header.
- Forbidden state объясняет, почему нет доступа.

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

## PROMPT C5 — Manager Performance and SLA Deepening

Ты — senior analytics engineer.

### Цель

Углубить контроль команды после C1.3: добавить SLA-разрезы и manager effectiveness без BI-перегруза.

Не дублировать `GET /api/team/performance/`, если он уже реализован в C1.3. Расширить его или добавить совместимый analytics endpoint.

### Backend

Endpoint:

- `GET /api/analytics/team-performance/`
- или расширение `GET /api/team/performance/`

Metrics:

- assigned leads;
- contacted leads;
- lost leads;
- lost by reason;
- closed leads;
- response time;
- overdue handoffs;
- missed chat handoffs;
- overdue tasks;
- completed tasks;
- appointments completed;
- no-show;
- conversion.
- SLA overdue by manager/team.

### Frontend

AnalyticsPage:

- Team tab;
- manager table;
- simple badges;
- SLA warnings;
- missed handoff warnings;
- lost reason breakdown;
- no heavy BI.

### Acceptance criteria

- Owner/admin видит team performance.
- Sales lead видит свой department/team.
- Manager видит свои метрики, если разрешено.
- Operator/staff не видят чужую team performance.
- SLA/missed handoff выводится как action list, а не сложный BI-dashboard.

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

Этот этап должен опираться на C1/C1.1/C1.2, а не создавать вторую систему прав.
Security Center — это не отдельная админка для всех сотрудников, а owner/admin layer для расследования спорных действий, контроля доступа и поддержки.

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
- archive/restore history;
- lost reason history;
- role assignment history;
- integration settings history.
- sensitive action risk classification:
  - low;
  - medium;
  - high;
  - critical.

Critical/high events:

- permission changed;
- employee role changed;
- export started/completed;
- lead/deal/client archived or restored;
- hard-delete attempt;
- conversation closed while handoff/SLA risk exists;
- lead/deal marked lost;
- responsible user changed;
- integration settings changed;
- support access granted/revoked.

Endpoints:

- `/api/security/audit-log/`
- `/api/security/login-history/`
- `/api/security/support-grants/`
- `/api/security/risk-events/`

Filters:

- actor;
- entity type;
- entity id;
- action;
- risk level;
- date range;
- team/department;
- IP/device if available.

### Frontend

Settings → Security:

- audit table;
- login history;
- support access toggle/grant;
- export logs.
- permission changes;
- archived/deleted attempts;
- missed handoff/lost-lead risk events.
- filters by user/action/date/risk level;
- quick link to affected client/lead/deal/conversation;
- “why this matters” short explanation for high-risk events.

Visibility:

- owner/admin see full Security Center;
- custom roles can receive explicit `audit_logs.view`;
- managers/operators/staff do not see security/audit sections by default.

### Acceptance criteria

- Owner sees audit events.
- Support access requires explicit grant if enabled.
- Existing audit writes continue working.
- Owner can see who archived/lost/merged/exported CRM data.
- Security Center does not expose sensitive logs to managers without permission.
- Permission changes and archive/lost actions from C1/C1.2 appear in one audit stream.

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
10. C1 — RBAC/ABAC Foundation and Team Access.
11. C1.1 — Scoped CRM Querysets and Object-Level Permissions.
12. C1.2 — Soft Delete, Archive and Accountability Guardrails.
13. B2 — Quick Replies and Templates.
14. C2 — Task Management Upgrade.
15. C3 — Automation Builder UI Simple Mode.
16. C4 — Automation Builder Advanced Mode.
17. C1.3 — Department Analytics Visibility and Manager Accountability.
18. C1.4 — Security UX for Roles Without Bitrix Complexity.
19. C5 — Manager Performance and SLA.
20. C6 — Import and Export Foundation.
21. D1 — Forms and Lead Capture.
22. D2 — Tags and Smart Segments.
23. D4 — Notification Center Upgrade.
24. D5 — Security and Audit Center.
25. B3 — WhatsApp Integration Foundation.
26. B6 — Attachments MVP.
27. D3 — Public API Tokens and Webhooks.
28. D6 — Onboarding Templates by Niche.
29. D7 — Mobile-First Polish Pass.
30. D8 — Final Competitive QA Pass.

Почему порядок изменён:

- CRM drawers и timeline нужны первыми, потому что почти все будущие функции должны отображаться в единой карточке.
- Inbox UX и AI draft insertion идут раньше WhatsApp, потому что текущий inbox уже есть и быстро даст пользователю ценность.
- WhatsApp отложен после product UX, чтобы не строить интеграцию поверх слабого интерфейса.
- RBAC/ABAC поднят раньше automation/import/export, потому что без прав и accountability нельзя безопасно масштабировать CRM на команды 10-100+ человек.
- Soft-delete/accountability идёт до новых массовых инструментов, чтобы сотрудник не мог скрыть упущенный лид, чат или сделку.
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
