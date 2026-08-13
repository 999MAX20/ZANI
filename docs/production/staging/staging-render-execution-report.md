# Zani Render Staging Execution Report

Дата: 22.05.2026

Цель: зафиксировать первый реально поднятый staging/deploy контур Zani и закрыть финальный пункт master-техплана: `Staging provider provisioning and deployed smoke/E2E execution`.

## 1. Проверенное Окружение

Backend API:

```text
https://zani-9lnp.onrender.com
```

Frontend:

```text
https://zani-1.onrender.com
```

Database:

```text
Supabase Postgres через transaction pooler
```

Frontend hosting:

```text
Render Static Site
```

Backend hosting:

```text
Render Docker Web Service
```

## 2. Обязательные Настройки, Которые Уже Проверены

Backend env должен содержать:

```env
DEBUG=False
ALLOWED_HOSTS=zani-9lnp.onrender.com
CORS_ALLOWED_ORIGINS=https://zani-1.onrender.com
CSRF_TRUSTED_ORIGINS=https://zani-1.onrender.com
SECURE_PROXY_SSL_HEADER=HTTP_X_FORWARDED_PROTO,https
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
SUPPORT_REQUIRES_GRANT=True
```

Frontend env должен содержать:

```env
VITE_API_URL=https://zani-9lnp.onrender.com
```

Render Static Site rewrite:

```text
Source: /*
Destination: /index.html
Action: Rewrite
```

Supabase database URL format:

```text
postgresql://postgres.<project-ref>:<database-password>@<pooler-host>:6543/postgres
```

Important:

- use the Supabase database password, not `anon` or `service_role` keys;
- for this staging deployment the working pooler host was the Supabase transaction pooler host;
- frontend and backend are two separate Render services.

## 3. Smoke Checks Executed

Command:

```bash
API_BASE_URL=https://zani-9lnp.onrender.com \
FRONTEND_URL=https://zani-1.onrender.com \
PLATFORM_ADMIN_EMAIL=platform_admin@example.com \
PLATFORM_ADMIN_PASSWORD='***' \
MERCHANT_OWNER_EMAIL=business_owner@example.com \
MERCHANT_OWNER_PASSWORD='***' \
scripts/staging_smoke.sh
```

Result:

```text
passed
```

Covered:

- `GET /health/`;
- `GET /health/db/`;
- `GET /ready/`;
- CORS preflight for `/api/auth/token/`;
- platform admin login;
- `/api/platform/ping/`;
- merchant owner login;
- merchant API reads;
- frontend `/`;
- frontend `/login` SPA rewrite.

## 4. Browser E2E Executed Against Render

Command:

```bash
cd frontend
E2E_BASE_URL=https://zani-1.onrender.com \
E2E_PLATFORM_EMAIL=platform_admin@example.com \
E2E_OWNER_EMAIL=business_owner@example.com \
E2E_OPERATOR_EMAIL=business_operator@example.com \
E2E_PASSWORD='***' \
npm run e2e:staging
```

Result:

```text
8 passed, 2 skipped
```

Notes:

- two skipped tests are intentional viewport-specific skips;
- Render free-tier plus managed database pooler can make staging E2E slow;
- smoke and E2E are green after SPA rewrite and CORS fixes.

## 5. Local Verification For The Same Changes

Executed:

```bash
bash -n scripts/staging_smoke.sh
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
cd frontend && npm run build
cd frontend && npm run e2e -- --project=desktop-chromium
cd frontend && npm run e2e -- --project=mobile-chromium
```

Results:

```text
backend check: passed with expected SENTRY_DSN warning
frontend build: passed
desktop e2e: 4 passed, 1 skipped
mobile e2e: 4 passed, 1 skipped
```

## 6. What This Staging Still Does Not Prove

This first Render staging is acceptable for demo, QA and controlled pilot checks, but it is not yet a complete production-like environment for paid traffic.

Still missing for full production-like staging:

- Redis service for Celery broker/result backend;
- separate Celery worker Render service;
- object storage bucket with private files;
- Sentry backend/frontend project;
- transactional email provider;
- uptime monitoring;
- backup/restore drill;
- load test against realistic merchant data volume.

These items are not blockers for closing the current master-tech-plan staging execution task, but they are blockers for claiming production readiness for 10,000 merchants.

## 7. Decision

The master-tech-plan item `Staging provider provisioning and deployed smoke/E2E execution` is complete for the current scope:

- deployment exists;
- database is managed Postgres;
- CORS and SPA routing are configured;
- API smoke is green;
- deployed browser E2E is green;
- runbook and env docs are updated.

The next roadmap should be a new production-hardening plan focused on workers, storage, observability, backups, load testing and real provider rollout.
