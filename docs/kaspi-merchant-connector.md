# Kaspi Merchant Connector

## Purpose

Kaspi is a per-merchant read-only data connector. In the current self-service baseline, a merchant provides their Kaspi seller access key, and ZANI imports orders as business events for analytics, AI context, sales visibility and later reconciliation.

## Scope

Current implementation is read-only:

- import orders;
- normalize `kaspi_order_imported`;
- derive `kaspi_sale_detected` for completed/accepted orders;
- store raw provider payload for audit/debugging;
- no order acceptance;
- no cancellations;
- no repricing;
- no product write-back.

## Environment

Required for real Kaspi API calls:

```env
KASPI_ENABLED=True
KASPI_API_BASE_URL=https://kaspi.kz/shop/api/v2
```

When `KASPI_ENABLED=False`, credentials can be saved and sync runs create safe mock events.

## Merchant Credentials

Stored per connector:

- encrypted `ConnectorCredential(key=api_token)`;
- safe `BusinessConnector.config_json`:
  - `merchant_id`;
  - `order_state`;
  - `sync_days`;
  - `page_size`;
  - `read_only=true`;
  - `api_token_configured=true/false`.

The access key is never returned to frontend responses.

## Setup Flow

1. Merchant opens `/dashboard/integrations`.
2. Merchant opens Kaspi settings.
3. Merchant clicks `Ввести ключ доступа`.
4. Merchant pastes the Kaspi seller access key.
4. ZANI stores the token encrypted.
5. Merchant clicks `Проверить`.
6. Merchant clicks `Загрузить заказы`.
7. ZANI creates `BusinessEvent` records from Kaspi orders.
8. AI analytics can use `kaspi_order_imported` and `kaspi_sale_detected`.

Optional merchant/shop id, order state, sync window and page size are advanced/support settings.

## Local Real Test

1. Start Django with real Kaspi settings:

```bash
DATABASE_URL=sqlite:///db.sqlite3 \
KASPI_ENABLED=True \
KASPI_API_BASE_URL=https://kaspi.kz/shop/api/v2 \
.venv/bin/python manage.py runserver 0.0.0.0:8000
```

2. Configure Kaspi connector in `/dashboard/integrations`.
3. Get the connector id from API/admin or network response.
4. Run:

```bash
CONNECTOR_ID=123 ./scripts/kaspi_local_real_test.sh
```

5. To make a real Kaspi validation request from CLI:

```bash
CONNECTOR_ID=123 VALIDATE=1 ./scripts/kaspi_local_real_test.sh
```

## Smoke Check

Expected successful path:

1. Kaspi connector has `api_token_configured=true`.
2. `kaspi-test-connection` returns `ok=true`.
3. `kaspi-sync-orders` returns `ok=true`.
4. Business events include `kaspi_order_imported`.
5. Completed/accepted orders also create `kaspi_sale_detected`.
6. No write-back action exists in the UI or backend actions.
