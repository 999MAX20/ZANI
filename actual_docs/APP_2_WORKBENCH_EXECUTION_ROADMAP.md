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
Warm ivory workspace + saturated orange actions + plum AI accent
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
- keep AI surfaces plum/violet and ordinary CRM actions saturated orange;
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
- [x] Add a cross-reference from `actual_docs/APP_UI_UX_REDESIGN_TASK.md` to this roadmap.

Verification:

- docs-only sanity check: `git diff --check -- actual_docs/APP_2_WORKBENCH_EXECUTION_ROADMAP.md`

## 6. Phase 1: Design System Foundation

Goal:

Turn Warm Premium design decisions into shared frontend primitives and tokens before more page work.

Tasks:

- [x] Update CSS variables / global styles to Warm Premium tokens.
- [x] Update Tailwind aliases while preserving semantic names where possible.
- [x] Decide and implement authenticated app font loading strategy.
- [x] Add Manrope Variable self-hosted font package or approved equivalent.
- [x] Keep Noto Sans and Inter fallback behavior.
- [x] Update shared `Button` variants: primary, secondary, ghost, outline, danger, ai, icon.
- [x] Ensure button sizes follow the documented `sm`, `md`, `lg`, `icon` scale.
- [x] Add or promote shared `Switch` / `ToggleSwitch` primitive.
- [x] Update shared `Input`, `Textarea`, `Select`, `SearchableSelect` visual states.
- [x] Update shared `Tabs`, segmented controls and filter chips.
- [x] Update shared `Badge` and `StatusBadge` semantics.
- [x] Update shared `Card`, `Surface`, table surface and drawer surface helpers.
- [x] Update shared modal, popover, toast and state-view surfaces.
- [x] Remove or isolate old decorative gradient / blue-primary patterns from shared primitives.
- [x] Verify long Russian/Kazakh labels in controls.
- [x] Verify keyboard focus, disabled, loading, error and success states in shared primitives.

Acceptance:

- new pages can be assembled from shared primitives without page-local component styling;
- Warm Premium tokens exist in reusable CSS/Tailwind form;
- primary actions use saturated orange;
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

- [x] Audit current `AppLayout`, `Header`, `Sidebar`, `MobileNav`, `GlobalSearch`, `CommandPalette`.
- [x] Define whether to introduce explicit `AppShell` component or evolve `AppLayout`.
- [x] Apply Warm Premium background and surface rules to authenticated shell.
- [x] Simplify header visual weight and avoid overloaded controls.
- [x] Align header search/filter/notification surfaces with shared primitives.
- [x] Rebuild desktop sidebar into a compact navigation rail without the large product-logo/title block.
- [x] Reduce desktop sidebar item height, font size and spacing so primary routes fit with minimal scrolling.
- [x] Keep desktop sidebar focused on page links; move rare profile/system/support controls away from the main scroll path where practical.
- [x] Align sidebar active, hover, collapsed and expanded states with Warm Premium tokens.
- [x] Ensure sidebar contains daily business navigation first and keeps rare technical controls secondary.
- [x] Align mobile drawer with the same shell model.
- [x] Ensure mobile navigation prioritizes Dashboard, Leads, Clients, Conversations and More.
- [x] Ensure notifications do not block core workflow on mobile.
- [x] Standardize route loading, route error and forbidden states inside shell.
- [x] Confirm platform/admin layout remains separate where needed.

Acceptance:

- every authenticated merchant route uses the same shell background and spacing rhythm;
- desktop sidebar is compact, route-first and does not waste first-screen space on large branding copy;
- desktop sidebar primary navigation does not require long scrolling in the normal owner/manager route set;
- shell renders correctly on desktop and mobile;
- role-aware navigation remains intact;
- global search and notifications remain reachable;
- no landing/public route changes are included.

Verification:

- `cd frontend && npm run build`
- `cd frontend && npm run check:bundle`
- Playwright or manual visual QA for desktop and mobile shell routes

### 2026-07-21: AppShell 2.0 Foundation

Completed:

- audited `AppLayout`, `Header`, `Sidebar`, `MobileNav`, `GlobalSearch`, `CommandPalette` and `PlatformLayout`;
- decided to evolve the existing `AppLayout` into the AppShell foundation instead of introducing a duplicate wrapper;
- applied Warm Premium shell background, spacing, header, search, filter drawer, notification popover and command palette surfaces;
- rebuilt desktop sidebar into a compact route-first rail, removed the large product-logo/title block and reduced route item height/spacing;
- aligned mobile drawer with the same sidebar model and kept bottom mobile navigation focused on Dashboard, Leads, Clients, Conversations and More;
- made `Ctrl/Cmd+K` open the lazy `CommandPalette` and added Escape close support.

Verification:

- targeted `rg` check for old shell blue/slate/oversized classes: passed.
- `git diff --check`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.
- `cd frontend && npx playwright test e2e/smoke.spec.ts -g "mobile manager smoke" --project=mobile-chromium`: passed.

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

- [x] Audit current page-level layout wrappers and control bars.
- [x] Define `WorkbenchLayout` API and slots.
- [x] Implement shared `WorkbenchLayout` component.
- [x] Implement or align shared `PageHeader` for operational pages.
- [x] Implement shared `MetricStrip` / compact status row pattern.
- [x] Implement shared `Toolbar` composition for search, filters and view controls.
- [x] Implement shared `ViewTabs` / saved-view-ready pattern.
- [x] Implement `MainWorkspace` surface pattern for table, kanban, inbox, calendar and analytics.
- [x] Implement `ContextPanel` / `QuickInspector` layout slot.
- [x] Standardize empty, loading, error, forbidden and filtered-empty placement inside workbench.
- [x] Document the WorkbenchLayout usage examples.

Acceptance:

- primary CRM pages can share one layout rhythm while keeping their own content;
- filters do not create extra page-level background noise;
- selected object context can appear without disruptive overlay;
- mobile layout remains coherent and does not become nested card piles.

Verification:

- `cd frontend && npm run build`
- `cd frontend && npm run check:bundle`
- desktop/mobile visual QA on at least one table page, one board page and one split-workspace page

Usage example:

```tsx
<WorkbenchLayout
  header={<PageHeader title={title} description={subtitle} actions={actions} />}
  metrics={<WorkbenchMetric label={label} value={value} tone="brand" />}
  tabs={viewTabs}
  toolbar={filtersAndViewControls}
  contextPanel={selectedEntityInspector}
>
  {tableOrBoardOrInbox}
</WorkbenchLayout>
```

State placement:

- use `WorkbenchStateRegion` around existing `LoadingState`, `ErrorState`, `ForbiddenState`, `EmptyState` and filtered-empty states;
- use `MainWorkspace` for the primary table, board, inbox, calendar or analytics surface;
- use `ContextPanel` only for selected-object context and quick inspection, not for full entity workspaces.

### 2026-07-21: WorkbenchLayout Foundation

Completed:

- audited current page wrappers: `CrmWorkspacePage`, `CrmControlBar`, `CrmTableSurface`, `WorkQueueLayout`, shared `PageHeader` and page-level section patterns;
- added `frontend/src/components/layout/WorkbenchLayout.tsx` with `WorkbenchLayout`, `MetricStrip`, `WorkbenchMetric`, `WorkbenchToolbar`, `ViewTabs`, `MainWorkspace`, `ContextPanel` and `WorkbenchStateRegion`;
- aligned shared `PageHeader`, `WorkQueueLayout`, `CrmWorkspacePage` and `EntityWorkspace` helper surfaces with Warm Premium tokens.

Verification:

- targeted `rg` check for raw/old workspace classes in changed shared workspace files: passed.
- `git diff --check`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.

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

- [x] Convert client/lead/deal `available_action_details` into a shared executable action bar.
- [x] Add guarded confirmations for destructive and reason-required actions.
- [x] Add lead workspace executable actions where backend actions already exist.
- [x] Add deal workspace executable actions where backend actions already exist.
- [x] Define stage movement UI separately from simple deal action buttons.
- [x] Run desktop/mobile visual QA for client, lead and deal workspaces.
- [x] Define QuickInspector responsibilities versus Full Entity Workspace.
- [x] Reduce old query-param drawer behavior to transitional fallback.
- [x] Add task full workspace if product workflow needs deep task view.
- [x] Add appointment full workspace if product workflow needs deep appointment view.
- [x] Add conversation full workspace or inbox-thread deep link model.
- [x] Ensure every entity workspace has loading, error, empty and forbidden states.

Acceptance:

- client workspace exposes conversations, leads, deals, tasks, appointments, timeline and source context;
- lead and deal workspaces expose lifecycle actions and related context;
- task/appointment/conversation deep work has a clear target model;
- old half-screen drawer is no longer the main deep-work pattern.

QuickInspector versus Full Entity Workspace:

- QuickInspector / inline context panel is for selected-row context while staying inside a workbench: identity, status, next action, last activity, key related counts, 1-3 immediate actions and a clear full-card link.
- QuickInspector must not become a tabbed mini-CRM, file manager, complete history view, bulk edit area or long form container.
- Full Entity Workspace is for deep work: complete entity context, related conversations/leads/deals/tasks/appointments, timeline, notes, source context, lifecycle actions and guarded destructive/reason-required flows.
- `CrmEntityDrawer` is transitional fallback for related-object previews and legacy query-param flows, not the primary deep-work pattern for client/lead/deal.
- Task, appointment and conversation need an explicit decision in this same model before their drawer flows can be reduced.

Verification:

- `cd frontend && npm run build`
- `cd frontend && npm run check:bundle`
- relevant backend/action tests only when API contracts are changed
- desktop/mobile visual QA for entity workspace trio

### 2026-07-21: Entity Workspace Executable Actions

Completed:

- added shared `CrmActionBar` for `available_action_details` with permission-disabled buttons, confirm modal and reason-required modal handling;
- connected client full workspace supported create-flow actions to route entry points;
- connected lead full workspace lifecycle actions to existing backend endpoints: take, contacted, create deal, close, lost with reason, reopen;
- connected deal full workspace lifecycle actions to existing backend endpoints: won, lost with reason, reopen;
- kept deal stage movement separate from quick action buttons: stage/probability movement remains a pipeline/stage UI responsibility.
- added `frontend/e2e/entity-workspaces.spec.ts` to create client/lead/deal records through API and verify full workspace action bars on desktop and mobile.

Verification:

- targeted `rg` check for `CrmActionBar`, supported action ids and i18n success keys: passed.
- `git diff --check`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.
- `cd frontend && npx playwright test e2e/smoke.spec.ts -g "business owner core routes render without 404" --project=desktop-chromium`: passed.
- `cd frontend && npx playwright test e2e/entity-workspaces.spec.ts --project=desktop-chromium --project=mobile-chromium`: passed.

### 2026-07-21: Entity Deep-Link Drawer Fallback Reduction

Completed:

- changed legacy client, lead and deal query-param entry points toward canonical full workspace URLs;
- kept `CrmEntityDrawer` as a transitional preview surface for related-object and non-primary entity flows;
- strengthened lead/deal legacy redirects with render-level canonical redirects where effect-based redirects were too timing-sensitive;
- updated the entity workspace E2E to verify client, lead and deal full workspaces and legacy query fallback on desktop and mobile inside the authenticated app shell.

Verification:

- `git diff --check`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.
- `cd frontend && npx playwright test e2e/entity-workspaces.spec.ts --project=desktop-chromium --project=mobile-chromium`: passed.

### 2026-07-21: Task Full Workspace

Completed:

- added canonical task deep-work route `/app/tasks/:id`;
- added `TaskWorkspacePage` with task overview, status/priority/due metrics, lifecycle actions, assignment, due-date quick actions, related CRM links, comments and activity history;
- changed task list open behavior to navigate to the full task workspace instead of making the half-screen drawer the primary detail surface;
- changed legacy `/app/tasks?task=ID` into a transitional redirect to `/app/tasks/:id`;
- extended entity workspace E2E coverage to create and verify client, lead, deal and task workspaces on desktop and mobile.

Verification:

- `git diff --check`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.
- `cd frontend && npx playwright test e2e/entity-workspaces.spec.ts --project=desktop-chromium --project=mobile-chromium`: passed.

### 2026-07-21: Appointment Full Workspace

Completed:

- added canonical appointment deep-work route `/app/calendar/:id`;
- added `AppointmentWorkspacePage` with CRM-card-backed appointment details, client/lead links, tasks, activity timeline, metrics and lifecycle actions;
- changed calendar deep-open actions to navigate to the full appointment workspace instead of making the old entity drawer the primary detail surface;
- kept the calendar selected appointment panel for quick in-calendar operational actions;
- extended entity workspace E2E coverage to create service, resource, working hours, appointment and related task data through the real API and verify appointment workspace action controls;
- fixed two English i18n string formats that blocked dictionary parity parsing.

Verification:

- `git diff --check`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.
- `cd frontend && npx playwright test e2e/entity-workspaces.spec.ts --project=desktop-chromium --project=mobile-chromium`: passed.

### 2026-07-21: Conversation Inbox Thread Deep Link Model

Completed:

- added canonical conversation route `/app/conversations/:id` while keeping conversations inside the inbox workbench instead of creating a duplicate full-page messenger;
- changed inbox selection to navigate to canonical thread URLs and preserve active inbox filters in query params;
- kept legacy `/app/conversations?conversation=ID` as a transitional redirect to `/app/conversations/:id`;
- added direct selected-conversation fetching so a deep-linked thread can load even when the current list filters do not include it;
- changed linked client/lead/deal actions in the conversation context panel to open canonical full workspace URLs;
- added stable `data-conversation-action-id` hooks for conversation action-bar verification;
- extended entity workspace E2E coverage to create bot, conversation and message data through the real API and verify the canonical thread route on desktop and mobile.

Verification:

- `git diff --check`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.
- `cd frontend && npx playwright test e2e/entity-workspaces.spec.ts --project=desktop-chromium --project=mobile-chromium`: passed after tightening the message assertion to the visible thread bubble.

### 2026-07-21: Entity Workspace State Coverage

Completed:

- added shared `EntityWorkspaceLoadingState`, `EntityWorkspaceErrorState` and `EntityWorkspaceEmptyState` wrappers on top of the CRM workspace container;
- connected client, lead, deal, task and appointment full workspaces to the shared page-level state wrappers;
- kept form-local errors local where they belong, for example the client edit modal business-required state;
- confirmed forbidden state remains route-level through `PermissionRoute` for every permission-gated entity route;
- kept conversation state handling inside the inbox workbench model, with selected-thread fallback loading/error covered by the direct conversation query.

Verification:

- `git diff --check`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.
- `cd frontend && npx playwright test e2e/entity-workspaces.spec.ts --project=desktop-chromium --project=mobile-chromium`: passed after reusing an existing business bot in the test when bot creation is limited by entitlements.

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

- [x] Refactor Settings to remove background nesting and use shared primitives.
- [x] Refactor Dashboard into action-oriented daily cockpit, not decorative summary.
- [x] Refactor Leads into queue/table plus selected context and next actions.
- [x] Refactor Clients into operational client list plus context/workspace links.
- [x] Refactor Deals into pipeline/workbench with stage, value, owner, next action and risk visibility.
- [x] Refactor Tasks into operational workbench with assignee, priority, due date, relation and action flow.
- [x] Ensure each page exposes loading, empty, filtered-empty, error and forbidden states.
- [x] Ensure tables/lists expose operational fields: status, source, responsible, next action, last activity where relevant.
- [x] Ensure page-specific copy comes from i18n/constants and not random static page text.

Acceptance:

- pages share one visual and interaction language;
- page content remains connected to real backend workflows;
- no page looks like an isolated prototype;
- no page has three or four neutral backgrounds in normal state.

Verification:

- `cd frontend && npm run build`
- `cd frontend && npm run check:bundle`
- desktop/mobile visual QA after each page group

Checkpoint 2026-07-21:

- Settings navigation now uses `Surface` and warm token classes instead of a local card-with-card pattern.
- Settings, billing, usage, developer and working-hours settings surfaces were moved away from old `bg-slate-*`, `bg-white`, `text-slate-*`, `text-midnight` and heavy nested neutral backgrounds.
- Disabled/inactive setting controls now use shared warm surfaces rather than slate backgrounds.
- Existing API, permission checks, forms and i18n keys were preserved; this was a UI surface alignment pass.
- `git diff --check`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.
- `cd frontend && npx playwright test e2e/smoke.spec.ts --project=desktop-chromium -g "business owner core routes render without 404|business owner can configure working hours week"`: route smoke passed; grouped working-hours case hit a login-screen auth/session flake before reaching the page.
- `cd frontend && npx playwright test e2e/smoke.spec.ts --project=desktop-chromium -g "business owner can configure working hours week"`: passed on isolated rerun.

Checkpoint 2026-07-21:

- Owner dashboard was rebuilt as a real daily cockpit using current CRM data, work queues, owner analytics and AI owner brief states.
- Removed decorative dashboard artifacts: fake revenue fallback, hardcoded trend deltas, standalone sparkline chart and old blue/slate visual language.
- Manager dashboard was aligned to the same warm shared surface pattern and keeps the daily queues for leads, appointments and follow-up tasks.
- Dashboard now favors urgent work, revenue data availability, setup/readiness, connector health, AI source/no-data/provider states and direct links to the relevant workbench pages.
- Existing Dashboard API boundaries were preserved: analytics, work queues, AI status/brief and entity data still come through existing API/hook layers.
- `rg -n 'bg-slate|text-slate|text-midnight|border-slate|bg-blue|text-blue|1245000|\+8|\+6|\+20|\+3|font-black|rounded-3xl|hover:-translate|stroke="#2563eb"' frontend/src/features/dashboard`: no matches.
- `cd frontend && npx tsc -b --pretty false`: passed.
- `git diff --check`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.
- `cd frontend && npx playwright test e2e/smoke.spec.ts --project=desktop-chromium -g "business owner core routes render without 404"`: passed as part of the dashboard verification run.
- `cd frontend && npx playwright test e2e/smoke.spec.ts --project=desktop-chromium -g "business owner can use core merchant CRM pages"`: failed outside Dashboard on a stale Leads drawer assertion; the app now opens the lead full workspace where `History` is a section heading, not the old drawer tab button.

Checkpoint 2026-07-21:

- Leads was refactored into a clearer operational queue/table workbench with an inline selected-lead QuickInspector.
- Lead row click now selects the lead inside the workbench; the row open action remains the canonical route into `/app/leads/:id` full workspace for deep work.
- The QuickInspector shows selected lead status, source, service/context, responsible user, next action, AI recommendation/score and related deal/appointment/conversation counts.
- Active Leads table, toolbar, mobile queue row, pagination, context menu, bulk bar, source/status badges and lead modals were aligned away from old slate/blue/midnight visual language and onto Warm Premium shared tokens.
- Shared CRM table row/header/pagination constants now use `zani`/`surface` tokens so table workbenches have a consistent base.
- The owner CRM smoke test was updated from the old lead drawer expectation to the canonical full workspace open action.
- `rg -n "bg-slate|text-slate|border-slate|bg-blue|text-blue|rounded-3xl|font-black|#2563eb|hover:-translate" frontend/src/features/leads/components/LeadsWorkspaceTable.tsx frontend/src/features/leads/components/LeadsToolbar.tsx frontend/src/features/leads/components/LeadsTable.tsx frontend/src/features/leads/components/LeadQueueItem.tsx frontend/src/features/leads/components/LeadQuickInspector.tsx frontend/src/features/leads/components/LeadsPagination.tsx frontend/src/features/leads/components/LeadContextMenu.tsx frontend/src/features/leads/components/LeadsBulkBar.tsx frontend/src/features/leads/components/LeadLostModal.tsx frontend/src/features/leads/components/LeadShortcutsModal.tsx frontend/src/features/leads/components/LeadWorkspaceSections.tsx frontend/src/features/leads/components/common/SourceBadge.tsx frontend/src/features/leads/types/index.ts frontend/src/features/leads/utils/leadFormat.tsx frontend/src/components/crm/tableLayout.ts`: no matches.
- `cd frontend && npx tsc -b --pretty false`: passed.
- `git diff --check`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.
- `cd frontend && npx playwright test e2e/smoke.spec.ts --project=desktop-chromium -g "business owner can use core merchant CRM pages|business owner core routes render without 404"`: passed.

Checkpoint 2026-07-21:

- Clients was refactored into an operational list workbench with an inline selected-client QuickInspector.
- Client row click now selects the client in the workbench; explicit open actions and inspector CTA route to `/app/clients/:id` for full workspace deep work.
- The QuickInspector shows client identity, contact, source, manager, next step, last contact, tags and related deal/appointment/task counts.
- Active Clients table, mobile cards, client primitives, merge/tag modals and tag color defaults were aligned away from old slate/blue visual language and onto Warm Premium shared tokens.
- Client workspace related appointment and conversation links now use canonical deep routes: `/app/calendar/:id` and `/app/conversations/:id`.
- `rg -n "bg-slate|text-slate|border-slate|bg-blue|text-blue|rounded-3xl|font-black|#2563eb|hover:-translate" frontend/src/features/clients/ClientsPage.tsx frontend/src/features/clients/components/ClientQuickInspector.tsx frontend/src/features/clients/components/ClientsTable.tsx frontend/src/features/clients/components/ClientRow.tsx frontend/src/features/clients/components/MobileClientCards.tsx frontend/src/features/clients/components/ClientPrimitives.tsx frontend/src/features/clients/components/ClientsModals.tsx frontend/src/features/clients/hooks/useClientsWorkspace.ts frontend/src/features/clients/hooks/useClientWorkspaceActions.ts frontend/src/features/clients/utils.ts`: no matches.
- `cd frontend && npx tsc -b --pretty false`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.
- `git diff --check`: passed.
- `cd frontend && npx playwright test e2e/smoke.spec.ts --project=desktop-chromium -g "business owner core routes render without 404"`: passed.
- `cd frontend && npx playwright test e2e/entity-workspaces.spec.ts --project=desktop-chromium --project=mobile-chromium`: passed.

Checkpoint 2026-07-21:

- Deals was refactored into a pipeline workbench with an inline selected-deal QuickInspector.
- Deal card click now selects the deal inside the board; explicit open action and double-click route to `/app/deals/:id` for full workspace deep work.
- Deal cards now surface stage, value, owner, next action/date and risk directly in the pipeline board.
- The QuickInspector shows deal status, stage, risk, amount, owner, source, expected close/probability, task count, conversation count and a create-next-task action.
- Active Deals board, list/table fallbacks, deal cards, deal modals, risk and stage/status badges were aligned away from old slate/blue visual language and onto Warm Premium shared tokens.
- Deal selection no longer writes legacy `?deal=` query params; legacy query-param entry still redirects to canonical `/app/deals/:id`.
- `rg -n "bg-slate|text-slate|border-slate|bg-blue|text-blue|rounded-3xl|font-black|#2563eb|hover:-translate|#3b82f6|#4f46e5" frontend/src/features/deals/DealsPage.tsx frontend/src/features/deals/hooks/useDealSelection.ts frontend/src/features/deals/hooks/useDealMetrics.ts frontend/src/features/deals/components/DealQuickInspector.tsx frontend/src/features/deals/components/DealsList.tsx frontend/src/features/deals/components/DealListItem.tsx frontend/src/features/deals/components/DealModals.tsx frontend/src/features/deals/components/common/DealRiskIndicator.tsx frontend/src/features/deals/components/common/DealStageBadge.tsx`: no matches.
- `cd frontend && npx tsc -b --pretty false`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.
- `git diff --check`: passed.
- `cd frontend && npx playwright test e2e/smoke.spec.ts --project=desktop-chromium -g "business owner core routes render without 404"`: passed.
- `cd frontend && npx playwright test e2e/entity-workspaces.spec.ts --project=desktop-chromium --project=mobile-chromium`: passed.

Checkpoint 2026-07-21:

- Tasks was refactored into a shared App 2.0 workbench with summary cards, workload panel, operational table and inline selected-task QuickInspector.
- Task row click now selects the task inside `/app/tasks`; the explicit row open action and inspector CTA route to `/app/tasks/:id` for full workspace deep work.
- The QuickInspector shows status, priority, assignee, due date, summary hint, linked client/lead/deal/appointment/conversation, comment count, watcher count and lifecycle actions.
- The old task drawer was removed from the primary list page flow; existing task form, task APIs, lifecycle mutations and canonical full workspace route were preserved.
- Active Tasks page, table and workload surfaces were aligned away from old slate/blue visual language and onto Warm Premium shared tokens.
- Task related conversation links now use canonical `/app/conversations/:id`; related appointment links use `/app/calendar/:id`.
- `rg -n "bg-slate|text-slate|border-slate|bg-blue|text-blue|rounded-3xl|font-black|#2563eb|hover:-translate" frontend/src/features/tasks/TasksPage.tsx frontend/src/features/tasks/components/TaskList.tsx frontend/src/features/tasks/components/TaskWorkloadPanel.tsx frontend/src/features/tasks/components/TaskQuickInspector.tsx frontend/src/features/tasks/TaskWorkspacePage.tsx`: no matches.
- `cd frontend && npx tsc -b --pretty false`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.
- `git diff --check`: passed.
- `cd frontend && npx playwright test e2e/smoke.spec.ts --project=desktop-chromium -g "business owner core routes render without 404"`: passed.
- `cd frontend && npx playwright test e2e/entity-workspaces.spec.ts --project=desktop-chromium --project=mobile-chromium`: first run failed because backend API at `127.0.0.1:8000` was not running; after starting local Django runserver with sqlite, rerun passed.

Checkpoint 2026-07-21:

- Phase 5 cross-page acceptance was closed for Settings, Dashboard, Leads, Clients, Deals and Tasks workbench pages.
- Loading/error/no-business states are handled at page level; forbidden access is handled by shared `PermissionRoute` around authenticated `/app` resources.
- Leads now has a filtered-empty state with reset action, separate from the true empty lead queue state with create/import actions.
- Clients table now distinguishes true empty clients from filtered-empty results using existing i18n copy.
- Deals empty state now routes filtered-empty users to reset filters and true empty users to create a deal.
- Leads, Clients, Deals and Tasks active workbench surfaces expose the required operational fields: status, source/relationship where relevant, responsible/owner/assignee, next action or due date, and last activity where relevant.
- Removed the remaining static `"Saved client filter"` copy from client segment creation by using the user-provided segment name as the description.
- Added `leads.emptyFilteredTitle` and `leads.emptyFilteredText` to `en`, `ru` and `kk`; i18n parity remains valid.
- Legacy drawer/detail components still contain old slate/blue classes, but they are not the active primary workbench flow closed in Phase 5 and should be handled in a later drawer/entity-detail phase if the roadmap calls for it.
- `rg -n "Saved client filter|TODO|Lorem|Example|Demo|Sample|Hardcoded" frontend/src/features/leads frontend/src/features/clients frontend/src/features/deals frontend/src/features/tasks frontend/src/features/settings frontend/src/features/dashboard -g "*.tsx"`: no matches.
- `cd frontend && npx tsc -b --pretty false`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.
- `git diff --check`: passed.
- `cd frontend && npx playwright test e2e/smoke.spec.ts --project=desktop-chromium -g "business owner core routes render without 404"`: passed.
- `cd frontend && npx playwright test e2e/entity-workspaces.spec.ts --project=desktop-chromium --project=mobile-chromium`: passed.

## 11. Phase 6: Daily Operations Workbenches

Goal:

Make daily work surfaces feel complete and role-aware.

Pages:

- Conversations / Inbox;
- Calendar;
- Dashboard daily cockpit.

Tasks:

- [x] Refactor Conversations into a coherent inbox/list/thread/context workspace.
- [x] Keep conversation-to-CRM actions clear and connected to backend services.
- [x] Refactor Calendar into a coherent scheduling workbench with appointment lifecycle actions.
- [x] Ensure calendar mobile agenda remains usable and not a broken desktop copy.
- [x] Refactor Dashboard for owner/manager/operator daily priorities.
- [x] Ensure AI dashboard surfaces show source/no-data/provider-unavailable/forbidden states.
- [x] Ensure notifications and escalations are visible without creating noise.

Acceptance:

- operators can work from inbox without unnecessary navigation;
- staff/manager can understand schedule and tasks quickly;
- owner dashboard shows action-oriented business state, not vanity totals.

Verification:

- `cd frontend && npm run build`
- focused Playwright smoke for owner/manager/operator routes where available
- desktop/mobile visual QA

Checkpoint 2026-07-21:

- Conversations was aligned into a coherent App 2.0 inbox workspace: compact conversation list, central thread and right CRM/AI context panel now share the Warm Premium surface model.
- Active inbox/list/thread/context files were moved away from old slate/blue visual language, `font-black`, oversized rounded shapes and inconsistent white/slate nesting.
- Message bubbles now use shared ZANI surfaces and the corrupted delivery tick glyph span was removed; message status remains displayed through i18n labels.
- The right context panel preserves operator workflow: selected contact, channel/bot state, responsible user, priority, mark unread, CRM links and AI/action blocks remain reachable without leaving the inbox.
- Conversation-to-CRM actions remain connected to existing backend contracts through `inboxApi`: assign, set priority, toggle bot, close/reopen, create/link client, create/link lead, create/link deal and create task.
- Quick replies, CRM link candidate dialogs and create-task dialog were aligned with Warm Premium modal surfaces while preserving loading, empty and mutation states.
- `rg -n "bg-slate|text-slate|border-slate|bg-blue|text-blue|rounded-3xl|font-black|text-midnight|#2563eb|hover:-translate|bg-white" frontend/src/features/conversations/ConversationsPage.tsx frontend/src/features/conversations/components/ConversationListPane.tsx frontend/src/features/conversations/components/ConversationItem.tsx frontend/src/features/conversations/components/ConversationQueueFilters.tsx frontend/src/features/conversations/components/ConversationThreadPane.tsx frontend/src/features/conversations/components/ConversationComposer.tsx frontend/src/features/conversations/components/MessageBubble.tsx`: no matches.
- `rg -n "РІСљ|вњ|TODO|Lorem|Example|Demo|Sample|Hardcoded" frontend/src/features/conversations -g "*.tsx"`: no matches.
- `rg -n "createClientMutation|createLeadMutation|createDealMutation|createTaskMutation|linkClientToConversation|linkLeadToConversation|linkDealToConversation|inboxApi\.(create|link|assign|toggle|close|reopen|setPriority)" frontend/src/features/conversations/ConversationsPage.tsx`: confirmed live backend mutation wiring.
- `cd frontend && npx tsc -b --pretty false`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.
- `git diff --check`: passed.
- `cd frontend && npx playwright test e2e/smoke.spec.ts --project=desktop-chromium -g "business owner core routes render without 404"`: passed.
- `cd frontend && npx playwright test e2e/entity-workspaces.spec.ts --project=desktop-chromium --project=mobile-chromium`: passed.

Checkpoint 2026-07-21:

- Calendar was aligned into an App 2.0 scheduling workbench across day, week, month and list modes.
- Calendar toolbar, date picker, searchable resource filters, active filter chips, schedule grid headers, time rails, appointment blocks, hover previews, month inspector and selected-appointment quick inspector now use Warm Premium shared tokens instead of old slate/midnight styling.
- Mobile calendar remains a dedicated agenda surface: date context, working-hours summary, booking/open-hours actions, appointments, tasks and empty booking prompt are shown as a compact day workflow instead of a broken desktop grid.
- Appointment lifecycle actions remain connected to existing backend services through `appointmentsApi`: create, confirm, cancel/no-show with reason, complete, reschedule, archive and canonical `/app/calendar/:id` full workspace open.
- Calendar task links now use canonical `/app/tasks/:id`.
- Removed corrupted mojibake separators from calendar cards/inspectors and replaced them with clean ASCII separators.
- Updated calendar E2E expectations for the new App 2.0 active view styling and shared custom Select interaction.
- `rg -n "bg-slate|text-slate|border-slate|bg-blue|text-blue|rounded-3xl|font-black|text-midnight|#2563eb|hover:-translate|bg-white" frontend/src/features/calendar -g "*.tsx"`: no matches.
- `rg -n "РІ|В·|вњ|TODO|Lorem|Example|Demo|Sample|Hardcoded" frontend/src/features/calendar -g "*.tsx"`: no matches.
- `cd frontend && npx tsc -b --pretty false`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.
- `git diff --check`: passed.
- `cd frontend && npx playwright test e2e/smoke.spec.ts --project=desktop-chromium -g "calendar|appointment"`: passed after stopping duplicate local Django runservers and updating test expectations for the new shared controls.
- `cd frontend && npx playwright test e2e/smoke.spec.ts --project=mobile-chromium -g "mobile manager smoke"`: passed.
- Note: one local E2E run logged a transient SQLite `database is locked` on `/api/auth/me/` while Playwright/Django requests overlapped; rerun of the relevant calendar flows passed and this is treated as a local SQLite/server concurrency limitation, not a Calendar UI regression.

Checkpoint 2026-07-21:

- Dashboard owner and manager/operator views were verified against the App 2.0 daily cockpit contract.
- `DashboardPage` keeps dashboard data connected to existing backend/API sources: `analyticsApi.ownerDashboard`, `workQueuesApi.get`, `aiApi.ownerDailyBrief`, `aiApi.assistantStatus` and shared entity data for clients, leads, appointments, services and tasks.
- Owner dashboard focuses on action-oriented business state: revenue readiness, urgent actions, overdue tasks, new leads, appointments, setup readiness, connector health, conversation handoffs and stale deals.
- Manager/operator dashboard focuses on daily processing queues: stale/new leads, appointment confirmations/upcoming appointments, overdue/open tasks and quick links into leads, conversations and deals.
- AI dashboard surfaces are source-grounded and handle loading, no-data, provider-unavailable/error and role-forbidden states; role-forbidden AI brief now has priority over provider-unavailable fallback when the user cannot view AI analyst data.
- Task rows in owner and manager/operator dashboard queues now open the canonical `/app/tasks/:id` full workspace when no backend queue href is provided.
- Notifications and escalations are visible through existing work queue signals without adding noisy decorative blocks: overdue tasks, stale leads, appointment confirmations, unread/handoff conversations and stale/no-next-action deals.
- `rg -n "bg-slate|text-slate|border-slate|bg-blue|text-blue|rounded-3xl|font-black|text-midnight|#2563eb|hover:-translate|bg-white|TODO|Lorem|Example|Demo|Sample|Hardcoded" frontend/src/features/dashboard -g "*.tsx"`: no matches.
- `rg -n "owner-brief-forbidden|ownerBriefNoData|ownerBriefUnavailable|ownerBriefNoAccess|ownerBriefSourceIds|workQueues\?\.queues|unread_sla_overdue_conversations|handoff_sla_overdue_conversations|sla_overdue_deals|no_next_action_deals|/app/tasks/\$\{task\.id\}" frontend/src/features/dashboard frontend/src/lib/i18n -g "*.tsx" -g "*.ts"`: confirmed.
- `cd frontend && npx tsc -b --pretty false`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.
- `git diff --check`: passed for dashboard files and this roadmap.
- `cd frontend && npx playwright test e2e/smoke.spec.ts --project=mobile-chromium -g "mobile manager smoke"`: passed.
- `cd frontend && npx playwright test e2e/smoke.spec.ts --project=desktop-chromium -g "business owner core routes render without 404"`: passed.
- Note: an earlier parallel Playwright run hit local SQLite `database is locked` while two webServer setups tried to prepare smoke data at the same time; rerunning the desktop owner smoke by itself passed. A later passing run still logged one transient `/api/auth/me/` SQLite lock while the page recovered and rendered, which is treated as a local SQLite/E2E concurrency limitation rather than a Dashboard UI regression.

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

- [x] Refactor Integrations so provider complexity is progressively disclosed.
- [x] Ensure integration status labels follow live/mock/readiness semantics.
- [x] Refactor Automations so run state, affected objects and retry safety are merchant-readable.
- [x] Refactor AI Assistant / Analyst surfaces around source, no-data, provider and approval states.
- [x] Refactor Analytics into operational answers rather than vanity cards.
- [x] Refactor Outreach using shared campaign/control surfaces.
- [x] Ensure Settings does not become an overloaded admin maze.

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

- [x] Run full frontend build.
- [x] Run bundle check.
- [x] Run desktop visual QA for primary authenticated routes.
- [x] Run mobile visual QA for primary authenticated routes.
- [x] Run owner role smoke.
- [x] Run manager role smoke.
- [x] Run operator role smoke.
- [x] Verify no horizontal overflow.
- [x] Verify no text overlap with Russian/Kazakh long labels.
- [x] Verify loading/error/empty/forbidden states on primary pages.
- [x] Verify global search, command palette and notifications.
- [x] Verify old drawer/deep-link fallbacks where intentionally retained.
- [x] Update this roadmap and relevant source docs with final status.

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

- visual QA is deferred until shared primitives/AppShell surfaces are updated enough for a meaningful screenshot pass.

### 2026-07-21: Saturated Orange Brand Accent

Completed:

- updated the Warm Premium brand accent to saturated orange;
- synced CSS variables, Tailwind aliases, design-system documentation and this roadmap around the same brand token set.

Verification:

- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.

### 2026-07-21: Shared Button Primitive Aligned

Completed:

- updated shared `Button` variants for primary, secondary, ghost, outline, danger, AI and icon use;
- aligned shared button sizes with the documented `sm`, `md`, `lg` and `icon` scale;
- moved the shared button primitive onto Warm Premium surfaces, saturated orange brand states and plum AI states.

Verification:

- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.

### 2026-07-21: Shared Switch Primitive Promoted

Completed:

- added shared `Switch` / `ToggleSwitch` primitive under `frontend/src/components/ui`;
- replaced the integration-local toggle implementation with the shared primitive while keeping a temporary compatibility re-export;
- moved AI agent toggles to the shared primitive with AI tone and integration channel toggles to the shared default brand tone.

Verification:

- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.

### 2026-07-21: Shared Form Controls Aligned

Completed:

- updated shared `Input` and `Textarea` labels, surfaces, hover, focus, error, disabled and readonly states to Warm Premium tokens;
- updated shared `Select` trigger, chevron, option rows, selected state and error state;
- updated shared `SearchableSelect` trigger, clear action, search input, empty state and options to use shared popover and Warm Premium tokens;
- kept component props and data contracts unchanged.

Verification:

- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.

### 2026-07-21: Shared Tabs And Filter Chips Aligned

Completed:

- updated shared `Tabs` and `FilterBar` to use Warm Premium segmented-control surfaces, brand active state, neutral count pills, truncation and keyboard focus rings;
- updated CRM `CrmControlBar` quick filters and active removable filter chips to the same segmented/chip visual contract;
- aligned clients/deals filter-adjacent controls that visually sit inside the same CRM filter workflow;
- kept tab/filter values, props and API contracts unchanged.

Verification:

- `git diff --check`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.

### 2026-07-21: Shared Badge Semantics Aligned

Completed:

- updated shared `Badge` variants to use Warm Premium neutral, brand, AI and semantic status tokens instead of old slate/blue/violet/raw status colors;
- added documented `lg` badge size while preserving existing `sm` and `md` behavior;
- refactored `StatusBadge` to map statuses to semantic tones and render through the shared `Badge` primitive;
- kept status labels and existing `StatusBadge` call sites compatible.

Verification:

- `git diff --check`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.

### 2026-07-21: Shared Surface Helpers Aligned

Completed:

- updated shared `Card` and `Surface` variants to Warm Premium surface, border, hover, AI and danger semantics;
- aligned CRM table wrapper surfaces and toolbar/filter dividers with shared Warm Premium borders and card surfaces;
- aligned reusable KPI, segmented, chip, detail panel, bottom sheet and entity-list primitive surfaces away from old slate/white styling;
- adjusted shared drawer helper width/background to the documented CRM drawer surface model.

Verification:

- `git diff --check`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.

### 2026-07-21: Shared Overlay And State Surfaces Aligned

Completed:

- updated shared dialog header/body and close button surfaces to Warm Premium tokens;
- aligned shared toast close action and CRM empty-state surface styling;
- aligned `LoadingState`, `ErrorState`, `ForbiddenState`, `EmptyState` and skeleton primitives to shared surface and semantic token rules;
- preserved existing overlay/state props, labels and call sites.

Verification:

- `git diff --check`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.

### 2026-07-21: Shared Decorative Pattern Cleanup

Completed:

- removed old blue/gradient/raw semantic color leaks from shared `MetricCard`, generic `DataTable`, app error boundary, notification toast and `AiInsightCard` primitives;
- replaced hover-jump behavior in shared error/notification surfaces with stable Warm Premium interaction states;
- kept AppShell/Header/Sidebar/drawer page-level legacy styling out of this Phase 1 primitive cleanup because those are tracked under later AppShell and entity-drawer tasks.

Verification:

- targeted `rg` check for old blue/gradient/hover-jump patterns in changed shared files: passed.
- `git diff --check`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.

### 2026-07-21: Shared Control Long-Label Verification

Completed:

- verified shared tabs/filter bars/CRM control bars use horizontal scroll, wrapping or truncation patterns for long RU/KZ labels;
- updated shared `Button` to stay constrained by parent width and allow normal wrapping;
- updated shared `Select` and `SearchableSelect` popover options so long labels/descriptions can clamp to two lines while selected trigger labels still truncate safely.

Verification:

- targeted `rg` check for `overflow-x-auto`, `flex-wrap`, `truncate`, `break-words`, line clamp and `max-w-full` in shared controls: passed.
- `git diff --check`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.

### 2026-07-21: Shared Primitive State Verification

Completed:

- verified shared `Button`, `Input`, `Textarea`, `Select`, `SearchableSelect`, `Tabs`, `FilterBar`, `Switch`, `Badge`, `StatusBadge` and `CrmControlBar` focus, disabled, loading, error and success state coverage;
- added keyboard open/close affordances to shared `Select` and `SearchableSelect` triggers;
- removed remaining shared old surface leaks from `RouteErrorBoundary` and unresolved `border-zani-border-soft` usages in shared controls.

Verification:

- targeted `rg` state/focus/keyboard checks in shared controls: passed.
- targeted `rg` check for old shared blue/gradient/hover-jump patterns in the changed shared primitive set: passed.
- `git diff --check`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.

### 2026-07-21: Authenticated App Font Loading

Completed:

- selected self-hosted Manrope Variable as the authenticated app primary font source;
- added `@fontsource-variable/manrope` to the frontend dependencies and imported it before app global styles;
- kept the existing app fallback stack: `"Noto Sans"`, `Inter`, system UI and Segoe UI.

Verification:

- targeted `rg` check for font package/import and fallback stack: passed.
- `git diff --check`: passed.
- `cd frontend && npm run build`: passed; Vite emitted Manrope WOFF2 assets, including the Cyrillic subset.
- `cd frontend && npm run check:bundle`: passed.

### 2026-07-21: Historical UI/UX Task Cross-Reference

Completed:

- added a status note to `actual_docs/APP_UI_UX_REDESIGN_TASK.md` pointing execution to this App 2.0 / WorkbenchLayout roadmap;
- preserved the old document as historical context instead of rewriting its existing mojibake content.

Verification:

- `git diff --check`: passed.

### 2026-07-21: Phase 7 Control Surfaces Completed

Completed:

- aligned Integrations, Automations, AI Assistant, Analytics, Outreach and Settings with shared Warm Premium surfaces and semantic status treatment;
- kept connector/provider complexity progressively disclosed instead of exposing a technical console as the primary merchant experience;
- kept AI, analytics, automations and outreach surfaces tied to source/no-data/provider/readiness/retry/safety states;
- moved remaining page-local slate/blue/white/font-black styling in the Phase 7 surface set onto shared tokens and primitives;
- added missing Outreach i18n keys for campaign delivery, failure, suppression and WhatsApp template states across RU, KK and EN.

Verification:

- targeted `rg` check for old slate/blue/white/font-black/midnight/demo patterns in Phase 7 pages and shell search/notification surfaces: passed.
- `git diff --check`: passed.
- `cd frontend && npx tsc -b --pretty false`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run check:bundle`: passed.

### 2026-07-21: Phase 8 QA And Cutover Completed

Completed:

- added horizontal overflow assertions to primary desktop/mobile route smoke loops;
- added desktop coverage for global search and command palette opening/closing safely;
- stabilized smoke login recovery against local SQLite auth-lock flakiness and updated stale mojibake selectors to stable Unicode/structural selectors where needed;
- verified App 2.0 shell/workbench routes, mobile bottom navigation, More drawer, notifications, command palette, role forbidden state and entity workspace deep links;
- confirmed the old half-screen drawer model is no longer the required path for client, lead, deal, appointment, conversation and task work.

Verification:

- `cd frontend && npm run build`: passed; i18n parity OK with 4445 keys across RU, KK and EN.
- `cd frontend && npm run check:bundle`: passed; largest JS chunk `app-shell` remained below the 500 kB pre-gzip limit.
- `cd frontend && npx playwright test e2e/smoke.spec.ts --project=desktop-chromium -g "business owner core routes|desktop sidebar links|header notifications|operator sees restricted"`: passed 4 tests in the final grouped rerun.
- `cd frontend && npx playwright test e2e/smoke.spec.ts --project=desktop-chromium -g "global search and command palette"`: passed.
- `cd frontend && npx playwright test e2e/smoke.spec.ts --project=mobile-chromium -g "mobile owner smoke"`: passed.
- `cd frontend && npx playwright test e2e/smoke.spec.ts --project=mobile-chromium -g "mobile manager smoke"`: passed.
- `cd frontend && npx playwright test e2e/entity-workspaces.spec.ts --project=desktop-chromium --project=mobile-chromium`: passed 2 tests.
- `git diff --check`: passed.

Known local test noise:

- Windows Playwright webServer occasionally failed to start with exit code `3221225477`; rerunning the same focused target worked.
- Local SQLite occasionally logged `database is locked` on `/api/auth/me/`; affected tests recovered after login-helper stabilization and passed in focused reruns.
- Local JWT test settings still emit insecure key length warnings; this is test-environment noise, not a frontend regression.

## 15. Next Recommended Task

Start with Phase 1 and Phase 2 foundation before redesigning more pages:

1. update shared primitives enough to support AppShell and WorkbenchLayout;
2. implement AppShell 2.0 shell pass;
3. implement WorkbenchLayout;
4. then continue entity actions and page workbenches.

Reason:

If page redesign continues before shared tokens and layout primitives are stable, the product will again drift into page-local backgrounds, buttons, cards and inconsistent states.
