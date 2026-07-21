# Connector Blueprint

This blueprint defines how ZANI integrations should be built and reviewed.

## Product Principle

ZANI integrations are lightweight business signal connectors, not full ERP replicas.

The merchant experience should be:

```text
Click Connect -> authorize or enter required credentials -> ZANI checks health -> business events and recommendations appear.
```

Technical setup, webhooks, raw credentials and provider-specific errors must be hidden behind a simple setup/help flow.

## Required Connector Surface

Every production connector should define:

- provider identity and display metadata;
- setup status;
- masked credentials state;
- health check;
- last sync or last webhook timestamp;
- last error with a merchant-safe message;
- retry or reconnect action;
- role-based setup permissions;
- audit trail for important actions;
- BusinessEvent output for AI Analyst and dashboards.

## Backend Shape

Provider-specific logic belongs behind connector/provider layers.

Preferred structure:

- `apps/integrations/providers/*` for provider adapters;
- `apps/integrations/*/` for provider-specific API clients where needed;
- `apps/integrations/crm_mapping.py` for CRM-facing event normalization;
- `apps/integrations/sync_service.py` for safe provider-neutral pull sync/retry orchestration;
- shared serializers/views for setup/status;
- management commands for local live checks;
- tests for status, permissions, masking and event normalization.

Views should not contain provider business logic. They should validate input, enforce permissions and call services/providers.

Current implementation note 2026-07-14: `BusinessConnectorViewSet` delegates provider config/status/test/sync/OAuth/setup actions to `apps.integrations.services`, and `BotChannelViewSet` delegates Telegram/WhatsApp/Instagram setup, test, status and sync actions to `apps.bots.services`. Telegram and Instagram bot-channel secrets are stored through `ConnectorCredential`; channel `config_json` keeps only configured flags and safe account metadata. New provider actions should extend those service/provider boundaries instead of adding provider-specific orchestration to viewsets.

## Frontend Shape

The `Подключения` page should show each integration as a clear operational card:

- provider logo;
- provider name;
- short merchant benefit;
- status badge;
- primary action: connect/configure/check;
- secondary details only inside modal/wizard.

Setup modal should include only fields required for the selected provider. Advanced webhook/debug details should not dominate the default merchant path.

## BusinessEvent Output

Every connector should normalize important external data into business events where applicable.

Minimum event families:

- `message` for inbound/outbound conversations;
- `lead` for captured demand;
- `client` and `deal` for file-imported CRM records;
- `order` for marketplace/order events;
- `sale` for completed purchases;
- `client` for customer changes;
- `stock` for inventory risk;
- `return` for refunds/returns;
- `connector_health` for sync/auth failures;
- `pricing` for repricing and competitor signals.

Each event should include:

- `business`;
- provider/source;
- external id when available;
- source timestamp;
- normalized payload;
- link to CRM entity when applicable;
- safe summary for AI Analyst.

## Security Rules

- Never expose raw tokens to frontend.
- Never log access tokens, webhook secrets or authorization codes.
- Mask credentials in serializers.
- Do not persist Telegram/Instagram/WhatsApp access tokens in `BotChannel.config_json`; use `ConnectorCredential` and safe `*_configured` flags.
- Validate webhook signatures or secret tokens where provider supports it.
- Rate limit public webhook and setup endpoints.
- Keep tenant isolation mandatory.

## Production Checklist

- Setup works for a real merchant or has an explicit mock/dev mode.
- Provider readiness status is documented in `docs/provider-rollout.md` before the provider appears in merchant UI or support playbooks.
- Merchant-facing labels distinguish live-ready, beta read-only, pilot/setup required, request/roadmap and mock/dev states.
- Status card shows connected, attention and error states.
- Health check can be run safely.
- Last sync/webhook time is visible.
- Failed safe sync runs can be retried through permission-gated API.
- Errors are actionable for merchant/support.
- BusinessEvents are created for important data.
- AI Analyst can cite connector events.
- Tests cover permissions and secret masking.
- Env vars are documented in `.env.example`.
- Readiness docs are updated.
