# Telegram Connector MVP

This is the next implementation block after the current lightweight integration readiness pass.

## Goal

Make Telegram the first real external communication connector without turning ZANI into a provider-heavy integration platform.

Merchant-facing UX stays simple:

- connect Telegram;
- paste BotFather token;
- check connection;
- see webhook/setup status;
- receive inbound messages in Inbox;
- reply from Inbox when real mode is enabled;
- see a safe fallback when real mode is disabled.

## Current Foundation

Already available:

- `BotChannel` Telegram channel configuration;
- `BusinessConnector` catalog entry for Telegram;
- provider adapter under `apps.integrations.providers.telegram`;
- webhook endpoint `/api/integrations/telegram/webhook/`;
- inbound message normalization into conversation/message models;
- `IntegrationEventLog` visibility;
- provider rollout gate:

```bash
.venv/bin/python manage.py provider_rollout_readiness_check --provider telegram
```

Current gate is green while Telegram is disabled. Real provider traffic still requires production prerequisites.

## Implementation Scope

### Backend

- Keep provider calls inside the Telegram provider adapter.
- Keep raw bot token write-only and never return it to frontend.
- Store only masked/derived status in API responses.
- Keep webhook secret verification mandatory for real mode.
- Add/keep idempotency for inbound Telegram updates.
- Keep outbound replies routed through provider layer, not directly from inbox views.
- Add support-visible connection status:
  - token saved;
  - webhook configured;
  - last inbound event;
  - last outbound event;
  - last provider error.

### Frontend

- Improve `/dashboard/integrations` Telegram block into a guided setup:
  - step 1: create bot in BotFather;
  - step 2: paste token;
  - step 3: test connection;
  - step 4: configure/check webhook;
  - step 5: open Inbox.
- Do not show raw webhook URLs, internal secrets or provider JSON to the merchant.
- Show clear state when Telegram is beta/disabled:
  - “Token saved. Real Telegram traffic is not enabled yet.”
  - “Support will finish production activation.”

### Tests

- Token save never leaks token.
- Wrong webhook secret is rejected.
- Inbound webhook creates/updates conversation safely.
- Duplicate update does not create duplicate business events/messages.
- Outbound reply uses provider layer and returns mock result when disabled.
- Merchant tenant isolation is preserved.

## Production Gate

Before enabling `TELEGRAM_ENABLED=True`:

- `TELEGRAM_WEBHOOK_SECRET` is configured;
- managed Redis/Celery queue exists;
- `AUTOMATIONS_RUN_INLINE=False`;
- Sentry/observability is configured;
- rollback instruction is written;
- provider rollout gate passes with `--fail-on-blockers`;
- staging smoke confirms inbound and outbound flow.

## Non-goals

- No WhatsApp production.
- No Instagram/Meta production.
- No autonomous AI replies.
- No mass broadcasts.
- No Telegram Mini App.

