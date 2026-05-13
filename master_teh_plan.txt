# Zani Competitive CRM Product Tasks

Цель документа: зафиксировать задачи, которые нужны Zani, чтобы не уступать amoCRM и Bitrix24 по бизнес-логике и широте функционала, но при этом оставаться простым, быстрым и понятным продуктом для малого и среднего бизнеса.

Главная идея:

Zani должен быть мощной AI-first CRM / Business OS, которая подходит бизнесу с 1 сотрудником и постепенно раскрывается для команд 100+ человек без ощущения сложной корпоративной системы.

## Product Principle

Zani не должен копировать Bitrix24 как “корпоративный портал” и не должен ограничиваться amoCRM как “воронкой продаж”. Нужно взять сильные CRM-механики обоих продуктов и упаковать их в простой рабочий интерфейс:

- быстрый ежедневный cockpit;
- понятные действия;
- минимальный шум;
- AI как помощник, а не отдельная сложная сущность;
- progressive complexity: простые настройки по умолчанию, продвинутые возможности включаются только когда нужны.

## Target Users

### Solo Owner

Бизнес с 1 человеком: салон, кабинет, частный специалист, маленькая школа, сервис.

Потребности:

- быстро видеть новые заявки;
- отвечать клиентам;
- создавать запись;
- не забывать перезвонить;
- понимать, откуда приходят клиенты;
- не тратить время на настройку CRM.

UX-правило:

Интерфейс должен работать “из коробки” без обучения.

### Small Team

Команда 2-15 человек: владелец, администратор, несколько специалистов.

Потребности:

- распределять заявки;
- видеть записи по ресурсам/сотрудникам;
- контролировать ответственных;
- иметь общий inbox;
- ставить задачи;
- видеть простую аналитику.

UX-правило:

Команда должна понять роли и ежедневный процесс за один рабочий день.

### Growing Company

Компания 15-100+ человек: отдел продаж, администраторы, операторы, филиалы, маркетинг.

Потребности:

- роли и права;
- несколько воронок;
- автоматизации;
- SLA;
- отчеты по сотрудникам;
- интеграции;
- контроль качества;
- audit/security.

UX-правило:

Продвинутые функции должны быть доступны, но не мешать простому пользователю.

## Core UX Strategy

### 1. Progressive Complexity

По умолчанию пользователь видит только базовые разделы:

- Главная;
- Заявки;
- Клиенты;
- Записи;
- Диалоги;
- Календарь.

Продвинутые разделы раскрываются через настройки или роль:

- Сделки;
- Автоматизации;
- AI-агенты;
- Аналитика;
- Интеграции;
- Права доступа;
- Platform/Admin tools.

### 2. Action-First Interface

Каждый экран должен отвечать на вопрос:

Что нужно сделать сейчас?

Примеры:

- “Ответить новой заявке”.
- “Назначить запись”.
- “Просрочена задача”.
- “Клиент ждёт ответа”.
- “У менеджера слишком много открытых лидов”.

### 3. One Object, One Timeline

Клиент, лид, сделка и запись не должны жить в разрозненных местах. Для любого клиента должна быть единая история:

- заявки;
- сделки;
- сообщения;
- звонки;
- задачи;
- записи;
- файлы;
- заметки;
- оплаты позже;
- AI summary.

### 4. AI as Quiet Assistant

AI должен помогать внутри существующего workflow:

- предложить ответ;
- кратко пересказать диалог;
- оценить горячесть лида;
- предложить следующее действие;
- создать задачу после подтверждения;
- подсказать, кому написать сегодня.

AI не должен превращать интерфейс в “чат ради чата”.

## Priority Product Tasks

## 1. Full CRM Card System

### Задача

Создать полноценные карточки:

- Client Card;
- Lead Card;
- Deal Card;
- Appointment Card.

### Что должно быть внутри

- Основные данные.
- Ответственный.
- Статус.
- Источник.
- Timeline.
- Задачи.
- Диалоги.
- Записи.
- Заметки.
- Файлы.
- AI summary.
- Next best action.

### Почему это критично

amoCRM сильна именно карточками и историей взаимодействия. Без зрелой карточки Zani будет ощущаться как набор таблиц, а не CRM.

### UX-требование

Карточка открывается как drawer/modal без потери контекста. Пользователь должен редактировать, писать, звонить, создавать задачу или запись из одного места.

## 2. Custom Fields Foundation

### Задача

Добавить настраиваемые поля для:

- clients;
- leads;
- deals;
- appointments.

### Типы полей

- text;
- textarea;
- number;
- money;
- date;
- datetime;
- select;
- multiselect;
- boolean;
- phone;
- email;
- url.

### Что нужно реализовать

- Field definitions per business.
- Values per entity.
- Отображение в карточках.
- Фильтрация по custom fields.
- Права на редактирование позже.

### UX-требование

На старте пользователь не видит сложный конструктор. Настройка custom fields находится в Settings и использует простые шаблоны по нишам.

## 3. Duplicate Control

### Задача

Добавить контроль дублей клиентов и лидов.

### Проверять по

- phone;
- email;
- whatsapp_id;
- telegram_id;
- instagram_id.

### Что нужно реализовать

- Предупреждение при создании клиента/лида.
- Предложение открыть существующего клиента.
- Merge clients.
- Merge audit log.
- Правила дедупликации по business.

### Почему это критично

В реальной CRM хаос начинается с дублей. amoCRM продаёт контроль дублей как важную часть зрелой CRM.

## 4. Pipeline and Stage Engine Upgrade

### Задача

Довести pipeline engine до уровня amoCRM, но сохранить простое управление.

### Нужно добавить

- Несколько pipeline на business.
- Custom stages.
- Stage colors.
- Probability.
- SLA per stage.
- Stage permissions.
- Required fields per stage.
- Win/loss reasons.
- Pipeline templates by niche.
- Kanban drag-and-drop with transition validation.

### UX-требование

Для малого бизнеса по умолчанию одна простая воронка:

- Новый;
- Связались;
- Записан/В работе;
- Успешно;
- Потерян.

Сложные pipelines включаются через “Расширенные настройки”.

## 5. Automation Builder

### Задача

Сделать UI-конструктор автоматизаций поверх существующего automation foundation.

### Triggers

- lead_created;
- deal_created;
- stage_changed;
- message_received;
- appointment_created;
- appointment_cancelled;
- task_overdue;
- client_inactive;
- tag_added;
- form_submitted.

### Conditions

- source equals;
- stage equals;
- amount greater than;
- tag contains;
- manager equals;
- city equals;
- service equals;
- inactivity days;
- AI score greater than.

### Actions

- create task;
- create notification;
- assign manager;
- move stage;
- send message;
- AI summarize;
- AI suggest response;
- webhook;
- delay/wait;
- create follow-up.

### UX-требование

Нужны два режима:

- Simple mode: готовые шаблоны “если новая заявка, создать задачу”.
- Advanced mode: trigger-condition-action builder.

## 6. Unified Communication Center

### Задача

Довести Inbox до полноценного communication hub.

### Каналы

- Website chat.
- Telegram.
- WhatsApp.
- Instagram.
- Email.
- Calls later.

### Функции

- Общая очередь сообщений.
- Назначение ответственного.
- Handoff bot to manager.
- Unread counters.
- SLA timers.
- Quick replies.
- Internal notes.
- AI reply suggestions.
- AI summaries.
- Attachments.
- Conversation linked to client/lead/deal.

### UX-требование

Inbox должен быть похож на современный мессенджер, а не на таблицу. Менеджер должен за секунды понять:

- кто написал;
- что хочет;
- насколько срочно;
- что ответить;
- кто отвечает.

## 7. Role and Permission System

### Задача

Сделать RBAC, который работает для 1 человека и для 100+ сотрудников.

### Роли

- owner;
- admin;
- manager;
- operator;
- marketer;
- accountant;
- staff;
- support.

### Права

- View all / own / team.
- Create.
- Edit.
- Delete.
- Export.
- Assign.
- Change stage.
- Manage automations.
- Manage integrations.
- Manage billing.
- Manage users.
- View financial data.
- Access AI settings.

### Дополнительно

- Teams/departments.
- Branches/locations later.
- Support access grants.
- Audit of permission changes.

### UX-требование

По умолчанию роли должны быть понятными:

- Владелец;
- Администратор;
- Менеджер;
- Специалист.

Гранулярные права должны быть в advanced section.

## 8. Task Management Upgrade

### Задача

Довести задачи до рабочего уровня Bitrix24, но без перегруза.

### Нужно добавить

- Priorities.
- Reminders.
- Recurring tasks.
- Dependencies.
- Task comments.
- Task linked to client/lead/deal/appointment.
- Overdue indicators.
- Calendar sync later.
- AI-generated tasks after confirmation.

### UX-требование

Пользователь должен видеть не “список всех задач”, а:

- мои задачи сегодня;
- просроченные;
- задачи по клиенту;
- задачи команды.

## 9. Forms and Lead Capture

### Задача

Создать систему форм и источников заявок.

### Нужно добавить

- Form builder MVP.
- Embed script.
- UTM tracking.
- Source tracking.
- Auto-create lead/client.
- Duplicate check before creation.
- Form submissions page.
- Basic anti-spam.

### UX-требование

Форма создаётся из шаблона:

- консультация;
- запись;
- заявка;
- обратный звонок.

Пользователь не должен собирать форму с нуля, если не хочет.

## 10. Tags and Segments

### Задача

Добавить зрелую сегментацию клиентов.

### Нужно

- Manual tags.
- AI tags.
- Behavioral tags.
- Saved filters.
- Smart segments.
- Segment export later.

### Примеры сегментов

- “Новые клиенты за 30 дней”.
- “Не отвечали 7 дней”.
- “Записывались больше 2 раз”.
- “Потерянные лиды”.
- “VIP клиенты”.

### UX-требование

Сегменты должны быть понятны бизнесу, а не аналитикам.

## 11. Analytics and Reports

### Задача

Сделать аналитику уровня “владелец понимает бизнес”, не BI-портал.

### Must-have metrics

- New leads.
- Leads by source.
- Conversion lead to appointment/deal.
- Pipeline conversion.
- Manager performance.
- Response time.
- Missed conversations.
- Appointment no-show.
- Repeat clients.
- Revenue estimate.
- Service popularity.

### Reports

- Daily overview.
- Weekly owner report.
- Source performance.
- Team performance.
- Lost reasons.
- Appointment report.

### UX-требование

Не перегружать графиками. Основной формат:

- 5-7 KPI cards;
- короткие таблицы;
- понятные insights;
- export later.

## 12. Notification Center

### Задача

Сделать единый центр уведомлений.

### Типы

- in-app;
- email;
- Telegram;
- push later;
- system.

### Категории

- sales;
- tasks;
- appointments;
- messages;
- finance;
- system;
- AI alerts.

### UX-требование

Уведомления должны быть action-based:

- “Ответить”;
- “Назначить”;
- “Закрыть”;
- “Перейти к клиенту”.

## 13. Import / Export

### Задача

Добавить безопасный импорт и экспорт.

### Нужно

- CSV/XLSX import clients.
- Mapping columns.
- Duplicate preview.
- Import history.
- Export clients/leads/deals.
- Permission for export.
- Audit log for export.

### Почему важно

Компании будут переезжать из Excel, amoCRM, Bitrix24, Google Sheets.

## 14. Public API and Webhooks

### Задача

Подготовить интеграционную платформу.

### Нужно

- API tokens.
- Scoped permissions.
- Webhooks.
- Webhook logs.
- Retry policy.
- Rate limiting.
- Idempotency keys.
- Developer docs.

### UX-требование

В интерфейсе “Интеграции” показывать простые статусы:

- подключено;
- ошибка;
- последний webhook;
- что делать дальше.

## 15. Security and Audit

### Задача

Довести безопасность до уровня доверия SMB и growing companies.

### Нужно

- Audit log for critical changes.
- Login history.
- Export history.
- Permission change history.
- Support access grants.
- Optional 2FA.
- IP whitelist later.
- Session management.
- Data retention settings later.

### UX-требование

Владелец должен видеть:

- кто что изменил;
- кто заходил;
- кто экспортировал;
- у кого какие права.

## 16. Mobile-First CRM

### Задача

Сделать мобильный интерфейс полноценным рабочим режимом.

### Нужно

- Bottom navigation.
- Compact lead/deal cards.
- Fast call/WhatsApp buttons.
- Swipe actions.
- Mobile inbox.
- Mobile calendar.
- Mobile appointment creation.
- PWA install.

### UX-требование

С телефона должны быть быстрыми:

- ответить клиенту;
- создать запись;
- поменять статус;
- поставить задачу;
- открыть карточку клиента.

## 17. Onboarding and Templates

### Задача

Сделать быстрый старт для разных ниш.

### Templates

- dentistry;
- beauty;
- sauna;
- autoservice;
- education;
- medical;
- other.

### В шаблон входит

- pipeline;
- lead sources;
- services examples;
- appointment settings;
- working hours;
- quick replies;
- automations;
- dashboard defaults.

### UX-требование

Новый бизнес должен получить рабочую CRM за 5-10 минут.

## 18. Customer Success Layer

### Задача

Добавить продуктовые механики, которые помогают бизнесу не бросить CRM.

### Нужно

- Setup checklist.
- Empty states with actions.
- Weekly business summary.
- “Что настроить дальше”.
- Health score для business.
- Simple help center.
- Demo data toggle.

### UX-требование

Пользователь не должен думать “что теперь делать?”. Система должна вести его к следующему полезному шагу.

## What We Must Not Do

### Do not copy Bitrix24 complexity

Не делать:

- корпоративный портал в центре продукта;
- 20 равнозначных разделов в навигации;
- сложные настройки до первого результата;
- BI-конструктор в MVP;
- HR/документы/склад до зрелой CRM.

### Do not overload AI

Не делать:

- отдельные AI-виджеты на каждом экране без пользы;
- автодействия без подтверждения;
- сложные AI-панели для SMB;
- AI вместо понятного workflow.

### Do not make admin-first UX

Не делать:

- интерфейс как Django admin;
- таблицы как основной формат всего продукта;
- скрывать действия в сложных меню.

## Suggested Implementation Roadmap

## MVP+ — Close CRM Gaps

Цель: не уступать базовой amoCRM по ежедневной работе.

1. Full CRM cards.
2. Duplicate control.
3. Custom fields foundation.
4. Pipeline/stage upgrade.
5. Unified Inbox polish.
6. Automation builder simple mode.
7. Role presets.
8. Import clients from CSV/XLSX.
9. Mobile card UX.
10. Analytics owner dashboard.

## V2 — Growth and Team Operations

Цель: стать сильнее amoCRM для SMB-команд.

1. Advanced automation builder.
2. WhatsApp integration.
3. Instagram/email channels.
4. Task comments/reminders/recurring tasks.
5. Tags and smart segments.
6. Forms and lead capture.
7. Webhooks/API tokens.
8. Team performance reports.
9. AI lead scoring.
10. Onboarding templates by niche.

## V3 — Enterprise-Ready SMB Platform

Цель: закрыть потребности компаний 100+ сотрудников без превращения в Bitrix24.

1. Granular RBAC.
2. Teams/departments/branches.
3. Advanced audit/security.
4. Support access grants.
5. IP whitelist / 2FA / session management.
6. Scheduled reports.
7. Payment/documents/invoices.
8. Marketplace/integration framework.
9. Public API docs.
10. Advanced analytics exports.

## Product Quality Bar

Каждая новая функция должна проходить 5 вопросов:

1. Понятно ли это владельцу малого бизнеса?
2. Можно ли выполнить основное действие за 1-3 клика?
3. Не ломает ли это простоту для solo owner?
4. Можно ли масштабировать это до команды 100+?
5. Есть ли у AI конкретная польза в этом workflow?

Если ответ “нет” хотя бы на два вопроса, функцию нужно упростить или спрятать в advanced mode.

## Final Positioning

Zani должен стать:

AI-first SMB Growth OS, где CRM является ядром, а коммуникации, автоматизации, записи, аналитика и AI помогают бизнесу быстрее обрабатывать клиентов и расти.

Продукт должен ощущаться так:

- проще Bitrix24;
- быстрее amoCRM;
- умнее классической CRM;
- достаточно мощный для 100+ сотрудников;
- достаточно простой для владельца бизнеса без CRM-опыта.
