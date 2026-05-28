# Ozon Merchant Connector

## Purpose

Ozon is a per-merchant read-only marketplace connector. ZANI uses the merchant's Ozon Seller `Client-Id` and `API key` to import FBS/FBO postings and stock snapshots into `BusinessEvent` records for dashboard analytics and AI recommendations.

## Current Scope

Implemented as read-only:

- import FBS postings;
- import FBO postings;
- import product stock snapshots;
- normalize `ozon_fbs_posting_imported`, `ozon_fbo_posting_imported`, `ozon_cancelled_detected`, `ozon_stock_imported`;
- no price updates;
- no stock updates;
- no product/card editing;
- no order assembly, shipping or cancellation.

## Environment

Required for real Ozon Seller API calls:

```env
OZON_ENABLED=True
OZON_SELLER_API_BASE_URL=https://api-seller.ozon.ru
```

When `OZON_ENABLED=False`, credentials can be saved and sync runs create safe mock events.

## Merchant Credentials

Stored per connector:

- encrypted `ConnectorCredential(key=client_id)`;
- encrypted `ConnectorCredential(key=api_key)`;
- safe `BusinessConnector.config_json`:
  - `entities`;
  - `sync_days`;
  - `limit`;
  - `read_only=true`;
  - `client_id_configured=true/false`;
  - `api_key_configured=true/false`.

The credentials are never returned to frontend responses.

## Setup Flow

1. Merchant opens `/dashboard/integrations`.
2. Merchant opens Ozon.
3. Merchant clicks `Ввести доступ`.
4. Merchant pastes `Client-Id` and `API key` from Ozon Seller settings.
5. ZANI stores credentials encrypted.
6. Merchant clicks `Проверить`.
7. Merchant clicks `Загрузить данные`.
8. ZANI creates `BusinessEvent` records from Ozon postings and stocks.

## Local Real Test

1. Start Django with real Ozon settings:

```bash
DATABASE_URL=sqlite:///db.sqlite3 \
OZON_ENABLED=True \
OZON_SELLER_API_BASE_URL=https://api-seller.ozon.ru \
.venv/bin/python manage.py runserver 0.0.0.0:8000
```

2. Configure Ozon connector in `/dashboard/integrations`.
3. Get the connector id from API/admin/network response.
4. Run:

```bash
CONNECTOR_ID=123 ./scripts/ozon_local_real_test.sh
```

5. To make a real Ozon validation request from CLI:

```bash
CONNECTOR_ID=123 VALIDATE=1 ./scripts/ozon_local_real_test.sh
```

## Smoke Check

Expected successful path:

1. Ozon connector has `client_id_configured=true` and `api_key_configured=true`.
2. `ozon-test-connection` returns `ok=true`.
3. `ozon-sync` returns `ok=true`.
4. Business events include `ozon_fbs_posting_imported` or `ozon_fbo_posting_imported`.
5. Stock sync creates `ozon_stock_imported`.
6. No write-back action exists in the UI or backend actions.
