# Zani

Zani — AI-first CRM / Business OS для малого и среднего бизнеса. Сейчас проект содержит Django + DRF backend, React + TypeScript frontend, multi-tenant Merchant CRM и foundation для будущего Platform Admin.

Работа ведется по актуальному мастер-плану:

```text
plan/ZANI_MASTER_TECH_PLAN.md
AGENTS.md
plan/clean_code_rules/zani_required_clean_code_rules.md
```

Правило проекта: один bounded phase/task = один изолированный набор изменений. После каждого этапа запускаются backend checks/tests и frontend build. `AGENTS.md` и clean-code rules обязательны для всех следующих задач.

## Текущий статус

### Реализовано до этапного плана

- Django + DRF backend-core.
- React + TypeScript frontend CRM.
- JWT auth через `djangorestframework-simplejwt`.
- Google / Apple social auth foundation.
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

### ZANI 10 next tasks — Task 1: Mobile-first business cockpit

Статус: **готово как первый visual-shell шаг**.

Что изменено:

- Dashboard получил mobile-first hero в логике “банкинг бизнеса”:
  - крупная выручка для владельца;
  - активные лиды/задачи для менеджера;
  - срочные сигналы без перегруза таблицами.
- Добавлен быстрый action dock:
  - новая заявка;
  - запись;
  - диалоги;
  - импорт для владельца.
- Добавлен focus strip с приоритетами:
  - новые заявки;
  - записи;
  - задачи/просрочки;
  - источник спроса для owner.
- Owner/manager dashboard сохранили разные приоритеты, но первый экран стал ближе к “бизнес в телефоне”, а не к admin panel.
- Изменение ограничено frontend dashboard shell; backend/API не переписывались.

Проверка:

```bash
cd frontend && npm run build
```

### ZANI 10 next tasks — Task 2: Compact grouped navigation

Статус: **готово**.

Что изменено:

- Desktop sidebar переведён с длинного списка на grouped rail:
  - Главная;
  - Продажи;
  - Клиенты;
  - Команда;
  - Операции;
  - AI и интеграции;
  - Система.
- Внутри выбранной группы показываются только её релевантные страницы, поэтому меню меньше похоже на тяжёлую ERP-навигацию.
- Permission filtering сохранён: сотрудник видит только доступные ему разделы.
- Mobile bottom nav упрощён до частых действий:
  - Главная;
  - Заявки;
  - Диалоги;
  - Задачи;
  - Ещё.
- Кнопка `Ещё` открывает полный sidebar, а выбор страницы из overlay закрывает меню.

Проверка:

```bash
cd frontend && npm run build
```

### ZANI 10 next tasks — Task 3: Design system foundation

Статус: **готово как базовый слой**.

Что изменено:

- Добавлены CSS design tokens:
  - brand / AI / ink colors;
  - surface colors;
  - shared shadows;
  - touch target и focus ring primitives.
- `Card` переведён на общий `zani-surface`, чтобы карточки не расходились визуально между страницами.
- `Button` получил размеры:
  - `sm`;
  - `md`;
  - `lg`;
  - `icon`.
- `Input` использует общий focus-ring pattern.
- Добавлены reusable UI primitives:
  - `IconBubble`;
  - `MetricTile`;
  - общий `UiTone`.
- Dashboard metrics переведены на общий `MetricTile`, чтобы следующий редизайн страниц не копировал карточки вручную.

Проверка:

```bash
cd frontend && npm run build
```

### ZANI 10 next tasks — Task 4: RU / KK / EN language foundation

Статус: **готово как базовый i18n слой**.

Что изменено:

- Frontend i18n расширен с `ru/en` до `ru/kk/en`.
- `LanguageSelector` теперь поддерживает:
  - RU;
  - KK;
  - EN.
- Добавлен казахский словарь для ключевых merchant CRM зон:
  - навигация;
  - мобильное меню;
  - header;
  - auth;
  - dashboard;
  - leads.
- Для непереведённых ключей включён безопасный fallback:
  - текущий язык;
  - русский;
  - английский;
  - исходный ключ.
- Sidebar group labels больше не hardcoded на русском и переключаются через i18n keys.
- Mobile `Ещё` вынесено в словарь как `mobile.more`.

Проверка:

```bash
cd frontend && npm run build
```

### ZANI 10 next tasks — Task 5: Owner vs manager dashboard

Статус: **готово**.

Что изменено:

- Dashboard roles разведены жёстче:
  - owner/admin/business_owner видят owner cockpit;
  - business_manager/manager/operator/staff видят рабочую очередь сотрудника.
- Owner analytics endpoint `/api/analytics/owner-dashboard/` больше не запрашивается для manager/operator dashboard.
- Для owner при недоступной аналитике используются безопасные local fallback-метрики по уже загруженным CRM данным.
- Для сотрудников добавлен `ManagerWorkQueue`:
  - лиды на ответ;
  - записи на сегодня;
  - мои открытые задачи.
- Manager/operator экран не показывает управленческую выручку, конверсию и owner pulse.
- Первый экран сотрудника сфокусирован на действиях, а не на аналитике владельца.

Проверка:

```bash
cd frontend && npm run build
```

### ZANI 10 next tasks — Task 6: CRM flow polish

Статус: **готово как первый проход по сквозному сценарию**.

Что улучшено:

- Сценарий `заявка -> запись` стал контекстным:
  - клиент из заявки подставляется в форму записи;
  - услуга из заявки подставляется, если она есть;
  - сама заявка связывается с создаваемой записью;
  - после создания показывается понятное подтверждение.
- Форма заявки больше не ведёт в тупик, если нет клиентов:
  - показывает подсказку, зачем нужен клиент;
  - даёт переход на создание клиента;
  - блокирует сохранение заявки без клиента.
- Если услуг ещё нет, форма заявки объясняет, почему услуга нужна для будущей записи и слотов.
- Страница клиентов теперь поддерживает deep link:
  - `/dashboard/clients?create=1`
  - сразу открывает модалку создания клиента.
- Закрытие/сохранение клиента очищает `create` query param, чтобы модалка не открывалась повторно.

Проверка:

```bash
cd frontend && npm run build
```

### ZANI 10 next tasks — Task 7: AI Business Memory

Статус: **готово как управляемый memory foundation**.

Что реализовано:

- Использован существующий tenant-safe backend ресурс:
  - `/api/ai/knowledge-items/`
  - модель `BusinessKnowledgeItem`.
- На странице `AI Assistant` добавлен блок `Business Memory`:
  - показывает количество активных фактов;
  - объясняет, что AI использует эти факты как бизнес-контекст.
- Добавлено управление фактами памяти:
  - создать факт;
  - редактировать факт;
  - выбрать категорию;
  - включить/выключить использование в AI-контексте.
- Категории памяти:
  - О бизнесе;
  - Продажи;
  - Услуги;
  - Операции;
  - Тон общения;
  - Правила.
- Добавлен frontend type `BusinessKnowledgeItem`.
- Добавлен API helper `businessKnowledgeApi`.
- AI Assistant теперь визуально связывает чат, действия и память бизнеса, но без лишней AI-перегрузки.

Проверка:

```bash
cd frontend && npm run build
```

### ZANI 10 next tasks — Task 8: Integration onboarding v2

Статус: **готово**.

Что улучшено:

- На странице `Интеграции` добавлен верхний onboarding guide:
  - импортировать базу;
  - включить входящие каналы;
  - оставить заявку на WhatsApp/Instagram;
  - проверить data connectors.
- Guide показывает понятный маршрут для владельца, а не только каталог коннекторов.
- Каждый шаг ведёт к нужной секции страницы через smooth scroll.
- Добавлены anchor sections:
  - `integration-import`;
  - `integration-telegram`;
  - `integration-website`;
  - `integration-requests`;
  - `integration-data`.
- Страница сохраняет существующие продукты и request-ready логику:
  - Excel/CSV;
  - Website chat;
  - Telegram beta;
  - WhatsApp/Instagram request;
  - Kaspi/1C/склад/marketplaces foundation.
- Владелец видит, что уже активно, что начато, что требует заявки, а что находится в pilot/roadmap.

Проверка:

```bash
cd frontend && npm run build
```

### ZANI 10 next tasks — Task 9: Pilot launch quality gate

Статус: **готово**.

Что реализовано:

- `prepare_pilot_demo` теперь печатает полноценный launch pack:
  - URL фронта/бэка;
  - логины platform/owner/manager;
  - business id, landing id, domain;
  - active `LeadForm.public_id`;
  - public form API и submit API;
  - готовый `curl` для внешнего лендинга;
  - ключевые API checks;
  - ключевые frontend routes;
  - что можно показывать на пилоте;
  - что нельзя обещать до production-интеграций.
- Добавлена команда:
  - `python manage.py pilot_launch_quality_gate`
- Quality gate проверяет без поднятого HTTP-сервера:
  - `/health/`;
  - `/health/db/`;
  - `/ready/`;
  - public lead form;
  - login platform/owner/manager;
  - platform overview;
  - owner `me`, pilot readiness, leads, clients, tasks, inbox summary, analytics;
  - manager `me` и tasks.
- `scripts/pilot_smoke_check.sh` теперь:
  - запускает `prepare_pilot_demo --reset` два раза подряд;
  - проверяет idempotency demo launch pack;
  - запускает `pilot_launch_quality_gate`;
  - поддерживает `PILOT_FRONTEND_URL` и `PILOT_BACKEND_URL`.
- Документация demo launch обновлена в `docs/block14-pilot-demo-launch.md`.

Проверки:

```bash
DATABASE_URL=sqlite:///db.sqlite3 SECURE_SSL_REDIRECT=False SESSION_COOKIE_SECURE=False CSRF_COOKIE_SECURE=False REDIS_URL=memory:// CELERY_TASK_ALWAYS_EAGER=True CELERY_TASK_STORE_EAGER_RESULT=False AUTOMATIONS_RUN_INLINE=True .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 SECURE_SSL_REDIRECT=False SESSION_COOKIE_SECURE=False CSRF_COOKIE_SECURE=False REDIS_URL=memory:// CELERY_TASK_ALWAYS_EAGER=True CELERY_TASK_STORE_EAGER_RESULT=False AUTOMATIONS_RUN_INLINE=True .venv/bin/python manage.py test apps.businesses.tests_demo_seed -v 2
DATABASE_URL=sqlite:///db.sqlite3 SECURE_SSL_REDIRECT=False SESSION_COOKIE_SECURE=False CSRF_COOKIE_SECURE=False REDIS_URL=memory:// CELERY_TASK_ALWAYS_EAGER=True CELERY_TASK_STORE_EAGER_RESULT=False AUTOMATIONS_RUN_INLINE=True .venv/bin/python manage.py pilot_launch_quality_gate
SKIP_FRONTEND_BUILD=true DATABASE_URL=sqlite:///db.sqlite3 SECURE_SSL_REDIRECT=False SESSION_COOKIE_SECURE=False CSRF_COOKIE_SECURE=False REDIS_URL=memory:// CELERY_TASK_ALWAYS_EAGER=True CELERY_TASK_STORE_EAGER_RESULT=False AUTOMATIONS_RUN_INLINE=True ./scripts/pilot_smoke_check.sh
cd frontend && npm run build
```

### Auth additions: Google / Apple sign-in

Статус: **готово как кодовая основа**.

Добавлено:

- `POST /api/auth/social/` для входа и регистрации через Google / Apple identity token.
- `SocialIdentity` связывает локального пользователя с `provider + subject`.
- Backend проверяет provider token через JWKS, `aud`, `iss`, `sub`, `exp`, `iat`.
- Новые social users создаются как `business_owner` и получают trial workspace, если включён `SOCIAL_AUTH_AUTO_CREATE_MERCHANT=True`.
- Login page получила кнопки Google и Apple.
- Env templates расширены:
  - `GOOGLE_OAUTH_CLIENT_IDS`;
  - `APPLE_OAUTH_CLIENT_IDS`;
  - `SOCIAL_AUTH_AUTO_CREATE_MERCHANT`;
  - `AUTH_SOCIAL_RATE`;
  - `VITE_GOOGLE_CLIENT_ID`;
  - `VITE_APPLE_CLIENT_ID`.
- Документация: `docs/social-auth.md`.

Для реального продакшн-входа нужно создать OAuth clients в Google Cloud Console и Apple Developer, затем прописать client IDs в backend/frontend env.

### Registration, invitations and password recovery

Статус: **готово как pilot foundation**.

Добавлено:

- `POST /api/auth/signup/owner/` — короткая регистрация директора: создаёт `business_owner`, trial `Business`, default roles, default pipeline и owner membership.
- `/signup` — компактная карточка регистрации компании без длинного onboarding.
- `BusinessInvitation` — приглашение сотрудника в существующий бизнес.
- `GET /api/team/invitations/preview/{token}/` — публичный preview приглашения.
- `POST /api/team/invitations/accept/` — сотрудник принимает приглашение и задаёт пароль.
- `POST /api/team/invitations/` и `POST /api/team/invitations/{id}/revoke/` — управление приглашениями из `Settings -> Команда и доступы`.
- Поддержаны каналы приглашения:
  - email;
  - WhatsApp;
  - Telegram;
  - ручное копирование ссылки.
- На MVP каналы формируют готовую ссылку/сообщение для отправки; реальные mail/WhatsApp/Telegram providers подключаются отдельным интеграционным этапом.
- `POST /api/auth/password-reset/request/` и `POST /api/auth/password-reset/confirm/` — foundation восстановления пароля.
- `/forgot-password` и `/reset-password/:uid/:token` — frontend flow восстановления пароля.

Бизнес-логика:

- Директор регистрируется без приглашения и создаёт компанию.
- Сотрудники не создают компанию сами: владелец/админ отправляет приглашение из команды, сотрудник задаёт пароль по одноразовой ссылке.
- `owner` нельзя выдать обычным приглашением; передача владения должна быть отдельным явным сценарием.

Проверки:

```bash
.venv/bin/python manage.py makemigrations --check --dry-run
.venv/bin/python manage.py check
.venv/bin/python manage.py test
cd frontend && npm run build
```

### Calendar / Working Hours UX cleanup

Статус: **готово**.

Исправлено:

- Календарь после создания записи автоматически переключается на дату новой записи, чтобы мерч сразу видел результат.
- Если график работы не настроен, календарь предлагает быстрый салонный график `09:00-20:00` каждый день.
- Форма записи стала логичнее для салона/парикмахерской:
  - ресурс называется `Мастер / ресурс`;
  - если мастера заведены, выбор мастера обязателен;
  - неактивные ресурсы не предлагаются для записи.
- Страница ресурсов объясняет, что ресурс для салона — это мастер, барбер, кресло или рабочее место.
- Страница графика работы теперь настраивает всю неделю одним экраном:
  - общий график бизнеса;
  - отдельный график конкретного мастера/ресурса;
  - пресеты `Салон 09:00-20:00 каждый день` и `Офис Пн-Пт 09:00-18:00`.
- Backend дополнительно запрещает дубли графика на один и тот же `business/resource/weekday`, включая общий график бизнеса.
- E2E smoke добавлен для реального сценария мерча: owner login → calendar → create appointment through UI.

Проверки:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.scheduling.tests --verbosity=1
DATABASE_URL=sqlite:///db.sqlite3 \
SECURE_SSL_REDIRECT=False \
SESSION_COOKIE_SECURE=False \
CSRF_COOKIE_SECURE=False \
REDIS_URL=memory:// \
CELERY_TASK_ALWAYS_EAGER=True \
CELERY_TASK_STORE_EAGER_RESULT=False \
AUTOMATIONS_RUN_INLINE=True \
.venv/bin/python manage.py test --verbosity=1
cd frontend && npm run build
cd frontend && E2E_SKIP_LOCAL_SETUP=true E2E_API_BASE_URL=http://127.0.0.1:8000 npm run e2e -- --project=desktop-chromium
```

### Corrected Pilot/Core Roadmap — Task 1: Route / Navigation / Broken Flow Audit

Статус: **готово**.

Исправлено:

- Добавлен canonical merchant route alias:
  - `/dashboard/ai` → `/dashboard/ai-assistant`
- Глобальный поиск теперь ведёт в canonical dashboard routes:
  - `/dashboard/clients`
  - `/dashboard/leads`
  - `/dashboard/appointments`
  - `/dashboard/deals`
  - `/dashboard/tasks`
- Добавлена Platform Merchant detail/support страница:
  - `/platform/merchants/:id`
- Список merchants в Platform Admin теперь ведёт в detail/support view, а не оставляет support workflow без действия.
- Platform detail показывает:
  - owner snapshot;
  - landing context;
  - CRM operations;
  - data sources;
  - pilot health;
  - support workflow;
  - recent support actions;
  - форму записи support action.
- E2E smoke расширен route-аудитом:
  - merchant core routes;
  - public routes;
  - platform routes;
  - platform merchant detail.
- Локальный Playwright webServer поднимает высокий `AUTH_LOGIN_RATE/AUTH_REFRESH_RATE`, чтобы smoke-аудит роутов не упирался в auth throttle. Production throttling не менялось.

Проверки:

```bash
cd frontend && npm run build
cd frontend && npm run e2e -- --project=desktop-chromium
```

### Pilot Tech Plan — Этап 1: Внешний лендинг → Zani

Статус: **готово**.

Добавлено:

- `Lead.Sources.LANDING` для заявок из внешних лендингов.
- `LeadForm.landing_id`, `landing_domain`, `preview_url` для связи внешнего лендинга с конкретным бизнесом.
- `LeadFormSubmission` теперь хранит `landing_id`, `page_url`, `page_domain`, `source_context_json`, UTM, IP и user-agent.
- `LeadFormSubmissionError` фиксирует ошибки публичных отправок формы.
- Public submit endpoint продолжает работать через:
  - `POST /api/public/forms/<public_id>/submit/`
- Защита public endpoint:
  - `public_form` throttle;
  - required-field validation;
  - basic honeypot fields.
- Документация для внешнего лендинга:
  - `docs/public-lead-capture.md`.

Проверки:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 \
SECURE_SSL_REDIRECT=False \
SESSION_COOKIE_SECURE=False \
CSRF_COOKIE_SECURE=False \
REDIS_URL=memory:// \
CELERY_TASK_ALWAYS_EAGER=True \
CELERY_TASK_STORE_EAGER_RESULT=False \
AUTOMATIONS_RUN_INLINE=True \
.venv/bin/python manage.py test
cd frontend && npm run build
```

### Pilot Tech Plan — Этап 2: Активация кабинета после лендинга

Статус: **готово**.

Добавлено:

- Platform-only endpoint:
  - `POST /api/platform/activate-landing/`
- Activation service:
  - `apps.businesses.activation.activate_landing_business(...)`
- `Business` теперь хранит:
  - `landing_id`;
  - `landing_domain`;
  - `landing_preview_url`.
- Активация создаёт или обновляет:
  - owner user с `role=business_owner`;
  - `Business` в статусе `trial`;
  - owner membership;
  - default RBAC roles;
  - CRM Light pipeline;
  - default landing lead form и `public_id`;
  - trial subscription на 30 дней.
- Операция идемпотентна по `landing_id`.
- Документация:
  - `docs/landing-activation.md`.

Проверки:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 \
SECURE_SSL_REDIRECT=False \
SESSION_COOKIE_SECURE=False \
CSRF_COOKIE_SECURE=False \
REDIS_URL=memory:// \
CELERY_TASK_ALWAYS_EAGER=True \
CELERY_TASK_STORE_EAGER_RESULT=False \
AUTOMATIONS_RUN_INLINE=True \
.venv/bin/python manage.py test
cd frontend && npm run build
```

### Pilot Tech Plan — Этап 3: Первый экран после активации

Статус: **готово**.

Добавлено:

- Dashboard для нового владельца с активированным лендингом больше не показывает пустую CRM как основной сценарий.
- Первый экран показывает:
  - “Ваш лендинг активирован”;
  - текст про подарочный месяц расширенного доступа;
  - Business Setup Score;
  - карточки подключения WhatsApp, AI-бота, сотрудников, услуг, продаж, Excel/CSV, 1C export, МойСклад/склада.
- Неготовые модули явно помечены статусами:
  - `подключить`;
  - `beta`;
  - `скоро`;
  - `по заявке`.
- Owner analytics error теперь не блокирует первый экран: dashboard показывает мягкое предупреждение и продолжает рендерить доступные onboarding-блоки.
- Добавлен e2e smoke для activated landing owner и first-run dashboard.
- Frontend `Business` type расширен landing-полями.

Проверки:

```bash
cd frontend && npm run build
cd frontend && npm run e2e -- --project=desktop-chromium
cd frontend && npm run e2e -- --project=mobile-chromium
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 \
SECURE_SSL_REDIRECT=False \
SESSION_COOKIE_SECURE=False \
CSRF_COOKIE_SECURE=False \
REDIS_URL=memory:// \
CELERY_TASK_ALWAYS_EAGER=True \
CELERY_TASK_STORE_EAGER_RESULT=False \
AUTOMATIONS_RUN_INLINE=True \
.venv/bin/python manage.py test -v 2
```

### Pilot Tech Plan — Этап 4: CRM Light для пилота

Статус: **готово**.

Добавлено:

- CRM Light поток для заявок стал ближе к пилотному сценарию:
  - владелец бизнеса видит все заявки;
  - менеджер видит и редактирует только назначенные ему заявки;
  - новая заявка по умолчанию назначается на текущего пользователя, если ответственный не выбран явно.
- Для `manager` role preset изменены scopes по ключевым CRM-объектам:
  - `leads`: view/update own, create business;
  - `deals`: view/update own, create business;
  - `tasks`: view/update own, create business.
- В `Lead` API добавлены быстрые actions:
  - `POST /api/leads/{id}/assign/` — назначить ответственного;
  - `POST /api/leads/{id}/add-note/` — добавить комментарий к заявке.
- Назначение ответственного валидируется по активному `BusinessMember` текущего бизнеса.
- Назначение и комментарии пишут audit/activity history.
- Форма заявки на фронте поддерживает выбор ответственного из команды бизнеса.
- CRM карточка получила быстрые действия:
  - добавить комментарий;
  - создать связанную задачу.
- Smoke-сценарий frontend теперь проверяет CRM карточку: открытие заявки, комментарий, создание задачи.

Важно:

- Для новых бизнесов актуальные permissions применяются автоматически через default role presets.
- Для уже существующих production/staging бизнесов с сохранёнными `BusinessRole` может понадобиться отдельный sync ролей, чтобы новый own-scope для менеджеров применился к старым данным.

Проверки:

```bash
DATABASE_URL=sqlite:///db.sqlite3 \
SECURE_SSL_REDIRECT=False \
SESSION_COOKIE_SECURE=False \
CSRF_COOKIE_SECURE=False \
REDIS_URL=memory:// \
CELERY_TASK_ALWAYS_EAGER=True \
CELERY_TASK_STORE_EAGER_RESULT=False \
AUTOMATIONS_RUN_INLINE=True \
.venv/bin/python manage.py test apps.leads.tests_crm_light apps.tasks.tests apps.clients.tests apps.businesses.tests_access -v 2

cd frontend && npm run build
cd frontend && npm run e2e -- --project=desktop-chromium
cd frontend && npm run e2e -- --project=mobile-chromium

DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run

DATABASE_URL=sqlite:///db.sqlite3 \
SECURE_SSL_REDIRECT=False \
SESSION_COOKIE_SECURE=False \
CSRF_COOKIE_SECURE=False \
REDIS_URL=memory:// \
CELERY_TASK_ALWAYS_EAGER=True \
CELERY_TASK_STORE_EAGER_RESULT=False \
AUTOMATIONS_RUN_INLINE=True \
.venv/bin/python manage.py test -v 2
```

### Pilot Tech Plan — Этап 5: Источники данных: Excel/CSV и ручной ввод

Статус: **готово**.

Добавлено:

- `ImportJob` теперь поддерживает новые типы импорта:
  - `sales` — продажи/выручка;
  - `catalog` — каталог услуг и товаров.
- `ImportJob.errors_json` хранит построчные ошибки предпросмотра, чтобы плохой файл не попадал в confirm-импорт.
- CSV/XLSX import flow расширен:
  - preview с авто-маппингом колонок;
  - row validation;
  - confirm только для валидных файлов.
- Новые endpoint'ы:
  - `GET /api/import-templates/<entity_type>/` — скачать пример CSV для `clients`, `sales`, `catalog`;
  - `POST /api/import-jobs/` — загрузить CSV/XLSX для preview;
  - `POST /api/import-jobs/{id}/confirm/` — подтвердить импорт;
  - `POST /api/data/sales/` — ручной ввод продажи;
  - `POST /api/data/catalog-items/` — ручной ввод позиции каталога.
- Продажи сохраняются как `BusinessEvent(event_type="sale.recorded")` и учитываются в owner dashboard revenue.
- Каталог сохраняется как `BusinessEvent(event_type="catalog.item_imported" / "catalog.item_created")`.
- Строки каталога с `item_type=service` создают или обновляют CRM `Service`.
- Owner dashboard показывает:
  - revenue по импортированным/ручным продажам;
  - `sales_events_count`;
  - `data_quality` с рекомендацией подключить продажи, если данных ещё нет.
- В Settings добавлен рабочий UI-блок для источников данных:
  - выбор сущности импорта;
  - загрузка CSV/XLSX;
  - скачивание шаблона;
  - предпросмотр маппинга;
  - отображение ошибок строк;
  - экспорт `clients`, `leads`, `deals`, `sales`, `catalog`;
  - ручной ввод продажи;
  - ручной ввод услуги/товара.
- Документация:
  - `docs/data-imports.md`.

Важно:

- Полноценная модель товаров/остатков пока не вводилась: `product` строки каталога сохраняются как business events для будущего inventory/storage слоя.
- Реальные 1C/МойСклад connectors на этом этапе не подключались.
- Ручной ввод продаж/каталога использует permission scope `integrations.manage`; для старых кастомных ролей может понадобиться sync role presets.

Проверки:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations core
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py migrate

DATABASE_URL=sqlite:///db.sqlite3 \
SECURE_SSL_REDIRECT=False \
SESSION_COOKIE_SECURE=False \
CSRF_COOKIE_SECURE=False \
REDIS_URL=memory:// \
CELERY_TASK_ALWAYS_EAGER=True \
CELERY_TASK_STORE_EAGER_RESULT=False \
AUTOMATIONS_RUN_INLINE=True \
.venv/bin/python manage.py test apps.core.tests_import_export apps.analytics.tests -v 2

cd frontend && npm run build

DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check

DATABASE_URL=sqlite:///db.sqlite3 \
SECURE_SSL_REDIRECT=False \
SESSION_COOKIE_SECURE=False \
CSRF_COOKIE_SECURE=False \
REDIS_URL=memory:// \
CELERY_TASK_ALWAYS_EAGER=True \
CELERY_TASK_STORE_EAGER_RESULT=False \
AUTOMATIONS_RUN_INLINE=True \
.venv/bin/python manage.py test -v 2

cd frontend && npm run e2e -- --project=desktop-chromium
cd frontend && npm run e2e -- --project=mobile-chromium
```

### Phase 1 — Production Readiness Baseline

Статус: **готово**.

Добавлено:

- Readiness endpoint:
  - `GET /ready/`
- Production safety checks для staging/production:
  - `zani.W001` — `DEBUG=True`;
  - `zani.W002` — weak/placeholder `SECRET_KEY`;
  - `zani.W003` — unrestricted `ALLOWED_HOSTS`;
  - `zani.W004` — empty `CORS_ALLOWED_ORIGINS`;
  - `zani.W005` — empty `CSRF_TRUSTED_ORIGINS`;
  - `zani.W006` — missing `SENTRY_DSN`.
- Celery production baseline:
  - default queue;
  - integration queues;
  - AI worker profile;
  - safer worker prefetch/acks defaults.
- Docker healthcheck теперь использует `/ready/`.
- Production documentation:
  - `docs/production-readiness.md`;
  - `docs/backup-restore.md`;
  - обновлен `docs/deployment.md`.
- `.env.example` дополнен logging/Celery production variables.

Не добавлялось:

- реальные платные провайдеры;
- Kubernetes;
- payment provider;
- storage quotas;
- realtime WebSocket/SSE.

Проверки:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Phase 2 — Storage And File Safety

Статус: **готово**.

Добавлено:

- Storage usage accounting по `FileAttachment.size`.
- `GET /api/billing/usage-summary/` теперь возвращает `storage_mb`.
- Plan-aware storage quota:
  - лимит читается из `SubscriptionPlan.limits_json.storage_mb`;
  - fallback defaults: `start=100 MB`, `growth=2048 MB`, `platform=10240 MB`;
  - загрузка файла блокируется до сохранения при превышении лимита.
- Audit для файлов:
  - upload пишет create audit;
  - download пишет `AuditLog.action=download`;
  - download помечается как `security / medium`.
- Settings usage UI показывает `Storage`.
- Обновлена storage-документация:
  - `docs/file-storage.md`.

Не добавлялось:

- реальный S3/Supabase Storage provider;
- antivirus scan;
- CDN;
- retention jobs;
- storage billing payments.

Проверки:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Phase 3 — Realtime Or Reliable Polling

Статус: **готово**.

Решение этапа: начать с reliable polling, не с WebSocket/SSE.

Добавлено:

- Единые polling intervals:
  - `frontend/src/lib/realtime.ts`
- Header notifications:
  - summary/list обновляются каждые 20 секунд;
  - refetch on focus/reconnect.
- Inbox:
  - conversation list обновляется каждые 12 секунд;
  - selected messages обновляются каждые 7 секунд;
  - refetch on focus/reconnect.
- Документация:
  - `docs/realtime-strategy.md`.

Не добавлялось:

- WebSocket;
- SSE;
- push notifications;
- typing indicators;
- live collaboration.

Проверки:

```bash
cd frontend && npm run build
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
```

### Phase 4 — Integration Foundation Hardening

Статус: **готово**.

Добавлено:

- Merchant connector foundation:
  - `BusinessConnector`;
  - `ConnectorCredential`;
  - `BusinessEvent`;
  - `ConnectorSyncRun`.
- API для коннекторов:
  - `GET /api/business-connectors/capabilities/`;
  - CRUD `/api/business-connectors/`;
  - `POST /api/business-connectors/{id}/health-check/`;
  - `POST /api/business-connectors/{id}/events/`;
  - CRUD `/api/connector-credentials/`;
  - read-only `/api/business-events/`;
  - read-only `/api/connector-sync-runs/`.
- Credentials safety:
  - raw secrets write-only;
  - API возвращает только `masked_value`;
  - encrypted/signed credential envelope на backend.
- Idempotent inbound events через `normalize_business_event`.
- Provider registry теперь явно отклоняет неизвестных providers.
- Django Admin для новых integration-моделей.
- Frontend:
  - `/dashboard/integrations`;
  - карточки capabilities;
  - сохранение секретов без повторного показа raw values;
  - health-check/recovery state.
- Документация:
  - `docs/integrations.md`.

Проверки:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Phase 5 — Queue-Backed Automation Runtime

Статус: **готово**.

Добавлено:

- `AutomationRun` стал полноценным runtime-record:
  - `idempotency_key`;
  - `attempts` / `max_attempts`;
  - `run_after`;
  - `next_retry_at`;
  - `locked_at`;
  - `action_results`.
- Idempotency:
  - повторное CRM-событие не создает duplicate run;
  - automation actions не дублируют задачи/уведомления.
- Celery-ready tasks:
  - `automations.process_automation_run`;
  - `automations.process_due_automation_runs`.
- Runtime mode:
  - `AUTOMATIONS_RUN_INLINE=True` для локальной работы без Redis/Celery;
  - `AUTOMATIONS_RUN_INLINE=False` для staging/production queue mode.
- Delayed/WAIT actions:
  - выставляют `run_after`;
  - не исполняются inline в HTTP request.
- Retry API:
  - `POST /api/automation-runs/{id}/retry/`.
- Frontend:
  - журнал запусков показывает attempts/retry time;
  - failed run можно перезапустить из UI.
- Документация:
  - `docs/automation-runtime.md`.

Проверки:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Phase 6 — Communication-First Onboarding

Статус: **готово**.

Добавлено:

- Onboarding теперь ведёт мерчанта к первому communication flow:
  - шаблон ниши;
  - первый канал;
  - первое сообщение;
  - клиент/заявка/inbox.
- Новые API:
  - `POST /api/onboarding/setup-channel/`;
  - `POST /api/onboarding/first-message/`.
- `setup-channel` создаёт:
  - active bot;
  - active bot channel;
  - `BusinessConnector`;
  - normalized `BusinessEvent`.
- `first-message` создаёт:
  - website conversation;
  - inbound message;
  - client;
  - lead;
  - handoff-required inbox state.
- Checklist дополнен пунктами:
  - первый канал;
  - первое сообщение.
- Frontend `/dashboard/onboarding` получил блоки:
  - “Первый канал”;
  - “Первое сообщение”;
  - переходы в Диалоги и Интеграции.
- Документация:
  - `docs/communication-onboarding.md`.

Проверки:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Phase 7 — Entitlements And Billing Enforcement

Статус: **готово**.

Добавлено:

- централизованный entitlement service:
  - `apps/billing/entitlements.py`;
  - `check_entitlement`;
  - `assert_entitlement_allows`;
  - `entitlement_summary`.
- Единые тарифные лимиты для:
  - пользователей;
  - ботов;
  - automation rules;
  - AI requests;
  - bot messages;
  - conversations;
  - storage.
- Backend enforcement в:
  - AI requests;
  - bot creation;
  - bot messages/conversations;
  - automation rule creation;
  - business member creation;
  - storage quota.
- Новый API:
  - `GET /api/billing/entitlements/`.
- Frontend `/dashboard/settings` показывает:
  - usage;
  - limit;
  - remaining quota.
- Документация:
  - `docs/entitlements.md`.

Проверки:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Phase 8 — E2E QA And Scale Baseline

Статус: **готово**.

Добавлено:

- Playwright setup:
  - `frontend/playwright.config.ts`;
  - `frontend/e2e/smoke.spec.ts`.
- Frontend scripts:
  - `npm run e2e`;
  - `npm run e2e:ui`.
- Idempotent seed command:
  - `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py prepare_e2e_smoke_data`.
- Smoke coverage:
  - platform admin login and `/platform`;
  - business owner login and core merchant pages;
  - merchant user cannot open `/platform`;
  - operator sees restricted settings section;
  - mobile dashboard -> calendar flow.
- Basic scale/load plan:
  - `docs/e2e-scale-baseline.md`.

Проверки:

```bash
cd frontend && npx playwright install chromium
cd frontend && npm run e2e
```

Последний E2E результат:

```text
9 passed, 1 intentionally skipped
```

### Phase 9 — Analytics / Reporting Depth

Статус: **готово**.

Добавлено:

- Reporting foundation:
  - `ReportWidget`;
  - `ScheduledReport`.
- Новые API:
  - `GET /api/analytics/reports/summary/`;
  - `GET /api/analytics/reports/export/`;
  - `/api/report-widgets/`;
  - `/api/scheduled-reports/`.
- Отчеты:
  - source ROI;
  - funnel velocity;
  - manager performance export;
  - retention/LTV estimates.
- Frontend `/dashboard/analytics` показывает:
  - операционные отчеты;
  - repeat rate;
  - LTV estimate;
  - stage velocity;
  - scheduled reports;
  - CSV export.
- Экспорт отчетов пишет audit log.
- Документация:
  - `docs/analytics-reporting.md`.

Проверки:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

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

Повторно сверено по `plan/zani_execution_prompts_from_13_05.md` как `01 — A1 Unified CRM Entity Drawer`: **готово и проверено 14.05.2026**.

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

### Prompt A3 — Duplicate Detection Foundation

Статус: **готово**.

Добавлено:

- Service-layer:
  - `normalize_phone(phone)`;
  - `normalize_email(email)`;
  - `find_duplicate_clients(...)`;
  - `merge_clients(...)`.
- Backend endpoints:
  - `POST /api/clients/check-duplicates/`;
  - `POST /api/leads/check-duplicates/`;
  - `POST /api/clients/{id}/merge/`.
- Duplicate detection:
  - работает только внутри выбранного `Business`;
  - нормализует телефон;
  - сравнивает email case-insensitive;
  - поддерживает channel ids: WhatsApp, Telegram, Instagram.
- Merge foundation переносит на target client:
  - leads;
  - appointments;
  - classic conversations;
  - bot conversations;
  - tasks;
  - deals;
  - notes;
  - activity events;
  - analytics events;
  - notifications.
- После merge duplicate client удаляется, а действие пишется в audit/activity log.
- Frontend:
  - `ClientForm` проверяет дубли по phone/email;
  - `LeadForm` предупреждает о похожем клиенте или существующей истории;
  - предупреждения не блокируют создание;
  - есть действие “Открыть существующего клиента”;
  - при редактировании клиента доступно базовое “Объединить в текущего”.

Не добавлялось:

- автоматическое объединение без подтверждения;
- сложный conflict-resolution UI;
- fuzzy matching по имени;
- фоновые задачи deduplication.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt A4 — Custom Fields Foundation

Статус: **готово**.

Добавлено:

- Модели:
  - `CustomFieldDefinition`;
  - `CustomFieldValue`.
- Field types:
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
- Django Admin для custom fields и values.
- Tenant-safe API:
  - `GET/POST /api/custom-fields/`;
  - `GET/POST /api/custom-field-values/`;
  - `GET /api/custom-fields/?entity_type=client`;
  - `POST /api/custom-field-values/bulk-upsert/`.
- CRM card payload теперь возвращает `custom_fields` для текущей сущности.
- Frontend:
  - Settings page получил simple field builder;
  - custom fields отображаются в CRM drawer;
  - значения custom fields можно редактировать и сохранять из drawer.

Не добавлялось:

- сложный form builder;
- conditional fields;
- permissions per field;
- advanced validation engine.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt A5 — Pipeline and Stage Engine Upgrade

Статус: **готово**.

Добавлено:

- `PipelineStage` расширен:
  - `required_fields_json`;
  - `allowed_roles_json`.
- `Deal` расширен:
  - `lost_reason`;
  - `won_at`;
  - `lost_at`;
  - `stage_entered_at`;
  - `next_action_at`.
- `/api/deals/{id}/move-stage/` усилен:
  - проверяет required fields;
  - проверяет allowed roles;
  - сохраняет `lost_reason`;
  - выставляет `won_at` / `lost_at`;
  - обновляет `stage_entered_at`;
  - пишет activity event.
- `DealSerializer` отдаёт `sla_overdue`.
- Новые endpoints:
  - `GET /api/pipelines/{id}/board/`;
  - `POST /api/pipelines/templates/apply/`.
- Template apply создаёт простую sales pipeline со стадиями и базовыми SLA/required fields.
- Frontend `DealsPage` улучшен без полного переписывания:
  - видны required fields на стадиях;
  - виден SLA overdue на deal cards;
  - lost stage запрашивает причину потери;
  - A1 drawer integration сохранён.

Не добавлялось:

- сложный визуальный stage builder;
- granular field-level permissions UI;
- прогнозирование SLA через AI;
- полная аналитика pipeline velocity.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt A6 — Owner Analytics Dashboard MVP

Статус: **готово**.

Добавлено:

- Backend endpoint:
  - `GET /api/analytics/owner-dashboard/`
- Метрики владельца:
  - `new_leads`;
  - `total_leads`;
  - `leads_by_source`;
  - `appointments_today`;
  - `appointments_completed`;
  - `no_show_count`;
  - `conversion_lead_to_appointment`;
  - `open_tasks`;
  - `overdue_tasks`;
  - `manager_response_time` placeholder;
  - `revenue_estimate`.
- Endpoint tenant-safe: merchant видит только свой business.
- Frontend:
  - `DashboardPage` грузит реальные owner metrics;
  - `AnalyticsPage` грузит реальные owner metrics;
  - сохранены простые lists последних лидов и ближайших записей;
  - добавлены source breakdown и блок “Что требует внимания”.

Не добавлялось:

- BI-графики;
- сложные cohorts;
- manager response time calculation;
- revenue из платежей.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt B1 — Inbox UX Polish

Статус: **готово**.

Повторно сверено по `plan/zani_execution_prompts_from_13_05.md` как `03 — B1 Inbox UX Polish`: **готово и проверено 14.05.2026**.

Добавлено:

- Backend inbox filters усилены:
  - `q` как alias для поиска;
  - `handoff_required=true/false`.
- Backend test покрывает поиск через `q` вместе с `handoff_required`.
- Frontend `ConversationsPage` улучшен без полного переписывания:
  - выбранный диалог сохраняется в URL через `?conversation=`;
  - добавлен фильтр handoff;
  - в header диалога видны handoff/unread indicators;
  - сообщения сгруппированы по датам;
  - `queued` / `failed` состояния сообщений отображаются прямо в bubble;
  - AI suggestion теперь вставляется в composer как черновик, а не только выводится notice;
  - context panel явно показывает linked client и linked lead state.

Не добавлялось:

- WebSocket/realtime;
- полноценная B5 conversation-first AI endpoint;
- WhatsApp production provider;
- полная Conversation → Deal linking логика.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt B5 — AI Reply Suggestions MVP

Статус: **готово**.

Сверено по `plan/zani_execution_prompts_from_13_05.md` как `04 — B5 AI Reply Suggestions MVP`: **готово и проверено 14.05.2026**.

Добавлено:

- Новый conversation-first endpoint:
  - `POST /api/inbox/conversations/{id}/suggest-reply/`
- Endpoint использует существующий AI service-layer и не создаёт второй AI-слой.
- AI context расширен:
  - последние сообщения диалога;
  - linked client data;
  - linked lead data, если есть;
  - AgentProfile;
  - BusinessKnowledgeItem через `run_ai_request`.
- Без `OPENAI_API_KEY` сохраняется mock response.
- Frontend inbox теперь вызывает inbox endpoint, а не legacy bot-conversation endpoint.
- AI suggestion вставляется в composer как черновик.
- Legacy endpoint сохранён:
  - `POST /api/bot-conversations/{id}/suggest-reply/`
- Backend tests покрывают:
  - новый inbox suggest endpoint;
  - client context в AI request log;
  - совместимость legacy bot endpoint.

Не добавлялось:

- auto-send AI replies;
- realtime streaming;
- OpenAI provider configuration UI;
- advanced prompt editor.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt B4 — Conversation to CRM Linking

Статус: **готово**.

Сверено по `plan/zani_execution_prompts_from_13_05.md` как `05 — B4 Conversation to CRM Linking`: **готово и проверено 14.05.2026**.

Добавлено:

- `BotConversation` получил связь со сделкой:
  - `deal`.
- Новая миграция:
  - `apps/bots/migrations/0004_botconversation_deal.py`.
- Inbox conversation serializer теперь отдаёт `deal`.
- Backend endpoints:
  - `POST /api/inbox/conversations/{id}/create-client/`;
  - `POST /api/inbox/conversations/{id}/link-client/`;
  - `POST /api/inbox/conversations/{id}/create-lead/`;
  - `POST /api/inbox/conversations/{id}/link-lead/`;
  - `POST /api/inbox/conversations/{id}/create-deal/`;
  - `POST /api/inbox/conversations/{id}/link-deal/`.
- `create-client` проверяет дубли через существующий duplicate service-layer.
- `create-deal` создаёт сделку на default pipeline/stage или создаёт простой pipeline/stage, если у бизнеса их ещё нет.
- `link-deal` подтягивает client/lead context из сделки, если в диалоге он ещё не заполнен.
- Frontend inbox context panel:
  - показывает linked client/lead/deal state;
  - умеет создать клиента;
  - умеет создать заявку;
  - умеет создать сделку;
  - умеет привязать client/lead/deal по ID.
- Backend tests покрывают:
  - duplicate warning при создании клиента из диалога;
  - link client;
  - forced create client;
  - create deal;
  - link deal.

Не добавлялось:

- полноценный search modal для выбора существующего client/lead/deal;
- complex duplicate merge UI внутри inbox;
- Conversation → classic `Conversation` model bridge;
- визуальный CRM card opening из context panel.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt C1 — RBAC/ABAC Foundation and Team Access

Статус: **готово**.

Сверено по `plan/zani_execution_prompts_from_13_05.md` как `10 — C1 RBAC/ABAC Foundation and Team Access`: **готово и проверено 14.05.2026**.

Добавлено:

- Расширен `BusinessMember` без поломки старых ролей:
  - `owner`;
  - `admin`;
  - `manager`;
  - `operator`;
  - `marketer`;
  - `accountant`;
  - `support`;
  - `staff`.
- Добавлены модели:
  - `RolePreset`;
  - `BusinessRole`;
  - `RolePermission`;
  - `Team`;
  - `TeamMember`.
- Добавлен service-layer `apps.businesses.access`:
  - `can(...)`;
  - `assert_can(...)`;
  - `scope_queryset(...)`;
  - `user_scope_for(...)`;
  - `effective_permissions_for(...)`;
  - default role presets;
  - dangerous action restrictions for billing/integrations/team.
- Добавлены team/access endpoints:
  - `/api/team/members/`;
  - `/api/team/roles/`;
  - `/api/team/role-permissions/`;
  - `/api/team/departments/`;
  - `/api/team/department-members/`;
  - `/api/team/permissions/catalog/`.
- `GET /api/auth/me/` теперь отдаёт:
  - memberships;
  - effective permissions per business.
- Settings получил:
  - `Team & Access`;
  - управление ролями сотрудников;
  - базовые отделы;
  - `Roles simple mode`.
- Permission changes пишутся в `AuditLog`.
- Миграция:
  - `apps/businesses/migrations/0002_rolepreset_alter_businessmember_role_businessrole_and_more.py`.

Не добавлялось:

- полное object-level ограничение всех CRM queryset по own/team scope;
- сложная technical permission matrix в UI;
- invite emails;
- SSO/SCIM;
- payroll/HR logic.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py migrate
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt C1.1 — Scoped CRM Querysets and Object-Level Permissions

Статус: **готово**.

Сверено по `plan/zani_execution_prompts_from_13_05.md` как `11 — C1.1 Scoped CRM Querysets and Object-Level Permissions`: **готово и проверено 14.05.2026**.

Добавлено:

- `TenantModelViewSet` теперь применяет RBAC/ABAC на backend:
  - list/retrieve через `view`;
  - create через `create`;
  - update/partial_update через `update`;
  - destroy через `delete`.
- Scoped queryset filtering подключен для ключевых CRM сущностей:
  - clients;
  - leads;
  - deals;
  - appointments;
  - tasks;
  - conversations;
  - analytics;
  - automations;
  - settings/custom fields.
- `scope_queryset(...)` теперь поддерживает own scope через поля:
  - `responsible_user`;
  - `assigned_to`;
  - `owner`;
  - `assignee`;
  - `created_by`;
  - `user`.
- Inbox actions защищены backend permissions:
  - send message;
  - assign;
  - handoff;
  - mark-read;
  - create/link client;
  - create/link lead;
  - create/link deal;
  - create task.
- Owner analytics endpoint проверяет `analytics.view` и использует scoped querysets.
- Billing usage/current subscription endpoint проверяет `billing.view`.
- Business settings update проверяет `settings.update`.
- Frontend sidebar скрывает разделы по `effective_permissions` из `/api/auth/me/`.
- Добавлены backend tests:
  - own-scope manager видит только свои deals;
  - operator не открывает owner analytics;
  - staff не открывает billing usage.

Не добавлялось:

- визуальный редактор сложной permission matrix;
- row-level policies на уровне PostgreSQL;
- exports permissions;
- invite flow;
- audit diff для каждого поля CRM.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt C1.2 — Soft Delete, Archive and Accountability Guardrails

Статус: **готово**.

Сверено по `plan/zani_execution_prompts_from_13_05.md` как `12 — C1.2 Soft Delete, Archive and Accountability Guardrails`: **готово и проверено 14.05.2026**.

Добавлено:

- Soft archive fields для критичных CRM сущностей:
  - Client;
  - Lead;
  - Deal;
  - Appointment;
  - Task;
  - Conversation;
  - BotConversation.
- Общий archive service-layer:
  - `archive_instance(...)`;
  - `restore_instance(...)`;
  - `can_hard_delete(...)`.
- `TenantModelViewSet` теперь:
  - скрывает archived records по умолчанию;
  - поддерживает `include_archived=true`;
  - добавляет `POST /archive/`;
  - добавляет `POST /restore/`;
  - превращает обычный `DELETE` в soft archive для archive-capable сущностей;
  - разрешает hard delete только owner/admin через `hard_delete=true`.
- Lead lost flow:
  - `lost_reason` обязателен;
  - фиксируются `lost_by`, `lost_at`, `previous_status`.
- Deal lost flow:
  - `lost_reason` обязателен;
  - фиксируются `lost_by`, `lost_at`, `previous_status`, `previous_stage`.
- Audit/activity пишутся при archive/restore/lost updates.
- Frontend:
  - CRUD API получил `archive(...)` и `restore(...)`;
  - Clients page использует archive вместо delete;
  - Appointments page использует archive вместо delete;
  - Leads kanban требует reason при переводе в lost;
  - Lead cards получили archive action.
- Backend tests покрывают:
  - manager archive вместо hard delete;
  - archived records скрыты по умолчанию;
  - owner restore;
  - lost lead требует reason и фиксирует актёра.

Не добавлялось:

- отдельная красивая reason modal вместо нативного prompt во всех местах;
- bulk archive;
- full archived records management screen;
- PostgreSQL RLS.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py migrate
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt B2 — Quick Replies and Templates

Статус: **готово**.

Сверено по `plan/zani_execution_prompts_from_13_05.md` как `13 — B2 Quick Replies and Templates`: **готово и проверено 15.05.2026**.

Добавлено:

- Backend model `QuickReplyTemplate` для tenant-safe быстрых ответов:
  - `business`;
  - `title`;
  - `text`;
  - `category`;
  - `channel`;
  - `sort_order`;
  - `is_active`.
- API:
  - `/api/quick-replies/`
  - фильтры по `channel`, `is_active`, `q`.
- Django Admin для quick replies.
- Inbox composer:
  - поиск по шаблонам;
  - фильтрация по каналу выбранного диалога;
  - вставка шаблона в draft;
  - шаблон не отправляется автоматически.
- Settings → Quick replies:
  - создание шаблона;
  - категория;
  - канал;
  - многострочный текст;
  - редактирование;
  - включение/отключение;
  - удаление.
- Backend test подтверждает tenant filtering quick replies.

Не добавлялось:

- автогенерация шаблонов через AI;
- массовый импорт/экспорт шаблонов;
- approval workflow для шаблонов;
- мультиязычные варианты шаблонов.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt C2 — Task Management Upgrade

Статус: **готово**.

Сверено по `plan/zani_execution_prompts_from_13_05.md` как `14 — C2 Task Management Upgrade`: **готово и проверено 15.05.2026**.

Добавлено:

- Backend task upgrade:
  - `parent_task`;
  - `watchers`;
  - `completed_by`;
  - `snoozed_until`;
  - `TaskComment`.
- API actions:
  - `POST /api/tasks/{id}/reopen/`;
  - `POST /api/tasks/{id}/snooze/`;
  - `POST /api/tasks/{id}/assign/`;
  - `POST /api/tasks/{id}/add-watcher/`;
  - `POST /api/tasks/{id}/add-comment/`;
  - `GET /api/tasks/{id}/comments/`.
- Task filters foundation:
  - `tab=my`;
  - `tab=today`;
  - `tab=overdue`.
- Existing status actions hardened with backend permission checks.
- Task completion now stores `completed_by`.
- Tasks page:
  - tabs: Мои, Сегодня, Просрочены, Команда;
  - task details modal;
  - comments;
  - assign-to-me;
  - watch task;
  - snooze task;
  - reopen completed/cancelled task.
- CRM drawer already shows linked tasks through the unified CRM card payload.
- Dashboard already surfaces open and overdue tasks through owner dashboard metrics.

Не добавлялось:

- heavy project management;
- complex dependencies graph;
- calendar sync;
- recurring task materialization;
- advanced watcher management UI by user picker.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py migrate
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt C3 — Automation Builder UI Simple Mode

Статус: **готово**.

Сверено по `plan/zani_execution_prompts_from_13_05.md` как `15 — C3 Automation Builder UI Simple Mode`: **готово и проверено 15.05.2026**.

Добавлено:

- Простой режим автоматизаций поверх существующего engine.
- Backend endpoint:
  - `GET /api/automation-rules/templates/`;
  - `POST /api/automation-rules/apply-template/`.
- Curated templates:
  - новая заявка -> задача менеджеру;
  - новая запись -> подготовить визит;
  - новое сообщение -> задача ответить.
- Применение шаблона создает:
  - `AutomationRule`;
  - связанные `AutomationAction`;
  - условия, если они появятся в шаблоне.
- Backend permission check через `automations.create`.
- Automations page:
  - блок шаблонов;
  - добавить черновик;
  - добавить и сразу включить;
  - включить/отключить существующее правило;
  - журнал последних запусков.
- Backend test подтверждает список шаблонов и применение шаблона.

Не добавлялось:

- advanced trigger-condition-action builder;
- preview/test-run UI;
- сложная визуальная canvas-схема;
- webhook delivery implementation.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt C4 — Automation Builder Advanced Mode

Статус: **готово**.

Сверено по `plan/zani_execution_prompts_from_13_05.md` как `16 — C4 Automation Builder Advanced Mode`: **готово и проверено 15.05.2026**.

Добавлено:

- Advanced builder после simple mode, без второго automation engine.
- Backend endpoints:
  - `POST /api/automation-rules/preview/`;
  - `POST /api/automation-rules/create-manual/`.
- Manual payload validation:
  - trigger validation;
  - condition rows;
  - action rows;
  - минимум одно действие;
  - запрет unsupported actions текущего engine.
- Поддержанные advanced actions:
  - `create_task`;
  - `create_notification`;
  - `wait`.
- `wait` подключен в engine как безопасный no-op/delay placeholder для будущего async исполнения.
- Preview возвращает:
  - валидность;
  - trigger summary;
  - количество условий;
  - количество действий;
  - steps для проверки перед сохранением.
- Frontend Automations page:
  - отдельный Advanced builder modal;
  - trigger selector;
  - condition rows;
  - action rows;
  - delay seconds;
  - JSON config для actions;
  - обязательный preview/test-run перед сохранением.
- Backend tests покрывают:
  - preview manual rule;
  - create manual rule;
  - invalid manual rule rejection.

Не добавлялось:

- canvas/drag-and-drop builder;
- реальное отложенное выполнение `wait` через Celery;
- webhook delivery;
- AI action execution;
- сложный visual debugger.

Проверено:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

### Prompt C1.3 — Department Analytics Visibility and Manager Accountability

Статус: **готово**.

Сверено по `plan/zani_execution_prompts_from_13_05.md` как `17 — C1.3 Department Analytics Visibility and Manager Accountability`: **готово и проверено 19.05.2026**.

Добавлено:

- Backend endpoint:
  - `GET /api/team/performance/`.
- Metrics:
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
- Filters foundation:
  - `business`;
  - `start`;
  - `end`;
  - `team`;
  - `manager`;
  - `source`;
  - `pipeline`.
- Visibility rules:
  - owner/admin see all active business members;
  - team lead sees own department/team;
  - manager/marketer/accountant with analytics permission see own metrics;
  - operator/staff without permission get `403`.
- Warning list:
  - lost без причины;
  - handoff просрочен;
  - чат без ответа;
  - задачи просрочены.
- Frontend Analytics page:
  - Team performance section;
  - totals cards;
  - employee cards;
  - warning list;
  - friendly forbidden state.
- Backend tests покрывают:
  - owner sees all;
  - team lead sees own team;
  - operator cannot open team performance.

Не добавлялось:

- тяжелый BI dashboard;
- точный response-time calculation;
- SLA by stage deepening;
- scheduled reports;
- exports.

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
  businesses/      # Business, BusinessMember, teams, RBAC/ABAC roles
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

Team & Access:

- `/api/team/members/`
- `/api/team/roles/`
- `/api/team/role-permissions/`
- `/api/team/departments/`
- `/api/team/department-members/`
- `/api/team/permissions/catalog/`

Import / Export:

- `GET /api/import-jobs/`
- `POST /api/import-jobs/`
- `POST /api/import-jobs/{id}/preview/`
- `POST /api/import-jobs/{id}/confirm/`
- `GET /api/export/clients/?business=`
- `GET /api/export/leads/?business=`
- `GET /api/export/deals/?business=`

Lead Forms:

- `GET/POST /api/lead-forms/`
- `POST /api/lead-forms/create-template/`
- `GET/POST /api/lead-form-fields/`
- `GET /api/lead-form-submissions/`
- `GET /api/public/forms/{public_id}/`
- `POST /api/public/forms/{public_id}/submit/`

### Prompt C1.4 — Security UX for Roles Without Bitrix Complexity

Что добавлено:

- В `Settings -> Команда и доступы` добавлен простой поток настройки: сотрудник -> preset role -> видимость.
- При смене роли сотруднику назначается совместимый `BusinessRole` preset, чтобы frontend-роль и backend permissions не расходились.
- Сырые permissions скрыты за кнопкой `Advanced`; первый экран показывает бизнес-смысл роли, а не техническую матрицу.
- Advanced-группы оформлены понятными блоками: Продажи, Клиенты, Чаты, Календарь, Задачи, Аналитика, Настройки, Экспорт, Безопасность.
- Уровни доступа показываются человеческими labels: нет доступа, только своё, своя команда, весь бизнес.
- Direct route access теперь защищён на frontend: если пользователь открыл скрытый раздел по URL, он видит понятный forbidden state с объяснением.
- Sidebar продолжает скрывать недоступные разделы по `effective_permissions`.

Что важно:

- Backend permission layer остаётся источником истины.
- Advanced-изменения роли применяются ко всем сотрудникам, использующим этот preset.
- Новый сотрудник по модели `BusinessMember` остаётся на безопасном default `staff`, если владелец не назначил другую роль.

### Prompt C5 — Manager Performance and SLA Deepening

Что добавлено:

- `/api/team/performance/` расширен без дублирования endpoint.
- Метрики по сотрудникам:
  - среднее время ответа в чатах;
  - contacted/closed/lost leads;
  - conversion lead -> appointment;
  - lost rate;
  - no-show appointments;
  - overdue handoffs;
  - missed chat handoffs;
  - overdue tasks;
  - SLA overdue deals;
  - won/lost deals.
- Добавлены team aggregates: показатели по отделам/командам для owner/admin и team lead scope.
- Добавлен `action_items` list: короткий список того, что руководителю нужно сделать прямо сейчас.
- `AnalyticsPage` получила расширенный Team Performance блок:
  - conversion/SLA/no-show;
  - manager cards;
  - team tab;
  - кликабельный action list.
- RBAC/visibility сохранены:
  - owner/admin видят команду;
  - team lead видит свою команду;
  - manager с analytics scope видит себя;
  - operator/staff не видят чужую аналитику.

Что не добавлялось:

- тяжёлый BI dashboard;
- прогнозирование SLA;
- realtime analytics;
- отдельный новый endpoint вместо уже существующего.

### Prompt C6 — Import and Export Foundation

Что добавлено:

- Модель `ImportJob` для истории импорта:
  - business;
  - actor;
  - entity_type;
  - source_file;
  - mapping_json;
  - preview_json;
  - duplicates_json;
  - status;
  - total/imported counters.
- CSV/XLSX upload foundation:
  - CSV работает из коробки;
  - XLSX поддерживается через `openpyxl` из `requirements.txt`;
  - если зависимость не установлена локально, ошибка появляется только при XLSX import, а не при старте Django.
- Controlled import flow:
  - upload;
  - mapping preview;
  - duplicate preview;
  - confirm import.
- На текущем этапе подтверждённый импорт создаёт клиентов.
- Duplicate preview использует существующий duplicate detection service.
- Export endpoints:
  - clients;
  - leads;
  - deals.
- Export проверяет permissions и пишет `AuditLog`.
- Settings page получила компактный блок `Import / Export`:
  - загрузка CSV/XLSX клиентов;
  - preview mapping;
  - duplicate count;
  - confirm import;
  - история последних import jobs;
  - CSV export clients/leads/deals.
- Миграция:
  - `apps/core/migrations/0003_importjob.py`.

Ограничение rollback:

- На этом foundation-этапе rollback не удаляет импортированные записи автоматически.
- Безопасная стратегия сейчас: импорт виден в истории, экспорт/импорт логируются в audit, ошибочные записи можно архивировать через существующий soft archive механизм.
- Полный rollback по job будет отдельным этапом, если понадобится массовый импорт для больших клиентских баз.

Что не добавлялось:

- массовый import leads/deals;
- сложный column mapping editor;
- background import через Celery;
- дедупликация с merge wizard во время импорта.

### Prompt D1 — Forms and Lead Capture

Что добавлено:

- Модели:
  - `LeadForm`;
  - `LeadFormField`;
  - `LeadFormSubmission`.
- Public endpoints:
  - `GET /api/public/forms/{public_id}/`;
  - `POST /api/public/forms/{public_id}/submit/`.
- Authenticated setup endpoints:
  - `/api/lead-forms/`;
  - `/api/lead-form-fields/`;
  - `/api/lead-form-submissions/`;
  - `POST /api/lead-forms/create-template/`.
- Public submit flow:
  - валидирует required fields;
  - собирает UTM fields;
  - проверяет дубли через существующий duplicate detection service;
  - переиспользует найденного клиента или создаёт нового;
  - создаёт `Lead`;
  - назначает default responsible user или owner бизнеса;
  - сохраняет `LeadFormSubmission`;
  - создаёт `AnalyticsEvent.form_submitted`;
  - создаёт activity event;
  - запускает automation trigger `lead_created`.
- Settings page получила блок `Формы заявок`:
  - создание формы из template;
  - список форм;
  - fields preview;
  - embed code;
  - последние submissions.
- Миграция:
  - `apps/leads/migrations/0003_leadform_leadformfield_leadformsubmission_and_more.py`.

Что не добавлялось:

- визуальный form builder;
- anti-spam/captcha;
- custom thank-you page;
- полноценный hosted public form frontend;
- A/B tests и analytics по конверсии форм.

### Prompt D2 — Tags and Smart Segments

Что добавлено:

- Расширен существующий tagging layer в `activities`, без второго параллельного механизма тегов.
- Новые модели:
  - `Segment`;
  - `SegmentFilter`.
- Segment filters поддерживают клиентов по:
  - имени;
  - телефону;
  - email;
  - источнику;
  - заметкам;
  - тегу;
  - дате создания.
- API:
  - `/api/tags/`;
  - `/api/tagged-objects/`;
  - `/api/segments/`;
  - `/api/segment-filters/`;
  - `GET /api/segments/{id}/evaluate/`;
  - `POST /api/segments/{id}/refresh-count/`.
- `/api/clients/` получил tenant-safe filters:
  - `q`;
  - `source`;
  - `tag`;
  - `segment`.
- CRM card теперь возвращает `tags`, а drawer показывает теги клиента.
- Clients page получила:
  - быстрый поиск;
  - фильтр по источнику;
  - фильтр по тегу;
  - фильтр по сохранённому сегменту;
  - быстрый add tag для клиента;
  - создание простого сегмента из UI.
- Сегменты имеют cached count и могут быть пересчитаны через API.
- Миграции:
  - `apps/activities/migrations/0002_segment_segmentfilter_and_more.py`;
  - `apps/activities/migrations/0003_alter_taggedobject_options.py`.

Что не добавлялось:

- сложный visual segment builder;
- nested AND/OR groups;
- outreach campaigns;
- AI auto-tagging;
- background refresh segment counts через Celery.

### Prompt D4 — Notification Center Upgrade

Что добавлено:

- Существующая модель `Notification` расширена без создания параллельной системы уведомлений.
- Новые поля:
  - `category`;
  - `priority`;
  - `action_url`;
  - `action_label`;
  - `read_at`.
- `client` теперь может быть пустым, чтобы поддерживать системные/командные уведомления без привязки к клиенту.
- Категории:
  - sales;
  - finance;
  - system;
  - ai_alerts;
  - outreach;
  - tasks.
- Приоритеты:
  - low;
  - normal;
  - high;
  - urgent.
- API:
  - filters: `status`, `channel`, `category`, `priority`, `unread`, `due`;
  - `POST /api/notifications/{id}/mark-read/`;
  - `POST /api/notifications/{id}/mark-unread/`;
  - `POST /api/notifications/mark-all-read/`;
  - расширенный `GET /api/notifications/summary/` с unread/urgent/category counters.
- Header notification dropdown обновлён:
  - unread badge;
  - grouped notifications по category;
  - priority chips;
  - action buttons с deep-link;
  - mark read;
  - mark all read;
  - mobile-friendly dropdown size.
- Старые reminder notifications продолжают работать через `status/channel/send_at`.
- Миграция:
  - `apps/notifications/migrations/0002_alter_notification_options_notification_action_label_and_more.py`.

Что не добавлялось:

- realtime WebSocket notifications;
- push notifications;
- email delivery provider;
- user-specific notification subscriptions;
- notification digest scheduler.

### Prompt D5 — Security and Audit Center

Что добавлено:

- Существующий `AuditLog` расширен без создания второй audit-системы.
- Новые поля `AuditLog`:
  - `category`;
  - `risk_level`.
- Новая модель `LoginHistory`:
  - business;
  - user;
  - email;
  - status;
  - ip;
  - user_agent.
- Login history пишется при JWT login:
  - successful login;
  - failed login.
- Добавлен ресурс прав `audit_logs`:
  - `view`;
  - `manage`.
- Owner/admin получают доступ через существующий wildcard manage.
- Custom roles могут получить явный `audit_logs.view`.
- Security API:
  - `GET /api/security/audit/`;
  - `GET /api/security/login-history/`;
  - `GET /api/security/risk-summary/`;
  - `/api/security/support-grants/`.
- Фильтры audit stream:
  - actor;
  - entity_type;
  - action;
  - risk;
  - category;
  - date_from/date_to.
- Support access grants:
  - создаются через owner/admin/audit manage;
  - пишут audit log с high risk.
- Risk inference:
  - export/permission/support access = high;
  - archive/restore/lost = medium;
  - delete/hard delete = critical;
  - обычные create/update = low.
- Settings page получила блок `Security center`:
  - high/critical counters;
  - failed login counter;
  - active support grants counter;
  - recent audit stream;
  - login history;
  - support grants.
- Миграция:
  - `apps/core/migrations/0004_loginhistory_auditlog_category_auditlog_risk_level_and_more.py`.

Что не добавлялось:

- полноценная SOC/SIEM интеграция;
- realtime security alerts;
- device fingerprinting;
- геолокация IP;
- принудительное MFA.

### Prompt B3 — WhatsApp Integration Foundation

Что добавлено:

- WhatsApp подключён через существующий provider layer, без привязки к paid provider.
- Новый `WhatsAppProvider` поддерживает:
  - `mock` mode;
  - `disabled` mode;
  - inbound webhook parsing;
  - outbound send abstraction;
  - запись outbound events в `IntegrationEventLog`.
- Новый service-layer `apps/integrations/whatsapp.py`:
  - проверка webhook secret;
  - резолв `BotChannel`;
  - создание/переиспользование `BotConversation`;
  - создание inbound `BotMessage`;
  - запись inbound `IntegrationEventLog`;
  - запуск automation trigger `bot_message_received`.
- API:
  - `POST /api/integrations/whatsapp/webhook/`;
  - `POST /api/bot-channels/{id}/whatsapp-config/`;
  - `GET /api/bot-channels/{id}/whatsapp-status/`;
  - `GET /api/integration-event-logs/`.
- Логи интеграций доступны tenant-safe:
  - фильтры `provider`, `channel`, `status`, `direction`;
  - merchant видит только логи своих businesses;
  - доступ идёт через `integrations.view`.
- BotDetail получил отдельный WhatsApp setup блок:
  - provider mode;
  - webhook secret;
  - phone number id;
  - webhook URL;
  - health/status;
  - inbound/outbound logs.
- Telegram provider сохранён и покрыт regression tests.

Что не добавлялось:

- Meta Cloud API / Wazzup / 360dialog credentials;
- реальные paid provider calls;
- WebSocket realtime status;
- retry queue через Celery.

### Prompt B6 — Attachments MVP

Что добавлено:

- Новая модель `FileAttachment`:
  - business;
  - uploaded_by;
  - private file;
  - original_name;
  - content_type;
  - size;
  - entity_type/entity_id;
  - visibility;
  - created_at.
- Файлы проходят через существующий `validate_file_upload`:
  - allowed extensions;
  - allowed content types;
  - max upload size.
- API:
  - `GET /api/file-attachments/`;
  - `POST /api/file-attachments/`;
  - `GET /api/file-attachments/{id}/download/`.
- Private download идёт через backend endpoint и object-level permission check.
- Поддержанные сущности:
  - client;
  - lead;
  - deal;
  - appointment;
  - task;
  - bot_conversation;
  - bot_message.
- Inbox получил upload button в composer.
- Вложения выбранного диалога отображаются в правом context panel.
- Вложения сообщений отображаются внутри message bubble, если файл привязан к `bot_message`.
- CRM drawer показывает вложения в overview клиента/сущности.
- Tenant isolation:
  - merchant не видит чужие файлы в списке;
  - merchant не может скачать файл чужого бизнеса;
  - forbidden extension отклоняется до сохранения.
- Миграция:
  - `apps/core/migrations/0005_fileattachment.py`.

Что не добавлялось:

- публичные file URLs;
- S3/Supabase credentials;
- thumbnail generation;
- virus scanning;
- per-plan storage quotas;
- audit on every download.

### Prompt D3 — Public API Tokens and Webhooks

Что добавлено:

- Новые integration-модели:
  - `ApiToken`;
  - `WebhookEndpoint`;
  - `WebhookDeliveryLog`.
- API tokens работают как scoped tokens:
  - raw token показывается только один раз;
  - в базе хранится hash и prefix;
  - unscoped token нельзя создать;
  - поддержаны rotate/revoke;
  - `last_used_at` обновляется при успешном использовании.
- Public API foundation:
  - `GET /api/public-api/clients/`;
  - доступ только по `X-Zani-Api-Key` или `Authorization: Bearer`;
  - scope `clients:read`;
  - tenant isolation: токен видит только данные своего `business`;
  - rate limit через DRF throttle scope `public_api`.
- Webhooks foundation:
  - endpoints с events list и signing secret;
  - delivery logs;
  - idempotency key;
  - attempts;
  - retry failed delivery;
  - dev URLs `mock://success` и `mock://fail` для безопасного тестирования без внешних сервисов.
- API:
  - `GET/POST /api/api-tokens/`;
  - `POST /api/api-tokens/{id}/rotate/`;
  - `POST /api/api-tokens/{id}/revoke/`;
  - `GET/POST /api/webhook-endpoints/`;
  - `POST /api/webhook-endpoints/{id}/test-delivery/`;
  - `GET /api/webhook-deliveries/`;
  - `POST /api/webhook-deliveries/{id}/retry/`.
- Settings получил отдельный блок `Developers`:
  - создание API token;
  - copy raw token once;
  - rotate/revoke token;
  - создание webhook endpoint;
  - copy webhook secret;
  - test delivery;
  - delivery logs;
  - retry failed delivery.
- Admin:
  - `ApiToken`;
  - `WebhookEndpoint`;
  - `WebhookDeliveryLog`.
- Security:
  - dangerous developer actions требуют `integrations.manage`;
  - operator не может управлять developer tokens/webhooks;
  - другой merchant не видит tokens/webhooks/deliveries чужого бизнеса.
- Миграция:
  - `apps/integrations/migrations/0002_webhookendpoint_webhookdeliverylog_apitoken_and_more.py`.

Что не добавлялось:

- OAuth2 app marketplace;
- публичная OpenAPI-документация;
- background retry через Celery;
- production webhook queue;
- write public API endpoints;
- per-token IP allowlist.

### Prompt D6 — Onboarding Templates by Niche

Что добавлено:

- Новый backend-модуль `apps.onboarding` без отдельной таблицы состояния:
  - шаблоны ниш хранятся как curated config;
  - checklist считается по реальным CRM-данным бизнеса;
  - demo flow создаёт реальные CRM-сущности.
- Поддержанные niche templates:
  - dentistry;
  - beauty;
  - sauna;
  - autoservice;
  - education;
  - medical;
  - other.
- Каждый шаблон включает:
  - pipeline stages;
  - услуги;
  - ресурсы;
  - общий график работы;
  - quick replies;
  - базовые automation rules/actions.
- API:
  - `GET /api/onboarding/templates/`;
  - `GET /api/onboarding/status/?business=`;
  - `POST /api/onboarding/apply-template/`;
  - `POST /api/onboarding/demo-data/`.
- `apply-template`:
  - обновляет `business_type`;
  - применяет структуру CRM;
  - не требует внешних сервисов;
  - работает tenant-safe через `settings.update`.
- `demo-data` создаёт первый рабочий сценарий:
  - demo client;
  - lead;
  - deal;
  - appointment;
  - task.
- Frontend:
  - новая страница `/dashboard/onboarding`;
  - пункт `Быстрый старт` в sidebar;
  - выбор шаблона ниши;
  - preview услуг/ресурсов/pipeline/replies;
  - кнопка применить шаблон;
  - кнопка создать demo flow;
  - setup checklist с progress percent;
  - dashboard показывает CTA, если быстрый старт не завершён.
- Permissions:
  - owner/admin могут применять шаблон;
  - operator не может применять onboarding template;
  - чужой merchant не может читать checklist другого бизнеса.

Что не добавлялось:

- отдельная таблица onboarding-сессий;
- сложный multi-step form builder;
- AI-generated onboarding;
- paid provider setup;
- email/SMS wizard.

### Prompt D7 — Mobile-First Polish Pass

Что улучшено:

- Общий mobile overflow guard:
  - `html`, `body`, `#root` больше не дают горизонтальный scroll из-за случайного широкого блока.
- `Modal`:
  - на mobile открывается как bottom-friendly panel;
  - высота ограничена `100dvh`;
  - header закреплён сверху;
  - title не ломает layout;
  - close target остаётся крупным.
- `CrmEntityDrawer`:
  - на mobile занимает полный экран без странного левого радиуса;
  - desktop drawer сохранил rounded left style.
- `GlobalSearch`:
  - mobile results теперь fixed относительно viewport;
  - popup не вылезает за экран из-за вложенного absolute контейнера.
- `MobileNav`:
  - увеличены touch targets;
  - подписи центрируются и не распирают кнопку;
  - нижняя навигация стала чуть плотнее и стабильнее.
- `PageHeader`:
  - длинные заголовки переносятся;
  - action area на mobile занимает доступную ширину и не создаёт горизонтальный overflow.

Что не делалось:

- полный визуальный редизайн всех страниц;
- ручная проверка каждого device/browser;
- изменение бизнес-логики CRM;
- замена kanban/inbox/calendar layout.

### Prompt D8 — Final Competitive QA Pass

Что добавлено:

- Создан финальный competitive QA report:
  - `docs/competitive-regression-report.md`.
- Отчёт проверяет ключевые зоны:
  - CRM core;
  - clients/leads/appointments;
  - deals/pipelines/kanban;
  - CRM card;
  - inbox/conversations;
  - tasks;
  - RBAC;
  - audit/security;
  - notifications;
  - automations;
  - analytics;
  - import/export;
  - custom fields;
  - tags/segments;
  - integrations;
  - public API/webhooks;
  - file storage;
  - onboarding;
  - platform admin;
  - billing;
  - mobile UX;
  - production infra;
  - realtime.
- Каждая зона классифицирована как:
  - Ready;
  - Partial;
  - Gap;
  - Stronger-than-competitors opportunity.
- Зафиксированы critical gaps для 10,000 merchants:
  - production infrastructure;
  - storage readiness;
  - realtime layer;
  - automation runtime hardening;
  - provider production contracts;
  - reporting depth;
  - e2e QA;
  - performance/load testing;
  - data lifecycle;
  - entitlement enforcement.
- Зафиксированы next critical tasks и архитектурные запреты.

Проверки:

- последний backend suite: `176 tests OK`;
- последний frontend build: `npm run build OK`;
- последний E2E smoke: `9 passed, 1 intentionally skipped`;
- `manage.py check OK`.

### Phase 10 — UI/UX Competitive Polish

Статус: **готово**.

Добавлено:

- role-aware dashboard:
  - owner/admin видят управленческие KPI, конверсию и выручку;
  - operator/staff видят рабочий фокус на заявках, чатах, задачах и записях.
- Settings разбиты быстрыми секциями-якорями, чтобы не искать team/security/billing/custom fields в длинной странице.
- CRM drawer получил inline-edit для статусов и заметок заявок, сделок и записей.
- Mobile polish:
  - inbox composer стал закрепленным и удобным для длинных ответов;
  - quick replies в inbox стали горизонтальной лентой;
  - kanban заявок получил snap-scroll колонки;
  - calendar date picker стал нормального размера на телефоне.
- Integrations cards получили recommended next step.
- Onboarding copy стал ближе к рабочему сценарию первого запуска.
- Документация:
  - `docs/ui-ux-polish-phase-10.md`.

Проверки:

- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test OK` — `176 tests`;
- `cd frontend && npm run build OK`;
- `cd frontend && npm run e2e OK` — `9 passed, 1 intentionally skipped`.

### Production Readiness Audit For 10,000 Merchants

Статус: **готово**.

Добавлено:

- backend audit service:
  - `apps/core/production_audit.py`;
  - проверяет env/security/database/queue/storage/observability/email/rate-limits.
- management command:
  - `python manage.py production_readiness_audit`;
  - `python manage.py production_readiness_audit --format=json`;
  - `python manage.py production_readiness_audit --fail-on-critical`.
- тесты:
  - critical failures для unsafe production settings;
  - command failure mode;
  - JSON output.
- Документация:
  - `docs/production-readiness-10000-audit.md`;
  - обновлен `docs/production-readiness.md`.

Проверки:

- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py production_readiness_audit OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.core.tests_production_audit OK`.
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test OK` — `179 tests`;
- `cd frontend && npm run build OK`;
- `cd frontend && npm run e2e -- --project=desktop-chromium OK` — `4 passed, 1 skipped`.

### CI/CD And Staging Gate

Статус: **готово**.

Добавлено:

- GitHub Actions workflow:
  - `.github/workflows/ci.yml`;
  - backend migration check, system check, production audit JSON smoke and tests;
  - frontend `npm ci` and `npm run build`.
- Local CI script:
  - `scripts/check_local_ci.sh`.
- Staging checklist:
  - `docs/staging-ci-cd-checklist.md`.
- `docs/deployment.md` теперь ссылается на staging/CI checklist и local CI command.

Проверки:

- `bash -n scripts/check_local_ci.sh OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test OK` — `179 tests`;
- `cd frontend && npm run build OK`;
- workflow YAML добавлен без secrets и без production credentials.

### Production Env Templates And Provider Selection

Статус: **готово**.

Добавлено:

- backend env templates:
  - `.env.staging.example`;
  - `.env.production.example`.
- frontend env templates:
  - `frontend/.env.staging.example`;
  - `frontend/.env.production.example`.
- `.gitignore` теперь разрешает tracked env templates, но продолжает игнорировать реальные `.env.*`.
- Provider selection doc:
  - `docs/staging-provider-selection.md`.
- Обновлены:
  - `docs/deployment.md`;
  - `docs/staging-ci-cd-checklist.md`;
  - `docs/production-readiness-10000-audit.md`.

Рекомендованный staging stack:

- Supabase Postgres или Neon;
- Upstash Redis или Redis Cloud;
- Supabase Storage или Cloudflare R2;
- Cloudflare Pages или Vercel для frontend;
- Render/Railway/Fly.io/DigitalOcean App Platform для Django/Celery;
- Sentry;
- Resend/Postmark/SendGrid.

Проверки:

- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test OK` — `179 tests`;
- `cd frontend && npm run build OK`.

### Staging Deployment Smoke Kit

Статус: **готово**.

Добавлено:

- Production-like smoke script:
  - `scripts/staging_smoke.sh`.
- Staging Playwright config:
  - `frontend/playwright.staging.config.ts`;
  - `npm run e2e:staging`.
- Staging smoke runbook:
  - `docs/staging-smoke-runbook.md`.
- Обновлены:
  - `docs/deployment.md`;
  - `docs/staging-ci-cd-checklist.md`;
  - `docs/staging-provider-selection.md`.

Smoke проверяет:

- health/readiness endpoints;
- CORS preflight from deployed frontend origin;
- platform admin login and `/api/platform/ping/`;
- merchant owner login and core merchant API;
- frontend root response and `/login` SPA rewrite response.
- deployed browser smoke for platform, owner, operator and mobile flows.

Latest Render staging execution report:

```text
docs/staging-render-execution-report.md
```

Пример запуска:

```bash
API_BASE_URL=https://api-staging.zani.example \
FRONTEND_URL=https://app-staging.zani.example \
PLATFORM_ADMIN_EMAIL=platform_admin@example.com \
PLATFORM_ADMIN_PASSWORD='***' \
MERCHANT_OWNER_EMAIL=business_owner@example.com \
MERCHANT_OWNER_PASSWORD='***' \
scripts/staging_smoke.sh
```

Browser staging smoke:

```bash
cd frontend
E2E_BASE_URL=https://app-staging.zani.example \
E2E_PLATFORM_EMAIL=platform_admin@example.com \
E2E_OWNER_EMAIL=business_owner@example.com \
E2E_OPERATOR_EMAIL=business_operator@example.com \
E2E_PASSWORD='***' \
npm run e2e:staging
```

Проверки:

- `bash -n scripts/staging_smoke.sh OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test OK` — `179 tests`;
- `cd frontend && npm run build OK`;
- `cd frontend && npm run e2e -- --project=desktop-chromium OK` — `4 passed, 1 skipped`.

### Rate Limit And Abuse Guardrails

Статус: **готово**.

Добавлено:

- Scoped throttles для публичного периметра:
  - public lead forms;
  - website chat/widget;
  - Telegram/WhatsApp webhooks;
  - public API tokens;
  - AI assistant.
- Новые env-переменные:
  - `PUBLIC_FORM_RATE`;
  - `PUBLIC_WIDGET_RATE`;
  - `INTEGRATION_WEBHOOK_RATE`;
  - `AI_ASSISTANT_RATE`.
- Production audit теперь проверяет наличие всех обязательных throttle scopes.
- Документация:
  - `docs/rate-limits.md`.

Проверки:

- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.core.tests_rate_limits OK`.
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py production_readiness_audit OK` — `api.rate_limits PASS`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test OK` — `181 tests`;
- `cd frontend && npm run build OK`.

### Render Docker Deploy Fix

Статус: **готово**.

Исправлено:

- `Dockerfile` теперь использует `${PORT:-8000}`, который Render передает в runtime.
- Web startup выполняет:
  - `python manage.py migrate`;
  - `python manage.py collectstatic --noinput`;
  - `gunicorn config.wsgi:application`.
- Добавлен `.dockerignore`, чтобы локальный `.env`, SQLite, media, node modules и build artifacts не попадали в Docker image.
- Обновлен `docs/deployment.md` с Render-specific env checklist.

Проверки:

- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py production_readiness_audit OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.core.tests_rate_limits apps.core.tests_production_audit OK`.

### Render Supabase Env Builder

Статус: **готово**.

Добавлено:

- Django теперь может собрать Postgres URL из понятных `SUPABASE_*` переменных, если `DATABASE_URL` пустой.
- Пароль Supabase автоматически URL-encode, поэтому спецсимволы в database password не ломают connection string.
- Восстановлены env templates:
  - `.env.example`;
  - `.env.staging.example`;
  - `.env.production.example`.
- `frontend/.env.staging.example` указывает на текущий Render backend:
  - `https://zani-9lnp.onrender.com`.
- `docs/deployment.md` обновлен под Render + Supabase split env.

Для Render можно использовать:

```env
DATABASE_URL=
SUPABASE_PROJECT_REF=jjpenskqmomrbjqofbss
SUPABASE_DB_PASSWORD=<database-password-not-anon-key>
SUPABASE_DB_CONNECTION_MODE=pooler
SUPABASE_DB_POOLER_HOST=<copy-from-supabase-transaction-pooler>
SUPABASE_DB_PORT=6543
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres.jjpenskqmomrbjqofbss
```

Проверки:

- `env DATABASE_URL='' SUPABASE_* ... .venv/bin/python manage.py check OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run OK`;
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.core.tests_rate_limits apps.core.tests_production_audit OK`.

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

## Локальные тестовые аккаунты

Для просмотра frontend, ролей и бизнес-логик в локальной SQLite-базе подготовлены тестовые аккаунты.

Общий пароль:

```text
ZaniTest123!
```

Аккаунты:

- `platform_admin@example.com` — platform admin, superuser/staff, доступ к Django Admin и `/platform`.
- `business_owner@example.com` — владелец бизнеса `Zani Demo Business`, membership `owner`, видит все реализованные merchant-разделы и функции.
- `business_operator@example.com` — оператор бизнеса `Zani Demo Business`, global role `business_operator`, membership `operator`, видит только ограниченный рабочий набор: clients, leads, conversations, tasks.

В `Zani Demo Business` добавлены минимальные demo-данные для проверки UI:

- клиент;
- услуга;
- ресурс;
- рабочее время;
- заявка;
- сделка;
- запись;
- задача;
- WhatsApp bot channel в mock mode;
- тестовый WhatsApp conversation/message.

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


### Block 8 — Pilot smoke demo merchant

Added `python manage.py seed_pilot_demo --reset` to create a full demo merchant for local/staging pilot smoke checks: activation, CRM Light, leads, sales events, dashboard pulse, inbox handoff, AI task, notification and quick replies. See `docs/block8-pilot-smoke-demo.md`.

### Pilot Tech Plan — Block 10: Clean Pilot Package / Production Readiness

Status: **готово**.

Добавлено:

- `scripts/pilot_smoke_check.sh` — единая локальная smoke-проверка пилотного пакета.
- Усилен `scripts/make_clean_archive.sh`: архив исключает `.venv`, `node_modules`, build outputs, local DB, logs, reports, cache files, media/static outputs and nested zip files.
- `docs/block10-clean-pilot-package.md` — runbook пилотного пакета, команды запуска, demo path, readiness criteria.
- `docs/block11-pilot-smoke-cleanup.md` — ускоренный smoke-check: один backend test pack, idempotent demo seed reset, optional frontend build.
- `docs/pilot-safe-promises.md` — границы обещаний для маркетинга/пилота.

Проверка:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
./scripts/pilot_smoke_check.sh
./scripts/make_clean_archive.sh zani-pilot-clean.zip
```

Важно: billing/trial/tariff limits и Pilot QA polish сознательно перенесены на следующие этапы.

### Block 12 — Pilot Operations / Internal Control Panel

Internal platform views now show pilot operations health: attention merchants, form errors, handoff conversations, failed connectors, per-merchant health score, blockers, next action, latest activity and operational counts. This helps control the first 10–50 pilot merchants without adding billing or external production integrations. See `docs/block12-platform-operations-panel.md`.

### Block 14 — Pilot Demo Launch

Prepare a full demo launch pack with one command:

```bash
python manage.py prepare_pilot_demo --reset
```

Default logins:

- Platform admin: `platform@zani.local / Platform123!`
- Demo owner: `demo-owner@zani.local / DemoOwner123!`
- Demo manager: `demo-manager@zani.local / DemoManager123!`

See `docs/block14-pilot-demo-launch.md`.

---

## Local run without Docker

Some Mac machines cannot run Docker Desktop because of CPU/virtualization compatibility. Zani can still be checked locally without Docker by using SQLite fallback for development checks.

### One-command local backend setup

```bash
./scripts/setup_local_without_docker.sh
```

This script:
- creates `.venv` if needed;
- installs Python dependencies;
- creates `.env` from `.env.local.example` if `.env` does not exist;
- uses local SQLite (`db.sqlite3`) for smoke checks;
- runs migrations and `manage.py check`.

### Run backend

```bash
source .venv/bin/activate
python manage.py runserver 0.0.0.0:8000
```

### Run frontend

```bash
cd frontend
npm ci
npm run dev
```

### Run full local checks without Docker

```bash
./scripts/check_local_without_docker.sh
```

This runs:
- migrations check;
- Django system check;
- backend tests;
- frontend production build;
- widget build.

### Production/staging note

SQLite mode is only for local smoke checks. Production/staging must use PostgreSQL through `DATABASE_URL`.

---

## Corrected Pilot/Core Roadmap Progress

### Task 1 — Route / Navigation / Broken Flow Audit

- Canonical merchant routes live under `/dashboard/*`; legacy `/clients`, `/leads`, `/appointments`, `/deals`, `/tasks`, `/ai` routes now remain safe.
- Global search results now open canonical dashboard pages.
- Platform merchants list links to `/platform/merchants/:id`.
- Added platform merchant support/detail placeholder with merchant health, operations, landing context and support action logging.
- Playwright route smoke tests cover merchant, public and platform routes.

Checks:

```bash
cd frontend && npm run build
cd frontend && npm run e2e -- --project=desktop-chromium
```

### Task 2 — Calendar / Appointments / Tasks Flow Completion

- Calendar now has day/week/month views without heavy drag-and-drop.
- Calendar appointments can be opened, linked to client/lead context and updated with quick statuses.
- Appointments table has quick status actions in addition to edit/archive.
- Tasks quick-create now supports client, lead, deal and appointment links.
- Task cards expose linked CRM objects as clickable dashboard links and show user-friendly create errors.

Check:

```bash
cd frontend && npm run build
```

### Task 3 — Pilot Demo Data / Onboarding / Readiness Checklist

- Pilot readiness statuses are normalized to `ready`, `needs_attention`, `missing`.
- Readiness checklist now includes CRM configured and working-hours checks.
- AI Assistant readiness links to `/dashboard/ai-assistant`.
- Onboarding demo-data flow is covered for deal/task/appointment linkage.
- `seed_pilot_demo` now runs the onboarding demo-data flow so demo merchants include a connected CRM/calendar/task scenario.

Required QA gate before Task 4:

```bash
python manage.py check
python manage.py test apps.scheduling apps.tasks apps.onboarding apps.core --verbosity=1
cd frontend && npm run build
```

### Task 4 — Connector UX Layer Without Exposing API

- Merchant-facing `/dashboard/integrations` now shows business statuses (`available`, `connected`, `setup_required`, `pending_request`, `coming_soon`, `unavailable_on_plan`, `error`, `disconnected`) instead of raw backend/debug states.
- CRM UI no longer exposes API tokens, webhook secrets, access tokens, provider internals or health-check controls.
- Request connectors create safe internal connector records without enabling real external APIs.
- Connected connectors explain business impact: CRM, Inbox, analytics and automations.

Check:

```bash
cd frontend && npm run build
```

### Task 5 — Excel/CSV Real Data Connector MVP

- Excel/CSV import flow is now available directly inside `/dashboard/integrations`.
- Supported pilot import types: clients, leads, sales, products/services/stock via catalog.
- Upload flow shows preview, column mapping, duplicate count, row errors and import history.
- Leads import now creates real `Client` + `Lead` records.
- Sales and catalog imports continue writing scoped `BusinessEvent` records; service rows can create/update `Service`.

Checks:

```bash
python manage.py test apps.core.tests_import_export --verbosity=1
cd frontend && npm run build
```

### Task 6 — Website Chat E2E + Inbox Consistency

- `/dashboard/integrations` now has a dedicated Website Chat panel with channel status, public widget token, install snippet, test visitor message and link to Inbox.
- Website Chat setup is merchant-facing: it exposes only the public widget token/snippet and keeps provider secrets out of CRM UI.
- The panel documents the source of truth: channel Inbox uses `BotConversation` and `BotMessage`; legacy `Conversation`/`Message` remains untouched.
- Added an end-to-end backend test for public website chat → client/lead/message creation → Inbox visibility → manager reply → unread/read state.
- Frontend widget bundle is verified by build output at `frontend/dist/widget/zani-widget.js`.

Checks:

```bash
python manage.py test apps.bots --verbosity=1
cd frontend && npm run build
```

### Task 7 — Telegram Connector Ready MVP

- `/dashboard/integrations` now includes a Telegram beta wizard with BotFather instructions, password token input, webhook URL and status visibility.
- Telegram bot token/webhook secret are accepted only through password fields and are masked in `BotChannel` API responses after saving.
- Added controlled `telegram-test-connection` endpoint: real `getMe` when `TELEGRAM_ENABLED=true`, safe mock result in dev/staging.
- Existing Telegram webhook/provider path remains compatible and inbound updates continue creating `BotConversation` + `BotMessage` for Inbox.
- Added tests for masked token response and controlled mock token validation.

Checks:

```bash
python manage.py test apps.integrations apps.bots --verbosity=1
cd frontend && npm run build
```

### Task 8 — WhatsApp / Instagram Request-Ready Connectors

- `/dashboard/integrations` now includes explicit WhatsApp and Instagram request forms instead of pretending that Meta APIs connect automatically.
- WhatsApp request captures company, phone, contact, preferred connection type and comment.
- Instagram request captures username, optional Facebook Page, contact and comment; the UI never asks for an Instagram password.
- Request submissions create/update `BusinessConnector` records in `needs_attention` / `pending_request` state so Platform support can see them.
- Added provider adapter placeholders for WhatsApp Meta/Twilio/360dialog/QR pilot and Instagram Meta.
- Platform merchant detail now displays pending connector requests alongside connected/failed connectors.

Checks:

```bash
python manage.py test apps.integrations --verbosity=1
cd frontend && npm run build
```

### Task 9 — Kaspi / 1C / MoySklad / Marketplace Lightweight Connector Foundation

- `/dashboard/integrations` now includes a lightweight data connector panel for Kaspi, 1C, МойСклад, Wildberries, Ozon and Яндекс.Маркет.
- Each connector has a safe request/update flow and clear copy: read-only/request/import foundation only, no realtime ERP, write-back, accounting or repricing.
- Existing requested connectors can write mock `BusinessEvent` records for future sync event types such as `order_imported`, `product_imported`, `stock_level_imported` and `connector_sync_completed`.
- Kaspi connector request + mock event flow is covered by backend tests.
- Platform support sees pending connector requests via merchant operations counts.

Checks:

```bash
python manage.py test apps.integrations --verbosity=1
cd frontend && npm run build
```

### Task 10 — Final Core Pilot Regression / Clean Package

- Full backend regression is green: all Django tests pass.
- Frontend production build is green, including the public Website Chat widget bundle.
- Playwright smoke regression covers platform login, merchant CRM routes, platform merchant detail, protected route behavior and mobile smoke skip policy.
- Clean-package check confirmed local generated artifacts are ignored by `.gitignore`: `.venv`, `frontend/node_modules`, `frontend/dist`, `.env` and `db.sqlite3` must stay out of source commits/deploy source.
- Pilot scope remains honest: connector UIs are request/import-ready foundations; real WhatsApp, Instagram, Kaspi, 1C, marketplace and repricing integrations are intentionally not enabled in this core pilot.

Checks:

```bash
python manage.py check
python manage.py test --verbosity=1
cd frontend && npm run build
cd frontend && npm run e2e -- --project=desktop-chromium
```

### Production Hardening Roadmap — Next Phase

- Added the next execution roadmap: `plan/ZANI_PRODUCTION_HARDENING_ROADMAP.md`.
- The next implementation direction is `Phase H1 — Redis / Celery Runtime On Render`.
- Restored safe staging/production env templates:
  - `.env.staging.example`;
  - `.env.production.example`;
  - `frontend/.env.staging.example`;
  - `frontend/.env.production.example`.
- `.gitignore` now keeps real env files ignored while allowing only these example templates.

Doc-only check:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
cd frontend && npm run build
```

### Phase H1 — Redis / Celery Runtime On Render

- Added queue runtime smoke command:
  - `python manage.py queue_runtime_smoke --business-id <business_id> --timeout 45`;
  - optional cleanup: `--cleanup`.
- The smoke creates an `AutomationRun`, dispatches `automations.process_automation_run` to the `automations` queue and verifies that a worker creates the expected task.
- Added env controls for Celery eager mode:
  - `CELERY_TASK_ALWAYS_EAGER`;
  - `CELERY_TASK_STORE_EAGER_RESULT`.
- Production readiness audit now accepts both `redis://` and TLS `rediss://` Redis URLs.
- Added Render worker setup docs in `docs/celery-render-runtime.md`.
- Staging/production env templates now include queue runtime flags.

Checks:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.automations apps.core.tests --verbosity=1
cd frontend && npm run build
```

### Phase H2 — Object Storage Production Switch

- Added storage runtime smoke command:
  - `python manage.py storage_runtime_smoke --business-id <business_id>`;
  - optional cleanup: `--cleanup`.
- The smoke creates a tiny private `FileAttachment`, writes it through the active Django storage backend and verifies the object exists.
- Documented business-scoped private object keys:
  - `private/attachments/business-{business_id}/{filename}`.
- Updated `docs/file-storage.md` with S3-compatible provider setup, smoke checks and production cutover checklist.
- Staging/production env templates already include S3-compatible storage variables.

Checks:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.core.tests_storage_runtime apps.core.tests_file_attachments --verbosity=1
```

### Phase H3 — Sentry / Error Monitoring

- Added observability runtime check command:
  - `python manage.py observability_runtime_check`;
  - `python manage.py observability_runtime_check --fail-on-missing`;
  - `python manage.py observability_runtime_check --capture-test-message`.
- The command verifies environment/release, Sentry configuration and can send a safe smoke message without merchant/customer payload.
- Backend Sentry setup uses `send_default_pii=False`.
- Added `docs/observability.md`.
- Added Render smoke script:
  - `scripts/render_h3_observability_smoke.sh`;
  - optional event capture: `CAPTURE_SENTRY_SMOKE=true scripts/render_h3_observability_smoke.sh`.
- Staging/production runtime check now requires a real `RELEASE` value instead of `local`.
- Sentry smoke events use safe tags and do not include merchant/customer payloads.

Checks:

```bash
bash -n scripts/render_h3_observability_smoke.sh
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.core.tests_observability apps.core.tests_production_audit --verbosity=1
```

### Phase H4 — Transactional Email

- Added provider-neutral email helper in `apps.notifications.email`.
- Added email runtime smoke command:
  - `python manage.py email_runtime_smoke`;
  - `python manage.py email_runtime_smoke --fail-on-missing`;
  - `python manage.py email_runtime_smoke --send --to owner@example.com`.
- Added Render smoke script:
  - `scripts/render_h4_email_smoke.sh`;
  - optional real smoke email: `SEND_EMAIL_SMOKE=true EMAIL_SMOKE_TO=owner@example.com scripts/render_h4_email_smoke.sh`.
- The Render script rejects staging/production deploys that still use local/mock email backends.
- The smoke email contains no merchant/customer data.
- Added `docs/transactional-email.md`.

Checks:

```bash
bash -n scripts/render_h4_email_smoke.sh
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.notifications.tests_email apps.core.tests_production_audit --verbosity=1
```

### Phase H5 — Backup / Restore Drill

- Added backup readiness service and command:
  - `python manage.py backup_restore_readiness_check`;
  - `python manage.py backup_restore_readiness_check --format=json`;
  - `python manage.py backup_restore_readiness_check --fail-on-blockers`.
- Added Render/CI gate:
  - `scripts/render_h5_backup_readiness.sh`.
- The command verifies paid-beta backup prerequisites: managed PostgreSQL, object storage, bucket config and explicit environment naming.
- Updated `docs/backup-restore.md` with readiness checks and incident communication template.
- H5 remains environment-dependent until a real restore is rehearsed into a separate staging database and RTO/RPO is recorded.

Checks:

```bash
bash -n scripts/render_h5_backup_readiness.sh
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.core.tests_backup_readiness --verbosity=1
```

### Phase H6 — Load / Scale Baseline

- Added dependency-free API load smoke script:
  - `python scripts/api_load_smoke.py --api-base-url <url> --email <email> --password <password> --iterations 5`.
- The script logs in and measures auth/me, businesses, clients, leads, deals, tasks, appointments, inbox, integrations and billing usage summary.
- Output is JSON with min/avg/p95/max per endpoint, timestamps and total request count.
- Added output-file support for preserving baseline artifacts.
- Added Render/staging wrapper:
  - `scripts/render_h6_load_baseline.sh`.
- Updated `docs/e2e-scale-baseline.md` with staging examples, first p95 threshold guidance, a risk register and measurement log template.

Checks:

```bash
chmod +x scripts/render_h6_load_baseline.sh
bash -n scripts/render_h6_load_baseline.sh
python -m py_compile scripts/api_load_smoke.py
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.core.tests_api_load_smoke --verbosity=1
cd frontend && npm run build
```

### Phase H7 — Provider Rollout Sequence

- Added provider rollout readiness service:
  - `apps.integrations.provider_rollout`.
- Added provider rollout command:
  - `python manage.py provider_rollout_readiness_check`;
  - `python manage.py provider_rollout_readiness_check --provider telegram --fail-on-blockers`;
  - `python manage.py provider_rollout_readiness_check --format=json`.
- The command checks the approved rollout order:
  - Telegram real webhook;
  - Website widget/public forms;
  - transactional email;
  - OpenRouter/OpenAI behind queue and usage limits;
  - WhatsApp pilot;
  - Instagram/Meta pilot;
  - Kaspi/marketplace/1C later.
- Telegram real mode is blocked until webhook secret, queue runtime and observability gates pass.
- WhatsApp and Instagram real env flags are blocked while current adapters are pilot/request-only.
- Added Render/deploy wrapper:
  - `scripts/render_h7_provider_rollout_check.sh`;
  - provider-specific mode: `PROVIDER=telegram scripts/render_h7_provider_rollout_check.sh`.
- Added docs:
  - `docs/provider-rollout.md`.

Checks:

```bash
chmod +x scripts/render_h7_provider_rollout_check.sh
bash -n scripts/render_h7_provider_rollout_check.sh
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.integrations.tests_provider_rollout --verbosity=1
```

### Phase H8 — Support / Operations UX

- Added platform-only operations health endpoint:
  - `GET /api/platform/operations-health/`.
- Added operations health command:
  - `python manage.py platform_operations_health_check`;
  - `python manage.py platform_operations_health_check --format=json`;
  - `python manage.py platform_operations_health_check --fail-on-critical`.
- Added Platform Admin page:
  - `/platform/operations`.
- The page combines:
  - queue runtime status;
  - failed automation runs;
  - failed integration events;
  - failed webhook deliveries;
  - connector request queue;
  - production readiness blockers;
  - backup readiness blockers;
  - provider rollout readiness;
  - active support grants count.
- Merchant users cannot access the endpoint/page.
- Merchant CRM UI remains unchanged; operational complexity stays inside Platform Admin.
- Added docs:
  - `docs/platform-operations-health.md`.

Checks:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.core.tests_platform_operations --verbosity=1
cd frontend && npm run build
```

### Phase H9 — Paid Beta Gate

- Added paid beta gate service:
  - `apps.core.paid_beta_gate`.
- Added command:
  - `python manage.py paid_beta_gate_check`;
  - `python manage.py paid_beta_gate_check --format=json`;
  - `python manage.py paid_beta_gate_check --fail-on-blockers`.
- The command blocks paid beta until these gates are green:
  - staging smoke;
  - browser E2E;
  - production readiness audit;
  - Redis/Celery runtime;
  - object storage;
  - Sentry;
  - transactional email;
  - backup/restore drill;
  - support grant workflow;
  - Platform Operations health;
  - provider rollback/readiness.
- Added manual confirmation env flags:
  - `PAID_BETA_STAGING_SMOKE_GREEN`;
  - `PAID_BETA_BROWSER_E2E_GREEN`;
  - `PAID_BETA_BACKUP_RESTORE_DRILL_DONE`;
  - `PAID_BETA_SUPPORT_GRANT_FLOW_TESTED`.
- Added docs:
  - `docs/paid-beta-gate.md`.

Checks:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.core.tests_paid_beta_gate apps.core.tests_platform_operations --verbosity=1
cd frontend && npm run build
```

### Paid Beta Launch Pack

- Added executable launch check:
  - `scripts/paid_beta_launch_check.sh`.
- The script combines the production readiness, backup, observability, email, provider rollout, queue, storage, remote smoke, optional load smoke and final paid-beta gate checks.
- The script also runs `platform_operations_health_check --fail-on-critical`.
- Added runbook:
  - `docs/paid-beta-launch-runbook.md`.
- The script is intentionally expected to fail in local/demo env until real Redis, object storage, Sentry, SMTP, backup drill and support grant checks are configured.

Syntax check:

```bash
bash -n scripts/paid_beta_launch_check.sh
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.core.tests_paid_beta_gate --verbosity=1
```

### Operational Smoke Progress — 2026-05-24

- H1 Redis/Celery queue runtime was verified locally with Redis and a Celery worker:
  - `scripts/render_h1_queue_smoke.sh` passed for business `#1`;
  - worker processed the `automations` queue and smoke objects were cleaned up.
- H2 object storage is the current blocker:
  - `scripts/render_h2_storage_smoke.sh` stops because `USE_S3=False`;
  - next step is to configure a private S3-compatible bucket and env values before continuing the paid-beta smoke chain.

### Core-Closure Checkpoint A — Working Hours / Calendar / Appointments

- Added quick working-hours presets for the merchant schedule:
  - `weekdays_9_18`;
  - `daily_9_20`;
  - `mon_sat_9_18`.
- Added backend endpoint:
  - `POST /api/working-hours/apply-preset/`.
- Presets create/update all seven business-level days and are idempotent, so repeated application does not create duplicates.
- Working hours page now has a quick preset selector and confirmation message.
- Appointment form now resets stale slot selection when date/service/resource changes.
- Appointment creation errors from the API are shown inside the modal in human-readable form.
- Available slots appear after applying a working-hours preset.

Checks:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.scheduling --verbosity=1
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test --verbosity=1
cd frontend && npm run build
```

### Final Pilot Frontend Core — Checkpoint A

- Hardened appointment creation UX:
  - clear prerequisites for clients, services, resources and working hours;
  - human validation errors instead of silent disabled states;
  - explicit empty-slots guidance with a link to working-hours setup.
- Improved calendar pilot UX:
  - added service/resource filters;
  - added Today navigation;
  - added success feedback after appointment creation;
  - replaced raw appointment status action labels with human-readable actions;
  - added setup CTAs for missing calendar prerequisites.
- Polished CRM linkage around Tasks/Deals/Leads:
  - task related entities now open the CRM drawer directly;
  - deal creation shows setup blockers when clients or pipeline stages are missing;
  - leads page safely handles empty or paginated team-member responses.

Checks:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test --verbosity=1
cd frontend && npm run build
```

### Final Pilot Frontend Core — Checkpoint B

- Decomposed the large integrations page by extracting the reusable connector card into:
  - `frontend/src/features/integrations/components/ConnectorCard.tsx`.
- Cleaned merchant-facing technical noise:
  - renamed visible token/webhook/mock wording into user-friendly connection language;
  - hid advanced developer settings behind a collapsed advanced section;
  - moved raw delivery payload behind an explicit technical details disclosure.
- Improved connector-ready UX:
  - kept all connector actions explicit and non-deceptive;
  - added Google Sheets and Email request-ready items to the data connector foundation;
  - replaced mock-sync wording with safe demo-import language.

Checks:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test --verbosity=1
cd frontend && npm run build
```

### Final Pilot Frontend Core — Checkpoint C

- Improved owner dashboard pilot focus:
  - added a larger owner revenue cockpit block;
  - added direct CTAs to Pilot Readiness and data import;
  - kept operator dashboard focused on assigned operational work.
- Expanded Pilot Readiness:
  - added a clearer setup path from business/team to CRM, inbox, AI, import and integrations;
  - added Excel/CSV import readiness to the backend checklist;
  - added retry handling and clearer next actions on the frontend readiness page.
- Removed remaining merchant-facing technical noise from bot/AI screens:
  - replaced public API, mock, token and webhook wording with safe user-facing connection language;
  - kept advanced/internal details out of the main merchant flow.

Checks:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test --verbosity=1
cd frontend && npm run build
```

### Final Pilot Frontend Core — Final Regression

- Re-ran the full backend/frontend validation after all pilot frontend/core polish work.
- Browser-checked the main route groups with local running services:
  - public: `/`, `/pricing`, `/bots`, `/crm`, `/contacts`;
  - platform: `/platform`, `/platform/merchants`, `/platform/settings`;
  - merchant: `/dashboard`, `/dashboard/leads`, `/dashboard/deals`, `/dashboard/clients`, `/dashboard/tasks`, `/dashboard/calendar`, `/dashboard/conversations`, `/dashboard/bots`, `/dashboard/integrations`, `/dashboard/analytics`, `/dashboard/settings`, `/dashboard/pilot-readiness`.
- Verified role routing:
  - `business_owner@example.com` enters merchant dashboard and is redirected away from `/platform`;
  - `platform_admin@example.com` enters `/platform` and can open platform routes.

Checks:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test --verbosity=1
cd frontend && npm run build
```

### Production Hardening H1 — Redis / Celery Runtime Handoff

- Added a safe Render H1 blueprint example:
  - `deploy/render.h1.example.yaml`.
- Added an executable queue runtime smoke wrapper:
  - `scripts/render_h1_queue_smoke.sh`.
- Updated Redis/Celery deployment docs:
  - `docs/celery-render-runtime.md`;
  - `docs/deployment.md`.
- Updated staging/production env templates with shared Redis/worker guidance and AI worker concurrency.
- H1 remains environment-dependent: it becomes green only after a managed Redis URL is configured on Render backend + workers and `scripts/render_h1_queue_smoke.sh` passes.

Checks:

```bash
bash -n scripts/render_h1_queue_smoke.sh
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.automations.tests_queue_runtime --verbosity=1
```

### Production Hardening H2 — Object Storage Production Handoff

- Hardened legacy local private media serving:
  - `/api/files/private/business-<id>/...` now checks tenant access before serving;
  - paths without a business prefix stay hidden.
- Added Render object-storage smoke wrapper:
  - `scripts/render_h2_storage_smoke.sh`.
- Updated storage/deployment docs:
  - `docs/file-storage.md`;
  - `docs/deployment.md`.
- H2 remains environment-dependent: it becomes green only after private S3-compatible storage is configured and the smoke wrapper passes against staging/production env.

Checks:

```bash
bash -n scripts/render_h2_storage_smoke.sh
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.core.tests.FileSafetyFoundationTests apps.core.tests_file_attachments apps.core.tests_storage_runtime --verbosity=1
```

### Core Logic Closure — Checkpoint B

- Tightened cross-entity CRM flows for leads, deals, tasks, clients, appointments and inbox:
  - dashboard quick lead action opens the lead creation flow via `/dashboard/leads?create=1`;
  - lead, deal, client, task and appointment pages now understand direct entity query links such as `?lead=`, `?deal=`, `?client=`, `?task=` and `?appointment=`;
  - inbox linked entity buttons now open the exact linked client/lead/deal instead of only navigating to the generic list page.
- Preserved existing backend tenant filtering and API behavior; this checkpoint is a UI flow hardening layer over the already-tested backend actions.
- Verified that existing backend coverage already exercises inbox create/link client, lead, deal, task, website chat lead creation, lead-to-deal and task/entity relations.

Checks:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.leads apps.crm apps.clients apps.tasks apps.conversations --verbosity=1
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test --verbosity=1
cd frontend && npm run build
```

### Core Logic Closure — Checkpoint C

- Hardened the integrations pilot surface without adding new external integrations:
  - Website Chat now explains the business flow and copies the install code without showing the internal widget key on screen;
  - Telegram setup no longer asks merchants for webhook URL or webhook secret, and no longer shows token-like values back after save;
  - connector cards keep WhatsApp, Instagram, Kaspi, 1C, MoySklad and import states as clear request/readiness flows instead of dead technical placeholders.
- Preserved the existing backend connector APIs and tenant isolation; this checkpoint is a merchant-facing safety and route sanity pass over the current integrations layer.
- Verified that the core app still passes full backend tests and frontend production build after the integrations cleanup.

Checks:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test --verbosity=1
cd frontend && npm run build
```

### Core Logic Closure — Final Report

- Closed the technical pilot core pass across scheduling, CRM cross-flows, inbox handoff, integrations safety and pilot readiness:
  - working hours presets make calendar readiness understandable and repeatable;
  - appointment creation now resets stale slot state and surfaces backend validation in a human-readable way;
  - lead, deal, task, client, appointment and inbox links open the exact CRM entity via query-driven routes;
  - integrations keep merchant-facing setup flows clear while hiding internal API keys, raw tokens, webhook URLs and webhook secrets from the main UI.
- Manual scenario coverage represented by existing route/API coverage and production build:
  - platform admin and merchant role routing;
  - working hours preset and available-slot scheduling logic;
  - lead creation, lead-to-deal, task/entity relations and inbox linking;
  - integrations page, Website Chat, Telegram setup, connector request flows and pilot readiness state.
- Remaining backlog for a later phase:
  - real provider activation for WhatsApp, Instagram, Telegram production webhooks, Kaspi, 1C and MoySklad;
  - deeper browser-based E2E automation for the full merchant journey;
  - final UI/UX polish after the core business logic remains stable.

Final checks:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test --verbosity=1
cd frontend && npm run build
```

Status: the technical pilot core can be treated as closed when paired with the documented environment setup and demo data.

### Hardening Pass — Recommendations 2-9

- Expanded Playwright smoke coverage from route-only checks into a real merchant core flow:
  - working-hours preset;
  - client, service and resource creation;
  - available-slot lookup;
  - appointment creation;
  - lead creation;
  - lead-to-deal conversion;
  - related task creation.
- Added a direct-object tenant isolation E2E smoke:
  - an owner/operator from one merchant cannot read another merchant's client object by direct API URL.
- Made E2E auth more stable:
  - tests bootstrap JWT tokens through the API and cache them per Playwright run;
  - this avoids false failures from local/staging auth throttles while still testing protected routes and permissions.
- Hardened Render/deploy documentation:
  - documented the two-service Render setup for backend Docker service + frontend static site;
  - documented frontend rewrites, `VITE_API_URL`, backend CORS/CSRF env and common Render/Supabase mistakes.
- Hardened staging smoke:
  - `scripts/staging_smoke.sh` now verifies that the CORS preflight returns the exact `Access-Control-Allow-Origin` for the frontend origin.
- Added monitoring runbook:
  - `docs/monitoring-runbook.md` covers uptime checks, Sentry, platform operations health, smoke commands and alert triggers.
- Reconfirmed role/permission, tenant isolation, storage and observability foundations through targeted backend tests.

Checks:

```bash
bash -n scripts/staging_smoke.sh
bash -n scripts/render_h2_storage_smoke.sh
bash -n scripts/render_h3_observability_smoke.sh
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.businesses.tests_access apps.core.tests_security apps.core.tests_storage_runtime apps.core.tests_observability apps.core.tests_platform_operations --verbosity=1
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test --verbosity=1
cd frontend && npm run build
cd frontend && npm run e2e
```

Latest results:

```text
Backend check: OK
Targeted backend hardening tests: 28 OK
Full backend tests: 266 OK
Frontend production build: OK
Playwright E2E: 15 passed, 7 intentional desktop/mobile skips
```

Local production readiness audit is intentionally not green while running with local SQLite, DEBUG and local media. Staging/production must use the documented Render/Supabase/Sentry/storage env before it can be treated as production-ready.

### Tenant Boundary Hardening — Scheduling Catalog

- Added explicit permission coverage for scheduling/catalog entities that previously relied mostly on business-level filtering:
  - `Service`;
  - `Resource`;
  - `WorkingHours`.
- Preserved tenant isolation for owners across core CRM entities:
  - clients, services, resources, working hours, leads, pipelines, stages, deals, appointments and tasks;
  - direct foreign object URLs return forbidden/not found instead of leaking another merchant's data.
- Made catalog access action-aware:
  - managers can read services/resources/working hours when they have appointment visibility;
  - services/resources/working-hours mutations require settings update permission;
  - business operators without appointments/settings scope do not see or mutate scheduling catalogs.
- Stabilized paginated tenant-scoped querysets by applying model ordering after permission scoping.

Checks:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.core.tests_tenant_isolation --verbosity=1
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.core.tests apps.businesses.tests_access apps.services apps.scheduling apps.core.tests_tenant_isolation --verbosity=1
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test --verbosity=1
cd frontend && npm run build
cd frontend && npm run e2e
```

Latest results:

```text
Tenant boundary tests: 4 OK
Targeted backend regression tests: 44 OK
Backend check: OK
Full backend tests: 270 OK
Frontend production build: OK
Playwright E2E: 15 passed, 7 intentional desktop/mobile skips
```

### Tenant Permission Map Hardening — Sensitive Models

- Extended the tenant permission map beyond the scheduling catalog:
  - bot and bot-channel setup now belongs to integrations permissions;
  - AI request logs belong to analytics permissions;
  - AI knowledge and agent profile configuration belongs to settings permissions;
  - notifications belong to notification-center permissions;
  - notes belong to client permissions.
- Added a regression test that fails if these sensitive tenant models lose their explicit permission resource mapping.
- Re-ran the full backend and frontend smoke suite after the stricter mapping.

Checks:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.core.tests_tenant_isolation --verbosity=1
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test --verbosity=1
cd frontend && npm run build
cd frontend && npm run e2e
```

Latest results:

```text
Tenant boundary/map tests: 5 OK
Backend check: OK
Full backend tests: 271 OK
Frontend production build: OK
Playwright E2E: 15 passed, 7 intentional desktop/mobile skips
```

### Notification / Registration Logic Cleanup

- Clarified notification delivery logic:
  - notifications can now target a specific employee through `recipient`;
  - empty `recipient` means a business-wide notification;
  - owners/admins can see business notifications, operators/staff see their own plus business-wide notifications.
- Added `notifications` as a separate RBAC resource instead of hiding it behind general settings permissions.
- Automatic CRM notifications now address the responsible employee when available:
  - lead status/deal events;
  - task reminders;
  - AI-created tasks;
  - appointment reminders from leads;
  - website lead-form submissions.
- The header notification dropdown now shows who the notification is for.
- Tightened notification validation so a recipient must be an active member of the same business.
- Cleaned up business registration/settings labels:
  - niche selector uses business-friendly Russian labels;
  - beauty niche is shown as “Салон красоты / барбершоп”;
  - staff roles in settings use readable Russian names and clearer descriptions.

Checks:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.notifications.tests --verbosity=1
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.tasks.tests apps.scheduling.tests apps.leads.tests_forms apps.leads.tests_crm_light --verbosity=1
DATABASE_URL=sqlite:///db.sqlite3 SECURE_SSL_REDIRECT=False SESSION_COOKIE_SECURE=False CSRF_COOKIE_SECURE=False REDIS_URL=memory:// CELERY_TASK_ALWAYS_EAGER=True CELERY_TASK_STORE_EAGER_RESULT=False AUTOMATIONS_RUN_INLINE=True .venv/bin/python manage.py test --verbosity=1
cd frontend && npm run build
```

Latest results:

```text
Migration check: OK
Backend check: OK
Notification tests: 5 OK
Related CRM flow tests: 31 OK
Full backend tests: 276 OK
Frontend production build: OK
```

### Frontend Resilience Hardening

- Added a route-level error boundary so runtime route/page errors render a controlled CRM error state instead of the default React Router crash screen.
- Hardened CRUD list unwrapping so unexpected list responses safely degrade to an empty list instead of throwing `.map is not a function`.
- Centralized frontend API list normalization in `api/client.ts`:
  - CRUD APIs now share one `unwrapList` helper;
  - billing usage/entitlements, security audit/login history, lead forms, imports, custom fields, webhook deliveries and inbox messages now tolerate paginated, array and empty responses consistently.
- Added an auth-expired browser event:
  - if access refresh fails or refresh token is missing, the API client clears tokens;
  - `AuthProvider` immediately drops the stale authenticated state instead of leaving the user in a broken session.
- Rechecked the merchant and platform smoke flows after the error boundary change.

Checks:

```bash
cd frontend && npm run build
cd frontend && npm run e2e
```

Latest results:

```text
Frontend production build: OK
Playwright E2E: 15 passed, 7 intentional desktop/mobile skips
```

### Agent / API Consistency Cleanup

- Updated `AGENTS.md` so future work starts from the current production-hardening state instead of the old Phase 1 baseline.
- Removed the last duplicate frontend list-unwrapping helper from the team API module:
  - `teamApi.members`;
  - `teamApi.roles`;
  - `teamApi.departments`.
- Removed the last duplicate frontend paginated-response type from the inbox API module.
- Team and inbox endpoints now use shared list/pagination helpers from `frontend/src/api/client.ts`, matching the rest of the frontend API layer.
- Hardened nested summary arrays against malformed API shapes:
  - analytics team performance members/actions/teams;
  - inbox pulse channels and next actions.
  - platform operations provider rollout, connector queue and failed work queues.

Checks:

```bash
cd frontend && npm run build
cd frontend && npm run e2e
```

Latest results:

```text
Frontend production build: OK
Playwright E2E: 15 passed, 7 intentional desktop/mobile skips
```

### ZANI 10 next tasks — Task 10: Pre-Deploy Hardening

Статус: **готово как staging gate**.

Что изменено:

- Добавлен глобальный frontend error boundary:
  - runtime-сбой вне route-level boundary теперь показывает контролируемый экран восстановления;
  - пользователь может обновить страницу или вернуться на dashboard вместо React crash screen.
- Добавлен `scripts/predeploy_check.sh`:
  - `manage.py check`;
  - `manage.py check --deploy`;
  - `makemigrations --check --dry-run`;
  - `production_readiness_audit`;
  - syntax check всех shell-скриптов;
  - clean archive validation;
  - опциональный frontend build.
- `scripts/make_clean_archive.sh` теперь сохраняет staging/production env-шаблоны:
  - `.env.staging.example`;
  - `.env.production.example`;
  - `frontend/.env.staging.example`;
  - `frontend/.env.production.example`.
- `docs/deployment.md` получил pre-deploy quality gate с командами для staging/server setup.

Проверка:

```bash
bash -n scripts/predeploy_check.sh scripts/make_clean_archive.sh
DATABASE_URL=sqlite:///db.sqlite3 REDIS_URL=memory:// CELERY_TASK_ALWAYS_EAGER=True CELERY_TASK_STORE_EAGER_RESULT=False AUTOMATIONS_RUN_INLINE=True .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 REDIS_URL=memory:// CELERY_TASK_ALWAYS_EAGER=True CELERY_TASK_STORE_EAGER_RESULT=False AUTOMATIONS_RUN_INLINE=True .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 REDIS_URL=memory:// CELERY_TASK_ALWAYS_EAGER=True CELERY_TASK_STORE_EAGER_RESULT=False AUTOMATIONS_RUN_INLINE=True .venv/bin/python manage.py check --deploy
DATABASE_URL=sqlite:///db.sqlite3 REDIS_URL=memory:// CELERY_TASK_ALWAYS_EAGER=True CELERY_TASK_STORE_EAGER_RESULT=False AUTOMATIONS_RUN_INLINE=True .venv/bin/python manage.py test apps.core.tests_production_audit -v 2
SKIP_FRONTEND_BUILD=true DATABASE_URL=sqlite:///db.sqlite3 REDIS_URL=memory:// CELERY_TASK_ALWAYS_EAGER=True CELERY_TASK_STORE_EAGER_RESULT=False AUTOMATIONS_RUN_INLINE=True ./scripts/predeploy_check.sh
cd frontend && npm run build
```

Latest results:

```text
Shell syntax checks: OK
Backend check: OK
Migration drift check: OK
Django deploy check: OK with expected local/dev warnings
Production audit tests: 4 OK
Predeploy gate: OK with expected local/dev readiness warnings
Frontend production build: OK
```

### UI / UX Direction Pass — Navigation and Language Foundation

Статус: **первый ответственный проход готов, полный редизайн экранов нужен отдельным этапом**.

Что изменено:

- Sidebar переработан из скрытой групповой навигации в понятную карту продукта:
  - desktop sidebar теперь работает как компактный command rail: иконки всегда видны, полная навигация раскрывается при наведении или по кнопке;
  - все доступные разделы раскрываются внутри смысловых групп;
  - активная страница читается по иконке, фону и маркеру;
  - группы получили пояснения, чтобы мерч понимал, где продажи, где операции, где рост;
  - mobile overlay закрывается при переходе по ссылке через существующий `onNavigate`.
- Переключатель языка поднят наверх:
  - в desktop header;
  - в верхнюю часть sidebar;
  - вместо обычного select теперь компактный RU / KK / EN segmented control.
- Переписана основная локализация shell:
  - RU больше не использует `Dashboard`, `Sales pipeline`, `Timeline` в главных navigation/page местах;
  - KK получил полноценные ключи для навигации, dashboard, leads, deals, timeline и auth shell;
  - EN сохранён как отдельный нормальный словарь.
- Добавлен более выразительный visual foundation:
  - глубинный background field;
  - perspective panels;
  - более premium sidebar surface;
  - без тяжёлых 3D-библиотек и без роста runtime-сложности перед серверным запуском.
- Dashboard получил первый продуктовый поворот в сторону “живого бизнес-пульта”:
  - первый экран фокусируется на деньгах, заявках, записях и задачах;
  - быстрые действия ведут в реальные рабочие разделы;
  - часть оставшихся hardcoded dashboard-строк вынесена в i18n;
  - неверный маршрут диалогов заменён на `/dashboard/conversations`.
- Navigation pass 2:
  - узкий desktop sidebar теперь показывает крупные зоны бизнеса, а не длинный список отдельных пунктов;
  - при наведении раскрывается полноценная карта разделов с вложенными пунктами;
  - поиск, уведомления, activation-dashboard и статусы подключения получили i18n-ключи для RU / KK / EN.
- Leads workspace pass:
  - страница заявок получила верхний command panel с ключевыми числами по новым, активным, записанным и потерянным заявкам;
  - карточки заявок очищены от перегруза кнопками: основные действия оставлены на поверхности, вторичные убраны под `Ещё`;
  - карточки получили визуальный приоритет `горячая / обычная`, ZANI-подсказку и более понятную структуру для mobile-first kanban;
  - заметные action-тексты заявок вынесены в i18n RU / KK / EN.
- Calendar workspace pass:
  - календарь переработан из простого расписания в рабочий пульт дня с числом записей, подтверждений, свободных окон и готовностью справочников;
  - форма создания записи стала понятнее для салонов/клиник: клиент, услуга, мастер/ресурс, дата и слот объясняются в контексте записи;
  - если у бизнеса есть активные ресурсы, первый мастер/кабинет выбирается автоматически, чтобы мерч не упирался в пустой обязательный select;
  - блок отсутствия слотов теперь объясняет реальные причины: нет графика, у мастера выходной или все окна заняты;
  - основные тексты календаря и формы записи вынесены в i18n RU / KK / EN.
- Appointments and working-hours pass:
  - страница записей получила верхние KPI-карточки: сегодня, подтверждены, завершены, задействованные ресурсы;
  - текст “appointment” заменён на нормальную бизнес-терминологию, основные labels вынесены в i18n RU / KK / EN;
  - быстрые статусы записей теперь показываются понятными действиями, а не техническими enum-значениями;
  - страница графика работы получила сводку по рабочим дням, индивидуальным графикам и выходным;
  - форма недельного графика стала понятнее: общий график бизнеса, отдельная неделя мастера, быстрые шаблоны салона и офиса.
- Services and resources pass:
  - услуги получили верхние business-карточки: активные услуги, средняя длительность и использование в записях;
  - экран услуг теперь объясняет, что длительность услуги напрямую влияет на свободные окна календаря;
  - форма услуги получила понятную подсказку и i18n-тексты RU / KK / EN;
  - ресурсы получили сводку по активным ресурсам, мастерам и индивидуальным графикам;
  - экран ресурсов теперь объясняет салонную логику: мастер/кабинет как ресурс, защита от двойной записи;
  - форма ресурса получила понятные типы и i18n-тексты RU / KK / EN.
- Clients workspace pass:
  - база клиентов получила верхние business-карточки: всего клиентов, клиенты с заявками, клиенты с записями и клиенты с тегами;
  - экран клиентов стал объяснять ценность базы как связки заявок, записей, истории и сегментации, а не просто таблицы контактов;
  - фильтры, empty state, сегменты, теги и действия вынесены в i18n RU / KK / EN;
  - форма клиента получила переводы, предупреждение о дублях и более понятные тексты для источника, заметок и сохранения.
- CRM card drawer pass:
  - карточка клиента/заявки/сделки/записи больше не держит основные тексты hardcoded на русском;
  - вкладки, быстрые действия, вложения, быстрые задачи, заметки, custom fields и empty states вынесены в i18n RU / KK / EN;
  - i18n helper получил безопасную подстановку `{id}` без изменения существующих вызовов переводов;
  - timeline использует локаль выбранного языка для группировки дат.
- Tasks workspace pass:
  - страница задач переведена на i18n RU / KK / EN в основных рабочих местах: заголовок, KPI, фильтры, карточки, создание задачи, детали и комментарии;
  - действия задач получили понятные labels/aria-labels: взять в работу, завершить, отменить, переоткрыть, назначить на себя и отложить;
  - связи задачи с клиентом, заявкой, сделкой и записью теперь используют общую терминологию CRM-card вместо локальных hardcoded строк;
  - empty state и форма создания задачи стали ближе к сценарию follow-up, а не к техническому task tracker.
- Conversations workspace pass:
  - главный inbox, фильтры, список диалогов, header выбранного диалога, composer и правая CRM-context панель переведены на i18n RU / KK / EN;
  - даты сообщений и группировка ленты используют локаль выбранного языка;
  - notice-сообщения для handoff, mark read/unread, AI draft, linking client/lead/deal/task и upload attachments вынесены в словари;
  - mixed RU/EN в ключевых действиях inbox заменён на продуктовую терминологию: прочитано, подсказать ответ, передать менеджеру, привязать по ID, CRM-связь.
- Analytics workspace pass:
  - owner analytics получила i18n RU / KK / EN для заголовка, KPI, источников, attention-блока, операционных отчётов, scheduled reports и service-by-bookings;
  - team performance получил локализованные заголовки, permission-copy, empty states и основные team metrics;
  - отчётные блоки сохранены простыми: без декоративного BI, с фокусом на заявки, записи, сделки, команду и экспорт;
  - вычисления и API-контракты аналитики не менялись.
- Settings team-access pass:
  - верх Settings, якорная навигация, блок команды, выбор роли, видимость доступа и приглашения сотрудников переведены на i18n RU / KK / EN;
  - роли сотрудников и уровни видимости теперь показываются через единый словарь, без смешивания RU/EN в главном team-access сценарии;
  - тексты приглашения для email, WhatsApp, Telegram и copy-link используют локаль интерфейса и безопасную подстановку `{url}`;
  - API-контракты команды, ролей и приглашений не менялись.
- Settings security and replies pass:
  - security center получил локализованные заголовки, permission-copy, risk metrics, empty states и формат дат по выбранному языку;
  - quick replies переведены на i18n RU / KK / EN: поля формы, каналы, статусы, редактирование, включение/отключение и empty state;
  - блок отделов и developer connections в Settings также очищены от видимого RU/EN смешивания;
  - API-контракты аудита, login history, support grants и quick replies не менялись.
- Settings roles, data and billing pass:
  - roles simple/advanced mode, уровни видимости, access groups и role summaries переведены на i18n RU / KK / EN;
  - import/export, manual sales, catalog items, lead forms, billing, usage limits и custom fields получили локализованные заголовки, формы, empty states и действия;
  - price/usage helpers теперь принимают текущую локаль и переводчик, поэтому формат цен и метрик не зашит в компонент;
  - API-контракты import/export, lead forms, billing и custom fields не менялись.
- Permissions i18n pass:
  - названия permission resources вынесены из русского `resourceLabels` в i18n RU / KK / EN;
  - advanced permission matrix в Settings и role summaries используют локализованные resource names;
  - forbidden route message и loading state проверки доступа теперь выводятся на выбранном языке;
  - legacy `forbiddenMessage` сохранён как fallback, чтобы не ломать старые вызовы.
- Common UI i18n pass:
  - `Button`, `LoadingState`, `ForbiddenState`, `Modal` и `DataTable` больше не держат русские fallback-тексты;
  - route guards используют локализованные loading/access messages;
  - table totals, empty description, close aria-label, loading labels и access-hidden copy вынесены в RU / KK / EN;
  - полный backend test-suite прошёл: 286 tests OK.
- Auth and invite i18n/access pass:
  - login, signup, invitation accept, password reset request and password reset confirm получили основные i18n-тексты RU / KK / EN;
  - invite accept теперь принимает телефон и сохраняет его в профиле сотрудника, если пользователь создаётся или у существующего пользователя телефон пустой;
  - добавлены regression tests: истёкшее приглашение нельзя принять, уже принятое приглашение нельзя использовать повторно;
  - env examples уточняют, что Google/Apple значения — это public client IDs для ID-token validation, а не provider secrets.
- Lightweight integrations roadmap:
  - добавлен `docs/lightweight-integrations-roadmap.md`;
  - зафиксирован принцип: merchant видит простые статусы и действия, raw credentials/webhooks остаются backend-side;
  - следующий порядок интеграций: Website/Forms, Excel/CSV, Telegram, затем WhatsApp/Instagram/Kaspi/1C/МойСклад/marketplaces через request/support-assisted flow.
- Shell polish i18n pass:
  - header notification categories, notification actions, mobile menu aria-labels and pilot safe 404 page now use RU / KK / EN dictionaries;
  - frontend production build reconfirmed after the shell changes.
- Platform/status i18n pass:
  - platform shell navigation, descriptions, protected-zone copy, search placeholder and logout action now use RU / KK / EN dictionaries;
  - shared `StatusBadge` no longer hardcodes Russian/English labels and now localizes CRM, connector, notification, priority and AI-tone statuses;
  - fallback for unknown statuses remains safe and shows the raw backend status instead of leaking an i18n key.
- Dashboard i18n pass:
  - owner and operator dashboard copy now uses RU / KK / EN dictionaries for page headers, manager workspace, attention blocks, empty states and quick-start hints;
  - activation modules, mobile onboarding readiness labels and manager work queue no longer contain visible hardcoded Russian strings;
  - dashboard scan confirms no remaining visible Cyrillic hardcoded strings in `DashboardPage.tsx`.
- Исправлен demo seed для visual QA:
  - повторное создание демо-менеджеров больше не падает из-за `username`;
  - добавлен тест на username collision.
- Mobile shell/auth pass:
  - верхние мобильные controls в рабочем кабинете увеличены: menu, search, notifications и logout получили нормальные touch targets;
  - нижняя мобильная навигация поднята выше по z-index, увеличена по высоте и получила более крупные иконки/зоны нажатия;
  - login page стала компактнее на телефоне и больше не подставляет устаревший `admin@example.com/admin12345`;
  - публичный hero уменьшен на мобильном, чтобы первый экран не ломался длинным заголовком;
  - `/api/auth/me/` оптимизирован: текущий пользователь, memberships и effective permissions собираются без тяжёлой серии permission-запросов, что убирает зависание логина на Render/Supabase.
- Shared merchant forms i18n pass:
  - формы настроек бизнеса, заявки, клиента, записи, услуги, ресурса и графика работы больше не держат основные validation/help тексты hardcoded на русском;
  - route-level и app-level error boundaries показывают сообщения и действия на выбранном языке;
  - дни недели, типовые подсказки форм и обязательные ошибки вынесены в RU / KK / EN dictionaries;
  - API-контракты форм не менялись.
- Platform overview i18n pass:
  - platform overview page переведена на RU / KK / EN для заголовка, метрик, operational signals, MRR-блока и loading/error states;
  - форматирование MRR учитывает выбранный язык интерфейса;
  - API-контракт `/api/platform/overview/` не менялся.
- Onboarding i18n pass:
  - быстрый старт, шаблоны ниш, setup checklist, первый канал и первое сообщение переведены на RU / KK / EN;
  - CTA на dashboard, заявки, календарь, настройки, диалоги и интеграции используют общий словарь навигации;
  - API-контракты onboarding templates/status/setup-channel/create-first-message не менялись.
- Integration connector cards i18n pass:
  - повторяемые карточки коннекторов переведены на RU / KK / EN: статусы доступности, setup states, business value, тариф, owner next step и read-only notice;
  - connector hints теперь локализованы и сохраняют честную пилотную логику: self-service, request, upgrade и roadmap без ложного auto-connect;
  - API-контракты connector capabilities и business connectors не менялись.
- Working hours presets i18n pass:
  - страница графика работы больше не хранит русские константы дней недели и quick-preset labels;
  - шаблоны Пн-Пт / ежедневно / Пн-Сб локализованы через RU / KK / EN словари;
  - API-контракт `applyPreset` и weekly working-hours form не менялись.
- Integrations import/onboarding i18n pass:
  - integration onboarding route и Excel/CSV import panel переведены на RU / KK / EN;
  - import entity labels, helpers, preview states, mapping, duplicate и row-error copy больше не hardcoded;
  - API-контракты import jobs и connector capabilities не менялись.
- Website Chat integration i18n pass:
  - блок сайта и лендингов на `/dashboard/integrations` переведён на RU / KK / EN;
  - тестовое сообщение, follow-up, empty/loading states и copy-snippet notice больше не hardcoded;
  - публичный website chat API и widget snippet generation не менялись.
- Telegram integration wizard i18n pass:
  - Telegram beta wizard переведён на RU / KK / EN: инструкция BotFather, статусы токена, приём сообщений, save/test notices и read-only state;
  - техническая логика safe demo/mock checks сохранена без изменения Telegram API контрактов;
  - владелец видит понятный setup flow без вывода сохранённого кода подключения.
- Integration request/data panels i18n pass:
  - WhatsApp/Instagram request-ready формы переведены на RU / KK / EN без изменения connector request API;
  - data connector cards для Kaspi, 1C, Google Sheets, Email, МойСклад, Wildberries, Ozon и Яндекс.Маркет переведены на RU / KK / EN;
  - demo import notices, request/update CTAs и comments больше не hardcoded.
- Integrations page header/filter i18n pass:
  - loading/empty states, PageHeader, safe-token notice, summary cards, search/filter/reset and empty results переведены на RU / KK / EN;
  - `/dashboard/integrations` больше не содержит видимых hardcoded RU строк, кроме названий брендов/сервисов;
  - connector filtering/search behavior and API contracts did not change.
- Invite registration hardening pass:
  - принятие приглашения теперь проходит через стандартные Django password validators, а не только через минимальную длину;
  - существующему пользователю при принятии приглашения не перезаписывается текущий пароль, если он уже задан;
  - добавлены regression tests для Telegram contact requirement, чужой business role, слабого пароля и existing-user invite flow;
  - статусы приглашений в Settings и поле email на invite accept page переведены через RU / KK / EN i18n.
- Google / Apple readiness pass:
  - social signup теперь создаёт не только trial business и owner membership, но и default business roles + default pipeline;
  - login page уже держит controlled disabled state, если `VITE_GOOGLE_CLIENT_ID` / `VITE_APPLE_CLIENT_ID` не заданы;
  - `docs/social-auth.md` уточняет production-readiness поведение и env-контракт без реальных secrets.
- Lightweight integration readiness pass:
  - Excel/CSV добавлен в provider rollout readiness как первый data connector с отдельным `excel_csv` gate;
  - readiness command теперь проверяет connector catalog, BusinessEvent/idempotency layer, upload limit и импортируемые сущности clients/leads/sales/catalog;
  - `docs/provider-rollout.md` и `docs/lightweight-integrations-roadmap.md` обновлены под следующий Telegram + Excel/CSV MVP порядок.
- Telegram connector alignment pass:
  - Telegram wizard теперь синхронизирует merchant-facing `BusinessConnector`, чтобы страница интеграций, support health и настройки бота видели один статус;
  - connector хранит только safe metadata (`bot_channel_id`, configured flags, last operation), без bot token и webhook secret;
  - успешный mock/real webhook setup или test connection переводит Telegram connector в `connected`, ошибка переводит в `failed` с `last_error`.
- Pilot readiness i18n pass:
  - `/dashboard/pilot-readiness` больше не держит hardcoded RU строки в компоненте;
  - статусы, прогресс, путь подготовки, smoke path и empty/ready states вынесены в RU / KK / EN словарь;
  - backend checklist payload не менялся, чтобы не ломать текущие pilot readiness API.
- Calendar shared component i18n pass:
  - `SimpleCalendar` больше не содержит hardcoded fallback текстов `Клиент`, `Услуга`, `Без ресурса`;
  - calendar appointment fallbacks используют общий RU / KK / EN словарь appointment labels.
- Bots list i18n pass:
  - `/dashboard/bots` больше не содержит hardcoded RU/EN строк в видимых заголовках, CTA, empty state и форме создания;
  - добавлены общие ключи `common.save`, `language.*` и bot-specific labels для RU / KK / EN;
  - API создания бота, статусы и маршруты не менялись.
- WhatsApp setup i18n pass:
  - `WhatsAppSetupCard` больше не содержит hardcoded RU строк в форме настройки, статусных карточках и empty states;
  - добавлены RU / KK / EN ключи для безопасного beta/mock WhatsApp setup;
  - provider mode, status check и history log API не менялись.
- Developers settings i18n pass:
  - `DevelopersSection` больше не содержит hardcoded RU строк в секции API-ключей, webhooks и delivery logs;
  - добавлены RU / KK / EN ключи для developer tools, copy states, empty states и webhook delivery descriptions;
  - API-ключи, webhook endpoints, delivery retry и tenant permissions не менялись.
- Timeline i18n pass:
  - `TimelinePage` больше не содержит hardcoded RU строк в error, empty state и client fallback;
  - группировка дат использует locale активного языка (`ru-RU`, `kk-KZ`, `en-US`);
  - activity events API и timeline filtering не менялись.
- Analytics i18n pass:
  - `AnalyticsPage` больше не содержит hardcoded RU строк и основные смешанные EN/RU подписи метрик вынесены в RU / KK / EN словарь;
  - локализованы no-show, Source ROI, team CSV, probability/avg days, handoff/team labels и team counters;
  - owner/team analytics API и exports не менялись.
- Resources i18n pass:
  - `ResourcesPage` больше не хранит resource type labels в компоненте;
  - типы staff/room/hall/box/equipment/other берутся из существующих RU / KK / EN ключей;
  - CRUD ресурсов, календарная логика и API не менялись.
- Appointments i18n pass:
  - `AppointmentsPage` больше не хранит action labels статусов в компоненте;
  - quick actions confirm/cancel/complete/no-show используют RU / KK / EN ключи;
  - список записей, фильтры, archive и CRUD API не менялись.

Проверка:

```bash
DATABASE_URL=sqlite:///db.sqlite3 REDIS_URL=memory:// CELERY_TASK_ALWAYS_EAGER=True CELERY_TASK_STORE_EAGER_RESULT=False AUTOMATIONS_RUN_INLINE=True .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 SECRET_KEY=dev-secret-key-with-enough-length-for-local-check DEBUG=True ALLOWED_HOSTS=localhost,127.0.0.1 .venv/bin/python manage.py test apps.businesses.tests_demo_seed -v 2
DATABASE_URL=sqlite:///db.sqlite3 SECRET_KEY=dev-secret-key-with-enough-length-for-local-check DEBUG=True ALLOWED_HOSTS=localhost,127.0.0.1 .venv/bin/python manage.py check
cd frontend && npm run build
```

Latest results:

```text
Backend check: OK
Demo seed tests: 7 OK
Team access invite tests: 16 OK
Full backend tests: 288 OK
Frontend production build: OK
Frontend production build after shell i18n: OK
Frontend production build after platform/status i18n: OK
Frontend production build after dashboard i18n: OK
Frontend production build after mobile shell/auth pass: OK
Full backend tests after mobile shell/auth pass: 288 OK
Full backend tests after shared forms i18n pass: 288 OK
Frontend production build after shared forms i18n pass: OK
Full backend tests after platform overview i18n pass: 288 OK
Frontend production build after platform overview i18n pass: OK
Full backend tests after onboarding i18n pass: 288 OK
Frontend production build after onboarding i18n pass: OK
Full backend tests after connector cards i18n pass: 288 OK
Frontend production build after connector cards i18n pass: OK
Full backend tests after working hours presets i18n pass: 288 OK
Frontend production build after working hours presets i18n pass: OK
Full backend tests after integrations import/onboarding i18n pass: 288 OK
Frontend production build after integrations import/onboarding i18n pass: OK
Full backend tests after website chat integration i18n pass: 288 OK
Frontend production build after website chat integration i18n pass: OK
Full backend tests after Telegram integration wizard i18n pass: 288 OK
Frontend production build after Telegram integration wizard i18n pass: OK
Full backend tests after integration request/data panels i18n pass: 288 OK
Frontend production build after integration request/data panels i18n pass: OK
Full backend tests after integrations page header/filter i18n pass: 288 OK
Frontend production build after integrations page header/filter i18n pass: OK
Team access invite tests after invite hardening pass: 20 OK
Full backend tests after invite hardening pass: 292 OK
Frontend production build after invite hardening pass: OK
Accounts social auth tests after Google/Apple readiness pass: 8 OK
Full backend tests after Google/Apple readiness pass: 292 OK
Frontend production build after Google/Apple readiness pass: OK
Provider rollout readiness tests after Excel/CSV gate pass: 8 OK
Telegram and Excel/CSV rollout command checks: OK
Full backend tests after lightweight integration readiness pass: 293 OK
Frontend production build after lightweight integration readiness pass: OK
Telegram integration tests after connector alignment pass: 11 OK
Full backend tests after Telegram connector alignment pass: 293 OK
Frontend production build after Telegram connector alignment pass: OK
Full backend tests after pilot readiness i18n pass: 293 OK
Frontend production build after pilot readiness i18n pass: OK
Full backend tests after calendar shared component i18n pass: 293 OK
Frontend production build after calendar shared component i18n pass: OK
Full backend tests after bots list i18n pass: 293 OK
Frontend production build after bots list i18n pass: OK
Full backend tests after WhatsApp setup i18n pass: 293 OK
Frontend production build after WhatsApp setup i18n pass: OK
Full backend tests after developers settings i18n pass: 293 OK
Frontend production build after developers settings i18n pass: OK
Full backend tests after timeline i18n pass: 293 OK
Frontend production build after timeline i18n pass: OK
Full backend tests after analytics i18n pass: 293 OK
Frontend production build after analytics i18n pass: OK
Full backend tests after resources i18n pass: 293 OK
Frontend production build after resources i18n pass: OK
Full backend tests after appointments i18n pass: 293 OK
Frontend production build after appointments i18n pass: OK
Full backend tests after AI Assistant i18n pass: 293 OK
Frontend production build after AI Assistant i18n pass: OK
Full backend tests after calendar page i18n pass: 293 OK
Frontend production build after calendar page i18n pass: OK
Full backend tests after AI agents i18n pass: 293 OK
Frontend production build after AI agents i18n pass: OK
Full backend tests after automations i18n pass: 293 OK
Frontend production build after automations i18n pass: OK
Full backend tests after deals i18n pass: 293 OK
Frontend production build after deals i18n pass: OK
Full backend tests after bot detail i18n pass: 293 OK
Frontend production build after bot detail i18n pass: OK
Full backend tests after leads runtime i18n pass: 293 OK
Frontend production build after leads runtime i18n pass: OK
Visual smoke screenshots: desktop collapsed rail, desktop expanded rail, mobile dashboard OK
```

GitHub/deploy note: current local folder `/Users/maksim/Desktop/zani 2` is linked to `https://github.com/999MAX20/ZANI.git` on `main`.

Следующий обязательный UI этап: пройти все merchant pages и заменить оставшиеся hardcoded RU/EN строки на i18n-ключи, затем сделать visual QA по ролям owner/operator/platform.
