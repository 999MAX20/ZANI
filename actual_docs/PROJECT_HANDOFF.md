# ZANI Project Handoff

## Действующее правило continuity — уточнение владельца 2026-09-21

Упрощённая настройка ИИ-агента реализована и локально проверена 2026-09-24.
Профиль/знания/поведение → отдельный тестовый диалог → готовность/включение;
пробный диалог использует сохранённые настройки без записей CRM/Inbox.
Scope, проверки и исправления — в
[PRIMARY-SESSION](../docs/testing/task-state/PRIMARY-SESSION.md).
Публикация, remote SHA и actual CI — `output/agent-setup-20260924/result.json`;
только COMPLETE_PUBLISHED_CI_SUCCESS закрывает фазу. После квитанции остановиться.
Реальные каналы, deployment и следующая фаза этим пакетом не разрешены.
Рабочая БД и .env не менялись. Предыдущие пакеты ниже остаются закрытыми.

Пакет V1-A01/A02/A10 возобновлён и локально проверен 2026-09-24.
Код26d0ad8 не изменился: сохранены backend/frontend/mobile/live доказательства,
оставшийся security gate PASS (pip/npm: известных уязвимостей нет). Новые
проверки и точные границы — в
[PRIMARY-SESSION](../docs/testing/task-state/PRIMARY-SESSION.md).
Публикация, remote SHA и actual CI — `output/ai-quality-20260922/result.json`;
только COMPLETE_PUBLISHED_CI_SUCCESS закрывает весь пакет. После успешной
квитанции остановиться: страница настройки агента и реальные каналы отдельно,
новая задача/ротация автоматически не разрешены. Рабочая БД не менялась.

Локально проверен предыдущий пакет 2026-09-22: V1-A03–A09 — подтверждение действий
ИИ сотрудником. Inbox preview → выбор Lead/Task/Deal → подтверждение; legacy
режимы и website chat intake не обходят подтверждение. Запись остаётся ручной.
Full gate PASS на `ade376c`; desktop/mobile cancel/replay/stale/recovery PASS.
Точный scope, commands/skips и остаток — в PRIMARY-SESSION; конечная публикация,
readback и actual CI — `output/ai-confirmation-20260922/result.json`.
До COMPLETE_PUBLISHED_CI_SUCCESS этот пакет не закрывать; после квитанции
остановиться. Live AI/каналы, качество ответов/grounding и billing не приняты
этим пакетом и автоматически не начинаются. Рабочая БД не затрагивалась.

Предыдущий финансовый V1-M01/M02 завершён: `8b41489`, normal push/readback и
CI success по `output/v1-finance-source-20260922/result.json`; не переоткрывать.
Scheduling завершён на `5821941` с push/readback/CI; его pending checkpoints ниже
исторические. Не повторять эту фазу или предыдущие W05/W06/Git.

После завершённого governance-пакета владелец разрешил V1-F06 / V1-W02:
специалист без обязательного аккаунта, индивидуальный график и разбор записей
при отсутствии. Кресла отложены; рассылка только документируется. Текущий scope,
снимок и незавершённые gates — в PRIMARY-SESSION; прежние запреты scheduling
ниже относятся к уже завершённому Git/governance этапу.

Compact и близость конца окна: восстановить checkpoint, сверить Git и продолжить
ту же согласованную задачу в том же чате. Прежняя автоматическая передача отменена.
Ротация только после полного DoD, checks/review, согласованного push с фактическим
CI где требуется, завершения операций и проверенного comprehension. FAILED,
BLOCKED, PENDING и unknown не означают завершения; не дробить scope ради ротации.

Подтверждённый pending transition может идемпотентно завершить записанный проверенный
преемник или зарегистрированный Оркестратор после native archive readback, без
зависимости от возобновления архивированного source. Guards и trust сохраняются.
Точный [протокол](../docs/testing/SESSION_ROLLOVER.md) и
[checkpoint](../docs/testing/task-state/PRIMARY-SESSION.md) обязательны.

Git-пакет CRM завершён на `31a8b5f`: normal push/readback и
[CI](https://github.com/999MAX20/ZANI/actions/runs/35603891558) success.
Следом разрешена только отдельная governance-правка этих правил и read-only hook;
это не scheduling/features, Market или фактическая ротация. Runtime trust hook
не подтверждается unit-тестами.

## Единая база контекста четырёх задач — 2026-09-21

Последующее решение владельца 21.09: каноническое содержимое разрешено
опубликовать в origin/main с сохранением обеих историй и обязательным gate.
Legacy mobile/offline/push, theme toggle и прежние marketing/public/demo страницы
сохраняются в истории/резерве, сейчас не переносятся; рабочий вход/регистрация
не исключаются. Отсутствие действующих autodeploy подключений подтвердил владелец.
Обе истории уже согласованы без подмены canonical tree; полный integration gate
на code candidate `25efa55` прошёл. Финальный SHA, публикационная квитанция,
фактический CI и текущий writer — в
[PRIMARY-SESSION](../docs/testing/task-state/PRIMARY-SESSION.md); локальный PASS
сам по себе не является утверждением, что push/CI уже выполнены.
После Git отдельно принимается пакет специалиста с расписанием без обязательного
CRM-account; правило уточнено в V1_PRODUCT_RULES. Сейчас scheduling/UI/seats
не меняются, Market вне scope.

Актуальное имя продукта: **Platforma.CRM** (историческое Zani/ZANI).
Единственная рабочая папка: `C:\Users\user\Desktop\Zani`.
Этот раздел заменяет нижеизложенные исторические сводки там, где они расходятся
с утверждёнными V1-правилами и консолидацией. Сами архивы сохраняются как evidence.
Утверждения старых чатов не равны проверке текущего кода.

### С чего начинает единственная основная задача

1. Корневой AGENTS.md и обязательные clean-code правила.
2. Этот handoff и [правила V1](../docs/product/V1_PRODUCT_RULES.md).
3. [Состояние исполнения](../docs/testing/task-state/PRIMARY-SESSION.md) и
   `.codex/project-session.json` — текущий владелец, handoff, разрешённый scope.
4. [Автоматическая передача](../docs/testing/SESSION_ROLLOVER.md).
5. Только профильные источники ниже. Не выполнять весь backlog при чтении.

### Что за продукт и что уже утверждено

Лёгкая универсальная CRM для малого/среднего бизнеса; первый сегмент —
администраторы стоматологий. Цель V1 — первая платная версия для самостоятельной
работы компании, не только демонстрация. Старый demo-only ориентир ниже исторический.
Это не медицинская карта, не план лечения, не тяжёлая ERP.

Основной цикл: обращение → клиент/заявка → ответственный/задачи → минимальная
сделка или запись к сотруднику → результат → отдельный журнал денег → аналитика.
Результат услуги не означает получение оплаты. Нужны импорт/дубли, архив/
восстановление, напоминания и правила автоматизации.

WhatsApp, Instagram, Telegram входят в V1; сайт — приём обращений через форму.
Двусторонний сайт-виджет обсуждался и частично реализован, но не подменяет
утверждённый обязательный минимум. Живое подключение провайдера не доказано
самим наличием адаптера. Twilio/Sinch/Infobip/Bird обсуждались как варианты,
окончательный выбор этими обсуждениями не принят.

ИИ: автоматический диалог с клиентом, помощник сотрудника, аналитик руководителя.
Обычная CRM должна работать и без ИИ. Автосоздание карточки клиента — отдельное
разрешённое исключение; создание заявки/задачи/черновика сделки требует
подтверждения и прав оператора. Запись, перенос/отмена записи и результат сделки:
ИИ предлагает, сотрудник выполняет действие. Не заменять это общим «ИИ может всё
после одобрения». Точная матрица — в V1_PRODUCT_RULES.

Подписка за сотрудников; ИИ отдельно по фактическому использованию с понятными
тарифами запросов, без денежного потолка. Точные цены/единица тарификации/провайдер
не согласованы. Активация подписки через платёжного провайдера и трёхдневный
льготный период с read-only после него — требования, не доказательство live billing.

### Выполненное и границы доказательств

- CRM-слои клиентов/заявок/сделок/задач/записей, разграничение доступа, история,
  domain services и архивирование уже существуют. Не начинать CRM заново.
- FC-001/002/004/005/006/007 имеют исторические PASS на обозначенных снимках;
  BE-GAP-001 закрыт. FC-003/008 остаются partial. Старый полный тестовый прогон
  не сертифицирует нынешние незакоммиченные изменения.
- Общие fallback/recovery-компоненты и основной пакет FB реализованы; UX-3
  dashboard закрыт. Финальная UX-4, live-provider recovery и отдельная
  accessibility-приёмка не закрыты общей фразой «UI готов».
- Журнал ручных оплат/возвратов, обновления timeline, AI/channel boundaries,
  UI testing/Storybook и пауза ИИ при inbound присутствуют в локальных наработках.
  Их наличие не означает итоговую production-приёмку всех циклов.
- 21.09 в основную папку перенесены fc22f72, AUD-027 и совместимые цвета;
  более новые V1, manual payments, MacDent и continuity сохранены. Повторно
  переносить удалённые worktrees или восстанавливать старый оранжевый UI не нужно.
- Точные уже выполненные проверки консолидации и ограничения находятся в
  [CONSOLIDATION](../docs/testing/task-state/CONSOLIDATION-2026-09-21.md).
  В рамках объединения задач продуктовые тесты заново не запускались.

### Снимок до Git-пакета и оставшаяся продуктовая приёмка

Снимок перед реорганизацией: HEAD `4ba3cbf9fddcc6e1baa172b494c781550c090693`,
ветка `codex/ui-testing-toolkit`, 186 записей git status до новых handoff-правок.
Консолидированный код остаётся WIP, не опубликован. В репозитории одно рабочее
дерево. До любой реализации заново проверить checkout, а не ориентироваться
на эти числа как на постоянно актуальные.

На этом исходном снимке origin/main имел отдельную историю; read-only сверка
сохранена в `CRM_MAIN_RECONCILIATION_2026-09-21.md` в папке Оркестратора.
Последующее решение владельца и история согласования указаны в начале документа
и PRIMARY-SESSION. Старые mobile/theme/public исключения больше не являются
открытым вопросом; автоматически добавлять их в V1 не разрешено.

Оставшиеся продуктовые вопросы распределены по существующим источникам:

| Вопрос | Где проверять, что делать дальше после разрешения |
| --- | --- |
| FC-003/008, полнота основных пользовательских циклов | APP_FUNCTIONAL_CERTIFICATION.md; закрывать конкретный критерий, не повторять все закрытые FC |
| Непринятая backend-логика, async/abuse/files | ../docs/pilot/backend-open-logic-register.md; отделять PARTIAL от ENV_GATED и ROADMAP |
| Спорные правила support/lifecycle и entity contract | ../docs/crm/CRM_ENTITY_BEHAVIOR_CONTRACT.md — draft, не утверждённый весь контракт |
| Живые каналы и восстановление ошибок | ../docs/integrations/provider-rollout.md и UNIFIED_FALLBACK_EXPERIENCE_PLAN.md |
| UI, AI agent editor, финальная browser-приёмка | ../docs/frontend/ui-ux-implementation-standard.md, CRM_WORKSPACE_UX_REFORM.md |
| Платежи, подписка, ресурсы и эксплуатация | V1 rules + профильные billing/production docs; нужны отдельные доказательства среды |

BE-GAP-002 закрывался на историческом clean candidate; это не доказательство
чистоты текущего WIP. Production DB/storage/email/monitoring/backup, provider
credentials и live-recovery остаются ENV_GATED, где так указано в регистре.
Roadmap 1C/market writeback/другие вертикали не является ближайшей обязательной фазой.
MacDent-аудиты — сравнительное исследование, не разрешение копировать медицинскую ERP.
Готовность в процентах не выводить без утверждённых критериев и evidence.

### Происхождение контекста: четыре прежние задачи

| Задача (название сохранено) | ID | Что перенесено по смыслу |
| --- | --- | --- |
| Chat Manager | 01a02906-d0a3-7820-80f2-adad5cf5a613 | Правила миграции, fallback/recovery, semantic action colors, статус каналов; предложения провайдеров отделены от решения |
| Backend/Features | 01a02915-a366-7150-91bb-ce938cd50138 | CRM foundation/FC, аудит и AUD-027, tenant/permissions, draft entity behavior; старые audit counts не объявлены текущими |
| Critic UI/UX | 01a02954-6edd-74f2-8944-794408801f0d | Peach/UI references, AI editor, channel/AI pause, manual payments, UI testing; референсы не объявлены всеми реализованными |
| UI/UX | 01a02916-4955-7491-a51e-6372a6d17ca8 | UX-3/UX-4, login/reduced motion и история цветового решения; поздний утверждённый стандарт важнее старых цветов |

Источники: доступные сообщения/финальные ответы всех четырёх задач, документы,
git/worktree snapshot и прежний отчёт консолидации. Это восстановленная
проверяемая база знаний, не обещание дословного сохранения всех когда-либо
сжатых сообщений. История остаётся в архиве задач.

### Граница последующих поручений

Объединение контекста само по себе не назначало кодовую задачу. Последующие
W05/W06 и Git-пакет имеют отдельное разрешение и evidence в PRIMARY-SESSION.
После Git-публикации остановиться: старые «продолжай» не являются бессрочным
поручением, следующая продуктовая фаза требует отдельного запуска.

## Приоритетный checkpoint — консолидация 2026-09-21

Единственная рабочая папка исходников: `C:\Users\user\Desktop\Zani`.
Один активный изменяющий исполнитель на репозиторий; семь старых worktrees
удалены после проверенного резервирования 21.09.2026. Не создавать новую копию
проекта для реализации следующих задач.

В основную папку локально перенесены изменения сборочного снимка `fc22f72`,
AUD-027 и совместимые цветовые акценты. Сохранены более новые V1-правила,
контекстные checkpoint/hooks, журнал оплат и MacDent-аудиты основной папки.
Это пока незакоммиченный кандидат; HEAD остаётся `4ba3cbf`, ветка
`codex/ui-testing-toolkit`. Старые утверждения ниже «не интегрировано» относятся
к снимкам на указанную дату и не отменяют текущий журнал консолидации.

Владелец, точный scope, актуальные проверки и оставшийся шаг:
[CONSOLIDATION-2026-09-21](../docs/testing/task-state/CONSOLIDATION-2026-09-21.md).
Консолидация не означает закрытия всех pilot/production-критериев.
Изначальный blocker несвязанных историй разрешён владельцем и сохранением
обеих историй в merge `1e5a85d`. Текущий publication candidate/gate/remote/CI
проверять в PRIMARY-SESSION и указанной там квитанции; force-push не разрешён.

## Исторический checkpoint — 2026-09-14

Последний проверенный committed HEAD: `4ba3cbf9fddcc6e1baa172b494c781550c090693`.
BE-GAP-001 закрыт (`21f5eb0`); FC-004/006 PASS (`d4f7c8f`, full gate 962 tests);
FC-003/008 и BE-REM-007 остаются partial. Старые ownership/FC-004/006 open notes
ниже — история соответствующего снимка, не текущая очередь задач.

Канонический checkout снова содержит незакоммиченный AI/channel пакет, включая
новые lifecycle/channel-boundary файлы. Во время аудита его ветка сменилась с
`codex/ai-channel-ownership-hardening` на `codex/ui-testing-toolkit` при том же
HEAD. Имя ветки не доказывает состав candidate. Новые focused checks: 54 PASS;
два website-chat сценария воспроизводят 403 вместо 201. Старый full gate не
сертифицирует cumulative WIP.

Текущие границы: [backend register](../docs/pilot/backend-open-logic-register.md),
[backend audit](../docs/pilot/backend-development-audit.md),
[documentation audit](../docs/operations/technical-documentation-audit.md).
Документационная нормализация выполнена в отдельном worktree
`C:\Users\user\Desktop\Zani-backend-docs-audit`, не в dirty canonical checkout.
При интеграции сохранить чужие изменения; не копировать каталог целиком.

Дальнейшие dated snapshots — historical evidence. Identity, guardrails
и инженерные правила ниже продолжают действовать.

Дата снимка: 2 сентября 2026 года

Этот документ — стартовый handoff для нового Codex-проекта `Zani`. Он не заменяет `AGENTS.md` и не разрешает реализацию задач сам по себе.

## Идентичность проекта

- Название: `Zani` / `ZANI`.
- Каноническая рабочая папка: `C:\Users\user\Desktop\Zani`.
- Продукт: AI-first CRM и business control layer для SMB.
- Целевой режим текущего этапа: controlled pilot/demo, не production и не paid beta.
- Основной источник инженерных правил: `AGENTS.md`.

## Обязательный порядок чтения

Перед любой нетривиальной задачей агент читает:

1. `AGENTS.md`;
2. `plan/clean_code_rules/zani_required_clean_code_rules.md`;
3. `docs/README.md`;
4. `actual_docs/README.md`;
5. `actual_docs/DEFECT_KNOWLEDGE_BASE.md` для дефектов, UX-аудита и сертификации;
6. только затем — профильные документы и файлы задачи.

Completed, archived и historical документы являются evidence, но не дают разрешения на новую реализацию.

## Git snapshot

### 2026-09-08 integrated committed-range checkpoint

The previously mixed checkout is consolidated on
`codex/ux-3-owner-dashboard` at code candidate `e65e0f4`. The deterministic
full gate for `f142f3e...e65e0f4` passed in 1727.1 seconds: migration drift and
Django checks are clean, all 954 Django tests passed, deterministic frontend
install/build/bundle passed, mobile owner/manager smoke passed, Python and npm
dependency audits reported zero known vulnerabilities, and final diff hygiene
passed. Generated Playwright CLI logs and the stray root `package-lock.json`
were excluded from the commit. The repository artifact/clean-range blocker is
closed; tenant ownership immutability, FC-003/004/006 and the final
certification report remain open. The active backend gap register is
`docs/pilot/backend-open-logic-register.md`.

### 2026-09-03 FB-010 verification checkpoint

This checkpoint supersedes older FB-010 status statements later in this handoff. The bounded cross-role failure matrix passes in an isolated runtime: 744 applicable journey/role/state/viewport cells, five-role desktop and mobile session-expiry recovery, tenant-safe browser denial, 208/208 targeted provider/async backend tests and 947/947 full backend tests are green. Integrated closeout remains open because this checkout is still shared and dirty, the generated fallback inventory is stale while Critic UI/UX changes the source set, and the Critic-owned visual/interaction audits plus a clean committed-range gate have not been accepted here. Detailed evidence and the one bounded next step are authoritative in `UNIFIED_FALLBACK_EXPERIENCE_PLAN.md`.

- Current verification on 2026-09-02: `git status --short` reports 72 entries after the fallback implementation and the F-101 fixture alignment; the checkout remains intentionally uncommitted.

- Текущая ветка: `codex/ux-3-owner-dashboard`.
- Текущий HEAD: `f142f3e498e4726320fc7de0b6ad0cc27187c57f`.
- Предыдущий baseline `3b84b52` и UX-3 commit `72b380a` разделены; handoff не смешивается с UX-3 commit.
- Канонический checkout грязный: `58` записей в `git status --short`; среди них находятся существующие UI-изменения, fallback-изменения текущей реализации и untracked `package-lock.json`.
- `package-lock.json` не классифицирован и не должен автоматически включаться в commit, перенос или cleanup.
- Отдельный worktree `C:\Users\user\Desktop\Zani-ui-color-correction` остаётся грязным на ветке `codex/ui-orange-cta-correction`; он относится к исключённому пункту Critic UI/UX и не переносился.
- Из-за смешанного dirty checkout единый commit текущего scope пока не создавался.

### Migration freeze

- В промежуточной проверке после создания handoff действительно были незакоммиченные UX-3 изменения в frontend и тестах.
- Они были зафиксированы отдельным commit `72b380a`; handoff-файлы в этот commit не включались.
- Текущий migration baseline — `72b380a` плюс отдельный handoff change set; `package-lock.json` не включать без отдельной классификации.

## Пилотная цель

Показать потенциальным клиентам, банкам и партнёрам доказуемый демонстрационный поток CRM-продукта с контролируемыми интеграциями. Не расширять scope до production-only требований без отдельного documented gate.

## Состояние из подтверждённых рабочих чатов

Эта секция — управленческий snapshot, а не замена source-of-truth. Если она расходится с актуальной документацией или checkout, сначала выполнить reconciliation и не начинать реализацию.

- Backend foundation и B-101 в рабочих отчётах отмечены закрытыми; BE-REM-001…006 отмечены закрытыми.
- BE-REM-007 остаётся зависимым от fallback/recovery и функциональной сертификации.
- FB-001…FB-005 закрыты; FB-006…FB-008 реализованы в текущем каноническом working tree и имеют зелёные frontend/targeted backend gates; FB-009 реализован на уровне RU/KK/EN copy и reduced-motion поверхности, но browser/accessibility gate открыт; FB-010 не сертифицирован.
- `actual_docs/README.md` синхронизирован с этим состоянием: старый статус `FB-003 ready` устранён.
- `FC-003`, `FC-004`, `FC-006`, `FC-008` и `BE-REM-007` остаются открытыми до полной failure matrix и clean-range certification.
- Интеграционный pilot inventory: website/public forms и widget — demo/local; CSV/Excel — controlled pilot; Telegram — после токена и HTTPS webhook; Kaspi/MoySklad/Wildberries/Ozon — read-only beta; WhatsApp/Instagram требуют внешней настройки; 1C — roadmap.

## Ограничения нового проекта

- Решение владельца 2026-09-21: весь код меняется только в `C:\Users\user\Desktop\Zani`; один активный изменяющий исполнитель на репозиторий. Новые worktrees/клоны для разработки запрещены, старые — только read-only источники.
- Пересекающиеся backend, frontend, integration, security и documentation задачи параллельно не выдаются.
- Пользовательские изменения основной папки сохраняются; пересекающиеся правки допустимы только в согласованном scope после снимка и сверки владельца.
- Не выполнять staging, reset, delete, merge, push или commit без отдельной проверки scope, diff и gates.
- Если каноническая папка недоступна или занят владелец записи, остановиться без изменений; не создавать запасную кодовую копию.
- Закрытый в source-of-truth пункт больше не маршрутизировать.
- Не считать старый чат, старый cwd или старую формулировку задачи актуальным доказательством без сверки с этим репозиторием.

## Первичная проверка для каждого нового чата

До выдачи любой реализации агент должен read-only вернуть:

1. canonical path и название проекта;
2. branch, HEAD и dirty/untracked state;
3. прочитанные source-of-truth документы;
4. закрытые пункты, открытые пункты и противоречия;
5. ровно один разрешённый следующий шаг или явный blocker.

Если агент не может назвать эти пять элементов, он не получает кодовую задачу.

## Правило завершения

Задача считается закрытой только при наличии актуального документа, фактического evidence и подтверждённого состояния checkout/remote, если задача относится к коду. После закрытия новые запросы по тому же пункту не выдаются.
