# Task 3 — Task / Calendar Flow Polish

## Цель

Закрыть следующий кусок pilot QA: задачи должны быть не просто списком, а рабочим follow-up механизмом для владельца и менеджера.

## Что добавлено

- `POST /api/tasks/<id>/assign-to-me/` — взять задачу на себя и перевести в работу.
- `POST /api/tasks/<id>/due-today/` — поставить задачу на сегодня и создать reminder.
- `POST /api/tasks/<id>/due-tomorrow/` — поставить задачу на завтра и создать reminder.
- Task actions теперь создают task notifications.
- Frontend Tasks page получила быстрые кнопки:
  - взять на себя;
  - поставить на сегодня;
  - поставить на завтра;
  - existing start/complete/cancel/reopen.

## Проверки

- `python manage.py check`
- `python manage.py test apps.tasks.tests -v 2 --keepdb`
- `npm run build`

## Ручной smoke

1. Войти как demo owner или manager.
2. Открыть `/dashboard/tasks`.
3. Проверить кнопки на карточке задачи:
   - взять на себя;
   - сегодня;
   - в работу;
   - выполнить;
   - переоткрыть.
4. Открыть задачу и проверить:
   - назначить на меня;
   - наблюдать;
   - отложить;
   - сегодня;
   - завтра;
   - комментарий.
