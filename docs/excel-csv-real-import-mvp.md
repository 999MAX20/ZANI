# Excel / CSV Real Import MVP

This is the next data onboarding block after the current lightweight integration readiness pass.

## Goal

Give pilot merchants a reliable way to bring real business data into ZANI before direct 1C, MoySklad, Kaspi, POS or marketplace integrations exist.

This is not an ERP replacement. It is a safe data intake layer for:

- clients;
- leads;
- sales/revenue events;
- catalog/services/products.

## Current Foundation

Already available:

- `ImportJob`;
- CSV/XLSX upload;
- preview before confirm;
- import templates;
- sales/catalog normalization into `BusinessEvent`;
- catalog service rows can create/update `Service`;
- upload size gate;
- provider rollout gate:

```bash
.venv/bin/python manage.py provider_rollout_readiness_check --provider excel_csv --fail-on-blockers
```

Current gate is green.

## Implementation Scope

### Backend

- Keep two-step import:
  - upload/preview;
  - confirm.
- Keep import actions tenant-scoped.
- Keep explicit upload limits.
- Add or verify:
  - row-level validation errors;
  - duplicate detection;
  - idempotency by external id or stable row hash;
  - import batch summary;
  - clear failed/partial status.
- Do not silently overwrite critical CRM data without a preview.

### Frontend

- Improve `/dashboard/settings#data-tools` or integrations import area:
  - choose entity type;
  - download template;
  - upload CSV/XLSX;
  - preview rows/errors;
  - confirm import;
  - show result summary.
- Optimize mobile UX:
  - one primary action per step;
  - no dense tables on the first screen;
  - row errors expandable.

### Tests

- Clients import creates clients with tenant isolation.
- Leads import creates leads with valid client/source mapping.
- Sales import creates `sale.recorded` business events.
- Catalog import creates/updates services from `item_type=service`.
- Duplicate rows are handled idempotently.
- Invalid file type/oversized file is rejected.
- Operator without permission cannot import revenue/catalog data.

## Production Gate

Before using for real paid-beta merchant data:

- import templates reviewed for target niches;
- backup/export path exists;
- sample rollback procedure is documented;
- row-level errors are understandable to non-technical users;
- import job audit is visible to owner/support;
- provider rollout gate remains green.

## Non-goals

- No direct 1C/MoySklad sync.
- No marketplace repricing.
- No accounting reconciliation.
- No inventory write-back.
- No automatic destructive merge.

