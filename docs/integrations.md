# Integrations Foundation

Phase 4 adds the first production-oriented integration foundation for merchant connectors.

## Core Concepts

- `BusinessConnector` is the merchant-facing connection object.
- `ConnectorCredential` stores provider secrets per connector.
- `BusinessEvent` stores normalized inbound events with idempotency.
- `ConnectorSyncRun` stores health checks and future pull/webhook sync runs.

This keeps integration state separate from CRM entities and avoids putting provider-specific logic directly into CRM views.

Update 2026-07-14: provider-specific connector and bot-channel actions are now service-backed. `BusinessConnectorViewSet` validates HTTP input and delegates marketplace/Meta/WhatsApp/Kaspi/MoySklad/Wildberries/Ozon config, status, test and sync orchestration to `apps.integrations.services`. `BotChannelViewSet` delegates Telegram, WhatsApp and Instagram setup/test/status/sync orchestration to `apps.bots.services`. Raw provider credentials remain write-only or masked in connector/channel API responses.

Update 2026-07-14: Telegram bot tokens and Instagram access tokens now use the same `ConnectorCredential` storage pattern as WhatsApp. Bot channel config stores safe flags and metadata such as `token_configured`, `access_token_configured`, provider mode and external account ids; provider send/test/status flows read secrets through credential helpers with legacy config backfill.

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

## Merchant UI Boundary

The integrations page is the merchant-facing status center, not a connector developer console.

Provider cards must use `docs/provider-rollout.md` as the readiness source of truth. The UI may show a provider as `connected`, `available`, `beta read-only`, `pilot/setup required`, `request access`, `mock/dev` or `roadmap`, but it must not imply general live readiness when the provider matrix still requires env, support approval or readiness checks.

Default daily cards and setup dialogs show:

- provider name and business value;
- connected, setup required, attention, error or request status;
- safe check, retry, sync or request actions when the role can manage integrations;
- read-only status for regular staff.

Technical setup stays behind owner/admin/support fallback controls:

- access keys, bot tokens, account IDs and webhook verification values;
- provider callback/setup details;
- advanced import windows, entity filters and pagination controls;
- raw provider failure details.

Provider errors shown in the UI must be translated into merchant-safe recovery messages such as reconnect, retry later, ask the owner, or support review. Do not surface raw provider payloads, tokens, callback URLs or debug text in daily CRM workflows.

## Readiness Labels

The current provider matrix is maintained in `docs/provider-rollout.md`.

- Website forms/widget and Excel/CSV are the safest first onboarding surfaces because they do not require paid third-party provider credentials.
- Telegram may become a live messaging provider only after the Telegram env, webhook, monitoring and readiness gate are green.
- WhatsApp and Instagram/Meta stay `pilot/setup required` until Meta signup/OAuth, public webhook delivery, Redis/Celery, Sentry and provider-specific readiness checks are green.
- Kaspi, MoySklad, Wildberries/WB and Ozon stay `beta read-only`; write-back, repricing, order mutation and stock/card mutation must not be advertised or enabled from the merchant UI.
- Transactional email and OpenRouter/OpenAI are runtime providers, not normal merchant data connectors; show only safe system/AI availability or no-provider messages.
- 1C and other future providers stay `request/roadmap` until adapter, support workflow, tests and rollback are documented.

Owner/admin roles can manage connector setup where enabled. Staff/operator roles should see safe read-only statuses or ask-owner/support actions instead of credential forms.

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

Bot-channel credential behavior:

- Telegram `bot_token` is accepted by setup, encrypted into `ConnectorCredential(key="bot_token")`, and removed from `BotChannel.config_json`.
- Instagram manual setup and Meta OAuth page tokens are encrypted into `ConnectorCredential(key="access_token")` and removed from `BotChannel.config_json`.
- WhatsApp keeps using `ConnectorCredential(key="access_token")`.
- `BotChannel.config_json` and connector config should expose only safe configured flags and account metadata.

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

Inbound bot messages add an additional database guard for provider delivery replay:

```text
conversation + direction + external_message_id
```

The constraint applies only when `external_message_id` is present, so manual/internal messages without provider ids remain allowed. Telegram, WhatsApp and Instagram webhook handlers use the shared idempotent message helper and return the existing message on duplicate delivery without creating duplicate `BusinessEvent`, automation work or inbox side effects.

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
- keep advanced credential and webhook setup out of daily CRM pages as provider coverage expands;
- broaden BusinessEvent-to-timeline mapping for conversation-only events when product wants conversation timeline cards.
