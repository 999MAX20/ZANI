# PRIMARY-SESSION — Platforma.CRM

Дата: 2026-09-21. Это карточка исполнения, не продуктовый backlog.

## Git-пакет — проверенный кандидат и публикационная квитанция (2026-09-21)

- Единственный owner/writer: primary `01a0c36e-33aa-7c72-be9b-72624dd2c739`;
  Оркестратор не пишет. Canonical root `C:\Users\user\Desktop\Zani`, branch
  `codex/ui-testing-toolkit`; один checkout, без новых задач/worktrees/source copies.
- Scope: опубликовать выбранное владельцем каноническое содержимое в
  `origin` (`https://github.com/999MAX20/ZANI.git`), `main`, сохранив обе истории.
  Legacy native mobile/offline/push, theme toggle, старые marketing/public/demo
  страницы сохраняются в истории/резерве, сейчас не переносятся. Рабочие login,
  registration и CRM сохраняются. Force/reset/rebase/deploy не разрешены.
- Start: local `4ba3cbf9fddcc6e1baa172b494c781550c090693`, 192 status entries,
  staged 0; legacy main/base `73482a3bea7f168113c58d8cb928214c97f032d5`.
  246 изменённых/untracked paths явно reviewed и разделены на manifests
  product/toolkit/docs (118/28/100), blind add -A не использовался.
- Commits: product `7fc450e`, toolkit `02fefc7`, docs `0d901be`, разрешённый
  history merge `1e5a85d`; обе исходные истории — предки. Tree до/после merge
  одинаковый `bd9aae25f0c6de216d1b7b63d649f7ea46258e54`: legacy code не внесён.
  `1a9ce8b` нормализует только whitespace четырёх migrations и archived plan;
  AST/non-whitespace совпадают. `25efa55` изолирует test public/private media
  в runner; regression воспроизведён до fix, 15 runner tests PASS после fix.
- Полный integration gate PASS на code candidate
  `25efa559a85f08454cac45199dde52b656d6955a` и указанном реальном legacy base.
  1089 Django tests / 867.841s; check и migration drift PASS; npm ci, Vite env
  isolation, i18n/types, app/widget build, bundle budgets PASS; mobile owner/manager
  smoke 2/2 PASS; hashed prod/dev Python lock dry-run PASS; pip-audit и npm moderate
  audit: 0 известных vulnerabilities; final diff hygiene PASS. Полный log:
  `output/git-publication-20260921/full-gate.log`.
- Среда: Windows, Python 3.12.14, Node 24.18.0, npm 12.0.1; disposable SQLite,
  media и loopback ports, locmem/eager, synthetic identities; live providers
  выключены. CI Python 3.11 / Node 22.22 проверяется отдельно после push.
- Дополнительные gates: runner unit 15/15, continuity hook 16/16, frontend
  sidebar/timeline/toolkit/chromatic helpers 25/25 PASS. Реальный hook trust,
  Chromatic upload, live provider/payment/deployed acceptance и working-DB
  migrations не запускались: вне разрешённого Git-пакета. Полный gate не закрывает
  отдельные FC-003/FC-008/manual/live критерии и не означает приёмку клиникой.
- Backup: `C:\Users\user\Documents\Codex\project-backups\crm-publication-20260921T123341Z`:
  source ZIP 1373 files, CRC + каждый SHA-256 PASS; all-refs bundle verify PASS,
  bundle SHA-256 `77e242a2c2ac59230a4057ee631f5c75ea97dfcc7abe16d54b5e99dda3f01a99`.
  На code candidate 1360 файлов идентичны резерву; 13 намеренных изменений
  перечислены в `output/git-publication-20260921/candidate-proof.json`.
- Review: 138 outgoing local-history commits / 2830 blobs проверены на
  high-signal credentials/private keys; 41 совпадение — placeholders и проверенный
  URL-redaction fixture, unresolved 0. Working .env/DB/media/generated outputs
  не публикуются. Это проверка состава публикации, не новая security certification.
- Push effects: repo workflows выполняют CI, Pages source — gh-pages; доступный
  Render workspace пуст. Владелец прямо подтвердил отсутствие действующих
  autodeploy подключений. Hosting settings/deploy не менялись. Git Workflow Master
  прочитан из `C:\Users\user\Desktop\Agentic Skills\agency-agents-main\engineering\engineering-git-workflow-master.md`;
  проектные ограничения важнее общих примеров. Verification skill применён.
- После code gate допускается только данный docs closeout. Проверить точный
  docs-only delta, ссылки/команды и diff hygiene; runtime evidence переиспользуется
  только при неизменных code/config/lock/test inputs. Новую реализацию не начинать.
- Единственный завершающий шаг: normal `git push origin HEAD:main`, readback SHA,
  фактический CI conclusion для этого SHA. Операционная квитанция обновляется
  отдельно от публикуемого дерева в
  `output/git-publication-20260921/publication-result.json` (candidate/base,
  remote SHA, clean status, команды, CI URL/status). При возобновлении читать её
  вместе с этим checkpoint и свежим Git: queued/pending не равно PASS.
  После подтверждённого success — остановиться; повторный push без нового diff
  и новый продуктовый пакет не нужны. При drift/failed required gate — стоп публикации.
- Следующий продуктовый пакет утверждён как направление, здесь не реализуется:
  специалист бизнеса с расписанием без обязательного CRM-account/login/access,
  новый врач без автоматического пользователя/приглашения; переиспользовать
  пригодный Resource, не дублировать известного специалиста, имя не уникальный ID.
  Это не свободная пометка без guards. Место формы не задано; scheduling/UI/seats/
  AI booking не менялись. Market вне scope. Нужен отдельный запуск следующей фазы.

Точные команды из canonical root (frontend helper — из `frontend`):

```powershell
.\.venv\Scripts\python.exe scripts/codex_verify.py --mode full --base-ref 73482a3bea7f168113c58d8cb928214c97f032d5
.\.venv\Scripts\python.exe -m unittest scripts.tests.test_codex_verify -v
node --test .codex/continuity-hook.test.cjs
node --test scripts/tests/sidebar-navigation-policy.test.mjs scripts/tests/timeline-presentation.test.mjs scripts/tests/ui-toolkit-policy.test.mjs scripts/tests/chromatic-runtime.test.mjs
```

Ниже сохранено evidence предыдущего локального пакета. Его исторические
Git-blocker/pending-решения не переоткрывают уже разрешённые выше вопросы.

## Завершённый локальный пакет — W05/W06 и конечный остаток до пилота

Последнее уточнение scope: довести W05/W06 до текущего gate, затем один список
в `docs/pilot/` с существующими ID, кодом, остатком и критериями завершения.
Не начинать новые блоки реализации из этого списка. Рубеж A — локальная
классическая CRM; рубеж B — передача одной клинике для работы сотрудников с
реальными клиентами/данными: живые WA/Instagram, полноценный ИИ, безопасная
среда и приёмка обязательны. Пилот подтверждён платным: подписка и оплата
использования ИИ обязательны до передачи, коммерческий блок B/P0.
Telegram/форма сайта остаются в платной V1;
их состав именно для пилота ещё не решён. ИИ нужен во всех трёх направлениях
с реальным провайдером, но текущая работа не разрешает активацию/расходы/передачу
реальных данных. Новый опрос не отправлять: вопросы агрегирует Оркестратор.
Узкое разрешённое исключение frontend: убрать только marketplace-карточки
и их пустой фильтр в /integrations через существующий каталог; messaging,
backend и данные сохраняются. Проверки: локальная production build и проверка
реального набора каталога/рендера. Общий UI/UX и создание новых задач запрещены.

- Owner/writer: primary `01a0c36e-33aa-7c72-be9b-72624dd2c739`; Оркестратор
  освободил запись. Режим implementation + verification, последовательная работа.
- Scope: только недостающие внутренние правила утверждённых CRM-процессов V1
  и их backend/API-проверки. Новых задач/агентов/worktrees/смены ветки нет.
- Non-goals: общий frontend/UI/UX (кроме marketplace visibility), AI/provider/live billing, инфраструктура, рабочая БД,
  старый main/mobile/theme/public pages, новый общий аудит и повтор закрытых FC/AUD-027.
- Root: `C:\Users\user\Desktop\Zani`; branch `codex/ui-testing-toolkit`;
  starting HEAD/base `4ba3cbf9fddcc6e1baa172b494c781550c090693`.
- Исходный смешанный WIP: 139 tracked unstaged + 48 untracked status entries,
  staged 0. SHA-256 всех исходных source files и status сохранены в
  `output/v1-internal-backend-20260921/starting-snapshot.json`. Чужой WIP сохранять.
- Delivery: локальный проверяемый delta. Публикация в origin/main заблокирована
  несвязанными историями; не включать чужой WIP в commit и не решать историю самим.

Исходный backend-контракт (W05/W06 локально проверены; пункты 3/4 в inventory,
их реализация сейчас не разрешена):

| Порядок / источник | Незавершённый outcome / тип разрыва | Критерий и проверки |
| --- | --- | --- |
| 1. V1-W05 / V1-F12 | Запрет архива клиента с активной работой: code gap в POST archive и DELETE soft archive | Все незавершённые lead/deal/task/appointment и открытые/ожидающие оператора conversation блокируют; нет каскадного закрытия; завершённая работа допускает архив/restore; API happy/denial/tenant/hidden child, audit и dependent tests |
| 2. V1-W06 | Отключённый сотрудник: неполное актуальное доказательство полного внутреннего цикла | API отключение прекращает доступ только к компании, сохраняет историю/ответственность, руководитель может вручную переназначить; запрет неактивного нового назначения, role/tenant tests; код менять только при воспроизведённом пробеле |
| 3. V1-F06 / V1-W02 | Запись к сотруднику: code/policy delta относительно прежнего необязательного Resource | Нужен ответ о linked_user; затем API создание/перенос, active same-business staff, часы/overlap и permissions; старые lifecycle-механизмы не переписывать |
| 4. V1-M01/M02 / client-payments.md | Локальный manual-payment WIP: evidence delta при существующих операционных циклах | Проверить существующие receipt/partial/refund, права/tenant/idempotency, merge/history, отсутствие автоматической оплаты от завершения услуги и раздельные суммы; спорные формулы не выбирать |

- Вопрос 1 разрешён владельцем в этой задаче: архив блокируют также открытые
  диалоги и диалоги, ожидающие сотрудника. Это уточнение V1-W05, не принятие D-01…D-09.
- Вопрос 2 pending: сотрудник для записи обязан иметь активный CRM-account или
  допустим Resource сотрудника без linked_user. Зависимое изменение не начинать.
- Первый контракт: V1-W05; использовать существующие Client/CRM relations,
  archive helper, domain service, permission checks и activity/audit taxonomy.
  Новые models/endpoints не нужны. Tenant и существующие права сохраняются;
  успешный архив пишет прежние activity/audit, отказ не создаёт effects.
  Notification/BusinessEvent/AI/provider/schema/env changes: none planned.
- Gates: reproducer, затем regression API tests; Django check, migration drift,
  affected/dependent backend suites через существующий isolated_runtime и .venv.
  Только disposable SQLite/locmem/eager, без live providers. Полный committed-range
  gate пока неприменим (base=HEAD); frontend/browser/release acceptance вне scope.
- Выполнено V1-W05: воспроизведён архив при открытой задаче (POST 200 / DELETE 204
  вместо 409); `w05-reproducer.log`. Добавлен service-backed guard обоих путей,
  единое clients:delete, проверки прямых и косвенных связей, отказ без child details.
  Успешное действие атомарно использует прежний archive/activity/audit helper.
- Verified: первоначальный focused suite 11/11 PASS + Django check/drift;
  затем добавлены проверки archived-parent task, unresolved handoff, PATCH bypass
  и rollback. Промежуточный dependent gate: `w05-dependent.log`; финальный ниже.
  Это не повтор одинаковой ошибки: исходный воспроизведённый defect исправлен.
- Own delta пока: apps/clients/lifecycle.py, tests_archive_dependencies.py,
  узкие additions apps/clients/views.py, PRIMARY-SESSION и уточнение V1-W05.
  Старые additions views.py и services.py сохранены, services.py не менялся нами.
- V1-W05 dependent gate: 83 tests, 82 PASS / 1 FAIL, 63.507s; Django check/drift PASS.
  Единственный FAIL: прежний `ArchiveGuardrailTests.test_manager_delete_archives_client_instead_of_hard_delete`
  ожидает менеджеру 204 через DELETE при clients:update, тогда как POST и
  PERMISSION_MATRIX требуют clients:delete/явного разрешения. Это policy conflict,
  не baseline excuse. После рекомендации владелец явно утвердил «Да, единое
  clients:delete». Противоречащий тест теперь разрешено обновить; повторить gate.
- V1-W06 focused: 5/5 PASS, check/drift PASS (`w06-focused.log`), оба membership
  endpoint, ранее выданный JWT, изоляция компаний, история и ручное переназначение.
  Production код W06 не менялся; требуется dependent gate.
- Перед продолжением: HEAD/branch прежние; SHA-256 1369 исходных файлов сверены,
  изменены только собственные views/V1/checkpoint. Неожиданных чужих изменений нет.
- Финальный backend gate W05/W06: 226/226 PASS, 231.486s; check/drift PASS.
  Команда и labels: [inventory](../../pilot/local-crm-completion.md#проверки-этого-поручения),
  лог `output/v1-internal-backend-20260921/w05-w06-final.log`. 16 W05 + 5 W06
  новых тестов; остальное — существующие dependency suites. Старый permission
  FAIL разрешён прямым решением владельца, а не ослаблением защитных assertions.
- Marketplace UI: ровно два узких изменения — фильтр integrationProviderCatalog
  исключает marketplace и удалён пустой group filter. Полный catalog и messaging
  definitions сохранены; backend/data не менялись. Actual catalog + page render
  PASS (context/query mocked), production app/widget build, i18n/types/bundle PASS;
  `frontend-check.py` / `frontend-check.log`. Нового общего UI/UX нет.
- Единый результат: `docs/pilot/local-crm-completion.md` — 9 цельных блоков с
  существующими ID, статусом, точным остатком и полным критерием. A — внутренние
  циклы; B — живая клиника с WA/Instagram, реальным ИИ, безопасной средой и
  приёмкой и обязательным платным commercial cycle. AI provider/model/cost и
  Telegram/форма вопросы агрегирует Оркестратор. Новые блоки
  реализации, внешние вызовы и настройки среды не начинались.
- Own delta: три новых Python-файла (client lifecycle/archive tests, member
  deactivation tests), узкие client views/core archive test, два frontend-файла,
  V1 product clarification, permission matrix, CRM plan/doc index/checkpoint и
  новый inventory. Pre-existing WIP сохраняется; services.py не менялся нами.
- Skip: full committed-range gate (base=HEAD), browser E2E/общая UI-приёмка,
  provider/live/production/CI. Среда проверок disposable SQLite/locmem/eager,
  safe Vite env, providers/telemetry off; working DB не затронута. Не доказаны
  PostgreSQL concurrent child-create/archive races. Нет schema/env/notification/
  BusinessEvent/AI runtime delta. Commit/push не выполнены: unrelated origin/main
  и несогласованный общий candidate остаются блокером публикации.
- Docs/diff/hash closeout PASS: `closeout.py`, `git diff --check`,
  `git diff --cached --check`, новые links/anchors, syntax/hygiene новых файлов.
  1360 исходных non-owned файлов неизменны; SHA-256 собственного diff и всего
  снимка сохранены в `output/v1-internal-backend-20260921/final-snapshot.json`.
- Текущий ограниченный пакет завершён локально; запись остановлена. W05/W06
  не стоят в очереди реализации; общая UI/версионная приёмка отдельно в inventory.
  Следующий шаг: передать конечный список владельцу и ждать следующего поручения.
  После отдельного следующего поручения — staff appointment policy (вопрос pending)
  либо другой утверждённый цельный блок; не реализовывать список автоматически.
- Stop: неожиданный writer/Git drift; unresolved policy для зависимого действия;
  два одинаковых failure без новой гипотезы. UI/E2E и production не объявлять готовыми.

## Историческая передача задач (завершена до поручения выше)

- Основная задача: 01a0c36e-33aa-7c72-be9b-72624dd2c739; .codex/project-session.json — реестр ID.
- Фаза: idle / AWAITING_OWNER_TASK; COMPREHENSION_READY проверен, четыре
  прежние задачи архивированы нативными инструментами с подтверждением.
- Основной исполнитель проекта: 01a0c36e-33aa-7c72-be9b-72624dd2c739.
  Активного продуктового writer нет. Оркестратор завершает только публикацию
  и итоговую проверку своего организационного diff; параллельная запись запрещена.
- Продуктовая реализация: NONE_AUTHORIZED / ожидание следующего поручения.
- Разрешено: handoff, workflow/hook настройки, чтение новым исполнителем,
  проверка понимания и архив старых задач после READY.
- Не разрешено этим поручением: новые функции, исправление старого CI, миграции
  БД, смена ветки, новый worktree, force-push или перенос всего старого backlog.
- Snapshot: codex/ui-testing-toolkit @ 4ba3cbf9fddcc6e1baa172b494c781550c090693, 186 pre-existing status entries.
- Источники/выполненное/остаток: actual_docs/PROJECT_HANDOFF.md; подробные gates в профильных docs.
- Блокер продукта: несвязанные local/origin main истории, решение по уникальным функциям старого main; WIP не публиковать целиком.
- Hooks: REQUIRES_REVIEW_AND_TRUST, фактическое срабатывание в приложении
  не подтверждено. Unit tests не заменяют trust/runtime.
- Собственные изменяющие процессы/БД этой организационной задачи: нет.
- Проверки адаптера: расширенный набор 16/16 PASS (включая незавершённую передачу,
  отключённую ротацию и защиту от повторного создания). Ссылки и JSON проверены.
- Non-owned file preservation: SHA-256 всех остальных исходных файлов совпал
  со снимком до организационных изменений; продуктовый код не менялся.
- Передача 21.09 завершена: создана одна задача в saved project/environment=local,
  проверены продукт, checkout, требования, история/остаток, ограничения и протокол.
- Старые task IDs перечислены в retiredThreadIds реестра, история не удалена.
- Следующий шаг основной задачи: ждать конкретного нового поручения;
  продуктовая разработка и исправление известных блокеров не запускались.
- Stop: разночтение Git/владения, ошибка handoff/comprehension или неизвестный
  результат создания задачи; не создавать дубликаты.
