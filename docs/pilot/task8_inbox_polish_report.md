# Zani Task 8 — Inbox Polish / Conversation Flow

## Цель

Довести Unified Inbox до более безопасного пилотного состояния после Website Chat E2E:
- фильтры должны работать как реальные действия, а не как декоративные кнопки;
- closed/open flow должен быть понятным;
- next actions из summary должны вести в рабочий inbox-фильтр;
- composer не должен позволять писать в закрытый диалог;
- linked CRM-кнопки не должны создавать дубли, если сущность уже связана.

## Что изменено

### Backend

- `apps/conversations/inbox_views.py`
  - next actions теперь ведут на `/dashboard/inbox` вместо legacy `/dashboard/conversations`;
  - добавлен фильтр `assigned_to=unassigned` для диалогов без ответственного.

- `apps/bots/tests.py`
  - добавлен тест `test_inbox_can_filter_unassigned_conversations`.

### Frontend

- `frontend/src/features/conversations/ConversationsPage.tsx`
  - добавлен `useNavigate` для настоящих переходов из inbox actions;
  - фильтры теперь синхронизируются с URL query params;
  - summary next actions теперь применяют фильтры, а не просто показывают notice;
  - добавлен фильтр по статусу: открытые / закрытые / архив;
  - добавлен фильтр “Без ответственного”;
  - добавлена кнопка “Сбросить фильтры”;
  - invalidate inbox теперь обновляет и summary;
  - composer блокируется для закрытых диалогов;
  - добавлен понятный warning для закрытого диалога;
  - если client/lead/deal уже связаны, кнопки ведут в соответствующие CRM-разделы вместо повторного создания;
  - error state расширен на больше inbox actions.

## Что НЕ делали

- Не добавляли WebSocket/realtime.
- Не подключали WhatsApp/Instagram production API.
- Не добавляли AI auto-send.
- Не меняли архитектуру BotConversation/BotMessage.
- Не трогали parser/landing generator/outreach.

## Проверка у меня

- `python manage.py check` — OK
- targeted backend tests:
  - `test_inbox_can_filter_unassigned_conversations` — OK
  - `test_inbox_priority_close_reopen_and_mark_unread_actions_work` — OK
- `cd frontend && npm run build` — OK
- widget build — OK

## Локальная проверка

1. Войти как `demo-owner@zani.local / DemoOwner123!`.
2. Открыть `/dashboard/inbox`.
3. Проверить summary cards и next actions.
4. Проверить фильтры:
   - канал Website;
   - непрочитанные;
   - без ответственного;
   - закрытые;
   - сброс фильтров.
5. Открыть диалог, нажать “Закрыть”.
6. Проверить, что composer заблокирован.
7. Нажать “Вернуть” и проверить, что можно писать снова.
8. Проверить “Create lead/client/deal/task”.
9. Проверить, что “Open linked lead/client/deal” не создаёт дубли.
