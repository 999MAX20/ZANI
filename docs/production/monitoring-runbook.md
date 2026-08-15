# Monitoring Runbook

This runbook is the minimum monitoring layer for staging demos and early merchant pilots.

## External Uptime Checks

Create external monitors for:

```text
GET https://<api-host>/health/
GET https://<api-host>/health/db/
GET https://<api-host>/ready/
GET https://<frontend-host>/
```

Recommended free/cheap services:

- Better Stack Uptime;
- UptimeRobot;
- Cronitor;
- Render native notifications for deploy/runtime events.

Use `/health/` for wake/demo checks and `/ready/` for deployment readiness. A green `/health/` does not guarantee database availability; `/health/db/` covers that.

## Error Tracking

Sentry is the default production error monitor.

Required backend env:

```env
SENTRY_DSN=<sentry-dsn>
SENTRY_TRACES_SAMPLE_RATE=0.05
ENVIRONMENT=staging
RELEASE=<git-sha-or-release-tag>
```

Verify after deploy:

```bash
scripts/render_h3_observability_smoke.sh
CAPTURE_SENTRY_SMOKE=true scripts/render_h3_observability_smoke.sh
```

Do not send merchant/customer payloads in smoke events.

## Platform Operations

Platform support should check:

```text
/platform/operations
GET /api/platform/operations-health/
python manage.py platform_operations_health_check
```

Before a paid pilot, run:

```bash
python manage.py production_readiness_audit
python manage.py platform_operations_health_check
python manage.py provider_rollout_readiness_check
python manage.py backup_restore_readiness_check
```

## Alert Rules

Initial alert triggers:

- backend `/health/` down for 2 checks;
- `/health/db/` down for 1 check;
- `/ready/` down after deploy;
- Sentry issue with 5xx or unhandled frontend crash;
- platform operations health status is `critical`;
- queue/runtime smoke fails after Redis/Celery are enabled;
- storage smoke fails after `USE_S3=True`.

## Demo/Pilot Smoke

After every deploy to staging:

```bash
scripts/staging_smoke.sh
cd frontend && npm run e2e -- --project=desktop-chromium
```

Against deployed Render services:

```bash
API_BASE_URL=https://<api-host> \
FRONTEND_URL=https://<frontend-host> \
PLATFORM_ADMIN_EMAIL=platform_admin@example.com \
PLATFORM_ADMIN_PASSWORD='***' \
MERCHANT_OWNER_EMAIL=business_owner@example.com \
MERCHANT_OWNER_PASSWORD='***' \
scripts/staging_smoke.sh
```

```bash
cd frontend
E2E_BASE_URL=https://<frontend-host> \
E2E_API_BASE_URL=https://<api-host> \
E2E_SKIP_LOCAL_SETUP=true \
npm run e2e:staging
```

