# Zani Master Technical Plan

Дата актуализации: 2026-05-22

Этот документ является главным рабочим техпланом Zani. Он объединяет актуальные планы из папки `plan`, фиксирует текущее направление проекта и задает порядок дальнейшей реализации.

## 1. Назначение Документа

Zani — AI-first CRM / Business OS для малого и среднего бизнеса.

Продуктовая цель:

```text
дать SMB-командам мощность amoCRM / Bitrix24 / HubSpot,
но без ощущения тяжелой CRM, сложного внедрения и перегруженной админки.
```

Техническая цель:

```text
довести текущий Django + React multi-tenant SaaS до стабильной,
безопасной и масштабируемой платформы для 10 000 активных мерчантов.
```

Этот файл нужен, чтобы дальше реализовывать задачи без переключения между множеством старых планов.

## 2. Статус Файлов В `plan`

### 2.1. Главный Актуальный Файл

```text
plan/ZANI_MASTER_TECH_PLAN.md
```

Статус: `актуальный источник правды`.

Использовать для:

- выбора следующих задач;
- понимания roadmap;
- production-readiness;
- integration/onboarding strategy;
- правил завершенности этапов.

### 2.2. Актуальные Supporting Documents

```text
plan/clean_code_rules/zani_required_clean_code_rules.md
```

Статус: `обязательный clean-code contract`.

Использовать всегда при изменении кода.

```text
plan/ui-ux/reference_analysis.md
```

Статус: `актуальный UI/UX reference guide`.

Использовать при frontend/UI задачах. Не является execution roadmap, но задает visual/product direction.

```text
plan/plan_20_05/zani_integration_onboarding_master_plan_20_05.md
```

Статус: `актуальный источник для integration/onboarding направления`.

Основные идеи из него включены в этот мастер-план. Сам файл можно использовать как более подробную спецификацию для invisible integrations.

### 2.3. Выполненные Или Исторические Файлы

```text
plan/teh plan 13.05.md
plan/zani_execution_prompts_from_13_05.md
```

Статус: `исторически важные, но не главный execution-source`.

Причина:

- execution prompts 01-30 выполнены;
- документ 13.05 задавал первоначальную фазовую стратегию A/B/C/D;
- многие идеи уже реализованы в коде и README;
- оставшиеся актуальные выводы перенесены в этот мастер-план.

Использовать только как архивную детализацию по уже выполненным CRM-модулям.

### 2.4. Исходные Планы Партнера От 20.05

```text
plan/plan_20_05/tehpan_20_05_1
plan/plan_20_05/teh_plan_20_05_2
```

Статус: `исходники, объединены`.

Они объединены в:

```text
plan/plan_20_05/zani_integration_onboarding_master_plan_20_05.md
```

### 2.5. Архив

```text
plan/archive/*
```

Статус: `история рассуждений`.

Не использовать как текущий план, кроме случаев, когда нужно восстановить контекст:

- анализ amoCRM/Bitrix24;
- старые Codex prompts;
- MoonAI analysis;
- ранний master plan.

## 3. Текущее Состояние Проекта

Zani уже содержит реальное multi-tenant CRM/Business OS ядро.

Реализовано:

- Django + DRF backend;
- React + TypeScript frontend;
- JWT auth;
- `Business` as tenant root;
- tenant-aware querysets and permissions;
- Platform Admin foundation;
- Merchant CRM;
- clients;
- leads;
- deals;
- pipelines/stages;
- appointments/calendar;
- services/resources/working hours;
- conversations/inbox;
- website chat foundation;
- Telegram/WhatsApp provider foundation;
- tasks;
- notifications;
- analytics;
- custom fields;
- tags/segments;
- import/export;
- public forms / lead capture;
- RBAC/ABAC foundation;
- departments/teams;
- audit/security center;
- support access grants;
- billing plans/subscriptions/usage foundation;
- automations rules/conditions/actions/runs;
- AI assistant foundation;
- knowledge items / agent profiles;
- private file attachments;
- public API tokens;
- outbound webhooks;
- onboarding templates by niche;
- mobile-first shared shell polish.

Текущая оценка зрелости:

- internal demo / controlled pilot: `70-75%`;
- paid beta with manual support: `55-60%`;
- production for 10 000 active merchants: `35-40%`.

Главный вывод: продуктовая поверхность уже широкая. Следующий этап — не “еще больше экранов”, а production-readiness, integration hardening, realtime, storage, operational reliability и UX упрощение.

## 4. Product North Star

Zani должен быть:

- быстрее и проще amoCRM/Bitrix24 для SMB;
- достаточно мощным для команды от 1 до 100+ сотрудников;
- AI-first, но без навязчивого AI шума;
- action-first, а не admin-first;
- mobile-first для владельцев и операторов;
- безопасным для данных клиентов и сотрудников;
- понятным без обучения и долгого внедрения.

Главные продуктовые принципы:

1. Progressive complexity.
   Solo-owner видит простые действия. Growing company получает роли, отделы, аудит, отчеты и автоматизации по мере роста.

2. One object, one context.
   Клиент, лид, сделка, запись, диалог, задачи, файлы и timeline должны сходиться в единую CRM-карточку.

3. AI as quiet assistant.
   AI предлагает, объясняет, резюмирует и ускоряет. AI не должен перекрывать основную CRM-работу.

4. Invisible integrations.
   Пользователь включает бизнес-функцию, а не “настраивает API”.

5. Owner trust layer.
   Владелец должен видеть, кто удалил, кто не ответил, кто изменил статус, почему заявка потеряна и кто имел доступ.

## 5. Непереговорные Архитектурные Правила

Эти правила дублируют и усиливают clean-code contract.

### 5.1. Tenant Isolation

Любая merchant-сущность должна быть привязана к `Business` или однозначно выводить `Business` через связанную сущность.

Обязательно:

- server-side permissions;
- tenant-filtered querysets;
- object-level access;
- no cross-business data leaks;
- platform/support access отдельно от merchant API;
- tests for cross-tenant isolation.

### 5.2. Provider-First Integrations

Интеграции нельзя писать прямо в CRM views/components.

Правильный путь:

```text
provider adapter
→ connector service
→ event normalizer
→ business event
→ CRM / AI / analytics / notifications / automations
```

### 5.3. Services And Selectors

Views/ViewSets не должны содержать бизнес-логику.

Писать:

- `services.py` для write/actions;
- `selectors.py` для сложных read/querysets;
- `permissions.py` для доступа;
- `tasks.py` для Celery jobs;
- `providers/*` для внешних API.

### 5.4. Frontend API Boundary

Во frontend-компонентах нельзя писать raw `axios/fetch`.

Все запросы идут через:

```text
frontend/src/api/*
```

### 5.5. Audit For Risky Actions

Audit/activity обязателен для:

- deletion/archive/restore;
- role/permission changes;
- exports/imports;
- file downloads/uploads;
- integration credential changes;
- support/platform access;
- billing/subscription changes;
- automation activation;
- outbound webhooks/API token actions.

## 6. Главные Gaps Перед 10 000 Мерчантов

### P0 — Production Infrastructure

Не хватает:

- staging/production settings split;
- production env checklist;
- migration/rollback policy;
- managed Postgres strategy;
- Redis/Celery runtime strategy;
- structured logging;
- error monitoring;
- health/readiness endpoints coverage;
- backup/restore documentation;
- deployment pipeline;
- secrets policy.

### P0 — Object Storage And Data Safety

Не хватает:

- production object storage decision;
- bucket/prefix strategy per business;
- storage quota per plan/business;
- private file access audit;
- retention/deletion policy;
- antivirus/provider interface;
- signed URL or backend streaming policy;
- storage usage UI.

### P0 — Realtime / Near-Realtime Layer

Не хватает:

- WebSocket/SSE or robust polling strategy;
- realtime notification count;
- live inbox messages;
- conversation assignment/handoff updates;
- SLA timers;
- fallback behavior for cheap hosting.

### P0 — Queue-Backed Automations

Не хватает:

- queue-backed execution for delayed actions;
- retry/failure policy;
- idempotency keys;
- run detail logs;
- failure UI;
- duplicate event prevention;
- per-business rate limits.

### P0 — Integration Hardening

Не хватает:

- unified connector models;
- encrypted credentials;
- masked credentials;
- connector health status;
- inbound business events;
- webhook verification;
- provider error mapping;
- sync cursors;
- integration activity timeline.

### P1 — QA And Scale

Не хватает:

- Playwright/E2E smoke tests;
- owner/operator/platform user flows;
- mobile viewport regression;
- query count profiling;
- indexes review;
- pagination audit;
- load testing baseline;
- API throttling by endpoint category.

### P1 — Entitlements And Billing Enforcement

Не хватает:

- centralized entitlement layer;
- plan limits enforced in services;
- usage counters tied to plan limits;
- upgrade prompts;
- invoices/payment provider later.

### P1 — UX Simplification

Не хватает:

- settings split into tabs/sections;
- owner/operator role-specific navigation;
- CRM card inline editing polish;
- inbox mobile composer polish;
- kanban mobile polish;
- onboarding copy refinement;
- integrations as business capabilities, not developer settings.

## 7. Целевая Production Architecture

### 7.1. Services

Minimum production topology:

- frontend: static host/CDN;
- API web: Django + Gunicorn/Uvicorn;
- Postgres: managed PostgreSQL;
- Redis: managed Redis;
- Celery workers;
- Celery beat/scheduler;
- object storage;
- error monitoring;
- logs/metrics;
- backup system.

### 7.2. Queues

Разделить Celery queues:

- `default`;
- `integrations_webhooks`;
- `integrations_sync`;
- `automations`;
- `notifications`;
- `ai`;
- `webhooks_outbound`;
- `reports_exports`;
- `maintenance`.

### 7.3. Database

Рекомендуемое направление:

- Django остается core backend;
- Postgres остается main DB;
- Supabase можно использовать как managed Postgres and optionally Storage;
- не переносить auth/business logic в Supabase Auth на этом этапе;
- не использовать RLS как замену backend tenant permissions сейчас.

Нужно добавить:

- indexes audit;
- heavy query profiling;
- DB connection pooling strategy;
- backup/PITR;
- read replica later for analytics/reporting.

### 7.4. Storage

Подход:

- private business files are object-storage backed;
- paths are scoped by business;
- metadata lives in Django DB;
- access checked by backend;
- downloads audited for sensitive files.

Possible providers:

- Supabase Storage;
- Cloudflare R2;
- AWS S3;
- Yandex Object Storage.

## 8. Integration & Onboarding Strategy

Источник направления:

```text
plan/plan_20_05/zani_integration_onboarding_master_plan_20_05.md
```

Главная идея:

```text
Merchant should feel: “I turned on a business function”,
not: “I implemented an integration”.
```

Zani не должен копировать ERP клиента. Zani должен получать operational events:

- `sale_completed`;
- `lead_created`;
- `message_received`;
- `inventory_low`;
- `employee_response_slow`;
- `campaign_performance_drop`;
- `appointment_created`;
- `payment_received`.

Две модели получения данных:

1. Webhook mode.
   External system sends events to Zani.

2. Pull/sync mode.
   Zani periodically fetches data and normalizes it to events.

Первый implementation priority:

```text
Integration Foundation Hardening
```

Must build:

- connector models;
- encrypted/masked credentials;
- provider registry hardening;
- connector health;
- business event model;
- idempotency/deduplication;
- integration timeline;
- Celery-ready boundaries;
- business-friendly integrations UI.

Do not:

- подключать все реальные провайдеры сразу;
- показывать raw tokens merchant user;
- строить дубль 1С/ERP;
- смешивать provider-specific logic with CRM views.

## 9. UI/UX Direction

Источник:

```text
plan/ui-ux/reference_analysis.md
```

Главный принцип:

```text
не делать красивую админку;
делать быстрый рабочий cockpit для владельца и команды SMB.
```

Frontend должен быть:

- mobile-first;
- clean SaaS;
- action-first;
- fast;
- clear;
- calm AI-first;
- role-aware;
- without heavy dashboards by default.

Приоритетные UX улучшения:

1. Dashboard owner/operator variants.
2. CRM card inline editing.
3. Inbox as daily work center.
4. Mobile kanban/cards.
5. Calendar mobile usability.
6. Settings split into clear sections.
7. Integrations as capability cards.
8. Onboarding as progressive checklist.

## 10. Новый Roadmap

### Phase 0 — Plan And Agent Governance

Статус: `текущий этап`.

Must build:

- master tech plan;
- `AGENTS.md`;
- updated `plan/README.md`;
- clear source-of-truth hierarchy.

Acceptance:

- понятно, какие планы актуальны;
- понятно, какие планы архивные;
- есть единый порядок работы.

### Phase 1 — Production Readiness Baseline

Goal: подготовить платформу к controlled paid beta and 10k path.

Status: `completed 2026-05-20`.

Must build:

- settings split or production settings docs;
- production env checklist;
- managed Postgres decision guide;
- Redis/Celery mandatory runtime docs;
- queue naming and routing plan;
- Sentry/logging setup validation;
- backup/restore docs;
- health/readiness endpoints review;
- deployment runbook;
- README update.

Acceptance:

- проект можно поднять в staging по документации;
- production env variables понятны;
- production safety checks добавлены;
- `/ready/` endpoint добавлен;
- health/db/readiness endpoints documented;
- backup/restore baseline documented;
- Celery queue baseline documented;
- checks pass.

### Phase 2 — Storage And File Safety

Goal: довести attachments/storage до production-safe уровня.

Status: `completed 2026-05-20`.

Must build:

- storage provider decision doc;
- per-business file path strategy;
- storage usage accounting;
- quota model/service;
- plan-aware storage limits through entitlement layer;
- private download audit;
- retention/delete policy;
- antivirus provider interface placeholder;
- update stale `docs/file-storage.md`.

Acceptance:

- owner видит storage usage;
- operator cannot access чужие files;
- file download is audited;
- plan limits can be checked centrally;
- upload is rejected when storage limit is exceeded;
- tests cover tenant isolation and quota behavior.

### Phase 3 — Realtime Or Reliable Polling

Goal: не пропускать сообщения, уведомления, handoff and SLA events.

Status: `completed 2026-05-20`.

Decision:

- start with robust polling if deployment simplicity is priority;
- use SSE/WebSocket if inbox becomes central live-workspace.

Must build:

- realtime strategy doc;
- notification count updates;
- inbox updates;
- conversation assignment updates;
- fallback polling behavior;
- frontend hooks;
- tests where applicable.

Acceptance:

- manager sees new message without full reload;
- notification state updates predictably;
- no cross-tenant realtime leak;
- mobile behavior remains stable.

Implemented decision:

- reliable polling baseline;
- centralized frontend realtime intervals;
- notifications refresh every 20 seconds;
- inbox conversations refresh every 12 seconds;
- selected inbox messages refresh every 7 seconds;
- SSE/WebSocket strategy documented for later.

### Phase 4 — Integration Foundation Hardening

Goal: invisible integrations architecture.

Status: `completed 2026-05-20`.

Must build:

- connector models;
- encrypted credentials;
- masked serializers;
- provider registry hardening;
- connector health;
- business event model;
- idempotency/dedup;
- webhook/pull event normalization service;
- integration timeline;
- integrations frontend page with business capability cards.

Acceptance:

- owner can view/manage allowed connectors;
- operator without permission cannot manage connectors;
- raw credentials never shown;
- failed connector has clear recovery state;
- inbound event can be processed idempotently;
- tests pass.

Implemented:

- connector domain models: `BusinessConnector`, `ConnectorCredential`, `BusinessEvent`, `ConnectorSyncRun`;
- masked write-only credentials API;
- encrypted/signed backend credential envelope;
- provider capabilities endpoint;
- connector health-check action;
- idempotent inbound event normalization service;
- provider registry unknown-provider guard;
- `/dashboard/integrations` frontend page with capability cards;
- docs in `docs/integrations.md`;
- backend and frontend checks passed.

### Phase 5 — Queue-Backed Automation Runtime

Goal: automations become reliable, observable and safe.

Status: `completed 2026-05-20`.

Must build:

- Celery tasks for automation runs;
- idempotency keys;
- retry policy;
- failure states;
- delayed/wait actions foundation;
- run detail drawer;
- duplicate prevention tests;
- per-business throttling guardrails.

Acceptance:

- failed automation is visible;
- retry does not duplicate CRM actions;
- delayed actions do not run inline in request;
- owner can understand what happened.

Implemented:

- `AutomationRun` runtime fields for idempotency, attempts, delays, retries and action results;
- idempotent run creation from CRM events;
- Celery-ready tasks for processing one run and due runs;
- `AUTOMATIONS_RUN_INLINE` local/prod switch;
- delayed/WAIT actions stay pending in local inline mode and are scheduled in queue mode;
- retry API on `/api/automation-runs/{id}/retry/`;
- automation UI shows attempts/retry timing and retry button for failed runs;
- docs in `docs/automation-runtime.md`;
- backend and frontend checks passed.

### Phase 6 — Communication-First Onboarding

Goal: merchant gets first-day value through CRM + inbox.

Status: `completed 2026-05-20`.

Must build:

- website chat as stable first channel;
- Telegram/WhatsApp simplified connection flow using provider abstraction;
- onboarding checklist by business type;
- AI/rule-based inbox summaries;
- connection success/failure recovery screen;
- integration activity events.

Acceptance:

- merchant can connect first channel through simple UX;
- CRM receives messages/leads/events;
- inbox shows source and assignment;
- owner understands setup result.

Implemented:

- setup-channel onboarding API for website/Telegram/WhatsApp mock channels;
- first-message onboarding API that creates website conversation, inbound message, client and lead;
- `BusinessConnector` and `BusinessEvent` are created as part of onboarding channel setup;
- checklist includes first channel and first message;
- `/dashboard/onboarding` has business-facing blocks for first channel and first message;
- docs in `docs/communication-onboarding.md`;
- backend and frontend checks passed.

### Phase 7 — Entitlements And Billing Enforcement

Goal: tariffs stop being display-only.

Must build:

- entitlement service;
- plan limits map;
- usage checks in service layer;
- upgrade prompts;
- central guard for limits;
- tests for over-limit behavior.

Acceptance:

- limits are not scattered as `if plan == ...`;
- API rejects over-limit actions clearly;
- frontend shows plan limitation without breaking flow.

Implemented:

- centralized entitlement service in `apps/billing/entitlements.py`;
- plan defaults for users, bots, automations, AI requests, bot messages, conversations and storage;
- database migration updates default plan limits;
- enforcement in AI, bots, conversations, automations, team members and storage;
- `GET /api/billing/entitlements/` returns plan-aware usage summary;
- settings billing UI displays entitlement values and remaining quota;
- over-limit tests cover AI requests, bots, users and requested quota math;
- docs in `docs/entitlements.md`;
- backend and frontend checks passed.

### Phase 8 — E2E QA And Scale Baseline

Goal: stop relying only on unit/API tests.

Must build:

- Playwright setup;
- owner/operator/platform smoke flows;
- mobile viewport checks;
- login/auth refresh checks;
- critical CRUD flow;
- inbox flow;
- file upload flow;
- basic load testing plan.

Acceptance:

- e2e smoke can run locally/CI;
- frontend errors are caught before manual testing;
- core flows verified across roles.

Implemented:

- Playwright setup in `frontend/playwright.config.ts`;
- E2E scripts `npm run e2e` and `npm run e2e:ui`;
- deterministic smoke data command `prepare_e2e_smoke_data`;
- desktop and mobile smoke coverage for platform admin, business owner and operator;
- merchant users are blocked from platform routes;
- mobile dashboard-to-calendar path is verified;
- baseline load-testing plan documented in `docs/e2e-scale-baseline.md`;
- latest E2E run passed: 9 passed, 1 intentional desktop skip for mobile-only scenario.

### Phase 9 — Analytics / Reporting Depth

Goal: owner gets useful reports without Bitrix complexity.

Must build:

- configurable reporting widgets foundation;
- scheduled report model;
- exportable reports;
- source ROI metrics;
- funnel velocity;
- manager performance export;
- retention/LTV placeholders where data exists.

Acceptance:

- owner can see useful operational reports;
- reports respect role visibility;
- heavy analytics does not slow daily CRM.

Implemented:

- report widgets foundation via `ReportWidget`;
- scheduled report model via `ScheduledReport`;
- `GET /api/analytics/reports/summary/`;
- `GET /api/analytics/reports/export/`;
- source ROI report with lead, appointment, conversion and revenue estimate metrics;
- funnel velocity foundation with lead statuses and deal stages;
- manager performance CSV export;
- retention and LTV estimates from completed appointments;
- `/dashboard/analytics` updated with operational reports and CSV actions;
- analytics exports write audit log entries;
- docs in `docs/analytics-reporting.md`;
- backend and frontend checks passed.

### Phase 10 — UI/UX Competitive Polish

Status: ready on 2026-05-20.

Goal: make the product feel premium, simple and fast.

Must build:

- dashboard variants by role;
- settings page split;
- CRM card inline edit;
- inbox mobile composer polish;
- kanban mobile polish;
- calendar mobile polish;
- onboarding copy polish;
- integration cards polish.

Acceptance:

- owner/operator flows are visually clear;
- mobile daily use is comfortable;
- no hidden broken routes;
- no heavy decorative UI that slows work.

Implemented:

- role-aware dashboard for owner/admin vs operator/staff;
- settings section navigation for team, security, roles, import/export, billing, fields and business profile;
- CRM card inline-edit for lead/deal/appointment status and notes;
- mobile inbox composer polish;
- mobile kanban snap-scroll;
- mobile calendar date picker polish;
- onboarding and integrations copy polish;
- documentation in `docs/ui-ux-polish-phase-10.md`.

## 11. External Services Strategy

Do not connect all providers at once.

### Connect Early

- managed PostgreSQL;
- Redis;
- object storage;
- Sentry or equivalent;
- transactional email;
- domain/HTTPS/Cloudflare.

### Connect After Foundation

- Telegram API as first real communication provider;
- WhatsApp provider after connector/credentials/event hardening;
- OpenRouter/OpenAI after AI queue/logging/limits are ready;
- Meta/Instagram after inbox/provider layer is stable;
- payment provider after entitlements are implemented.

## 12. Definition Of Done For Any New Phase

Every phase must include:

- backend model/API/service layer where relevant;
- tenant isolation;
- permissions;
- audit/activity for sensitive actions;
- frontend user flow;
- loading/error/empty/forbidden states;
- types and API clients;
- tests for happy path;
- tests for permission;
- tests for tenant isolation;
- docs/README update;
- no hidden production mock.

Required checks:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 \
SECURE_SSL_REDIRECT=False \
SESSION_COOKIE_SECURE=False \
CSRF_COOKIE_SECURE=False \
REDIS_URL=memory:// \
CELERY_TASK_ALWAYS_EAGER=True \
CELERY_TASK_STORE_EAGER_RESULT=False \
AUTOMATIONS_RUN_INLINE=True \
.venv/bin/python manage.py test
cd frontend && npm run build
```

If migrations are added:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py migrate
```

## 13. How Codex Should Work From This Plan

1. Read this file first.
2. Read `AGENTS.md`.
3. Read clean-code rules.
4. Pick exactly one phase or one bounded task.
5. Inspect existing code before editing.
6. Reuse existing layers.
7. Implement backend and frontend only when both are required by DoD.
8. Run required checks.
9. Update README/docs.
10. Report briefly what changed and what remains.

## 14. Immediate Next Recommended Task

Current completed sequence:

```text
Phase 1 — Production Readiness Baseline
Phase 2 — Storage And File Safety
Phase 3 — Realtime Or Reliable Polling
Phase 4 — Integration Foundation Hardening
Phase 5 — Queue-Backed Automation Runtime
Phase 6 — Communication-First Onboarding
Phase 7 — Entitlements And Billing Enforcement
Phase 8 — E2E QA And Scale Baseline
Phase 9 — Analytics / Reporting Depth
Phase 10 — UI/UX Competitive Polish
```

Next recommended task:

```text
Production readiness audit for 10,000 merchants
```

Status: ready on 2026-05-21.

Implemented:

- `apps/core/production_audit.py`;
- `python manage.py production_readiness_audit`;
- JSON and fail-on-critical modes for CI/staging;
- tests for unsafe production settings and command output;
- 10,000 merchants sizing and rollout notes in `docs/production-readiness-10000-audit.md`.

Next recommended task:

```text
Production deployment CI/CD and staging environment checklist
```

Status: ready on 2026-05-21.

Implemented:

- GitHub Actions workflow in `.github/workflows/ci.yml`;
- local CI script `scripts/check_local_ci.sh`;
- staging checklist in `docs/staging-ci-cd-checklist.md`;
- deployment docs reference CI/staging gates.

Next recommended task:

```text
Production env templates and provider selection for staging
```

Status: ready on 2026-05-21.

Implemented:

- staging/production backend env templates;
- staging/production frontend env templates;
- `.gitignore` keeps real env files ignored while allowing templates;
- provider decision doc in `docs/staging-provider-selection.md`;
- deployment/readiness docs reference the templates.

Next recommended task:

```text
Staging deployment provider setup and first production-like smoke plan
```

Status: ready on 2026-05-21.

Implemented:

- `scripts/staging_smoke.sh`;
- `frontend/playwright.staging.config.ts`;
- `npm run e2e:staging`;
- `docs/staging-smoke-runbook.md`;
- deployment/staging/provider docs now reference the smoke gate;
- smoke covers health/readiness, platform login, merchant login, core merchant API, frontend root response and deployed browser flows.

Next recommended task:

```text
Staging provider provisioning and deployed smoke/E2E execution
```

Status: completed on 2026-05-22.

Implemented:

- public perimeter rate-limit scopes for forms, website widget, integration webhooks, public API and AI assistant;
- configurable env variables in local/staging/production templates;
- production readiness audit now verifies required throttle scopes;
- docs in `docs/rate-limits.md`.
- Render backend deployment at `https://zani-9lnp.onrender.com`;
- Render frontend deployment at `https://zani-1.onrender.com`;
- Supabase Postgres connection through transaction pooler;
- deployed CORS preflight check;
- deployed SPA rewrite check for `/login`;
- deployed API smoke with platform admin and merchant owner;
- deployed browser E2E with platform, owner, operator and mobile flows;
- staging execution report in `docs/staging-render-execution-report.md`.

Next recommended task:

```text
Create the next production-hardening roadmap
```

Reason:

- the current master-tech-plan phases and staging execution task are complete for the controlled-pilot scope;
- Render/Supabase staging proves deploy, CORS, routing, auth, API smoke and browser E2E;
- the remaining work is a new roadmap: Redis/Celery worker services, object storage, Sentry, transactional email, backups, load testing and real provider rollout.

Status: completed on 2026-05-23.

Implemented:

- new execution roadmap in `plan/ZANI_PRODUCTION_HARDENING_ROADMAP.md`;
- staging and production backend env templates restored;
- staging and production frontend env templates restored;
- `.gitignore` allows only safe env example templates while keeping real env files ignored.

Next recommended task:

```text
Phase H1 — Redis / Celery Runtime On Render
```

Reason:

- queue-backed runtime is required before real providers, AI, delayed automations and paid beta traffic;
- current staging proves web/db/frontend, but not worker reliability;
- Celery queues already exist in code and Docker, so the next step is provider/runtime setup and smoke verification.

## 15. Final Direction

Zani should not become another complex CRM.

Zani should become:

```text
AI-first SMB Growth OS
with CRM as the operational core,
invisible integrations as the activation moat,
and owner trust/security as the retention layer.
```

The next engineering work must make this reliable enough for real businesses, not just broader in feature count.
