# ZANI Design System Notes

Last updated: 2026-07-16

## Product UI Principle

Every primary page must be a focused business tool, not a collection of decorative blocks. UI should help the user complete the current workflow quickly: qualify a lead, process an inbox conversation, move a deal, inspect integration health, or confirm an AI recommendation.

The authenticated product must feel like a direct continuation of the public ZANI experience. The shared visual language is `warm editorial business software`: Geist typography, a subtle technical grid, graphite text, warm white surfaces and one orange brand accent. CRM density stays operational; landing-style decorative sections do not move into the cabinet.

## Color System

### Base

- Page background: theme token `--zani-theme-page-bg`, using the warm grid surface from the landing.
- Surfaces: theme token `--zani-theme-panel-bg`.
- Text: theme token `--zani-theme-text`.
- Muted text: `--zani-theme-muted` and `--zani-theme-muted-soft`.
- Borders: `--zani-theme-panel-border` and `--zani-theme-soft-border`.

Use base colors for most of the interface.

Light and dark themes must share the same layout, dimensions, radius, spacing, hierarchy and interaction model. A theme switch may only change color tokens: background, surface, text, borders and accent colors. Do not create a separate dark-only composition or a light-only component shape.

### Primary CRM and brand

- Main CTA and active critical controls: ZANI orange (`brand-500` / `brand-600`).
- Selected rows, tabs and focus accents: orange soft surface plus a restrained orange edge.
- Graphite (`midnight`) is used for hierarchy, text and strong neutral controls.

Blue and violet are no longer product-wide identity colors. Keep them only when a real domain/status meaning requires them.

### AI

- AI uses the same orange/rust family with a spark/icon label, not a separate purple-blue universe.
- AI modules keep the same surface geometry as CRM modules.
- Differentiate AI through copy, iconography and context; do not introduce generic AI gradients.

### Retired product accents

- Purple-blue AI gradients and pink navigation glows are retired from the authenticated product.
- Do not reintroduce them as generic decoration.

### Status

- Success: emerald.
- Attention/waiting: amber.
- Error/lost/failed: red.
- Neutral/inactive: slate.

Status colors should communicate state, not decorate layout.

## Forms

- Forms live inside tokenized surfaces with subtle border and shadow.
- Modals use tokenized frame/body surfaces and keep the same geometry in light and dark themes.
- Select controls use the custom `Select` component, not native visible browser select menus.
- Keep labels short and use bold text for scanability.

## Filters

- Primary filters should be segmented buttons or custom `Select`.
- Use `frontend/src/components/ui/FilterBar.tsx` for horizontal status/category filters.
- Avoid native browser dropdown visuals.
- Advanced filters should be hidden behind a compact control unless they are part of the core workflow.

## Metrics

- Use `frontend/src/components/ui/MetricCard.tsx` for compact KPI/status summaries.
- Metric cards should use the shared surface rhythm: `18px` card radius, tokenized panel background, tokenized border and the same dimensions in light and dark themes.
- Use colored icon wells to communicate category or state, not to decorate the whole card.
- Use `compact` only inside dense dashboards or narrow side panels.

## Dashboard Reference

The owner dashboard (`/app`) is the current visual reference for authenticated CRM screens.

Use these patterns when reforming the next pages:

- **Dashboard card:** `18px` radius, tokenized panel surface, subtle border, same shadow and geometry in both themes.
- **KPI card:** stable height, icon well, trend chip, value hierarchy; no page-specific decorative card variants.
- **Revenue/analytics card:** one large data card can use the same surface plus a subtle tokenized background glow. The chart must remain readable in both themes.
- **Row card:** action rows use compact row surfaces, `12px` radius, stable height and a clear right-side action/status area.
- **AI block:** AI modules use the same card structure as other panels. AI identity comes from icon/accent color, not a different layout.
- **Sidebar active item:** active navigation is a pill-like item using theme tokens. Do not return to hard left-border-only active states.
- **Theme parity:** light uses warm white/grid surfaces; dark uses graphite surfaces with the same orange accent. Card widths, heights, radii and row heights must match.

Recommended CSS hooks for page-level alignment:

```text
zani-dashboard-page
zani-dashboard-metric
zani-revenue-card
zani-ai-summary-card
zani-attention-row
zani-lead-row
zani-dashboard-panel
zani-new-leads-card
zani-mini-stat
```

Do not add marketing-style explanatory blocks inside authenticated pages. Every block must be a KPI, list, action, form, table, chart, integration status, alert, empty state or real AI recommendation.

## Global Navigation

- Keep rare system controls out of the main sidebar.
- Language selector belongs in the top header on desktop because it is not a daily workflow action.
- Sidebar is for business navigation only: dashboard, leads, deals, conversations, integrations, AI, settings, and secondary operations.
- Desktop sidebar uses grouped sections with collapsible bodies: workspace, operations, intelligence, reports, and system settings.
- The intelligence section should stay short: connections and AI Analyst. Bot/channel setup belongs inside connections; AI agent profiles and automation rules belong in settings/system surfaces.
- Mobile drawer should use the same tokenized surface system with a dimmed page overlay. Avoid grey drawer backgrounds because they read as disabled UI and reduce contrast.

## Page Layout

- Main work screens should usually use a two-pane layout:
  - left: queue/list/filter;
  - right: selected object and actions.
- Avoid hero blocks on operational CRM screens.
- Avoid nested cards unless the inner card is a real repeated item or modal/form section.

## Shared UI Helpers

- Use `Surface` from `frontend/src/components/ui/Card.tsx` for standard tokenized CRM surfaces.
- Use exported surface class helpers from `Card.tsx` when a low-level wrapper must own the element markup, for example table shells.
- Table shells should use `CrmTableSurface`, `CrmDataTable`, or `DataTable` before adding page-local card wrappers.
