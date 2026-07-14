# Deals Changelog

## 2026-06-08

- Split `DealsPage.tsx` from a single large component into a 125-line orchestrator plus modular components, hooks, types and utilities.
- Added compact AI priority banner with one-hour `localStorage` dismissal.
- Replaced large KPI cards and decorative SVG charts with five compact metric cards.
- Added two-level filters, quick chips, stage chips, URL persistence, `localStorage` persistence and reset.
- Added toolbar with list/kanban/table view modes, sorting controls and bulk action state.
- Added grouped list view, kanban columns, table view, empty state, quick actions and basic drag-and-drop stage changes.
- Added tabbed detail panel for overview, activities and history.
- Added Excel export using `write-excel-file/browser`.
- Added keyboard shortcuts and bulk delete confirmation.
