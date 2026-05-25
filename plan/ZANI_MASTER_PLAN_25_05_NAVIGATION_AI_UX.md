# ZANI Master Plan 25.05: Navigation, AI Navigator, Role-Based UX

Дата: 25.05.2026

Источник: `plan/25.05 `

Назначение: рабочий мастер-техплан для упрощения интерфейса ZANI, переработки главной страницы, корректного позиционирования AI и сокращения лишних разделов в merchant CRM.

## 1. Product Direction

ZANI не должен превращаться в CRM с большим количеством страниц, где пользователь сам ищет нужную информацию. Продуктовая модель ZANI:

> ZANI показывает пользователю главное, объясняет ситуацию и ведет к следующему действию.

Главная задача интерфейса:

- владелец за 3-5 секунд понимает состояние бизнеса;
- менеджер видит, что ему нужно сделать сейчас;
- администратор контролирует входящие заявки и порядок в системе;
- AI не болтает, а объясняет факты и помогает принять действие.

ZANI должен ощущаться как business control layer, а не как ERP/Bitrix/amoCRM с десятками разделов.

## 2. Core Principles

### 2.1. Short Surface, Deep Details

На первом уровне показываем только главное. Подробности доступны по клику, через вкладки, drawer, detail pages или advanced sections.

Запрещено:

- переносить 5 старых страниц в одну огромную страницу;
- делать страницы на 8-10 экранов вниз;
- выводить все функции сразу;
- показывать технические настройки мерчанту без необходимости.

Разрешено:

- короткие карточки;
- summary blocks;
- role-based blocks;
- tabs для деталей;
- progressive disclosure;
- advanced settings глубже.

### 2.2. Adaptive UI

Интерфейс должен зависеть от состояния бизнеса:

- нет интеграций -> показываем краткую подсказку и CTA подключения;
- нет продаж -> не показываем тяжелые sales charts;
- нет склада -> не показываем склад как основной раздел;
- нет Kaspi -> не показываем маркетплейсы как рабочую страницу;
- нет сотрудников -> не показываем командные KPI;
- есть данные -> показываем краткие метрики и риски.

### 2.3. No Fake AI Conclusions

AI использует только данные конкретного business tenant:

- leads;
- clients;
- deals;
- tasks;
- appointments;
- conversations;
- messages;
- sales/imported sales;
- team activity;
- connected integrations;
- imported Excel/CSV/Kaspi/1C/MoySklad/Telegram/WhatsApp data.

Правило:

> Нет данных - нет выдуманных выводов.

Если данных недостаточно, AI должен честно объяснять, какие источники нужно подключить.

## 3. Target Merchant Navigation

### 3.1. Final Main Sidebar

Основное меню мерчанта:

1. Главная
2. Лиды
3. Сделки
4. Клиенты
5. Сообщения
6. Задачи
7. Аналитика
8. Подключения
9. Настройки

Допустимое условное отображение:

- Календарь можно показывать как отдельный пункт только для business types, где запись является ключевым сценарием: beauty, medical, dentistry, education, sauna, service booking.
- Если календарь не является ключевым сценарием, записи должны быть доступны внутри задач/главной/настроек.

### 3.2. Mobile Navigation

Mobile-first bottom navigation:

1. Главная
2. Лиды
3. Клиенты
4. Сообщения
5. Еще

В `Еще`:

- Сделки
- Задачи
- Аналитика
- Подключения
- Настройки
- Календарь, если включен для бизнеса.

### 3.3. Remove From Primary Sidebar

Убрать из основного меню:

- AI Assistant / AI Навигатор как отдельный чат-раздел;
- Bots;
- AI Agents;
- Automations;
- Onboarding;
- Pilot readiness;
- Timeline;
- Services;
- Resources;
- Working hours;
- Appointments как отдельный пункт, если есть Calendar;
- technical connector pages;
- empty future modules.

Функционал не удалять. Перенести глубже.

## 4. Page Consolidation Map

### 4.1. Dashboard -> Business Control Center

`/dashboard`

Содержимое:

- состояние бизнеса сегодня;
- заявки;
- продажи/выручка, если есть данные;
- сделки;
- задачи;
- неотвеченные клиенты;
- просроченные действия;
- активность сотрудников;
- важные события;
- AI-подсказка дня;
- блок подключения данных, если информации мало;
- быстрые действия.

Не должно быть:

- длинного BI;
- всех графиков аналитики;
- всех настроек;
- отдельного AI-чата;
- пустых серых блоков без объяснения.

Главный AI-блок:

- короткий daily brief;
- risk summary;
- missing data explanation;
- recommended next actions.

### 4.2. AI Navigator -> Distributed AI Layer

Старый `/dashboard/ai-assistant` не должен быть основным daily-разделом.

AI должен появляться:

- на главной как AI Brief;
- в лидах как lead risk hints;
- в сделках как stuck deal hints;
- в задачах как priority hints;
- в сообщениях как unanswered client hints;
- в аналитике как explanation layer;
- в подключениях как recommendation layer.

Можно оставить технический/advanced экран AI Navigator, но:

- убрать из primary sidebar;
- сделать доступным из Dashboard AI card или Settings;
- позиционировать как "Настройки/память AI", а не как live chat.

### 4.3. Leads

`/dashboard/leads`

Содержимое:

- новые/в работе/назначенные/просроченные лиды;
- kanban или compact cards;
- фильтры по статусу/источнику/ответственному;
- быстрые действия: добавить лид, назначить, создать сделку, создать задачу;
- AI hints:
  - лид без ответа;
  - клиент написал повторно;
  - лид не назначен;
  - высокая вероятность интереса.

Не перегружать:

- не делать тяжелую таблицу основным видом;
- не показывать 10 inline actions одновременно.

### 4.4. Deals

`/dashboard/deals`

Содержимое:

- воронка;
- список;
- просроченные;
- выигранные;
- проигранные;
- detail drawer/card;
- next action;
- responsible user;
- loss reason when lost.

AI hints:

- сделка без движения;
- клиент проявлял интерес, но нет next action;
- сделка близка к закрытию;
- риск потери.

### 4.5. Clients

`/dashboard/clients`

Содержимое:

- база клиентов;
- поиск;
- источник;
- статус клиента;
- ответственный;
- история заявок;
- история сделок;
- покупки/импортированные продажи, если есть;
- заметки;
- timeline в карточке клиента.

AI hints:

- клиент давно не покупал;
- есть незавершенная сделка;
- клиент обращался несколько раз без покупки;
- можно сделать повторное предложение.

### 4.6. Messages / Inbox

`/dashboard/conversations` переименовать в "Сообщения" или "Входящие".

Содержимое:

- WhatsApp;
- Telegram;
- Instagram;
- website chat;
- неотвеченные;
- назначенные менеджерам;
- conversation detail;
- linked client/lead/deal;
- AI draft/suggestion, but no forced auto-send.

AI hints:

- есть неотвеченные сообщения;
- клиент написал повторно;
- обращение не назначено;
- ответ задерживается.

### 4.7. Tasks

`/dashboard/tasks`

Содержимое:

- мои задачи;
- задачи команды, если роль позволяет;
- просроченные;
- связанные лиды/сделки/клиенты/записи;
- priority;
- due date;
- comments.

Задачи должны быть бизнесовыми:

- перезвонить;
- ответить клиенту;
- отправить КП;
- проверить оплату;
- закрыть сделку;
- назначить встречу;
- обработать заявку.

AI hints:

- сначала обработайте лиды без ответа;
- задача влияет на сделку;
- срочные задачи до конца дня.

### 4.8. Analytics

`/dashboard/analytics`

Содержимое:

- продажи;
- лиды;
- каналы;
- сотрудники;
- клиенты;
- конверсия;
- динамика;
- детализация по периодам;
- export later.

Разница:

- Dashboard отвечает "что происходит и что делать";
- Analytics отвечает "почему так произошло и где детали".

AI в аналитике:

- объясняет цифры;
- выделяет причины;
- не придумывает данные;
- показывает missing data states.

### 4.9. Connections / Integrations

`/dashboard/integrations` переименовать в "Подключения".

Содержимое:

- WhatsApp;
- Telegram;
- Instagram;
- site widget;
- Excel/CSV;
- Google Sheets;
- 1C;
- MoySklad;
- Kaspi;
- warehouse/marketplaces when connected.

Merchant UI:

- Подключить;
- Подключено;
- Ошибка подключения;
- Требуется действие;
- Последнее обновление;
- Какие данные доступны.

Merchant не должен видеть:

- API keys;
- webhooks;
- raw tokens;
- provider internals;
- JSON configs.

Bot setup lives here:

- Подключения -> WhatsApp -> Настроить бота;
- Подключения -> Telegram -> Настроить бота;
- Подключения -> Сайт -> Настроить виджет.

### 4.10. Settings

`/dashboard/settings`

Содержимое:

- данные компании;
- команда;
- роли;
- права доступа;
- уведомления;
- тариф;
- безопасность;
- шаблоны;
- AI-боты и сценарии;
- услуги;
- ресурсы;
- график работы.

Перенести сюда:

- Services;
- Resources;
- Working hours;
- team management;
- role presets;
- advanced bot scenarios.

### 4.11. Onboarding / Pilot Readiness

Не показывать как отдельные пункты sidebar.

Перенести:

- на Dashboard как setup checklist;
- в Settings as "Статус запуска";
- в Integrations as connection progress.

### 4.12. Timeline

Не показывать как отдельный пункт sidebar.

Timeline должна быть внутри:

- client card;
- deal card;
- lead detail;
- conversation context panel.

## 5. Role-Based UX

### 5.1. Business Owner

Видит:

- деньги;
- продажи;
- заявки;
- риски;
- сотрудников;
- каналы;
- просрочки;
- аналитику;
- настройки;
- подключения.

AI показывает:

- общую картину;
- падение/рост;
- риски потери денег;
- проблемы команды;
- утреннюю/вечернюю сводку.

### 5.2. Manager

Видит:

- свои лиды;
- свои сделки;
- свои задачи;
- свой KPI;
- свои клиенты;
- сообщения, назначенные ему.

Не должен видеть без permission:

- финансовую аналитику владельца;
- настройки компании;
- роли;
- billing;
- все данные команды.

AI показывает:

- кому ответить;
- какой лид обработать;
- какая сделка зависла;
- сколько осталось до KPI;
- какие задачи срочные.

### 5.3. Administrator / Operator

Видит:

- входящие заявки;
- нераспределенные лиды;
- сообщения без ответа;
- задачи обработки;
- назначение ответственных;
- операционные просрочки.

AI показывает:

- что не распределено;
- где нет ответственного;
- где задерживается ответ;
- где нужно обновить статус.

### 5.4. Department Lead / Senior Manager

Видит:

- командные KPI;
- нагрузку команды;
- скорость ответа;
- зависшие сделки;
- просрочки по менеджерам.

AI показывает:

- просадки команды;
- перегруз одного менеджера;
- падение конверсии;
- зависшие сделки.

## 6. AI Navigator Requirements

### 6.1. Functional Scope

AI Navigator is not a general live chat in MVP.

It should provide:

- daily brief;
- evening summary later;
- risk signals;
- missing data guidance;
- role-based action hints;
- KPI explanations;
- integration recommendations;
- page-context suggestions.

### 6.2. Data Boundary

AI must use only tenant-scoped data.

Every AI prompt/service must preserve:

- business id boundary;
- user role boundary;
- permission boundary;
- no cross-tenant examples;
- no unsupported external claims.

### 6.3. Missing Data Behavior

Examples:

- "Пока недостаточно данных для точной аналитики."
- "Я вижу заявки, но не вижу закрытых продаж."
- "Добавьте сотрудников, чтобы я мог считать нагрузку команды."
- "Подключите WhatsApp, Telegram, Excel/CSV, 1C или склад."

### 6.4. AI as Feature Navigator

AI can recommend enabling features:

- auto reminders;
- manager KPI;
- WhatsApp bot;
- data import;
- stock tracking;
- integration setup.

But recommendations must be:

- contextual;
- dismissible;
- not aggressive;
- based on actual data gaps or risks.

## 7. UI/UX Rules

### 7.1. Page Length

Main pages should not become long landing pages.

Each page should fit the core summary in the first viewport:

- page title;
- primary status;
- 1-3 primary actions;
- core cards/list.

### 7.2. Buttons

Each page should have 1-3 primary actions.

Secondary actions:

- in "Еще";
- inside card menu;
- inside drawer;
- in advanced section.

### 7.3. Empty States

Empty state must be onboarding:

- explain what is missing;
- explain why it matters;
- offer 1-2 actions.

No empty tables without guidance.

### 7.4. Mobile

Mobile screens:

- no dense tables;
- use cards;
- bottom navigation;
- large touch targets;
- filters as chips/sheets;
- key action reachable with thumb.

### 7.5. Terminology

Use merchant language, not technical language:

- "Сообщения", not "Conversations";
- "Подключения", not "Integrations";
- "Главная", not "Dashboard";
- "AI Навигатор" or "Подсказки ZANI", not "AI Assistant" as chat;
- "Настройки бота", only inside connection/setup context.

## 8. Implementation Roadmap

### Phase 1. Navigation Simplification

Goal: shorten sidebar and mobile nav without breaking old routes.

Tasks:

1. Update `Sidebar.tsx` primary items.
2. Update `MobileNav.tsx`.
3. Keep legacy routes working with redirects or hidden access.
4. Rename labels:
   - Conversations -> Сообщения;
   - Integrations -> Подключения;
   - AI Assistant -> AI Навигатор / Подсказки ZANI, hidden from main sidebar.
5. Remove from visible sidebar:
   - onboarding;
   - pilot readiness;
   - bots;
   - AI agents;
   - automations;
   - timeline;
   - services;
   - resources;
   - working hours;
   - appointments duplicate.

Acceptance:

- sidebar has max 9 primary items;
- hidden routes still open directly;
- permissions still apply;
- mobile nav is shorter and usable.

Checks:

- `cd frontend && npm run build`

### Phase 2. Dashboard as Business Control Center

Goal: dashboard becomes main owner/operator screen.

Tasks:

1. Add AI brief/missing data block.
2. Show role-based hero cards.
3. Show important events, not full analytics.
4. Add setup checklist from onboarding/pilot readiness.
5. Add quick actions:
   - add lead;
   - add client;
   - add deal;
   - import Excel;
   - connect WhatsApp/Telegram;
   - connect 1C/Kaspi/MoySklad.
6. Reduce non-actionable charts.

Acceptance:

- dashboard first viewport explains business state;
- empty business does not look broken;
- AI does not invent numbers;
- owner and manager dashboards differ.

Checks:

- `cd frontend && npm run build`
- manual login as business owner and operator.

### Phase 3. Distributed AI Hints

Goal: remove dependency on standalone AI chat page.

Tasks:

1. Add reusable `AiInsightCard`.
2. Add page context variants:
   - dashboard;
   - leads;
   - deals;
   - clients;
   - tasks;
   - conversations;
   - analytics;
   - integrations.
3. Ensure AI insight source is tenant-scoped.
4. Keep OpenRouter optional/fallback-safe.
5. Keep old AI page hidden/advanced.

Acceptance:

- AI hints appear where useful;
- no page requires chat interaction;
- missing data is handled honestly;
- no cross-tenant data risk.

Checks:

- backend tests for AI context boundaries if touched;
- frontend build.

### Phase 4. Settings Consolidation

Goal: move operational configuration into Settings.

Tasks:

1. Add Settings sections/tabs:
   - Company;
   - Team;
   - Roles;
   - Services;
   - Resources;
   - Working hours;
   - Notifications;
   - Billing;
   - Security;
   - AI/bot scenarios.
2. Hide standalone Services/Resources/WorkingHours from sidebar.
3. Keep old URLs working.
4. Improve empty states and form grouping.

Acceptance:

- owner can find setup in one place;
- no duplicate setup pages in main nav;
- old direct routes are not broken.

Checks:

- frontend build;
- manual settings smoke.

### Phase 5. Connections Consolidation

Goal: merchant sees simple connection center.

Tasks:

1. Rename Integrations to Подключения.
2. Group connection cards:
   - Messaging;
   - Imports;
   - Sales/marketplaces;
   - Website/widget;
   - Accounting/stock.
3. Move bot setup into relevant connection cards.
4. Hide provider internals.
5. Add missing-data recommendations from Dashboard to Connections.

Acceptance:

- merchant sees connect/status/action only;
- no API/webhook/token UI for merchant;
- bot setup is contextual.

Checks:

- frontend build;
- manual Telegram/WhatsApp/Kaspi/Excel card smoke.

### Phase 6. Entity Detail Consolidation

Goal: timeline and history live inside relevant entity cards.

Tasks:

1. Client card includes timeline/messages/leads/deals/tasks/notes.
2. Deal card includes stage history/tasks/messages/client context.
3. Lead detail includes source/messages/assignment/next action.
4. Conversation context panel links client/lead/deal.
5. Hide standalone Timeline from sidebar.

Acceptance:

- user does not need separate Timeline page for daily work;
- history is visible where decision happens.

Checks:

- frontend build;
- manual smoke for client/deal/conversation detail.

### Phase 7. Analytics Deep Layer

Goal: analytics becomes deeper than dashboard, not duplicate.

Tasks:

1. Keep dashboard summaries short.
2. Analytics page shows:
   - sources;
   - funnel;
   - managers;
   - response time;
   - conversion;
   - imported sales when available.
3. Add AI explanations for visible metrics only.
4. Add missing-data states.

Acceptance:

- analytics answers "why";
- dashboard answers "what now";
- no duplicate blocks without purpose.

Checks:

- frontend build;
- backend check if analytics APIs touched.

### Phase 8. Role-Based Surface

Goal: reduce what each role sees.

Tasks:

1. Audit permissions/resources used by sidebar.
2. Ensure owner sees full merchant surface.
3. Ensure manager sees only daily work.
4. Ensure operator/admin sees intake and assignment work.
5. Ensure hidden UI also has backend permission enforcement.

Acceptance:

- owner: full business control;
- manager: no owner finance/settings unless permitted;
- operator: intake/assignment oriented;
- direct URL access respects backend permissions.

Checks:

- backend permission tests if changed;
- manual login as owner/operator.

### Phase 9. Mobile Polish

Goal: mobile is not a compressed desktop.

Tasks:

1. Simplify bottom nav.
2. Make tables card-based on mobile.
3. Make filters as sheets/chips.
4. Ensure header icons/touch targets are large enough.
5. Ensure sidebar/drawer closes after navigation.
6. Ensure language selector is compact dropdown.

Acceptance:

- core pages are usable on phone;
- no tiny controls;
- no horizontal overflow;
- main action is easy to reach.

Checks:

- frontend build;
- browser/mobile viewport smoke.

## 9. Do Not Do

- Do not delete backend functionality just because it is hidden from sidebar.
- Do not create one huge page with all old functionality.
- Do not make AI a general uncontrolled chat in MVP.
- Do not show technical integration internals to merchants.
- Do not show empty future modules as active daily sections.
- Do not let frontend hiding replace backend permissions.
- Do not show analytics to roles that should not see analytics.
- Do not invent AI insights without data.

## 10. Definition Of Done

Each implementation phase is complete only when:

1. UI behavior matches this plan.
2. Old direct routes either work or redirect intentionally.
3. Role-based visibility is respected.
4. Empty states are useful.
5. Mobile layout is checked for affected pages.
6. `cd frontend && npm run build` passes for frontend changes.
7. `python manage.py check` passes for backend changes.
8. Relevant tests pass if backend logic/permissions/API changed.
9. README or plan notes are updated when user-facing structure changes.

