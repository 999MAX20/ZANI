# Zani Frontend

React + TypeScript кабинет для Django backend.

## Запуск

```bash
npm install
npm run dev
```

Vite поднимется на `http://localhost:5173` и будет проксировать `/api` на `http://localhost:8000`.

## Сборка

```bash
npm run build
```

## Automation Foundation

Этап 5.1 не добавляет визуальный builder. Frontend продолжает использовать существующую страницу `/app/automations` для базового списка правил, а выполнение правил происходит на backend через события CRM.

## Notifications and Tasks Polish

Этап 5.2 добавляет notification center в header и улучшенную страницу `/app/tasks`: быстрые задачи, связи с клиентом/заявкой/записью, фильтры и быстрые смены статусов.

## Auth

По умолчанию используются endpoints:

- `POST /api/auth/token/`
- `POST /api/auth/token/refresh/`

Их можно поменять в `src/api/auth.ts`.

Full backend tests after mobile usability pass: 295 OK
Frontend production build after mobile usability pass: OK
Mobile usability pass: enlarged header/sidebar/bottom-nav tap targets, improved mobile sidebar overlay/close behavior, tightened mobile page/card spacing, adapted settings invite/team controls.
