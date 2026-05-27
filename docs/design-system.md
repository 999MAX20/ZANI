# ZANI Design System Notes

Last updated: 2026-05-27

## Product UI Principle

Every primary page must be a focused business tool, not a collection of decorative blocks. UI should help the user complete the current workflow quickly: qualify a lead, process an inbox conversation, move a deal, inspect integration health, or confirm an AI recommendation.

## Color System

### Base

- Page background: neutral slate/blue-tinted white.
- Surfaces: white cards with subtle slate border.
- Text: `ink` / `midnight`.
- Borders: `slate-100` and `slate-200`.

Use base colors for most of the interface.

### Primary CRM

- Main CTA and active critical controls: `midnight`.
- Selected rows/tabs/focus accents: `brand` blue.
- Links and subtle active highlights: `brand-600` / `brand-700`.

Do not use bright blue as a full-page theme. It should mark action and selection.

### AI

- AI actions only: `ai` violet/indigo.
- AI buttons, AI draft, AI analyst hints: `ai-50`, `ai-600`, `bg-ai-gradient`.
- AI colors should not be used for ordinary CRM actions.

### Status

- Success: emerald.
- Attention/waiting: amber.
- Error/lost/failed: red.
- Neutral/inactive: slate.

Status colors should communicate state, not decorate layout.

## Forms

- Forms live inside white cards with subtle border and shadow.
- Modals use a white frame and light slate body.
- Select controls use the custom `Select` component, not native visible browser select menus.
- Keep labels short and use bold text for scanability.

## Filters

- Primary filters should be segmented buttons or custom `Select`.
- Avoid native browser dropdown visuals.
- Advanced filters should be hidden behind a compact control unless they are part of the core workflow.

## Global Navigation

- Keep rare system controls out of the main sidebar.
- Language selector belongs in the top header on desktop because it is not a daily workflow action.
- Sidebar is for business navigation only: dashboard, leads, deals, conversations, integrations, AI, settings, and secondary operations.
- Desktop sidebar uses grouped sections with collapsible bodies: workspace, operations, intelligence, reports, and system settings.
- The intelligence section should stay short: connections and AI Analyst. Bot/channel setup belongs inside connections; AI agent profiles and automation rules belong in settings/system surfaces.
- Mobile drawer should use a white surface with a dimmed page overlay. Avoid grey drawer backgrounds because they read as disabled UI and reduce contrast.

## Page Layout

- Main work screens should usually use a two-pane layout:
  - left: queue/list/filter;
  - right: selected object and actions.
- Avoid hero blocks on operational CRM screens.
- Avoid nested cards unless the inner card is a real repeated item or modal/form section.
