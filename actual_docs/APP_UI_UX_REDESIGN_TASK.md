# ZANI App UI/UX Redesign Task

Дата: 2026-07-16

## 1. Цель

Полностью пересобрать пользовательский интерфейс authenticated `/app` как единый, дорогой, легкий и интуитивно понятный SaaS-продукт поверх существующего backend.

Задача не в косметическом обновлении отдельных экранов. Нужно создать новую цельную UI/UX-систему для CRM-кабинета ZANI, где все страницы выглядят как части одного продукта, используют одинаковый визуальный язык, одинаковую логику рабочих поверхностей и раскрывают уже реализованный backend-функционал через понятные пользовательские workflow.

Backend, API-контракты, permissions, tenant isolation, CRM lifecycle, automations, AI approvals, BusinessEvents, audit/activity и существующие доменные сервисы не переписываются в рамках этой задачи. Редизайн должен использовать текущую серверную функциональность и улучшить ее представление на frontend.

## 2. Проблема

Текущий `/app` уже содержит основные рабочие разделы:

- Dashboard;
- Leads;
- Deals;
- Clients;
- Tasks;
- Calendar;
- Conversations / Inbox;
- Integrations;
- Analytics;
- AI Assistant / AI Agents;
- Automations;
- Outreach;
- Settings.

Но интерфейс воспринимается неоднородно:

- разные страницы выглядят как сделанные в разные этапы продукта;
- часть мощного backend-функционала спрятана в перегруженных drawer/modal flow;
- текущий entity drawer занимает большую часть экрана, но не дает ощущения полноценной карточки клиента, лида, сделки или записи;
- страницы местами перегружены блоками и мелкими действиями;
- не всегда понятно, какой следующий шаг должен сделать пользователь;
- Settings, Automations, Integrations и AI surfaces местами выглядят слишком технически;
- mobile experience страдает от перекрывающих уведомлений и плотной компоновки;
- пользователь видит функционал, но не всегда ощущает дорогой, цельный и спокойный SaaS.

## 3. Нецели

В рамках этой задачи не нужно:

- переписывать backend;
- менять CRM domain services без отдельного основания;
- менять permissions/tenant isolation;
- создавать новые дублирующие API;
- переносить бизнес-логику в React-компоненты;
- делать лендинг или публичные страницы;
- превращать ZANI в ERP, developer console или Bitrix-style admin maze;
- добавлять декоративные marketing-блоки внутри authenticated app;
- маскировать отсутствующие данные mock-значениями.

## 4. Продуктовый Принцип

ZANI `/app` должен ощущаться как premium SMB CRM cockpit:

- легкий;
- чистый;
- быстрый;
- просторный;
- рабочий;
- role-aware;
- action-oriented;
- source-grounded для AI;
- понятный владельцу, менеджеру и оператору без обучения.

Пользователь должен быстро понять:

- что требует внимания сегодня;
- с кем нужно связаться;
- какие заявки горячие;
- какие сделки застряли;
- какие задачи просрочены;
- какие записи нужно подтвердить;
- где клиентская история;
- что предлагает AI и на каких источниках это основано;
- какое действие нужно выполнить следующим.

## 5. Ключевая Архитектура UI

### 5.1 App Shell 2.0

Создать новый единый shell для authenticated `/app`.

Shell включает:

- sidebar;
- top header;
- global search / command search;
- notifications;
- business/user switch context where applicable;
- mobile bottom navigation;
- mobile drawer navigation;
- consistent page container;
- consistent loading/error/forbidden shell states.

Требования:

- sidebar содержит только ежедневные бизнес-разделы;
- редкие системные и технические действия не доминируют в основной навигации;
- header не должен быть перегружен;
- search должен быть единым для CRM-сущностей;
- уведомления не должны перекрывать основной workflow, особенно на mobile;
- mobile nav должен помогать быстро перейти к ежедневным задачам: Dashboard, Leads, Clients, Conversations, More.

### 5.2 Workbench Layout

Все основные рабочие страницы должны строиться на общем `WorkbenchLayout`.

Единая структура:

```text
AppShell
  PageHeader
    title
    short operational subtitle
    primary action
    secondary actions
  PageMetrics / compact status row
  ViewTabs / saved views
  Toolbar
    search
    filters
    columns/view controls
    import/export when relevant
  MainWorkspace
  ContextPanel / Inspector when relevant
```

Workbench должен поддерживать разные типы рабочих поверхностей:

- table/list workspace;
- kanban/pipeline workspace;
- inbox workspace;
- calendar workspace;
- settings/admin workspace;
- analytics workspace.

Каждая страница может иметь собственный контент, но ритм интерфейса должен быть единым.

### 5.3 Entity Experience

Текущий `CrmEntityDrawer` нужно заменить новой системой entity experience.

Новая система должна иметь три уровня:

1. `Quick Inspector`
   - компактная правая панель внутри workbench;
   - ширина ориентировочно 360-420px на desktop;
   - показывает краткий контекст выбранной сущности;
   - не перекрывает всю рабочую область;
   - подходит для быстрого решения.

2. `Full Entity Workspace`
   - полноценная карточка клиента, лида, сделки, записи или задачи;
   - открывается как отдельный рабочий экран или full-height panel;
   - подходит для глубокого просмотра и работы;
   - имеет собственный URL where appropriate: `/app/clients/:id`, `/app/leads/:id`, `/app/deals/:id`.

3. `Action Modal`
   - используется только для короткого конкретного действия;
   - примеры: закрыть как проиграно, назначить ответственного, создать задачу, перенести запись, подтвердить AI-действие;
   - не используется как контейнер для полноценного просмотра сущности.

### 5.4 Full Entity Workspace Structure

Карточка клиента, лида, сделки и записи должна быть полноценным рабочим пространством.

Рекомендуемая структура:

```text
Entity Header
  name/title
  status
  source/channel
  responsible/owner
  next action
  primary action

Entity Summary Strip
  contact info
  value/status/stage
  last activity
  SLA/overdue/risk
  AI/source hint where applicable

Entity Body
  left/main:
    timeline
    notes
    messages
    activity
    relevant history
  right/context:
    quick actions
    related objects
    tasks
    appointments
    deals/leads/clients
    source/consent/attribution

Tabs
  Overview
  Timeline
  Messages
  Tasks
  Appointments
  Deals
  Leads
  Files
  Audit/History where role-appropriate
```

Важное требование: карточка клиента должна объединять все связанное:

- информация о клиенте;
- заявки клиента;
- сделки;
- задачи;
- записи;
- диалоги из inbox;
- последние сообщения;
- timeline событий;
- source attribution;
- consent/outreach status;
- AI recommendations with sources.

Пользователь не должен прыгать между 5 страницами, чтобы понять историю клиента.

## 6. Визуальный Стиль

### 6.1 Общее Ощущение

Интерфейс должен быть:

- светлым;
- спокойным;
- просторным;
- точным;
- premium;
- не перегруженным;
- без декоративной витринности.

Не нужно забивать каждый пиксель блоками. Пространство должно помогать читать, принимать решения и выполнять действия.

### 6.2 Цвета

Использовать текущую approved direction:

- background: `#F8FAFC`;
- surface: `#FFFFFF`;
- muted surface: `#F1F5F9`;
- border: `#E2E8F0`;
- text primary: `#0F172A`;
- text secondary: `#475569`;
- primary action blue: `#2563EB`;
- AI accent violet: `#7C3AED`;
- success: green;
- warning: amber/orange;
- danger: red;
- neutral: slate.

Правила:

- blue только для обычных CRM-действий и selected state;
- violet только для настоящих AI-функций;
- green/orange/red только для состояния;
- не использовать gradient/glow как универсальный декор;
- не делать страницы доминирующе фиолетово-синими.

### 6.3 Форма Компонентов

Целевые параметры:

- page surface radius: 12px;
- control radius: 10px;
- button radius: 10px;
- modal radius: 16px;
- subtle border: `1px solid #E2E8F0`;
- soft shadow только для elevated surfaces;
- минимум nested cards;
- внутренние карточки только для повторяемых объектов, modal sections или entity preview.

### 6.4 Плотность

Нужен баланс:

- не пусто;
- не забито;
- достаточно воздуха между зонами;
- таблицы и списки сканируемые;
- actions не спорят друг с другом;
- метрики компактные и полезные;
- длинные формы разбиты на смысловые секции;
- mobile не должен быть desktop-copy.

## 7. Страницы И Требования

### 7.1 Dashboard

Цель: старт рабочего дня.

Dashboard должен отвечать:

- что важно сегодня;
- что требует реакции;
- какие риски;
- какие новые заявки;
- какие задачи просрочены;
- какие записи ближайшие;
- какие интеграции требуют внимания;
- что рекомендует AI и на каких источниках.

Не должен быть набором декоративных KPI.

### 7.2 Leads

Цель: обработка входящего потока.

Структура:

- saved views: All, New, Hot, No response, Attention, Mine;
- compact metrics;
- search/filter toolbar;
- table/list with status, source, responsible, next action, last activity;
- selected lead inspector;
- full lead workspace.

Ключевые workflow:

- принять в работу;
- связаться;
- назначить ответственного;
- создать задачу;
- создать/связать клиента;
- создать сделку;
- создать запись;
- закрыть/потерять с причиной;
- открыть историю и источники.

### 7.3 Deals

Цель: управление pipeline и выручкой.

Структура:

- kanban pipeline as default;
- list view as alternative;
- filters/saved views;
- visible stage totals;
- stale/risk/no-next-action markers;
- selected deal inspector;
- full deal workspace.

Ключевые workflow:

- переместить стадию;
- отметить won/lost with reason;
- изменить сумму;
- назначить owner;
- создать next task;
- открыть client/lead context;
- увидеть timeline, value history, stage history.

### 7.4 Clients

Цель: единый центр отношений с клиентом.

Структура:

- client list/table;
- filters by source, status, segment, no response, VIP;
- selected client inspector;
- full client workspace.

Full client workspace должен быть одним из самых сильных экранов продукта.

Должно быть видно:

- контакты;
- статус;
- responsible;
- source attribution;
- consent/outreach status;
- все лиды;
- все сделки;
- все задачи;
- все записи;
- все диалоги;
- timeline;
- notes;
- files;
- AI/CRM next step.

### 7.5 Conversations / Inbox

Цель: обработка сообщений и превращение диалогов в CRM-действия.

Структура:

- conversation queue;
- chat area;
- right context panel;
- quick replies;
- AI draft/qualification when available;
- CRM links/actions.

Ключевые workflow:

- ответить клиенту;
- назначить диалог;
- handoff / stop bot;
- создать/связать клиента;
- создать/связать лид;
- создать/связать сделку;
- создать задачу;
- создать запись where supported;
- выполнить AI qualification;
- применить AI suggestion only with proper confirmation policy.

### 7.6 Tasks

Цель: ежедневное исполнение.

Структура:

- views: My, Today, Overdue, Team, Watching, Done;
- workload by assignee;
- table/list;
- task inspector;
- full task view if needed.

Ключевые workflow:

- взять в работу;
- назначить;
- завершить;
- отменить с причиной;
- snooze;
- watch;
- comment;
- перейти к связанному client/lead/deal/appointment/conversation.

### 7.7 Calendar

Цель: управление расписанием и записями.

Структура:

- day/week/month/list;
- resource/service filters;
- appointment inspector;
- working hours context;
- available slots;
- linked tasks.

Ключевые workflow:

- создать запись;
- перенести;
- подтвердить;
- отменить с причиной;
- отметить no-show с причиной;
- завершить;
- создать follow-up task;
- открыть client/lead/deal context.

### 7.8 Integrations

Цель: понятный статус подключений без ощущения developer console.

Структура:

- provider cards;
- connection health;
- last sync;
- failed sync recovery;
- safe setup flow;
- advanced technical details behind gated advanced/admin controls.

Ключевые workflow:

- подключить канал;
- проверить статус;
- запросить помощь;
- retry failed sync;
- увидеть какие CRM events пришли;
- не показывать токены/секреты в ежедневном UI.

### 7.9 Analytics

Цель: управленческие ответы, не vanity dashboard.

Должно отвечать:

- откуда приходят лиды;
- где конверсия;
- какие сделки застряли;
- кто перегружен;
- где SLA/response проблемы;
- какие каналы/интеграции дают события;
- какие рекомендации AI source-grounded.

### 7.10 AI Assistant / AI Analyst

Цель: контролируемый помощник, не декоративный чат.

Требования:

- source chips for recommendations;
- explicit no-data state;
- provider-not-ready state;
- forbidden/no-access state;
- confirmation for critical actions;
- no local deterministic hints branded as AI;
- AI actions respect user permissions.

### 7.11 Automations

Цель: понятные бизнес-автоматизации, не технический rule engine.

Структура:

- recommended templates;
- active rules;
- recent runs;
- failed runs;
- retry/cancel actions;
- run details readable for merchant;
- technical payload hidden or moved to advanced/admin.

### 7.12 Outreach

Цель: управляемые кампании и follow-up.

Требования:

- campaign status;
- recipients progress;
- retryable failures;
- cancel campaign with confirmation;
- consent status visibility;
- source-grounded campaign events.

### 7.13 Settings

Цель: настройки бизнеса без ощущения тяжелой админки.

Разделить:

- Business profile;
- Team and roles;
- Security;
- Notifications;
- Quick replies;
- Appointment messages;
- Billing/usage;
- Custom fields;
- Advanced/admin.

Operational tools не должны жить внутри Settings, если у них есть отдельные рабочие страницы.

## 8. Component System

Нужно создать или унифицировать:

- `AppShell`;
- `WorkbenchLayout`;
- `PageHeader`;
- `ViewTabs`;
- `Toolbar`;
- `FilterPanel`;
- `SavedViews`;
- `MetricStrip`;
- `DataSurface`;
- `EntityList`;
- `EntityTable`;
- `PipelineBoard`;
- `InboxLayout`;
- `CalendarLayout`;
- `QuickInspector`;
- `EntityWorkspace`;
- `EntityHeader`;
- `EntitySummary`;
- `EntityTimeline`;
- `RelatedObjectsPanel`;
- `ActionModal`;
- `ConfirmAction`;
- `EmptyState`;
- `ErrorState`;
- `ForbiddenState`;
- `NoDataState`;
- `SourceChips`;
- `StatusBadge`;
- `PriorityBadge`;
- `AISuggestionCard`.

Компоненты должны использовать существующие API-клиенты и типы. Raw API calls в React-компонентах запрещены.

## 9. UX States

Каждая страница и ключевой компонент должны иметь:

- loading;
- empty;
- filtered empty;
- error;
- forbidden;
- success;
- pending action;
- disabled action;
- retry;
- no data;
- provider unavailable where relevant;
- permission denied where relevant.

Empty state должен содержать реальный следующий шаг, если действие доступно пользователю.

## 10. Mobile Requirements

Mobile не должен быть уменьшенной desktop-версией.

Требования:

- bottom navigation for primary daily routes;
- compact top bar;
- no blocking toast over main workflow;
- entity workspace opens as full-screen mobile surface;
- filters open as bottom sheet;
- tables turn into scannable cards;
- primary action stays reachable;
- long localized text does not overflow;
- no horizontal scroll;
- touch targets are comfortable.

## 11. Accessibility And Interaction

Требования:

- keyboard navigation for tables, tabs, modals, drawers/workspaces;
- visible focus states;
- semantic headings;
- aria labels for icon-only actions;
- Escape closes overlays;
- destructive actions require confirmation;
- pending states block duplicate submit;
- errors remain visible near action context;
- text contrast meets usable SaaS standards.

## 12. Implementation Strategy

### Phase 0: Discovery And Contracts

Deliverables:

- inventory of all `/app` routes;
- backend capability to frontend coverage map;
- current component inventory;
- final app information architecture;
- final visual direction;
- final entity workspace model.

Acceptance:

- every current backend-backed user workflow has a mapped UI location;
- every current page has a target layout pattern;
- no backend rewrite is required.

### Phase 1: Design System Foundation

Deliverables:

- AppShell 2.0;
- WorkbenchLayout;
- component tokens;
- shared toolbar/tabs/filter primitives;
- shared status/empty/error/no-data states;
- responsive layout rules.

Acceptance:

- new shell renders desktop/mobile;
- no public landing changes;
- authenticated app keeps role-aware navigation.

### Phase 2: Entity Experience

Deliverables:

- QuickInspector;
- Full Entity Workspace shell;
- client workspace;
- lead workspace;
- deal workspace;
- appointment/task workspace where needed;
- action modal pattern.

Acceptance:

- client card exposes conversations, leads, deals, tasks, appointments, timeline and source context;
- lead/deal cards expose lifecycle actions and related context;
- old half-screen drawer is replaced or reduced to transitional use only.

### Phase 3: Core CRM Workbenches

Deliverables:

- Leads Workbench;
- Clients Workbench;
- Deals Pipeline Workbench;
- Tasks Workbench.

Acceptance:

- pages share one layout rhythm;
- selected object context is visible without disruptive overlay;
- core lifecycle actions remain connected to existing backend services;
- permission denial and no-data states are explicit.

### Phase 4: Daily Operations

Deliverables:

- Conversations Inbox Workbench;
- Calendar Workbench;
- Dashboard daily cockpit.

Acceptance:

- conversation to CRM actions are clear;
- calendar appointment lifecycle remains service-backed;
- dashboard is action-oriented, not decorative.

### Phase 5: Control Surfaces

Deliverables:

- Integrations;
- Analytics;
- AI Assistant / AI Analyst;
- Automations;
- Outreach;
- Settings.

Acceptance:

- technical complexity is hidden from daily merchant UI;
- AI surfaces show source/no-data/provider/permission states;
- automation run details are merchant-readable;
- settings are structured and not overloaded.

### Phase 6: QA And Cutover

Deliverables:

- desktop visual QA;
- mobile visual QA;
- role smoke for owner/manager/operator;
- frontend build;
- focused Playwright coverage for main routes;
- updated docs.

Acceptance:

- no horizontal overflow;
- no text overlap;
- no old mixed visual pattern in primary `/app` pages;
- existing backend flow tests remain valid;
- app can replace old shell safely.

## 13. Verification

Required checks after implementation:

```bash
cd frontend
npm run build
npx playwright test --project=desktop-chromium -g "business owner core routes render without 404"
npx playwright test --project=mobile-chromium -g "mobile (owner|manager) smoke"
```

For broader confidence:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.core.tests_business_flows_e2e -v 2
```

If backend contracts are not changed, backend tests are mostly regression confidence, not implementation target.

## 14. Acceptance Criteria

The redesign is complete only when:

- all authenticated `/app` primary pages use the new shell or approved transitional wrapper;
- all primary CRM pages follow a shared workbench pattern;
- entity experience is redesigned and no longer relies on a cramped half-screen drawer as the main deep-view pattern;
- client workspace unifies client data, messages, leads, deals, tasks, appointments and timeline;
- lead/deal/task/appointment workflows remain connected to existing backend services;
- AI surfaces show source/no-data/provider-unavailable/forbidden states correctly;
- integrations do not expose provider secrets in daily UI;
- automations are understandable to a merchant;
- settings are structured and not an overloaded admin wall;
- mobile has no blocking toast over core workflows;
- no horizontal overflow or text overlap in desktop/mobile visual QA;
- loading/error/empty/forbidden states exist for each primary page;
- frontend build passes;
- relevant Playwright smoke passes;
- documentation is updated.

## 15. Risks

- Redesign may accidentally hide backend functionality that currently exists.
- Replacing drawer patterns can break deep-link behavior if URLs are not designed early.
- Over-simplifying integrations/automations may hide needed admin controls; advanced gated areas are required.
- Mobile layouts can become too shallow if entity workspace is not designed as a full-screen flow.
- AI can be visually overused; AI styling must be reserved for source-grounded AI output.

## 16. Design References To Emulate

Use these as product-pattern references, not for visual copying:

- HubSpot Sales Workspace: guided sales workspace, saved views, deal/list operations.
- Pipedrive Pipeline: pipeline-first deal management.
- Intercom Inbox: three-panel conversation workspace.
- Notion database views: filters, views, columns, density.
- Linear: keyboard-first workflow, clean density, command/search behavior.

## 17. Final Direction

Build `ZANI App 2.0` as a premium CRM workbench:

- one app;
- one shell;
- one visual system;
- one entity experience;
- one action model;
- full reuse of current backend;
- no decorative authenticated pages;
- no heavy admin maze;
- no mock-only product feel.

The result should feel like a high-quality SaaS product where every screen is calm, clear, fast and useful.

## 18. Implementation Checkpoints

### 2026-07-16 App 2.0 Entity Workspace Start

Completed first bounded implementation slice:

- added URL-addressable client workspace route: `/app/clients/:id`;
- client workspace uses existing CRM card contract for overview, tags, timeline and available action metadata;
- client workspace uses existing related list APIs filtered by `client_ids` for leads, deals, appointments, tasks and inbox conversations;
- `/app/clients` row selection now opens the full client workspace for the default overview flow;
- drawer remains available as a transitional quick-inspector/fallback pattern for non-overview or legacy CRM openings.

Verification:

- `cd frontend && npm run build`: passed.

Remaining next slice:

- add workspace action bar mutations for allowed client actions;
- add full lead and deal workspaces on the same route-based pattern;
- replace legacy query-param drawer openings where full workspace is the intended deep-work surface.

### 2026-07-16 Client Workspace Actions Slice

Completed second bounded implementation slice:

- added client workspace edit modal using the existing `ClientForm`;
- added client workspace tag creation/linking flow using existing tag/tagged-object APIs;
- added destructive archive flow with required reason confirmation and undo restore;
- moved client workspace mutation logic into `useClientWorkspaceActions` to keep the route page focused on data loading and layout.

Verification:

- `cd frontend && npm run build`: passed.

Remaining next slice:

- turn CRM card `available_action_details` into a full shared action bar model for client/lead/deal;
- start route-based lead workspace or deal workspace using the same workspace foundation;
- run desktop/mobile visual QA once at least client + one sales entity workspace exist.

### 2026-07-16 Lead Workspace Route Slice

Completed third bounded implementation slice:

- added URL-addressable lead workspace route: `/app/leads/:id`;
- lead workspace uses the existing CRM card contract for lead overview, client context, timeline and available action metadata;
- lead workspace uses existing related list APIs filtered by `lead_ids` for deals, appointments, tasks and inbox conversations;
- `/app/leads` row selection, dashboard lead links, global search and command palette now open the full lead workspace by default;
- legacy `?lead=` drawer behavior remains available as a transitional fallback for old deep links.

Verification:

- `cd frontend && npm run build`: passed.

Remaining next slice:

- convert lead workspace actions from metadata display into executable workspace actions where the backend action is already available;
- add route-based deal workspace using the same entity workspace pattern;
- run desktop/mobile visual QA after client, lead and deal workspaces are all reachable.

### 2026-07-16 Deal Workspace Route Slice

Completed fourth bounded implementation slice:

- added URL-addressable deal workspace route: `/app/deals/:id`;
- deal workspace uses the existing CRM card contract for deal overview, client context, linked lead, appointments, timeline and available action metadata;
- deal workspace uses existing related list APIs filtered by `deal_ids` for tasks and inbox conversations;
- `/app/deals` kanban card opening, client workspace deal links, global search deal links and lead drawer deal links now open the full deal workspace by default;
- legacy `?deal=` drawer behavior remains available as a transitional fallback for old deep links and quick-card openings.

Verification:

- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.

Remaining next slice:

- convert lead/deal workspace action metadata into executable action bars with guarded confirmations;
- visually align client, lead and deal workspaces to the warm premium token direction;
- run desktop/mobile visual QA for the full entity workspace trio.

### 2026-07-16 Shared Entity Workspace Shell Slice

Completed fifth bounded implementation slice:

- added shared `EntityWorkspace` primitives for the full entity workspace shell;
- client, lead and deal workspaces now use the same root, header, avatar, metric strip, two-column body, side context and main workspace surfaces;
- visually aligned the entity workspace trio toward the warm premium token direction with shared background, borders, typography rhythm and card surfaces;
- preserved the existing backend/API contracts, query keys, related entity loading and transitional drawer fallback behavior.

Verification:

- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.

Remaining next slice:

- convert lead/deal workspace action metadata into executable action bars with guarded confirmations;
- run desktop/mobile visual QA for the full entity workspace trio;
- continue the same shared shell approach for task, appointment and conversation deep-work surfaces.
