# ZANI lightweight integrations roadmap

ZANI integrations are an event and visibility layer, not a replacement for 1C, MoySklad, POS, accounting or marketplace back offices.

The merchant UI must stay simple:

- connect;
- request connection;
- check connection;
- disconnect;
- see status and next action.

The merchant UI must not show raw API keys, webhook secrets, provider JSON, internal webhook URLs or credential internals.

## Current architecture

Implemented foundation:

- `BusinessConnector` — merchant-facing connection object.
- `ConnectorCredential` — backend-side credential storage with masked API responses.
- `ConnectorSyncRun` — health and sync execution history.
- `IntegrationEventLog` / webhook logs — provider delivery visibility.
- `BusinessEvent` — normalized event layer for dashboard, analytics and future AI context.
- Provider adapters under `apps/integrations/providers/`.

Main route:

- `/dashboard/integrations`

Main APIs:

- `GET /api/business-connectors/capabilities/`
- `GET /api/business-connectors/`
- `POST /api/business-connectors/{id}/connect/`
- `POST /api/business-connectors/{id}/disconnect/`
- `POST /api/business-connectors/{id}/health-check/`
- `GET /api/business-events/`
- `POST /api/import-jobs/`
- `POST /api/import-jobs/{id}/confirm/`

## Pilot-safe order

### 1. Website chat and forms

Status: available.

Purpose:

- receive website/landing leads;
- create client, lead and conversation context;
- keep the widget flow safe for pilot demos.

### 2. Excel / CSV

Status: available.

Purpose:

- import clients;
- import sales as `BusinessEvent(event_type="sale.recorded")`;
- import catalog rows;
- create/update services from service rows;
- give dashboard real revenue data without direct ERP integration.

Next hardening:

- clearer import previews on mobile;
- rollback/undo import batch;
- richer templates for hair salon, clinic, retail and education.
- readiness gate: `python manage.py provider_rollout_readiness_check --provider excel_csv --fail-on-blockers`.

### 3. Telegram

Status: beta foundation.

Purpose:

- first real external communication channel;
- BotFather token flow;
- inbound messages to Inbox;
- outbound replies through provider layer when enabled.

Rules:

- token is accepted only through password fields;
- token is never returned raw;
- production mode requires `TELEGRAM_ENABLED=True`, webhook secret, queue runtime and observability.

Next MVP block:

- final merchant setup wizard;
- controlled test connection;
- webhook setup status;
- inbound-to-inbox smoke coverage;
- clear support fallback when Telegram real mode is disabled.
- readiness gate: `python manage.py provider_rollout_readiness_check --provider telegram --fail-on-blockers`.

### 4. WhatsApp

Status: request / support-assisted.

Purpose:

- critical channel for SMB market;
- start with request flow and provider selection;
- no fake "ready" promise before provider credentials and legal flow are stable.

### 5. Instagram

Status: request / Meta-ready.

Rules:

- never ask for Instagram password;
- collect username, Facebook Page and contact request only;
- real implementation goes through Meta-approved flow.

### 6. Kaspi, 1C, MoySklad, marketplaces

Status: request / roadmap.

Purpose:

- read-only visibility;
- sales, orders, stock and product events;
- no ERP replacement;
- no write-back or repricing in pilot.

## Support-assisted model

For providers that are not fully self-service, the merchant creates a connection request. ZANI support or platform operators finish technical setup internally.

Merchant sees:

- request received;
- connecting;
- action required;
- connected;
- failed;
- contact support.

Internal/platform side sees:

- provider;
- merchant;
- request details;
- safe credential setup;
- sync logs;
- last error;
- next action.

## Production gates

Before enabling a provider for real production traffic:

- credential masking verified;
- tenant filtering verified;
- inbound webhook signature or secret verification;
- idempotency through `BusinessEvent` or provider-specific message IDs;
- retry and error mapping;
- rate limiting;
- observability and alerting;
- no raw secrets in logs;
- support runbook updated.

## Next implementation blocks

1. Telegram Connector MVP hardening.
2. Excel/CSV Real Import UX hardening.
3. WhatsApp request workflow and provider decision.
4. Platform operator connection queue.
5. BusinessEvent-to-dashboard/AI context expansion.
