# Marketplace Integrations: Wildberries, Ozon, Kaspi

This document defines the product and technical direction for ZANI marketplace connectors.

The current target is merchant-owned integrations: the merchant provides credentials from their own seller cabinet, ZANI stores them securely, checks access and syncs marketplace data into the merchant's ZANI workspace.

## Product goal

Marketplace integrations should help a small business owner answer three daily questions:

1. What orders and sales are coming from each marketplace?
2. What products and stocks need attention?
3. Can ZANI safely reserve stock after a messenger/CRM sale so the same item is not oversold elsewhere?

ZANI must not become a heavy ERP or full data warehouse. The integration experience should stay close to:

```text
Choose marketplace -> paste required credentials -> check connection -> select mode -> sync data.
```

## Supported modes

### Mode 1: read-only

Merchant label:

```text
Only read data
```

ZANI can read marketplace data, but cannot change anything in the marketplace account.

Use this mode for:

- orders;
- sales/returns;
- stock snapshots;
- product/catalog snapshots;
- analytics;
- AI recommendations grounded in imported events.

This is the default and safest mode for self-service onboarding.

### Mode 2: inventory write

Merchant label:

```text
Read data and manage stock
```

ZANI can read data and update stock quantities after an approved ZANI reservation/sale.

Allowed actions:

- decrease stock after a confirmed external messenger/CRM sale;
- restore/release stock after cancellation or expired reservation;
- retry stock operation only when the operation is idempotent.

Forbidden actions:

- price updates;
- product/card edits;
- marketplace order acceptance/cancellation unless a later task explicitly adds it;
- direct provider writes from bots, views or frontend components;
- silent write-back after partial failure.

## Provider readiness summary

| Provider | Read-only onboarding | Inventory write | Current product stance |
| --- | --- | --- | --- |
| Wildberries | API token. Current ZANI baseline uses a Statistics token for read-only imports. | Requires stock/warehouse-capable access, warehouse id and product mapping. | Implement after read-only is stable; no price/card/supply writes. |
| Ozon | `Client ID` and `API key` from Ozon Seller API settings. | Requires warehouse id plus product mapping by `offer_id`/`product_id`. | Best first candidate for inventory write MVP. |
| Kaspi | API token from Kaspi seller cabinet. | Treat as pilot/validation until real merchant account confirms safe stock/update semantics. | Keep self-service read-only first; do not promise stock write-back yet. |

## Merchant-facing fields

### Wildberries

Read-only fields:

- `api_token` — label: `API token Wildberries`.
- `entities` — label: `What to sync`; options: orders, sales, returns, stocks, products where supported.
- `sync_days` — label: `Sync period`.

Inventory write fields:

- `warehouse_id` — label: `Wildberries warehouse ID`.
- `product_mapping_mode` — label: `How to match products`; options: internal SKU, barcode, manual mapping.

Notes:

- Read-only setup should request the minimum token category needed for the selected data.
- Stock update requires a token/access category that can work with seller warehouses and stock methods.
- ZANI must not ask for price/card permissions when the merchant only enables stock control.

### Ozon

Read-only fields:

- `client_id` — label: `Ozon Seller Client ID`.
- `api_key` — label: `Ozon Seller API key`.
- `entities` — label: `What to sync`; options: FBS postings, FBO postings, stocks, products.
- `sync_days` — label: `Sync period`.

Inventory write fields:

- `warehouse_id` — label: `Ozon warehouse ID`.
- `product_mapping_mode` — label: `How to match products`; options: `offer_id`, `product_id`, manual mapping.

Notes:

- ZANI should store `client_id` and `api_key` as credentials and return only masked state to the frontend.
- Stock write operations must respect provider throttling and be queued.

### Kaspi

Read-only fields:

- `api_token` — label: `Kaspi Shop API token`.
- `merchant_id` — label: `Merchant/store identifier`; optional/support field unless required by the exact API flow.
- `order_state` — label: `Order state`; common values include `NEW`, `SIGN_REQUIRED`, `PICKUP`, `DELIVERY`, `KASPI_DELIVERY`, `ARCHIVE`.
- `order_status` — label: `Order status`; optional filter.
- `delivery_type` — label: `Delivery type`; optional filter.
- `sync_days` — label: `Sync period`.
- `page_size` — label: `Page size`; default must stay within provider limits.

Inventory write fields:

- keep hidden by default;
- expose only in pilot/support mode after real-account validation.

Notes:

- Kaspi token can expose order and product data, so onboarding copy must warn the merchant to share it only with trusted systems.
- ZANI should not promise stock write-back for Kaspi before a live validation task confirms the exact supported write flow.

## Official source links

- Wildberries API: https://dev.wildberries.ru/
- Wildberries token/API information: https://dev.wildberries.ru/en/docs/openapi/api-information
- Wildberries products and stock-related API section: https://dev.wildberries.ru/en/docs/openapi/work-with-products
- Ozon Seller API docs: https://docs.ozon.ru/api/seller/
- Ozon Seller API start guide: https://seller-edu.ozon.ru/api-ozon/how-to-api
- Ozon stock recommendations: https://dev.ozon.ru/start/299-Rekomendatsii-po-upravleniiu-ostatkami-v-Seller-API/
- Kaspi token guide: https://guide.kaspi.kz/partner/ru/shop/api/general/q3196
- Kaspi API request guide: https://guide.kaspi.kz/partner/ru/shop/api/general/q3197
- Kaspi orders guide: https://guide.kaspi.kz/partner/ru/shop/api/orders/q3201

## Implementation boundaries

- Use `BusinessConnector` as the merchant-facing connection object.
- Use `ConnectorCredential` for provider credentials.
- Store non-secret setup options in `BusinessConnector.config_json`.
- Emit marketplace activity through normalized `BusinessEvent` records.
- Keep provider-specific code behind `apps.integrations.providers` and provider clients.
- Do not let chat bots call marketplace APIs directly.
- Do not expose raw credentials in API responses, logs, frontend state or audit details.
- Do not enable inventory write until idempotency, retries, audit and merchant-visible error states are implemented.
