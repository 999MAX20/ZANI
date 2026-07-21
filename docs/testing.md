# Zani Testing Guide

## Commands

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 \
SECURE_SSL_REDIRECT=False \
SESSION_COOKIE_SECURE=False \
CSRF_COOKIE_SECURE=False \
REDIS_URL=memory:// \
CELERY_TASK_ALWAYS_EAGER=True \
CELERY_TASK_STORE_EAGER_RESULT=False \
AUTOMATIONS_RUN_INLINE=True \
.venv/bin/python manage.py test -v 2
cd frontend
npm run build
```

Why these overrides matter: local `.env` may contain staging/production values such as SSL redirects or managed Redis placeholders. Backend tests should verify application behavior, not require a local Redis daemon or HTTPS test client redirects.

For a clean frontend dependency check:

```bash
cd frontend
rm -rf node_modules
npm ci
npm run build
```

## Frontend Bundle Hygiene

After frontend-only routing, i18n, layout, or page-splitting work, record the relevant production build output instead of treating bundle warnings as noise:

```bash
cd frontend
npm run build
npm run check:bundle
```

Use this as a lightweight regression note for large first-load risks. Pay special attention to:

- `i18n-*` chunks: the app should not load all supported language dictionaries for every first load;
- authenticated route chunks: large CRM pages should stay behind lazy route boundaries;
- shell chunks such as app layout, search, public pages, and platform layout;
- any JS chunk above 500 kB before gzip, which should be explained or split when the cause is avoidable.

## CRM E2E Business Flow Gates

Phase 13 cross-entity CRM coverage lives in:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.core.tests_business_flows_e2e -v 2
```

It covers owner login/dashboard/lead assignment, lead -> client -> appointment -> task, lead -> deal won/lost, inbox AI qualification -> lead/task, duplicate merge, appointment lifecycle, BusinessEvent timeline mapping and AI approval-gated tool execution.

Mobile owner/manager smoke is in `frontend/e2e/smoke.spec.ts`. The local Playwright config starts Vite and uses `frontend/e2e/django-e2e.mjs` to prepare and start Django on Windows and Unix-like shells:

```bash
cd frontend
npx playwright test --project=mobile-chromium -g "mobile (owner|manager) smoke"
```

If you deliberately start services yourself, set `E2E_SKIP_LOCAL_SETUP=true`, `E2E_BASE_URL` and `E2E_API_BASE_URL`.

## Controlled Pilot QA

Use this gate before claiming a local/dev merchant journey is ready for a controlled pilot without production credentials or live provider traffic.

PowerShell-safe local setup:

```powershell
$env:DATABASE_URL = 'sqlite:///db.sqlite3'
$env:SECURE_SSL_REDIRECT = 'False'
$env:SESSION_COOKIE_SECURE = 'False'
$env:CSRF_COOKIE_SECURE = 'False'
$env:REDIS_URL = 'memory://'
$env:CELERY_TASK_ALWAYS_EAGER = 'True'
$env:CELERY_TASK_STORE_EAGER_RESULT = 'False'
$env:AUTOMATIONS_RUN_INLINE = 'True'
```

Pilot data and API quality gate:

```powershell
.\.venv\Scripts\python.exe manage.py prepare_pilot_demo --reset
.\.venv\Scripts\python.exe manage.py pilot_launch_quality_gate
```

The pilot demo seed is deterministic for local/dev QA and includes platform admin, business owner, manager and operator users. It creates a demo merchant with leads, clients, tasks, inbox handoff, website/Excel connector signals, sales events and a safe AI-created task flow. Mock/dev connector states must stay visibly separated from live production providers.

`ALLOW_DEMO_MERCHANT_FLOWS=True` is required for local/staging demo-data and mock-sync QA. Keep it `False` in production so onboarding demo-data and connector mock-sync cannot be presented as live merchant functionality.

Required controlled-pilot verification:

```powershell
.\.venv\Scripts\python.exe -m pytest apps\businesses\tests_demo_seed.py apps\core\tests_business_flows_e2e.py -q
cd frontend
npm run build
npx playwright test --project=mobile-chromium -g "mobile (owner|manager) smoke"
```

Manual fallback when browser automation is unavailable:

1. Run `prepare_pilot_demo --reset` and log in as owner, manager and operator.
2. Owner path: dashboard -> leads -> inbox -> AI assistant/action -> integrations -> analytics.
3. Manager path: assigned leads/tasks/inbox handoff.
4. Operator path: task queue and inbox handoff visibility.
5. Confirm `/api/pilot/readiness/`, owner dashboard, inbox summary and integration health states are reachable and do not imply live providers are connected.

## External Network Policy

Backend tests must not call real external services.

During `manage.py test`, settings force safe defaults:

- `OPENAI_API_KEY=""`;
- `TELEGRAM_ENABLED=False`;
- `WHATSAPP_ENABLED=False`;
- `INSTAGRAM_ENABLED=False`;
- `EMAIL_BACKEND=django.core.mail.backends.locmem.EmailBackend`.

OpenAI code must return controlled mock responses when `OPENAI_API_KEY` is empty. Telegram outbound must return a mock result when `TELEGRAM_ENABLED=False`.

If a future test needs a provider integration, mock the provider/client explicitly and assert that no real network call is made.

## If Tests Hang

1. Run verbose tests:

   ```bash
   DATABASE_URL=sqlite:///db.sqlite3 \
   SECURE_SSL_REDIRECT=False \
   SESSION_COOKIE_SECURE=False \
   CSRF_COOKIE_SECURE=False \
   REDIS_URL=memory:// \
   CELERY_TASK_ALWAYS_EAGER=True \
   CELERY_TASK_STORE_EAGER_RESULT=False \
   AUTOMATIONS_RUN_INLINE=True \
   .venv/bin/python manage.py test -v 2
   ```

2. Check the last printed test name.
3. Search that test for external calls such as `urlopen`, `requests`, SDK clients, email backends or long sleeps.
4. Disable the provider with `override_settings(...)` or patch the network client.
5. Re-run the full suite before starting the next feature stage.
