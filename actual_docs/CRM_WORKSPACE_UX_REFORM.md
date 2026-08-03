# CRM Workspace UX Reform

Status: `ACTIVE` - UX-2 complete; stopped at the phase gate
Owner: UI/UX
Started: 2026-08-03
Source: owner browser review of `/app`, `/app/leads`, `/app/deals` and
`/app/clients` on the current local integration build.

## Product outcome

Make the authenticated CRM faster to scan and operate without turning it into
an admin console. Entity lists remain the primary working context; entity
details appear above that context and do not permanently consume table or
kanban width.

## Interaction contract

- a normal click on a lead, client or deal opens the shared CRM entity overlay;
- the list/kanban remains mounted behind the overlay, preserving filters,
  scroll position and working context;
- `Escape`, backdrop click and the close action dismiss the overlay and restore
  focus to the opener;
- direct `/app/<entity>/<id>` routes remain supported for deep links and full
  entity workspaces;
- desktop rows expose one compact overflow action instead of a cluster of
  repetitive icon buttons; right click may open the same quick-action surface;
- touch and keyboard users never depend on right click;
- authenticated pages use available width for business data and do not add
  decorative or explanatory blocks.

## Phase UX-1 - Entity workspace foundation

Status: `DONE`

- [x] remove the permanent quick inspector from Leads, Clients and Deals;
- [x] remove automatic first-row selection that opens or reserves context;
- [x] make the three workspaces use the full available application width;
- [x] make row/card click open the shared CRM entity overlay;
- [x] reduce desktop Leads and Clients row action clusters to one overflow action;
- [x] preserve direct detail routes, bulk selection and existing domain actions;
- [x] verify production frontend build;
- [x] verify desktop and mobile behavior in Playwright;
- [x] verify drawer focus, keyboard close and return-to-list context.

Completion evidence (2026-08-03):

- production frontend and widget build passed with `4623` aligned RU/KK/EN
  keys;
- bundle gate passed: app shell `262.13 kB` before gzip against the `400 kB`
  budget and no JavaScript chunk exceeded `500 kB`;
- focused CRM workspace Playwright passed `2` runnable tests with `2`
  intentional project skips across 1920px desktop and Pixel 7 mobile;
- the focused accessibility regression passed `1/1`, including conditional
  unmount, keyboard close, focus trap and focus restoration;
- manual Playwright inspection confirmed full-width Leads, Clients and Deals,
  no overlapping context control and the shared overlay preserving list state;
- no backend, migration, environment, dependency, permission, notification,
  BusinessEvent, AI, integration, vertical or `main` change.

## Phase UX-2 - Deals workspace and pipeline language

Status: `DONE`

- [x] canonicalize duplicate English/Russian stage data through the CRM domain
  layer instead of hiding backend data with frontend translations;
- [x] make horizontal kanban navigation persistent and obvious;
- [x] increase visible board area and preserve drag/drop, filters and permissions;
- [x] verify existing merchants and migrations before changing stage data.

Completion evidence (2026-08-03):

- the local integration database was inspected before migration and contained
  one pipeline with `12` stages: six dentistry/Russian stages plus six English
  defaults created by a non-idempotent fallback;
- migration `crm.0010_pipeline_stage_canonicalization` keeps six canonical
  generic active stages, preserves the six duplicate stage rows as inactive
  history, remaps current/previous deal pointers and changes the pipeline
  template from `onboarding_dentistry` to `smb_default`;
- `ensure_default_pipeline` now creates one generic six-stage template only for
  an empty pipeline and never silently extends an existing custom pipeline;
- inactive stages are excluded from merchant stage lists, kanban payloads,
  terminal actions and AI draft-deal stage selection, and backend validation
  rejects moving a deal into an inactive stage;
- the desktop board uses all available width for the six canonical stages;
  cards no longer repeat the stage name and are capped by browser evidence at
  `112 px`, keeping all six local deals visible in one column without vertical
  paging at 1920x1080;
- narrow desktop/tablet widths retain a real horizontal scroll path to the last
  stage instead of clipping columns;
- all `28` CRM backend tests passed; Django system check and migration drift
  check passed;
- production frontend/widget build passed with `4629` aligned RU/KK/EN keys;
  bundle gate passed with app shell `262.13 kB` before gzip against the `400 kB`
  budget and no JavaScript chunk over `500 kB`;
- focused Playwright passed `2` runnable scenarios with `2` intentional
  project skips across 1920px desktop and 1024px tablet;
- the owner-requested density follow-up gives `/app/deals` an edge-to-edge
  workspace, keeps the filter/search controls in one compact row and uses an
  explicit six-column desktop grid so `Потеряно` is fully visible without a
  horizontal scroll while tablet widths preserve deliberate navigation;
- permission scopes, notifications, BusinessEvents and deal lifecycle services
  were not broadened; the only AI impact is excluding inactive stages from
  draft-deal selection.

## Phase UX-3 - Owner and administrator dashboard

Status: `PLANNED`

- rebuild the information hierarchy around real revenue, operating health,
  team performance, urgent exceptions and today's decisions;
- keep connector health compact unless attention is required;
- remove low-value duplication and large empty surfaces;
- keep no-data and unavailable-source states explicit and honest.

## Phase UX-4 - Final browser certification

Status: `PLANNED`

- repeat the authenticated desktop/mobile browser audit;
- verify loading, empty, error, forbidden and real-data states;
- run accessibility, interaction, visual and bundle gates;
- document remaining defects separately from new product ideas.

## Explicit non-goals

- no backend lifecycle change in UX-1;
- no new CRM entity or vertical behavior;
- no removal of Deals or dentistry-specific adaptation;
- no redesign of Tasks, Calendar, Inbox or Settings in UX-1;
- no production credentials, live integrations or `main` changes.
