# Paid Beta Gate

Zani must not enter real paid beta based on intuition. The gate is explicit and executable.

## Command

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py paid_beta_gate_check
```

CI/deploy blocking mode:

```bash
.venv/bin/python manage.py paid_beta_gate_check --fail-on-blockers
```

JSON output:

```bash
.venv/bin/python manage.py paid_beta_gate_check --format=json
```

## Required Green Gates

- staging smoke is green;
- browser E2E is green;
- production readiness audit has no critical failures;
- Redis/Celery runtime is enabled;
- private object storage is enabled;
- Sentry/error monitoring is enabled;
- transactional email is enabled;
- backup/restore drill is completed;
- support access grant workflow is tested;
- Platform Operations health is not critical;
- no real provider is enabled without rollback path.

Platform Operations health is database-aware. An unavailable database or
missing schema is returned as a structured `database_unavailable` critical
blocker; the paid-beta command remains executable and fails closed instead of
crashing. Queue health must include outbound delivery lag/retries/failures and
routing/SLA attention lag before the gate can be considered green.

## Manual Confirmation Env

These variables must stay `False` until the corresponding operational check was completed:

```env
PAID_BETA_STAGING_SMOKE_GREEN=False
PAID_BETA_BROWSER_E2E_GREEN=False
PAID_BETA_BACKUP_RESTORE_DRILL_DONE=False
PAID_BETA_SUPPORT_GRANT_FLOW_TESTED=False
```

Set them to `True` only after the check passed on staging/production-like infrastructure.

Production must also keep demo/mock merchant flows disabled:

```env
ALLOW_DEMO_MERCHANT_FLOWS=False
```

## Rule

If `paid_beta_gate_check --fail-on-blockers` fails, Zani is not ready for paid beta. Do not work around this by disabling checks. Fix the blocker or consciously keep the product in pilot/demo mode.

## Controlled Pilot Boundary

Passing local controlled-pilot QA is not the same as paid beta readiness.

For local/dev controlled pilot checks without production credentials:

```bash
python manage.py prepare_pilot_demo --reset
python manage.py pilot_launch_quality_gate
```

These commands prove that the demo merchant, owner, manager, operator, public lead form, CRM APIs, inbox summary, pilot readiness endpoint and basic analytics are reachable on mock/dev data. They do not prove staging smoke, browser E2E against deployed infrastructure, Redis/Celery runtime, object storage, Sentry, email, backup/restore or real provider rollback readiness.
