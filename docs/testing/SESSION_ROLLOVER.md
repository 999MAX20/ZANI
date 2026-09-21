# Продолжение задачи и передача после полного завершения

Решение владельца: 2026-09-21. Проект Platforma.CRM.
Canonical checkout: `C:\Users\user\Desktop\Zani`.
Saved project ID: `local-3368c3df041be97f9549005fc6749ad2`.

## Сначала завершить текущую работу

Этот протокол заменяет прежнее правило автоматической передачи при compact.
Близость конца окна и фактическое сжатие не разрешают создавать, переносить или
архивировать задачи. Восстановить checkpoint, сверить Git и продолжить текущую
согласованную работу в том же чате. Сжатие движка не отключать.

Ротация допустима только после полного исходного DoD, обязательных checks/review,
согласованной публикации и фактического CI (когда входят в DoD), отсутствия
незавершённых собственных операций и проверки понимания преемника. Не дробить
задним числом согласованную задачу ради формально готового подпункта.
FAILED/BLOCKED/PENDING/unknown означают незавершённость: сохранить checkpoint,
сообщить blocker, соблюдать лимиты попыток, отложить передачу. Не создавать новую
задачу ради обхода blocker. Завершение governance не закрывает иной открытый пакет.

Начинать с [AGENTS.md](../../AGENTS.md),
[handoff](../../actual_docs/PROJECT_HANDOFF.md), [PRIMARY-SESSION](task-state/PRIMARY-SESSION.md)
и `.codex/project-session.json`. Реестр хранит участников/поколение/переход;
checkpoint — разрешённый scope, DoD, проверяемые доказательства и следующий шаг.
Флаги реестра и слово READY не заменяют evidence. Новый продуктовый scope не
возникает от передачи. Явный stop/read-only владельца имеет приоритет.

## Checkpoint без потери прогресса

После смыслового этапа, до паузы или известного завершения записывать в существующую
карточку, не создавая новый backlog:

- текущий разрешённый scope/DoD и non-goals, выполненное/незавершённое/не начатое;
- root, branch, HEAD, task-owned и чужой diff, commands/results/environment;
- failures, проверенные гипотезы и лимиты попыток, собственные незавершённые операции;
- принятые решения отдельно от предложений, один следующий шаг и условия остановки.

Не хранить секреты или полный чат. При strict read-only передать checkpoint в
ответе без записи файлов. Сжатие не требует заморозки текущего primary: после
проверки ownership/Git он продолжает тот же незавершённый scope, не повторяя
закрытое и не сбрасывая попытки. Реальный drift/конфликт владельцев требует
разрешения независимо от compact. Никаких новых source copies/worktrees.

## Передача: один писатель, проверяемая последовательность

1. Только зарегистрированный primary может начать передачу. До создания преемника
   проверить полное завершение согласованной работы, checks/review/publication/CI,
   отсутствие незавершённых операций и действующее разрешение на передачу.
   Если хотя бы одно условие pending/failed/blocked/unknown — продолжить или
   сохранить blocker в той же задаче, не передавать её. Текущая governance-задача
   не разрешает фактически создавать/архивировать задачи.
2. Проверить registry, checkpoint и фактический thread ID. Если переход уже есть,
   восстанавливать только его; не создавать второго преемника. Non-primary и
   retired не начинают новую передачу. Для старой неполной записи нельзя выдумать
   missing evidence: проверить исходные материалы и запросить адресное решение
   владельца, если подтверждения недостаточно. Не захватывать ownership.
3. После DoD сохранить checkpoint и ключ передачи: projectId, sourceThreadId,
   successorThreadId, generation. Поставить transition=preparing. Source прекращает
   продуктовую запись; отсутствие фоновых изменяющих операций уже проверено.
4. Если отдельное действующее разрешение предусматривает создание задачи, нативным
   create_thread создать ровно одну задачу в том же saved project с local environment.
   Не fork/worktree/source copy. Сразу сохранить successorThreadId. При неизвестном
   результате сначала нативный list/read; не создавать повторно. Модель не менять
   без явного поручения. Если successor уже записан — переиспользовать его.
5. Преемник выполняет только read-only comprehension: читает стартовые документы,
   называет продукт, завершённый scope/DoD/evidence, остаток вне scope и ограничения,
   сверяет Git/ownership. Никаких installs, product tests, commits или новой фазы.
   Primary или зарегистрированный Оркестратор проверяет содержание ответа.
6. До архивации сохранить результаты comprehension и завершения source DoD в
   checkpoint. Записать `handoff` с sourceThreadId, successorThreadId, новым
   generation, completionStatus=`complete`, sourceDoDVerified=true и
   comprehensionVerified=true. Эти поля ставятся только по проверенным evidence:
   checks, review, publication/readback/реальный CI где требуется и finished operations.
7. Повторно проверить отсутствие писателей. Один раз увеличить generation,
   сделать primaryThreadId равным записанному successorThreadId, добавить source
   в retiredThreadIds и поставить transition=awaiting_archive. `handoff.generation`
   должен совпадать с registry.generation. Оба участника пока не пишут продукт.
   Source после переключения не возвращает себе ownership.
8. Нативным set_thread_archived архивировать только записанный source и получить
   подтверждение. Не менять внутренние SQLite/настройки Codex. Перед архивированием
   информация для завершения уже сохранена: старый чат не обязан выполнять код
   после собственной архивации. Подтверждение может проверить преемник/Оркестратор.

## Идемпотентное завершение подтверждённого перехода

Завершить release может только записанный pre-validated successor, уже указанный
как primary, либо `orchestratorThreadId` из registry. Это узкая служебная операция,
не новое разрешение на продуктовую запись или передачу другой задачи.

Проверить совпадение project/root, source/target/generation, retired source,
awaiting_archive, полного source DoD и comprehension. Затем нативным readback
убедиться, что именно записанный source архивирован. Ни pending tool response,
ни registry flag, ни обещание архивации не достаточны. До подтверждения сохранять
freeze, сообщить blocker; не возобновлять retired source и не создавать другую задачу.

После подтверждения проверить, что запись не изменилась, записать receipt с ключом
перехода, SHA/evidence и native archive confirmation в существующем checkpoint;
поставить transition=idle, successorThreadId=null, handoff=null. Не увеличивать
generation повторно. Повторный вызов для того же завершённого ключа — read-only
проверка receipt, без нового архива, создания или смены владельца. При stale ключе
не трогать текущую запись. Unknown/non-primary без указанных полномочий не завершают
переход. Retired source остаётся без права записи.

Освобождённый primary получает только уведомление о состоявшейся передаче и ждёт
отдельно разрешённого scope. Не продолжать чужой backlog автоматически. Если
владелец отдельно поручил перенос уведомлений/heartbeat, использовать штатный
automation_update, сохраняя status/расписание/уведомления; не включать paused.
Старые задачи не удалять, пользователю сообщить ссылку и фактический результат.

## Read-only hook и доверие

`.codex/hooks.json` подключает `.codex/continuity-hook.cjs` для SessionStart и
UserPromptSubmit. Compact напоминает restore/recheck/continue; primary не получает
`continue:false`. Guard retired SessionStart сохраняет остановку, non-primary —
read-only, незавершённый transition — freeze. Лишь совпадающий проверенный transition
даёт successor/Оркестратору `HANDOFF_FINALIZATION_ONLY` с обязательной внешней
проверкой evidence/archive readback. Hook не читает transcript, не вызывает сеть,
не пишет файлы/Git и не выполняет archive/create/release сам.

Registry: `compactionPolicy=restore_same_thread`, `handoffPolicy=completed_scope_only`.
Старый autoHandoffEnabled=false оставлен для совместимости; даже устаревшее true
не разрешает compact-ротацию. В idle handoff=null; поля pending передачи — только
проверяемое описание, не автоматическая блокировка или доказательство завершения.

По [официальной документации](https://learn.chatgpt.com/docs/hooks#sessionstart),
SessionStart с source=compact выполняется перед продолжением модели; дополнительный
контекст может напомнить проектный порядок, а continue:false прекращает ход.
Формат событий не задаёт наш DoD/ownership — это решение владельца выше.

Успешные unit/CLI/JSON tests не доказывают запуск hook в приложении. Нужны доверие
к проекту и отдельный review/trust точного определения (CLI `/hooks`). Не обходить
trust флагами или правками служебных хранилищ. После изменения definition доверие
нужно проверить заново. Пока реальное срабатывание не наблюдалось, статус остаётся
REQUIRES_REVIEW_AND_TRUST / runtime не проверен. Без hook применять те же правила
continuity вручную, не останавливать активную задачу из-за отсутствия автоматизации.
