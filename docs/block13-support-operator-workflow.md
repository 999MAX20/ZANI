# Block 13 — Support / Operator Workflow для пилота

Цель блока: дать внутренней команде ZANI не только список пилотных мерчей, но и понятный support workflow: что требует внимания, какой следующий шаг сделать, и где фиксировать действие поддержки.

## Что добавлено

### Backend

- `GET /api/platform/merchants/<business_id>/`
  - возвращает детальную карточку мерча для внутренней команды;
  - включает operations counters, health и support workflow.

- `POST /api/platform/merchants/<business_id>/support-actions/`
  - фиксирует действие поддержки через `AuditLog`;
  - не требует новой таблицы и миграции;
  - доступен только platform user.

### Support workflow

Для каждого мерча теперь рассчитывается:

- `priority`: `low`, `medium`, `high`;
- `summary`: главный следующий шаг;
- `next_steps`: список понятных действий оператора;
- `recent_actions`: последние действия поддержки.

Примеры next steps:

- проверить ошибки формы;
- помочь с handoff-диалогами;
- проверить failed connectors;
- попросить клиента загрузить Excel/CSV продаж;
- проверить новые заявки;
- мониторить пилот.

### Frontend

В platform merchants table добавлен столбец `Support workflow`:

- приоритет поддержки;
- краткий следующий шаг;
- список ближайших действий.

Это помогает команде быстро понять, кому писать/звонить и почему.

## Проверки

- `python manage.py check`
- `python manage.py test apps.core.tests_platform_operations -v 2 --keepdb`
- `cd frontend && npm run build`

## Важно

Это не тикет-система. Это pilot support layer, чтобы первые 10–50 клиентов не потерялись и команда могла вести их без хаоса.
