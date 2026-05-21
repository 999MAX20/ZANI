# Zani Production Readiness Baseline

Date: 2026-05-20

This document is the operational checklist for moving Zani from local MVP to staging and then production.

For the 10,000 merchants audit and sizing plan, also use:

```text
docs/production-readiness-10000-audit.md
```

## 1. Environment Strategy

Use three environments:

- `local` — developer machine, SQLite or local Docker Postgres, mock providers allowed.
- `staging` — production-like infrastructure, test data only, real domain and HTTPS.
- `production` — real merchants, real secrets, backups, monitoring and strict access.

Required env values by environment:

| Variable | Local | Staging | Production |
| --- | --- | --- | --- |
| `DEBUG` | `True` | `False` | `False` |
| `ENVIRONMENT` | `development` | `staging` | `production` |
| `SECRET_KEY` | local random | strong secret | strong secret |
| `DATABASE_URL` | SQLite/local Postgres | managed Postgres | managed Postgres |
| `REDIS_URL` | local/Docker Redis | managed Redis | managed Redis |
| `ALLOWED_HOSTS` | localhost | staging API host | production API host |
| `CORS_ALLOWED_ORIGINS` | local frontend | staging app URL | production app URL |
| `CSRF_TRUSTED_ORIGINS` | local frontend | staging app URL | production app URL |
| `SENTRY_DSN` | optional | required | required |
| `USE_S3` | optional | recommended | required for scale |
| rate-limit envs | defaults | configured | configured |

## 2. Production Minimum Env

```env
SECRET_KEY=<32-plus-byte-random-secret>
DEBUG=False
ENVIRONMENT=production
RELEASE=<git-sha-or-release-tag>
LOG_LEVEL=INFO
ALLOWED_HOSTS=api.zani.example

DATABASE_URL=postgres://...
DB_CONN_MAX_AGE=60

REDIS_URL=redis://...
CELERY_TASK_DEFAULT_QUEUE=default
CELERY_WORKER_CONCURRENCY=2
CELERY_TASK_ACKS_LATE=True
CELERY_WORKER_PREFETCH_MULTIPLIER=1

AUTH_LOGIN_RATE=10/min
AUTH_REFRESH_RATE=30/min
PUBLIC_API_RATE=120/min
PUBLIC_FORM_RATE=60/min
PUBLIC_WIDGET_RATE=120/min
INTEGRATION_WEBHOOK_RATE=300/min
AI_ASSISTANT_RATE=30/min

CORS_ALLOWED_ORIGINS=https://app.zani.example
CSRF_TRUSTED_ORIGINS=https://app.zani.example
CORS_ALLOW_CREDENTIALS=False

SECURE_SSL_REDIRECT=True
SECURE_PROXY_SSL_HEADER=HTTP_X_FORWARDED_PROTO,https
SECURE_HSTS_SECONDS=31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=True
SECURE_HSTS_PRELOAD=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True

SENTRY_DSN=<sentry-dsn>
SENTRY_TRACES_SAMPLE_RATE=0.05

USE_S3=True
AWS_ACCESS_KEY_ID=<storage-access-key>
AWS_SECRET_ACCESS_KEY=<storage-secret-key>
AWS_STORAGE_BUCKET_NAME=<private-bucket>
AWS_S3_REGION_NAME=<region>
AWS_S3_ENDPOINT_URL=<provider-endpoint-if-needed>
AWS_QUERYSTRING_AUTH=True

VITE_API_URL=https://api.zani.example
```

## 3. Managed Services Recommendation

For the 10,000 merchant path, avoid self-hosting critical state on a tiny VPS.

Recommended:

- Managed Postgres: Supabase Postgres, Neon, AWS RDS, DigitalOcean Managed Postgres or equivalent.
- Managed Redis: Upstash/Redis Cloud/DigitalOcean Managed Redis/AWS ElastiCache.
- Object storage: Supabase Storage, Cloudflare R2, AWS S3, Yandex Object Storage.
- Error monitoring: Sentry.
- Static frontend: Cloudflare Pages, Vercel, Netlify or object storage + CDN.

Supabase can be used as managed Postgres and optionally Storage. Django should remain the application backend and source of business permissions.

## 4. Runtime Topology

Minimum staging:

- 1 web service;
- 1 Celery worker;
- managed Postgres;
- managed Redis;
- static frontend.

Initial production:

- 2+ web instances behind a load balancer;
- 1 default worker;
- 1 integration/webhook worker;
- 1 AI worker when AI is enabled;
- managed Postgres with PITR/backups;
- managed Redis;
- object storage;
- Sentry.

Queues:

- `default`;
- `integrations`;
- `webhooks_outbound`;
- `automations`;
- `notifications`;
- `ai`;
- `reports_exports`.

## 5. Health And Readiness

Endpoints:

- `GET /health/` — process is alive.
- `GET /health/db/` — DB connectivity check.
- `GET /ready/` — readiness response for deploy/load balancer.

Use `/ready/` for container/load balancer readiness.

## 6. Deployment Sequence

1. Build backend image.
2. Run tests in CI.
3. Build frontend with production `VITE_API_URL`.
4. Deploy backend with old release still running if possible.
5. Run migrations once.
6. Start/roll web instances.
7. Start workers.
8. Check:

   ```bash
   curl https://api.example.com/health/
   curl https://api.example.com/ready/
   ```

9. Verify login and `/api/auth/me/`.
10. Watch Sentry/logs for 15-30 minutes.

## 7. Rollback Policy

Before production:

- every deploy must have a release identifier;
- every migration must be reviewed for reversibility;
- database backup/PITR must be available;
- frontend release should be independently rollbackable.

If deploy fails before migrations:

- rollback app image/frontend.

If deploy fails after migrations:

- prefer forward fix for additive migrations;
- use PITR only for severe data corruption;
- do not run destructive migrations without an explicit manual backup.

## 8. Production Safety Checks

The app now emits Django system check warnings for unsafe staging/production settings:

- `zani.W001` — `DEBUG=True`;
- `zani.W002` — weak/placeholder `SECRET_KEY`;
- `zani.W003` — unrestricted `ALLOWED_HOSTS`;
- `zani.W004` — empty `CORS_ALLOWED_ORIGINS`;
- `zani.W005` — empty `CSRF_TRUSTED_ORIGINS`;
- `zani.W006` — missing `SENTRY_DSN`.

Run:

```bash
ENVIRONMENT=production DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
```

Warnings must be resolved before real production traffic.

## 9. Production Readiness Audit Command

Use the dedicated audit command before staging and production deploys:

```bash
.venv/bin/python manage.py production_readiness_audit
.venv/bin/python manage.py production_readiness_audit --format=json
.venv/bin/python manage.py production_readiness_audit --fail-on-critical
```

The command checks environment, security flags, database, Redis/Celery, object storage, observability, email and required API throttling scopes. CI/staging should use `--fail-on-critical`.

Rate-limit details:

```text
docs/rate-limits.md
```

## 10. What Is Not Solved Yet

This baseline does not yet implement:

- storage quotas and antivirus;
- realtime WebSocket/SSE;
- queue-backed automation runtime;
- real provider credentials for WhatsApp/Telegram/Meta;
- payment provider;
- full load testing.

Those are separate phases in `plan/ZANI_MASTER_TECH_PLAN.md`.
