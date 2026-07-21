# ZANI Design System Notes

Last updated: 2026-07-17

## Product UI Principle

ZANI is an AI-first CRM and business control layer for SMB. Authenticated CRM pages must feel premium, calm, fast, and operational. The interface should help the user complete real work: qualify a lead, process an inbox conversation, book an appointment, move a deal, assign a task, inspect integration health, or confirm an AI recommendation.

The desired visual direction is:

```txt
Warm Premium CRM
Warm ivory workspace + copper-orange actions + plum AI accent
```

This direction applies to the authenticated app. Public landing pages are intentionally out of scope for this document until the landing system is redesigned separately.

For the agreed redesign brief and implementation guardrails, see `docs/WARM_PREMIUM_CRM_REDESIGN_BRIEF.md`.

## Core Visual Goals

- Premium, warm, relaxed SaaS feeling.
- No blue-tinted page background in the CRM workspace.
- Orange stays as the ZANI brand and primary action color.
- Orange must not become every semantic color in the product.
- AI must stay visually distinct from ordinary CRM actions.
- Status colors must communicate state, not decoration.
- Daily screens must be dense, scannable, and low-fatigue.
- Avoid decorative gradients, nested cards, and multiple competing page backgrounds.

## Warm Premium Color System

### Light Theme

```txt
App Background:     #F7F3EE
Page Soft:          #F4EEE7
Surface:            #FFFFFF
Surface Warm:       #FFFCF8
Surface Muted:      #F2EDE6
Border:             #E6DDD2

Text Primary:       #17120F
Text Secondary:     #5F554D
Text Muted:         #8A7B70
```

### Brand / Primary Actions

```txt
Brand Primary:      #D96718
Primary Hover:      #B84F0B
Primary Pressed:    #8F3A08
Primary Soft:       #FFF0E4
Focus Ring:         rgba(217, 103, 24, 0.22)
```

Use orange for:

- primary CTA buttons;
- active navigation item;
- selected tab/filter;
- active toggle/switch;
- input focus ring;
- selected row indicator;
- small brand marks.

Do not use orange for:

- every icon;
- all KPI cards;
- AI surfaces;
- warning status by default;
- large decorative page backgrounds;
- nested panels inside nested panels.

### AI Accent

AI must not be orange. Use a separate plum/violet accent so AI recommendations do not look like ordinary CRM actions.

```txt
AI Accent:          #6F4CC3
AI Hover:           #5E3CAE
AI Soft:            #F4F0FF
AI Border:          #DDD2FF
```

Use AI colors only for AI assistant, AI analyst, AI draft, generation, summarization, and recommendation surfaces.

### Status Colors

```txt
Success:            #15803D
Success Soft:       #ECFDF3

Warning:            #B7791F
Warning Soft:       #FFF7E6

Danger:             #C2410C
Danger Soft:        #FFF1ED

Info:               #0E7490
Info Soft:          #EAF9FC

Neutral:            #6B625A
Neutral Soft:       #F2EDE6
```

Status colors are semantic. Do not use them as generic decoration.

### Dark Theme

Dark mode should feel warm and premium, not blue-black or crypto-dashboard-like.

```txt
Dark Background:    #15110E
Dark Surface:       #211A15
Dark Panel:         #282019
Dark Soft:          #31271F
Dark Border:        rgba(255, 235, 210, 0.10)

Dark Text:          #F8F1E9
Dark Text Muted:    #B8A99C

Dark Brand:         #F08A3B
Dark Brand Soft:    rgba(240, 138, 59, 0.14)

Dark AI:            #B7A2FF
Dark AI Soft:       rgba(111, 76, 195, 0.18)
```

## Background Layering Rules

The CRM must not show three or four unrelated background colors on one screen. The default rule is two neutral planes:

```txt
Level 0: viewport / app shell background
Level 1: page and work surfaces
```

Optional nested surfaces are allowed only when they clarify a real workflow.

### Level 0: Viewport / Layout

The full authenticated app viewport uses one background:

```txt
var(--zani-bg) / App Background
```

The layout background should be stable across Dashboard, Leads, Conversations, Calendar, Settings, Tasks, and Analytics. Do not give individual pages their own full-page background unless the route is a separate product mode such as public auth or platform admin.

### Level 1: Primary Work Surface

Primary work areas use:

```txt
Surface:       white / #FFFFFF
Surface Warm:  #FFFCF8 when a warmer panel is needed
```

Examples:

- table shells;
- inbox split view;
- calendar shell;
- settings section body;
- drawers and modals;
- dashboard KPI group.

### Level 2: Muted Interior Blocks

Muted backgrounds are allowed inside a white surface for grouping, but only sparingly:

```txt
Surface Muted: #F2EDE6
```

Use muted blocks for:

- empty states;
- secondary metadata;
- inline form groups;
- compact row groups;
- preview/code blocks;
- non-primary details.

Avoid a muted parent that contains many white cards that then contain more muted blocks. In that case, remove one layer and use spacing, borders, or typography instead.

### Level 3: Semantic Highlights

Soft brand, AI, success, warning, danger, and info backgrounds are reserved for semantic callouts and selected/active states. They must not be used as generic panel backgrounds.

## Current Background Audit

Snapshot from the current frontend implementation on 2026-07-16:

```txt
bg-white       ~332 occurrences
bg-slate-50    ~286 occurrences
bg-slate-100   ~133 occurrences
bg-brand-50    ~110 occurrences
```

The biggest background-noise areas are currently:

- `frontend/src/features/settings/SettingsPage.tsx`
- `frontend/src/features/dashboard/OwnerDashboard.tsx`
- `frontend/src/features/conversations/ConversationsPage.tsx`
- `frontend/src/features/calendar/CalendarPage.tsx`
- `frontend/src/features/tasks/components/TaskDrawer.tsx`
- `frontend/src/features/analytics/AnalyticsPage.tsx`
- CRM drawer shared classes in `frontend/src/components/crm/drawers/shared.tsx`

The current issue is not that `bg-white` or `bg-slate-50` exist. The issue is that many pages combine app background, page background, parent panel background, inner card background, inner muted background, and semantic badge backgrounds at the same time.

## Background Refactor Target

For each authenticated screen:

1. Keep the layout viewport background as the only full-screen background.
2. Use one primary white/warm surface for the main work area.
3. Use muted interior blocks only for real grouping.
4. Use brand/AI/status soft backgrounds only when they communicate meaning.
5. Replace visual nesting with spacing, border, dividers, and typography.
6. Avoid nested cards unless the inner card is a repeated entity item, modal section, or selected entity preview.

Recommended page-specific cleanup:

- Settings: section cards should use one surface; inner options should mostly use rows/dividers, not extra `bg-slate-50` cards inside cards.
- Conversations: the inbox/list/thread/context layout should read as one workspace with clear dividers, not as many unrelated panels.
- Calendar: grid cells can be white with selected/hover states; avoid extra slate backgrounds for headers, body, rows, and side panels all at once.
- Dashboard: KPI and action blocks should use a consistent surface model; avoid mixing blue/violet/orange soft panels unless semantic.
- Drawers: drawer body can be one warm/soft background with white content sections; avoid white header + slate body + white cards + slate inner blocks everywhere.
- Integrations/setup: provider setup blocks can use one muted container with white detail rows, or one white container with muted detail rows, but not both recursively.

## Typography

Typography should support the Warm Premium CRM feeling: calm, soft, readable, and dense enough for daily operational work. The app must not feel like a marketing site, a heavy ERP, or a decorative dashboard.

### Font Stack

Recommended default:

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

Use Manrope Variable as the primary authenticated-app font if Cyrillic, Kazakh, and mixed numeric content pass visual QA. Manrope is preferred because it feels warmer and more human than a purely neutral enterprise font while still staying professional.

Use Noto Sans as the safety fallback for Cyrillic/Kazakh coverage and rare glyphs. Use Inter as the secondary UI fallback and as the backup primary choice if Manrope fails visual QA on real Russian/Kazakh CRM screens.

Do not introduce decorative, serif, display, or brand-only fonts inside the authenticated app. The CRM should feel stable and readable over long sessions.

### Font Loading

Implementation target:

- self-host fonts through the frontend bundle/package pipeline;
- avoid runtime dependency on external font CDNs for the authenticated app;
- load the variable Manrope weight axis when possible instead of many separate files;
- keep fallback rendering acceptable before the primary font loads;
- verify Cyrillic, Kazakh, numbers, currency, dates, and dense tables after the font is enabled.

### Type Scale

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

Use 14px body text as the default for operational pages. Use 13px only for dense tables, compact lists, tags, and metadata-heavy UI where readability remains strong.

### Weight Rules

- Use 500 for most body text and table content.
- Use 600 when text needs emphasis but should not become visually loud.
- Use 700 for page titles, section titles, buttons, selected tabs, and key labels.
- Avoid 800/900 in the authenticated app except for rare large KPI numbers.
- Do not use ultra-heavy headings inside compact panels, cards, drawers, modals, or settings sections.

### Number Rules

Use `tabular-nums` for:

- KPI values;
- money and revenue;
- counts;
- percentages;
- dates;
- appointment times;
- table columns with numeric comparisons.

This prevents numbers from jumping visually in dashboards, tables, calendar rows, and analytics cards.

### Spacing And Lettering

- Keep letter spacing at `0`.
- Do not use negative letter spacing.
- Avoid all-caps labels except very small technical/status labels where existing UI already uses that pattern.
- Keep line-height comfortable: body copy should breathe, table rows should scan quickly, and buttons should not feel cramped.
- Do not use hero-scale typography inside authenticated CRM pages.

## Component Shape

```txt
Card radius:        12px
Control radius:     10px
Button radius:      10px
Modal radius:       16px
Sidebar shell:      20-24px only when visually framed
Border:             1px solid var(--zani-border)
Card shadow:        0 4px 12px rgba(23, 18, 15, 0.05)
Panel shadow:       0 16px 40px rgba(23, 18, 15, 0.10)
```

Keep shadows soft. Expensive SaaS does not need heavy floating cards everywhere.

## Component Interaction Contract

The Warm Premium CRM design must be implemented through shared primitives first. New pages must not hand-roll local buttons, toggles, inputs, badges, modals, drawers, table rows, or card shells unless the shared primitive cannot support the workflow and is intentionally extended.

The default component behavior should feel calm and precise:

- transitions are short and useful;
- hover states clarify interactivity without moving the layout;
- focus states are visible and accessible;
- disabled and loading states prevent repeat actions;
- long localized text does not break the layout;
- every component works in light and future dark theme.

### Size Tokens

```txt
Control sm:          min-height 36px, px 12px, text 13px
Control md:          min-height 40px, px 16px, text 14px
Control lg:          min-height 44-48px, px 20px, text 14-15px
Icon button md:      40px x 40px
Icon button lg:      44px x 44px
Touch target:        minimum 44px x 44px when used on mobile or dense toolbars
Toolbar gap:         8px
Form row gap:        12px
Section gap:         16px
Page block gap:      16-20px
```

Use `sm` for dense table/toolbars, `md` for normal page actions, and `lg` only for primary form submission, onboarding/setup steps, or mobile full-width actions.

### Buttons

All app buttons should route through `frontend/src/components/ui/Button.tsx` or a shared wrapper around it.

Required variants:

```txt
primary     Brand action: create, save, invite, confirm, assign
secondary   Neutral action: copy, open, export, secondary navigation
ghost       Low-emphasis toolbar/icon action
outline     Neutral bordered action with brand focus/hover
danger      Destructive or irreversible action
ai          AI assistant/recommendation action, plum/violet only
icon        Icon-only control with aria-label and tooltip when meaning is not obvious
```

Button anatomy:

- inline-flex;
- center aligned;
- gap 8px between icon and label;
- radius 10px;
- font weight 700;
- no negative letter spacing;
- icon size 16px in `sm`, 18px in `md`, 20px in `lg`;
- min width comes from content, not a hard-coded arbitrary width.

Button sizes:

```txt
sm:      min-height 36px, px 12px, text 13px
md:      min-height 40px, px 16px, text 14px
lg:      min-height 44-48px, px 20px, text 14-15px
icon md: 40px x 40px
icon lg: 44px x 44px
```

Long button labels:

- normal buttons may grow horizontally with the label;
- never set a fixed width for text buttons unless the layout explicitly needs equal-width actions;
- in toolbars, use `max-width: 100%`, `min-width: 0`, and truncate only when the action remains understandable through nearby context or tooltip;
- in mobile/full-width actions, allow a two-line label with comfortable line-height instead of overflowing;
- never let button text overlap icons, counters, adjacent controls, or page content.

Button states:

```txt
primary default:     Brand Primary background, white text
primary hover:       Primary Hover background, slightly stronger shadow
primary active:      Primary Pressed background, optional scale 0.99
primary focus:       4px Focus Ring, 2px offset when outside dense surfaces
primary disabled:    muted surface, muted text, no hover, cursor not-allowed

secondary default:   Surface background, Border, Text Primary
secondary hover:     Primary Soft or Surface Warm, Brand border, Text Primary
secondary active:    Surface Muted, Brand border

ghost default:       transparent, Text Secondary
ghost hover:         Primary Soft or Surface Muted, Text Primary

danger default:      Danger background, white text
danger hover:        darker danger tone

ai default:          AI Accent background or AI Soft surface depending on prominence
ai hover:            AI Hover or slightly stronger AI border
```

Do not use hover translate effects on normal app buttons. Avoid `hover:-translate-y-*` for authenticated CRM controls because it makes dense operational screens feel jumpy. Use color, border, shadow, and a very small active press state instead.

### Switches And Toggles

Create and use a shared `Switch` / `ToggleSwitch` primitive for all binary settings. The current integration-local switch should be promoted to shared UI during implementation.

Switch rules:

- use `role="switch"` and `aria-checked`, not only `aria-pressed`;
- label must be visible near the switch or provided through `aria-label`;
- default size: track 48px x 28px, knob 22px;
- dense size: track 40px x 24px, knob 18px;
- click/touch target must be at least 44px high;
- active ordinary business setting uses Brand Primary;
- active AI setting may use AI Accent;
- verified connection status may use Success, but only when the state means "connected/healthy";
- off state uses neutral muted surface, not red;
- disabled state uses opacity around 0.55 and no hover;
- loading state disables interaction and shows either a subtle spinner or busy affordance.

Use switches for persistent on/off settings such as channel enabled, AI tool enabled, rule active, notification enabled, or business setting active.

Do not use switches for one-time actions such as connect, invite, send, export, archive, retry, or confirm. Those remain buttons.

### Checkboxes And Radio Controls

Checkboxes are for multi-select, column visibility, bulk row selection, and optional form flags. They should be shared and visually aligned:

```txt
Checkbox box:        16px x 16px desktop, 18px x 18px touch-heavy forms
Checkbox target:     minimum 44px row height when clickable as a row
Checked color:       Brand Primary
Indeterminate:       Brand Primary with horizontal mark
Disabled:            Surface Muted + Text Muted
```

Radio controls are for mutually exclusive choices when all options should be visible. Use segmented controls for 2-4 high-frequency mode switches; use radio groups for longer or form-like option sets.

### Inputs, Textareas, And Selects

All form controls must use shared primitives.

Default control anatomy:

- min-height 44px;
- radius 10px;
- border `Border`;
- background `Surface`;
- text 14px / 20-22px;
- label 13-14px, weight 600;
- placeholder `Text Muted`;
- helper text 12px / 16px;
- error text 12-13px using Danger;
- focus ring uses Brand Focus.

Input states:

```txt
default:     Surface + Border
hover:       Brand border at low intensity
focus:       Brand border + 4px Focus Ring
error:       Danger border + Danger Soft helper area if needed
disabled:    Surface Muted + Text Muted
readonly:    Surface Warm + Text Secondary, no strong hover
```

Select and searchable select:

- never show native browser select styling in authenticated CRM pages;
- trigger height matches inputs;
- selected label truncates safely;
- long option labels wrap to two lines inside popovers only when needed;
- popover uses Surface, Border, Panel shadow, max height, keyboard support;
- selected option uses Primary Soft + Brand text;
- search field inside popover follows the same input rules.

Textarea:

- default min-height 96px;
- resize vertical only unless the product workflow needs fixed height;
- message composer textareas can be compact but must keep readable line-height.

### Segmented Controls, Tabs, And Filter Chips

Use these for switching views, statuses, queues, date modes, and common filters.

Segmented control:

- container uses Surface Muted or Page Soft;
- radius 10-12px;
- padding 4px;
- option min-height 36-40px;
- active option uses Surface + Brand text + subtle shadow or Brand Soft;
- inactive option uses Text Secondary;
- hover uses Surface Warm or Primary Soft;
- counts use neutral small badges unless the count is itself a semantic status.

Tabs:

- tabs should not look like large cards;
- active state must be obvious through Brand text, underline, or active pill;
- use `aria-current` or `aria-selected` correctly;
- avoid tab labels wrapping in dense horizontal tabs; on mobile allow horizontal scroll.

Filter chips:

- use for temporary filters and saved filter chips;
- active chip uses Primary Soft + Brand border/text;
- removable chip uses an icon button with accessible label;
- never use chips as fake status badges when they are not interactive.

### Badges And Status Labels

Badges communicate state, category, or small metadata. They must not become decorative confetti.

Badge sizes:

```txt
sm:  height 20-22px, px 8px, text 11-12px
md:  height 24-26px, px 10px, text 12px
lg:  height 28-30px, px 12px, text 13px, rare
```

Rules:

- `primary` badge is for selected/active/product state, not generic decoration;
- `ai` badge is only for AI-generated, AI-assisted, or AI-recommended content;
- success/warning/danger/info are semantic only;
- do not map all attention states to orange just because orange is the brand;
- avoid uppercase by default; use it only for compact technical labels where space is tight.

### Cards, Surfaces, And Sections

Cards are for repeated entities, modal sections, selected previews, KPI tiles, and actionable grouped content. Page sections should not become nested cards inside cards.

Surface rules:

```txt
Primary surface:    Surface or Surface Warm, border, soft card shadow
Outlined surface:   Surface, border, no shadow
Muted surface:      Surface Muted, used sparingly for grouping
Interactive card:   Surface, border, hover Brand border / Surface Warm
AI surface:         AI Soft, AI Border, no orange
Danger surface:     Danger Soft, Danger border, only for real risk/error
```

Section header:

- min-height 48px;
- horizontal padding 16px;
- icon 16-18px;
- title 14px / 20px, weight 700;
- optional action on the right uses Button `sm` or icon button.

### Tables And Lists

CRM tables are operational tools, not decorative grids.

Table defaults:

```txt
Header row height:      40px
Body row height:        48-52px
Dense row height:       44px
Cell horizontal px:     12px
Header text:            12px / 16px, weight 600
Body text:              13px / 20px or 14px / 20px
Divider:                Border or lighter warm divider
Hover row:              Surface Warm or very subtle Primary Soft
Selected row:           Primary Soft + left Brand indicator
```

Rules:

- row hover must not shift layout;
- selected row must be more visible than hover;
- checkbox columns use fixed width;
- action columns use icon buttons with tooltips/aria labels;
- numeric columns use `tabular-nums`;
- long names truncate in one line with title/tooltip when context requires a compact table;
- mobile tables become entity cards or stacked rows, but must not introduce extra unrelated backgrounds.

### Drawers, Modals, Popovers, And Toasts

Modal:

- radius 16px;
- max width by size: sm 512px, md 672px, lg 896px, xl 1152px;
- header min-height 64px;
- body uses one Surface or Surface Warm background;
- footer actions align right on desktop and stack full-width on mobile when needed;
- close button is an icon button with `aria-label`.

Drawer:

- desktop width 420-560px for detail drawers, up to 720px for complex CRM entity drawers;
- mobile drawer becomes a bottom sheet or full-screen panel;
- body should not alternate white/slate/white/slate levels;
- sticky footer is allowed for important actions.

Popover/menu:

- radius 12px;
- shadow Panel;
- option min-height 36-40px;
- selected option uses Primary Soft + Brand text;
- keyboard navigation and Escape close required.

Toast/notification:

- surface uses Surface + Border + Panel shadow;
- success/warning/danger/info icon or left border communicates tone;
- action button uses `sm`;
- avoid hover translate; do not make transient messages jump.

### Navigation

Sidebar item:

- min-height 40px expanded, 44px touch-heavy/mobile;
- radius 10-12px;
- icon 18-20px;
- active state uses Primary Soft + Brand text + optional left indicator;
- inactive uses Text Secondary;
- hover uses Surface Warm or Primary Soft at low intensity;
- badge/counter uses semantic color only when the count is urgent or error-related.

Mobile navigation:

- touch target at least 44px;
- active state must be clear without using full AI gradients;
- labels must not overlap icons or notification counters.

### Icons

Use lucide icons where available.

```txt
Toolbar icon:       16px
Button icon:        16-18px
Navigation icon:    18-20px
Empty-state icon:   22-24px
Large setup icon:   24-28px
```

Use neutral icon color by default. Use Brand, AI, or status colors only when the icon carries that meaning.

### Motion

Motion should support responsiveness, not decoration.

Allowed:

- color transition 120-160ms;
- border/shadow transition 120-180ms;
- popover/modal fade/scale 120-180ms;
- drawer slide 180-220ms;
- loading spinner where work is pending;
- active press scale 0.99 for buttons only.

Avoid:

- hover translate on dense CRM controls;
- floating animations;
- shimmer effects except skeleton loading;
- animated gradients inside authenticated work pages;
- motion that moves neighboring text or controls.

Respect `prefers-reduced-motion` when animations are implemented.

### Loading, Empty, Error, Forbidden, And Success States

Every page and reusable data component must define:

- loading state with skeleton or compact spinner;
- empty state with a real next action when one exists;
- error state with UX-readable copy and retry action when possible;
- forbidden state that explains access in role/business terms, not raw technical errors;
- success feedback for mutations through toast, inline confirmation, or updated state.

These states must follow the same surface, button, typography, and status rules as normal content.

### Implementation Guardrails

When a new authenticated page is created:

1. Start from shared layout primitives, not page-local wrappers.
2. Use shared `Button`, `Input`, `Textarea`, `Select`, `Switch`, `Tabs`, `Badge`, `StatusBadge`, `Card`, `Surface`, table, modal, drawer, popover, toast, and state-view primitives.
3. Do not use hard-coded `bg-slate-*`, `bg-blue-*`, random gradients, `font-black`, `rounded-3xl`, or hover translate unless the design system explicitly allows that case.
4. Use CSS variables or Tailwind aliases mapped to Warm Premium tokens.
5. Check long Russian/Kazakh labels, mobile width, keyboard focus, disabled/loading states, and dark-theme readiness before marking the page visually aligned.

## Forms

- Forms live inside primary surfaces.
- Field groups may use muted surfaces only when grouping improves scanning.
- Select controls use the custom `Select` component, not native visible browser select menus.
- Labels should be short and scan-friendly.
- Validation/error messages use semantic danger colors and clear UX copy.

## Filters

- Primary filters should be segmented buttons, chips, or custom `Select`.
- Advanced filters should be hidden behind a compact control unless they are part of the core workflow.
- Active filter state can use Primary Soft + Brand Primary text/border.
- Do not put filters inside a separate heavy card if the page already has a control bar.

## Metrics

- Metric cards should be useful, not decorative.
- Use neutral surfaces for most metric cards.
- Use colored icon wells to communicate metric category or state.
- Avoid full-card brand/AI/status backgrounds unless the card is a semantic alert.

## Global Navigation

- Sidebar is for business navigation only.
- Language selector belongs in the top header on desktop because it is not a daily workflow action.
- Rare system controls should stay out of the main sidebar.
- Mobile drawer should use a calm surface with a dimmed overlay.
- Active navigation should use orange brand accent, but inactive items should stay neutral.

## Page Layout

Main work screens should usually use a focused operational pattern:

```txt
Sidebar
Header
Page title / compact control context
Metrics or filter row when useful
Main work area
Right detail/context panel when useful
AI insight/action block when useful
```

Avoid hero blocks on authenticated CRM screens.

## Shared UI Helpers

- Prefer shared `Surface`, `Card`, `CrmTableSurface`, `CrmDataTable`, and drawer surface helpers before adding page-local background wrappers.
- New shared surfaces should map to semantic tokens, not hard-coded `bg-slate-*` or `bg-white/*` classes.
- Page-local background classes are allowed only when they represent a specific semantic state or selected/hover behavior.

## Acceptance Checklist Per Page

Before a page is considered visually aligned:

- The route uses the global app background and does not define its own full-page CRM background.
- The main work area has one clear primary surface model.
- There are no more than two neutral background planes visible in the normal state.
- Nested muted blocks are used only where they improve comprehension.
- Brand orange is used for actions/active states, not generic decoration.
- AI colors are separate from ordinary CRM actions.
- Status colors are semantic and consistent.
- Text contrast is readable on all backgrounds.
- Mobile layout does not become a stack of unrelated cards.
- Loading, error, empty, forbidden, success, retry, and disabled states follow the same surface rules.
- Desktop and mobile visual QA is done before marking the page complete.
