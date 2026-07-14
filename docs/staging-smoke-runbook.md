# Zani Staging Smoke Runbook

Дата: 21.05.2026

Цель: дать минимальный production-like сценарий проверки staging окружения перед подключением реальных WhatsApp/Meta/OpenAI/payment providers.

Последний Render staging execution report:

```text
docs/staging-render-execution-report.md
```

## 1. Когда Запускать

Запускать после каждого staging deploy, после миграций и после изменения env/secrets.

Минимальный порядок:

```bash
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py production_readiness_audit --fail-on-critical
```

После этого запустить smoke с локальной машины или из CI/CD runner.

## 2. Smoke Script

Файл:

```text
scripts/staging_smoke.sh
```

Минимальный запуск без credentials проверяет только health/readiness:

```bash
API_BASE_URL=https://api-staging.zani.example \
scripts/staging_smoke.sh
```

Полный staging smoke:

```bash
API_BASE_URL=https://api-staging.zani.example \
FRONTEND_URL=https://app-staging.zani.example \
PLATFORM_ADMIN_EMAIL=platform_admin@example.com \
PLATFORM_ADMIN_PASSWORD='***' \
MERCHANT_OWNER_EMAIL=business_owner@example.com \
MERCHANT_OWNER_PASSWORD='***' \
scripts/staging_smoke.sh
```

Скрипт не печатает access token и не хранит ответы вне временной директории.

## 3. Что Проверяется

Backend public checks:

- `GET /health/`;
- `GET /health/db/`;
- `GET /ready/`.
- `OPTIONS /api/auth/token/` with the deployed frontend `Origin` when `FRONTEND_URL` is provided.

Platform checks:

- `POST /api/auth/token/`;
- `GET /api/auth/me/`;
- `GET /api/platform/ping/`.

Merchant checks:

- `POST /api/auth/token/`;
- `GET /api/auth/me/`;
- `GET /api/businesses/`;
- `GET /api/leads/`;
- `GET /api/conversations/`;
- `GET /api/billing/usage-summary/`.

Frontend check:

- `HEAD /` against `FRONTEND_URL`.
- `HEAD /login` against `FRONTEND_URL` to verify SPA rewrites.

For Render Static Site, configure a rewrite rule:

```text
Source: /*
Destination: /index.html
Action: Rewrite
```

Without this rule, deployed browser E2E will fail on direct routes such as `/login`, `/dashboard/settings` and `/platform`.

## 4. Staging Provider Setup

Recommended first setup:

| Layer | Staging Requirement |
| --- | --- |
| Backend web | One Django/Gunicorn service with `DEBUG=False`. |
| Worker | One Celery worker service using the same release. |
| Scheduler | Celery beat only if scheduled jobs are enabled. |
| Database | Managed Postgres with backup/PITR enabled. |
| Redis | Managed Redis for Celery broker/result backend. |
| Storage | Private S3-compatible bucket, separate from production. |
| Frontend | Static host/CDN with `VITE_API_URL` pointing to staging API. |
| Monitoring | Sentry backend/frontend projects or one project with environments. |
| Email | Transactional provider in sandbox/test domain mode. |

Do not share staging and production secrets.

## 5. Required Staging Accounts

Create at least:

- platform admin user for `/api/platform/ping/`;
- merchant owner with one active `Business`;
- optional merchant operator for manual role checks.

Credentials must live only in deploy/CI secrets, not in repository files.

## 6. Pass Criteria

Staging is acceptable only if:

- `production_readiness_audit --fail-on-critical` passes;
- migrations finish successfully;
- web service and worker run the same release;
- `scripts/staging_smoke.sh` passes with platform and merchant credentials;
- Sentry receives no new critical error during smoke;
- frontend opens and can reach the staging API.

## 7. Browser E2E Against Staging

After the API smoke passes, run browser smoke against the deployed frontend:

```bash
cd frontend
E2E_BASE_URL=https://app-staging.zani.example \
E2E_PLATFORM_EMAIL=platform_admin@example.com \
E2E_OWNER_EMAIL=business_owner@example.com \
E2E_OPERATOR_EMAIL=business_operator@example.com \
E2E_PASSWORD='***' \
npm run e2e:staging
```

The staging config does not start local Django/Vite servers and does not seed data. The staging database must already contain the required test accounts and demo merchant.

The staging browser timeout is intentionally higher than local E2E timeout because free-tier hosts and managed database poolers can cold-start and make the first auth/database requests slow. Treat persistent timeouts after warm-up as a failure, but do not use local timeout values for deployed smoke.

## 8. What This Does Not Cover Yet

This smoke does not test:

- real WhatsApp/Telegram/Meta providers;
- payment provider callbacks;
- high-volume load;
- file upload/download;
- queued automation execution result;
- destructive rollback behavior.

Those should be added after the first staging environment is stable.
