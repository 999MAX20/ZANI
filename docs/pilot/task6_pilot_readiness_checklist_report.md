# Zani Task 6 — Pilot Readiness Checklist

## Цель
Добавить пилотный checklist, который показывает, насколько текущий merchant workspace готов к демонстрации пилотному клиенту.

## Что добавлено

### Backend
- Добавлен endpoint `GET /api/pilot/readiness/`.
- Endpoint read-only, ничего не создаёт и не изменяет.
- Endpoint определяет текущий business по активному membership пользователя.
- Возвращает score, ready/total counters, critical_missing, next_actions и список checklist items.

### Frontend
- Добавлена API-обвязка `frontend/src/api/pilot.ts`.
- Добавлена страница `frontend/src/features/pilot/PilotReadinessPage.tsx`.
- Добавлен маршрут `/dashboard/pilot-readiness`.
- Добавлен пункт sidebar `Pilot readiness`.

## Checklist items
- Профиль бизнеса
- Business owner
- Manager/staff
- Clients
- Leads
- Deals
- Tasks
- Appointments
- Services
- Resources
- Bot
- Website channel
- Lead form
- Inbox conversation
- Billing plan/subscription
- AI Assistant readiness
- Integrations catalog

## Проверено
- `python manage.py check` — OK
- `frontend npm run build` — OK
- `widget build` — OK
- `GET /api/pilot/readiness/` после `seed_pilot_demo` — OK, возвращает `200`.

## Локальная проверка
1. Запустить backend.
2. Запустить frontend.
3. Войти как `demo-owner@zani.local / DemoOwner123!`.
4. Открыть `/dashboard/pilot-readiness`.
5. Убедиться, что страница показывает score, карточки readiness и ссылки на разделы.

## Что НЕ делалось
- Не подключались реальные WhatsApp/Instagram/Kaspi/1C.
- Не добавлялись parser/landing generator/outreach.
- Не менялась архитектура CRM.
- Не менялась auth/tenant логика.
