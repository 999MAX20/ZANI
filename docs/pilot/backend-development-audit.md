# Аудит границ backend-разработки ZANI

Дата: 2026-09-14. Тип: read-only аудит кода с разрешённой нормализацией документации.
Статус: снимок, не release approval и не новая очередь реализации.

## 1. Вывод

Бэкенд не нужно строить заново. Основные CRM lifecycle, tenant/RBAC, audit,
credential security, automation и fallback-механизмы уже реализованы.
Главная ближайшая работа — завершить текущий пакет AI/channel changes,
согласовать спорные контракты и сертифицировать один воспроизводимый candidate.
Текущий незакоммиченный checkout нельзя объявить pilot-ready: два проверенных
website-chat сценария возвращают 403 вместо ожидаемого 201.

Риск повторной разработки высокий на уровне управления: старые документы
повторно открывают закрытые задачи, названия задач не отражают владение файлами,
а ветка общего каталога меняется во время работы. Это не доказательство того,
что весь backend дублируется в коде; это конкретные условия для повторных правок.

Разделены четыре разных вида остатка:

1. Реализация: текущий AI/channel WIP, синхронные connector sync/retry,
   частичные abuse/file-lifecycle механизмы.
2. Доказательства: FC-003/008, текущий интеграционный gate, live recovery,
   PostgreSQL concurrency и ручная accessibility-проверка.
3. Окружение: PostgreSQL/Redis/workers, storage, SMTP, monitoring, backups.
4. Отложенный продукт: marketplace write-back, 1C, вертикали, recurring tasks,
   полноценные платежи и расширенная аналитика. Они не становятся задачами
   пилота только потому, что упомянуты в старом плане.

## 2. Identity и Git evidence

Аудировался код канонического каталога `C:\Users\user\Desktop\Zani`.
HEAD при первичной и повторной проверке:
`4ba3cbf9fddcc6e1baa172b494c781550c090693`.

| Снимок | Ветка | Рабочие изменения |
| --- | --- | --- |
| Начало аудита | `codex/ai-channel-ownership-hardening` | 55 tracked modified; 5 untracked entries; staged diff пуст; 1480 additions / 654 deletions |
| Повторная проверка во время аудита | `codex/ui-testing-toolkit` | Тот же HEAD; 59 tracked modified; 13 untracked entries, включая каталоги UI toolkit; staged diff пуст; 4313 additions / 766 deletions |
| Проверка перед завершением | `codex/ui-testing-toolkit` | Тот же HEAD; 61 tracked modified; 19 untracked entries; staged diff пуст. Параллельная работа продолжалась |
| Документационный результат | `codex/backend-docs-audit-2026-09-14` | Отдельный worktree от того же HEAD, только Markdown-изменения этого аудита |

Количество untracked entries из `git status --short` не равно количеству файлов
внутри свернутых каталогов. Снимки не являются обещанием неизменности общего
каталога после проверки. Remote/fetch/push и соответствие remote HEAD не проверялись.

Документационный worktree: `C:\Users\user\Desktop\Zani-backend-docs-audit`.
Он не содержит незакоммиченный AI/channel WIP канонического каталога. Все
упоминания WIP ниже относятся к прочитанному основному checkout, а не к коду
в документационной ветке. Чужие изменения не копировались и не откатывались.
Документы этого аудита ещё не объединены с основным checkout; commit/push не выполнялись.

Историческая цепочка evidence:

- `e65e0f4`: интегрированный full gate, 954 Django tests, frontend/mobile/audits.
- `21f5eb0`: BE-GAP-001, immutable tenant ownership; backend gate 960 tests.
- `d4f7c8f`: FC-004/006, full gate 962 Django tests, 1911.2 секунды.
- `4ba3cbf`: последующая документационная reconciliation.

Исторический зелёный gate не распространяется автоматически на нынешние
незакоммиченные lifecycle/channel-boundary файлы.

## 3. Source of truth и границы владения

| Вопрос | Единственный основной владелец ответа |
| --- | --- |
| Правила изменений и завершения | `AGENTS.md`, clean-code rules |
| CRM-инварианты и утверждённая модель | `docs/crm/CRM_PRODUCTION_LAYER_PLAN.md` |
| Какие backend gaps ещё открыты | `docs/pilot/backend-open-logic-register.md` |
| Последовательность pre-pilot | `actual_docs/PRE_PILOT_CODE_READINESS_MASTER.md` |
| Доказательства исправлений | `actual_docs/DEFECT_KNOWLEDGE_BASE.md`, `BACKEND_AUDIT_REMEDIATION_PLAN.md` |
| Функциональная приемка | `actual_docs/APP_FUNCTIONAL_CERTIFICATION.md` и её report |
| Роли и support policy | `docs/security/PERMISSION_MATRIX.md` |
| Live/provider и production acceptance | provider-rollout, production-readiness, paid-beta-gate |

Настоящий аудит объясняет эти источники, но не создаёт вторую независимую
нумерацию задач. Для повторного открытия закрытой задачи нужны новый сценарий
нарушения, точный кодовый путь и отсутствующий regression test.

## 4. Что реализовано: не переписывать

Пути в таблице разрешаются от канонического репозитория. Наличие кода проверено;
если отдельно не указано, полный тестовый набор области в этом аудите не запускался.

| Область | Подтверждённая реализация | Evidence и граница |
| --- | --- | --- |
| Tenant isolation | Scoped querysets, backend permissions, проверки связанных Business; запрет смены owning business через generic update | `apps/core/viewsets.py:233`, `tenant_ownership.py`; BE-GAP-001 закрыт. Это не гарантия безопасности любого будущего endpoint |
| Leads | Domain transitions, назначение, преобразование в связанные CRM-действия | `apps/leads/services.py`; старый отдельный convert-client flow не восстанавливать по архивному checklist |
| Deals | Pipeline/stage validation, won/lost/reopen, owner, amount history | `apps/crm/services.py:42,48,65,84,99`; обычный CRUD не должен обходить domain service |
| Clients | Duplicate detection, merge dry-run, перенос связей | `apps/clients/services.py:21,91,158,204`; это не отсутствующий foundation |
| Calendar | Working hours/overlap guards, create/confirm/cancel/complete/no-show/reschedule, follow-up | `apps/scheduling/services.py:74,180,192,213,225,273`; блокировки в коде не заменяют PostgreSQL concurrency proof |
| Tasks | Центральные lifecycle/assignment/reminder/comment/watchers операции | `apps/tasks/services.py`; recurring execution отдельно не поддерживается |
| Activity и audit | Timeline, domain events, audit чувствительных действий | CRM services и `apps/core/tests_business_flows_e2e.py`; не создавать параллельный журнал событий |
| Auth | Invitations hardening, MFA, refresh/access epoch revocation, sensitive-action step-up | `apps/accounts/mfa.py`, `session_security.py`; privileged policy включает platform_manager |
| Secrets/webhooks | AES-GCM credentials, masked serializers, inbound authentication/dedup, outbound URL/DNS/peer/redirect/response bounds | `apps/integrations/bot_channel_credentials.py`, `webhooks.py`; новый JSON channel ownership WIP — отдельный контроль, не повтор шифрования |
| Automation | Conditions allowlist, idempotency, execution claims/checkpoints, delays/retries | `apps/automations/engine.py`; production workers/recovery остаются отдельным gate |
| Async foundation | Notification, AI jobs, exports, outbound outbox, routing runtime | `config/settings.py:397` и зарегистрированные Celery jobs; не обобщать на connector sync |
| AI | Source context, optional execution, approval/fingerprint/exactly-once guards для tool actions | `apps/ai_core/tool_registry.py:54,99,111`, certification J10; это не автономный AI-директор |
| Imports/exports | CSV preview/import, duplicate handling, queued export foundation | FC J06 и профильные import/export документы; реальные данные этим аудитом не импортировались |
| Fallback | Shared safe error/retry contracts и UI integration, FB-001…007/010 закрыты в своём candidate | FB-008 live failures и FB-009 manual screen reader ещё открыты |
| Billing/files | Entitlement checks, usage/quota, private attachment/upload/download audit foundation | `docs/billing/entitlements.md`, `docs/production/file-storage.md`; не равно платежному процессингу или полностью настроенному object storage |

## 5. Что сейчас реально изменяется

Основной backend WIP — AI-agent readiness/lifecycle и ownership/setup внешних
каналов. Это не новый CRM CRUD-пакет.

- Новые, ещё untracked: `apps/bots/lifecycle.py`, `tests_readiness.py`,
  `apps/integrations/channel_boundary.py`, `tests_channel_ownership.py`,
  `tests_channel_setup_consistency.py`.
- Меняются bot serializers/services/views/AI, credential resolution,
  WhatsApp/Instagram setup и OAuth, onboarding и inbox/auto-pipeline guards.
- Связанные frontend editor/setup изменения входят в тот же пользовательский
  flow. Backend-фаза не может быть принята только потому, что API helper готов.
- По read-only снимку задачи `Critic UI/UX` этот пакет велся там; последний
  отчёт описывает локально завершённую channel-ownership фазу без commit/push.
  Имя задачи «UI/UX» поэтому не означает, что backend-файлы свободны.
- Во время аудита добавлен отдельный UI-testing toolkit WIP. Это изменение
  инструментов проверки, а не доказательство завершения backend-контрактов.

ZD-012/013 и текущий frontend phase follow-up нужно продолжать с существующим
владельцем и конкретным списком файлов. Нельзя параллельно поручать другой задаче
«сделать безопасные Telegram/Meta каналы» без сверки этого пакета.

## 6. Риски и противоречия

### R1. Общий dirty checkout не является release candidate

Смена ветки при том же HEAD оставила смешанные незакоммиченные изменения на месте.
Так можно сертифицировать один набор файлов, а затем случайно включить в commit
другой. Решение процесса: согласованный владелец интеграции, отдельные worktrees,
фиксированный base/candidate SHA и явный WIP manifest. Сам аудит код не переносил.

### R2. Website-chat и AI pause/readiness требуют согласованного контракта

Два существующих E2E-like backend теста воспроизводят HTTP 403 вместо 201:
`apps/bots/tests.py:142` и `:1565`. Новый lifecycle требует active/readiness,
а credential resolver в `apps/integrations/bot_channel_credentials.py:153–166`
ищет ACTIVE bot и проверяет `is_bot_runtime_ready` до приёма входящих сообщений.

Риск: пауза AI блокирует не только AI-ответ, но и inbound transport. Фактическая
потеря сообщений зависит от provider retry/retention; live потери не измерялись.
Не надо автоматически снимать защиту readiness или просто менять expected 201
на 403. Сначала согласовать смысл pause: остановка AI или отключение канала,
а также поведение draft website channel. Затем проверять именно этот контракт.

### R3. Connector sync ошибочно числился полностью queue-backed

`view_actions.py:62 -> services.py:370 -> sync_service.py:44` вызывает provider
handler напрямую (`config["function"](connector)` на строке 49).
`views.py:409 -> retry_connector_sync_run` также идёт в sync/healthcheck напрямую.
Отдельный integrations task dispatcher не найден; `next_sync_at` записывается,
но поиск его использования и beat schedule не обнаружил общего scheduled sync
consumer. Kaspi pricing cycle — другая задача, не универсальный sync scheduler.

Значит, BE-GAP-006 — `PARTIAL / ENV_GATED`, не просто включение Redis.
Остальные queue-backed subsystems не нужно переписывать. Сначала утвердить,
нужен ли live marketplace sync в выбранном пилоте; без него этот путь можно
оставить отключённым. Для обещанного async sync требуется отдельная scoped реализация.

### R4. Support policy не согласована

Матрица допускает platform mutations только для platform_admin;
`apps/core/platform_views.py:319` принимает IsPlatformUser после MFA step-up.
Фактический endpoint пишет support-note AuditLog, а не произвольно меняет CRM.
Это подтверждённый BE-GAP-004 policy conflict, не доказательство полного обхода
tenant isolation. Нужен выбор владельца: разрешённая manager support-note
операция или admin-only mutation. Без него кодовую задачу не выдавать.

### R5. Документы могут возвращать уже исправленные дефекты

- Master/handoff executive snapshots содержали открытый tenant blocker после
  его закрытия; actual_docs index оставлял FC-004/006 partial после PASS.
- CRM execution checklist завершён: 232 `[x]`; 11 `[ ]` в начале — шаблон DoD.
- Старые Telegram/WhatsApp/Instagram runbooks описывали access tokens в
  `BotChannel.config_json`, хотя credential storage уже зашифрован.
- Старый production audit говорил о paid-beta suitability без текущих env gates.
- Старые competitive/readiness планы предлагали снова строить automation retry,
  entitlements, quotas, merge и tenant foundations.

Статусы/инструкции исправлены в документационной ветке; исторические тела
сохранены. Полный реестр: [аудит техдоков](../operations/technical-documentation-audit.md).

### R6. Частичный AI context нельзя обещать как semantic retrieval

`apps/ai_core/context_service.py:4` выбирает максимум 8 активных knowledge items
с сортировкой category/title. Контекст есть, но релевантностный поиск по всей
базе этим не доказан. Это граница текущего продукта, не разрешение начать RAG
переписывание перед пилотом.

## 7. Остаток по действующим документам

| Остаток | Что действительно осталось | Условие пилота |
| --- | --- | --- |
| BE-GAP-001 | Закрыт; не повторять | Регрессионная защита при новых endpoints |
| BE-GAP-002 | Исторический checkpoint закрыт; новый WIP candidate ещё не принят | Зафиксировать новый candidate и gate; старый пункт не объявлять глобально вечнозелёным |
| Текущий ZD-012/013 WIP | Контракт pause/inbound, website flow, editor/onboarding acceptance, интеграция пакета | Принятие изменяемого channel/AI flow до его включения |
| BE-GAP-003 / BE-REM-007 | FC-003 action-level evidence; затем FC-008/final report | Блокирует формальную приемку; FC-004/006 заново не реализовывать |
| BE-GAP-004 | Support-note policy decision и её согласование | До выдачи такого support access |
| BE-GAP-005 / FB-008 | Live auth, duplicate/timeout/rate-limit/partial failure/recovery/rollback proof | Для каждого включаемого provider, не для отключённых |
| BE-GAP-006 | Connector async dispatch/scheduling gap плюс live workers/recovery | До обещания live async sync; локальный eager не production proof |
| BE-GAP-007 | DB/Redis/TLS/storage/SMTP/monitoring/backup restore/deployed smoke | Для paid/live эксплуатации |
| BE-GAP-008 | Adaptive/business-level abuse, challenge/edge rules, backpressure visibility | Ограниченный трафик требует явного принятия риска; широкая public exposure — дополнительные меры |
| BE-GAP-011 | Object storage setup/migration, antivirus, retention/lifecycle/CDN decisions | По production file policy перед реальными вложениями |
| FB-009, UX-4 | Manual screen-reader и оставшаяся browser certification | Межкомандная acceptance-зависимость, не новая backend модель |
| BE-GAP-009/010/012 | Marketplace writes, 1C/future providers, vertical CRM | Отложены; отдельное продуктовое решение |

Дополнительные границы, которые нельзя потерять при архивации старых планов:

- Recurring tasks намеренно отвергаются в `apps/tasks/serializers.py:155`;
  наличие поля не означает наличие scheduler. Это не обещанная pilot функция.
- Billing settings/entitlements не доказывают работающий payment provider,
  invoice settlement и subscription collection. `pilot-safe-promises.md`
  прямо запрещает обещать законченные платежи.
- Polling для inbox/notifications — принятая стратегия в
  `docs/architecture/realtime-strategy.md`. WebSocket/SSE не обязательный rewrite.
- Расширенная аналитика, marketplace writes, вертикали и growth/parser tooling
  не должны расширять pre-pilot CRM scope без отдельного решения.

## 8. Рекомендуемый сценарий разработки

Это предложение последовательности, не автоматическое разрешение на кодовые задачи.

| Шаг | Результат | Gate / защита от повторной работы |
| --- | --- | --- |
| 0. Согласовать границы | Один владелец текущего channel WIP; approved pause/inbound и support-note policy; перечень включённых providers | До кода при неразрешённых contradictions |
| 1. Закончить текущий пакет | Один reachable channel/AI flow с действующими permissions и fallback | Happy path, denial, tenant isolation, readiness, token rotation, stale OAuth result, pause/resume, website ingestion |
| 2. Зафиксировать candidate | Нужные tracked/untracked файлы включены; чужие изменения не смешаны | Clean candidate, migration drift/check, полный backend + изменённые browser flows |
| 3. Закрыть formal acceptance | FC-003 исполняемые expected-result доказательства или обоснованные exclusions; затем FC-008 и BE-REM-007 | Не ставить PASS за существование кнопки/metadata; учитывать изменения после d4f7c8f |
| 4. Controlled pilot | Один согласованный CRM сценарий, реальная небольшая выборка, поддержка, rollback | Не обещать paid/live готовность; отключённые providers остаются честно disabled |
| 5. Выбранный live pilot | Один provider + его workers/environment/recovery evidence | BE-GAP-005/006/007/008/011 в применимом объёме; не запускать все интеграции одновременно |

Приоритет — закончить текущую пользовательскую цепочку, а не начинать общий
«рефакторинг backend», замену ORM, новый service layer или новый AI framework.

## 9. Как ускорить без снижения качества

1. Один writer на пересекающийся набор backend-файлов; параллельно — только
   независимые области. Разные названия задач не создают изоляцию. Отдельные
   checkout для веток поддерживаются штатным [Git worktree](https://git-scm.com/docs/git-worktree).
2. Одна карточка изменения: existing ID, base SHA, владелец, затронутые файлы,
   существующий service, acceptance, permissions/notifications/BusinessEvent/AI/
   migration impact. Не создавать второй roadmap для того же gap.
3. Короткий цикл: focused tests на каждом изменении, dependency-area tests перед
   завершением фазы, полный committed-range gate перед интеграцией. Свежие 54
   targeted tests заняли 22.969s; исторический full gate — 1911.2s. Это разные
   уровни покрытия, не взаимозаменяемые проверки и не обещание ускорения в 83 раза.
4. На Windows использовать существующий `scripts/codex_verify.py`; отсутствие
   Bash не является отсутствием verification path. Не переписывать verify runner.
5. CI уже разделён на backend/frontend и уже имеет pip/npm caches. Не выдавать
   задачи «добавить кеш» повторно. В проверенном `ci.yml` нет concurrency group:
   можно отдельным согласованным изменением отменять устаревшие проверки одного
   PR через [GitHub Actions concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).
   Это не инструкция отменять deploy/production jobs.
6. Сохранять evidence один раз в профильной записи; индексы должны ссылаться,
   а не размножать несовпадающие числа тестов и статусы. Архив — только история.
7. Не использовать `scripts/pilot_smoke_check.sh` для read-only проверки: он
   вызывает migrate и `prepare_pilot_demo --reset`. Проверки должны идти в
   изолированной test DB; очищенную локальную merchant DB не засевать снова.

## 10. Проверки и ограничения этого аудита

В каноническом checkout выполнены в выделенном безопасном окружении:

- `manage.py check` через Django call_command — PASS, issues отсутствуют.
- `manage.py makemigrations --check --dry-run` — PASS, изменений моделей нет.
- Django test labels `apps.integrations.tests_channel_ownership`,
  `apps.integrations.tests_channel_setup_consistency`, `apps.bots.tests_readiness`,
  `apps.core.tests_tenant_isolation` — **54 PASS**, 22.969s.
- `apps.bots.tests.BotsFoundationTests.test_public_website_chat_creates_conversation_message_client_and_lead`
  и `apps.bots.tests.InboxBackendTests.test_public_website_chat_flows_into_inbox_and_manager_reply_updates_state`
  — **2 FAIL**, 2.633s, оба 403 вместо 201.

Runner использовал `scripts.codex_verify.safe_environment`,
`DATABASE_URL=sqlite:///:memory:`, `ALLOWED_HOSTS=testserver,localhost,127.0.0.1`,
test-mode settings и запрет `socket.socket.connect` через mock. Исходная
`db.sqlite3`, очищенные CRM-данные и live providers не использовались.

Это новые проверки текущего локального пакета до последующего переключения
ветки/UI-toolkit changes. Отдельный отчёт предыдущей задачи о 232 PASS / 13
широких baseline failures — историческое WIP evidence, не повторённый здесь
полный прогон. Два website failures воспроизведены самостоятельно и не скрыты
за общим словом «baseline»: cumulative WIP не проходит эти сценарии.

Пропущены: install, frontend build/E2E, полный backend/full gate, applied
migrations, production commands, live provider calls, PostgreSQL concurrency,
load test, screen reader и remote sync. Причина: задача — аудит кода/документов,
checkout продолжает изменяться; эти проверки не заменены узким зелёным набором.
Не проводился исчерпывающий security scan каждого endpoint.

Документационный gate: проверка сохранности всех архивных тел относительно
HEAD, существования redirect/replacement targets, полноты инвентаря и
`git diff --check`. Backend/frontend executable files в audit worktree не менялись.

Результат docs gate: PASS — 26/26 архивных тел совпали с HEAD после удаления
archive banner и нормализации CRLF/LF; 289 локальных Markdown targets существуют;
105/105 исходных документов классифицированы без пропусков и дублей;
69 изменённых/новых Markdown-файлов, 0 application-source изменений;
`git diff --check` чистый. Первая проверка нашла лишние пустые строки в конце
redirects; они исправлены и gate повторён. Исторические относительные ссылки
внутри архивных тел не входят в 289 проверенных актуальных targets.

## 11. Блокер / один следующий шаг

Первое действие владельца: согласовать границу текущего AI/channel пакета и
контракт «пауза AI отдельно от приёма сообщений», не запуская параллельный
переписывающий пакет. Support-note policy решить до использования support роли.
После согласования — продолжать существующую фазу с её владельцем и tests,
а не повторно открывать закрытые BE-GAP-001 или FC-004/006.
