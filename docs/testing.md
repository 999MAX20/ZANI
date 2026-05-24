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
