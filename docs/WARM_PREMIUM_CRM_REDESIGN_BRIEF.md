# Warm Premium CRM Redesign Brief

Date: 2026-07-16

Status: decision documented, implementation postponed.

This document records the agreed ZANI authenticated-app redesign direction. It is a planning and alignment brief for future redesign work. Do not start the implementation from this document alone; begin only when the active parallel tasks are finished and the user explicitly starts the redesign phase.

## Decision Summary

ZANI should move toward a warm, premium, calm CRM interface:

```txt
Warm Premium CRM
Warm ivory workspace + saturated orange actions + plum AI accent
```

The generated Settings / Team and Access concept was accepted as the target feeling:

- mostly white and warm-white work surfaces;
- calm app shell;
- saturated orange only for meaningful actions and active states;
- no blue-tinted layout background;
- no background noise from several nested color planes;
- clean, expensive SaaS typography and spacing;
- each page can have different CRM content, but must share the same visual language.

## Scope

In scope:

- authenticated CRM app;
- sidebar, header, app shell;
- settings, dashboard, conversations, leads, calendar, tasks, analytics, integrations, drawers, modals, tables, forms;
- light theme and later dark theme;
- shared frontend design tokens and shared UI primitives.

Out of scope for now:

- public landing page;
- marketing hero pages;
- brand campaign pages;
- full custom per-user theme editor;
- changing CRM business logic while doing visual cleanup.

## Product Feeling

The interface should feel:

- premium, calm, and trustworthy;
- easy to work in for hours;
- intuitive for SMB owners, managers, operators, and clinic staff;
- operational rather than decorative;
- warm and human, not cold enterprise-blue;
- visually consistent across pages.

The product should not feel:

- like a heavy ERP;
- like a Bitrix-style admin maze;
- like a public landing page inside the cabinet;
- like a demo dashboard made of decorative cards;
- like an all-orange interface;
- like a blue/gray interface with random orange accents pasted on top.

## Color Direction

Use the detailed token values from `docs/design-system.md`. The high-level rule is:

- warm ivory for the app background;
- white or warm-white for primary surfaces;
- saturated orange for brand and primary actions;
- plum/violet for AI;
- green/amber/red/cyan only for semantic statuses.

Orange is approved and should stay. The issue to avoid is orange being used for everything.

## Orange Usage Rules

Use saturated orange for:

- primary CTA buttons;
- active sidebar item;
- selected tab;
- active segmented control;
- active toggle;
- input focus;
- selected row indicator;
- small brand marks.

Do not use saturated orange for:

- all icons;
- all KPIs;
- all cards;
- AI surfaces;
- warning statuses by default;
- generic muted blocks;
- page backgrounds;
- decorative gradients.

## AI Color Rules

AI must stay separate from normal CRM actions.

Use plum/violet for:

- AI assistant;
- AI analyst;
- AI suggestions;
- generated draft blocks;
- AI insight/action cards;
- AI approval prompts.

Do not use orange for AI, because users must be able to distinguish "primary CRM action" from "AI recommendation".

## Background Layer Decision

The main visual problem discovered in the current app is too many background levels on one screen.

Target rule:

```txt
Level 0: one global viewport/app shell background
Level 1: one main work-surface background
Level 2: optional muted interior blocks only when they clarify real grouping
Level 3: semantic highlights only for selected/active/status/AI/alert states
```

Normal pages should show one stable app background and one primary work area. The design should use spacing, borders, dividers, typography, and row states instead of stacking colored cards inside colored cards.

## Accepted Page Look

Each authenticated page should share the same app-level feeling as the approved Settings concept:

- sidebar visually belongs to the same shell;
- desktop sidebar is compact and route-first, without a large logo/title/subtitle block;
- header visually belongs to the same shell;
- main content uses calm white/warm-white surfaces;
- inner blocks are not aggressively recolored;
- rows and panels are separated by dividers and whitespace;
- primary buttons are saturated orange;
- selected states are softly orange;
- AI blocks are softly plum/violet;
- statuses use semantic colors;
- no text overlap;
- no high-contrast random panels;
- no blue-tinted page background.

Different pages may have different layouts:

- Settings: structured settings sections, team/roles/security/billing.
- Conversations: split-view inbox with thread and client context.
- Calendar: scheduling grid with appointment details.
- Leads: queue/table plus selected lead context.
- Tasks: operational task list plus assignment/detail flows.
- Dashboard: role-aware summary, alerts, KPI, next actions.
- Integrations: provider cards and setup flows.

The content changes, but the visual language stays consistent.

## Typography Direction

Preferred typography:

- primary app font: Manrope Variable;
- safety fallback: Noto Sans for Cyrillic/Kazakh and rare glyph coverage;
- secondary UI fallback: Inter;
- system fallback after Inter;
- compact 14px body text;
- 13px only for dense tables, compact lists, tags, and metadata-heavy UI;
- 12px metadata;
- `tabular-nums` for metrics, money, dates, times, percentages, and counts;
- headings at 600-700 weight, not ultra-heavy;
- no negative letter spacing;
- no all-caps decorative labels as a default pattern;
- no hero-sized text inside operational panels.

Recommended CSS stack:

```css
font-family:
  "Manrope Variable",
  "Noto Sans",
  Inter,
  ui-sans-serif,
  system-ui,
  -apple-system,
  "Segoe UI",
  sans-serif;
```

The design intent is a warm, expensive SaaS interface that stays comfortable for long work sessions. Manrope is the target because it is softer and more human than a cold enterprise font, while still being clean enough for CRM tables, forms, drawers, analytics, and settings.

Implementation notes for the redesign phase:

- self-host fonts through the frontend package/bundle pipeline;
- avoid relying on external font CDNs in the authenticated app;
- QA real Russian/Kazakh screens before locking Manrope as final;
- check dense settings pages, tables, calendar times, CRM statuses, sidebar navigation, form labels, and KPI cards;
- if Manrope renders poorly in Cyrillic/Kazakh, switch the primary app font to Inter and keep Noto Sans as fallback.

Suggested app type scale:

```txt
Page title:          22px / 30px, weight 700
Section title:       16px / 24px, weight 700
Card title:          14px / 20px, weight 700
Body:                14px / 22px, weight 500
Table/list:          13px / 20px, weight 500
Metadata/caption:    12px / 16px, weight 500
Button/control:      14px / 20px, weight 700
KPI number:          28-32px / 36px, weight 700, tabular nums
```

## Component Direction

Future implementation should start with shared primitives, not page-by-page patching.

Priority shared layers:

- `frontend/tailwind.config.ts`;
- `frontend/src/styles.css`;
- `frontend/src/components/ui/Button.tsx`;
- `frontend/src/components/ui/Card.tsx`;
- `frontend/src/components/ui/Input.tsx`;
- `frontend/src/components/ui/Textarea.tsx`;
- `frontend/src/components/ui/Select.tsx`;
- `frontend/src/components/ui/SearchableSelect.tsx`;
- `frontend/src/components/ui/Switch.tsx`;
- `frontend/src/components/ui/Tabs.tsx`;
- `frontend/src/components/ui/Badge.tsx`;
- `frontend/src/components/ui/StatusBadge.tsx`;
- shared table surfaces;
- shared drawer surfaces;
- shared modal/popover surfaces;
- shared toast/notification surfaces;
- shared loading/empty/error/forbidden/success states;
- sidebar/header/mobile navigation shell.

Only after shared tokens and primitives are stable should pages be cleaned one by one.

## Component Contract Summary

The redesign must make ZANI feel like one product, not a set of separately styled pages. The component contract is documented in detail in `docs/design-system.md`; this brief records the decisions that matter most for implementation.

Core rule:

- no page-local handcrafted controls when a shared primitive should exist;
- buttons, inputs, switches, chips, badges, tables, drawers, modals, toasts, and states must come from shared UI;
- page-local classes may describe layout or a specific semantic state, not reinvent core component styling.

### Buttons

Required button variants:

```txt
primary     saturated orange CRM action
secondary   neutral action
ghost       low-emphasis toolbar/action
outline     bordered neutral action
danger      destructive action
ai          plum/violet AI action
icon        icon-only control with accessible label
```

Button sizes:

```txt
sm:      min-height 36px, text 13px
md:      min-height 40px, text 14px
lg:      min-height 44-48px, text 14-15px
icon md: 40px x 40px
icon lg: 44px x 44px
```

Buttons should grow with content, not use arbitrary fixed widths. Long Russian/Kazakh labels must either fit naturally, wrap cleanly in full-width/mobile contexts, or truncate only when a tooltip/nearby context preserves meaning. Text must never overlap icons or adjacent controls.

Hover should use color, border, and soft shadow. Avoid `hover:-translate-y-*` for CRM controls.

### Switches

Create a shared `Switch` primitive during redesign. The existing integration-local `ToggleSwitch` should not remain the only switch implementation.

Switch rules:

- use `role="switch"` and `aria-checked`;
- default track 48px x 28px;
- active ordinary setting uses saturated orange;
- active AI setting may use plum/violet;
- verified healthy connection state may use success green;
- off state is neutral, not red;
- loading/disabled states block repeat interaction.

### Inputs And Selects

Inputs, textareas, native-looking selects, searchable selects, date/search controls, and form labels should share one visual system:

- default control height 44px;
- radius 10px;
- warm border;
- white surface;
- brand focus ring;
- error state with danger border and UX-readable copy;
- disabled state with muted surface and muted text.

Native browser select visuals should not appear in authenticated CRM pages.

### Tabs, Chips, And Filters

Tabs and segmented controls should use a muted warm container with a clear active pill/underline. Active state uses saturated orange text/border or soft orange background. Counts remain neutral unless they represent a real semantic status.

Filter chips are interactive. Status badges are informational. Do not mix the two visually.

### Badges And Statuses

Badges should be small and semantic:

- primary for active/selected/product state;
- AI only for AI-generated or AI-assisted content;
- success/warning/danger/info only for real state;
- neutral for metadata.

Do not turn the product into an orange badge field. Orange is the brand/action color, not every state color.

### Tables And Lists

Tables should become one consistent operational surface:

- header row around 40px;
- body rows 48-52px;
- compact rows 44px;
- selected row stronger than hover;
- numeric columns use tabular numbers;
- mobile tables become clean entity cards or stacked rows, not nested card piles.

### Modal, Drawer, Popover, Toast

Modals use 16px radius and one calm body background. Drawers should not alternate multiple background colors. Popovers use shared surface, border, panel shadow, keyboard support, and Escape close. Toasts use surface + border + semantic icon/left accent, without hover movement.

### Motion

Motion must be restrained:

- 120-180ms for color, border, shadow, and popover/modal transitions;
- 180-220ms for drawer slide;
- optional active press scale 0.99 for buttons;
- no floating animations, animated gradients, or hover movement on dense work controls.

### New Page Rule

When a new authenticated page is built, it must start from the shared design system:

1. Use the global app shell and background rules.
2. Use shared primitives for all common controls.
3. Use Warm Premium tokens, not raw blue/slate/orange class experiments.
4. Verify long localized text, mobile layout, keyboard focus, loading/error/empty/forbidden/success states, and dark-theme readiness.

## Implementation Order

When the redesign phase starts, use this order:

1. Update tokens and CSS variables to Warm Premium CRM.
2. Update Tailwind color aliases while preserving semantic names.
3. Update shared `Surface`, `Card`, `Button`, table, drawer, modal, popover, badge, and navigation primitives.
4. Add or clean theme provider/dark mode if included in the phase.
5. Refactor Settings first, because it currently has the most background nesting and is the design reference page.
6. Refactor Dashboard, Conversations, Calendar, Tasks, Leads.
7. Refactor Analytics, Integrations, Account, remaining operational pages.
8. Run desktop and mobile visual QA after each group.

Do not copy the remote orange CSS wholesale. Use it only as design inspiration and implement the system through clean tokens and shared components.

## Page Acceptance Checklist

A page matches the new direction when:

- it uses the global app background;
- it has one clear primary work surface;
- it does not show three or four neutral backgrounds in the normal state;
- nested cards are removed unless they represent real repeated entities or modal sections;
- primary actions and active states use saturated orange;
- AI blocks use plum/violet;
- status colors are semantic;
- text contrast is comfortable;
- mobile layout remains one coherent app, not a stack of unrelated cards;
- loading/error/empty/forbidden states follow the same surface rules;
- the page is verified on desktop and mobile screenshots.

## Non-Goals

Do not use the redesign phase to:

- redesign the landing page;
- introduce custom theme settings for every user immediately;
- add decorative marketing sections inside the app;
- hide missing data behind fake visual blocks;
- change backend permissions or CRM business rules without a separate CRM task;
- merge large unrelated frontend features.

## Open Decisions For The Redesign Phase

Before implementation, decide:

- whether Manrope is acceptable after Cyrillic/Kazakh QA;
- whether dark mode ships in the first redesign batch or after the light theme is stable;
- whether orange becomes the only default brand theme before custom themes;
- whether the generated Settings concept should be reproduced as the first implementation target;
- which pages are included in the first redesign branch.

## Related Documents

- `docs/design-system.md` - current design system source of truth.
- `plan/ui_ux_design_system_reform.md` - broader UI reform plan and historical context.
- `AGENTS.md` - authenticated UI content and implementation rules.
