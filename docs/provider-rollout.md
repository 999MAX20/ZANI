# Provider Rollout Sequence

Zani does not enable all external providers at once. Every real provider must pass a readiness gate before it is exposed to merchants or paid beta traffic.

## Approved Order

1. Telegram real webhook.
2. Website widget and public forms production embed.
3. Excel/CSV real import as the first data connector.
4. Transactional email.
5. OpenRouter/OpenAI behind AI queue and usage limits.
6. WhatsApp provider pilot.
7. Instagram/Meta provider pilot.
8. Kaspi, marketplaces and 1C after event normalization and support workflow are proven.

## Required Gate For Every Provider

- provider adapter is registered behind `apps.integrations.providers`;
- merchant connector metadata exists in the connector catalog;
- credentials are stored/masked through provider settings or `ConnectorCredential`;
- webhook verification exists where relevant;
- inbound events are normalized through `BusinessEvent` / `IntegrationEventLog`;
- duplicate delivery is handled by deduplication keys or idempotent processing;
- connector health is visible to support;
- tenant isolation is covered by tests;
- rollback and recovery steps are documented.

## Readiness Command

Run all checks:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py provider_rollout_readiness_check
```

Fail deployment when selected provider has blockers:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py provider_rollout_readiness_check \
  --provider telegram \
  --fail-on-blockers
```

JSON output for CI/runbooks:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py provider_rollout_readiness_check --format=json
```

Render/deploy wrapper:

```bash
scripts/render_h7_provider_rollout_check.sh
PROVIDER=telegram scripts/render_h7_provider_rollout_check.sh
```

Use the provider-specific form before turning on any real provider env flag.

## Current Provider Notes

- Telegram: has provider adapter and webhook verification. Real mode requires `TELEGRAM_ENABLED=True`, `TELEGRAM_WEBHOOK_SECRET`, Redis/Celery runtime and Sentry.
- Website/public forms: can be used first because it does not require paid provider credentials. Keep public throttles enabled.
- Excel/CSV: available as the first data connector. It is not an external provider, but it must keep connector catalog metadata, import entity support, upload limits and BusinessEvent normalization green before merchant data onboarding.
- Transactional email: configure SMTP and run `email_runtime_smoke` before relying on invitations, alerts or recovery emails.
- OpenRouter/OpenAI: keep mock mode unless AI queue, throttles and usage limits are ready. AI must stay optional for merchants.
- WhatsApp: current provider is pilot/mock. Do not set `WHATSAPP_ENABLED=True` until a real Meta/Twilio/360dialog adapter, webhook verification and rollback docs exist.
- Instagram/Meta: current adapter is request-only. Do not set `INSTAGRAM_ENABLED=True` until Meta OAuth/webhook and permission-review flow are ready.
- Kaspi/marketplaces/1C: keep request/roadmap until reconciliation, support tooling and data import/export recovery are stable.

## Environment Rule

Provider env flags are not feature toggles for experiments in production. If a flag enables real external traffic, it must be paired with:

- production secrets;
- provider-specific recovery instructions;
- queue-backed runtime;
- error monitoring;
- support-visible connector status;
- tenant isolation tests.

## Rollback Rule

Every provider activation needs a rollback note before going live:

```text
Provider:
Enabled flag/env:
How to disable:
Webhook/provider console rollback:
Expected merchant impact:
Support message:
Owner:
```

If rollback is not documented, keep the provider in request/pilot mode.
