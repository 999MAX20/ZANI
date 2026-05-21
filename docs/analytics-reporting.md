# Analytics / Reporting Depth

Phase 9 adds a lightweight reporting layer for owners without turning daily CRM into a heavy BI product.

## Backend

New models:

- `ReportWidget`;
- `ScheduledReport`.

New APIs:

```text
GET /api/analytics/reports/summary/
GET /api/analytics/reports/export/?report=source_roi
GET /api/report-widgets/
GET /api/scheduled-reports/
```

Supported export reports:

- `source_roi`;
- `funnel_velocity`;
- `manager_performance`;
- `retention_ltv`.

## Report Summary

`GET /api/analytics/reports/summary/?business=` returns:

- configured reporting widgets;
- source ROI table;
- funnel velocity foundation;
- manager performance table;
- retention and LTV estimates.

The numbers are intentionally operational:

- leads by source;
- appointment conversion;
- completed appointment revenue estimate;
- deal stage counts;
- repeat clients;
- simple LTV estimate from completed appointments.

## Scheduled Reports

`ScheduledReport` stores:

- frequency;
- recipients;
- report config;
- next/last run timestamps;
- creator.

Email delivery is not executed in this phase. It will be wired through the notification/queue layer when production email is selected.

## Permissions

Reports use the existing business access and `analytics.view` permission.

Exports write audit logs with:

```text
kind=export
entity_type=analytics_report
```

## Frontend

`/dashboard/analytics` now shows:

- source ROI;
- repeat rate;
- LTV estimate;
- open/won/lost deals;
- funnel stage table;
- scheduled report list;
- CSV export actions.

## Current Limitations

- Source ROI does not include ad spend yet, so ROI is marked as `tracked_without_cost`.
- Funnel velocity uses the current stage timestamp; full historical velocity needs stage history snapshots.
- Scheduled reports store configuration but do not send email yet.

These limitations are deliberate so the product stays fast and understandable while the data model matures.
