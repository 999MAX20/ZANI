# CRM Production Layer Plan

Дата обновления: 2026-07-16

Цель: довести CRM до production-уровня слоями по всему продукту, а не полировать одну страницу изолированно. Этот документ является текущим source-of-truth для CRM hardening.

## 1. Принцип Работы

Zani CRM развивается слоями:

```text
domain invariants -> state machines -> audit/activity -> API contracts -> frontend integration -> E2E flows
```

Страница считается production-ready только когда backend-правила нельзя обойти через другой endpoint, frontend использует реальные API-контракты, а пользовательский flow проверен тестами или smoke-сценарием.

## 2. Текущее Состояние

### Calendar

Статус: близко к production для базового SMB scheduling.

Сделано:

- единый экран вместо отдельной страницы записей;
- day/week/month/list UX;
- date-range API-фильтрация;
- appointment actions через backend;
- drawer/inspector без сдвига основной сетки;
- улучшенная работа с ресурсами и фильтрами.

Осталось:

- расширить mobile agenda UX;
- добавить больше E2E сценариев reschedule/cancel/no-show;
- усилить race-condition защиту на уровне транзакций/локов.

### Tasks

Статус: close-to-production для 100 merchant pilot после применения миграций и smoke-test.

Сделано:

- backend lifecycle actions: take/start, complete, cancel with reason, snooze, assign, watch, archive;
- comments create/delete;
- action confirmation/undo pattern на frontend;
- task drawer с редактированием и быстрыми действиями;
- table-based UX вместо тяжелых карточек;
- pagination foundation и backend indexes;
- тесты на ключевые task scenarios.

Осталось:

- применить миграции на окружении;
- проверить список задач на 500-2000 записей;
- расширить E2E smoke.

### Conversations

Статус: active production-hardening.

Сделано:

- быстрые ответы вынесены в модалку;
- composer textarea динамически растет без перекрытия всего экрана;
- правый context inspector можно открывать/закрывать;
- CRM-действия: связать клиента/лид/сделку, создать задачу;
- app header освобожден от лишней кнопки ответа клиенту.

Осталось:

- закрепить настройки шаблонов в `Настройки -> Сообщения/Коммуникации -> Быстрые ответы`;
- проверить provider delivery/error states;
- довести SLA/unread queues.

### Leads

Статус: close-to-production для контролируемого merchant pilot.

Сделано:

- базовый table UX;
- lead drawer foundation;
- фильтры и pagination foundation.
- назначение конкретного активного сотрудника через lifecycle action;
- duplicate check и безопасный client merge с dry-run, archive и merge log;
- SLA первого ответа от `Business.sla_minutes` с deadline, overdue state и work queue;
- `mark-contacted` и создание записи фиксируют первый ответ;
- SLA виден в desktop/mobile списке и detail panel.

Осталось:

- убрать лишние вложенные containers;
- привести страницу к единому CRM table pattern;
- расширить bulk lifecycle actions и правила merge конфликтов.

### Clients

Статус: backend identity hardening started.

Сделано:

- normalized identity fields;
- selectors/service foundation;
- тесты на identity behavior.

Осталось:

- dry-run merge;
- merge log;
- frontend dedup/merge UX;
- consent/source attribution.

### Deals

Статус: close-to-production для базового pipeline flow.

Сделано:

- stage transition service и terminal lifecycle actions;
- activity/audit trail для won/lost/reopen/move;
- stage SLA и risk queues;
- backend next-action guard для стадий с `required_fields_json.require_next_action`;
- стандартная frontend-воронка включает обязательный next action на рабочих стадиях.

Осталось:

- stage history;
- required fields/custom fields validation;
- deal drawer polishing;
- добавить настройку next-action requirement в редактор пользовательской воронки.

## 3. Non-Negotiable CRM Invariants

- Все CRM-сущности scoped к `Business`.
- Related objects должны принадлежать одному business.
- Assignee/owner/responsible/watcher должен быть active business member.
- Terminal states меняются через domain actions, а не generic update.
- Lost/cancel destructive flows требуют reason, где это важно для бизнеса.
- Appointment booking/rescheduling respects working hours and overlap rules.
- Critical CRM data архивируется вместо hard-delete по умолчанию.
- User-facing business actions пишут activity timeline.
- Sensitive/destructive actions пишут audit.
- Frontend не считается security boundary.

## 4. Следующий Слой Работ

### Layer 0: Stabilization Checkpoint

Обязательно перед новой крупной фичей:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py migrate
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
cd frontend && npm run build
```

Дополнительно:

- проверить targeted backend tests по `tasks`, `clients`, `conversations`, `bots`, `core`;
- убедиться, что API не возвращают HTML traceback вместо JSON;
- зафиксировать изменения небольшими commit-группами при возможности.

### Layer 1: Shared CRM UI Pattern

Единый UX для `Leads`, `Deals`, `Clients`, `Tasks`:

- compact table surface;
- row click opens entity drawer;
- filters не перекрывают рабочий контент;
- pagination/load-more;
- empty/loading/error states;
- shared confirmation/undo for destructive actions.

### Layer 2: Entity Lifecycle Contracts

Закрепить backend services:

- lead lifecycle;
- deal stage transitions;
- client merge/dedup;
- task lifecycle;
- appointment lifecycle;
- conversation CRM actions.

### Layer 3: Activity And Audit Completeness

Каждое важное CRM-действие должно оставлять след:

- activity event for user-facing timeline;
- audit event for sensitive/destructive action;
- notification only where it adds real operational value.

### Layer 4: E2E Business Flows

Проверяем не страницы, а реальные сценарии:

- inbox message -> lead -> client -> appointment -> task;
- lead -> deal -> won/lost;
- calendar booking/reschedule/cancel;
- task assign/comment/complete/cancel;
- client duplicate warning -> merge/dismiss.

Текущий API E2E smoke проверяет цельный цикл:

- client/service/resource -> lead;
- назначение сотрудника и первый ответ в SLA;
- duplicate detection -> merge dry-run -> merge;
- lead -> appointment -> deal -> next-action task;
- backend-блокировку stage move без next action;
- успешный stage move после задачи и закрытие сделки как won.

## 5. Ближайший Приоритет

1. Завершить stabilization checkpoint.
2. Привести `Leads` к единому CRM table + drawer pattern.
3. Затем `Deals`.
4. Затем `Clients`.
5. После этого провести cross-entity E2E hardening.
