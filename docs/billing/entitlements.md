# Entitlements And Billing Enforcement

Phase 7 turns subscription plans from display-only data into enforceable product limits.

## Goal

All paid limits must go through one service layer instead of scattered checks like:

```text
if plan == "start"
```

This keeps billing, support and product behavior predictable as the CRM grows.

## Central Service

Source:

```text
apps/billing/entitlements.py
```

Core functions:

- `check_entitlement(business, metric, requested=1)`;
- `assert_entitlement_allows(business, metric, requested=1)`;
- `entitlement_summary(business)`;
- `get_plan_limits(business)`.

Supported MVP metrics:

- `users`;
- `bots`;
- `automations`;
- `ai_requests`;
- `bot_messages`;
- `conversations`;
- `storage_mb`.

## API

Merchant billing summary:

```text
GET /api/billing/entitlements/
```

The endpoint returns current usage, plan limit, remaining quota and over-limit state for the active business.

## Enforcement Points

The entitlement guard is enforced in service/view layers for:

- AI requests;
- bot creation;
- bot messages;
- bot conversations;
- automation rule creation;
- business member creation;
- storage quota checks.

## Plan Defaults

Default limits live in:

```text
DEFAULT_PLAN_LIMITS
```

The database migration updates existing default plans with the same limit keys so product limits are visible in admin and API responses.

Plan-specific `limits_json` still overrides defaults. This allows support/platform admin to adjust a plan without changing feature code.

## Frontend

`/dashboard/settings` now reads:

```text
GET /api/billing/entitlements/
```

The billing cards show:

- current usage;
- limit;
- remaining quota.

The frontend displays limits, but the backend remains the source of truth and rejects over-limit actions.

## Error Shape

Over-limit API actions return validation errors with:

- `entitlement`;
- `metric`;
- `value`;
- `limit`;
- `plan_code`.

This gives the UI enough information to show an upgrade or contact-support prompt later without guessing.

## Checks

Latest verification:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm run build
```

Result:

```text
172 backend tests OK
frontend build OK
```
