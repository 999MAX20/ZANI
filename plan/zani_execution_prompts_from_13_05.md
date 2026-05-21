# Zani Execution Prompts — Generated From `teh plan 13.05.md`

Источник: `/Users/maksim/Desktop/Zani/plan/teh plan 13.05.md`

Дата создания: 14.05.2026

Назначение: рабочий файл для поэтапной реализации. Этот документ не заменяет основной техплан, а превращает его в короткие execution-prompts, которые проще выполнять последовательно.

Текущий прогресс:

- `01 — A1 Unified CRM Entity Drawer`: готово, повторно проверено 14.05.2026.
- `02 — A2 Activity Timeline Unification`: готово по README, включено в текущую кодовую базу.
- `03 — B1 Inbox UX Polish`: готово, проверено 14.05.2026.
- `04 — B5 AI Reply Suggestions MVP`: готово, проверено 14.05.2026.
- `05 — B4 Conversation to CRM Linking`: готово, проверено 14.05.2026.
- `06 — A3 Duplicate Detection Foundation`: готово по README, включено в текущую кодовую базу.
- `07 — A4 Custom Fields Foundation`: готово по README, включено в текущую кодовую базу.
- `08 — A5 Pipeline and Stage Engine Upgrade`: готово по README, включено в текущую кодовую базу.
- `09 — A6 Owner Analytics Dashboard MVP`: готово по README, включено в текущую кодовую базу.
- `10 — C1 RBAC/ABAC Foundation and Team Access`: готово, проверено 14.05.2026.
- `11 — C1.1 Scoped CRM Querysets and Object-Level Permissions`: готово, проверено 14.05.2026.
- `12 — C1.2 Soft Delete, Archive and Accountability Guardrails`: готово, проверено 14.05.2026.
- `13 — B2 Quick Replies and Templates`: готово, проверено 15.05.2026.
- `14 — C2 Task Management Upgrade`: готово, проверено 15.05.2026.
- `15 — C3 Automation Builder UI Simple Mode`: готово, проверено 15.05.2026.
- `16 — C4 Automation Builder Advanced Mode`: готово, проверено 15.05.2026.
- `17 — C1.3 Department Analytics Visibility and Manager Accountability`: готово, проверено 19.05.2026.
- `18 — C1.4 Security UX for Roles Without Bitrix Complexity`: готово, проверено 19.05.2026.
- `19 — C5 Manager Performance and SLA Deepening`: готово, проверено 19.05.2026.
- `20 — C6 Import and Export Foundation`: готово, проверено 19.05.2026.
- `21 — D1 Forms and Lead Capture`: готово, проверено 19.05.2026.
- `22 — D2 Tags and Smart Segments`: готово, проверено 19.05.2026.
- `23 — D4 Notification Center Upgrade`: готово, проверено 19.05.2026.
- `24 — D5 Security and Audit Center`: готово, проверено 19.05.2026.
- `25 — B3 WhatsApp Integration Foundation`: готово, проверено 19.05.2026.
- `26 — B6 Attachments MVP`: готово, проверено 20.05.2026.

Правило работы:

1. Выполнять только один prompt за раз.
2. Перед стартом прочитать соответствующий раздел в `teh plan 13.05.md`.
3. Не расширять scope без необходимости.
4. После реализации выполнить проверки.
5. Если проверки упали, остановиться и исправить текущий prompt.
6. Не начинать следующий prompt, пока текущий не зелёный.

---

## Global Definition of Done

Каждый prompt считается завершённым только если:

- backend/API реализованы или корректно расширены;
- frontend-flow реально работает;
- tenant isolation не сломан;
- permissions проверяются на backend;
- есть loading/empty/error/forbidden states там, где это применимо;
- mobile viewport проверен для frontend-изменений;
- README/docs обновлены;
- тесты и build проходят;
- known gaps явно описаны, если prompt допускает foundation/MVP.

Обязательные проверки:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

Если нужны миграции:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py migrate
```

Frontend smoke:

- desktop;
- mobile;
- empty state;
- loading state;
- error state;
- forbidden/no-permission state;
- primary action за 1-3 клика.

---

# Execution Queue

## 01 — A1 Unified CRM Entity Drawer

### Goal

Сделать единый CRM drawer/card для Client, Lead, Deal, Appointment, чтобы пользователь открывал сущности без ухода со страницы.

### Must Build

- backend `crm-card` endpoints или расширенные serializers;
- tenant-filtered related data;
- reusable frontend drawer components;
- tabs: Overview, Timeline, Tasks, Messages, Notes;
- quick actions по типу сущности;
- интеграция в Clients, Leads, Deals, Appointments, Calendar;
- mobile drawer почти на весь экран.

### Do Not

- не создавать новые модели без необходимости;
- не делать отдельные тяжёлые full pages вместо drawer;
- не ломать текущие страницы.

### Acceptance

- карточка открывается из ключевых списков/kanban/calendar;
- видны связанные задачи, записи, сообщения, timeline;
- нет full reload;
- mobile usable.

---

## 02 — A2 Activity Timeline Unification

### Goal

Сделать ActivityEvent центральной историей клиента/лида/сделки.

### Must Build

- event hooks для client/lead/deal/task/appointment/message/note/automation;
- service-layer `create_activity_event`, `activity_for_client`, `activity_for_entity`;
- filters by client/entity/category/event/date;
- timeline in CRM drawer;
- readable event labels.

### Do Not

- не создавать второй timeline layer;
- не показывать технический мусор в UI.

### Acceptance

- создание/изменение ключевых CRM сущностей пишет timeline;
- messages пишут timeline при linked client/entity;
- TimelinePage не ломается;
- tenant isolation сохранён.

---

## 03 — B1 Inbox UX Polish

### Goal

Довести inbox до messenger-grade рабочего центра.

### Must Build

- cleaner desktop 3-column layout;
- mobile inbox flow;
- search and filters: channel, unread, priority, assigned, handoff;
- selected conversation via URL/search param;
- linked client/lead/deal cards;
- readable message grouping;
- clear SLA/handoff/unread indicators;
- composer improvements;
- internal notes if backend needs it;
- empty/loading/error states.

### Do Not

- не переписывать inbox с нуля;
- не делать AI как notice-only, если затрагивается composer.

### Acceptance

- менеджер за 3 секунды понимает кто написал, откуда, срочно ли и что делать;
- unread/filter/assigned flows работают;
- mobile usable.

---

## 04 — B5 AI Reply Suggestions MVP

### Goal

Сделать AI reply полезным в inbox: suggestion появляется как черновик, но не отправляется автоматически.

### Must Build

- endpoint `POST /api/inbox/conversations/{id}/suggest-reply/`;
- использовать recent messages, linked client/lead, AgentProfile, BusinessKnowledgeItem;
- mock response без OpenAI key;
- frontend suggestion panel;
- insert/regenerate;
- no auto-send.

### Do Not

- не ломать existing bot suggest endpoint;
- не отправлять AI-ответ без ручного действия пользователя.

### Acceptance

- AI suggestion можно вставить в composer;
- старый bot endpoint работает;
- empty/error state понятен.

---

## 05 — B4 Conversation to CRM Linking

### Goal

Сделать простую связь диалога с клиентом, лидом и сделкой.

### Must Build

- link conversation to client/lead/deal;
- create client/lead/deal from conversation;
- duplicate check before create;
- context panel with linked cards and actions;
- timeline update.

### Do Not

- не дублировать существующие create/link helpers;
- не создавать сущности без предупреждения о дублях.

### Acceptance

- из диалога можно создать или привязать CRM сущность;
- duplicate warning shown;
- existing actions продолжают работать.

---

## 06 — A3 Duplicate Detection Foundation

### Goal

Предотвратить хаос дублей клиентов/заявок.

### Must Build

- `normalize_phone`, `normalize_email`;
- duplicate services;
- endpoints `clients/check-duplicates`, `leads/check-duplicates`;
- client merge foundation;
- warning in ClientForm/LeadForm;
- audit/activity on merge.

### Do Not

- не искать дубли между разными businesses;
- не блокировать создание слишком агрессивно.

### Acceptance

- phone/email duplicate detection works;
- user sees warning;
- merge переносит связанные сущности;
- action logged.

---

## 07 — A4 Custom Fields Foundation

### Goal

Добавить custom fields без хаоса в БД и без “невидимого backend-only” результата.

### Must Build

- CustomFieldDefinition;
- CustomFieldValue;
- API for definitions/values/bulk-upsert;
- Settings field builder;
- render/edit fields in CRM drawer;
- tenant-safe values;
- базовое использование в фильтрах для clients/leads/deals;
- подготовить integration with pipeline required fields.

### Do Not

- не делать только модели/API без UI;
- не хранить значения в разрозненных JSON по сущностям.

### Acceptance

- business creates field;
- field appears in drawer;
- value saves and reloads;
- tenant isolation works.

---

## 08 — A5 Pipeline and Stage Engine Upgrade

### Goal

Довести pipeline до рабочего уровня amoCRM-like воронки: validation, SLA, win/loss, required fields.

### Must Build

- extend existing PipelineStage/Deal/StageTransition;
- required fields validation;
- allowed roles hook;
- stage transition validation;
- `won_at`, `lost_at`, `lost_reason`, `stage_entered_at`, `next_action_at`;
- `GET /api/pipelines/{id}/board/`;
- templates apply endpoint;
- kanban SLA indicators;
- win/loss modal;
- mobile kanban compact mode;
- deal drawer integration.

### Do Not

- не добавлять поля, которые уже существуют;
- не переписывать DealsPage полностью.

### Acceptance

- нельзя move-stage без required fields;
- win/loss reason saves;
- SLA/overdue visible;
- activity event writes.

---

## 09 — A6 Owner Analytics Dashboard MVP

### Goal

Сделать dashboard как owner cockpit: что происходит и что делать сейчас.

### Must Build

- endpoint `/api/analytics/owner-dashboard/`;
- 5-7 KPI cards;
- “Что требует внимания”;
- latest leads;
- upcoming appointments;
- source breakdown;
- drill-down links to entity lists where possible;
- useful empty state;
- mobile layout.

### Do Not

- не делать BI dashboard с тяжёлыми графиками;
- не добавлять декоративный AI без действия.

### Acceptance

- dashboard грузит реальные метрики;
- owner видит next actions;
- mobile readable.

---

## 10 — C1 RBAC/ABAC Foundation and Team Access

Статус: **готово, проверено 14.05.2026**.

### Goal

Создать понятную tenant-safe модель ролей, команд и permissions для бизнеса.

### Must Build

- RolePreset;
- BusinessRole;
- RolePermission;
- Team/Department;
- TeamMember;
- resource/action/scope permission model;
- service-layer `can`, `scope_queryset`, `assert_can`, `user_scope_for`;
- default role presets;
- default dangerous action restrictions;
- `/api/team/...` endpoints;
- `/api/auth/me/` effective permissions summary;
- Settings → Team & Access;
- Settings → Roles simple mode.

### Do Not

- не ломать BusinessMember/User roles;
- не показывать владельцу техническую матрицу первым экраном;
- не полагаться только на frontend hiding.

### Acceptance

- owner/admin manage team;
- manager cannot manage billing/integrations/team;
- operator/staff limited;
- backend returns 403 on forbidden actions;
- permission changes audit logged.

---

## 11 — C1.1 Scoped CRM Querysets and Object-Level Permissions

Статус: **готово, проверено 14.05.2026**.

### Goal

Применить RBAC/ABAC к queryset/action layer ключевых CRM сущностей.

### Must Build

- scoped queryset filtering for clients/leads/deals/appointments/tasks/conversations/analytics/automations/settings/billing/integrations;
- `assert_can` for create/update/archive/assign/move_stage/change_status/merge/export;
- frontend uses effective permissions;
- nav/actions hidden by permission;
- friendly forbidden states.

### Do Not

- не ограничиваться UI;
- не ломать owner/admin full access.

### Acceptance

- manager with own scope не видит чужие сделки;
- operator не видит analytics;
- staff не видит billing/settings;
- manual forbidden API call gets 403.

---

## 12 — C1.2 Soft Delete, Archive and Accountability Guardrails

Статус: **готово, проверено 14.05.2026**.

### Goal

Запретить скрытие ошибок сотрудников через удаление CRM-данных.

### Must Build

- archive fields/mixin for Client, Lead, Deal, Conversation/BotConversation, Task, Appointment;
- archive/restore actions;
- hard delete only owner/admin and audited;
- lost flow requires reason;
- `lost_reason`, `lost_by`, `lost_at`, previous status/stage;
- close conversation reason when handoff/SLA risk;
- archive/lost events in timeline/audit;
- UI replaces delete with archive and reason modal.

### Do Not

- не позволять manager hard-delete critical CRM entities;
- не удалять conversation history.

### Acceptance

- manager cannot hard-delete;
- lost requires reason;
- owner sees who/when/why;
- data remains in history.

---

## 13 — B2 Quick Replies and Templates

Статус: **готово, проверено 15.05.2026**.

### Goal

Добавить быстрые ответы как реальный инструмент inbox composer.

### Must Build

- QuickReplyTemplate model/API;
- categories/channel/sort/is_active;
- Settings management;
- composer search;
- insert into draft;
- connect with AI suggestion UX where useful.

### Do Not

- не делать только CRUD table;
- не отправлять шаблон автоматически.

### Acceptance

- template can be created;
- manager can search and insert it in composer;
- tenant-filtered.

---

## 14 — C2 Task Management Upgrade

Статус: **готово, проверено 15.05.2026**.

### Goal

Сделать задачи рабочим инструментом команды внутри CRM.

### Must Build

- comments;
- watchers;
- parent_task;
- completed_by;
- actions reopen/snooze/assign/add-comment/add-watcher;
- TasksPage tabs: My, Today, Overdue, Team;
- task drawer;
- task visibility in CRM drawer;
- overdue in dashboard/team analytics;
- quick task creation from inbox/lead/deal/client.

### Do Not

- не дублировать уже существующие Task fields/actions;
- не превращать TasksPage в тяжелый project management.

### Acceptance

- user sees own tasks;
- complete/reopen/snooze works;
- comments work;
- overdue visible;
- linked task appears in CRM card.

---

## 15 — C3 Automation Builder UI Simple Mode

Статус: **готово, проверено 15.05.2026**.

### Goal

Сделать автоматизации доступными через шаблоны, а не через сложный builder первым экраном.

### Must Build

- use existing AutomationRule/Condition/Action;
- automation templates endpoint;
- apply template endpoint;
- AutomationsPage templates view;
- enabled/disabled rules;
- run logs.

### Do Not

- не показывать advanced builder первым экраном;
- не создавать второй automation engine.

### Acceptance

- template can be applied;
- rule appears in list;
- run logs visible.

---

## 16 — C4 Automation Builder Advanced Mode

Статус: **готово, проверено 15.05.2026**.

### Goal

Добавить manual trigger-condition-action builder после simple mode.

### Must Build

- trigger selector;
- condition rows;
- action rows;
- delay action;
- validation before save;
- test run/preview;
- save compatible config.

### Do Not

- не сохранять invalid rules;
- не делать автоматизации без preview/logs.

### Acceptance

- manual rule can be created;
- invalid rule rejected;
- test run shows preview.

---

## 17 — C1.3 Department Analytics Visibility and Manager Accountability

Статус: **готово, проверено 19.05.2026**.

### Goal

Дать руководителю контроль качества команды без BI-перегруза.

### Must Build

- endpoint `/api/team/performance/`;
- metrics: assigned/contacted/lost/lost reasons/overdue handoffs/missed handoffs/response placeholder/appointments/deals/tasks;
- filters date/team/manager/source/pipeline;
- Analytics → Team;
- visibility by owner/admin/sales_lead/permission;
- warning list.

### Do Not

- не показывать team analytics всем;
- не делать тяжелый BI.

### Acceptance

- owner sees all;
- sales lead sees team;
- manager own if allowed;
- operator/staff no access.

---

## 18 — C1.4 Security UX for Roles Without Bitrix Complexity

Статус: **готово, проверено 19.05.2026**.

### Goal

Сделать настройку прав понятной для МСБ.

### Must Build

- employee → preset role → visibility scope → advanced;
- groups: Sales, Clients, Chats, Calendar, Tasks, Analytics, Settings, Export, Security;
- friendly levels: No access, View only, Own, Team, Full;
- hidden advanced by default;
- forbidden explanation.

### Do Not

- не показывать raw technical permission matrix первым экраном.

### Acceptance

- owner configures role without docs;
- new employee safe default;
- subordinate hidden nav/header;
- forbidden state explains why.

---

## 19 — C5 Manager Performance and SLA Deepening

Статус: **готово, проверено 19.05.2026**.

### Goal

Углубить SLA/team performance после C1.3.

### Must Build

- extend `/api/team/performance/` or add compatible analytics endpoint;
- response time;
- overdue handoffs/tasks;
- missed chat handoffs;
- closed/lost/conversion/no-show;
- SLA overdue by manager/team;
- Team tab with warnings and action list.

### Do Not

- не дублировать C1.3 endpoint blindly;
- не делать сложный BI-dashboard.

### Acceptance

- owner/admin see team;
- sales lead sees own department/team;
- manager sees own if allowed;
- operator/staff no чужая analytics.

---

## 20 — C6 Import and Export Foundation

Статус: **готово, проверено 19.05.2026**.

### Goal

Подготовить переезд из Excel/amoCRM/Bitrix24.

### Must Build

- ImportJob model;
- CSV/XLSX upload;
- mapping preview;
- duplicate preview;
- confirm import;
- import history;
- export clients/leads/deals;
- export permission check;
- export audit log;
- rollback/archive strategy or documented limitation.

### Do Not

- не делать import/export без permissions/audit;
- не импортировать silently без preview.

### Acceptance

- CSV clients import works;
- duplicate preview shown;
- export requires permission and logs audit.

---

## 21 — D1 Forms and Lead Capture

Статус: **готово, проверено 19.05.2026**.

### Goal

Создать формы захвата заявок, которые реально включаются в lead flow.

### Must Build

- LeadForm, LeadFormField, LeadFormSubmission;
- public submit endpoint;
- UTM/source capture;
- duplicate check;
- auto-create client/lead;
- auto-assignment/default owner;
- automation trigger;
- activity event;
- Settings/Forms UI and embed code.

### Do Not

- не создавать только public endpoint без setup UX;
- не обходить duplicate detection.

### Acceptance

- public form creates lead;
- UTM/source saved;
- duplicate warning internally;
- submission visible.

---

## 22 — D2 Tags and Smart Segments

### Goal

Сделать теги и сегменты рабочей сегментацией клиентов.

### Must Build

- extend existing Tag/TaggedObject;
- Segment, SegmentFilter;
- saved filters;
- dynamic evaluation service;
- optional cached counts;
- ClientsPage tags/saved segments/quick filters;
- prepare for automation/outreach.

### Do Not

- не создавать второй tagging layer;
- не ограничиваться CRUD tags.

### Acceptance

- segment can be created;
- segment filters clients;
- tags visible in card;
- existing tag API compatible.

---

## 23 — D4 Notification Center Upgrade

### Goal

Сделать уведомления рабочим центром действий.

### Must Build

- extend existing Notification;
- category, action_url, action_label, read_at, priority;
- summary/mark read/mark all/unread count/list filters;
- header dropdown;
- grouped notifications;
- action buttons;
- read/unread state;
- mobile view.

### Do Not

- не создавать parallel notification model;
- не делать уведомления тупым списком без actions.

### Acceptance

- notifications can be read;
- actions deep-link to entity;
- existing reminder notifications continue working.

---

## 24 — D5 Security and Audit Center

### Goal

Дать владельцу security/control center на базе C1/C1.2, не создавая вторую систему прав.

### Must Build

- extend existing AuditLog/SupportAccessGrant;
- login history;
- export history;
- permission change audit;
- support grants;
- archive/restore/lost/role/integration history;
- risk levels;
- endpoints security audit/login/support/risk;
- Settings → Security UI;
- filters by actor/entity/action/risk/date/team;
- owner/admin visibility;
- explicit `audit_logs.view` for custom roles.

### Do Not

- не показывать security logs обычным managers/operators/staff;
- не дублировать audit system.

### Acceptance

- owner sees audit/risk events;
- support access requires grant;
- archive/lost/export/permission changes appear in one stream.

---

## 25 — B3 WhatsApp Integration Foundation

### Goal

Подготовить WhatsApp provider abstraction production-ready без выбора paid provider.

### Must Build

- extend existing provider layer;
- WhatsApp provider interface;
- mock mode;
- inbound webhook placeholder;
- outbound send abstraction;
- IntegrationEventLog;
- BotDetail WhatsApp setup section;
- provider status/webhook URL/mock/disabled states;
- inbound/outbound logs;
- channel health/error/retry state.

### Do Not

- не привязываться к конкретному paid provider;
- не ломать Telegram provider.

### Acceptance

- mock inbound creates conversation/message;
- outbound logs through provider layer;
- dev works without credentials.

---

## 26 — B6 Attachments MVP

### Goal

Добавить вложения к сообщениям и CRM timeline с private access.

### Must Build

- FileAttachment model;
- use `validate_file_upload`;
- `/api/file-attachments/`;
- private download with object permission;
- upload button in inbox;
- attachments in inbox and CRM drawer/timeline;
- preview/download action.

### Do Not

- не делать public file URLs для private CRM data;
- не обходить validation.

### Acceptance

- allowed file uploads;
- forbidden extension rejected;
- merchant cannot see another merchant file.

---

## 27 — D3 Public API Tokens and Webhooks

Status: completed 2026-05-20.

Implemented:

- backend `ApiToken`, `WebhookEndpoint`, `WebhookDeliveryLog`;
- scoped API token create/rotate/revoke;
- unscoped token rejection;
- public clients read API with `clients:read` scope;
- public API throttle scope;
- webhook delivery, mock success/failure, idempotency key, retry;
- audit for token/webhook management;
- admin registrations;
- Settings → Developers frontend section;
- tenant isolation and permission tests.

Checks:

- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.integrations.tests_public_api -v 2` — OK, 8 tests.
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py migrate integrations` — OK.
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run` — OK.
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check` — OK.
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test` — OK, 147 tests.
- `cd frontend && npm run build` — OK.

### Goal

Подготовить интеграционную платформу.

### Must Build

- ApiToken;
- WebhookEndpoint;
- WebhookDeliveryLog;
- scoped tokens;
- rate limiting;
- event delivery;
- retries;
- idempotency keys;
- revoke/rotate;
- audit;
- Settings → Developers.

### Do Not

- не выпускать unscoped tokens;
- не делать webhooks без delivery logs.

### Acceptance

- token can access scoped API;
- webhook delivery logged;
- failed webhook logged/retryable.

---

## 28 — D6 Onboarding Templates by Niche

Status: completed 2026-05-20.

Implemented:

- backend `apps.onboarding`;
- niche templates for dentistry, beauty, sauna, autoservice, education, medical, other;
- template apply endpoint;
- onboarding status/checklist endpoint;
- demo data endpoint for first client/lead/deal/appointment/task flow;
- real services/resources/working hours/quick replies/automation defaults;
- frontend onboarding wizard at `/dashboard/onboarding`;
- sidebar item and dashboard progress CTA;
- permission and tenant isolation tests.

Checks:

- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.onboarding -v 2` — OK, 5 tests.
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run` — OK.
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check` — OK.
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test` — OK, 152 tests.
- `cd frontend && npm run build` — OK.

### Goal

Сделать запуск бизнеса за 5-10 минут.

### Must Build

- niche templates: dentistry, beauty, sauna, autoservice, education, medical, other;
- template includes pipeline/services/working hours/quick replies/automations/dashboard defaults;
- apply endpoint;
- onboarding wizard;
- setup checklist;
- first lead/first appointment flow;
- useful demo data.

### Do Not

- не создавать просто demo data без user guidance.

### Acceptance

- new business applies template;
- CRM becomes usable immediately;
- progress/checklist visible.

---

## 29 — D7 Mobile-First Polish Pass

Status: completed 2026-05-20.

Implemented:

- global horizontal overflow guard;
- mobile-friendly modal sizing/header/close target;
- full-screen mobile CRM drawer;
- fixed mobile search results popup;
- larger bottom mobile nav touch targets;
- safer PageHeader wrapping/action area.

Checks:

- `cd frontend && npm run build` — OK.
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check` — OK.
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test` — OK, 152 tests.

### Goal

Финальный mobile QA/polish для core CRM flows.

### Must Build

- review header/sidebar/mobile nav/dashboard/leads/deals/client drawer/inbox/calendar/tasks/forms;
- primary mobile actions: call, WhatsApp, reply, create appointment, change status, create task;
- fix horizontal scroll;
- large touch targets;
- correct drawer/modal sizing;
- text fits buttons/cards.

### Do Not

- не считать это первой mobile adaptation;
- не оставлять desktop-only flows.

### Acceptance

- no horizontal scroll;
- core actions thumb-friendly;
- modals/drawers not cut;
- text doesn't overflow.

---

## 30 — D8 Final Competitive QA Pass

Status: completed 2026-05-20.

Implemented:

- inspected CRM cards, pipelines, inbox, roles, tasks, automations, analytics, mobile UX, import/export, integrations, security, onboarding;
- created `docs/competitive-regression-report.md`;
- classified areas as Ready/Partial/Gap/Stronger;
- documented critical gaps and next critical tasks;
- documented architecture rules for what not to do.

Checks:

- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check` — OK.
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test` — OK, 152 tests.
- `cd frontend && npm run build` — OK.

### Goal

Проверить Zani против competitive checklist amoCRM/Bitrix24.

### Must Build

- inspect CRM cards, pipelines, inbox, roles, tasks, automations, analytics, mobile UX, import/export, integrations, security, onboarding;
- create `docs/competitive-regression-report.md`;
- classify ready/partial/gaps/stronger-than-competitors/next critical tasks.

### Do Not

- не исправлять огромный scope внутри QA prompt, если нужен отдельный stage;
- не скрывать critical gaps.

### Acceptance

- report created;
- critical flows checked;
- undocumented critical gaps отсутствуют.

---

# How To Continue Work

Когда пользователь говорит “продолжай по execution prompts”:

1. Найти последний выполненный prompt в README/docs/отчёте.
2. Взять следующий номер из этого файла.
3. Перед реализацией открыть соответствующий раздел в `teh plan 13.05.md`.
4. Реализовать только этот prompt.
5. Выполнить проверки.
6. Обновить README/docs.
7. Дать короткий отчёт:
   - что сделано;
   - какие файлы изменены;
   - какие проверки прошли;
   - какой следующий prompt.
