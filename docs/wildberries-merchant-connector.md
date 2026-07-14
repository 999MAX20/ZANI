# Wildberries Merchant Connector

## Purpose

Wildberries is a per-merchant read-only marketplace connector. ZANI uses the merchant's Wildberries Statistics token to import orders, sales/returns and optional stock snapshots into `BusinessEvent` records for dashboard analytics and AI recommendations.

## Current Scope

Implemented as read-only:

- import orders from Wildberries Statistics API;
- import sales and returns from Wildberries Statistics API;
- optional stock import while WB still supports the statistics stock endpoint;
- normalize `wildberries_order_imported`, `wildberries_sale_imported`, `wildberries_return_detected`, `wildberries_stock_imported`;
- no price updates;
- no card/product editing;
- no supply management;
- no order acceptance/cancellation.

Wildberries reports for orders and sales are updated by WB about every 30 minutes, so ZANI should not promise true 30-second marketplace sync for this provider.

## Environment

Required for real Wildberries API calls:

```env
WILDBERRIES_ENABLED=True
WILDBERRIES_STATISTICS_API_BASE_URL=https://statistics-api.wildberries.ru
```

When `WILDBERRIES_ENABLED=False`, credentials can be saved and sync runs create safe mock events.

## Merchant Credentials

Stored per connector:

- encrypted `ConnectorCredential(key=api_token)`;
- safe `BusinessConnector.config_json`:
  - `entities`;
  - `sync_days`;
  - `read_only=true`;
  - `api_token_configured=true/false`.

The token is never returned to frontend responses.

## Setup Flow

1. Merchant opens `/dashboard/integrations`.
2. Merchant opens Wildberries.
3. Merchant clicks `Ввести ключ доступа`.
4. Merchant pastes a Wildberries token with Statistics access.
5. ZANI stores the token encrypted.
6. Merchant clicks `Проверить`.
7. Merchant clicks `Загрузить данные`.
8. ZANI creates `BusinessEvent` records from Wildberries orders/sales/returns/stocks.

## Local Real Test

1. Start Django with real Wildberries settings:

```bash
DATABASE_URL=sqlite:///db.sqlite3 \
WILDBERRIES_ENABLED=True \
WILDBERRIES_STATISTICS_API_BASE_URL=https://statistics-api.wildberries.ru \
.venv/bin/python manage.py runserver 0.0.0.0:8000
```

2. Configure Wildberries connector in `/dashboard/integrations`.
3. Get the connector id from API/admin/network response.
4. Run:

```bash
CONNECTOR_ID=123 ./scripts/wildberries_local_real_test.sh
```

5. To make a real Wildberries validation request from CLI:

```bash
CONNECTOR_ID=123 VALIDATE=1 ./scripts/wildberries_local_real_test.sh
```

## Smoke Check

Expected successful path:

1. Wildberries connector has `api_token_configured=true`.
2. `wildberries-test-connection` returns `ok=true`.
3. `wildberries-sync` returns `ok=true`.
4. Business events include `wildberries_order_imported`.
5. Sales/returns create `wildberries_sale_imported` or `wildberries_return_detected`.
6. No write-back action exists in the UI or backend actions.
