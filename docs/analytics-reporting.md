# Analytics / Reporting Depth

Phase 9 added a lightweight reporting layer for owners without turning daily CRM into a heavy BI product.

Phase 12 adds a shared CRM operational metrics layer for owner dashboard and reports.

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

Shared metric service:

```text
apps/analytics/crm_metrics.py
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
- `crm_funnel`;
- scoped `manager_performance`;
- connector health metrics;
- AI insight cards grounded in CRM metric keys and source entity ids.

The numbers are intentionally operational:

- leads by source;
- leads by status;
- appointment conversion;
- lead-to-deal conversion;
- won/lost deal value;
- appointment completion/no-show rates;
- overdue task count;
- unanswered conversation count from the inbox/work queue source;
- completed appointment revenue estimate;
- deal stage counts;
- repeat clients;
- simple LTV estimate from completed appointments.

## CRM Funnel Contract

`crm_funnel` is read-only and includes:

- `lead_counts.total`, `lead_counts.by_source`, `lead_counts.by_status`;
- `conversion_to_deal.leads_total`, `conversion_to_deal.deals_from_leads`, `conversion_to_deal.rate`;
- `deal_outcomes.open_count`, `won_count`, `lost_count`, `open_value`, `won_value`, `lost_value`;
- `appointments.total`, `completed`, `no_show`, `completion_rate`, `no_show_rate`;
- `tasks.open`, `tasks.overdue`;
- `conversations.unanswered`, `unread`, `handoff_required`, `unread_sla_overdue`, `handoff_sla_overdue`.

The unanswered conversation metric uses the same inbox/work queue source as manager dashboards and AI recommendations.

## AI Insight Cards

`ai_insight_cards` are deterministic and source-grounded. Each card returns:

- `key`;
- `severity`;
- `metric_value`;
- `source_metric_keys`;
- `source_ids`;
- `href`;
- `no_data`.

Cards cite CRM entities with lightweight ids such as `TASK:1`, `CONV:2`, `CONNECTOR:3`, `APPT:4` or `LEAD:5`. If there is no operational data, the API returns an explicit no-data card instead of inventing analysis.

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

Phase 12 report/dashboard metrics also apply backend resource scoping for leads, deals, appointments, tasks and conversations. Manager performance uses a scoped member list:

- owner/admin/platform: business;
- team lead: team;
- manager/marketer/accountant: own;
- unsupported roles: none.

Exports write audit logs with:

```text
kind=export
entity_type=analytics_report
```

## Frontend

`/dashboard/analytics` now shows:

- source ROI;
- lead-to-deal conversion;
- won value;
- unanswered conversations;
- no-show rate;
- connector errors;
- source-grounded AI metric cards;
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
