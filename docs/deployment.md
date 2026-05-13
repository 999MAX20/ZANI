# Zani Deployment Baseline

This document describes the current production baseline. It is intentionally simple: Docker Compose, PostgreSQL, Redis, Django/Gunicorn, Celery and a separately built React frontend.

## Services

- `web` — Django + DRF served by Gunicorn.
- `db` — PostgreSQL 16.
- `redis` — Redis for Celery broker/result backend.
- `celery` — async worker.
- `celery-beat` — optional scheduled jobs profile.
- `frontend` — build with Vite and deploy `frontend/dist` to a static host or CDN.

## Minimum Required Variables

Copy `.env.example` to `.env` and set at least:

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
```

Optional production variables:

- `SENTRY_DSN` for error monitoring.
- `OPENAI_API_KEY` for AI features.
- `TELEGRAM_ENABLED=True` and Telegram channel tokens inside bot channel config for Telegram.
- Email SMTP variables for transactional email.
- Storage variables are optional; keep `USE_S3=False` for local media or configure S3/R2/Yandex-compatible storage.

## Docker Compose

```bash
cd /Users/maksim/Desktop/Zani
cp .env.example .env
docker compose up --build
```

Run optional Celery beat:

```bash
docker compose --profile beat up --build
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

Example:

```bash
curl https://api.your-domain.com/health/
curl https://api.your-domain.com/health/db/
```

## Static And Media

`web` runs `collectstatic` on startup and writes static files to the `static_data` volume. Local private media is served through authenticated backend endpoints. For production object storage, configure `USE_S3=True` and the S3-compatible variables from `.env.example`.

## Deployment Notes

- Keep `DEBUG=False` outside local development.
- Use a long random `SECRET_KEY`; short keys trigger JWT security warnings.
- Do not commit `.env`.
- Use HTTPS and set secure cookie/CSRF settings in production.
- Platform routes are protected by platform roles; merchant data remains tenant-filtered.
