# ZANI App 2.0 And Workbench Execution Roadmap

Date: 2026-07-17
Status: Active execution checklist
Scope: authenticated `/app` only

This is the working checklist for the ZANI App 2.0 UI/UX implementation.

Use this file to answer:

- what was completed last;
- what phase is active now;
- what should be implemented next;
- which verification gate is required before checking a task as done.

Do not use this document to redesign the public landing page or to change CRM backend business rules. Backend/API changes are allowed only when a UI workflow needs an existing production contract exposed safely.

## 1. Source Documents

Primary implementation plan:

- `actual_docs/APP_UI_UX_REDESIGN_TASK.md`

Product and workflow map:

- `actual_docs/CRM_TECHNICAL_MAP_AND_VERTICAL_MODES.md`
- `actual_docs/CRM_CORE_WORKFLOW_AUDIT.md`
- `actual_docs/CRM_PHASE_2A_HARDENING_EVIDENCE.md`
- `CRM_PRODUCTION_LAYER_PLAN.md`
- `API_ACTION_CONTRACT.md`

Design system and visual direction:

- `docs/design-system.md`
- `docs/WARM_PREMIUM_CRM_REDESIGN_BRIEF.md`
- `plan/ui_ux_design_system_reform.md`

Engineering rules:

- `AGENTS.md`
- `plan/clean_code_rules/zani_required_clean_code_rules.md`
- `docs/testing.md`

## 2. Current Direction

Build `ZANI App 2.0` as a premium operational CRM workbench:

- one authenticated app shell;
- one Warm Premium visual system;
- one workbench layout rhythm;
- one entity experience model;
- one shared component contract;
- real backend/API data only;
- no decorative authenticated pages;
- no fake dashboard blocks;
- no page-local handcrafted controls when a shared primitive should exist.

Visual direction:

```text
Warm Premium CRM
Warm ivory workspace + copper-orange actions + plum AI accent
```

## 3. Current Status Snapshot

Completed before this roadmap:

- [x] Core CRM workflow audit completed.
- [x] Phase 2A hardening/evidence pass completed.
- [x] User-scoped CRM card `available_action_details` contract completed.
- [x] Workspace related data strategy completed.
- [x] Warm Premium visual direction documented.
- [x] Typography direction documented.
- [x] Component interaction contract documented.
- [x] Client full workspace route created: `/app/clients/:id`.
- [x] Client workspace edit/tag/archive actions added.
- [x] Lead full workspace route created: `/app/leads/:id`.
- [x] Deal full workspace route created: `/app/deals/:id`.
- [x] Shared `EntityWorkspace` primitives added for client/lead/deal.
- [x] Frontend build passed after the last entity workspace implementation.
- [x] Bundle check passed after the last entity workspace implementation.

Active stage now:

```text
Phase 1: Design System Foundation
Phase 2: Entity Experience
Phase 3: AppShell 2.0 / WorkbenchLayout foundation
```

Practical meaning:

- the CRM backend foundation is strong enough for App 2.0 UI work;
- entity workspace work has started;
- the global AppShell / WorkbenchLayout / shared primitives layer is not complete yet;
- future page redesign should not continue as isolated page restyling.

## 4. Execution Rules

Before starting a task:

- read this roadmap;
- read the relevant source document from section 1;
- inspect current frontend components before creating new ones;
- identify data/API source, user role, permissions, states and verification gate.

During implementation:

- use existing API clients under `frontend/src/api/*`;
- use shared UI primitives before adding page-local classes;
- avoid raw `bg-slate-*`, `bg-blue-*`, random gradients, `font-black`, `rounded-3xl`, and hover translate effects unless explicitly approved by the design system;
- keep AI surfaces plum/violet and ordinary CRM actions copper-orange;
- keep status colors semantic;
- keep visible authenticated blocks connected to navigation, real data, action, form, entity view, analytics, status, alert or real empty state.

When a task is complete:

- run the verification gate listed for the task;
- update this file by changing `[ ]` to `[x]`;
- add a short dated checkpoint under section 14;
- do not mark a checkbox complete if verification did not pass.

## 5. Phase 0: Documentation And Contract Baseline

Goal:

Make sure App 2.0 starts from a stable product and technical contract.

Tasks:

- [x] Map primary `/app` routes and current feature coverage.
- [x] Compare backend CRM capabilities with frontend reachability.
- [x] Define App 2.0 entity workspace direction.
- [x] Keep vertical adaptation out of the immediate UI foundation phase.
- [x] Document Warm Premium CRM direction.
- [x] Document component interaction contract.
- [x] Document typography direction and font stack.
- [x] Decide whether this roadmap fully replaces ad-hoc UI task tracking.
- [ ] Add a cross-reference from `actual_docs/APP_UI_UX_REDESIGN_TASK.md` to this roadmap.

Verification:

- docs-only sanity check: `git diff --check -- actual_docs/APP_2_WORKBENCH_EXECUTION_ROADMAP.md`

## 6. Phase 1: Design System Foundation

Goal:

Turn Warm Premium design decisions into shared frontend primitives and tokens before more page work.

Tasks:

- [x] Update CSS variables / global styles to Warm Premium tokens.
- [x] Update Tailwind aliases while preserving semantic names where possible.
- [ ] Decide and implement authenticated app font loading strategy.
- [ ] Add Manrope Variable self-hosted font package or approved equivalent.
- [ ] Keep Noto Sans and Inter fallback behavior.
- [ ] Update shared `Button` variants: primary, secondary, ghost, outline, danger, ai, icon.
- [ ] Ensure button sizes follow the documented `sm`, `md`, `lg`, `icon` scale.
- [ ] Add or promote shared `Switch` / `ToggleSwitch` primitive.
- [ ] Update shared `Input`, `Textarea`, `Select`, `SearchableSelect` visual states.
- [ ] Update shared `Tabs`, segmented controls and filter chips.
- [ ] Update shared `Badge` and `StatusBadge` semantics.
- [ ] Update shared `Card`, `Surface`, table surface and drawer surface helpers.
- [ ] Update shared modal, popover, toast and state-view surfaces.
- [ ] Remove or isolate old decorative gradient / blue-primary patterns from shared primitives.
- [ ] Verify long Russian/Kazakh labels in controls.
- [ ] Verify keyboard focus, disabled, loading, error and success states in shared primitives.

Acceptance:

- new pages can be assembled from shared primitives without page-local component styling;
- Warm Premium tokens exist in reusable CSS/Tailwind form;
- primary actions use copper-orange;
- AI controls use plum/violet;
- status colors remain semantic;
- no public landing changes are included.

Verification:

- `cd frontend && npm run build`
- `cd frontend && npm run check:bundle`
- targeted visual/manual screenshots for shared primitives if a local dev server is used

## 7. Phase 2: AppShell 2.0 Foundation

Goal:

Make the authenticated `/app` shell feel like one premium product frame.

In scope:

- sidebar;
- top header;
- global search / command search;
- notifications;
- business/user context where applicable;
- mobile bottom navigation;
- mobile drawer navigation;
- consistent page container;
- consistent loading/error/forbidden shell states.

Tasks:

- [ ] Audit current `AppLayout`, `Header`, `Sidebar`, `MobileNav`, `GlobalSearch`, `CommandPalette`.
- [ ] Define whether to introduce explicit `AppShell` component or evolve `AppLayout`.
- [ ] Apply Warm Premium background and surface rules to authenticated shell.
- [ ] Simplify header visual weight and avoid overloaded controls.
- [ ] Align header search/filter/notification surfaces with shared primitives.
- [ ] Align sidebar active, hover, collapsed and expanded states with Warm Premium tokens.
- [ ] Ensure sidebar contains daily business navigation first and keeps rare technical controls secondary.
- [ ] Align mobile drawer with the same shell model.
- [ ] Ensure mobile navigation prioritizes Dashboard, Leads, Clients, Conversations and More.
- [ ] Ensure notifications do not block core workflow on mobile.
- [ ] Standardize route loading, route error and forbidden states inside shell.
- [ ] Confirm platform/admin layout remains separate where needed.

Acceptance:

- every authenticated merchant route uses the same shell background and spacing rhythm;
- shell renders correctly on desktop and mobile;
- role-aware navigation remains intact;
- global search and notifications remain reachable;
- no landing/public route changes are included.

Verification:

- `cd frontend && npm run build`
- `cd frontend && npm run check:bundle`
- Playwright or manual visual QA for desktop and mobile shell routes

## 8. Phase 3: WorkbenchLayout Foundation

Goal:

Create the common layout rhythm for all primary working pages.

Target structure:

```text
AppShell
  WorkbenchLayout
    PageHeader
      title
      short operational subtitle
      primary action
      secondary actions
    Metrics / compact status row
    ViewTabs / saved views
    Toolbar
      search
      filters
      columns/view controls
      import/export when relevant
    MainWorkspace
    ContextPanel / QuickInspector when relevant
```

Tasks:

- [ ] Audit current page-level layout wrappers and control bars.
- [ ] Define `WorkbenchLayout` API and slots.
- [ ] Implement shared `WorkbenchLayout` component.
- [ ] Implement or align shared `PageHeader` for operational pages.
- [ ] Implement shared `MetricStrip` / compact status row pattern.
- [ ] Implement shared `Toolbar` composition for search, filters and view controls.
- [ ] Implement shared `ViewTabs` / saved-view-ready pattern.
- [ ] Implement `MainWorkspace` surface pattern for table, kanban, inbox, calendar and analytics.
- [ ] Implement `ContextPanel` / `QuickInspector` layout slot.
- [ ] Standardize empty, loading, error, forbidden and filtered-empty placement inside workbench.
- [ ] Document the WorkbenchLayout usage examples.

Acceptance:

- primary CRM pages can share one layout rhythm while keeping their own content;
- filters do not create extra page-level background noise;
- selected object context can appear without disruptive overlay;
- mobile layout remains coherent and does not become nested card piles.

Verification:

- `cd frontend && npm run build`
- `cd frontend && npm run check:bundle`
- desktop/mobile visual QA on at least one table page, one board page and one split-workspace page

## 9. Phase 4: Entity Experience

Goal:

Finish the entity model so users can understand and act on client, lead, deal, task, appointment and conversation records without jumping across the app.

Already completed:

- [x] Client full workspace route.
- [x] Client workspace related data.
- [x] Client workspace edit/tag/archive actions.
- [x] Lead full workspace route.
- [x] Deal full workspace route.
- [x] Shared `EntityWorkspace` shell for client/lead/deal.

Remaining tasks:

- [ ] Convert client/lead/deal `available_action_details` into a shared executable action bar.
- [ ] Add guarded confirmations for destructive and reason-required actions.
- [ ] Add lead workspace executable actions where backend actions already exist.
- [ ] Add deal workspace executable actions where backend actions already exist.
- [ ] Define stage movement UI separately from simple deal action buttons.
- [ ] Run desktop/mobile visual QA for client, lead and deal workspaces.
- [ ] Define QuickInspector responsibilities versus Full Entity Workspace.
- [ ] Reduce old query-param drawer behavior to transitional fallback.
- [ ] Add task full workspace if product workflow needs deep task view.
- [ ] Add appointment full workspace if product workflow needs deep appointment view.
- [ ] Add conversation full workspace or inbox-thread deep link model.
- [ ] Ensure every entity workspace has loading, error, empty and forbidden states.

Acceptance:

- client workspace exposes conversations, leads, deals, tasks, appointments, timeline and source context;
- lead and deal workspaces expose lifecycle actions and related context;
- task/appointment/conversation deep work has a clear target model;
- old half-screen drawer is no longer the main deep-work pattern.

Verification:

- `cd frontend && npm run build`
- `cd frontend && npm run check:bundle`
- relevant backend/action tests only when API contracts are changed
- desktop/mobile visual QA for entity workspace trio

## 10. Phase 5: Core CRM Workbenches

Goal:

Bring the main CRM work pages onto the shared workbench pattern.

Page order:

1. Settings as visual reference cleanup when shared primitives are ready.
2. Dashboard.
3. Leads.
4. Clients.
5. Deals.
6. Tasks.

Tasks:

- [ ] Refactor Settings to remove background nesting and use shared primitives.
- [ ] Refactor Dashboard into action-oriented daily cockpit, not decorative summary.
- [ ] Refactor Leads into queue/table plus selected context and next actions.
- [ ] Refactor Clients into operational client list plus context/workspace links.
- [ ] Refactor Deals into pipeline/workbench with stage, value, owner, next action and risk visibility.
- [ ] Refactor Tasks into operational workbench with assignee, priority, due date, relation and action flow.
- [ ] Ensure each page exposes loading, empty, filtered-empty, error and forbidden states.
- [ ] Ensure tables/lists expose operational fields: status, source, responsible, next action, last activity where relevant.
- [ ] Ensure page-specific copy comes from i18n/constants and not random static page text.

Acceptance:

- pages share one visual and interaction language;
- page content remains connected to real backend workflows;
- no page looks like an isolated prototype;
- no page has three or four neutral backgrounds in normal state.

Verification:

- `cd frontend && npm run build`
- `cd frontend && npm run check:bundle`
- desktop/mobile visual QA after each page group

## 11. Phase 6: Daily Operations Workbenches

Goal:

Make daily work surfaces feel complete and role-aware.

Pages:

- Conversations / Inbox;
- Calendar;
- Dashboard daily cockpit.

Tasks:

- [ ] Refactor Conversations into a coherent inbox/list/thread/context workspace.
- [ ] Keep conversation-to-CRM actions clear and connected to backend services.
- [ ] Refactor Calendar into a coherent scheduling workbench with appointment lifecycle actions.
- [ ] Ensure calendar mobile agenda remains usable and not a broken desktop copy.
- [ ] Refactor Dashboard for owner/manager/operator daily priorities.
- [ ] Ensure AI dashboard surfaces show source/no-data/provider-unavailable/forbidden states.
- [ ] Ensure notifications and escalations are visible without creating noise.

Acceptance:

- operators can work from inbox without unnecessary navigation;
- staff/manager can understand schedule and tasks quickly;
- owner dashboard shows action-oriented business state, not vanity totals.

Verification:

- `cd frontend && npm run build`
- focused Playwright smoke for owner/manager/operator routes where available
- desktop/mobile visual QA

## 12. Phase 7: Control Surfaces

Goal:

Make technical/admin-heavy surfaces merchant-readable and visually aligned.

Pages:

- Integrations;
- Automations;
- AI Assistant / AI Analyst;
- Analytics;
- Outreach;
- Settings remaining sections;
- Account and billing-related routes where applicable.

Tasks:

- [ ] Refactor Integrations so provider complexity is progressively disclosed.
- [ ] Ensure integration status labels follow live/mock/readiness semantics.
- [ ] Refactor Automations so run state, affected objects and retry safety are merchant-readable.
- [ ] Refactor AI Assistant / Analyst surfaces around source, no-data, provider and approval states.
- [ ] Refactor Analytics into operational answers rather than vanity cards.
- [ ] Refactor Outreach using shared campaign/control surfaces.
- [ ] Ensure Settings does not become an overloaded admin maze.

Acceptance:

- daily merchant workflows are not dominated by connector console details;
- AI is visually distinct and source-grounded;
- automations and integrations explain business impact;
- settings are grouped by merchant mental model.

Verification:

- `cd frontend && npm run build`
- `cd frontend && npm run check:bundle`
- focused visual QA for integrations, AI, automations and settings

## 13. Phase 8: QA And Cutover

Goal:

Prove App 2.0 can replace the old mixed UI safely.

Tasks:

- [ ] Run full frontend build.
- [ ] Run bundle check.
- [ ] Run desktop visual QA for primary authenticated routes.
- [ ] Run mobile visual QA for primary authenticated routes.
- [ ] Run owner role smoke.
- [ ] Run manager role smoke.
- [ ] Run operator role smoke.
- [ ] Verify no horizontal overflow.
- [ ] Verify no text overlap with Russian/Kazakh long labels.
- [ ] Verify loading/error/empty/forbidden states on primary pages.
- [ ] Verify global search, command palette and notifications.
- [ ] Verify old drawer/deep-link fallbacks where intentionally retained.
- [ ] Update this roadmap and relevant source docs with final status.

Acceptance:

- all primary `/app` pages use the new shell or approved transitional wrapper;
- all primary CRM pages follow a shared workbench pattern;
- entity deep work no longer depends on a cramped half-screen drawer;
- existing backend flow tests remain valid;
- frontend build and relevant smokes pass.

Verification:

- `cd frontend && npm run build`
- `cd frontend && npm run check:bundle`
- relevant Playwright desktop/mobile/role smokes
- backend checks only when backend contracts are touched

## 14. Implementation Checkpoints

### 2026-07-16: Entity Workspace Foundation Started

Completed:

- client workspace route and related data;
- client workspace edit/tag/archive actions;
- lead workspace route;
- deal workspace route;
- shared `EntityWorkspace` primitives for client/lead/deal.

Verification:

- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed after shared shell slice.

Next open work from that checkpoint:

- shared executable entity action bar;
- desktop/mobile visual QA for client/lead/deal entity workspace trio;
- AppShell 2.0 and WorkbenchLayout foundation.

### 2026-07-17: Roadmap Consolidated

Completed:

- consolidated App 2.0, WorkbenchLayout, Warm Premium and Entity Experience tasks into this active checklist.

Verification:

- docs-only diff check required.

### 2026-07-21: Phase 1A Warm Premium Tokens

Completed:

- updated global CSS variables to Warm Premium CRM tokens;
- updated Tailwind `zani`, `primary`, `brand`, `ai` and `surface` aliases while preserving existing semantic names;
- updated shared global focus, selection, overlay, AI surface, scrollbar and shadow values away from the old blue/slate foundation.

Verification:

- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.

Skipped:

- self-hosted Manrope package is not added yet and remains an open Phase 1 font task;
- visual QA is deferred until shared primitives/AppShell surfaces are updated enough for a meaningful screenshot pass.

## 15. Next Recommended Task

Start with Phase 1 and Phase 2 foundation before redesigning more pages:

1. update shared primitives enough to support AppShell and WorkbenchLayout;
2. implement AppShell 2.0 shell pass;
3. implement WorkbenchLayout;
4. then continue entity actions and page workbenches.

Reason:

If page redesign continues before shared tokens and layout primitives are stable, the product will again drift into page-local backgrounds, buttons, cards and inconsistent states.
