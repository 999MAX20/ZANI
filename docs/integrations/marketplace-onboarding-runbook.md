# Marketplace Onboarding Runbook

This document defines the merchant onboarding copy and field contract for Wildberries, Ozon and Kaspi setup inside ZANI.

The UI should use plain language. The merchant should not need to understand API architecture, webhooks, queues or provider internals.

## Shared ZANI onboarding flow

1. Merchant opens ZANI.
2. Merchant goes to `Integrations`.
3. Merchant selects marketplace: Wildberries, Ozon or Kaspi.
4. ZANI shows what this integration can do.
5. Merchant selects mode:
   - `Only read data`;
   - `Read data and manage stock`.
6. ZANI shows only fields required for the selected provider and mode.
7. Merchant opens the official seller cabinet in a new tab.
8. Merchant copies the required values.
9. Merchant pastes values into ZANI.
10. Merchant clicks `Check connection`.
11. ZANI validates access.
12. If the check passes, merchant clicks `Save and start sync`.
13. ZANI shows sync status, last successful sync and safe error message if something fails.

## Shared UI blocks for every marketplace card

Each card should contain:

- provider logo/name;
- status badge;
- short benefit;
- mode selector;
- credential fields;
- `Where do I get this?` stepper or accordion;
- official docs links;
- `Check connection`;
- `Save`;
- last sync time;
- last safe error;
- support note when provider access is incomplete.

Do not show raw webhook URLs, stack traces, token payloads or developer-only provider errors in the default merchant path.

## Wildberries onboarding

### Card title

```text
Wildberries
```

### Short description

```text
Import orders, sales and stock data from Wildberries. Later ZANI can update stock after approved external sales.
```

### Read-only mode fields

| UI label | Internal key | Required | Help text |
| --- | --- | --- | --- |
| API token Wildberries | `api_token` | Yes | Token from the Wildberries seller cabinet. Use the minimum access needed for selected data. |
| What to sync | `entities` | Yes | Orders, sales, returns, stocks and products where supported. |
| Sync period | `sync_days` | Yes | How many past days ZANI should import on manual sync. |

### Inventory write fields

| UI label | Internal key | Required | Help text |
| --- | --- | --- | --- |
| Wildberries warehouse ID | `warehouse_id` | Yes | Needed to update seller warehouse stock. |
| Product matching | `product_mapping_mode` | Yes | Choose how ZANI product records match Wildberries products. |

### Simple merchant steps

1. Open Wildberries seller cabinet.
2. Go to API/token settings.
3. Create or copy an API token.
4. For read-only, give only the access needed for statistics/products/stocks.
5. For stock control, make sure the token can work with warehouse stock methods.
6. Copy the token.
7. Paste it into ZANI.
8. If using stock control, add the Wildberries warehouse ID.
9. Click `Check connection`.
10. Save the integration.

### ZANI hints

- Do not request price/card permissions for read-only onboarding.
- Warn that Wildberries data may not always be real-time.
- Show stock-control mode as an advanced capability, not the default.

### Official links

- https://dev.wildberries.ru/
- https://dev.wildberries.ru/en/docs/openapi/api-information
- https://dev.wildberries.ru/en/docs/openapi/work-with-products

## Ozon onboarding

### Card title

```text
Ozon
```

### Short description

```text
Import Ozon orders and stock snapshots. ZANI can later reserve and update stock after approved CRM or messenger sales.
```

### Read-only mode fields

| UI label | Internal key | Required | Help text |
| --- | --- | --- | --- |
| Ozon Seller Client ID | `client_id` | Yes | Client ID from Ozon Seller API settings. |
| Ozon Seller API key | `api_key` | Yes | API key from Ozon Seller API settings. |
| What to sync | `entities` | Yes | FBS postings, FBO postings, stocks and products. |
| Sync period | `sync_days` | Yes | How many past days ZANI should import on manual sync. |

### Inventory write fields

| UI label | Internal key | Required | Help text |
| --- | --- | --- | --- |
| Ozon warehouse ID | `warehouse_id` | Yes | Needed for stock update requests. |
| Product matching | `product_mapping_mode` | Yes | Prefer `offer_id`; allow `product_id` or manual mapping if needed. |

### Simple merchant steps

1. Open Ozon Seller.
2. Open settings.
3. Go to Seller API / API keys.
4. Generate or copy the API key.
5. Copy `Client ID`.
6. Paste `Client ID` into ZANI.
7. Paste `API key` into ZANI.
8. If using stock control, select/add the Ozon warehouse ID.
9. Click `Check connection`.
10. Save the integration.

### ZANI hints

- Show `Client ID` and `API key` as two separate required fields.
- Do not call the mode `full access`.
- For stock control, explain that ZANI updates only quantities, not prices.
- Queue stock writes because Ozon stock operations have provider-side rate limits.

### Official links

- https://docs.ozon.ru/api/seller/
- https://seller-edu.ozon.ru/api-ozon/how-to-api
- https://dev.ozon.ru/start/299-Rekomendatsii-po-upravleniiu-ostatkami-v-Seller-API/

## Kaspi onboarding

### Card title

```text
Kaspi
```

### Short description

```text
Import Kaspi orders into ZANI for analytics, sales visibility and AI context.
```

### Read-only mode fields

| UI label | Internal key | Required | Help text |
| --- | --- | --- | --- |
| Kaspi Shop API token | `api_token` | Yes | Token from Kaspi seller cabinet. Only the company head can generate it. |
| Merchant/store identifier | `merchant_id` | No | Support/advanced field if needed for a specific account flow. |
| Order state | `order_state` | No | Optional filter. Common values: `NEW`, `SIGN_REQUIRED`, `PICKUP`, `DELIVERY`, `KASPI_DELIVERY`, `ARCHIVE`. |
| Order status | `order_status` | No | Optional filter. |
| Delivery type | `delivery_type` | No | Optional filter. |
| Sync period | `sync_days` | Yes | How many past days ZANI should import on manual sync. |
| Page size | `page_size` | Yes | Keep within Kaspi API limits. |

### Inventory write fields

Do not expose by default.

Use support/pilot mode only after real merchant validation confirms the exact safe inventory/update behavior available through Kaspi.

### Simple merchant steps

1. Open the web version of Kaspi seller cabinet.
2. Log in with the phone number used in Kaspi Pay.
3. Go to `Settings -> API token`.
4. Click `Generate`.
5. Copy the token.
6. Paste it into ZANI.
7. Click `Check connection`.
8. Save the integration.

### ZANI hints

- Clearly warn that anyone with this token may be able to access seller data.
- Keep read-only as the default.
- Do not promise stock write-back until live validation is complete.

### Official links

- https://guide.kaspi.kz/partner/ru/shop/api/general/q3196
- https://guide.kaspi.kz/partner/ru/shop/api/general/q3197
- https://guide.kaspi.kz/partner/ru/shop/api/orders/q3201

## Validation messages

Use merchant-safe results:

- `Connection works. ZANI can read selected data.`
- `Connection works, but stock control is not available with this access.`
- `Token is invalid or expired. Create a new token in the seller cabinet.`
- `Warehouse is missing. Add a warehouse ID to enable stock control.`
- `Provider is temporarily unavailable. Try again later.`

Do not expose raw provider payloads, tracebacks, API keys or token fragments.
