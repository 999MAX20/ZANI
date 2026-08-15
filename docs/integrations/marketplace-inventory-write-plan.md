# Marketplace Inventory Write Plan

This document defines how ZANI should safely update marketplace stock after an approved sale or reservation created inside ZANI.

Inventory write is not "full marketplace access". It is a narrow capability for stock quantities only.

## Current decision

Implement marketplace integrations in two stages:

1. Read-only connectors for Wildberries, Ozon and Kaspi.
2. Inventory write mode after local reservation, idempotency, retry and audit foundations are ready.

Suggested write-mode rollout:

1. Ozon first.
2. Wildberries second.
3. Kaspi only after real-account validation.

## Why local reservation is required

A messenger sale can happen outside the marketplace where stock is displayed. If ZANI only updates the marketplace after the fact, two customers can still buy the same remaining item.

Correct flow:

```text
Customer asks in messenger
-> bot or user confirms purchase intent
-> ZANI checks internal stock/mapping
-> ZANI creates local reservation
-> ZANI queues stock update for connected marketplaces
-> provider adapter updates stock
-> ZANI records success/failure
-> user sees whether the marketplace was updated
```

## Required backend objects

Use existing integration models where possible before adding new models.

Likely required additions:

- `connection_mode` on connector config: `read_only` or `inventory_write`.
- `MarketplaceProductMapping`:
  - `business`;
  - `provider`;
  - `connector`;
  - `zani_product_id`;
  - provider product identifiers such as `offer_id`, `product_id`, barcode, SKU, warehouse id.
- `InventoryReservation`:
  - `business`;
  - product;
  - quantity;
  - source channel/conversation/deal/order;
  - status: pending, reserved, released, completed, failed;
  - expiry time;
  - created/approved by.
- `MarketplaceStockOperation` or provider-neutral outbox event:
  - `business`;
  - connector;
  - provider;
  - reservation;
  - product mapping;
  - target quantity or delta;
  - idempotency key;
  - status;
  - retry count;
  - last provider response summary;
  - safe merchant error.

## Service boundaries

Do not update marketplace stock from:

- chatbot handlers;
- frontend components;
- DRF views directly;
- AI tool calls directly.

Allowed path:

```text
bot/frontend/API
-> ZANI domain service
-> inventory reservation service
-> integration write service
-> provider adapter/client
```

## Provider adapter contract

Each marketplace adapter should expose capability flags:

- `supports_read_orders`
- `supports_read_products`
- `supports_read_stocks`
- `supports_inventory_write`
- `supports_stock_validation`

For stock control:

- `validate_write_credentials(connector)`
- `fetch_stock(connector, mapping)`
- `update_stock(connector, operation)`

The adapter must not leak raw provider errors to merchant-facing responses.

## Idempotency and retry rules

Every stock operation needs a stable idempotency key, for example:

```text
business_id + provider + connector_id + reservation_id + product_mapping_id + operation_type
```

Retry only when:

- the provider operation is idempotent or ZANI can safely compare current stock before retry;
- timeout/temporary provider failure happened;
- the operation is still within a safe retry window.

Do not retry blindly after:

- invalid credentials;
- missing warehouse;
- missing product mapping;
- provider validation error;
- unknown partial success without reconciliation.

## Partial failure behavior

If ZANI reserves stock locally but a marketplace update fails:

1. Keep the local reservation visible.
2. Mark the marketplace operation as failed.
3. Show a merchant-safe alert.
4. Allow manual retry if safe.
5. Do not pretend the marketplace was updated.
6. Do not auto-release the reservation unless the business rule says so.

## Audit and BusinessEvents

Stock write mode must record:

- who/what initiated the reservation;
- which connector was targeted;
- which marketplace product/warehouse was affected;
- old/new quantity if known;
- operation status;
- provider-safe error summary;
- retry/recovery actions.

Recommended BusinessEvent families:

- `stock.reservation_created`;
- `stock.reservation_released`;
- `stock.marketplace_update_requested`;
- `stock.marketplace_update_succeeded`;
- `stock.marketplace_update_failed`;
- `connector_health.error`.

## Frontend requirements

Integration cards must show:

- selected mode;
- whether write access was validated;
- missing setup items;
- last read sync;
- last stock write result;
- safe retry/reconnect action;
- clear warning that prices are not managed.

For inventory write onboarding:

1. Ask for required warehouse/product mapping only after the merchant selects stock control.
2. Run read connection check first.
3. Run write readiness check second.
4. Keep write mode disabled until both checks pass.

## Provider-specific rollout notes

### Ozon

Use as the first inventory write candidate because the required setup can be expressed clearly:

- `Client ID`;
- `API key`;
- `warehouse_id`;
- mapping by `offer_id` or `product_id`.

Respect provider-side limits. Queue stock writes and avoid rapid repeated updates for the same product/warehouse pair.

### Wildberries

Use as second inventory write candidate:

- API token;
- warehouse id;
- mapping by SKU/barcode/internal article where supported.

Do not mix stock control with price/card editing permissions.

### Kaspi

Keep inventory write hidden/pilot until a live validation task confirms:

- exact available stock/product update method;
- account permissions;
- provider response semantics;
- recovery path for failed or partial updates.

Until then, Kaspi self-service stays read-only.

## Acceptance criteria before enabling write mode

- Tenant isolation tests cover connector, mapping, reservation and operation reads/writes.
- Permission tests deny operators without integration-management rights.
- Raw credentials are masked everywhere.
- Stock operations are idempotent and logged.
- Provider failures create merchant-safe status.
- Retry path is bounded and safe.
- Frontend shows connected/attention/error states.
- Provider rollout document marks the provider as pilot or ready with rollback steps.
