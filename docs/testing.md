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
