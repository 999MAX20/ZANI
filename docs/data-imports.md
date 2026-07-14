# Data imports for pilot

Stage 5 adds a small, safe data-ingestion layer for pilot merchants that do not have direct 1C, MoySklad, Kaspi or ERP integrations yet.

## Supported sources

Merchants can upload CSV/XLSX files for:

- `clients` — CRM client base;
- `leads` — incoming requests and lead history;
- `sales` — revenue/order events;
- `catalog` — services and product/stock rows.

The flow is intentionally two-step:

1. Upload file and get a preview.
2. Confirm import only after mapping and row errors are visible.

## Endpoints

```http
POST /api/import-jobs/
POST /api/import-jobs/{id}/confirm/
GET /api/import-templates/clients/
GET /api/import-templates/leads/
GET /api/import-templates/sales/
GET /api/import-templates/catalog/
POST /api/data/sales/
POST /api/data/catalog-items/
```

`sales` and `catalog` imports are normalized into `BusinessEvent`.
Every confirmed import also updates the support-visible `Excel / CSV` `BusinessConnector` and writes a `ConnectorSyncRun`, so support can see the last import status, filename and summary.

Catalog rows with `item_type=service` also create or update CRM `Service` records.
Product rows are stored as catalog events for the future inventory module.

## Production limits

- File types: `.csv`, `.xlsx`.
- Default max file size: `MAX_UPLOAD_SIZE_MB=10`.
- Default max rows per file: `IMPORT_MAX_ROWS=5000`.
- Default preview rows: `IMPORT_PREVIEW_ROWS=10`.
- Empty files and files with headers but no data rows are rejected before confirmation.
- Import is idempotent where a stable identity exists: clients by phone/email, leads by client/message, sales by external id or event payload, catalog by SKU/event payload.

## Sales CSV headers

```csv
external_id,occurred_at,client_name,phone,item_name,quantity,amount,source,notes
sale-001,2026-05-22T10:00:00+05:00,Алия Иванова,+77015550101,Консультация,1,15000,manual,Оплачено
```

Required:

- `amount`

Recommended:

- `external_id`
- `occurred_at`
- `client_name`
- `phone`
- `item_name`

## Catalog CSV headers

```csv
item_type,sku,name,description,duration_minutes,price_from,stock_quantity,source
service,CONSULT-30,Консультация,Первичная консультация,30,15000,,manual
```

Required:

- `name`

Supported `item_type` values:

- `service`
- `product`

## Dashboard behavior

Owner dashboard revenue uses:

- completed appointments with service prices;
- `sale.recorded` business events from manual sales and sales imports.

If no sales events exist, dashboard returns a `data_quality` recommendation instead of inventing analytics.

## Permissions

Imports and manual data entry are protected by merchant RBAC.

For pilot, sales/catalog data entry uses `integrations.manage`, so owners/admins can operate it and operators cannot silently alter business numbers.
