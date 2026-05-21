# Zani vs amoCRM/Bitrix24 — Product Workflow Analysis

Дата: 14.05.2026

Статус: merged into `/Users/maksim/Desktop/Zani/plan/teh plan 13.05.md`.

Канонический execution-plan теперь находится в `/Users/maksim/Desktop/Zani/plan/teh plan 13.05.md`. Этот файл оставлен как архив исходного конкурентного анализа и продуктовых рассуждений.

Документ фиксирует наши рассуждения по схемам работы amoCRM и Bitrix24, сравнение с текущей логикой Zani и выводы для дальнейшей разработки. Цель — не копировать конкурентов буквально, а взять их сильные бизнес-механики и реализовать их проще, быстрее и понятнее для МСБ.

Источники для ориентира:

- amoCRM pricing/features: https://www.amocrm.ru/buy/
- amoCRM security section: https://www.amocrm.ru/support/security/security/
- Bitrix24 pricing: https://www.bitrix24.ru/prices/
- Bitrix24 CRM features: https://www.bitrix24.ru/features/crm/
- Bitrix24 automation: https://www.bitrix24.ru/features/automatization/
- Bitrix24 role-based CRM permissions: https://helpdesk.bitrix24.com/open/24127550/

---

## 1. Главный вывод

amoCRM сильна как sales-first CRM: сделки, воронка, карточка клиента, коммуникации, задачи, роботы и понятный фокус на обработке заявок.

Bitrix24 сильнее как business portal: CRM, задачи, сотрудники, права, документы, коммуникации, автоматизации, отчеты, структура компании и enterprise-настройки.

Zani должен занять третью позицию:

- проще Bitrix24;
- современнее и легче amoCRM;
- сильнее в AI-first коммуникациях;
- безопаснее для команд за счет backend-first permissions, audit trail и запрета скрывать ошибки;
- быстрее для ежедневной работы менеджера.

Главная продуктовая формула:

Zani = simple CRM cockpit + communication OS + automation layer + controlled team operations.

---

## 2. Что важно в amoCRM

### 2.1. Карточка сделки и клиента

Сильная сторона amoCRM — карточка как рабочий центр. В ней пользователь видит:

- поля сделки/контакта;
- историю общения;
- задачи;
- примечания;
- файлы;
- смену этапов;
- ответственного;
- события.

Вывод для Zani:

Карточка клиента/лида/сделки должна быть не второстепенной страницей, а главным паттерном работы. Именно поэтому `A1 — Unified CRM Entity Drawer` должен быть полноценным результатом, а не просто modal с данными.

Минимальный законченный результат для Zani:

- drawer открывается из всех ключевых страниц;
- внутри есть overview, timeline, tasks, messages, notes;
- есть primary action по типу сущности;
- все действия обновляют данные без full reload;
- mobile drawer удобен как отдельный экран.

### 2.2. Воронка продаж

amoCRM сильна тем, что воронка — это ежедневный рабочий экран менеджера, а не просто список стадий.

Критичные механики:

- понятные этапы;
- drag-and-drop;
- ответственный;
- задачи и следующий шаг;
- причины проигрыша;
- автоматизации на этапах;
- контроль зависших сделок.

Вывод для Zani:

`A5 — Pipeline and Stage Engine Upgrade` нельзя считать завершенным только после добавления полей SLA/probability. Нужен полный рабочий цикл:

- stage validation;
- required fields;
- win/loss modal;
- lost reason;
- SLA/overdue indicators;
- stage transition events;
- mobile kanban;
- связь с задачами и карточкой сделки.

### 2.3. Коммуникации

amoCRM делает сильный акцент на диалогах и связи коммуникаций с CRM. Для SMB это критично: бизнес хочет видеть, кто написал, кто отвечает и что дальше делать.

Вывод для Zani:

Inbox должен быть не “страницей сообщений”, а рабочим центром обработки входящих.

Готовый результат:

- список диалогов с фильтрами;
- unread/handoff/SLA indicators;
- assigned user;
- linked client/lead/deal;
- composer;
- quick replies;
- AI draft insertion;
- internal notes;
- create/link CRM entities from conversation;
- timeline write on important events.

### 2.4. Автоматизации

amoCRM продает ценность роботов, триггеров и автоматических действий. Пользователь не хочет каждый раз вручную ставить задачу или писать одно и то же сообщение.

Вывод для Zani:

Автоматизации нужны, но нельзя начинать со сложного конструктора. Сначала шаблоны:

- новая заявка -> задача менеджеру;
- новое сообщение -> notification/handoff;
- запись создана -> напоминание;
- этап изменен -> follow-up task.

Advanced builder нужен позже и должен быть спрятан за simple mode.

---

## 3. Что важно в Bitrix24

### 3.1. Роли, отделы и доступы

Bitrix24 силен в гибких правах: роли, отделы, доступ к своим/отдела/всем сущностям, разные уровни доступа к CRM-разделам. Это важно для компаний от 10 до 100+ сотрудников.

Но слабость Bitrix24 — сложность. Владельцу малого бизнеса легко испугаться матрицы прав и настроек.

Вывод для Zani:

Нам нужна не копия Bitrix24, а простая оболочка над мощной моделью прав:

- presets по умолчанию;
- custom roles только при необходимости;
- scopes: own, assigned, team, department, business;
- backend-first enforcement;
- UI скрывает недоступные разделы;
- API всегда проверяет права;
- опасные действия запрещены или логируются.

Критичный сценарий:

Если менеджер упустил заявку или не ответил в чат, он не должен удалить лид/чат/историю и скрыть ошибку. Поэтому в Zani нужны:

- soft delete/archive;
- lost reason;
- audit trail;
- risk events;
- owner-visible security center.

### 3.2. Задачи и рабочая дисциплина

Bitrix24 силен в задачах, сроках, ответственных, наблюдателях и контроле исполнения.

Вывод для Zani:

Tasks не должны быть отдельным “таск-трекером ради таск-трекера”. Они должны быть встроены в CRM:

- задача из лида;
- задача из чата;
- задача из сделки;
- задача из записи;
- overdue видно владельцу;
- manager performance учитывает просроченные задачи.

### 3.3. Автоматизация подразделений

Bitrix24 делает упор на автоматизацию сотрудников и отделов: роботы, бизнес-процессы, уведомления, согласования.

Вывод для Zani:

Для SMB нам не нужен тяжелый BPMN. Нужны:

- templates;
- simple trigger-condition-action;
- logs;
- safe mode;
- preview/test run;
- понятные ограничения по правам.

### 3.4. Корпоративная прозрачность

Bitrix24 дает владельцу ощущение контроля: кто что делает, какие задачи просрочены, где узкие места.

Вывод для Zani:

Analytics должна быть action-oriented:

- не BI ради графиков;
- не перегруз AI-insights;
- список того, что требует внимания;
- команда, SLA, overdue, lost reasons;
- кто не ответил клиенту;
- кто упустил лид;
- какие сделки зависли.

---

## 4. Где Zani должен быть сильнее

### 4.1. Простота интерфейса

amoCRM проще Bitrix24, но всё равно может быть тяжёлой для новичка. Bitrix24 мощный, но часто ощущается как портал, а не быстрый рабочий cockpit.

Zani должен быть:

- быстрее в навигации;
- чище визуально;
- меньше перегружен таблицами;
- с карточками и drawer вместо бесконечных страниц;
- mobile-first;
- с понятными primary actions.

### 4.2. AI-first без шума

AI не должен превращаться в декоративные блоки, графики и “умные советы” без действия.

Правильные AI-сценарии:

- suggested reply в inbox;
- summary клиента/диалога;
- next best action;
- lead qualification;
- риск просрочки/handoff;
- заполнение черновика, но не auto-send;
- AI работает как помощник менеджера, а не как отдельная игрушка.

### 4.3. Контроль безопасности

Zani должен быть безопаснее типичной SMB CRM:

- tenant isolation;
- object-level permissions;
- role scopes;
- audit log;
- support access grant;
- archive instead of delete;
- export logging;
- sensitive action risk levels;
- manager accountability.

---

## 5. Анализ текущего `teh plan 13.05.md`

Файл `/Users/maksim/Desktop/Zani/plan/teh plan 13.05.md` уже хорошо отражает направление развития, но часть задач сформулирована как foundation/MVP. Это полезно для поэтапности, но рискованно, если после каждого этапа мы будем считать блок полностью закрытым.

### 5.1. Где задачи достаточно конкретные

Эти prompts в целом имеют понятный результат и acceptance criteria:

- A1 — Unified CRM Entity Drawer;
- A2 — Activity Timeline Unification;
- A3 — Duplicate Detection Foundation;
- A5 — Pipeline and Stage Engine Upgrade;
- B1 — Inbox UX Polish;
- B4 — Conversation to CRM Linking;
- C1 — RBAC/ABAC Foundation and Team Access;
- C1.1 — Scoped CRM Querysets and Object-Level Permissions;
- C1.2 — Soft Delete, Archive and Accountability Guardrails;
- D5 — Security and Audit Center.

Но даже у них нужно перед реализацией фиксировать “definition of done” на уровне пользовательского сценария, а не только моделей/API.

### 5.2. Где задачи слишком обобщены

Эти prompts могут быть выполнены формально, но дать только часть желаемого результата:

#### A4 — Custom Fields Foundation

Риск:

- появятся модели и API, но не будет нормального UX редактирования полей;
- поля будут видны только в одном месте;
- не будет валидации required fields в pipeline;
- не будет использования в карточках/фильтрах.

Нужно усилить:

- custom fields должны работать в drawer;
- должны участвовать в required fields stage validation;
- должны иметь удобный field builder;
- должны быть видны в фильтрах хотя бы для clients/leads/deals.

#### A6 — Owner Analytics Dashboard MVP

Риск:

- появятся KPI cards, но dashboard не станет рабочим cockpit;
- аналитика будет набором чисел без действий.

Нужно усилить:

- блок “что требует внимания” обязателен;
- каждая метрика должна вести к списку сущностей;
- dashboard должен отвечать “что делать сейчас”.

#### B2 — Quick Replies and Templates

Риск:

- шаблоны будут CRUD-таблицей, но не станут быстрым инструментом менеджера.

Нужно усилить:

- быстрый поиск в composer;
- категории;
- вставка в черновик;
- связь с AI suggestions;
- шаблоны по нишам в onboarding.

#### B3 — WhatsApp Integration Foundation

Риск:

- будет webhook placeholder, но не будет понятного setup UX и production contract.

Нужно усилить:

- provider interface contract;
- inbound/outbound logs;
- channel health;
- retry/error state;
- clear disabled/mock/provider states.

#### B6 — Attachments MVP

Риск:

- загрузка файлов появится, но не будет полноценной истории и приватного доступа.

Нужно усилить:

- attachments должны отображаться в inbox и CRM drawer;
- private download должен проверять object-level permissions;
- audit для скачивания чувствительных файлов можно отложить, но предусмотреть.

#### C2 — Task Management Upgrade

Риск:

- задачи станут чуть богаче, но не будут встроены в процесс продаж.

Нужно усилить:

- задача должна быть видна в карточке клиента/лида/сделки;
- overdue должен попадать в dashboard/team analytics;
- создание задачи из inbox/deal/lead должно быть быстрым.

#### C3/C4 — Automation Builder

Риск:

- появится конструктор, но без безопасного preview, logs и UX он будет опасным.

Нужно усилить:

- сначала templates;
- потом manual builder;
- test run обязателен;
- logs обязателен;
- права на automation management обязательны.

#### C6 — Import and Export Foundation

Риск:

- импорт CSV будет техническим, но не решит миграцию из amoCRM/Bitrix24.

Нужно усилить:

- duplicate preview;
- mapping templates;
- import history;
- rollback/archive strategy;
- export permission/audit.

#### D1 — Forms and Lead Capture

Риск:

- формы создадут лид, но не будет полноценного lead capture flow.

Нужно усилить:

- UTM/source;
- duplicate detection;
- auto-assignment;
- automation trigger;
- simple embed;
- form submission activity event.

#### D2 — Tags and Smart Segments

Риск:

- tags появятся, но не станут рабочей сегментацией.

Нужно усилить:

- saved filters;
- segment counts;
- smart views;
- use in outreach/automation later.

#### D3 — Public API Tokens and Webhooks

Риск:

- токены и webhooks будут без security envelope.

Нужно усилить:

- scopes;
- rate limits;
- delivery logs;
- retries;
- idempotency;
- revoke/rotate;
- audit.

#### D4 — Notification Center Upgrade

Риск:

- уведомления будут списком, но не рабочим центром.

Нужно усилить:

- action buttons;
- read/unread;
- priority;
- deep links;
- mobile dropdown;
- “mark all read”.

#### D6 — Onboarding Templates by Niche

Риск:

- шаблон создаст несколько сущностей, но пользователь всё равно не поймёт, как работать.

Нужно усилить:

- setup checklist;
- demo data;
- first lead/first appointment flow;
- niche-specific pipeline/services/quick replies/automations.

#### D7 — Mobile-First Polish Pass

Риск:

- если отложить mobile до конца, придется переделывать много UI.

Нужно изменить принцип:

- mobile checks должны быть обязательны в каждом frontend prompt;
- D7 должен быть final QA/polish, а не первая mobile-адаптация.

### 5.3. Ответ на вопрос: многие ли задачи обобщены?

Да. Примерно треть плана сформулирована как foundation/MVP/polish. Это нормально для roadmap, но опасно для implementation prompts.

Риск не в том, что задачи плохие. Риск в том, что без жесткого `definition of done` Codex может выполнить “минимально формально”: добавить модели, endpoints и пару UI-блоков, но не закрыть реальный пользовательский сценарий.

Чтобы не возвращаться постоянно назад, каждый prompt перед реализацией должен иметь 4 уровня готовности:

1. Data: модели, миграции, tenant filtering.
2. API: endpoints, serializers, permissions, tests.
3. UX: страница/drawer/form/action states/mobile.
4. Workflow: пользователь может завершить реальный бизнес-сценарий от начала до конца.

Если хотя бы один уровень не закрыт, этап нельзя считать продуктово завершенным.

---

## 6. Как не терять время на возвраты

### 6.1. Для каждого этапа вводим Definition of Done

Перед реализацией каждого prompt нужно уточнять внутри задачи:

- какой пользовательский сценарий должен заработать;
- где это видно в UI;
- какие API участвуют;
- какие permissions нужны;
- какие events/audit/timeline пишутся;
- что будет на mobile;
- какие tests/smoke checks подтверждают готовность.

### 6.2. Не принимать “foundation” как завершенную фичу

Если prompt называется Foundation, это значит:

- backend-архитектура заложена;
- UI показывает минимальную рабочую пользу;
- есть место расширения;
- но в README нужно явно написать, что не входит.

Иначе команда будет думать, что “фича готова”, хотя готов только каркас.

### 6.3. Делать cross-linking сразу

CRM-фичи нельзя делать изолированно.

Пример:

- quick replies должны быть в inbox, а не только в settings;
- tasks должны быть в drawer, dashboard и analytics;
- lost reason должен быть в deal/lead, timeline, audit и analytics;
- custom fields должны быть в drawer и pipeline validation;
- attachments должны быть в inbox, drawer и permissions.

### 6.4. Не откладывать UI/UX до конца

Сейчас план сильнее в backend/business logic, чем в UI/UX. Это опасно, потому что продукт должен конкурировать не только функциями, но и ощущением скорости и простоты.

Для каждого frontend prompt нужны:

- desktop state;
- mobile state;
- empty state;
- loading state;
- error state;
- primary action;
- forbidden/no-permission state.

---

## 7. Что нужно добавить в правила выполнения плана

Рекомендуется добавить в `teh plan 13.05.md` правило:

Каждый prompt считается завершенным только если:

- реализован backend;
- реализован frontend;
- закрыт основной user flow;
- есть tenant/permission checks;
- нет crash на empty/loading/error;
- проверен mobile viewport;
- README/docs обновлены;
- tests/build проходят;
- clearly documented gaps остались только там, где это прямо разрешено prompt.

---

## 8. Продуктовая North Star для Zani

Zani не должен становиться “еще одной CRM”.

Мы строим AI-first SMB Growth OS:

- CRM — ядро;
- Inbox — ежедневный рабочий центр;
- AI — помощник, а не шум;
- Automations — ускоритель, а не сложный BPM;
- Roles/Audit — защита бизнеса от хаоса;
- Dashboard — список действий, а не витрина графиков;
- Mobile UX — не дополнение, а основной режим для многих SMB.

Если задача не помогает быстрее обработать клиента, безопаснее управлять командой или понятнее видеть бизнес, ее нужно упростить или отложить.
