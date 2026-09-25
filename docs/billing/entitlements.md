# Entitlements And Billing Enforcement

> **Commercial decision superseded, later on 2026-09-25:** the
> [deferred billing discussion](BILLING_DISCUSSION_DEFERRED_2026-09-25.md) replaces
> the earlier separate-AI/PAYG/no-package statements below with a CRM package
> including AI volume. AI exhaustion pauses AI only; paid manual CRM continues.
> Pricing and billing work are deferred. Other rules and historical evidence,
> including CRM expiry GRACE/READ_ONLY, remain; this is not runtime acceptance.

This document distinguishes the approved commercial contract from the historical
entitlement implementation inventory below. Documentation is not billing acceptance.

<a id="commercial-decisions-20260925"></a>

## Owner-approved V1 commercial model — 2026-09-16

Clarified by the owner's six annotations on 2026-09-25. Authority:
[V1-B01–B04 and remaining decisions](../product/V1_PRODUCT_RULES.md#owner-decisions-20260925).
The statements below are target requirements, not implemented/verified states.

### Seats, specialist thresholds and separate AI

- **Decision:** a billable employee is a user with an account and CRM role.
  A specialist Resource without an account is not a paid seat. Plans must also
  account for thresholds on these specialists; this does not turn Resources into seats.
- AI is outside the base CRM subscription. Listing administrator/operator/owner/
  manager roles does not impose tariff-specific role permissions.
- **Illustrations only:** up to 5/10 specialists, 20/25 thousand per employee,
  30 thousand AI, 130 thousand total and AI quantities 1000/5000/10000 are not
  accepted prices, tiers, included accounts or packages.
- **Open analytical package:** compare product value and economics before proposing
  prices, specialist tiers, included accounts/features, overage/downgrade and
  proration. Invited/inactive accounts and within-period changes still need rules.
  No pricing or market research is performed by this documentation task.

AI remains PAYG without a monetary ceiling or approved hard request package.
The logical billable unit, provider cost/customer charge separation, attempt
history, idempotency and price/weight versioning are specified in the
[AI operation contract](../ai/AI_ASSISTANT_RULES.md#ai-billable-operation-20260925).
The annotation's package option conflicts with the last unambiguous PAYG decision;
retain PAYG until separately resolved. Neither example weights 1/5/10 nor uniform
pilot weight 1 is approved. Cost logging is not a wallet or a completed charge flow.

### Platforma payment processing

This is the clinic paying for **Platforma CRM/AI**, not the clinic collecting
patient money. Platforma billing calculates subscription, usage and customer
charges; the payment provider processes payment. Keep manual patient payments
and financial clinic KPIs under their existing separate contracts.

Provider selection requirements: KZT payments for a Kazakhstan legal entity; card/hosted
checkout; tokenization with no card data stored by Platforma; recurring with
customer consent; API; verifiable successful/failed webhooks; refund; stable
identifiers and reconciliation. A vendor is not selected here. Recurring is
preferred; manual payment is not an accepted replacement.

Required flow: calculation → payment → verified confirmation → activation/renewal.
Handle failed attempts explicitly. Browser redirects and an illustrative event
name such as `payment.success` do not prove payment: apply the selected provider's
verified event/transaction contract and reconciliation. Billing and access must
not be derived solely from the last attempted payment.

The merchant's **Subscription and payment** surface must show plan, employees,
AI usage/charges, date and history. This is a target user flow, not a claim that
the current quota cards already provide it. Provider, prepay/postpay, variable
recurring amount/authorization, exact consent, renew/failure/refund transitions
and reconciliation details remain open before dependent implementation.

### Decision 4 — subscription access

Access sequence after the paid term: `ACTIVE → GRACE (3 days) → READ_ONLY`.
`billing_status` and `access_status` are separate concepts; names are not a mandated
schema or enum. One failed attempt does not remove the already paid-through term.

| Capability | ACTIVE and GRACE | READ_ONLY |
| --- | --- | --- |
| Ordinary CRM reads/writes and outgoing client messages | Normal access within existing tenant/role rights, manual pauses and channel state; GRACE adds notifications and controlled payment retries | Preserve data/history and authorized viewing; reject user CRM writes and outgoing client messages |
| New paid AI calls and business automations | Normal rules; AI usage remains separately accounted for during GRACE | Suspended; do not start a sales pipeline from allowed ingress |
| Inbound webhooks/messages | Normal intake with existing guards | Continue authenticated/idempotent technical receipt and persistence; mapping an unknown sender to a client needs the ingress contract, not automatic Lead creation |
| Billing and payment recovery | Available | Available |
| Audit, backup, monitoring, security and other system operations | Continue | Continue |

Recheck subscription access at action execution, not only when a job is queued.
Preserve the fact/reason of a skipped action; `SKIPPED_SUBSCRIPTION_INACTIVE` is
an example, not a prescribed enum. After verified successful payment, restore
ACTIVE automatically without removing manual pauses, permissions or channel
failures. Do not mass-replay overdue jobs or send old messages. This does not
decide in-flight work, a separate AI debt, or every job's recovery policy.

**O04 is partially resolved:** the main access/ingress/system-operation policy
above is approved. Timezone and the exact three-day clock, retry schedule,
paid-through cancellation/refund handling, in-flight expiration/work, separate
AI debt/reactivation and payment ordering for AI used during GRACE remain open.
Preserve user data; subscription expiry is not a deletion/retention instruction.

### Implementation boundary

The quota inventory and historical verification below describe the existing
foundation. They do not prove compliance with logical AI billing or the access
state machine above. No guards/defaults were removed; authorization, abuse/rate
controls and retry safety remain. Compare existing services before a separately
authorized implementation; no payment, code, DB or deployment is authorized here.

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
