# Platform Operations Health

`/platform/operations` is an internal Platform Admin page for support and operations during paid beta.

It answers the support question:

```text
Что сломалось у мерча и где смотреть дальше?
```

## Backend Endpoint

```http
GET /api/platform/operations-health/
```

Access:

- `platform_admin`;
- `platform_manager`.

Merchant users receive `403`.

## CLI Check

For CI/support diagnostics without opening the UI:

```bash
python manage.py platform_operations_health_check
python manage.py platform_operations_health_check --format=json
python manage.py platform_operations_health_check --fail-on-critical
```

Use `--fail-on-critical` in pre-launch checks when the platform operations view must be clean before a demo or paid-beta rollout.

## What It Shows

- runtime queue status:
  - broker configured;
  - inline automation mode;
  - queue names;
  - pending/running/failed automation runs;
  - failed connector syncs;
  - failed webhook deliveries;
- production readiness blockers;
- backup/restore readiness blockers;
- provider rollout readiness;
- connector request queue;
- failed automation runs;
- failed integration events;
- failed webhook deliveries;
- active support grants count.

## Support Workflow

When a merchant reports a problem:

1. Open `/platform/operations`.
2. Check global critical/warning counters.
3. If the problem is connector-specific, open the connector queue card and go to the merchant detail.
4. If the problem is automation/integration-specific, open the failure card and inspect error text.
5. Log a support action on the merchant detail page.
6. Do not access merchant data directly unless a support grant exists and the action is required.

## Safety Rules

- This page is platform-only.
- It does not expose provider secrets.
- It links operators to merchant-level support detail instead of raw database access.
- Risky support actions must remain audited.
- Merchant CRM stays simple; this operational complexity is hidden from merchant users.
