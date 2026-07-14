# Kaspi Pricing Agent

## Product Scope

Kaspi Pricing Agent is a separate ZANI product surface, not a simple connector setting.

It manages per-product pricing rules:

- current merchant price;
- minimum allowed price;
- step below competitor, default `1`;
- operating mode: recommendation, approval or autopilot;
- daily change limit;
- recommendation and change logs.

The MVP algorithm is intentionally simple and auditable:

```text
target_price = competitor_price - step

if target_price < min_price:
  target_price = min_price

if current_price <= min_price and competitor_price - step < min_price:
  block
```

## Ecosystem Position

This product is designed as the first marketplace pricing adapter in ZANI:

- `apps.pricing` owns rules, recommendations and price change logs;
- Kaspi is the first provider-specific implementation;
- the same product surface can later support Ozon and Wildberries by adding provider adapters;
- permissions use the existing ZANI `integrations` resource;
- all decisions are tenant-scoped by `Business`;
- every apply attempt is auditable before any provider write-back is introduced.

## Competitor Monitoring

Production pricing must not depend on merchant-entered competitor prices.

The provider abstraction is:

```text
CompetitorPriceProvider.fetch_offers(rule) -> offers
```

Current providers:

- `mock`: local safe provider for development and demos;
- `external_api`: calls `KASPI_COMPETITOR_MONITOR_API_URL` and expects `offers` with competitor name, price and position.

Environment:

```env
KASPI_REPRICING_ENABLED=False
KASPI_REPRICING_WRITE_ENABLED=False
KASPI_REPRICING_SCHEDULE_ENABLED=False
KASPI_REPRICING_INTERVAL_SECONDS=1800
KASPI_REPRICING_APPLY_AUTOPILOT=False
KASPI_PRICE_WRITE_PROVIDER=price_feed
KASPI_PRICE_WRITE_API_URL=
KASPI_PRICE_WRITE_API_KEY=
KASPI_COMPETITOR_MONITOR_PROVIDER=mock
KASPI_COMPETITOR_MONITOR_API_URL=
KASPI_COMPETITOR_MONITOR_API_KEY=
```

Collect offers:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py kaspi_collect_competitor_offers
```

## Safety Model

Default behavior is safe:

- `KASPI_REPRICING_ENABLED=False`;
- `KASPI_REPRICING_WRITE_ENABLED=False`;
- applying a recommendation creates a simulated change log;
- real Kaspi write-back is not performed unless explicitly enabled later;
- every decision is stored in `KaspiPricingRecommendation`;
- every apply attempt is stored in `KaspiPriceChangeLog`.
- autopilot cannot be enabled by saving `mode=autopilot` directly;
- autopilot requires the dedicated safety confirmation action;
- enabling autopilot requires a minimum price, daily limit and at least one collected competitor offer.
- merchant-level emergency stop blocks every price apply attempt;
- blocked changes and provider failures create pricing alerts and system notifications.

## Write-Back

Direct Kaspi price write-back remains behind a provider adapter.

Current adapters:

- `price_feed`: queues the change for a future Kaspi price feed/XML export path;
- `external_api`: sends a signed POST request to `KASPI_PRICE_WRITE_API_URL`;
- `disabled`: fails closed.

The public Kaspi seller API information available during implementation did not confirm a stable direct price-update endpoint. Most production repricing products appear to use price feed/XML or partner/private mechanisms. ZANI therefore keeps real write-back disabled until the approved production mechanism is selected and tested.

## API

Catalog:

```http
GET /api/pricing/kaspi/catalog/
POST /api/pricing/kaspi/catalog/sync/
POST /api/pricing/kaspi/catalog/{id}/create-rule/
POST /api/pricing/kaspi/catalog/bulk-create-rules/
```

`catalog/sync` builds pricing-ready product candidates from normalized `BusinessEvent` facts produced by integrations:

- Excel / CSV catalog imports;
- Kaspi product activity;
- МойСклад products and stock;
- 1C products and stock;
- Ozon stock;
- Wildberries stock.

Catalog supports server-side filters:

```text
search=name-or-sku
source=excel_csv|kaspi|moysklad|...
rule_state=missing|connected
```

Rules:

```http
POST /api/pricing/kaspi/rules/
GET /api/pricing/kaspi/rules/
POST /api/pricing/kaspi/rules/{id}/recommend/
POST /api/pricing/kaspi/rules/{id}/collect-offers/
POST /api/pricing/kaspi/rules/{id}/enable-autopilot/
POST /api/pricing/kaspi/rules/{id}/disable-autopilot/
POST /api/pricing/kaspi/rules/bulk-update/
```

Control and alerts:

```http
GET /api/pricing/kaspi/control/current/?business={id}
POST /api/pricing/kaspi/control/emergency-stop/
POST /api/pricing/kaspi/control/resume/
GET /api/pricing/kaspi/alerts/
POST /api/pricing/kaspi/alerts/{id}/resolve/
```

Recommendations:

```http
GET /api/pricing/kaspi/recommendations/
POST /api/pricing/kaspi/recommendations/{id}/apply/
```

Logs:

```http
GET /api/pricing/kaspi/change-logs/
```

Change logs support server-side filters:

```text
status=simulated|queued|applied|blocked|failed
search=name-or-sku
rule={id}
```

## Pricing Cycle

Manual cycle:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py kaspi_pricing_cycle
```

Autopilot cycle:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py kaspi_pricing_cycle --apply-autopilot
```

The shell wrapper is:

```bash
scripts/kaspi_pricing_cycle.sh
APPLY_AUTOPILOT=1 scripts/kaspi_pricing_cycle.sh
```

Production scheduler:

```text
KASPI_REPRICING_ENABLED=True
KASPI_REPRICING_SCHEDULE_ENABLED=True
KASPI_REPRICING_INTERVAL_SECONDS=1800
KASPI_REPRICING_APPLY_AUTOPILOT=False
```

With these values, Celery beat queues `pricing.run_kaspi_pricing_cycle` every 30 minutes.

Keep `KASPI_REPRICING_APPLY_AUTOPILOT=False` for the first live stage. In that mode ZANI collects competitor prices and creates recommendations on schedule, but does not auto-apply them. After a controlled pilot, set it to `True` only for merchants/products where autopilot was explicitly confirmed in the UI.

Readiness:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py kaspi_pricing_readiness_check
```

## Safe Local Real Test

This test uses real merchant rules and competitor prices, but does not write prices back to Kaspi.

1. Open `/dashboard/pricing`.
2. Create a rule:
   - SKU;
   - current price;
   - minimum allowed price;
   - step `1`;
   - mode `approval`.
3. Click `Собрать цены`.
4. Click `Рассчитать`.
5. Optionally click `Применить`; with write-back disabled this creates a simulated change log.
6. To test autopilot, enable it from the safety block after a competitor price was collected.
7. Run readiness:

```bash
scripts/kaspi_pricing_local_real_test.sh
```

8. Run one cycle:

```bash
RUN_CYCLE=1 scripts/kaspi_pricing_local_real_test.sh
```

9. Run one autopilot cycle, still safe/simulated unless write-back flags are enabled:

```bash
RUN_CYCLE=1 APPLY_AUTOPILOT=1 scripts/kaspi_pricing_local_real_test.sh
```

## Frontend

Merchant UI:

```text
/dashboard/pricing
/dashboard/integrations -> Kaspi Pricing
```

The first screen supports:

- importing product candidates from connected data sources;
- creating pricing rules from those candidates with only a minimum threshold;
- selecting multiple products and creating rules in bulk;
- searching and filtering catalog items by source and rule status;
- creating a pricing rule;
- collecting competitor prices automatically;
- entering competitor price only as a fallback;
- calculating `competitor - 1`;
- applying recommendation in simulated/approval mode.
- enabling/disabling autopilot through a safety block.
- stopping/resuming the whole pricing agent through emergency stop.
- selecting multiple pricing rules and bulk updating status, threshold, step, daily limit or disabling autopilot.
- viewing price change history with status and SKU/name filters.
- opening a separate Kaspi Pricing integration window, distinct from the regular Kaspi data connector.

## Future Production Steps

Before enabling real automatic Kaspi write-back:

1. Confirm the official/partner-supported mechanism for price updates.
2. Add provider write adapter behind `KASPI_REPRICING_WRITE_ENABLED`.
3. Add product catalog synchronization from Kaspi or merchant source.
4. Add competitor price collection through an approved data source.
5. Add platform support view for all price changes.
6. Add frequent-change anomaly detection across categories and merchants.
