# ZANI Integrations Documentation

This folder contains the current source of truth for external connectors and integration rollout.

ZANI integrations must stay simple for merchants: connect account, verify access, sync useful business data, show safe status and avoid exposing raw provider complexity in daily CRM screens.

## Start here

- `CONNECTOR_BLUEPRINT.md` — how all ZANI connectors should be shaped.
- `integrations.md` — implemented integration foundation, APIs, credentials and BusinessEvent model.
- `provider-rollout.md` — provider rollout order and readiness gates.

## Marketplace connectors

Use these docs for Wildberries, Ozon, Kaspi and marketplace inventory work:

- `marketplace-integrations.md` — product/technical overview for marketplace connectors.
- `marketplace-onboarding-runbook.md` — merchant-facing setup instructions and field names.
- `marketplace-inventory-write-plan.md` — safe plan for stock reservation/write-back.
- `marketplaces/wildberries-merchant-connector.md`
- `marketplaces/ozon-merchant-connector.md`
- `marketplaces/kaspi-merchant-connector.md`
- `marketplaces/moysklad-merchant-connector.md`

## Communication and channel providers

- `providers/telegram-merchant-connector.md`
- `providers/telegram-connector-mvp.md`
- `providers/whatsapp-merchant-connector.md`
- `providers/instagram-merchant-connector.md`
- `providers/transactional-email.md`
- `providers/widget-sdk.md`
- `communication-onboarding.md`
- `public-lead-capture.md`

## Imports

- `imports/data-imports.md`
- `imports/excel-csv-real-import-mvp.md`
- `imports/samples/`

## Connector implementation rule

Provider-specific behavior must stay behind provider adapters/clients. CRM, bot and AI logic must use normalized services, events, mappings and approval flows instead of calling Wildberries, Ozon, Kaspi, Meta, Telegram or other provider APIs directly.
