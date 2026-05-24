# Zani Deployment Baseline

This document describes the current production baseline. It is intentionally simple: Docker Compose, PostgreSQL, Redis, Django/Gunicorn, Celery and a separately built React frontend.

For the full production-readiness checklist, use:

```text
docs/production-readiness.md
docs/backup-restore.md
docs/staging-ci-cd-checklist.md
docs/staging-provider-selection.md
docs/staging-smoke-runbook.md
docs/staging-render-execution-report.md
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

## Pre-Deploy Quality Gate

Before changing Render, Supabase or domain settings, run the local pre-deploy gate:

```bash
cd /Users/maksim/Desktop/Zani
scripts/predeploy_check.sh
```

For a faster backend-only pass after the frontend build has already been checked:

```bash
SKIP_FRONTEND_BUILD=true scripts/predeploy_check.sh
```

The gate runs Django checks, `check --deploy`, migration drift detection, production readiness audit, shell-script syntax checks and clean archive validation. `check --deploy` and the readiness audit may print warnings in local SQLite/dev mode; those warnings must be resolved in staging/production env before real traffic.

To keep the generated archive for upload/review:

```bash
KEEP_PREDEPLOY_ARCHIVE=true PREDEPLOY_ARCHIVE_NAME=zani-clean.zip scripts/predeploy_check.sh
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

For Redis/Celery H1, use the example blueprint as a reviewed checklist, not as an automatic root blueprint:

```text
deploy/render.h1.example.yaml
docs/celery-render-runtime.md
scripts/render_h1_queue_smoke.sh
```

Required worker services:

```bash
celery -A config worker --loglevel=info --queues=default,automations,notifications --concurrency=${CELERY_WORKER_CONCURRENCY:-1}
celery -A config worker --loglevel=info --queues=integrations,webhooks_outbound --concurrency=${CELERY_WORKER_CONCURRENCY:-1}
```

Optional later:

```bash
celery -A config worker --loglevel=info --queues=ai --concurrency=${CELERY_AI_WORKER_CONCURRENCY:-1}
celery -A config beat --loglevel=info
```

For object storage H2, configure private S3-compatible storage before paid beta:

```env
USE_S3=True
AWS_ACCESS_KEY_ID=<storage-access-key>
AWS_SECRET_ACCESS_KEY=<storage-secret-key>
AWS_STORAGE_BUCKET_NAME=<private-bucket>
AWS_S3_REGION_NAME=<region-if-required>
AWS_S3_ENDPOINT_URL=<provider-endpoint-if-required>
AWS_QUERYSTRING_AUTH=True
```

Then verify from Render Shell:

```bash
BUSINESS_ID=<business-id> scripts/render_h2_storage_smoke.sh
```

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
CELERY_TASK_ALWAYS_EAGER=False
CELERY_TASK_STORE_EAGER_RESULT=False
CELERY_TASK_ACKS_LATE=True
CELERY_WORKER_PREFETCH_MULTIPLIER=1
SENTRY_DSN=<sentry-dsn>
SENTRY_TRACES_SAMPLE_RATE=0.05
RELEASE=<git-sha-or-release-tag>
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

## Render Monorepo Split: Backend + Frontend

The repository can be deployed to Render as two services from the same GitHub repo.

Backend service:

```text
Type: Web Service
Runtime: Docker
Root Directory: empty / repository root
Dockerfile Path: Dockerfile
Health Check Path: /ready/
```

Backend must expose the API host, for example:

```text
https://zani-api.onrender.com
```

Frontend service:

```text
Type: Static Site
Root Directory: frontend
Build Command: npm ci && npm run build
Publish Directory: dist
```

Frontend must expose the app host, for example:

```text
https://zani-app.onrender.com
```

Static-site rewrite for React Router:

```text
Source: /*
Destination: /index.html
Action: Rewrite
```

Required cross-service env:

Backend:

```env
ALLOWED_HOSTS=zani-api.onrender.com
CORS_ALLOWED_ORIGINS=https://zani-app.onrender.com
CSRF_TRUSTED_ORIGINS=https://zani-app.onrender.com,https://zani-api.onrender.com
```

Frontend:

```env
VITE_API_URL=https://zani-api.onrender.com
```

Common mistakes:

- `Root Directory` must be `frontend`, not `frontend ` with a trailing space.
- `VITE_API_URL` must point to the backend service, not the frontend service.
- `CORS_ALLOWED_ORIGINS` must contain the exact frontend origin, without a trailing slash.
- Supabase database password is the Postgres database password, not the anon key.
- Render backend must bind to `${PORT:-8000}`; the current Docker start command already does this.
- Free Render services can sleep; use an external uptime monitor against `/health/` for staging demos, but do not rely on this as production HA.

Post-deploy smoke:

```bash
API_BASE_URL=https://zani-api.onrender.com \
FRONTEND_URL=https://zani-app.onrender.com \
PLATFORM_ADMIN_EMAIL=platform_admin@example.com \
PLATFORM_ADMIN_PASSWORD='***' \
MERCHANT_OWNER_EMAIL=business_owner@example.com \
MERCHANT_OWNER_PASSWORD='***' \
scripts/staging_smoke.sh
```

Browser E2E against deployed frontend/backend:

```bash
cd frontend
E2E_BASE_URL=https://zani-app.onrender.com \
E2E_API_BASE_URL=https://zani-api.onrender.com \
E2E_SKIP_LOCAL_SETUP=true \
E2E_PLATFORM_EMAIL=platform_admin@example.com \
E2E_OWNER_EMAIL=business_owner@example.com \
E2E_OPERATOR_EMAIL=business_operator@example.com \
E2E_PASSWORD='***' \
npm run e2e:staging
```

For staging, run the desktop project first if you want a faster signal:

```bash
E2E_BASE_URL=https://zani-app.onrender.com \
E2E_API_BASE_URL=https://zani-api.onrender.com \
E2E_SKIP_LOCAL_SETUP=true \
npx playwright test --config=playwright.staging.config.ts --project=staging-desktop-chromium
```

After Sentry is configured, verify backend observability:

```bash
scripts/render_h3_observability_smoke.sh
CAPTURE_SENTRY_SMOKE=true scripts/render_h3_observability_smoke.sh
```

After SMTP is configured, verify transactional email:

```bash
scripts/render_h4_email_smoke.sh
SEND_EMAIL_SMOKE=true EMAIL_SMOKE_TO=owner@example.com scripts/render_h4_email_smoke.sh
```

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
docs/staging-render-execution-report.md
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
