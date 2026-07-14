# Zani Required Clean Code Rules

Этот файл фиксирует правила, которые для Zani нужно считать обязательными при дальнейшей разработке. Цель не в “идеальном коде ради идеальности”, а в том, чтобы CRM/Business OS можно было безопасно развивать до 10 000+ активных бизнесов без хаоса, дублей и постоянного переписывания.

Источник для анализа:

- `/Users/maksim/Desktop/Zani/plan/clean_code_rules/cleancoderules.md `

## 1. Правила, обязательные всегда

### 1.1. Сначала искать существующий слой

Перед добавлением новой функции обязательно проверить:

- модели;
- serializers;
- viewsets/views;
- services/selectors;
- permissions;
- API-клиенты frontend;
- hooks;
- shared UI components;
- types.

Нельзя создавать новую модель, endpoint, API-client или компонент, если уже есть подходящий слой, который можно расширить без поломки архитектуры.

### 1.2. Tenant isolation важнее скорости разработки

Любая CRM/merchant-сущность должна быть привязана к `Business` или однозначно выводить `Business` через связанную сущность.

Обязательно:

- backend permissions проверяются на сервере;
- queryset фильтруется по доступным business;
- staff/manager не видят чужой tenant;
- platform/admin/support доступы не смешиваются с merchant CRM;
- `.objects.all()` в API допускается только внутри tenant-aware слоя или platform-only endpoint.

### 1.3. Views не содержат бизнес-логику

`views.py` и `ViewSet` должны заниматься HTTP orchestration:

- принять request;
- проверить permissions;
- вызвать serializer/service/selector;
- вернуть response.

Бизнес-действия должны уходить в:

- `services.py` для write/actions;
- `selectors.py` для сложных read/queryset;
- `permissions.py` для доступа;
- `filters.py` для фильтрации, если фильтров становится много.

### 1.4. Не растить God Class

Нельзя бесконечно расширять общий `TenantModelViewSet`, `SettingsPage`, `Header`, `CrmEntityDrawer` или другой общий файл.

Если общий класс/компонент начинает знать слишком много о разных доменах, нужно выделять:

- mixins;
- отдельные services/selectors;
- feature components;
- feature hooks.

### 1.5. API-клиенты отдельно от UI

Во frontend-компонентах запрещено писать raw `fetch`/`axios`.

Все запросы должны идти через:

- `frontend/src/api/*`;
- reusable CRUD helper;
- feature-specific API module.

### 1.6. Types отдельно и без `any` по умолчанию

TypeScript types должны жить в `frontend/src/types` или рядом с feature только если тип строго локальный.

`any` допускается только временно и осознанно, когда тип внешнего payload действительно неизвестен. Для CRM/business данных нужно использовать явные типы.

### 1.7. Shared UI переиспользовать

Перед созданием новой кнопки, input, modal, table, badge, empty/error state нужно проверить существующие компоненты.

Новые UI-компоненты добавлять только если:

- текущие компоненты не покрывают сценарий;
- компонент будет переиспользован;
- он не ломает общий дизайн Zani.

### 1.8. CRUD должен быть единым

Для CRM-сущностей использовать единый pattern:

- list;
- retrieve;
- create;
- update;
- archive/delete;
- restore, если сущность критичная;
- search/filters;
- loading/error/empty/forbidden states;
- audit/activity там, где это важно.

Нельзя каждый раз писать CRUD “с нуля” другим стилем.

### 1.9. Production flow без скрытых mock-данных

Mock допустим только если:

- явно помечен как mock/dev/demo;
- лежит отдельно;
- не маскирует отсутствие реального backend/API;
- не используется как production business logic.

### 1.10. Интеграции только через provider layer

WhatsApp, Telegram, Instagram, email, payments, AI и внешние API должны подключаться через provider/service architecture.

Нельзя завязывать бизнес-логику на конкретного платного провайдера прямо в views/components.

### 1.11. Security defaults

Обязательно:

- secrets только в env/config, не в коде;
- `.env`, ключи, токены и приватные файлы не попадают в git/archive;
- permissions проверяются на backend;
- destructive actions имеют audit;
- critical delete заменяется archive/restore, если нет жёсткой причины;
- support/platform access должен быть явным и логируемым.

### 1.12. Тесты для backend-фич обязательны

Для каждой backend-фичи минимум:

- happy path API/service test;
- permission test;
- tenant isolation test;
- regression test для уже существующего сценария, если фича расширяет старый слой.

Если фича меняет деньги, доступы, импорт/экспорт, роли, архивирование или сообщения, тесты обязательны без исключений.

## 2. Правила размера файлов

Эти лимиты считать не догмой, а порогом для обязательной проверки архитектуры.

### Frontend ориентиры

- `Page.tsx`: до 250-300 строк.
- `Component.tsx`: до 150-200 строк.
- `Form.tsx`: до 200 строк.
- `Table.tsx`: до 200 строк.
- `hook.ts`: до 120-150 строк.
- `api.ts`: до 200 строк.

Если файл сильно выше лимита, перед добавлением новой фичи нужно вынести:

- дочерние компоненты;
- forms;
- hooks;
- tables;
- domain helpers;
- constants.

### Backend ориентиры

Если `views.py`, `services.py`, `serializers.py` или общий helper становится слишком большим и начинает обслуживать несколько разных доменов, нужно разделять по доменным файлам.

Пример:

- `security_views.py`;
- `import_export_views.py`;
- `forms_service.py`;
- `segments.py`;
- `crm_cards.py`.

## 3. Правила структуры backend

Рекомендуемая структура для apps, где появляется сложная логика:

```text
app/
  models.py
  serializers.py
  views.py
  services.py
  selectors.py
  permissions.py
  filters.py
  tasks.py
  tests.py или tests/
```

Не каждый app обязан сразу иметь все эти файлы. Но если логика растёт, её нужно выносить именно в эти слои, а не складывать всё во `views.py`.

## 4. Правила структуры frontend

`Page.tsx` не должен содержать всё сразу:

- большую таблицу;
- модалки;
- формы;
- фильтры;
- drawer;
- API-логику;
- много несвязанных `useState`;
- сложные вычисления бизнес-логики.

Если страница разрастается, выносить в:

- `components`;
- `features/<feature>/components`;
- `features/<feature>/hooks`;
- `features/<feature>/constants`;
- `api`;
- `types`.

## 5. Что в исходных правилах важно, но не абсолютно

### 5.1. Строгие лимиты строк

Лимиты полезны как сигнал, но нельзя ломать читаемость ради механического дробления. Иногда файл на 330 строк лучше, чем 8 искусственных файлов без смысла.

Правило: если файл превысил лимит и в него добавляется новая логика, сначала оценить декомпозицию.

### 5.2. “Model tests для каждой фичи”

Не всегда нужен отдельный model test, если модель простая и вся ценность покрыта API/service тестом.

Но для моделей с методами, constraints, state transitions, archive/restore, billing/security/permissions model tests нужны.

### 5.3. Entitlement layer

Это правило обязательно для billing/limits, но не нужно внедрять в каждую фичу заранее.

Когда появятся реальные тарифные ограничения, проверки должны идти через entitlement/service layer, а не через `if plan == "pro"`.

## 6. Definition of Done для новых задач

Задача считается завершённой только если:

- использованы существующие слои, а не создан дубль;
- tenant isolation сохранён;
- backend permissions есть на сервере;
- frontend flow реально доступен пользователю;
- есть loading/error/empty/forbidden states там, где применимо;
- критичные действия пишут audit/activity;
- API-клиенты вынесены из UI;
- типы описаны;
- README/plan обновлены, если меняется поведение проекта;
- `makemigrations --check --dry-run`, `manage.py check`, `manage.py test`, `npm run build` проходят.

## 7. Clean archive rules

В архив/публичную передачу проекта нельзя включать:

- `.env`;
- `.venv`;
- `.git`;
- `db.sqlite3`;
- `__pycache__`;
- `node_modules`;
- `dist`;
- `build`;
- `__MACOSX`;
- вложенные `.zip`.

## 8. Главный принцип для Zani

Zani — не набор экранов и не админка. Это multi-tenant SaaS-платформа.

Поэтому каждая новая фича должна быть:

- tenant-safe;
- permission-aware;
- audit-aware для критичных действий;
- встроена в существующие CRM flows;
- понятна для SMB-пользователя;
- расширяема без переписывания ядра.

