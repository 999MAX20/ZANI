# Integrations Foundation

Phase 4 adds the first production-oriented integration foundation for merchant connectors.

## Core Concepts

- `BusinessConnector` is the merchant-facing connection object.
- `ConnectorCredential` stores provider secrets per connector.
- `BusinessEvent` stores normalized inbound events with idempotency.
- `ConnectorSyncRun` stores health checks and future pull/webhook sync runs.

This keeps integration state separate from CRM entities and avoids putting provider-specific logic directly into CRM views.

Update 2026-07-14: provider-specific connector and bot-channel actions are now service-backed. `BusinessConnectorViewSet` validates HTTP input and delegates marketplace/Meta/WhatsApp/Kaspi/MoySklad/Wildberries/Ozon config, status, test and sync orchestration to `apps.integrations.services`. `BotChannelViewSet` delegates Telegram, WhatsApp and Instagram setup/test/status/sync orchestration to `apps.bots.services`. Raw provider credentials remain write-only or masked in connector/channel API responses.

## API

Merchant endpoints:

- `GET /api/business-connectors/capabilities/`
- `GET /api/business-connectors/`
- `POST /api/business-connectors/`
- `POST /api/business-connectors/{id}/health-check/`
- `POST /api/business-connectors/{id}/connect/`
- `POST /api/business-connectors/{id}/disconnect/`
- `POST /api/business-connectors/{id}/events/`
- `GET /api/connector-credentials/`
- `POST /api/connector-credentials/`
- `GET /api/business-events/`
- `GET /api/connector-sync-runs/`
- `POST /api/connector-sync-runs/{id}/retry/`

Frontend route:

- `/dashboard/integrations`

## CRM Mapping

Current Phase 11 behavior:

- website forms create `lead.captured` BusinessEvents linked to client, lead and form submission;
- website chat creates `message.received` BusinessEvents linked to conversation and, when present, client/lead/deal;
- Telegram, WhatsApp and Instagram inbound messages create `message.received` BusinessEvents after auto-pipeline so CRM links are preserved where configured;
- Excel/CSV import supports clients, leads, deals, sales and catalog; clients/leads/deals emit `*.imported` BusinessEvents and sales/catalog keep their existing event output;
- marketplace pull syncs use `apps.integrations.sync_service.execute_connector_sync`, which normalizes provider events through one adapter before API responses.

Safe retry is intentionally limited to failed health checks and read-only pull/manual sync runs where the connector service can re-run without write-back.

## Credentials

Raw credentials are write-only.

API responses return:

- `masked_value`;
- connector metadata;
- rotation timestamps.

API responses never return:

- raw token;
- raw webhook secret;
- raw API key;
- encrypted storage envelope.

The current local implementation uses a dependency-free encrypted and signed envelope derived from `SECRET_KEY`.
Before high-scale production, prefer an external secret manager or KMS-backed envelope encryption.

## Idempotency

Inbound events are normalized through `normalize_business_event`.

Deduplication is based on:

- `business`;
- `source`;
- `event_type`;
- `external_id` when present;
- otherwise a stable hash of payload.

The database enforces uniqueness with:

```text
business + source + deduplication_key
```

## Permissions

Connectors use the existing `integrations` resource.

- owner/admin: can manage connectors;
- operator: cannot manage connectors;
- tenant filtering stays server-side;
- cross-business connector reads return empty list or 404.

## Next Steps

- add queue-backed sync jobs;
- move long-running health checks to Celery;
- expand connector setup recovery copy as support playbooks mature;
- broaden BusinessEvent-to-timeline mapping for conversation-only events when product wants conversation timeline cards.
