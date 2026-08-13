# MoySklad merchant connector

## Current production baseline

The connector is read-only and merchant-scoped.

Merchant flow:

1. Open `Dashboard -> Integrations -> МойСклад`.
2. Click `Ввести ключ доступа`.
3. Paste a MoySklad access key.
3. Click `Сохранить доступ`.
4. Click `Проверить`.
5. Click `Загрузить данные`.

ZANI stores the token in `ConnectorCredential(key="access_token")`; the token is not returned to the frontend.
This is the current self-service baseline. The long-term target is MoySklad app/install authorization without manual key copy.

## Data imported

- `products` -> `moysklad_product_imported`
- `stock` -> `moysklad_stock_imported`
- `sales` -> `moysklad_sale_imported`
- `clients` -> `moysklad_client_imported`

All payloads include `read_only=true`. The connector does not create, update or delete MoySklad records.

## Environment

```env
MOYSKLAD_ENABLED=false
MOYSKLAD_API_BASE_URL=https://api.moysklad.ru/api/remap/1.2
```

Use `MOYSKLAD_ENABLED=true` only when a real token is saved for the merchant connector.

## Local real test

1. Save a real access key in the integration modal.
2. Find the connector id in API/admin.
3. Run:

```bash
CONNECTOR_ID=<id> VALIDATE=1 scripts/moysklad_local_real_test.sh
```

Then use the UI button `Загрузить данные` or call:

```http
POST /api/business-connectors/{id}/moysklad-sync/
```

## Long-term authorization path

The current baseline uses a merchant-created access key because it is the fastest path to real production data without storing a merchant password.

For a mass-market UX, replace token input with a MoySklad application/install flow:

- register ZANI as a MoySklad app/solution;
- receive merchant installation authorization;
- store per-merchant credentials in `ConnectorCredential`;
- keep the existing sync and normalization layer unchanged.
