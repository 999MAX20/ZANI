<!-- ZANI_ARCHIVE_HEADER_BEGIN -->
> ARCHIVED 2026-09-14 · HISTORICAL_DELIVERY
>
> Original path: `docs/pilot/block12-platform-operations-panel.md`. Source: `4ba3cbf9fddcc6e1baa172b494c781550c090693`.
> Исторический отчёт delivery-блока. Его проверки относятся только к исходному снимку; оставшиеся live/policy gates не закрываются архивацией.
> Historical evidence only; not an implementation queue or current release approval.
> Original relative references below are preserved as historical text; resolve them against the original path.
<!-- ZANI_ARCHIVE_HEADER_END -->

# Block 12 — Pilot Operations / Internal Control Panel

Purpose: give the internal ZANI team a clearer pilot operations view before scaling landing-based onboarding.

This block does **not** add billing, payment, external WhatsApp/Instagram APIs, or marketplace integrations. It only improves internal visibility for the first pilots.

## Backend

`GET /api/platform/overview/` now includes `operations_summary`:

- `total_monitored`
- `attention_merchants`
- `risk_merchants`
- `no_sales_data_merchants`
- `form_error_merchants`
- `handoff_conversations`
- `new_leads_30d`
- `form_errors_30d`
- `failed_connectors`

`GET /api/platform/merchants/` now includes per-merchant:

- `operations` — lead/client/task/inbox/connector/form-error counts
- `health` — score, status, blockers, next_action
- `latest_activity_at`

## Frontend

Platform overview now shows pilot operations cards:

- merchants needing attention
- form errors in the last 30 days
- conversations requiring handoff
- new leads in the last 30 days

Platform merchants table now shows:

- pilot health score/status
- next action
- blockers
- operational counts
- latest activity

## Pilot value

The internal team can now see which merchants need action before support becomes chaotic:

- no sales data uploaded
- failed/expired connectors
- landing form errors
- inbox handoff waiting
- new lead load

## Tests

Run:

```bash
python manage.py check
python manage.py test apps.core.tests_platform_operations -v 2 --keepdb
cd frontend && npm run build
```
