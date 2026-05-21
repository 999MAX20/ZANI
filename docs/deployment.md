# Zani Deployment Baseline

This document describes the current production baseline. It is intentionally simple: Docker Compose, PostgreSQL, Redis, Django/Gunicorn, Celery and a separately built React frontend.

For the full production-readiness checklist, use:

```text
docs/production-readiness.md
docs/backup-restore.md
docs/staging-ci-cd-checklist.md
docs/staging-provider-selection.md
docs/staging-smoke-runbook.md
docs/rate-limits.md
```

## Services

- `web` — Django + DRF served by Gunicorn.
- `db` — PostgreSQL 16.
- `redis` — Redis for Celery broker/result backend.
- `celery` — async worker.
- `celery-beat` — optional scheduled jobs profile.
- `frontend` — build with Vite and deploy `frontend/dist` to a static host or CDN.

## Minimum Required Variables

For local development, copy `.env.example` to `.env`.

For staging/production, use the tracked templates as a checklist and put real values into the deploy provider secrets:

```text
.env.staging.example
.env.production.example
frontend/.env.staging.example
frontend/.env.production.example
```

Set at least:

```bash
SECRET_KEY=generate-a-strong-32-plus-character-key
DEBUG=False
ALLOWED_HOSTS=api.your-domain.com
DATABASE_URL=postgres://zani_user:password@db:5432/zani
REDIS_URL=redis://redis:6379/0
CORS_ALLOWED_ORIGINS=https://app.your-domain.com
CSRF_TRUSTED_ORIGINS=https://app.your-domain.com
JWT_ACCESS_TOKEN_MINUTES=15
JWT_REFRESH_TOKEN_DAYS=7
AUTH_LOGIN_RATE=10/min
AUTH_REFRESH_RATE=30/min
PUBLIC_API_RATE=120/min
PUBLIC_FORM_RATE=60/min
PUBLIC_WIDGET_RATE=120/min
INTEGRATION_WEBHOOK_RATE=300/min
AI_ASSISTANT_RATE=30/min
SENTRY_DSN=https://...
```

Strongly recommended production variables:

- `SENTRY_DSN` for error monitoring.
- `OPENAI_API_KEY` for AI features.
- `TELEGRAM_ENABLED=True` and Telegram channel tokens inside bot channel config for Telegram.
- Email SMTP variables for transactional email.
- Storage variables are optional; keep `USE_S3=False` for local media or configure S3/R2/Yandex-compatible storage.

## Docker Compose

Before building or deploying, run the local CI equivalent:

```bash
cd /Users/maksim/Desktop/Zani
scripts/check_local_ci.sh
```

```bash
cd /Users/maksim/Desktop/Zani
cp .env.example .env
docker compose up --build
```

Run optional Celery beat:

```bash
docker compose --profile beat up --build
```

Run dedicated integration/AI workers:

```bash
docker compose --profile workers up --build
```

## Render Docker Deploy

For Render Docker web services, the image start command is already Render-safe:

```text
python manage.py migrate &&
python manage.py collectstatic --noinput &&
gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers ${WEB_CONCURRENCY:-2} --timeout ${GUNICORN_TIMEOUT:-120}
```

Important:

- do not override the Docker start command unless needed;
- Render injects `PORT`, so the app must bind to `${PORT:-8000}`;
- `.dockerignore` excludes local `.env`, SQLite, media, node modules and build artifacts from the image;
- configure all staging secrets in Render env UI, not in repository files.

Minimum Render env:

```env
SECRET_KEY=<strong-secret>
DEBUG=False
ENVIRONMENT=staging
ALLOWED_HOSTS=<your-render-host-or-api-domain>
REDIS_URL=<upstash-or-managed-redis-url>
CORS_ALLOWED_ORIGINS=<frontend-url>
CSRF_TRUSTED_ORIGINS=<frontend-url>
SECURE_PROXY_SSL_HEADER=HTTP_X_FORWARDED_PROTO,https
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
SUPPORT_REQUIRES_GRANT=True
AUTOMATIONS_RUN_INLINE=False
SENTRY_DSN=<sentry-dsn>
USE_S3=False
```

For Supabase on Render, prefer split variables and leave `DATABASE_URL` empty. The app will build the Postgres URL and URL-encode the password:

```env
DATABASE_URL=
SUPABASE_PROJECT_REF=jjpenskqmomrbjqofbss
SUPABASE_DB_PASSWORD=<database-password-not-anon-key>
SUPABASE_DB_CONNECTION_MODE=pooler
SUPABASE_DB_POOLER_HOST=<copy-from-supabase-transaction-pooler>
SUPABASE_DB_PORT=6543
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres.jjpenskqmomrbjqofbss
```

Use values from:

```text
Supabase -> Project Settings -> Database -> Connection string -> Transaction pooler
```

Do not use Supabase `anon` or `service_role` keys as the database password.

Create a platform admin:

```bash
docker compose exec web python manage.py create_platform_admin \
  --email admin@example.com \
  --password "change-this-password"
```

## Frontend

For local development:

```bash
cd /Users/maksim/Desktop/Zani/frontend
npm ci
npm run dev
```

For production build:

```bash
cd /Users/maksim/Desktop/Zani/frontend
npm ci
VITE_API_URL=https://api.your-domain.com npm run build
```

Deploy `frontend/dist` to a static host. The widget bundle is built into `frontend/dist/widget/zani-widget.js`.

## Healthchecks

Use:

- `GET /health/` — app process health.
- `GET /health/db/` — database connectivity health.
- `GET /ready/` — readiness check for load balancers and container orchestration.

Example:

```bash
curl https://api.your-domain.com/health/
curl https://api.your-domain.com/health/db/
curl https://api.your-domain.com/ready/
```

Use `/ready/` for Docker/load balancer healthchecks.

## Staging Smoke

After staging deploy and migrations, run the production-like smoke script:

```bash
API_BASE_URL=https://api-staging.zani.example \
FRONTEND_URL=https://app-staging.zani.example \
PLATFORM_ADMIN_EMAIL=platform_admin@example.com \
PLATFORM_ADMIN_PASSWORD='***' \
MERCHANT_OWNER_EMAIL=business_owner@example.com \
MERCHANT_OWNER_PASSWORD='***' \
scripts/staging_smoke.sh
```

The full checklist is in:

```text
docs/staging-smoke-runbook.md
```

For browser smoke against deployed staging:

```bash
cd frontend
E2E_BASE_URL=https://app-staging.zani.example \
E2E_PLATFORM_EMAIL=platform_admin@example.com \
E2E_OWNER_EMAIL=business_owner@example.com \
E2E_OPERATOR_EMAIL=business_operator@example.com \
E2E_PASSWORD='***' \
npm run e2e:staging
```

## Static And Media

`web` runs `collectstatic` on startup and writes static files to the `static_data` volume. Local private media is served through authenticated backend endpoints. For production object storage, configure `USE_S3=True` and the S3-compatible variables from `.env.example`.

## Deployment Notes

- Keep `DEBUG=False` outside local development.
- Use a long random `SECRET_KEY`; short keys trigger JWT security warnings.
- Do not commit `.env`.
- Use HTTPS and set secure cookie/CSRF settings in production.
- Platform routes are protected by platform roles; merchant data remains tenant-filtered.
- Run `ENVIRONMENT=production python manage.py check` and resolve `zani.W*` warnings before real production traffic.
