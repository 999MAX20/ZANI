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

Этап 5.1 не добавляет визуальный builder. Frontend продолжает использовать существующую страницу `/dashboard/automations` для базового списка правил, а выполнение правил происходит на backend через события CRM.

## Notifications and Tasks Polish

Этап 5.2 добавляет notification center в header и улучшенную страницу `/dashboard/tasks`: быстрые задачи, связи с клиентом/заявкой/записью, фильтры и быстрые смены статусов.

## Auth

По умолчанию используются endpoints:

- `POST /api/auth/token/`
- `POST /api/auth/token/refresh/`

Их можно поменять в `src/api/auth.ts`.
