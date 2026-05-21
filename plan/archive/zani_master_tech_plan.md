# ZANI — ЕДИНЫЙ MASTER TECH PLAN

Дата аудита: 13 мая 2026  
Точка отсчёта: архив `Zani.zip`, актуальная версия проекта после серии этапов Codex.

---

## 0. Главная фиксация по названию и продукту

Рабочее и публичное название проекта: **Zani**.

Больше не использовать в новых промптах и документах названия:
- NeuroBoost;
- SMB AI CRM;
- AI SMB Platform как имя продукта.

Допускается использовать старые названия только в контексте технического долга: «в проекте остались legacy-упоминания, их нужно переименовать в Zani».

---

## 1. Главная продуктовая логика Zani

Zani — это AI-first платформа для малого и среднего бизнеса.

Публичный продукт Zani включает:

1. Официальный сайт Zani.
2. Merchant CRM для бизнесов.
3. AI-ботов для сайта и мессенджеров.
4. Unified Inbox для всех каналов общения.
5. AI Core для ответов, подсказок, summary и автоматизации.
6. Автоматизации CRM.
7. Задачи, уведомления, аналитика.
8. Подписки и тарифы.
9. Интеграции с Telegram, WhatsApp, Instagram, сайтом, email.
10. Platform/Admin слой для владельцев Zani.

Что НЕ является публичным продуктом на текущем этапе:

1. Парсер компаний.
2. Генератор лендингов.
3. Массовый developer outreach.
4. Prospect scraping.
5. Внутренние инструменты сбора базы.

Эти инструменты нужны команде разработки и продаж, но они не должны перегружать публичное ядро Zani.

---

## 2. Правильное разделение слоёв

### 2.1. Public Product Core

Это то, что видит и покупает мерчант.

Сюда входят:

- public website;
- auth;
- Merchant CRM;
- clients;
- leads;
- deals/pipeline;
- tasks;
- appointments/calendar;
- services/resources;
- conversations/inbox;
- bots;
- AI Core;
- AI assistant;
- automations;
- analytics;
- billing/subscriptions;
- integrations;
- settings;
- Platform access для команды Zani.

### 2.2. Internal Dev Tools

Это не клиентский продукт.

Сюда позже отдельно могут войти:

- parser;
- landing generator;
- developer outreach;
- prospect enrichment;
- lead acquisition tools.

Рекомендация: держать это либо в отдельном репозитории, либо в отдельной директории `internal_tools/`, либо на отдельном сервисе. Не смешивать с Merchant CRM и AI-bot product core.

### 2.3. Infrastructure Layer

Общий технический слой:

- PostgreSQL;
- Redis;
- Celery;
- Docker;
- Sentry;
- object storage;
- email provider;
- payment provider;
- monitoring/logging;
- backups.

---

## 3. Текущая структура проекта по архиву Zani

В проекте уже есть:

### Backend apps

- `accounts` — пользователи, роли, auth/me.
- `businesses` — компании/мерчанты и BusinessMember.
- `crm` — pipeline/deals/stages.
- `clients` — клиенты.
- `leads` — заявки.
- `tasks` — задачи.
- `scheduling` — записи, ресурсы, рабочие часы.
- `services` — услуги.
- `conversations` — базовые CRM conversations/messages.
- `bots` — Bot, BotChannel, BotConversation, BotMessage, website chat, suggest reply.
- `integrations` — Telegram skeleton.
- `ai_core` — AIRequestLog, BusinessKnowledgeItem, AI services, CRM assistant.
- `automations` — AutomationRule/Condition/Action/Run.
- `notifications` — уведомления.
- `activities` — activity timeline/notes/tags.
- `billing` — тарифы и подписки.
- `analytics` — analytics events.
- `core` — audit, permissions, health, base viewsets.

### Frontend modules

- public pages;
- auth;
- platform placeholder;
- dashboard;
- leads;
- deals;
- clients;
- tasks;
- appointments;
- calendar;
- conversations;
- bots;
- AI assistant;
- automations;
- services/resources;
- analytics;
- settings;
- timeline.

---

## 4. Что уже реализовано по планам

По фактической структуре проекта реализованы следующие крупные этапы:

1. Platform Access Foundation.
2. Platform Layout Polish.
3. Security Hardening / Auth baseline.
4. Public Website Shell.
5. Billing Foundation.
6. Merchant CRM UI Upgrade.
7. Bots Foundation.
8. Website Chat Widget Foundation.
9. Telegram Integration Skeleton.
10. AI Core Foundation.
11. AI Assistant for CRM.
12. AI Bot Replies MVP.
13. Automation Foundation.
14. Notifications and Tasks foundation/polish.
15. Health endpoints и частичная production infrastructure.

То есть Zani уже не просто CRM. Это уже заготовка AI-first CRM/product core.

---

## 5. Техническая проверка архива

### 5.1. Backend

`python manage.py check` прошёл успешно.

`python manage.py test` в текущем окружении начал выполнение и прошёл значительную часть тестов, но не завершился до таймаута. Нужно отдельным Codex-этапом найти зависший/долгий тест или внешний вызов.

Отдельный риск: в логах появилась рекомендация PyJWT о коротком HMAC key. Значит, production `SECRET_KEY` должен быть не короче 32 байт и храниться только в env/secret manager.

### 5.2. Frontend

Первый `npm run build` упал из-за Rollup optional dependency в перенесённом `node_modules`.

После чистой установки:

```bash
cd frontend
rm -rf node_modules
npm ci
npm run build
```

frontend build прошёл успешно.

### 5.3. Архив проекта

В архив попали нежелательные файлы:

- `.venv/`;
- `frontend/node_modules/`;
- `frontend/dist/`;
- `__MACOSX/`;
- `.DS_Store`;
- `.env`;
- `db.sqlite3`;
- `__pycache__/`;
- TypeScript build info files.

Это критично исправить перед дальнейшей командной работой и передачей проекта.

---

## 6. Главные расхождения с анализами MoonAI / amoCRM / Bitrix24

### 6.1. Главный разрыв с MoonAI

MoonAI-сильная сторона — единая коммуникационная система:

```text
канал → общий inbox → AI agent → qualification/tools → handoff manager → CRM/deal → analytics/billing
```

В текущем Zani есть части этой схемы:

- `conversations`;
- `bots`;
- `ai_core`;
- website chat;
- Telegram webhook;
- leads/deals;
- automations.

Но они пока не соединены в единую операционную систему.

Главный missing module: **Unified Omnichannel Inbox + Agent Runtime**.

### 6.2. Главный разрыв с amoCRM

amoCRM сильна в:

- визуальной воронке;
- карточке сделки;
- задачах и действиях менеджера;
- быстрых касаниях;
- понятном sales flow.

В Zani есть deals/pipeline/tasks/leads, но нужно усилить:

- kanban pipeline;
- deal detail;
- lead/deal timeline;
- next action logic;
- быстрые действия из карточек;
- AI-подсказки по сделке.

### 6.3. Главный разрыв с Bitrix24

Bitrix24 силён как «всё в одном», но перегружен.

Zani не должен становиться Bitrix24.

Наша стратегия:

- не копировать портал;
- не делать тяжёлую ERP;
- сделать легче, понятнее и AI-first;
- фокус: CRM + Inbox + Bots + AI + Automation.

---

## 7. Целевая архитектура Zani

```text
Zani Public Website
        ↓
Auth / Registration / Login
        ↓
Merchant Workspace
        ├── CRM
        ├── Leads / Deals / Clients
        ├── Tasks / Calendar / Services
        ├── Unified Inbox
        ├── Bots
        ├── AI Assistant
        ├── Automations
        ├── Analytics
        ├── Billing
        └── Settings / Integrations

Platform Workspace
        ├── platform overview
        ├── merchants
        ├── billing overview
        ├── product analytics
        └── system settings

AI Core
        ├── prompt service
        ├── context service
        ├── knowledge base
        ├── request logs
        ├── tool registry
        └── agent runtime

Integrations Layer
        ├── website chat
        ├── Telegram
        ├── WhatsApp
        ├── Instagram
        ├── email
        └── future providers
```

---

## 8. Главные технические принципы дальше

1. Один Codex-промпт = один этап.
2. Не переходить дальше, пока backend check/tests и frontend build не прошли.
3. Не смешивать public product core и internal dev tools.
4. Все бизнес-данные только через tenant/business isolation.
5. Frontend guards — UX, backend permissions — настоящая защита.
6. AI должен быть единым ядром, а не отдельным AI для каждого канала.
7. Каналы Telegram/WhatsApp/Instagram/Website — это connectors, а не отдельные продукты.
8. Боты — это product module Zani, но parser/landing generator/outreach — developer tools.
9. Не вводить микросервисы раньше времени. Сейчас правильный путь — modular monolith.
10. Перед production обязательно очистить архив/репозиторий от `.env`, `.venv`, `node_modules`, `dist`, `db.sqlite3`.

---

## 9. Roadmap дальнейшего развития

### Phase 0 — Rename & Repository Hygiene

Цель: полностью зафиксировать Zani как единственное имя и очистить проект.

Сделать:

- заменить публичные упоминания старого имени на Zani;
- обновить README;
- обновить package name;
- обновить env examples;
- обновить docs;
- очистить архив/репозиторий;
- добавить clean archive script;
- добавить create_platform_admin command, если его ещё нет;
- перевести getCurrentUser на общий apiClient, если ещё не переведено.

### Phase 1 — Regression & Test Stabilization

Цель: добиться уверенного тестового baseline.

Сделать:

- найти причину долгого/зависшего backend test run;
- изолировать внешние вызовы;
- гарантировать, что tests не ходят во внешние API;
- добавить pytest markers или Django tests grouping;
- зафиксировать команды проверки.

### Phase 2 — Unified Inbox Core

Цель: единый inbox для всех каналов.

Сделать:

- объединить операционную логику conversations и bot_conversations;
- добавить inbox API;
- assignment;
- priority;
- unread counts;
- status;
- handoff;
- bot_enabled;
- last message;
- filters/search.

### Phase 3 — Inbox Frontend

Цель: заменить демо ConversationsPage на реальный inbox.

Сделать:

- список диалогов из backend;
- фильтры по каналам;
- карточка диалога;
- сообщения;
- отправка ручного ответа;
- handoff UI;
- AI suggestion button;
- создание lead/deal/task из диалога.

### Phase 4 — Agent Runtime Foundation

Цель: AI-агент как управляемая сущность.

Сделать:

- AgentProfile;
- AgentInstruction;
- behavior settings;
- tool registry;
- runtime service;
- manual suggest only;
- no auto-send by default.

### Phase 5 — AI Tools for CRM Actions

Цель: AI умеет готовить действия, но не выполняет критичное без подтверждения.

Tools:

- create_lead;
- create_client;
- create_deal;
- create_task;
- create_appointment_request;
- summarize_conversation;
- qualify_lead.

### Phase 6 — Deal/Pipeline Upgrade

Цель: приблизить CRM UX к amoCRM, но проще и AI-first.

Сделать:

- kanban pipeline;
- deal detail;
- activity timeline;
- tasks inside deal;
- source/channel attribution;
- AI next best action.

### Phase 7 — Channel Provider Abstraction

Цель: подготовить WhatsApp/Instagram/Email без жёсткой привязки к провайдеру.

Сделать:

- IntegrationProvider;
- ChannelAccount;
- inbound/outbound interfaces;
- provider event logs;
- retry/outbox.

### Phase 8 — Website Widget SDK MVP

Цель: нормальный embeddable сайт-чат.

Сделать:

- public widget JS;
- theme config;
- public token;
- create conversation;
- send messages;
- privacy-safe endpoints.

### Phase 9 — Telegram Production Pass

Цель: сделать Telegram не skeleton, а рабочий connector.

Сделать:

- merchant bot token management;
- set webhook command/API;
- outbound reply;
- message status;
- error handling;
- integration settings UI.

### Phase 10 — Billing & Usage Limits

Цель: MRR-ready продукт.

Сделать:

- feature limits;
- usage counters;
- AI token usage;
- bot message usage;
- plan restrictions;
- billing dashboard placeholders.

### Phase 11 — Platform Admin Real Dashboard

Цель: внутренний кабинет владельцев Zani без developer tools.

Сделать:

- merchants list;
- active subscriptions;
- MRR overview;
- product usage;
- errors/health;
- feature adoption.

### Phase 12 — Production Infrastructure

Цель: стабильный запуск.

Сделать:

- clean docker compose;
- celery worker;
- celery beat;
- Sentry;
- health checks;
- env.example;
- object storage foundation;
- backups;
- logging.

### Phase 13 — Internal Dev Tools Boundary

Цель: отдельно описать и подключать parser/landing generator/outreach только вне product core.

Сделать:

- docs/internal-tools-architecture.md;
- отдельный API contract;
- отдельная БД или отдельные таблицы, если понадобится;
- не мешать Merchant CRM.

---

## 10. Приоритет на ближайшие 5 шагов

1. **Zani Rename + Repo Hygiene + clean archive**.
2. **Test Stabilization + no external network in tests**.
3. **Unified Inbox backend**.
4. **Real Inbox frontend вместо demo ConversationsPage**.
5. **Agent Runtime Foundation + AI tools skeleton**.

После этих пяти шагов Zani станет значительно ближе к MoonAI/amoCRM уровню по самой ценной части: коммуникации → AI → CRM → сделки.
