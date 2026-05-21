# Phase 10 — UI/UX Competitive Polish

Дата: 20.05.2026

Цель этапа: улучшить ежедневные CRM-сценарии без добавления тяжелой бизнес-логики и без превращения Zani в перегруженную enterprise-панель.

## Что изменено

- Dashboard стал role-aware:
  - owner/admin видят управленческий обзор, конверсию, выручку и клиентскую базу;
  - operator/staff получают рабочий фокус на заявках, чатах, задачах и записях.
- Settings получили быстрые секции:
  - команда;
  - безопасность;
  - быстрые ответы;
  - роли;
  - импорт;
  - формы;
  - тариф;
  - поля;
  - профиль бизнеса.
- CRM drawer получил inline-edit:
  - статус и рабочая заметка заявки;
  - статус и заметка сделки;
  - статус и заметка записи.
- Inbox стал удобнее на mobile:
  - список диалогов ограничен по высоте;
  - composer закреплен ближе к нижней зоне экрана;
  - быстрые ответы стали горизонтальной лентой;
  - текст ответа вводится в `textarea`, отправка с desktop через `Cmd/Ctrl + Enter`.
- Kanban заявок стал mobile-friendly:
  - колонки прокручиваются snap-scroll;
  - каждая колонка занимает удобную ширину на телефоне.
- Calendar получил более удобный мобильный выбор даты:
  - date picker открывается как широкая панель на mobile;
  - кнопки переключения дня и создания записи выстраиваются без сжатия.
- Integrations cards получили простой recommended-next-step блок.
- Onboarding copy стал более прикладным: меньше “demo”, больше рабочего пути до первой заявки.

## Что принципиально не добавлялось

- Новые backend-модели.
- Новые внешние сервисы.
- Тяжелые графики или декоративная AI-аналитика.
- Скрытые production mocks.

## Проверки

Минимально обязательная frontend-проверка:

```bash
cd frontend && npm run build
```

Полный regression-набор для этапа:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
cd frontend && npm run e2e
```
