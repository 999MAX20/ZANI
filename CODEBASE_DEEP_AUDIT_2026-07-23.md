# ZANI: глубокий аудит кодовой базы

Дата аудита: 23 июля 2026 года
Проверенный проект: `C:\Users\user\Desktop\ZANI-main`
Проверенная ветка: `codex/add-resource-user-mapping`
Проверенный HEAD: `03c745a`
Формат работы: анализ без изменения бизнес-логики и исходного кода

## 1. Итоговый вердикт

На текущем состоянии репозитория ZANI нельзя считать на 100% готовым к production.

Проект имеет сильную основу:

- Django/DRF backend разделен на предметные приложения;
- frontend собирается и использует централизованный API-слой;
- полный локальный набор backend-тестов проходит;
- миграции согласованы с моделями;
- присутствуют tenant-aware viewsets, permission matrix, audit/activity, интеграционный provider-слой;
- внешние providers по умолчанию выключены;
- имеются production-readiness и paid-beta команды;
- frontend build, bundle gate и проверенные Playwright-сценарии проходят.

При этом аудит выявил критические риски:

1. Уже написанный backend hardening существует в отдельных worktree/ветках, но не доставлен в активную ветку проекта.
2. Frontend и backend используют несовместимые контракты refresh-token/logout.
3. Object-level permissions и tenant isolation не полностью защищают create/update.
4. Фоновые операции допускают конкурентное повторное выполнение и дублирование внешних действий.
5. Очереди Celery и periodic runtime не завершены для production.
6. Системные AI-журналы доступны через изменяемый generic CRUD.
7. В Python и JavaScript зависимостях найдены известные уязвимости.
8. Текущее окружение не проходит paid-beta и production-readiness gates.
9. Большой незакоммиченный frontend-рефакторинг мешает безопасной консолидации веток.

Гарантировать, что программный продукт «никогда не сломается», технически невозможно. Реалистичная цель — обеспечить контролируемую вероятность отказа: закрыть P0/P1-дефекты, зафиксировать API-контракты, обеспечить идемпотентность и восстановление, добавить production-like проверки и выпускать проект только через воспроизводимый release gate.

## 2. Объем и методика аудита

Проверены:

- структура репозитория;
- Git-ветки и worktree;
- состояние активного рабочего дерева;
- backend-модели, serializers, viewsets, services и selectors;
- tenant isolation и backend permissions;
- CRM lifecycle и API-контракты;
- frontend routing, auth, API-клиент, state и крупные рабочие страницы;
- integrations, webhooks, credentials и provider adapters;
- AI assistant, AI tool calls, approvals и системные журналы;
- automations, notifications и Celery runtime;
- observability и production-readiness;
- deployment/Docker;
- производительность и потенциальные N+1;
- Python и npm зависимости;
- CI;
- backend tests, frontend build, bundle gate и выбранные E2E-сценарии.

Не выполнялись изменения бизнес-логики, рефакторинг или автоматическое слияние веток.

## 3. Состояние Git и доставка изменений

### 3.1. Активное рабочее дерево

На момент аудита:

- ветка: `codex/add-resource-user-mapping`;
- HEAD: `03c745a`;
- modified files: 157;
- untracked status groups: 44;
- общий tracked diff: около 19 159 добавленных и 7 876 удаленных строк;
- удаленных tracked-файлов не обнаружено.

Основная часть незакоммиченного объема относится к frontend, i18n, CRM workspace components, страницам и E2E.

Такое состояние нельзя использовать как надежную release base:

- сложно отделить завершенную работу от промежуточной;
- повышается вероятность потерять или случайно смешать изменения;
- невозможно надежно выполнить cherry-pick/rebase/merge и однозначно проверить результат;
- зеленая сборка не доказывает завершенность всех измененных пользовательских сценариев.

### 3.2. Недоставленные backend-ветки

Активный HEAD является предком следующих веток:

- `codex/backend-b0-security-hardening`: активная ветка отстает на 1 commit;
- `codex/backend-b6-crm-contract-cleanup`: отстает на 2 commits;
- `codex/backend-r2-crm-command-idempotency` / `codex/backend-r3-routing-sla`: отстает на 5 commits.

Недоставленные изменения:

- `e45d119 feat: harden backend CRM production layers B0-B5`;
- `06aaa0c fix: clean up misleading CRM contracts`;
- `42df06c docs: add backend reliability execution plan`;
- `c82f345 feat: add transactional outbound message outbox`;
- `ec347db feat: make critical CRM create commands idempotent`.

Файловое пересечение текущего tracked diff с последней backend-линией небольшое:

- dirty tracked files: 157;
- файлы в недоставленной backend-линии: 106;
- прямое пересечение: только `apps/businesses/access.py`.

Это снижает вероятность текстовых merge conflicts, но не устраняет семантические конфликты контрактов.

Пример:

- текущий frontend делает generic PATCH `/api/bot-conversations/{id}/`;
- backend hardening закрывает generic mutation критических BotConversation-полей;
- необходимо сначала определить отдельный безопасный action для toggle/status/handoff, затем согласовать frontend.

### 3.3. Вывод по Git

Главная проблема — не отсутствие hardening-кода, а его недоставка в активную ветку. Перед новым рефакторингом необходимо:

1. зафиксировать или безопасно разделить текущий frontend WIP;
2. создать чистую integration branch;
3. переносить backend commits по одному;
4. после каждого переноса выполнять security/contract/runtime verification;
5. отдельно проверить frontend/backend semantic compatibility.

## 4. Критические находки P0

## P0-1. Несовместимый auth-контракт frontend/backend

Затронутые файлы:

- `frontend/src/lib/storage.ts`;
- `frontend/src/api/token.ts`;
- `frontend/src/api/client.ts`;
- `frontend/src/features/auth/AuthProvider.tsx`;
- `apps/accounts/auth_views.py`;
- `apps/accounts/views.py`;
- `apps/accounts/tests.py`;
- `config/urls.py`.

Frontend:

- хранит access-token только в module memory;
- удаляет старый access-token из localStorage;
- не сохраняет refresh-token;
- отправляет `{}` на `/api/auth/token/refresh/`;
- использует `withCredentials: true`, ожидая refresh-cookie;
- вызывает `/api/auth/logout/`.

Backend:

- SimpleJWT login возвращает `access` и `refresh` в JSON;
- refresh endpoint ожидает `{"refresh": "<token>"}`;
- refresh-cookie не устанавливается;
- logout endpoint не зарегистрирован;
- backend-тесты прямо проверяют JSON-based refresh rotation.

Сценарий отказа:

1. Пользователь входит в систему.
2. Access-token сохраняется только в памяти вкладки.
3. Пользователь перезагружает страницу или access-token истекает.
4. Frontend вызывает refresh endpoint с пустым body.
5. Backend не видит refresh-token и возвращает ошибку.
6. Frontend очищает session state и переводит пользователя в logout.

Почему E2E не обнаружил проблему:

- Playwright перехватывает `/api/auth/token/refresh/`;
- тест вручную возвращает новый access-token;
- реальный backend refresh-контракт не проверяется browser flow.

Требуемое исправление:

Выбрать один контракт и применять его сквозным образом.

Рекомендуемый вариант:

- короткоживущий access-token только в памяти;
- refresh-token в `HttpOnly`, `Secure`, `SameSite` cookie;
- CSRF-защита для cookie-based mutation;
- backend login/social/signup устанавливает refresh-cookie;
- refresh endpoint читает cookie и ротирует ее;
- logout endpoint blacklists refresh-token и удаляет cookie;
- немокированный E2E проверяет login → reload → refresh → logout → reuse rejection.

Альтернатива — хранить refresh-token на клиенте, но она увеличивает последствия XSS и требует особенно строгой CSP/XSS-защиты.

## P0-2. Object-level permissions фактически не используют obj

Затронутые файлы:

- `apps/businesses/access.py`;
- `apps/core/viewsets.py`;
- serializers CRM-приложений.

`can(user, business, resource, action, obj=None)` принимает `obj`, но permission decision не использует объект или proposed state.

`TenantModelViewSet` вызывает `assert_can(..., obj=serializer.instance)`, однако это не добавляет реальной object-level защиты.

Текущая OWN/TEAM логика в основном применяется к list/retrieve queryset через `scope_queryset`, но этого недостаточно для:

- create;
- partial update;
- переназначения owner/assignee/responsible_user;
- смены связанных объектов;
- bulk mutation;
- lifecycle actions.

Сценарий риска:

Пользователь с OWN scope не видит чужую сущность в списке, но может передать ID другого активного сотрудника или внешней сущности при create/update, если serializer отдельно это не запрещает.

Требуемое исправление:

- object/proposed-state permission helpers;
- проверка actor membership;
- проверка текущего owner/assignee;
- проверка нового owner/assignee;
- same-business validation всех relation IDs;
- отдельные tests: happy path, permission denial, tenant isolation.

## P0-3. Cross-tenant relation injection в CRM и membership serializers

### DealSerializer

Файл: `apps/crm/serializers.py`.

Текущий serializer проверяет:

- stage/pipeline pairing;
- business stage;
- активность owner membership.

Не полностью проверяется, что переданные:

- `client`;
- `lead`;
- `pipeline`

принадлежат тому же Business, что и Deal.

Риск:

Пользователь с правом создания Deal в Business A может попытаться передать ID Client/Lead/Pipeline из Business B.

### BusinessMemberSerializer

Файл: `apps/businesses/serializers.py`.

Проблемы:

- `fields = "__all__"`;
- отсутствует полный `validate`;
- generic endpoint может принимать business/user/business_role/role/is_active;
- не гарантируется, что business_role принадлежит выбранному business;
- изменение membership business/user недостаточно защищено.

### TeamMemberSerializer

Необходимы проверки:

- team и membership принадлежат одному business;
- membership активен;
- actor имеет право управлять team;
- нельзя использовать foreign membership ID.

### BotConversationSerializer

Файл: `apps/bots/serializers.py`.

Generic serializer оставляет изменяемыми:

- client;
- lead;
- deal;
- assigned user;
- status;
- handoff/lifecycle поля.

Часть relation validation присутствует, но generic update критических полей должен быть закрыт. Изменения должны проходить через явные services/actions.

## P0-4. Дублирование уведомлений при конкурентных workers

Файл: `apps/notifications/delivery.py`.

`process_due_notifications`:

- выбирает pending rows;
- не делает атомарный claim;
- не использует compare-and-set или `select_for_update(skip_locked=True)`;
- отправляет до надежной фиксации ownership конкретным worker.

Два workers могут выбрать одну запись и отправить два уведомления.

Также:

- failure сразу переводится в FAILED;
- нет нормальной bounded retry policy;
- нет attempt scheduling/backoff;
- нет dead-letter/recovery workflow.

Требуемое исправление:

- claim token / claimed_at / worker ID;
- атомарный переход PENDING → PROCESSING;
- `select_for_update(skip_locked=True)` на PostgreSQL;
- attempts/max_attempts/next_attempt_at;
- exponential backoff с jitter;
- idempotency key для provider delivery;
- recovery зависших PROCESSING rows;
- metrics по retry/failure/latency.

## P0-5. Automation runtime может повторять уже выполненные действия

Файл: `apps/automations/engine.py`.

Проблемы:

- due runs выбираются без безопасного конкурентного claim;
- RUNNING устанавливается без надежного compare-and-set;
- run сохраняет финальный результат после цикла;
- progress по отдельным действиям не фиксируется как durable checkpoint;
- если действие 1 выполнилось, а действие 2 упало, retry может повторить действие 1;
- WAIT не реализует полноценное resume-поведение;
- unsupported action может привести к misleading success.

Последствия:

- повторное создание CRM-сущностей;
- повторная отправка сообщений/уведомлений;
- двойное перемещение по этапам;
- ложный SUCCESS для невыполненной автоматизации.

Требуемое исправление:

- atomic claim;
- `current_action_index`;
- durable action execution records;
- idempotency key для каждого side effect;
- WAIT как отложенный resume;
- unsupported action должен отклоняться serializer/runtime;
- recovery зависших runs;
- concurrency и replay tests.

## P0-6. AI critical tool calls не имеют exact-once гарантии

Файлы:

- `apps/ai_core/tool_registry.py`;
- `apps/ai_core/views.py`;
- `apps/ai_core/models.py`.

`execute_tool_call` не защищен полноценным transaction/claim/idempotency механизмом.

Параллельные запросы или повтор после timeout могут дважды выполнить критическое действие.

Для AI это особенно важно, потому что:

- пользователь мог нажать повторно;
- браузер/API gateway может повторить запрос;
- provider timeout не означает, что действие не произошло;
- approval сам по себе не обеспечивает exact-once.

Требуемое исправление:

- immutable tool call identity;
- status transition через atomic compare-and-set;
- idempotency key;
- row locking;
- повторный execute возвращает прежний результат;
- отдельная обработка unknown outcome;
- audit trail до и после side effect.

## P0-7. Outbound messaging выполняется до надежного durable commit

Файл: `apps/bots/inbox_service.py`.

Текущий flow:

1. выполнить provider `send_message`;
2. затем сохранить outbound message/result.

Если provider принял сообщение, но процесс упал до записи в БД:

- клиент не знает, что отправка состоялась;
- retry отправит сообщение повторно;
- история ZANI и provider расходятся.

Решение уже существует в недоставленном commit `c82f345`: transactional outbound outbox.

Необходимая модель:

1. HTTP/domain transaction создает outbound command;
2. commit;
3. worker claim;
4. provider delivery с idempotency key;
5. SENT/FAILED/UNKNOWN;
6. retry/reconciliation.

## P0-8. Celery queues и periodic runtime не завершены

Затронутые файлы:

- `config/settings.py`;
- `docker-compose.yml`;
- `apps/automations/tasks.py`;
- `apps/pricing/tasks.py`.

Настроены route names:

- `integrations`;
- `automations`;
- `notifications`;
- `ai`;
- `reports_exports`.

Но compose:

- основной worker запускается без явного списка необходимых named queues;
- integrations и AI workers находятся в optional profile;
- нет отдельного automations worker;
- нет отдельного notifications worker;
- нет reports_exports worker;
- в текущем коде notification Celery tasks отсутствуют;
- `CELERY_BEAT_SCHEDULE` пуст, кроме опционального Kaspi pricing.

Production-эффект:

- due automations могут не запускаться;
- уведомления могут не доставляться;
- scheduled jobs не выполняются;
- очередь внешне выглядит «принятой», но задача остается необработанной.

Требуемое исправление:

- объявить явную topology очередей;
- отдельные worker commands/profiles;
- Celery beat schedules;
- queue depth/age metrics;
- liveness/readiness;
- smoke task для каждой очереди;
- документация autoscaling и recovery.

## P0-9. AI audit logs изменяемы через generic API

Затронутые файлы:

- `apps/ai_core/serializers.py`;
- `apps/ai_core/views.py`.

`AIRequestLogSerializer` и `AIToolCallLogSerializer` используют `fields="__all__"` и оставляют почти все поля writable.

`AIRequestLogViewSet` наследует generic CRUD.

Риск:

- создание ложных системных логов;
- изменение provider/model/tokens/status/input/output;
- удаление или подмена audit evidence;
- невозможность доказать, что действие действительно инициировал AI/runtime.

Требуемое исправление:

- read-only viewsets;
- системное создание только из services;
- запрет update/delete;
- safe output serialization;
- отдельный retention/export механизм;
- admin также read-only;
- permission и immutability tests.

## 5. Важные находки P1

## P1-1. Misleading lead convert-client контракт

Файлы:

- `apps/leads/views.py`;
- `apps/leads/services.py`;
- `frontend/src/api/leads.ts`.

Lead уже связан с Client. Endpoint `convert-client` не выполняет реальную конвертацию, а возвращает существующего клиента и пишет activity/audit.

Повторный вызов:

- не меняет бизнес-состояние;
- создает повторный шум в activity/audit;
- вводит frontend и разработчиков в заблуждение.

Cleanup-ветка B6 удаляет этот контракт.

## P1-2. Task recurrence объявлена, но не реализована

Task serializer/model принимают `recurrence_rule`, хотя runtime повторяющихся задач отсутствует.

Риск:

- API принимает данные, которые не исполняются;
- UI может показывать обещание повторения;
- пользователь считает задачу настроенной, но следующая задача не создается.

До реализации recurrence непустое значение следует отклонять явной validation error.

## P1-3. Automation actions принимаются шире, чем поддерживает runtime

Serializer допускает action types, которые `_execute_action` не умеет исполнять.

Unsupported action не должен считаться успешным результатом.

Необходимо:

- единый registry supported actions;
- serializer choices из runtime registry;
- startup/system check на совпадение;
- unsupported → validation/runtime failure;
- versioning automation definitions.

## P1-4. Credentials зависят от Django SECRET_KEY

Файлы:

- `apps/integrations/connectors.py`;
- `docs/integrations.md`.

Текущая схема:

- генерирует salt;
- создает stream из `SECRET_KEY`;
- XOR plaintext;
- подписывает envelope через Django signing.

Плюсы:

- raw secret не хранится открытым текстом;
- envelope имеет integrity protection;
- API отдает только masked values.

Риски:

- ротация `SECRET_KEY` ломает расшифровку всех connector credentials;
- отсутствует key versioning;
- нет dual-read периода;
- нет отдельного credential encryption key;
- компрометация SECRET_KEY одновременно затрагивает Django signing и credentials.

Для production:

- KMS/Vault/managed secret manager;
- envelope encryption;
- key IDs/versioning;
- rotation workflow;
- audit доступа;
- controlled re-encryption.

## P1-5. Возможен DNS rebinding для outbound webhooks

Файл: `apps/integrations/webhooks.py`.

Текущий код:

1. разрешает hostname через `socket.getaddrinfo`;
2. отклоняет private/local addresses;
3. затем `urlopen` повторно разрешает hostname.

Между проверкой и подключением DNS-ответ может измениться.

Варианты исправления:

- egress proxy с network policy;
- allowlist;
- HTTP client, связывающий validated IP и Host/SNI;
- повторная проверка peer address;
- запрет redirect на private networks;
- outbound network isolation.

## P1-6. Webhook delivery синхронный и имеет слабый retry lifecycle

Файл: `apps/integrations/webhooks.py`.

Плюсы:

- HTTPS enforcement;
- local/private IP rejection;
- signing;
- idempotency key;
- timeout;
- sanitized response/error.

Проблемы:

- network call выполняется синхронно;
- claim для параллельного retry отсутствует;
- `next_retry_at` ставится в `now`, без backoff;
- manual retry и конкурентный retry могут пересечься;
- catch tuple включает `Exception`, делая остальные типы избыточными;
- неизвестный исход timeout не отделен от гарантированного failure.

## P1-7. Известные уязвимости Python-зависимостей

Команда:

```powershell
.\.venv\Scripts\python.exe -m pip_audit -r requirements.txt
```

Результат:

- `cryptography 46.0.7`;
- advisory: `GHSA-537c-gmf6-5ccf`;
- fix version: `48.0.1`.

Текущий constraint:

```text
cryptography>=42.0,<47.0
```

Он не позволяет установить исправленную версию.

Необходимо:

- проверить compatibility с cryptography 48;
- обновить constraint;
- зафиксировать разрешенные версии lock/constraints;
- добавить `pip-audit` в CI/release gate.

## P1-8. Известные уязвимости frontend-зависимостей

Команда:

```powershell
npm audit --omit=dev
```

Результат:

- total: 3;
- high: 2;
- low: 1.

Пакеты:

- `axios 1.16.0` — high, direct dependency;
- `brace-expansion 5.0.6` — high, transitive;
- `dompurify 3.4.11` — low, transitive через PostHog.

Необходимо:

- выполнить контролируемое обновление lockfile;
- повторить build/E2E;
- проверить axios interceptors/refresh;
- добавить `npm audit --audit-level=moderate` в CI;
- настроить Dependabot/Renovate или эквивалент.

## P1-9. Python dependencies не имеют lock/constraints

`requirements.txt` содержит широкие диапазоны:

- Django `>=5,<6`;
- DRF `>=3.15,<4`;
- Celery `>=5.3,<6`;
- Redis `>=5,<6`;
- другие.

Два install в разные даты могут получить разные версии.

Результат:

- локальные тесты проходят на одной комбинации;
- production может получить другую комбинацию;
- rollback образа не равен rollback зависимостей;
- vulnerability fix может неожиданно изменить runtime.

Решение:

- `requirements.in` + hashed `requirements.txt` через pip-tools;
- либо uv/Poetry lock;
- отдельное контролируемое обновление lock;
- reproducible Docker build.

## P1-10. CI не покрывает важные release gates

Файл: `.github/workflows/ci.yml`.

CI выполняет:

- install backend dependencies;
- migration check;
- Django check;
- production readiness JSON smoke;
- `python manage.py test`;
- frontend `npm ci`;
- frontend build.

CI не выполняет:

- `pip-audit`;
- `npm audit`;
- Playwright;
- bundle budget;
- `git diff --check`;
- Ruff/Flake8;
- mypy/pyright;
- Bandit или другой SAST;
- coverage threshold;
- PostgreSQL service;
- Redis/Celery worker smoke;
- production-readiness `--fail-on-critical` в production-like job;
- Docker image build/smoke;
- migration apply/rollback test.

## P1-11. Observability недостаточна для production incident response

Текущая ветка имеет базовый logging и optional Sentry, но не обеспечивает полностью:

- correlation/request ID;
- tenant-safe structured logs;
- stable API error envelope;
- release/version correlation;
- worker/task correlation;
- provider request correlation;
- automation run/action correlation;
- audit-to-log linking;
- queue age/error metrics.

Hardening-ветка содержит часть инфраструктуры structured logging/correlation, но она не доставлена.

## P1-12. Performance hotspots

### Analytics by source

Файл: `apps/analytics/reports.py`.

В цикле по lead sources выполняются отдельные filters/aggregates.

Решение:

- один grouped aggregate;
- conditional counts;
- query-count test.

### Owner/team CRM metrics

Файл: `apps/analytics/crm_metrics.py`.

Для каждого visible member выполняются дополнительные counts. Количество запросов растет с числом сотрудников.

Решение:

- grouped annotations;
- precomputed subqueries;
- query count должен быть почти независим от размера команды.

### Client merge

Файл: `apps/clients/services.py`.

Для каждого переносимого tag/custom field выполняются existence queries.

Решение:

- заранее получить existing IDs/keys;
- bulk create/update;
- сохранить audit/transaction semantics.

### CRM stage counts

Файл: `apps/crm/views.py`.

Counts выполняются в цикле по stages.

Решение:

- grouped `values(stage_id).annotate(count=...)`;
- заполнить нулевые stage counts в памяти.

## 6. Структурные находки P2

## P2-1. Крупные frontend-файлы

На момент аудита:

- `frontend/src/lib/i18n/kk.ts`: около 5271 строки;
- `frontend/src/lib/i18n/ru.ts`: около 5263;
- `frontend/src/lib/i18n/en.ts`: около 5238;
- `frontend/src/features/settings/SettingsPage.tsx`: около 2696;
- `frontend/src/types/index.ts`: около 1895;
- `frontend/src/features/conversations/ConversationsPage.tsx`: около 1876;
- `frontend/src/features/calendar/CalendarPage.tsx`: около 1424;
- `frontend/src/features/dashboard/OwnerDashboard.tsx`: около 1015;
- `frontend/src/app/router.tsx`: около 993;
- `frontend/src/features/outreach/OutreachPage.tsx`: около 852.

Риски:

- высокий conflict surface;
- трудно локализовать side effects;
- сложно тестировать отдельные обязанности;
- растет вероятность duplicate logic;
- review становится поверхностным.

Рекомендуемое разбиение:

- page orchestrator;
- feature hooks;
- query/mutation hooks;
- sections;
- forms;
- tables;
- dialogs/drawers;
- API DTO adapters;
- route definitions по feature;
- type modules по domain.

Разбивать следует маленькими behavior-preserving шагами после P0/P1.

## P2-2. Крупные backend production-файлы

Примеры:

- `apps/core/import_export.py`: около 784 строк;
- `apps/scheduling/services.py`: около 643;
- `apps/outreach/services.py`: около 626;
- крупные views/services integrations/businesses/conversations.

Рекомендуемое направление:

- selectors;
- command services;
- policy/validation helpers;
- provider adapters;
- import parsers;
- export builders;
- orchestration services;
- небольшие view endpoints.

Нельзя механически дробить файл без characterization tests: это может изменить transaction boundaries, ordering, audit и side effects.

## P2-3. i18n поддерживается тремя крупными объектами

Проверка parity проходит: по 4451 ключу в RU/KK/EN.

Но ручная синхронизация трех файлов:

- повышает merge conflicts;
- усложняет поиск unused keys;
- делает изменение одной feature дорогим;
- не обеспечивает namespace ownership.

Рекомендация:

- разбить translations по feature namespaces;
- генерировать агрегат;
- сохранить parity check;
- добавить unused/missing key reporting.

## P2-4. Output artifacts находятся в repository/build context

На момент аудита:

- tracked `output/`: 60 файлов, около 31.8 MB;
- локальный `output/`: 1086 файлов, около 254.35 MB;
- `output/` отсутствует в `.gitignore`;
- `output/` отсутствует в `.dockerignore`;
- Dockerfile делает `COPY . .`.

Последствия:

- раздувается Git;
- раздувается Docker build context;
- медленнее CI;
- возможна утечка screenshots/debug fixtures;
- больше случайных untracked файлов.

Решение:

- определить, какие artifacts действительно являются документацией;
- перенести нужные в контролируемый docs/assets каталог;
- удалить generated output из tracking отдельным согласованным cleanup commit;
- добавить `output/`, Playwright artifacts и временные reports в ignore;
- использовать multi-stage/minimal Docker context.

## P2-5. Root package noise

В корне присутствует пустой/неиспользуемый `package-lock.json` при отсутствии root `package.json`.

Это создает неоднозначность:

- где выполнять npm install;
- какой lock является authoritative;
- может ли CI ошибочно использовать root.

Authoritative frontend lock должен быть только `frontend/package-lock.json`, если root Node workspace не используется.

## 7. Положительные стороны кодовой базы

Аудит не выявил необходимости переписывать проект с нуля.

Сильные стороны:

- предметное разделение Django apps;
- существующая permission matrix;
- tenant-aware base viewset;
- services/selectors в ключевых CRM-зонах;
- CRM audit/activity infrastructure;
- lifecycle actions для многих сущностей;
- frontend API-layer separation;
- отсутствие raw API calls в React components по проверенному source scan;
- отсутствие явных TypeScript `any` в проверенном scan;
- provider-specific integrations находятся за adapters;
- public webhook rate limiting;
- webhook signatures для Meta;
- Telegram shared secret verification;
- integration payload/error sanitization;
- connector credential masking;
- inbound BusinessEvent deduplication;
- provider timeouts присутствуют;
- external providers выключены по умолчанию;
- frontend i18n parity check;
- bundle budget;
- Playwright infrastructure;
- production-readiness/paid-beta commands;
- backup/provider/operations readiness models;
- миграции согласованы;
- полный backend suite проходит;
- frontend production build проходит;
- merge-conflict markers не обнаружены;
- `git diff --check` проходит.

## 8. Deployment и infrastructure audit

## 8.1. Docker startup выполняет migrations

Файлы:

- `Dockerfile`;
- `docker-compose.yml`.

Web startup выполняет:

```text
python manage.py migrate
python manage.py collectstatic
gunicorn ...
```

Риски:

- несколько web replicas одновременно запускают migrate;
- long migration блокирует readiness;
- failure migration циклически перезапускает web;
- rollback приложения не обязательно откатывает schema;
- web service получает лишние DB migration privileges.

Рекомендация:

- one-shot migration/release job;
- отдельный collectstatic/build step;
- web image запускает только gunicorn;
- expand/contract migrations;
- проверенный backup/rollback plan.

## 8.2. Docker context слишком широкий

Dockerfile:

```dockerfile
COPY . .
```

При недостаточном `.dockerignore` в image/build context попадают:

- output artifacts;
- landing assets, если они не нужны backend image;
- tests/docs;
- локальные временные файлы.

Решение:

- multi-stage build;
- копировать только runtime-required backend files;
- frontend собирать отдельно;
- строгий `.dockerignore`;
- non-root user;
- read-only filesystem, где возможно.

## 8.3. Local production-readiness configuration

`production_readiness_audit --format=json`:

- pass: 6;
- warn: 1;
- fail: 10.

Local critical failures:

- placeholder/weak SECRET_KEY;
- `ALLOWED_HOSTS=['*']`;
- production HTTPS CORS/CSRF origins не заданы;
- secure cookie/SSL redirect/proxy header не настроены;
- support grants не обязательны;
- SQLite вместо managed TLS PostgreSQL;
- non-TLS Redis URL;
- automations inline;
- object storage выключен;
- Sentry не настроен.

Это результат текущего development environment, а не доказательство состояния неизвестного production environment. Но поскольку staging/production config не предоставлен, все эти пункты считаются неподтвержденными release blockers.

## 8.4. Paid-beta gate

`paid_beta_gate_check --format=json`:

- `allowed: false`;
- pass: 1;
- fail: 10.

Не подтверждены:

- deployed staging smoke;
- staging browser E2E;
- production readiness;
- TLS Redis/Celery;
- object storage;
- Sentry;
- transactional email;
- backup/restore drill;
- support grant flow;
- operations health.

## 8.5. Provider rollout

`provider_rollout_readiness_check --format=json`:

- ready: 7;
- warning: 1;
- blocked: 0;
- enabled: 2.

Положительно:

- disabled external providers не считаются ошибочно готовыми к live traffic;
- adapters/catalog/credentials/BusinessEvent/idempotency/health foundations существуют.

Ограничение:

Результат не подтверждает реальные provider calls, webhooks, token rotation, App Review, retries или production observability.

## 9. Результаты выполненных проверок

## 9.1. Backend

### Django system check

Команда:

```powershell
$env:DATABASE_URL='sqlite:///db.sqlite3'
.\.venv\Scripts\python.exe manage.py check
```

Результат:

- успешно;
- system check issues: 0.

### Migration drift

Команда:

```powershell
$env:DATABASE_URL='sqlite:///db.sqlite3'
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
```

Результат:

- успешно;
- незаписанные изменения моделей не обнаружены.

### Полный pytest

Результат:

- `441 passed`;
- `7 warnings`;
- длительность: `817.90s` / 13 минут 37 секунд.

Warnings включали:

- слабый тестовый JWT HMAC key;
- Django warning по override DATABASES.

Эти warnings не вызвали падение, но production secrets должны быть сильными.

### pip check

Результат:

- успешно;
- broken installed dependency relations не обнаружены.

### pip-audit

Результат:

- failure;
- 1 известная уязвимость;
- `cryptography 46.0.7`;
- fix: `48.0.1`.

## 9.2. Frontend

### Production build

Команда:

```powershell
cd frontend
npm run build
```

Результат:

- TypeScript/Vite build успешно;
- widget build успешно;
- i18n parity успешно;
- RU/KK/EN: по 4451 ключу.

### Bundle budget

Команда:

```powershell
cd frontend
npm run check:bundle
```

Результат:

- успешно;
- app-shell: около 461.5 KB raw;
- app-shell: около 145.2 KB gzip;
- запас до raw budget небольшой.

### npm audit

Команда:

```powershell
cd frontend
npm audit --omit=dev
```

Результат:

- failure;
- 2 high;
- 1 low.

### Playwright mobile smoke

Команда:

```powershell
npx playwright test --project=mobile-chromium -g "mobile (owner|manager) smoke"
```

Результат:

- 2 passed;
- около 59.5 секунды.

### Playwright entity workspaces

Команда:

```powershell
npx playwright test --project=desktop-chromium frontend/e2e/entity-workspaces.spec.ts
```

Результат:

- 1 passed;
- около 40.5 секунды.

Ограничение:

Auth refresh в этих flows мокируется/обходится, поэтому несовместимость реального cookie/JSON-контракта не покрыта.

## 9.3. Repository integrity

Проверено:

- merge-conflict markers не найдены;
- `git diff --check` успешно;
- источник содержит большой существующий dirty diff;
- output artifacts не изолированы.

## 10. Что не было проверено

Из-за отсутствия production/staging credentials и инфраструктуры не проверялись:

- реальный managed PostgreSQL;
- TLS Redis;
- одновременно работающие Celery workers;
- queue routing в развернутом окружении;
- database connection pooling;
- Postgres-specific locking;
- backup/restore drill;
- point-in-time recovery;
- private S3/object storage;
- Sentry event/release/correlation;
- реальный SMTP;
- Telegram webhook live traffic;
- Meta WhatsApp/Instagram live traffic;
- Meta App Review permissions;
- реальные AI providers;
- provider timeout/retry/reconciliation;
- production/staging browser E2E;
- DAST;
- внешний penetration test;
- нагрузочные/soak tests;
- chaos/failure injection;
- horizontal scaling;
- zero-downtime migration;
- rollback release;
- frontend real-device matrix;
- accessibility audit всего `/app`;
- coverage percentage/threshold;
- full static analysis Ruff/mypy/Bandit.

Отдельно не дублировался CI command `python manage.py test`, поскольку полный pytest suite уже был выполнен. Перед release CI-команда также должна проходить в чистом checkout.

## 11. Почему зеленые тесты не означают production readiness

Текущие 441 тест проходят, но:

- security tests из недоставленной B0–B5 ветки отсутствуют в активном проекте;
- hardening test suite не является частью текущего HEAD;
- frontend browser tests мокируют refresh;
- SQLite не воспроизводит PostgreSQL locking/concurrency;
- нет двух Celery workers в тестах;
- provider network side effects в основном mock;
- нет retry/crash injection;
- CI не запускает dependency audits;
- текущий working tree не является чистой release revision.

Тесты доказывают, что текущие покрытые сценарии работают. Они не доказывают отсутствие непокрытых дефектов и не заменяют production-like verification.

## 12. Рекомендуемый план исправления

## Этап 0. Стабилизация исходного состояния

Цель: получить чистую и воспроизводимую integration base.

Действия:

1. Инвентаризировать 157 modified files.
2. Отделить завершенные frontend changes от экспериментов/output.
3. Зафиксировать пользовательские изменения отдельным commit/branch.
4. Удалить generated output из будущего tracking после согласования.
5. Создать clean integration branch.
6. Зафиксировать baseline commands и результаты.

Gate:

- clean Git status;
- backend tests;
- frontend build;
- diff check.

## Этап 1. Доставка security hardening

Действия:

1. Перенести `e45d119`.
2. Разрешить `apps/businesses/access.py` вручную.
3. Проверить foreign relations.
4. Проверить membership/team writes.
5. Сделать AI logs read-only.
6. Закрыть generic BotConversation mutation.
7. Добавить dedicated frontend-compatible actions.

Gate:

- happy path;
- permission denial;
- tenant isolation;
- full backend;
- frontend build;
- targeted browser tests.

## Этап 2. Auth contract

Действия:

1. Утвердить cookie или JSON contract.
2. Реализовать backend/frontend согласованно.
3. Добавить logout.
4. Ротация и blacklist refresh-token.
5. Проверить CORS/CSRF/SameSite.
6. Добавить browser tests без refresh mock.

Gate:

- login;
- page reload;
- expiry refresh;
- concurrent 401 refresh;
- rotated token reuse rejection;
- logout;
- social login;
- signup;
- cross-origin production-like smoke.

## Этап 3. CRM contract cleanup

Действия:

1. Перенести B6 cleanup.
2. Удалить no-op convert-client.
3. Отклонять unsupported automation actions.
4. Отклонять неработающий recurrence_rule.
5. Синхронизировать API/types/i18n/docs.

Gate:

- contract tests;
- frontend build;
- no old route/client helper;
- API schema review.

## Этап 4. Runtime reliability

Действия:

1. Notification atomic claims/retries.
2. Automation atomic claims/checkpoints/resume.
3. AI tool exact-once.
4. Outbound outbox.
5. CRM command idempotency.
6. Webhook queued delivery/retry.
7. Recovery stuck rows.

Gate:

- concurrent worker tests;
- retry/replay tests;
- crash between provider call and DB commit;
- duplicate request tests;
- PostgreSQL integration tests.

## Этап 5. Celery topology

Действия:

1. Явно объявить queues.
2. Добавить workers для automations/notifications/reports.
3. Настроить beat schedules.
4. Добавить smoke task для каждой очереди.
5. Добавить queue metrics/alerts.
6. Обновить compose/deployment docs.

Gate:

- каждая queue потребляется;
- scheduled jobs запускаются;
- failed tasks видны;
- graceful restart;
- no task loss.

## Этап 6. Dependencies и CI

Действия:

1. Обновить cryptography.
2. Обновить npm lock.
3. Ввести Python lock.
4. Добавить pip/npm audits.
5. Добавить bundle gate.
6. Добавить Playwright.
7. Добавить PostgreSQL/Redis service jobs.
8. Добавить Docker build/smoke.
9. Добавить lint/type/security/coverage gates.

Gate:

- zero known high/critical vulnerabilities;
- reproducible install;
- CI соответствует release checklist.

## Этап 7. Performance

Действия:

1. Зафиксировать query budgets.
2. Устранить N+1 analytics/team/stages/merge.
3. Проверить pagination/export bounds.
4. Проверить worker throughput.
5. Проверить frontend request waterfalls.
6. Проверить app-shell growth.

Gate:

- query counts;
- p95 API latency;
- queue throughput/age;
- bounded exports;
- agreed bundle budgets.

## Этап 8. Структурный рефакторинг

Только после закрытия P0/P1:

- дробить крупные frontend pages;
- разделить types;
- feature-based i18n;
- разделить backend orchestration/services;
- убрать duplicate/legacy code;
- сохранить behavior через characterization tests.

Принцип:

Один bounded refactor → один branch/PR → один verification gate.

## Этап 9. Production-like staging

Необходимы:

- managed PostgreSQL с TLS;
- managed Redis с TLS;
- private object storage;
- Sentry/release/correlation;
- SMTP;
- production CORS/CSRF/hosts/HTTPS;
- support grants;
- backup/restore;
- real queue workers;
- deployed browser E2E;
- load/soak;
- provider rollout smoke;
- rollback drill.

Финальный gate:

```text
production_readiness_audit --fail-on-critical
paid_beta_gate_check
provider_rollout_readiness_check --fail-on-blockers
```

Релиз допускается только при отсутствии critical blockers и наличии зафиксированных evidence/results.

## 13. Приоритетный реестр

### Немедленно, до любого production release

- консолидировать ветки;
- исправить auth contract;
- закрыть cross-tenant writes;
- закрыть generic critical mutations;
- сделать AI logs immutable;
- atomic claims/retries;
- outbound outbox;
- Celery queue/beat topology;
- устранить high vulnerabilities;
- получить clean release revision.

### До paid beta

- PostgreSQL/Redis/S3/Sentry/SMTP;
- backup/restore;
- support grant flow;
- staging E2E;
- dependency audits в CI;
- production-like concurrency tests;
- provider rollback/reconciliation;
- operations dashboards/alerts.

### После стабилизации

- query optimization;
- крупные file refactors;
- i18n modularization;
- output cleanup;
- Docker image minimization;
- expanded accessibility/device coverage.

## 14. Финальное заключение

ZANI имеет рабочую и достаточно развитую основу. Основной риск возник не из-за одной неудачной архитектуры, а из комбинации длительной параллельной разработки:

- исправления находятся в разных worktree;
- активная ветка не содержит последние backend-hardening commits;
- frontend и backend начали расходиться по контрактам;
- большое рабочее дерево затрудняет доставку;
- тесты покрывают существующее поведение, но не все production failure modes.

Переписывание проекта с нуля не требуется и создаст больше риска.

Безопасная стратегия:

1. стабилизировать Git-состояние;
2. доставить существующий hardening;
3. закрыть auth/tenant/runtime P0;
4. усилить CI и зависимости;
5. проверить production-like staging;
6. только затем выполнять крупный структурный рефакторинг.

После выполнения этих этапов можно говорить не об абстрактной «100% гарантии», а о подтвержденной production confidence: воспроизводимом build, защищенной tenant-модели, идемпотентных side effects, восстановлении после сбоев, наблюдаемости и контролируемом release process.
