# ZANI Project Handoff

Дата снимка: 22 августа 2026 года

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

- Ветка на момент финализации handoff: `codex/ux-3-owner-dashboard`.
- HEAD на момент финализации handoff: `72b380a0f3bb9a4c53d767796a31a8f1e4fe69b7` (`feat: simplify owner dashboard workspace`).
- Предыдущий baseline `3b84b52` и UX-3 commit `72b380a` разделены; handoff не смешивается с UX-3 commit.
- Основной checkout не считать полностью чистым: обнаружен отдельный untracked `package-lock.json`; его происхождение не подтверждено.
- Эти untracked-файлы не классифицированы и не должны автоматически включаться в commit, перенос или cleanup.
- Перед кодовой работой требуется отдельный clean writable worktree от зафиксированного HEAD.

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
- FB-001…FB-005 были подтверждены рабочими чатами как закрытые; FB-006 был подготовлен как следующий bounded scope; FB-007…FB-010 не начинались.
- В `actual_docs/README.md` одновременно сохраняется более старый статус `FB-003 ready`. Это противоречие обязательно сверить до выдачи нового fallback-запроса.
- Интеграционный pilot inventory: website/public forms и widget — demo/local; CSV/Excel — controlled pilot; Telegram — после токена и HTTPS webhook; Kaspi/MoySklad/Wildberries/Ozon — read-only beta; WhatsApp/Instagram требуют внешней настройки; 1C — roadmap.

## Ограничения нового проекта

- Один кодовый scope имеет одного активного исполнителя.
- Пересекающиеся backend, frontend, integration, security и documentation задачи параллельно не выдаются.
- Основной checkout с пользовательскими изменениями не редактируется.
- Не выполнять staging, reset, delete, merge, push или commit без отдельной проверки scope, diff и gates.
- Если clean writable worktree недоступен, остановиться без изменений.
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
