# Integrations Foundation

Phase 4 adds the first production-oriented integration foundation for merchant connectors.

## Core Concepts

- `BusinessConnector` is the merchant-facing connection object.
- `ConnectorCredential` stores provider secrets per connector.
- `BusinessEvent` stores normalized inbound events with idempotency.
- `ConnectorSyncRun` stores health checks and future pull/webhook sync runs.

This keeps integration state separate from CRM entities and avoids putting provider-specific logic directly into CRM views.

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

Frontend route:

- `/dashboard/integrations`

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

- wire real Telegram/WhatsApp/Meta provider setup into connectors;
- add queue-backed sync jobs;
- move long-running health checks to Celery;
- add provider-specific recovery messages;
- add event-to-timeline mapping for client/deal cards.
