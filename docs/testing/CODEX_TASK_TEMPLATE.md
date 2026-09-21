# Codex Task Template

Use this template when creating work for Codex. The goal is to keep every task narrow, reviewable and tied to a real business outcome.

This is the single task-contract template, not another backlog. Reuse the
existing task/defect/phase ID; if none exists, use a bounded task title in the
current task record. Fill it concisely before implementation. Explicit user
authorization and clear requirements are sufficient to proceed without another
approval of this form. Mark irrelevant fields `N/A` with a short reason.

For resumed work, update the checkpoint and inspect the relevant delta instead
of repeating the entire discovery or a repository-wide audit.

## Default Prompt Shape

```text
Existing ID (or bounded title) and active source document:
...

Mode: audit / implementation / verification / operation
Gap type: code / evidence / environment / policy / roadmap

Observable result and business context:
...

Existing implementation/tests/closure evidence to reuse:
...

Allowed scope (flows, contracts and expected file areas):
- ...

Non-goals / do not change:
- ...

Owner and overlap check:
...

Canonical root (must equal C:\Users\user\Desktop\Zani), branch, starting HEAD/base and affected-path dirty snapshot:
...

Acceptance criteria and one phase completion condition:
- ...

Dependencies / unresolved decisions:
...

Permissions / tenant / notification / BusinessEvent / AI impact:
...

Migration / environment / external-side-effect impact:
...

Required verification (testing.md matrix):
- focused:
- affected-area:
- UI/API flow:
- candidate integration / environment, if in scope:

Delivery boundary (local work / commit / integration / deployment):
...
Default for approved implementation/docs tasks: verified commit + immediate
normal push under AGENTS.md; record the agreed remote/branch and actual CI.
Read-only / explicit no-push overrides; missing target or failed gates blocks push.
```

Audit mode is read-only unless a requested documentation artifact or other
specific mutation is explicitly in scope. Verification does not authorize
unrelated implementation; operation mode requires an exact target and effects.
An environment or evidence gap must not be converted into a code rewrite.

## Reopening A Closed Task

Only reopen for a reproduced regression, a proven missed acceptance criterion,
or an explicitly approved requirement change. Record:

```text
Existing closed ID and evidence:
New reproduction / missing criterion / approved requirement:
Observed behavior vs required behavior:
Minimal change and regression check:
```

An old checklist, another chat title or a preferred architecture is not a new
requirement. A regression check on a changed flow does not reopen its entire
foundation. A code/contract policy conflict requires the relevant owner decision
before the dependent change, not a guess that the newer text must be right.

## Resume And Handoff Checkpoint

Store this in the existing task record or relevant handoff, without secrets:

```text
Task / current phase / authorized scope:
Worktree / branch / starting base / current HEAD:
Affected-path dirty snapshot (including required untracked files):
Implemented:
Verified: command, result, state identity, environment, coverage
Failed / skipped checks and evidence/reason:
Unfinished acceptance criterion / blocker:
One next step:
Closed work not to reopen:
Delivery: local / committed / integrated / accepted environment
Integration owner and overlapping work, if relevant:
```

Do not claim a worktree change is present in the main checkout before integration.
After relevant code, dependency, config or fixture changes, recheck affected
acceptance evidence; keep valid historical closures attached to their old SHA.

## Closeout

```text
Result / completed acceptance criteria:
Files and contracts changed:
Checks run: exact commands, outcomes, snapshot/commit and environment
Checks skipped: reason and acceptance impact
Known risks / proven baseline failures:
Manual checks:
Actual delivery boundary:
Next unfinished item (not started):
```

If a required check fails, the corresponding acceptance remains open. Do not
change a checkbox to complete because only a narrower test passed.

## Scope-Specific Additions

Use only the applicable example below in addition to the compact contract.
Examples do not expand authorized scope or replace the verification matrix in
[testing.md](testing.md#verification-selection-and-evidence).

For each user-facing action, include the expected persistence and failure state,
not only the presence of a button or endpoint. For backend lifecycle changes:

```text
Roles/permissions and same-business relations to preserve:
- ...
Happy path / permission denial / tenant isolation / side effects:
...
```

## Study Without Changes

Use when the next step is unclear and no sufficient current evidence exists.
If a relevant audit/checkpoint already exists, identify what changed and inspect
that delta; do not repeat discovery solely because the conversation resumed.

```text
Study this area without editing files:
- pages/modules:
- related docs/plans:

Return:
- current implementation summary
- missing business logic
- UX/API risks
- recommended next task
```

## Frontend Page Task

```text
Implement/refine this page:
- route:
- primary user:
- primary job:
- allowed components/files:

Rules:
- no marketing/filler blocks
- no duplicated actions
- use existing API clients
- keep mobile and desktop states stable
- preserve role guards

Checks:
- frontend build
- browser/Playwright check if the page is business-critical
```

## Backend/API Task

```text
Implement/refine this backend flow:
- endpoint/service:
- models involved:
- business event output:
- role rules:

Rules:
- business logic in services/selectors/providers/tasks
- views stay thin
- tenant isolation by Business is mandatory
- tokens/secrets must be masked
- add focused tests

Checks:
- makemigrations --check --dry-run
- manage.py check
- scoped tests
```

## Integration Task

```text
Implement/refine this connector:
- provider:
- auth method:
- inbound/outbound flow:
- expected BusinessEvent types:

Rules:
- lightweight integration, no full ERP sync
- connector must expose status, health, last sync and error state
- merchant setup must stay simple
- provider details stay behind connector/provider layer
- no raw tokens in frontend or logs
```

## AI Task

```text
Implement/refine this AI behavior:
- AI actor:
- input sources:
- allowed actions:
- actions requiring confirmation:

Rules:
- AI must not invent data
- AI must cite source events/entities
- critical actions require role-aware confirmation
- log provider/model/cost status when applicable
```

## PR Summary Template

```text
Summary:
- ...

Task/source and accepted criteria:
- ...

Worktree, base, candidate/dirty snapshot and actual delivery state:
- ...

Business areas changed:
- ...

Checks:
- ...

Production readiness:
- Migrations:
- Env vars:
- Permissions:
- Notifications:
- BusinessEvents:
- AI actions:

Manual checks:
- ...

Risks:
- ...
```

## Сохранение контекста и передача задачи (2026-09-19)

Эти правила сохраняют ход работы, но не создают новую очередь разработки.
Возраст задачи и число сжатий сами по себе не доказывают ошибку модели и не
являются основанием переписывать код или заново выполнять завершённые пункты.

### Начало и восстановление

1. До изменений прочитать актуальный корневой AGENTS.md, профильный источник
   требований и checkpoint именно выбранной задачи. После сжатия/возобновления
   повторно сверить их с последним запросом пользователя.
2. Проверить фактические cwd, repository root, branch, HEAD и dirty paths;
   отделить прежние пользовательские изменения от собственных. Worktree и
   ветка из старой сводки не считаются текущими без проверки.
3. Восстановить один разрешённый результат, критерии приёмки, владельца и
   следующий шаг. Не продолжать все исторические «продолжай» и весь backlog.
   Если задачи несколько и выбор неоднозначен, уточнить выбор, не брать самую
   свежую запись автоматически.
4. Сопоставить ожидаемый результат с существующими кодом и evidence. Не
   реализовывать уже сделанное заново; выяснить конкретный оставшийся пробел.
   Несовпадение требований и кода записать как расхождение, не менять требования
   ради соответствия коду.
5. После передачи в новую задачу кратко подтвердить понимание: продукт и цель,
   разрешённый scope, что доказанно сделано, что не проверено, блокер и следующий
   шаг. Это сверка с файлами, не пересказ всей истории.

### Checkpoint без напоминаний пользователя

- Для многошаговой работы поддерживать одну компактную запись на задачу.
  Сначала использовать существующую карточку и evidence; не плодить копии.
- Обновлять её после завершённого смыслового этапа, существенного решения,
  проверки или появления блокера, а также перед финальным ответом/известной
  передачей. Не ждать 100% заполнения контекста. Нельзя гарантировать запись
  непосредственно перед внезапным прерыванием или автоматическим сжатием.
- Короткому ответу без изменений отдельный файл не нужен. Если запрос строго
  read-only, файловые записи запрещены: checkpoint дать в ответе либо сохранить
  только в отдельно разрешённом реестре.
- Фиксировать подтверждённые решения отдельно от предложений и неизвестного.
  Не включать полные переписки, секреты, персональные данные и сырые дампы.
- Не редактировать карточку другого активного исполнителя. Один scope,
  включая API-контракт и общий документ, имеет одного владельца; отдельные
  worktrees сами по себе не устраняют смысловые конфликты.

Минимальная запись:

```md
# <ID существующей задачи или короткий уникальный ID> — <результат>
Обновлено: <дата/время/часовой пояс>
Владелец: <task/thread ID, если доступен; иначе явно неизвестен>
Состояние: active / blocked / ready-for-handoff / closed
Основание: <актуальный запрос; ссылки на канонические требования>
Цель / DoD / разрешённые области / что не делаем:
Checkout / branch / HEAD:
Dirty paths: <свои / чужие / происхождение не установлено>
Выполнено: <конкретный результат + файл/commit/evidence>
Реализовано, но не проверено:
Интегрировано в целевую ветку: <доказательство или нет/неизвестно>
Развёрнуто и проверено в среде: <какой или нет/неизвестно>
Проверки: <команда, дата, входы: HEAD + relevant diff/hash,
           профиль/fixtures/dependencies, PASS/FAIL/BLOCKED/NOT_RUN,
           ссылка на доступный результат>
Блокер / попытки / уже отвергнутые гипотезы:
Принятые решения: <кто утвердил и где>
Незавершённое в текущем scope:
Собственные процессы / артефакты: <ID/пути или нет>
Следующий шаг: <одно конкретное действие>
Условие остановки:
```

Статус «реализовано» не означает «проверено», «интегрировано» или
«развёрнуто». Процент готовности без фиксированного списка критериев не
указывать. Новый чат не сбрасывает счётчик неудачных попыток. Проверенный
результат переиспользовать только при доступном evidence и неизменных
значимых входах; смена чата сама по себе не требует полного rerun.

### Передача и остановка

- При достигнутом DoD сохранить evidence, закрыть только подтверждённый пункт
  в каноническом реестре и остановиться. Новые улучшения — предложения, не
  автоматические поручения.
- При смене задачи подготовить checkpoint и короткое задание-продолжение:
  точный путь к записи, разрешённый scope, DoD и следующий шаг. Передавать
  ссылки на источники, а не только пересказ истории.
- Прежде чем передать исполнение, подтвердить остановку прежнего владельца.
  Преемник сначала читает запись и сверяет Git/evidence; только затем продолжает.
  Архивация допустима после подтверждения передачи, не вместо неё.
- Решение владельца 2026-09-21 отменяет автоматическую передачу при compact.
  Сжатие или близость конца окна: восстановить checkpoint, сверить Git и продолжить
  ту же согласованную задачу в том же чате. Не отключать сжатие движка. Это не
  разрешение на commit/push, создание/перенос/архивацию задач или новые worktrees.
- Ротация по `docs/testing/SESSION_ROLLOVER.md` допустима только после полного
  текущего DoD, обязательных checks/review, согласованной публикации с фактическим
  CI (где входит в DoD), завершения собственных операций и проверенного comprehension.
  FAILED/BLOCKED/PENDING/unknown не являются завершением: checkpoint, отчёт,
  прежние лимиты попыток и отложенная передача. Не дробить задним числом согласованный
  scope ради готового подпункта; governance не закрывает иной незавершённый пакет.
- Уже подтверждённую передачу может идемпотентно завершить записанный проверенный
  преемник или зарегистрированный Оркестратор после native archive readback.
  Это metadata-only release того же поколения, без нового ownership или задачи;
  неизвестные чаты и retired source не получают прав записи. Возобновление старого
  чата после архивации не требуется. Новая продуктовая фаза требует отдельного scope.
- Автоматическое напоминание не является блокировкой конкурентной записи,
  доказательством выполнения правил или автоматическим сохранением сводки.

Для Zani / Platforma.CRM продуктовые границы задаёт
`docs/product/V1_PRODUCT_RULES.md`, текущие CRM-статусы —
`docs/crm/CRM_PRODUCTION_LAYER_PLAN.md` и профильные реестры из `docs/README.md`.
Checkpoint не заменяет эти документы. Если у задачи ещё нет сохраняемой
карточки, разместить её в `docs/testing/task-state/<task-id>.md`.

### Подключение к Codex

В `.codex/hooks.json` подключён read-only адаптер `.codex/continuity-hook.cjs`.
`SessionStart` (startup/resume/clear/compact) и `UserPromptSubmit` возвращают
структурированный дополнительный контекст. Compact напоминает primary восстановить
checkpoint и продолжить ту же задачу без stop-loop; передача отложена до полного
DoD по `docs/testing/SESSION_ROLLOVER.md`. Retired/non-primary/unfinished-transition
guards сохраняются. Записанный преемник/Оркестратор получает лишь ограниченное
напоминание о завершении уже проверенной передачи, без права продуктовой записи.
Адаптер сам не читает историю, не пишет файлы, не вызывает AI и не управляет
Git/задачами. Semantic verification и нативные операции выполняет агент только
при выполнении протокола и действующем разрешении. Unit-тест не доказывает
фактическое runtime-срабатывание или доверие к определению hook.

Hooks требуют доверия к проекту и отдельного review/trust определения в Codex
(официальный CLI: `/hooks`). Не обходить trust и не включать его через правку
служебных хранилищ. После установки/изменения проверить загрузку в новой сессии;
пока фактический запуск не подтверждён, статус автоматизации — «не проверено».
Уже открытые задачи и отдельные worktrees не считать автоматически обновлёнными.
В другом worktree код не менять: по решению владельца 2026-09-21 продолжать
разработку только в `C:\Users\user\Desktop\Zani` после сверки текущего владельца.
Не переносить hooks в старые деревья и не менять их trust автоматически.

Источник механизма: https://learn.chatgpt.com/docs/hooks
