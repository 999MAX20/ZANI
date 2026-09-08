# ZANI UI/UX Implementation Standard

Status: IN PROGRESS — SHARED COLOR PASS COMPLETE; SEVEN-PAGE REFERENCE GAP BLUEPRINT COMPLETE; IMPLEMENTATION OPEN
Scope: authenticated `/app` only
Owner direction: Warm Premium CRM with a soft peach brand action color
Reference: `C:/Users/user/.codex/generated_images/01a02954-6edd-74f2-8944-794408801f0d/exec-d15fcf88-439d-45a1-9cbb-a585694f2a85.png`
Remaining-page references: `C:/Users/user/.codex/generated_images/01a02954-6edd-74f2-8944-794408801f0d/`

## Purpose

This document is the bounded implementation contract for bringing the authenticated Zani application toward the approved visual reference. It covers visual hierarchy, shared UI behavior, semantic color roles, responsive behavior and verification. It does not change backend business rules, permissions, tenant isolation or CRM lifecycle behavior.

The reference board is a visual direction, not a source of production copy or demo data. All authenticated content must remain connected to real API state, existing i18n/constants and permission-aware workflows.

## Source of truth and precedence

- `AGENTS.md` and `plan/clean_code_rules/zani_required_clean_code_rules.md` remain engineering constraints.
- `docs/frontend/design-system.md` remains the detailed component source of truth and must be updated with this approved direction.
- `docs/frontend/product-ui-reform.md` remains the product/workflow direction.
- Atlassian Color Foundation is the external semantic reference for color roles, emphasis levels, interaction states, inverse tokens, dark mode and WCAG expectations: https://atlassian.design/foundations/color-new/
- The current saturated-orange wording in older Zani documents is superseded for this implementation by the user-approved soft peach brand direction. Semantic warning/danger/success/information/AI colors remain separate.

## Reference UI specification

This section decomposes the supplied reference board into an implementation-ready target for the authenticated Zani application. The board is a visual benchmark, not a pixel-perfect source: its sample names, numbers, dates and Russian copy must not be copied into production. Production labels come from the existing i18n dictionaries, and all values come from the existing API/domain state.

### Reference board anatomy

The reference is a composite board with six authenticated desktop views arranged as two columns and three rows:

1. Dashboard — decision KPIs, funnel, team activity, tasks and AI brief.
2. Clients — searchable client table with operational ownership and status fields.
3. Leads — lead table with source, status, owner and lead score.
4. Dialogs — queue, conversation thread and selected-client context panel.
5. Deals — stage-based Kanban pipeline with compact deal cards.
6. Calendar — mini-calendar, calendar list and weekly time grid.

Each view uses the same product shell. The shell is the primary visual unifier; page-specific content changes inside the shell, but navigation, header utilities, surface hierarchy, control geometry and action semantics remain stable.

### Global visual target

#### Canvas and surface hierarchy

```txt
Level 0 viewport:       var(--zani-bg) / #F7F3EE
Level 1 work surface:   var(--zani-surface) / #FFFFFF
Warm surface:           var(--zani-surface-warm) / #FFFCF8
Muted grouping:         var(--zani-surface-muted) / #F2EDE6
Border:                 var(--zani-border) / #E6DDD2
Primary text:           var(--zani-ink) / #17120F
Secondary text:        var(--zani-text-secondary) / #5F554D
Muted text:             var(--zani-text-muted) / #8A7B70
Brand action:          #F5B37A with #17120F text
Brand selected:        #FFF3EA with #A4470D text/indicator
AI surface:            #F4F0FF with plum/violet content
```

The normal screen must show no more than two neutral planes: the ivory application background and one principal white/warm work surface. A muted or semantic surface is allowed only when it groups data or communicates a state. Do not build a white card inside a muted card inside a white page when spacing and a divider would communicate the same hierarchy.

#### Geometry and spacing

```txt
Desktop expanded sidebar:  220-240px, just wide enough for route labels
Compact/mobile navigation: 64-72px or an overlay drawer
Top header:                48-56px
Page outer padding:        16px compact / 24px desktop
Toolbar gap:               8px
Section gap:               16-20px
Control height:            36px sm / 40px md / 44-48px lg
Table header:              40px
Table body:                48-52px normal / 44px dense
Card radius:               12px
Control/button radius:     10px
Modal radius:              16px
Border:                    1px solid var(--zani-border)
```

The reference has a restrained, operational density: compact rows, short toolbars, thin borders, small icons and enough whitespace between functional groups. It does not use hero-scale headings, glassmorphism, heavy shadows, decorative gradients or floating cards that move on hover.

#### Typography

- Page title: 18-20px, weight 700, primary text.
- Section title: 14-16px, weight 700.
- Body/entity text: 13-14px, weight 500-600.
- Table header and compact labels: 12px, weight 600.
- Metadata/helper text: 12-13px, secondary or muted text.
- KPI value: 20-24px, weight 700, `tabular-nums`.
- Date, money, count and percentage values: `tabular-nums`.
- No all-caps labels except existing compact technical/status conventions.
- RU and KK text must be allowed to grow; never solve localization by clipping the label or hard-coding a narrow button width.

#### Iconography

- Use the existing Lucide/shared icon set.
- Toolbar icons: 16px.
- Button icons: 16-18px.
- Navigation icons: 18-20px.
- Empty/setup icons: 22-28px.
- Neutral icons are the default. Brand, status, AI and danger colors are used only when the icon carries that meaning.
- Icon-only buttons require an accessible name and tooltip where the action is not self-evident.

### Global app shell

#### Desktop sidebar

The implemented shell uses a route-first navigation rail that expands into an overlay without changing workspace geometry. The earlier reference brand row is intentionally omitted from the authenticated sidebar:

```txt
  Dashboard
  Clients
  Leads
  Dialogs
  Deals
  Calendar
  Tasks
  Processes
  Reports
  ----------------
  AI-assistant       [AI]
  Settings
  ----------------
  Collapse
```

Technical rules:

- Keep the sidebar fixed or sticky within the authenticated shell.
- Do not show a Zani logo or product-name row inside the sidebar; the primary scroll path starts with route navigation.
- Reserve only the compact 64px rail in desktop page flow. Expanded navigation overlays the workspace and must not resize, reflow or compress page content.
- Use a single vertical divider; do not use a separate decorative panel background.
- Each route item has an icon, readable label and a minimum 36-40px desktop height.
- Active route uses `Brand Soft` plus `Brand Content` and an optional narrow left indicator. It is not a saturated orange block.
- Inactive routes use secondary text and neutral icons; hover uses warm surface or a very subtle brand-soft surface.
- AI assistant is visually separated from ordinary CRM routes and uses the AI violet accent plus an `AI` badge.
- Settings and collapse are utility routes/actions and must not visually compete with daily CRM routes.
- The sidebar must support a deliberate compact state. Compact mode may show icons only, but tooltips and accessible names remain required.

#### Mobile navigation

- Replace the desktop column with a menu trigger and an overlay drawer.
- Drawer uses a calm surface and dimmed overlay; it must not look like a second page background.
- Every item has a touch target of at least 44px.
- Active route remains visible through `Brand Soft` and `Brand Content`, not color alone.
- Escape closes the drawer; focus moves into the drawer and returns to the trigger on close.

#### Top header

The reference top header is utility-first and stays visually light:

```txt
[global search]                              [+] [bell] [?] [avatar/name]
```

Technical rules:

- Keep the header height 48-56px with a bottom divider.
- Global search is a compact shared input, approximately 240-320px on desktop, with search icon, placeholder and keyboard shortcut affordance where supported.
- Quick create is a small square brand icon button in the header; it is not the replacement for the page's named primary CTA.
- Notification, help and account controls are neutral icon/text controls with accessible names.
- The notification control uses a 40px hit target and a 24px bell; shared button padding must not shrink the icon.
- Account navigation lives in the header rather than the sidebar. It always shows the avatar and reveals user name/business role only where space allows.
- The account control is a direct link to `/app/account`. Do not show a chevron or menu affordance until a real profile menu exists.
- On mobile, collapse utility labels into icon buttons and preserve the primary page action in the page header or an explicit bottom action.

#### Page header

Every route begins with a compact page context row:

```txt
[page title] [optional context/filter]                  [primary page CTA]
```

- Page title is the strongest text on the page after a KPI value.
- The primary CTA is named (`Create client`, `Create lead`, etc.), uses the peach brand fill and dark ink text, and sits at the right on desktop.
- Page-level secondary controls use neutral, outline or ghost variants.
- Do not place multiple filled peach buttons in the same header.
- On mobile the title and CTA may wrap into two rows; neither may overlap filters or the header utilities.

### Shared control anatomy

#### Buttons and quick actions

- Primary page CTA: peach fill, dark ink text, 40-44px high, 10px radius, icon at left when useful.
- Header quick create: square 32-40px icon button, peach fill, accessible name such as `Create`.
- Secondary: white/warm surface, neutral border and primary text.
- Ghost: transparent, secondary text; used for low-emphasis toolbar actions.
- Outline: neutral border; brand focus/hover only when the action is clearly related to the brand workflow.
- Danger: danger semantic fill with inverse text; never peach.
- AI: plum/violet surface or AI-soft treatment; never peach for AI-specific actions.
- Active/pressed state changes surface/border, not layout geometry. Avoid hover translation.
- Loading disables repeat submission, retains the action context and exposes `aria-busy`.

#### Search, filters and segmented controls

- Search fields have a leading search icon, visible placeholder and shared 40-44px control height.
- Filters sit in one compact toolbar; do not wrap each filter in a separate heavy card.
- Common views/statuses use a muted warm segmented container with one selected item.
- Selected item uses `Brand Soft` plus `Brand Content`; filled peach is reserved for the highest-priority action.
- Advanced filters are behind a compact filter button and open a popover/drawer with keyboard support.
- Filter chips are interactive only when they can be removed or changed; static statuses are badges, not fake chips.

#### Statuses and semantic colors

```txt
Neutral:      inactive navigation, secondary controls, default metadata
Brand:        create/save/confirm, selected route/tab/row
Information:  in progress, syncing, queued, informational
Success:      connected, active, completed, sent
Warning:      attention, risk, paused, no-show, prevention
Danger:       delete, archive, failed, blocked, lost
Discovery:    onboarding or genuinely new capability
AI:           assistant, suggestion, draft, recommendation
```

Text and icon meaning must not depend on color alone. Status badges need a label or icon, and danger/warning actions require explicit copy and confirmation where the action is destructive.

### Dashboard screen specification

The dashboard is a decision surface, not a marketing hero. Its information hierarchy is:

```txt
Page context
  -> greeting/context line and date selector
  -> five decision KPI cards
  -> funnel + team activity + today tasks
  -> grounded AI assistant strip
```

#### Dashboard header

- Page heading is a short, localized operational greeting or dashboard title already supported by the product.
- A short secondary context line may explain the selected period only when it is data-backed.
- Date/period selector is a neutral compact control aligned right.

#### KPI row

The reference uses five equal metric cards in one row on desktop:

1. New leads — count plus comparison/delta.
2. Lead conversion — percentage plus comparison/delta.
3. Active deals — count plus comparison/delta.
4. Revenue — money amount plus comparison/delta.
5. Tasks for today — count plus overdue/attention indicator.

Each card contains an optional 24-28px icon well, a 12px label, one dominant number, and a small delta line. Most cards stay neutral. A color is applied to the icon or delta only when it conveys the metric's meaning; do not turn every KPI card into a full-color panel.

#### Dashboard work blocks

- Funnel block: left/primary area, title plus period selector, ordered stages, counts and amounts. Use restrained horizontal bars or stepped blocks; stage colors must remain legible and must not imply status incorrectly.
- Team activity block: recent real activities with avatar/initials, actor, action summary and time. Rows are compact and scan vertically.
- Today tasks block: tabs for current/overdue/all where supported, checkbox, task title, due time and a compact view-all action. Overdue is warning/danger by meaning, not simply brand orange.
- AI strip: a separate violet/AI-soft surface at the bottom, containing the assistant label, a grounded summary/recommendation and compact action cards. AI content must cite or link to real CRM entities when the existing product contract supports it.

### Clients screen specification

```txt
Page header: title + Create client
Toolbar:     Filters + common scope select + search
Work area:   one bordered table surface
Footer:      range summary + pagination + page-size control
```

Table columns represented by the reference:

- Client: initials/avatar, client name and optional secondary identifier.
- Contact: contact person or primary contact value.
- Phone: formatted phone number.
- Email: email address with safe truncation when needed.
- Responsible: assigned business member.
- Status: labeled semantic badge such as active or potential.
- Created: localized creation date.
- Actions: icon-only overflow menu with an accessible name.

Row rules:

- Checkbox column is fixed and supports bulk selection.
- Avatar/initials are neutral by default; color is not the only identifier.
- Selected row uses `Brand Soft` plus a visible brand indicator.
- Hover does not move the row or change its height.
- Footer remains part of the same work surface, not a separate floating card.

### Leads screen specification

```txt
Page header: title + Create lead
Toolbar:     Filters + scope/status select + search
Work area:   one bordered lead table
Footer:      range summary + pagination + page-size control
```

Table columns represented by the reference:

- Lead: lead name or person.
- Company: company/account name.
- Source: source label with neutral/source icon.
- Status: lifecycle state badge mapped to its semantic meaning.
- Responsible: assigned business member.
- Score: compact visual score with a text/value equivalent; never color-only.
- Created: localized creation date.
- Actions: overflow menu.

The bulk action bar appears only after selection. Lead lifecycle status is not automatically `discovery`; discovery is reserved for a genuinely new product experience.

### Dialogs / inbox screen specification

The reference uses a three-pane operational workspace:

```txt
Queue/list pane | Thread pane                         | Context pane
```

#### Queue pane

- Header contains queue/scope selector and filter control.
- Each row contains channel/avatar, client name, short message preview, time and unread indicator where applicable.
- Selected conversation uses `Brand Soft` and a clear indicator.
- Rows must preserve the preview and time on narrow widths through truncation, not overlap.

#### Thread pane

- Header contains selected contact, channel/context and compact utility actions.
- Incoming messages use a neutral surface; outgoing messages may use a very light brand-soft surface with dark ink text.
- Message metadata includes time and delivery state where available.
- Composer has a visible mode/tab for external reply versus internal note, a textarea, attachment/media controls and a named peach send action.
- Send/loading/error states prevent duplicate submission and retain typed content where safe.

#### Context pane

- Contact summary card: avatar/initials, name, responsible user and status.
- Compact contact actions: call/email or supported channel actions with accessible labels.
- Deal/pipeline summary: stage, value and source when available.
- Task summary: next task or due action, plus a named add-task action.
- Context content is one calm surface with dividers; avoid multiple nested cards for every field.

### Deals screen specification

The deals view is a Kanban pipeline with an optional list mode:

```txt
Page header: title + Create deal
View switch: Board | List
Board:       stage columns with counts/amounts
Cards:       deal identity, amount, company, owner/date and risk marker
Footer/card: Add deal action where supported
```

- Stage columns use neutral/muted surfaces and a stable header.
- Each column header shows stage name, count and amount where available.
- Deal cards use white/outlined surfaces, compact metadata and a consistent action affordance.
- Warning/risk icons are semantic and appear only for real attention states.
- Drag/drop, if supported, must expose keyboard or action-menu alternatives and must respect the existing CRM lifecycle/permission rules.
- Selected deal opens the existing inspector/drawer; the Kanban card must not become a saturated CTA.

### Calendar screen specification

```txt
Page header: title + period/navigation controls + Create appointment
Left rail:   mini month calendar + calendar visibility list
Main:        day/week/month time grid
```

#### Calendar controls

- Today, previous and next controls are neutral icon/text buttons.
- Current period is visible as a localized range.
- Day/week/month segmented control has one selected state using `Brand Soft`.
- Create appointment is the single peach page CTA.

#### Calendar rail and grid

- Mini-calendar shows month title, weekday headings, date cells and a clear selected date.
- Calendar list uses semantic/consistent event colors with checkbox/toggle affordances and an add-calendar action where supported.
- Main grid has a stable time axis, localized day headers, visible hour lines and appointment blocks.
- Appointment blocks show time, title and client/context when space permits.
- Current-time line is a distinct information/status indicator, not the brand CTA color.
- On mobile the grid may scroll horizontally or switch to a day agenda; it must not compress text into unreadable cells.

### Cross-screen modal, drawer, popover and toast specification

- Modal: centered surface, 16px radius, clear title, one calm body surface and predictable footer. Close button has an accessible name.
- Drawer: 420-560px desktop detail width, up to 720px for complex CRM entities; mobile becomes a bottom sheet or full-screen panel. Focus is trapped while open and returned to the trigger on close.
- Popover/menu: 12px radius, border, panel shadow, 36-40px options, Escape close and keyboard navigation. Selected option uses `Brand Soft`.
- Toast: neutral surface with semantic icon/edge, short localized message and optional `sm` action. Toasts must not shift page layout or use decorative motion.
- Every mutation overlay defines default, hover, pressed, focused, disabled, loading, validation-error and success feedback where relevant.

### Responsive transformation rules

| Desktop pattern | Mobile target |
| --- | --- |
| Expanded sidebar | Menu trigger + overlay drawer |
| Header search + utilities | Compact search/utilities with accessible icon labels |
| Named page CTA at right | Full-width or wrapped CTA in page context |
| Multi-column KPI row | Horizontal scroll or 2-column metric grid, not tiny cards |
| Data table | Entity cards/stacked rows with the same operational fields |
| Deals Kanban | Horizontal stage scroll or focused stage view |
| Three-pane inbox | One active pane at a time with clear back/navigation controls |
| Weekly calendar grid | Day agenda or horizontally scrollable time grid |
| Right inspector | Bottom sheet/full-screen detail panel |

Mobile must preserve task completion, not merely preserve desktop geometry. Do not remove status, owner, next action or error feedback solely to fit the viewport.

### Implementation mapping and boundaries

Implement the target in this order:

1. Global shell: sidebar, mobile drawer, header, page header and surface primitives.
2. Table template: Clients, Leads and Tasks.
3. Kanban template: Deals.
4. Split workspace template: Dialogs.
5. Schedule template: Calendar.
6. Dashboard/Analytics metric and work-block composition.
7. Modal/drawer/popover/toast completion and route-wide QA.

Reuse existing shared components before adding new ones, especially `Button`, `Tabs`, `FilterBar`, `Select`, `Badge`, `StatusBadge`, `MetricCard`, `StateViews`, `Surface`, table primitives and CRM drawers. A page-specific component is allowed only when the shared primitive cannot express the real workflow and the extension is documented.

Do not change in this visual phase:

- API contracts, domain services, permissions or tenant isolation;
- CRM lifecycle transitions, assignment rules or audit behavior;
- public landing/auth visual system;
- production copy, demo numbers or static fake entities;
- semantic warning/danger/success/information/AI colors merely to make the board more monochrome.

### Reference implementation acceptance checks

For each page template, verify:

- shell geometry and navigation are consistent with the reference target;
- page has one primary CTA and a clear operational question;
- there are no more than two neutral background planes in the normal state;
- spacing, control heights, border, radius and typography use shared tokens;
- primary peach text passes contrast and remains readable in hover/pressed/focus states;
- semantic statuses remain distinguishable from brand and AI surfaces;
- table/list/board/inbox/calendar content is backed by real API state;
- loading, empty, error, forbidden, retry, success and disabled states are defined where relevant;
- keyboard navigation, accessible names, focus return and touch targets pass;
- RU/KK/EN labels, long values and mobile layout do not overlap or overflow;
- desktop and mobile screenshots are reviewed against this reference specification;
- no public/auth, backend/API, permission or CRM lifecycle behavior changed unintentionally.

## Product UI contract

Every authenticated page must:

- answer one operational question or support one primary merchant action;
- use the global app shell and one stable viewport background;
- use one main work surface plus muted/semantic surfaces only when they clarify grouping or state;
- use shared primitives before page-local controls;
- preserve loading, error, empty, forbidden, success, retry, disabled and loading states where applicable;
- preserve role-aware visibility and backend permission enforcement;
- keep real Russian/Kazakh/English content readable on desktop and mobile;
- avoid decorative, marketing, fake-data or explanatory blocks without a product purpose.

## Semantic color roles

The component API must select a role by meaning, not by a numeric shade that happens to look correct.

| Role | Zani meaning | Allowed examples |
| --- | --- | --- |
| `neutral` | default text and secondary UI | secondary/ghost buttons, inactive navigation, table controls |
| `brand` | primary CRM action and selected state | create, save, invite, active tab, selected row indicator |
| `information` | information or normal progress | syncing, queued, in progress, informational callout |
| `success` | favorable result or healthy state | connected, completed, sent, active |
| `warning` | caution or attention needed | high risk, needs attention, no-show, paused |
| `danger` | destructive or serious failure | delete, archive, failed, blocked, lost |
| `discovery` | new product experience | onboarding, newly available feature, first setup hint |
| `inverse` | content placed on a bold surface | dark danger or bold AI/brand surface |
| `input` | form-control state | input border, focus, error, disabled |
| `ai` | Zani-specific AI meaning | AI suggestions, drafts, recommendations, assistant |

`success`, `information`, `warning`, `danger` and `discovery` are not generic brand variants. `ai` stays plum/violet even when the action is important.

## Brand token proposal

The light authenticated theme uses:

```txt
Brand bold/default:  #F5B37A
Brand hovered:       #EE995A
Brand pressed:       #DF813F
Brand subtle:        #FFF3EA
Brand content:       #A4470D
Text on brand:       #17120F
Focus indicator:     rgba(164, 71, 13, 0.42), with #A4470D as the focus border/content token
```

The proposed palette has comfortable calculated contrast with Zani Ink: 10.28:1 default, 8.27:1 hover and 6.50:1 pressed. White text must not be used on the soft peach brand surface.

Numeric Tailwind aliases may remain during migration, but shared component APIs should move toward semantic aliases such as `action-brand`, `action-brand-hover`, `surface-brand-selected`, `text-brand`, `text-inverse` and `border-focus`.

## Shared component contract

### Buttons

- `primary`: brand bold/default, dark Zani Ink, brand hover/pressed states.
- `secondary`: neutral surface, neutral border and primary text.
- `ghost`: transparent neutral action with subtle neutral hover.
- `outline`: neutral outline by default; use a brand outline only for a clearly brand-specific secondary action.
- `danger`: danger bold surface with inverse text.
- `ai`: plum/violet surface with inverse or AI text according to emphasis.
- Optional warning/information actions require a concrete semantic reason; they must not replace ordinary primary actions.
- Disabled uses an explicit muted surface/text state. Loading prevents repeat interaction and preserves the action context.

### Tabs, segmented controls and filters

- Container: muted warm surface.
- Inactive item: neutral text.
- Active/selected item: `Brand subtle` + `Brand content` or a restrained brand indicator.
- Filled brand bold is reserved for the highest-priority CTA, not every selected control.
- Counts stay neutral unless they communicate a real semantic state.

### Badges and statuses

- `Badge` must expose semantic variants, including `discovery` where a real product-discovery state exists.
- `StatusBadge` must distinguish normal progress (`information`) from caution (`warning`).
- Entity lifecycle values such as a new lead are not automatically product discovery.

### Tables, lists and inspectors

- One table/work surface with warm borders and compact operational rows.
- Hover: warm surface only.
- Selected: soft brand surface plus a visible brand indicator; do not make the whole row a saturated button.
- Action column: shared icon buttons with accessible names/tooltips.
- Selected entity opens the existing inspector/drawer pattern without changing API or permission behavior.

### Cards, drawers, modals and toasts

- Surface hierarchy: viewport → primary work surface → optional muted/semantic block.
- Avoid `card inside card` unless the inner element is a repeated entity, modal section or selected preview.
- Drawers and modals use one calm body surface and a predictable footer.
- Toasts use neutral surface plus a semantic icon/border; the action button follows the same Button contract.

### Inputs, select, switch and focus

- Inputs and selects use the `input` role and brand focus token.
- Active ordinary switches use brand; active AI switches use AI; healthy connection may use success only when it actually means connected/healthy.
- Focus must remain visible for keyboard users and must not be clipped by dense toolbars, drawers or mobile sheets.
- Touch targets remain at least 44px where the control is used on mobile.

## Page patterns

| Page | Target structure |
| --- | --- |
| Dashboard | decision KPIs, urgent work, team activity, today tasks, grounded AI brief |
| Clients | search/filter toolbar, one table surface, selected row, client inspector |
| Leads | lead table, bulk bar only on selection, source/status/owner/next action, lead inspector |
| Deals | stage board with neutral columns, white deal cards, selected deal inspector, explicit next action |
| Conversations | queue + thread + context panel, peach send/CRM action, violet AI suggestion |
| Calendar | day/week/month grid, soft selected date, semantic appointment states, peach create action |
| Tasks | task list, status-aware rows, assignment/detail inspector, peach create action |
| Analytics | neutral KPI/chart surfaces, semantic exception states, violet AI insight surface |
| Outreach | campaign metrics, compact readiness checks, filterable campaign table and selected-campaign inspector |
| AI agents | searchable agent list, route-backed editor tabs, AI preview and permission-aware save/test actions |
| Integrations | connector metrics, filterable provider list, selected-provider inspector and existing setup flows |
| Services | operational metrics, service table, selected-service editor and usage context |
| Resources | resource metrics, compact creation shortcuts, resource table and schedule-aware modal |
| Working hours | separate business-week/resource views and one modal weekly schedule editor |
| Timeline | server-filtered event list, selected-event details and safe entity context |
| Settings | compact section navigation, one primary body surface, peach save, red destructive, violet AI settings |

## Remaining main-page reference blueprints and current-state gap analysis

Date of comparison: 2026-09-02.

This section covers the seven remaining owner-approved reference screens. It is both a component specification and a gap register. A generated reference controls composition, density and interaction hierarchy only. It does not authorize new channels, entities, fields, statuses, integrations or business actions.

### Evidence set

| Page | Approved reference | Current runtime evidence | Primary implementation file |
| --- | --- | --- | --- |
| Outreach | `exec-aadb42ac-b71c-444c-a807-ff7df30c775f.png` | `output/playwright/reference-gap-audit-2026-09-02/outreach.png` | `frontend/src/features/outreach/OutreachPage.tsx` |
| AI agents | `exec-3e73626c-81f4-4aa4-9029-fb8b2244d7c1.png` | `output/playwright/reference-gap-audit-2026-09-02/ai-agents.png` | `frontend/src/features/assistant/AIAgentsPage.tsx` |
| Integrations | `exec-2a33f709-7fd1-4529-a17a-4077c1e153cf.png` | `output/playwright/reference-gap-audit-2026-09-02/integrations.png` | `frontend/src/features/integrations/IntegrationsPage.tsx` |
| Services | `exec-81241ecf-f246-4892-a8d5-1b497a17cff2.png` | `output/playwright/reference-gap-audit-2026-09-02/services.png` | `frontend/src/features/services/ServicesPage.tsx` |
| Resources | `exec-b285c406-8a78-453a-a481-635ed0e786e6.png` | `output/playwright/reference-gap-audit-2026-09-02/resources.png` | `frontend/src/features/resources/ResourcesPage.tsx` |
| Working hours | `exec-d2371e69-4176-400e-8f52-7c545d66bb99.png` | `output/playwright/reference-gap-audit-2026-09-02/working-hours.png` | `frontend/src/features/settings/WorkingHoursPage.tsx` |
| Timeline | `exec-1498eee4-2242-439d-83ce-9895bc8fb740.png` | `output/playwright/reference-gap-audit-2026-09-02/timeline.png` | `frontend/src/features/timeline/TimelinePage.tsx` |

All references are stored under `C:/Users/user/.codex/generated_images/01a02954-6edd-74f2-8944-794408801f0d/`. The runtime pass used the current owner account at 1536x1024. All seven routes rendered and had no horizontal document overflow. This does not certify every mutation, role, locale or mobile state.

### Gap summary

| Page | Functional baseline | Reference-layout gap | Important constraint |
| --- | --- | --- | --- |
| Outreach | strong | major composition refactor | only current Telegram/WhatsApp contract; keep launch safety |
| AI agents | strong | medium editor-navigation refactor | preserve canonical routes, grounding and tool permissions |
| Integrations | strong | major list/inspector refactor | do not duplicate channel/provider setup ownership |
| Services | solid CRUD | medium table/modal refactor | no linked-employee relation in `Service` |
| Resources | solid CRUD | medium table/modal refactor | no linked-services/capacity contract |
| Working hours | solid weekly workflow | medium composition refactor | one interval per day; no break/multiple-interval model |
| Timeline | basic read view | major filtering/detail refactor | safe metadata only; export and actor filtering need contracts |

### Shared target anatomy for these pages

The seven screens must converge on one reusable workspace pattern:

```txt
App shell
  -> compact page header and one page-level primary CTA
  -> optional 3-4 decision metrics
  -> compact search/filter/action toolbar
  -> primary list/table/work surface
  -> selected-entity inspector on wide desktop
  -> drawer or full-screen detail on smaller viewports
```

Required shared behavior:

- Use the existing `CrmWorkspacePage`, `CrmWorkspaceGrid`, `WorkQueueLayout`, `Drawer`, `BottomSheet`, `Surface`, `Button`, `Input`, `Select`, `Badge`, `StatusBadge` and state surfaces before adding page-local equivalents.
- Extend or replace the current basic `DataTable` through one shared operational-table contract. Required capabilities are a stable `rowKey`, selected row, row activation, keyboard activation, accessible action menu, pagination metadata, loading/empty/error state and mobile entity-card transformation.
- Keep selected entity identity in the URL where a direct link is useful: `?campaign=`, `?provider=`, `?service=`, `?resource=` or `?event=`. Back/forward navigation must restore selection and filters.
- A selected row uses Brand Soft and a narrow brand indicator. Hover remains neutral/warm and must be weaker than selection.
- One inspector action may be primary. Secondary actions stay neutral; destructive actions use danger; AI generation/test actions use AI violet. A page must not show a peach button on every list row.
- Inspector width is `clamp(340px, 25vw, 420px)` for service/resource/event detail and up to 480px for campaign/provider configuration. It scrolls independently and may have a sticky footer.
- Desktop list and inspector remain in one work surface. Below the wide-desktop breakpoint, the inspector becomes an accessible drawer/full-screen panel with Escape close, focus trap and focus return.
- Search fields must preserve focus while asynchronous data changes, following regression rule ZR-001. Selection, drafts and scroll position survive canceled overlays, following ZR-002 and ZR-006.
- Every page must explicitly handle loading, empty, query error, forbidden, mutation error, disabled, pending and success feedback. Merchant-visible errors remain sanitized through the shared `AppError` path.
- Owner/administrator management controls require the corresponding `manage` permission in the UI and backend. A visible read-only surface must still handle backend `403`; hiding a control is not authorization.
- Production data and labels come from current APIs and RU/KK/EN dictionaries. Reference names, quantities, dates, channels and provider brands are examples only.

### Shared implementation gaps

| Current shared layer | Already available | Required extension |
| --- | --- | --- |
| `DataTable` | desktop table, mobile stacked cards, empty/loading shell | stable row key, row selection/activation, selected styling, toolbar slot, server pagination, sticky header, accessible overflow action |
| `CrmWorkspaceGrid` | responsive right inspector, desktop overlay fallback, accessible open/close labels | reuse as-is first; only add a generic sticky inspector footer if at least two pages need it |
| `WorkQueueLayout` | list/detail pane transformation | reuse for integrations/outreach when a true queue/list layout is clearer than a table |
| `Modal` and `Drawer` | shared overlay behavior | create actions may stay modal; edit/detail should use the inspector/drawer when the reference shows persistent context |
| `PageHeader` | title, description and action slot | remove duplicate page headings; enforce one page-level primary action |
| filters | shared `Input`, `Select`, `FilterBar`, `Tabs` | do not use native `<select>`; keep filter state in URL and query APIs when the dataset is paginated |

Do not add seven independent table and inspector implementations. The shared workspace/table foundation is a prerequisite for page convergence.

### Outreach / Рассылки

#### Target component structure

1. Compact page header: `Рассылки`, neutral `Импорт согласий`, peach `Создать рассылку`.
2. Three metrics: campaign count, queued recipients and sent recipients. Status meaning remains semantic.
3. Three compact readiness summaries: role/access, appointment automation and launch safety. They are summaries with links/actions, not large explanatory cards.
4. Campaign toolbar: search, channel, status, campaign type and period. Unsupported filters must not be displayed.
5. Campaign table: campaign identity, supported channel, type, audience size, status, recipients, sent result, failures and planned/actual launch time.
6. Selected-campaign inspector: identity/status, prepare/launch/retry controls, delivery metrics, launch checklist, consent/rate/audience facts, message preview and recent recipients.
7. Creation and consent-import overlays retain the current real forms and validation.
8. Appointment auto-messages become a compact collapsible secondary section or a dedicated subview; they must not push the campaign workspace below the first viewport by default.

#### Current implementation — keep

- Real campaign, template, consent, recipient, segment, checklist, statistics and appointment-automation APIs already exist.
- Owner/admin/marketer launch gating, disabled actions and backend mutation handling already exist.
- Metrics, readiness, campaign selection, audience preview, message preview, recipient statuses, retry paths and create/import modals already exist.
- Loading, no-business, empty and shared error surfaces are present.

#### Required changes

- Replace the `420px list + long detail column` with the shared campaign table/inspector workspace and URL-backed selection.
- Add compact search and filters. Use server parameters where available; do not assume that the first paginated response is the complete campaign history.
- Move appointment automation out of the dominant vertical path and expose its failure recovery without duplicating retry controls.
- Reduce the selected-campaign action cluster: `Запустить` is primary only when launchable; `Подготовить`, refresh and retry are secondary/ghost; cancellation is an explicit danger/confirmation flow when it changes lifecycle state.
- Decompose the 891-line page before adding behavior: data/controller hook, campaign table, inspector, readiness summary, automation summary and overlay forms.
- Preserve the current supported channel contract. The Email and LinkedIn rows visible in the generated image are not implementation requirements.

#### Do not implement from the image

- Do not add Email, LinkedIn or other outreach channels without provider/domain support.
- Do not copy campaign names, delivery numbers or recipients from the image.
- Do not show a delivery percentage that the current statistics endpoint did not return.
- Do not weaken the launch checklist, consent rules, role restriction or retry safety to simplify the UI.

#### Acceptance checks

- Selected campaign, filters and search survive refresh/back navigation.
- Owner can create, prepare and launch; a view-only role sees state but cannot mutate; backend `403` is rendered safely.
- Loading, empty, failed query, failed mutation, pending and success states are visible without replacing the whole workspace unnecessarily.
- Table and inspector are keyboard reachable; closing the mobile inspector returns focus to the originating campaign row.
- RU/KK/EN long campaign names, WhatsApp template statuses and error reasons do not overlap.

### AI agents / ИИ-агенты

#### Target component structure

1. Page header with one `Создать агента` AI action.
2. Agent list pane with search/filter, status, short purpose, selected state and total count.
3. Editor header with agent identity, purpose and AI-status switch.
4. Route-backed horizontal editor tabs: profile, channels, knowledge/instructions, actions/tools and test/launch.
5. Profile composition: CRM scope, confirmation policy, instructions, connected knowledge and channels, plus a grounded answer preview.
6. Sticky editor footer for dirty-state cancel/save. AI generation or test controls use the AI variant; ordinary save may remain brand primary.
7. Empty state and onboarding progress remain available but do not compete with the active editor.

#### Current implementation — keep

- Canonical routes for agent and section, real bot/profile/channel/knowledge/conversation/message queries and permission-aware management already exist.
- Profile, channels, knowledge, allowed actions and test/launch are real sections rather than mock tabs.
- Onboarding progress, channel setup, suggested reply and create modal already exist.
- AI color separation is partly present in agent icons and guidance surfaces.

#### Required changes

- Remove the duplicate page heading and nested `ИИ-агенты` heading. The global page header owns route identity; the editor owns the selected section title.
- Keep deep links but render section navigation as compact editor tabs on wide screens. The left pane should contain agents only, not a second nested navigation tree.
- Add agent search/status filtering without losing the canonical route.
- Consolidate page-local slate/brand classes into current semantic tokens and reduce nested bordered cards.
- Add dirty-state tracking, cancel/reset behavior and navigation guard for unsaved configuration.
- Standardize save placement and pending/success feedback across all five sections.
- Decompose large section files before expanding behavior; `AIAgentsPage.tsx` and several section components already exceed preferred frontend size thresholds.

#### Do not implement from the image

- Do not create the six sample agents or their sample instructions.
- Do not imply that an agent can access entities or perform tools not present in its profile/permission contract.
- Do not merge channel credential ownership into the editor when an existing provider setup flow owns it.
- Do not color normal CRM save/error/status behavior violet merely because the page is AI-related.

#### Acceptance checks

- Direct URLs for every agent section remain stable and invalid sections canonicalize safely.
- Read-only users can inspect allowed content but cannot create, activate, connect or save.
- Switching agents with dirty changes requires an explicit decision; cancel restores the last server state.
- Tabs, list selection, status switch, modal and preview pass keyboard/focus checks.
- Suggested replies and previews stay grounded in current data and visibly distinguish AI output from saved CRM state.

### Integrations / Подключения

#### Target component structure

1. Compact header and four status metrics: connected, setup required, request/pending and attention/error.
2. One search field plus status, provider-group and optional `connected only` filters.
3. Dense provider list with logo/icon, name, business purpose, semantic status, latest/next sync facts and neutral overflow affordance.
4. Selected-provider inspector with overview, existing settings/setup and sync/recovery information when those APIs exist.
5. The inspector owns the single contextual primary action: connect, continue setup, reconnect or save. Connected providers use success state, not peach fill.
6. Mobile transforms list -> full-screen provider detail -> back to the preserved list position.

#### Current implementation — keep

- Capability, connector and bot queries, permission check, search, status/group filters and four metrics already exist.
- Provider catalog, availability and merchant-status derivation are real and permission-aware.
- Provider-specific setup components and `ProviderCard` recovery flows already contain substantial business logic and must be preserved.
- Loading, no-business, page error and empty-filter state are present.

#### Required changes

- Replace the two-column grid of full provider cards with a compact provider list and selected-provider inspector. Mount existing setup content in the inspector/drawer instead of rewriting provider flows.
- Stop rendering a peach `Подключить` button on every provider row. Rows select/open context; only the selected inspector shows the primary connect/setup action.
- Use Brand Soft for active filters instead of a filled primary CTA treatment.
- Preserve the current provider ownership boundary. Telegram, WhatsApp, Instagram and website are intentionally excluded from this catalog; if shown as channel summaries, they must deep-link to their canonical setup owner rather than duplicate credentials.
- Split the 438-line `ProviderCard` before adapting it: summary, status/recovery, setup form and provider-specific content.
- Show sync-log or next-sync fields only when supplied by connector/run APIs. An empty decorative tab is not acceptable.

#### Do not implement from the image

- Do not add Google Calendar, Email or any provider solely because it appears in the generated image.
- Do not duplicate Telegram/WhatsApp/Instagram setup across Integrations and AI agents.
- Do not expose access keys, webhook secrets, raw provider errors or support-only fields in the list or inspector.
- Do not label request/roadmap providers as connected or immediately available.

#### Acceptance checks

- Filtering and selecting a provider update URL state and never reset setup form input unexpectedly.
- Owner/admin management works; read-only roles cannot mutate; provider errors are sanitized and actionable once.
- Connected, syncing, setup-required, pending-request and error states use distinct semantic roles.
- OAuth cancellation returns to the same provider, tab, scroll position and focus target.
- Mobile provider detail is task-complete and does not expose the desktop grid off-screen.

### Services / Услуги

#### Target component structure

1. Header with neutral scheduling-center link and one peach `Добавить услугу` action.
2. Three metrics: active services, average duration and services used in appointments.
3. Service table with name, duration, price from, appointment usage, status and overflow action.
4. Selected-service modal with supported edit fields: name, description, duration and price.
5. The modal also shows real appointment usage derived from current data. Create and edit use the same shared modal overlay behavior.
6. Search/status filtering and pagination are added when the dataset is larger than one page.

#### Current implementation — keep

- Real service and appointment queries, three metrics, table, status badge, create/edit mutation, `ServiceForm`, notifications and shared modal already exist.
- The target table columns are almost completely supported by the current `Service` contract.
- No-business, loading and empty state are present.

#### Required changes

- Keep URL-backed service selection and open one centered responsive modal on desktop, tablet and mobile.
- Replace repeated text `Изменить` actions with an accessible overflow/icon action and row activation.
- Move the permanent `Логика услуг` explanation to contextual help, onboarding or the empty state; it should not occupy a full daily-workflow row.
- Add query-error rendering; current loading/no-business handling can otherwise collapse a failed list into an empty-looking state.
- Add `settings:manage` UI gating for add/edit/active-state controls while preserving backend enforcement.
- Use shared server pagination/search rather than rendering an unbounded service list twice in desktop and mobile DOM.

#### Do not implement from the image

- Do not add linked employees to a service: the current `Service` model has no such relation.
- Do not invent duration units, currencies, descriptions or usage history.
- Do not add delete when the domain has not defined archive/restore and audit behavior.

#### Acceptance checks

- Create and edit use the same validation contract and preserve pending/error state.
- Read-only roles see service data but not usable mutation controls; forced backend denial is safe.
- Row selection, modal focus containment, Escape/backdrop close and focus return pass.
- Long service names/descriptions and localized money/duration values remain readable.

### Employees and resources / Сотрудники и ресурсы

#### Target component structure

1. Header with scheduling-center link and one `Добавить ресурс` action.
2. Three metrics: active resources, staff resources and resources with individual schedules.
3. Compact creation shortcuts for supported resource types. These are toolbar actions, not four large explanatory cards.
4. Resource table: name, type, linked employee, appointment usage, schedule state, active status and overflow action.
5. Selected-resource modal: name/type, linked employee, active state, current weekly schedule and appointment load.
6. The modal links to the working-hours workspace for schedule editing rather than duplicating a second scheduler.

#### Current implementation — keep

- Real resource, appointment, working-hours and team-member queries already support most target facts.
- Metrics, supported templates, resource usage, status, `ResourceForm`, create/edit mutations and modal already exist.
- Cross-business linked-user validation is enforced by the backend serializer and must remain authoritative.

#### Required changes

- Convert template cards into a compact create strip/dropdown using only supported resource types.
- Add search, type/status filters, pagination, selected row and one responsive resource modal.
- Show current weekly availability from `WorkingHours`; do not duplicate editing inside the resource page.
- Add `settings:manage` gating for create/edit/status controls and safe `403` handling.
- Move the permanent `Логика ресурсов` explanation into contextual help/onboarding.
- Avoid querying all appointments for every row in render. Precompute usage once or request an aggregate when scale requires it.

#### Do not implement from the image

- Do not add linked services, utilization history or capacity fields that are absent from the `Resource` contract.
- Do not create separate staff records that bypass the existing linked active business member rule.
- Do not add sample rooms, chairs or employees from the generated screen.

#### Acceptance checks

- A resource can be created from every supported shortcut and edited through the same form contract.
- Linked-user choices include only active members of the current business; tenant/backend denial is covered.
- Schedule summary is accurate for business-inherited versus individual schedules.
- Desktop table, mobile cards and modal retain the same operational fields.

### Working hours / График работы

#### Target component structure

1. Header with scheduling-center link and one `Настроить неделю` action.
2. Three metrics: business working days, individual schedules and day-off rows.
3. Compact quick preset toolbar with preset select and one apply action.
4. A route-backed inner switch separates the business-week table from the resource schedule list.
5. The resource view shows inheritance/individual status, search, filtering and pagination; conflict indicators appear only when real conflict data exists.
6. Selected weekly schedule opens in a wide responsive modal using the existing weekly form; business or resource target is explicit.
7. The modal presents all seven days as one week grid on desktop and keeps a sticky cancel/save footer, pending state and safe validation feedback.

#### Current implementation — keep

- Real weekly data, presets, metrics, business-week summary, resource summary, complete rows table, `WeeklyWorkingHoursForm`, bulk upsert and success/error feedback already exist.
- The current structure is already conceptually close to the reference.
- Existing backend uniqueness and tenant validation provide one schedule row per business/resource/day.

#### Required changes

- Use the shared dimmed modal for week editing on every viewport; do not compress the schedule table with a persistent inspector.
- Reduce the large Brand Soft quick-setup block to a compact neutral toolbar; peach is reserved for applying the selected preset.
- Replace the stacked week-and-resource page with two explicit inner views so users never scroll through both datasets in one continuous table.
- Add `settings:manage` UI gating and disable duplicate save/apply while pending.
- Add dirty-state protection, focus containment and focus return for the business/resource schedule modal.
- Keep the page within the two-plane background rule and avoid a card for every weekday/resource row.

#### Domain blocker from the generated image

The reference visually shows multiple intervals per day, a separate break interval and overlap warnings. The current backend explicitly enforces `unique_working_hours_per_resource_day` and stores only one `start_time`, one `end_time` and `is_day_off`. Therefore:

- the UI-only redesign must show exactly one interval per day;
- multiple intervals, breaks and interval-overlap validation require a separate scheduling-domain proposal, migration, availability-engine change, API contract and tests;
- these controls must not be rendered as nonfunctional placeholders.

#### Acceptance checks

- Business and resource weeks load, save and refresh without duplicate rows.
- Invalid start/end times remain in the editor with localized validation and no partial save.
- Preset apply and manual week save are permission-aware and safe against repeat submission.
- Mobile editing supports all seven days without horizontal clipping or losing unsaved values.

#### Implementation status — 2026-09-04

- [x] Global header uses the scheduling-center secondary action and one permission-aware `Настроить неделю` primary action.
- [x] The page uses three compact metrics and a neutral quick-preset toolbar; peach remains limited to the apply action and selected state accents.
- [x] Large weekday tiles and the duplicate raw rows table were replaced by one business-week table and one resource schedule list.
- [x] Business and resource schedules open in one responsive dimmed modal; the week grid presents all seven days together on desktop and retains a sticky cancel/save footer.
- [x] The editor remains bounded by the real scheduling contract: one start/end interval and one day-off flag per weekday. Breaks, multiple intervals and synthetic conflict warnings were not added.
- [x] `settings:update` gating remains in the page and modal code; the current modal runtime role check remains part of the open browser gate below.
- [x] URL selection, keyboard opening, modal focus contract, focus return and unsaved-change confirmation are represented in the focused Working Hours E2E flow.
- [x] Manual week save refreshes the same seven rows without duplicates; invalid start/end values remain in the editor with localized validation.
- [x] RU/KK/EN parity passed through `npm run check:i18n`; all new visible copy is dictionary-backed.
- [x] Mobile runtime verification at 412 px confirmed seven reachable weekdays, focus containment and no document-level horizontal overflow.
- [ ] Re-run axe against the current modal. The earlier drawer implementation passed, but that historical result is not evidence for the replacement overlay.
- [x] Frontend production build and bundle budget passed after the redesign.

Verification evidence:

- `npx playwright test e2e/smoke.spec.ts --project=desktop-chromium --grep "business owner can configure working hours week"` — passed.
- `npx playwright test e2e/smoke.spec.ts --project=mobile-chromium --grep "working-hours editor keeps all seven days reachable on mobile"` — passed.
- `npm run build` — passed, including i18n parity, TypeScript and both Vite builds.
- `npm run check:bundle` — passed.
- Historical pre-modal Chrome checks at 1600×1000 and 412×915 found no document-level horizontal overflow; the replacement modal requires the current browser gate below.

### Timeline / История

#### Target component structure

1. Header `История действий`; export appears only after a secure export contract exists.
2. Toolbar: event/client search, category, date range and executor where supported.
3. Operational event table/list: event summary, client/object, actor, localized time and semantic category.
4. Selected-event inspector: normalized description, safe metadata details, related entity links and actor context.
5. Date grouping remains available as a visual separator; pagination/range summary belongs to the same work surface.

#### Current implementation — keep

- Real activity events and clients, category configuration, localized event text, date grouping and semantic icons/badges already exist.
- `timelineDetails()` already knows how to normalize useful metadata for a detail surface.
- Backend filtering already supports business, client, entity, category, event type, date range and text query.

#### Required changes

- Replace the native `<select>` with shared `Select` and move search/filter state into URL and API query parameters.
- Add selected event, row selection and right inspector/mobile drawer using `timelineDetails()` rather than exposing raw metadata.
- Resolve actor labels from current business membership/team data. For scalable server-side executor filtering, add a bounded backend `actor` query parameter instead of filtering only the currently loaded page.
- Add query-error and forbidden states; current query failure can appear as an empty result.
- Add pagination and preserve selected event when the page/filter changes only if it remains in the result set.
- Treat export as a separate permission-aware backend capability; do not produce an incomplete browser-only CSV from the current page.

#### Do not implement from the image

- Do not display IP address, internal event IDs, raw metadata, provider payloads or technical source fields to ordinary merchant roles.
- Do not invent executor names for actor IDs that cannot be resolved.
- Do not make every category peach. CRM, message, appointment, task, automation and system categories retain distinct semantic treatments.

#### Acceptance checks

- Search/category/date filters call the server, survive refresh and preserve typing focus.
- Selecting an event exposes sanitized details and valid entity navigation; no raw secret/error payload reaches the DOM.
- Analytics-view permissions govern route data; export, if later added, has an explicit permission and audit trail.
- Empty, error and forbidden states are distinguishable, localized and recoverable.

### Recommended implementation sequence

Each item is a bounded phase and must stop after its own verification gate:

1. Shared workspace/table foundation plus Services migration.
2. Resources migration using the same table/inspector foundation.
3. Working-hours composition using the existing weekly form; no domain expansion.
4. Timeline server filters and event inspector; export remains excluded.
5. Integrations provider list/inspector while preserving all provider setup flows.
6. Outreach campaign table/inspector and appointment-automation compaction.
7. AI-agent list/editor convergence and dirty-state protection.

The order deliberately validates the shared pattern on the smallest supported CRUD page before applying it to provider, outreach and AI workflows with larger state and permission surfaces.

### Analysis and implementation checklist for these references

- [x] Inspect current sidebar, route groups and permission-aware links.
- [x] Inspect the seven approved generated references as separate screens.
- [x] Inspect current page components, API usage, data models and shared UI options.
- [x] Capture current owner desktop runtime for all seven routes at 1536x1024.
- [x] Record supported fields/actions and explicit domain blockers.
- [x] Define page-specific component anatomy, keep/change/do-not-implement boundaries and acceptance checks.
- [x] Implement shared operational table/inspector foundation and migrate Services.
- [ ] Implement Resources reference composition.
- [ ] Implement Working hours reference composition without unsupported interval fields.
- [ ] Implement Timeline reference composition and server-backed filtering.
- [ ] Implement Integrations reference composition without duplicating provider ownership.
- [ ] Implement Outreach reference composition without adding unsupported channels.
- [ ] Implement AI-agents reference composition while preserving canonical routes and grounding.
- [ ] Run page-specific desktop/mobile, role, locale, keyboard, focus, loading/error/empty/forbidden and mutation checks after each phase.

## Implementation checklist

### Foundation

- [x] Read current Zani UI source of truth and external Atlassian color guidance.
- [x] Create this technical implementation standard.
- [x] Record the reference board and the authenticated-app scope.
- [x] Add an implementation-ready technical decomposition of every reference screen and shared shell element.
- [x] Update `styles.css` and `tailwind.config.ts` with semantic soft-peach tokens.
- [x] Update `docs/frontend/design-system.md`, `docs/WARM_PREMIUM_CRM_REDESIGN_BRIEF.md` and `plan/ui_ux_design_system_reform.md`.
- [x] Preserve compatibility for existing token aliases during migration.

### Shared UI

- [x] Align `Button` primary/secondary/outline/danger/ai state contracts.
- [x] Add semantic `discovery` support without using it for ordinary entity statuses.
- [x] Align `Tabs`, `FilterBar`, segmented controls and filter chips.
- [x] Align `Badge`, `StatusBadge`, `MetricCard` and shared notification/state surfaces.
- [x] Align table/list selection indicators, inspectors, drawers and progress indicators.
- [ ] Complete the visual sweep of every modal, popover and toast surface.
- [x] Align sidebar, mobile navigation, header and global action placement.
- [x] Remove the sidebar brand row and keep page-content geometry fixed while desktop, tablet and mobile navigation opens.
- [x] Move account navigation from the sidebar to the header and keep the notification control visually prominent across responsive layouts.

### Authenticated pages

- [x] Dashboard — visual audit passed; shared action/state tokens verified.
- [x] Clients — visual audit passed; shared action/state tokens verified.
- [x] Leads — visual audit passed; shared action/state tokens verified.
- [x] Deals — visual audit passed; shared action/state tokens verified.
- [x] Conversations — visual audit passed; shared action/state tokens verified.
- [x] Calendar — visual audit passed; shared action/state tokens verified.
- [x] Tasks — visual audit passed; shared action/state tokens verified.
- [x] Analytics — visual audit passed; shared action/state tokens verified.
- [x] Integrations — visual audit passed; shared action/state tokens verified.
- [x] Settings and remaining operational routes — visual audit passed for settings, outreach and AI agents.

### Verification

- [x] Check default, hover, pressed, focused, disabled and loading states end-to-end for the shared primary CTA; other shared variants are covered by the static `Button` contract.
- [x] Check semantic color separation and contrast: brand text on `#F5B37A`, `#EE995A` and `#DF813F` is `#17120F` at 10.28:1, 8.27:1 and 6.50:1 respectively.
- [x] Check keyboard navigation, accessible names and focus return end-to-end across task dialogs, CRM drawers, page secondary actions and mobile navigation.
- [x] Check RU/KK/EN labels, long text and mobile layout in the representative task flow; RU/KK/EN key parity, long user input and desktop/mobile overflow checks passed. Full all-route locale stress remains outside this pass.
- [x] Check authenticated route access and API health in the visual audit; forbidden-state flow remains open for a dedicated test.
- [x] Run frontend build, bundle check and targeted browser visual audit.
- [x] Record skipped checks and baseline failures explicitly.

## Implementation and verification log

### Completed in this pass

- Shared brand action tokens now use soft peach: default `#F5B37A`, hover `#EE995A`, pressed `#DF813F`, selected surface `#FFF3EA`, brand content `#A4470D` and readable action text `#17120F`.
- Primary CTA buttons use dark text on peach. Secondary, ghost and outline buttons remain neutral; danger remains red, information remains cyan/teal, success remains green, warning remains amber and AI remains plum/violet.
- Active navigation, tabs, filters, selected dates and selected task controls use the soft surface plus dark brand content instead of a saturated filled orange state.
- Shared sidebar/mobile/header controls, badges, status mapping, metrics, switches, progress indicators and notification info states were aligned to the semantic contract.
- The authenticated visual audit covered dashboard, leads, deals, clients, tasks, calendar day/month, conversations, integrations, analytics, settings, outreach and AI agents. It reported zero horizontal-overflow, transparent-surface, API or auth API issues for all audited routes.
- No backend/API, permissions, tenant-isolation, CRM lifecycle or migration changes were introduced by this UI pass. Existing i18n key parity remains green.

### Verification evidence

- `cd frontend && npm run build` — passed; i18n check passed with 4703 keys across `ru`, `kk` and `en`; TypeScript and both Vite builds passed.
- `cd frontend && npm run check:bundle` — passed; no JavaScript chunk exceeded 500 kB pre-gzip and the app shell stayed within 400 kB.
- `cd frontend && npm run audit:visual` — passed for all 13 configured authenticated routes; report: `output/playwright/visual-audit-2026-09-02T08-48-43`.
- `npx playwright test e2e/accessibility-responsive.spec.ts --project=desktop-chromium --project=mobile-chromium` — passed 11 tests with 3 expected project-specific skips; covers axe, CTA default/hover/pressed/loading, focus return, keyboard interaction, RU/KK/EN labels, long input and mobile overflow.
- `git diff --check` — passed; Git reported only existing line-ending normalization warnings.
- Manual authenticated browser review — desktop action buttons, selected states and mobile task layout were checked; no horizontal overflow was observed on the reviewed routes.
- Contrast calculation — passed for the three filled brand action states using `#17120F` text.

### Phase 1 — shared operational workspace and Services

- Added a reusable operational workspace contract: stable row identity, selected-row state, keyboard row activation, accessible table/card labels, desktop inspector, responsive drawer and focus return to the activating row.
- Migrated Services to the canonical `/app/business/services` route. `/app/services` and `/services` are compatibility redirects that preserve search/hash state; there is no data migration or replacement domain.
- The page uses real server-backed search, status filtering, pagination and URL state; every viewport opens the same centered responsive service modal without shrinking the table.
- Services navigation and creation actions now live in the shared route-aware app header. The scheduling action stays permission-aware, the create action preserves its disabled state, compact widths use accessible icon buttons, and both actions are removed from page content and cleaned up on route unmount.
- The modal exposes only supported `Service` fields and loaded appointment usage. It does not invent employee links, categories, resources or unsupported scheduling relations.
- Create and update actions remain gated by `settings:update`. A manager with `settings:view` receives the read-only page and a disabled modal form; the API independently rejects its PATCH request with `403`.
- Closing a dirty modal requires confirmation; cancel restores the saved values. Closing the modal returns keyboard focus to the row that opened it.
- API impact: `GET /api/services/` now supports `business`, `search`, `status`, `page` and `page_size`; tenant scoping is still applied before request filters. Mutation permissions were not broadened.
- i18n impact: Services workspace labels were added for RU/KK/EN with complete key parity. Notification impact is limited to existing local success/error feedback. AI, BusinessEvent, CRM lifecycle, migration and environment contracts are unchanged.

#### Phase 1 verification

- `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py test apps.services -v 2` — passed 3 tests: combined filtering, cross-tenant empty result, and manager read/forbidden-update behavior with unchanged database state.
- `DATABASE_URL=sqlite:///db.sqlite3 .venv\Scripts\python.exe manage.py check` — passed with no issues.
- `cd frontend && npm run check:i18n` — passed with 4721 keys across RU/KK/EN.
- `cd frontend && npx tsc -b --pretty false` — passed.
- `cd frontend && npm run build` — passed for TypeScript and both Vite builds.
- `cd frontend && npm run check:bundle` — passed; no JavaScript chunk exceeded 500 kB pre-gzip and the app shell stayed within 400 kB.
- Historical pre-modal browser review passed at 1600×1000 and 412×915. The current modal-specific browser check is tracked separately below and is not inferred from this result.
- `git diff --check` — passed with line-ending normalization warnings only.
- `cd frontend && npm run test:daily-workspaces` — baseline failure outside this phase: two dashboard source assertions no longer match the already modified `OwnerDashboard`/`DashboardPage`; neither file was changed in this phase.
- Browser mutation save was intentionally not executed against the user's local business data. Mutation authorization and non-mutation on denial are covered in the isolated backend test database; create/update form behavior is covered by TypeScript/build and the dirty-state browser flow.
- The global page-specific verification checkbox remains open: full role, all-locale long-text, forced loading/error/forbidden and mutation E2E coverage is not claimed for every migration phase.

### Shared shell follow-up — fixed sidebar overlay

- Removed the Zani icon/name brand row from the shared `Sidebar`; the change applies to the desktop rail and tablet/mobile drawer without changing route, permission or profile navigation.
- The desktop shell now reserves a constant 64px rail. Expanding the sidebar to 224px overlays the workspace instead of changing the flex spacer, so shared page content, tables, calendars and inspectors retain their width and position.
- Tablet and mobile navigation remain modal drawers outside normal document flow. Drawer navigation receives top clearance for its close control after removal of the former brand row.
- Added a focused responsive regression that compares the main landmark bounding box before and after navigation opens and asserts that the brand row is absent.

#### Shared shell verification

- `cd frontend && npx tsc -b --pretty false` — passed.
- Isolated `cd frontend && npx playwright test e2e/accessibility-responsive.spec.ts --project=desktop-chromium --project=tablet-chromium --project=mobile-chromium -g "sidebar overlays the fixed workspace"` — passed 3/3. The test used dedicated ports and a temporary SQLite database, then removed the temporary processes and files.
- `cd frontend && npm run build` — passed; i18n parity remained green with 4721 keys across RU/KK/EN, TypeScript and both Vite builds passed.
- `cd frontend && npm run check:bundle` — passed; no JavaScript chunk exceeded 500 kB before gzip and the app shell remained below 400 kB.
- The user's existing Chrome tab could not be claimed for an additional live-session inspection. No navigation, reload or data mutation was performed in that tab; the isolated Chromium geometry test is the acceptance evidence for this change.

### Shared shell follow-up — header account and notification utility

- Moved the direct `/app/account` navigation from the sidebar footer into the top-header utility cluster. The avatar remains visible at every authenticated viewport; user name and business role are revealed only on wide layouts.
- Kept the account control as a direct link without a false menu chevron. Active-route styling, accessible naming and keyboard activation are part of the shared header contract.
- Increased the notification bell to 24px inside its existing 40px hit target and applied the shared icon-button size contract so inherited horizontal padding cannot shrink the SVG.
- No API, permission, tenant-isolation, CRM lifecycle, notification-delivery, BusinessEvent, AI, migration or environment behavior changed.

#### Header account and notification verification

- `cd frontend && npx tsc -b --pretty false` — passed.
- Isolated `cd frontend && npx playwright test e2e/accessibility-responsive.spec.ts --project=desktop-chromium --project=tablet-chromium --project=mobile-chromium -g "account navigation lives in the header"` — passed 3/3. The scenario checks header placement, sidebar deduplication, responsive account details, accessible names, a 24px notification icon, keyboard navigation to `/app/account` and horizontal overflow.
- `cd frontend && npm run build` — passed; i18n parity remained green with 4721 keys across RU/KK/EN, TypeScript and both Vite builds passed.
- `cd frontend && npm run check:bundle` — passed; no JavaScript chunk exceeded 500 kB before gzip and the app shell remained below 400 kB.

### Phase 1 follow-up — Services lifecycle action menu

Business outcome: service status and removal are managed from one explicit row action menu while historical CRM links remain intact. The normal list excludes archived services; roles with `settings:update` can open the `Архивные` filter and restore them.

Change impact:

- Entity and ownership: `Service` remains scoped directly to `Business`; existing `Appointment.service` and `Lead.service` relations are preserved.
- Lifecycle: active ↔ inactive, active/inactive → archived, archived → inactive on restore. Archived services cannot be edited, activated or selected for new bookings.
- Permissions: read remains appointment-view scoped; activate, deactivate, archive and restore require backend `settings:update` (owner/admin by default). Frontend visibility is not authorization.
- Audit/activity: every lifecycle transition must write the existing tenant-safe audit and activity records. No notification delivery or BusinessEvent is introduced.
- AI/booking: inactive and archived services remain available to historical records but are excluded from new booking and AI service selection.
- Migration: add archive metadata to `Service`; no destructive data migration and no permanent-delete UI.
- API/UI: add explicit activate/deactivate actions, archive-aware list filtering and restore flow; remove `is_active` from the editable form contract.
- i18n: add complete RU/KK/EN labels for actions, confirmation, feedback and archive filtering.

Checklist:

- [x] Add archive metadata and protected lifecycle services/API actions.
- [x] Exclude inactive/archived services from new booking while preserving historical records.
- [x] Replace the row ellipsis shortcut with an accessible action menu.
- [x] Remove the `Активна` switch from service create/edit forms.
- [x] Add owner/admin archive filtering, muted archived rows and restore action.
- [x] Verify happy path, permission denial, tenant isolation, audit/activity and migration behavior.
- [x] Verify desktop/mobile menu, keyboard/focus, confirmations, i18n, build and bundle budget.

Verification evidence (2026-09-03):

- `manage.py makemigrations --check --dry-run` and `manage.py check` passed.
- `manage.py test apps.services.tests.ServiceListWorkspaceTests -v 2 --keepdb` passed: 8 tests covering lifecycle happy paths, permission denial, tenant isolation, audit/activity, archive visibility, restore behavior and new-booking eligibility.
- `frontend/e2e/services-lifecycle.spec.ts` passed in isolated authenticated runs for desktop, tablet and mobile. The flow covers menu keyboard navigation and focus return, activation/deactivation, archive/restore, confirmations, owner archive filtering, serious/critical Axe violations and horizontal overflow.
- `cd frontend && npm run build` passed, including RU/KK/EN parity for 4,744 keys and both app/widget production builds.
- `cd frontend && npm run check:bundle` passed; no application JavaScript chunk exceeded the configured 500 kB limit and the app shell remained below 400 kB.

### Phase 1 follow-up — Services table toolbar pagination

Business outcome: service search, status filtering and page navigation remain visible above the independently scrolling service rows. The duplicated bottom control strip is removed from this page without changing pagination placement on other CRM tables.

Responsive contract:

- Desktop: search is 320–352px, status stays beside it, and range/navigation/page-size controls align to the right.
- Tablet: filters and pagination may wrap into two ordered rows inside the same toolbar.
- Mobile: search and status use the available width; pagination remains a compact, horizontally contained control group with 44px touch targets.
- The table column header remains semantic data labeling only; interactive controls do not move into `<thead>`.
- Search, status, page and page size remain URL-backed; search/status/page-size changes reset the page as appropriate.
- `CrmPagination` keeps its existing footer behavior by default and exposes an additive toolbar variant for Services only.

Checklist:

- [x] Add the backwards-compatible toolbar variant to `CrmPagination`.
- [x] Move Services range, page navigation and page-size selection into the table toolbar.
- [x] Narrow desktop search while preserving full-width mobile input.
- [x] Remove the Services-only bottom pagination footer without changing Clients or other tables.
- [x] Verify URL state, disabled controls, keyboard labels, RU/KK/EN and production build.
- [x] Verify no page overflow and usable control layout on desktop, tablet and mobile.

Verification evidence (2026-09-03):

- `cd frontend && npm run check:i18n` passed with 4,745 aligned RU/KK/EN keys; `npx tsc -b --pretty false` passed.
- `cd frontend && npm run build` passed for the app and widget; the subsequent `npm run check:bundle` passed with no JavaScript chunk above 500 kB and the app shell below 400 kB.
- An isolated authenticated Browser/Playwright check confirmed that `page_size=10&page=1` and `status=active` are reflected in the URL, disabled previous/next controls remain named, and the page-size selector exposes the accessible label `Количество строк на странице`.
- At 1440px the toolbar stayed on one 44px row, search measured 352px, pagination stayed inside the toolbar, document overflow was 0 and the Services workspace contained no footer.
- At 1024px search measured 320px, status remained 192px, pagination wrapped below the filters, and both document and pagination overflow were 0.
- At 360px search and status used the full available 255px content width, navigation controls measured 44px, page-size remained fully visible, internal/document overflow was 0 and no bottom footer was rendered.

### Phase 1 follow-up — Services open-inspector layout correction and UX audit

Status: **SUPERSEDED on 2026-09-04** for Services, Resources and Working hours by the Business workspace modal decision below. The notes remain as historical evidence for the shared inspector pattern still used by other product areas, but they are not the current acceptance contract for these three pages.

Business outcome: opening a service inspector must preserve a readable, fully operable service list. The list toolbar may reflow, but controls must not be clipped, compressed into ambiguous labels or pushed outside the workspace.

Implemented correction:

- [x] Detect the actual wide-desktop split state instead of relying only on the viewport breakpoint.
- [x] Render Services filters and toolbar pagination as two explicit rows while the inline inspector is open.
- [x] Preserve the existing single-row desktop toolbar when the inspector is closed and the existing stacked tablet/mobile behavior.
- [x] Preserve URL-backed filters, pagination, selected-service state and inspector focus return.
- [x] Verify the corrected split toolbar at 1536px, 1742px and 1920px and verify tablet/mobile containment at 1024px and 360px.
- [x] Audit inspector semantics, scrolling, keyboard entry/exit, dirty-state protection, feedback and responsive sizing.

Live verification evidence (2026-09-03):

- At 1536px, 1742px and 1920px with the inspector open, the toolbar used `data-toolbar-layout="split"`, rendered filters above pagination and produced zero toolbar, pagination and document horizontal overflow.
- At 1742px the service list remained 924px wide and the inline inspector remained 420px wide; the search field was 320px, the status filter was 192px and all pagination controls stayed inside the list surface.
- Closing the desktop inspector restored `data-toolbar-layout="standard"`, removed the `service` URL parameter and returned focus to the selected service row. Keyboard activation reopened the inspector.
- At 1024px the inspector was exposed as an aria-modal dialog, trapped focus, locked background scrolling and kept its action footer pinned. At 360px it became a contained full-width drawer with zero horizontal overflow.
- No browser console errors or warnings were observed during the responsive interaction pass.
- `npx tsc -b --pretty false`, direct app and widget Vite production builds, `npm run check:bundle` and `git diff --check -- frontend/src/features/services/ServicesPage.tsx` passed.
- The aggregate `npm run build` gate is currently blocked before compilation by 18 missing `resources.*` i18n keys introduced in parallel Resources work. This is outside the Services patch; the successful direct builds do not reclassify the i18n gate as passed.

Audit findings and bounded follow-ups:

- [x] **P1 — Make detail-drawer width deterministic.** `Drawer` now has mutually exclusive `detail` (520px), `complex` (720px) and `custom` width contracts. Operational inspectors use `detail`; CRM entity drawers preserve `complex`; header and navigation drawers explicitly preserve their custom widths. No global class-merging dependency was added.
- [x] **P1 — Define keyboard entry into the inline inspector.** Services and Resources distinguish pointer, Space and Enter interaction. Pointer and Space preserve list focus; Enter and the explicit Open action request focus on the inspector heading. Automatic initial selection never requests focus.
- [x] **P1 — Close the Leads keyboard gap.** The desktop lead row now exposes a native, named button in the lead cell. Enter opens the same CRM entity drawer as the pointer row action, and the shared Drawer contract moves focus inside and returns it to the opener on close.
- [x] **P1 — Replace native unsaved-change confirmation.** Services and Resources now use the shared action-confirm dialog for dirty inspector close and entity switching. Cancel preserves the draft and inspector; confirm discards the local draft, closes or switches, and restores focus safely.
- [ ] **P2 — Reduce competing scroll regions on short desktop heights.** The page shell has a 620px minimum while the table and inspector bodies scroll independently. Audit the shared workspace height contract so the browser page does not become a third operational scroll region when DevTools or a short-height display is used.
- [ ] **P2 — Align inline inspector width with the design-system clamp.** The shared specification calls for `clamp(340px, 25vw, 420px)` while `OperationalWorkspace` uses a fixed 420px column. Use the clamp after cross-checking every consumer; at 1536px this should reclaim roughly 36px for the table.
- [ ] **P2 — Give touch actions a 44px minimum height.** Mobile inspector footer buttons measured 40px. Keep the close control and all primary/secondary footer actions at least 44px on touch layouts without increasing desktop density.
- [ ] **P2 — Map save validation to fields and avoid duplicate failure feedback.** The inspector currently renders a generic inline error and also raises a danger toast for the same update failure. Validation errors should be attached to the relevant form fields; reserve a single persistent summary for non-field failures and a toast for page-level/transient events.
- [ ] **P3 — Improve long-name identification.** Keep the compact desktop header, but expose the full service name on focus/hover and allow a controlled two-line title in the mobile drawer when truncation would hide the differentiating suffix.
- [ ] **P3 — Verify mobile safe-area padding.** The pinned drawer footer should include `env(safe-area-inset-bottom)` on devices with a home indicator; current Chromium emulation does not prove this platform-specific case.

P1 implementation evidence (2026-09-04):

- `frontend/e2e/inspector-interaction.spec.ts` passed in the desktop, tablet and mobile Playwright projects: 4 applicable scenarios passed and 5 project-inapplicable scenarios were explicitly skipped.
- The wide-desktop scenario verifies Space focus preservation, Enter focus transfer to the inspector heading, shared dirty-discard confirmation, draft preservation on cancel and focus return after confirmed close. The same focus-entry contract passed for Resources.
- The tablet/mobile scenario verifies a maximum 520px detail drawer, focus containment, Escape close and focus return to the service row. The Leads scenario verifies native keyboard opening, drawer focus entry, Escape close and return to the opening control.
- `npm run check:i18n` passed with 4,815 aligned RU/KK/EN keys. `npx tsc -b --pretty false`, direct app/widget Vite production builds, bundle budget and scoped `git diff --check` passed after the P1 implementation.
- A later aggregate `npm run build` reached TypeScript and is currently blocked by duplicate `workingHours.readOnlyTitle` and `workingHours.readOnlyText` properties in RU/KK/EN from parallel Working Hours work. This unrelated baseline is recorded rather than silently repaired inside the inspector phase.

### Phase 7 — AI-agents reference composition and navigation safety

Reference target: `C:/Users/user/.codex/generated_images/01a02954-6edd-74f2-8944-794408801f0d/exec-3e73626c-81f4-4aa4-9029-fb8b2244d7c1.png`. The earlier `exec-96c88cd5-c47c-4cb9-9531-2305eb86ea74.png` is a secondary density reference only. Current real bot, profile, channel, knowledge, conversation and message data remain canonical.

Bounded implementation contract:

- [x] Remove the duplicate page and nested list headings; keep `/app/ai-agents/*` identity in the shared app header.
- [x] Replace the nested agent/section tree with a searchable, status-filterable agent list and route-backed horizontal editor tabs.
- [x] Add a compact editor identity header with real agent purpose, semantic status and a permission-aware AI switch.
- [x] Recompose the editor into one calm work surface with AI-soft guidance, fewer nested card planes and a sticky profile save/cancel footer.
- [x] Preserve every existing canonical section, legacy section alias, provider setup owner, real API query and backend permission boundary.
- [x] Protect unsaved profile/tool changes when switching agents or leaving the editor; cancel must restore the last server-backed draft.
- [x] Keep AI preview/draft surfaces violet, ordinary save peach, active status green, paused warning, draft neutral and errors/danger red.
- [x] Add complete RU/KK/EN labels for list search/filtering, dirty-state confirmation and editor accessibility.
- [x] Verify direct/deep routes, read-only controls, keyboard tabs/list/switch/modal, focus return, loading/error/empty states and responsive containment.
- [x] Run i18n parity, TypeScript, frontend build, bundle budget, scoped diff checks and authenticated desktop/tablet/mobile visual checks.

Implementation evidence (2026-09-04):

- The authenticated workspace now uses one shared-header create action, a searchable/filterable real-agent list, a real agent identity and status header, route-backed horizontal tabs and a sticky draft action bar. The controller, canonical-route bridge, draft guard, modals and visual workspace are separated so `AIAgentsPage.tsx` remains 270 lines.
- Existing bot/profile/channel/knowledge/conversation/message APIs and the backend-derived `ai_automation.manage` permission remain unchanged. Provider setup continues to render the existing Telegram, WhatsApp and Instagram inline setup owners; no provider credentials or execution policy moved into the page.
- Playwright CLI checks against an isolated authenticated local environment covered canonical `/app/ai-agents` redirect, all five deep sections, roving Arrow/Home/End tab behavior, status changes, dirty-state save/reset and navigation confirmation, modal focus trap/Escape/focus return, list filtering, and create-modal initial focus.
- Mocked API checks covered loading recovery, retryable error, no-agent empty state with one global create action, and a read-only role with no enabled editor inputs, switches or save controls.
- Desktop 1536 px, tablet 1024 px and mobile 412 px checks found no document-level horizontal overflow; RU, KK and EN labels were exercised at mobile width. Visual evidence is stored under `output/playwright/ai-agents-redesign-qa/`.
- Contrast calculations passed WCAG AA for peach CTA states with ink text (`10.28:1`, `8.27:1`, `6.50:1`) and AI violet states with white text (`6.00:1`, `7.68:1`).
- `npm run check:i18n`, `npx tsc -b --pretty false`, `npm run build`, `npm run check:bundle` and scoped `git diff --check` passed for this phase. Backend tests and the aggregate repository gate were not run because this bounded phase changes no backend/domain/API contract and the shared worktree contains unrelated in-progress changes.

Explicit non-goals:

- No demo agents, sample metrics, invented CRM scopes, unsupported tools, new providers or copied reference data.
- No backend, model, endpoint, tenant-isolation, entitlement, notification, BusinessEvent or AI-execution-policy change.
- No duplicate integration credential forms; Telegram, WhatsApp and Instagram retain their existing canonical setup components.
- No attempt to redesign Outreach, Integrations or other remaining main pages in this phase.

Do not implement as part of the toolbar correction:

- Do not reduce table columns or hide service data merely to make the inspector fit.
- Do not let the toolbar become a horizontally scrolling carousel on desktop.
- Do not change shared Drawer width resolution by adding a global class-merging dependency without a repository-wide regression pass.
- Do not auto-save destructive or lifecycle state changes from the modal.

### Business workspace consolidation and modal editors — 2026-09-04

Decision: Services, Team and resources, and Working hours are low-frequency business configuration workspaces. They share one global navigation entry, but remain separate lazy-loaded routes and data controllers. Team accounts, roles and security remain in Settings.

Bounded implementation:

- [x] Replace the expandable Business group in desktop and mobile sidebar navigation with one `/app/business` entry.
- [x] Add one shared route-backed inner navigation for `/app/business/services`, `/app/business/resources` and `/app/business/working-hours`.
- [x] Keep `/app/services`, `/app/resources`, `/app/working-hours` and root legacy routes as compatibility redirects that preserve search and hash state.
- [x] Replace service and resource inspectors with centered responsive modals using the shared dimmed backdrop, focus trap and focus-return contract.
- [x] Preserve URL-backed selected entity state, dirty-draft confirmation, read-only role behavior, mutation pending/error feedback and existing forms.
- [x] Split Working hours into `Business week` and `Team and resources` views instead of stacking both datasets in one long scroll.
- [x] Add search, schedule-mode filtering and local pagination to the active-resource schedule view.
- [x] Replace the narrow Working hours inspector with an XL modal that presents all seven weekdays as one grid on wide screens and responsive cards below that breakpoint.
- [x] Keep the scheduling domain contract unchanged: one start/end interval and one day-off flag per business/resource/weekday.
- [x] Update canonical links, header route titles, pilot navigation, functional certification registry and generated fallback inventory.
- [x] RU/KK/EN key parity, TypeScript, production build, widget build, bundle budget, functional route registry and fallback inventory checks pass.
- [ ] Run the updated Business modal Playwright flow on desktop/tablet/mobile. The test was updated, but local Django startup and the existing dev auth API both hung before browser assertions could execute.
- [ ] Run current axe and visual overflow checks against the open service/resource/working-hours modals after the local backend runtime is responsive.

Do not implement:

- Do not create a separate employee-management domain or duplicate team-account settings; bookable staff remain a resource type and account access remains in Settings.
- Do not mount all three Business pages at once or fetch their datasets from one parent page.
- Do not restore persistent right inspectors on these three pages; they reduce table width and hide the complete editing context.
- Do not add multiple daily intervals, breaks, capacity or conflict controls without the corresponding scheduling-domain and API work.

Verification evidence:

- `cd frontend && npm run build` — passed with 4832 aligned i18n keys and both Vite builds.
- `cd frontend && npm run check:bundle` — passed; app shell and all route chunks remain within budget.
- `cd frontend && npm run test:bundle-budget` — passed 5/5.
- `cd frontend && npm run test:certification-registry` — passed after canonical Business routes and aliases were registered.
- `cd frontend && npm run generate:fallback-inventory` and `npm run check:fallback-inventory` — passed: 43 routes and 583 API operations.
- Playwright live route probe reached `/app/business/working-hours`, but DOM/screenshot reads stalled because the active dev backend did not answer auth/API requests.
- Isolated Playwright startup on dedicated ports and a separate temporary SQLite database also stalled before Django emitted migration output; no browser assertion is claimed as passed.

### Open or skipped checks

- `cd frontend && npm run audit:interaction` — timed out after 120 seconds without producing a result. Its broad action sweep remains open, but targeted accessibility/state coverage passed through the Playwright spec above.
- `scripts/codex_verify.sh` — skipped because `bash` is not available in the current PowerShell environment.
- Full all-route locale stress, every modal/popover/toast surface and forbidden-state matrix — not claimed complete in this pass.

## Non-goals

- No public landing redesign.
- No permanent-delete action or hard deletion of services; removal is recoverable archival only.
- No CRM lifecycle changes outside the bounded Service active/archive states and new-booking eligibility rules.
- No fake data or new marketing copy.
- No global replacement of every orange/amber usage.
- No commit or push as part of this local implementation.

## Definition of done

The implementation is complete only when the checked tasks above are backed by the actual diff and verification evidence. The final report must list changed business/UI areas, checks run, checks skipped, permission/API impact, i18n impact, AI/notification impact and remaining visual risks.
