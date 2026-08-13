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
- supported modes and selected merchant mode;
- setup status;
- masked credentials state;
- health check;
- last sync or last webhook timestamp;
- last error with a merchant-safe message;
- retry or reconnect action;
- role-based setup permissions;
- audit trail for important actions;
- BusinessEvent output for AI Analyst and dashboards.

For marketplace connectors, supported modes must be explicit:

- `read_only` - read orders, products, stock snapshots and events without changing provider data.
- `inventory_write` - stock-only write mode after a ZANI reservation/release operation. This is not full marketplace access and must not include price/card/order mutations.

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

## Frontend Shape

The `Подключения` page should show each integration as a clear operational card:

- provider logo;
- provider name;
- short merchant benefit;
- status badge;
- primary action: connect/configure/check;
- secondary details only inside modal/wizard.

Setup modal should include only fields required for the selected provider. Advanced webhook/debug details should not dominate the default merchant path.

For marketplace cards, the default setup path must start in read-only mode. Inventory write fields such as warehouse id and product mapping should appear only after the merchant selects stock control.

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
- Validate webhook signatures or secret tokens where provider supports it.
- Rate limit public webhook and setup endpoints.
- Keep tenant isolation mandatory.

## Production Checklist

- Setup works for a real merchant or has an explicit mock/dev mode.
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

## Marketplace Stock Write Checklist

Before enabling stock write for any marketplace:

- read-only connection check passes;
- write-capable credentials are validated;
- warehouse/store id is configured where required;
- provider product mapping exists;
- ZANI has a local reservation/release service;
- write operations are queued and idempotent;
- partial failures create merchant-visible attention status;
- stock write does not mutate prices, product cards or marketplace orders;
- audit/BusinessEvent output exists for requested, succeeded and failed operations;
- rollback/recovery steps are documented in `provider-rollout.md`.
