# Paid Beta Launch Runbook

This runbook is the operational bridge after production-hardening phases H1-H9 are code/docs ready.

It does not create provider accounts or secrets. It verifies that the staging/production-like environment was actually provisioned and rehearsed.

## 1. Required Services Before Running

Required:

- backend web service;
- frontend static service with SPA rewrite;
- managed PostgreSQL;
- managed Redis;
- private S3-compatible object storage;
- Sentry or equivalent error monitoring;
- transactional email provider;
- platform admin test account;
- merchant owner test account with at least one `Business`;
- optional merchant operator for role smoke.

Real WhatsApp/Instagram/OpenAI/Kaspi providers are not required for the paid-beta gate. They must stay disabled until their provider rollout gates are green.

## 2. Required Environment Flags

The paid-beta gate has four manual confirmation flags:

```env
PAID_BETA_STAGING_SMOKE_GREEN=False
PAID_BETA_BROWSER_E2E_GREEN=False
PAID_BETA_BACKUP_RESTORE_DRILL_DONE=False
PAID_BETA_SUPPORT_GRANT_FLOW_TESTED=False
```

Set each flag to `True` only after the corresponding check was completed on staging/production-like infrastructure.

## 3. One-Command Launch Check

Run from a production-like environment or from a local machine pointed at staging:

```bash
API_BASE_URL=https://api-staging.zani.example \
FRONTEND_URL=https://app-staging.zani.example \
PLATFORM_ADMIN_EMAIL=platform_admin@example.com \
PLATFORM_ADMIN_PASSWORD='***' \
MERCHANT_OWNER_EMAIL=business_owner@example.com \
MERCHANT_OWNER_PASSWORD='***' \
BUSINESS_ID=1 \
scripts/paid_beta_launch_check.sh
```

What it runs:

- `makemigrations --check --dry-run`;
- `manage.py check`;
- `production_readiness_audit --fail-on-critical`;
- `backup_restore_readiness_check --fail-on-blockers`;
- `observability_runtime_check --fail-on-missing`;
- `email_runtime_smoke --fail-on-missing`;
- `provider_rollout_readiness_check --fail-on-blockers`;
- `queue_runtime_smoke --business-id ... --cleanup`;
- `storage_runtime_smoke --business-id ... --cleanup`;
- `scripts/staging_smoke.sh`;
- optional `scripts/api_load_smoke.py`;
- final `paid_beta_gate_check --fail-on-blockers`.

## 4. Optional Load Smoke

Enable lightweight load smoke:

```bash
RUN_LOAD_SMOKE=true \
LOAD_SMOKE_ITERATIONS=10 \
LOAD_SMOKE_FAIL_P95_MS=2500 \
API_BASE_URL=https://api-staging.zani.example \
MERCHANT_OWNER_EMAIL=business_owner@example.com \
MERCHANT_OWNER_PASSWORD='***' \
BUSINESS_ID=1 \
scripts/paid_beta_launch_check.sh
```

Do not run this against real external providers. Keep provider calls mocked, disabled or queued.

## 5. Browser E2E

The launch script does not run Playwright automatically because browser dependencies and credentials are usually CI-specific.

Run separately:

```bash
cd frontend
E2E_BASE_URL=https://app-staging.zani.example \
E2E_PLATFORM_EMAIL=platform_admin@example.com \
E2E_OWNER_EMAIL=business_owner@example.com \
E2E_OPERATOR_EMAIL=business_operator@example.com \
E2E_PASSWORD='***' \
npm run e2e:staging
```

After it passes, set:

```env
PAID_BETA_BROWSER_E2E_GREEN=True
```

## 6. Backup Restore Drill

Before setting `PAID_BETA_BACKUP_RESTORE_DRILL_DONE=True`:

- export/restore managed Postgres into a separate test database;
- verify migrations run on restored data;
- verify private object storage can be listed and a sample object can be restored/downloaded;
- document restore time and responsible person;
- confirm no production customer data was exposed to local machines.

## 7. Support Grant Drill

Before setting `PAID_BETA_SUPPORT_GRANT_FLOW_TESTED=True`:

- owner creates a support grant;
- platform/support user can access scoped merchant data only while grant is active;
- expired/revoked grant blocks access;
- audit log records grant and support action;
- merchant UI remains clear about support access.

## 8. Pass Criteria

Paid beta can start only if:

```bash
scripts/paid_beta_launch_check.sh
```

finishes successfully and:

```bash
python manage.py paid_beta_gate_check --fail-on-blockers
```

passes in the target environment.

If the gate is red, keep the product in pilot/demo mode.
