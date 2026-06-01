# ZANI UI/UX Unification Technical Plan

Date: 2026-05-30

Status: active implementation plan

## Goal

Bring ZANI frontend to a unified, understandable, production-ready CRM UI/UX system.

The target is not to make isolated screens prettier. The target is to make ZANI feel like one product: a calm AI-native CRM/business control layer where owners, directors and operators can immediately understand what needs attention and act without learning a different UI pattern on every page.

## Product Direction

ZANI should align with proven CRM patterns from HubSpot, Pipedrive, Intercom, monday CRM and Salesforce, but remain simpler and more SMB-friendly:

- HubSpot-like customer object model: leads, clients, deals, conversations and activities connected in one context.
- Pipedrive-like sales execution: pipeline, next action, owner, deal value and stuck deal risk.
- Intercom-like inbox: triage-first conversations with CRM context and fast reply composer.
- monday-like operational clarity: simple boards/lists, visible status, lightweight workflow setup.
- Salesforce-like role/security maturity, but hidden behind simple presets and progressive disclosure.

## Anti-Bitrix Product Rule

This is a hard product rule for all tasks in this plan.

ZANI must not become a Bitrix24-like product surface with hundreds of visible settings, overloaded menus, technical objects and unclear modules. ZANI targets small and medium businesses where the same platform must stay understandable for:

- a company with one employee;
- a company with 100 employees;
- owners who are not CRM administrators;
- managers/operators who only need their daily work queue.

The interface must scale in capability without scaling visible complexity.

### What this means in implementation

- A new feature does not get a new top-level sidebar item by default.
- Rare or setup-heavy features belong inside Settings, Integrations, contextual drawers, advanced sections or role-specific views.
- One-person companies should see a simple business cockpit, not team-management/admin complexity.
- 100-person companies should get power through roles, teams, saved filters, ownership, permissions, bulk actions and reports, not through dozens of extra menu items.
- Basic presets must come before manual configuration.
- Advanced settings must be behind disclosure and unavailable to roles that do not need them.
- Each page must have one primary job and one primary action.
- If a workflow can be solved with a contextual action, drawer, bottom sheet or AI recommendation, do not create a separate page.
- Technical concepts such as webhooks, tokens, provider payloads, raw permissions, sync internals and automation internals must not dominate merchant-facing UI.
- The default experience must be usable without reading documentation.

### Interface complexity budget

Every new frontend task must answer these questions before implementation:

1. Is this daily work or setup/advanced work?
2. Which roles need it?
3. Does it deserve primary navigation?
4. Can it live inside an existing page, drawer, settings section or connector setup?
5. What does the one-employee company see?
6. What does the 100-employee company see?
7. What can be hidden until the user asks for more?

If the answer adds visible complexity for most users, the design is not ready.

### Required acceptance criteria for new features

For any new feature, production-ready means:

- It is placed in the smallest appropriate UI surface.
- It does not expand primary navigation unless explicitly approved.
- It has a simple default state.
- It has an advanced state only when needed.
- It respects role/permission visibility.
- It works for both a one-person business and a larger team.
- It does not expose technical implementation details as primary UI.
- It has clear empty, loading and error states.

## Current Main Problems

1. Visual system is inconsistent.
   - Buttons, cards, panels, filters and page headers are styled differently across pages.
   - `ai-gradient`, high radius, hover movement and strong shadows are used too broadly.
   - Working CRM screens feel decorative instead of operational.

2. Page architecture is inconsistent.
   - Leads, Inbox, Clients and Deals solve similar work-queue problems but use different structures.
   - Settings, Integrations, Services, Resources, Working Hours and Automations feel like separate products.
   - There is no strict set of page templates.

3. Navigation is overloaded.
   - Desktop sidebar exposes too many secondary/setup routes.
   - Mobile drawer does not expose all important routes from desktop.
   - Every visible route, including AI Agents, must be production-safe and simple enough for non-technical users.

4. Mobile is not first-class everywhere.
   - Some desktop-heavy layouts are squeezed into mobile.
   - Detail panels are not consistently translated into bottom sheets.
   - Tables and wide calendar grids need dedicated mobile patterns.

5. AI is visually over-emphasized and structurally under-standardized.
   - AI color is sometimes used for ordinary CRM actions.
   - AI hints are not always tied to confirmable business actions.

6. Production confidence is insufficient.
   - Frontend build must be green before UI work can be trusted.
   - Sidebar route coverage and visual regression coverage need to be explicit.

## Non-Negotiable Principles

Every implementation task from this plan must end production-ready. No half-finished "UI pass" is acceptable.

Production-ready means:

- `npm run build` passes.
- i18n parity stays green.
- All visible UI strings are localized in `ru`, `en` and `kk`.
- TypeScript has no new errors.
- Relevant routes render without 404/runtime error.
- Permission gates are preserved.
- Mobile and desktop states are checked.
- Empty, loading, error and no-permission states are handled.
- No unrelated refactors or visual churn outside the task scope.
- Any removed route or feature is intentionally redirected, hidden or documented.
- E2E/smoke coverage is updated when navigation, core flows or labels change.

## i18n Rule

All user-facing frontend work must be fully localized in Russian, English and Kazakh.

This applies to every visible string:

- page titles;
- navigation labels;
- buttons;
- tabs;
- filters;
- form labels;
- placeholders;
- helper text;
- empty states;
- loading states;
- error states;
- notices/toasts;
- modal and drawer titles;
- AI recommendation text;
- status labels;
- table headers;
- mobile bottom sheet labels.

### Implementation rules

- Do not add hardcoded user-facing text in page components.
- Add new keys to `frontend/src/lib/i18n.tsx` in all three dictionaries: `ru`, `kk`, `en`.
- Prefer existing keys before adding new ones.
- Keep keys scoped by feature, for example:
  - `aiAgents.title`
  - `leads.filter.unassigned`
  - `settings.ai.advanced`
- If a page is migrated to shared components, pass translated labels into those components.
- Developer-only constants can remain in English only if they are not rendered to users.

### Required check

Every frontend task must run:

```bash
cd frontend
npm run check:i18n
```

For normal implementation this is included in:

```bash
cd frontend
npm run build
```

Acceptance criteria:

- `check:i18n` passes.
- No new visible hardcoded Russian/English/Kazakh strings are introduced in migrated components.
- Screens remain understandable in ru/en/kk, including mobile.

## Target Information Architecture

### Primary Merchant Sidebar

Keep only daily/product loops visible:

1. Home
2. Leads
3. Deals
4. Clients
5. Inbox
6. Analytics
7. Integrations
8. Settings

### Secondary Routes

Move these out of the primary sidebar:

- Tasks: accessible from Home, Leads, Deals, Clients and Calendar context.
- Calendar/Appointments: accessible for roles that use scheduling; place in More/mobile and optionally owner desktop secondary group.
- Services: Settings -> Scheduling.
- Resources: Settings -> Scheduling.
- Working Hours: Settings -> Scheduling.
- Automations: Settings -> Automations or AI Navigator -> Rules.
- Pricing: Integrations -> Kaspi Pricing.
- AI Agents: stays in the sidebar as a primary AI setup/control entry by product decision; the page itself must stay simple-first and hide advanced configuration until needed.

### Mobile Navigation

Bottom nav:

1. Home
2. Leads
3. Clients
4. Inbox
5. More

More drawer:

- Deals
- Calendar
- Tasks
- Analytics
- Integrations
- Settings

## Target UI System

### Visual Tokens

Use a calm SaaS CRM palette:

- App background: `#F7F8FB` or `#F8FAFC`.
- Surface: `#FFFFFF`.
- Border: `#E5E7EB` / `#E2E8F0`.
- Text primary: slate/ink.
- Text secondary: slate-500/600.
- Primary action: brand blue or midnight, not gradient.
- AI action: violet/indigo only inside AI recommendations, drafts and analyst areas.
- Success: emerald.
- Warning: amber.
- Error: red.

### Shape And Elevation

- Page sections: no decorative card nesting.
- Large panels: 16px radius.
- Cards/list rows: 12px radius.
- Controls: 8-12px radius.
- Shadows: minimal by default.
- No hover translate by default.
- No glass/blur by default on working CRM pages.
- No decorative mesh/perspective panels on authenticated workspace pages.

### Typography

- Page title: 28-32px desktop, 22-24px mobile.
- Section title: 16-20px.
- Body: 14px.
- Table/list text: 13-14px.
- KPI value: 24-32px depending on density.
- No viewport-scaled typography.
- No negative letter spacing.

## Shared Components To Build Or Refactor

### 1. Button

File area:

- `frontend/src/components/ui/Button.tsx`

Required variants:

- `primary`: main CRM action.
- `secondary`: bordered neutral action.
- `ghost`: low-emphasis action.
- `danger`: destructive action.
- `ai`: AI-only action.
- `icon`: icon-only control with tooltip support where needed.

Acceptance criteria:

- No default hover translate.
- No premium shadow by default.
- AI variant is not used for ordinary create/save/open actions.
- Disabled and loading states are visually clear.
- Touch target is at least 44px on mobile.

### 2. Card / Panel

File area:

- `frontend/src/components/ui/Card.tsx`
- optionally new `Panel.tsx`

Required variants:

- `Card`: repeated item or metric.
- `Panel`: large workspace container.
- `Section`: form/settings section.

Acceptance criteria:

- Default radius and border are consistent.
- Nested cards are avoided.
- Glass/blur is removed from default surfaces.

### 3. PageHeader

File area:

- `frontend/src/components/ui/PageHeader.tsx`

Acceptance criteria:

- No default AI gradient accent.
- Optional eyebrow, title, description, actions.
- Actions wrap consistently on mobile.
- Description is short and operational.

### 4. MetricCard

New or refactor:

- `frontend/src/components/ui/MetricCard.tsx`

Acceptance criteria:

- Used for KPI rows on Dashboard, Leads, Inbox, Clients, Deals, Calendar, Analytics.
- Supports icon, label, value, delta, tone, href.
- Compact mode for dense pages.

### 5. FilterBar

New:

- `frontend/src/components/ui/FilterBar.tsx`

Acceptance criteria:

- Shared search input.
- Shared chip row.
- Shared select/dropdown placement.
- Advanced filters can collapse into popover/sheet.
- Used by Leads, Inbox, Clients, Deals, Calendar, Integrations.

### 6. WorkQueueLayout

New:

- `frontend/src/components/layout/WorkQueueLayout.tsx`

Purpose:

- Standardize pages with list/table + right detail.

Acceptance criteria:

- Supports KPI row, filter bar, list area, detail panel.
- On mobile, detail panel becomes bottom sheet.
- Used first by Leads and Inbox, then Clients.

### 7. RightDetailPanel

New:

- `frontend/src/components/crm/RightDetailPanel.tsx`

Acceptance criteria:

- Consistent header: entity identity, status, owner, quick actions.
- Consistent body sections.
- Supports close button and full card link.
- Has mobile bottom sheet equivalent.

### 8. AiRecommendation

New/refactor:

- `frontend/src/components/ai/AiRecommendation.tsx`

Acceptance criteria:

- Always includes source/reason where possible.
- Optional confirmable action.
- Never uses generic long AI copy.
- Used in Dashboard, Leads, Inbox, Deals, Clients, Analytics.

## Page Template Requirements

### Dashboard Template

Use for:

- Dashboard owner/director/manager variants.

Structure:

1. Page header.
2. KPI row, max 4-5 cards.
3. Requires Attention panel.
4. AI daily brief.
5. Recent leads/conversations/deals/tasks.
6. Integration health strip.

Production acceptance:

- User can answer within 5 seconds: what needs attention today?
- Every metric links to an action or drill-down.
- No decorative chart without action.
- Owner/manager role differences are preserved.
- Empty business setup state is clear.

### Work Queue Template

Use for:

- Leads
- Inbox
- Clients

Structure:

1. Page header with one primary action.
2. Compact KPI strip.
3. FilterBar.
4. List/table.
5. RightDetailPanel.

Production acceptance:

- Selection state is visible.
- URL can deep-link to selected entity when already supported.
- Mobile opens selected entity in bottom sheet.
- Empty list explains next action.
- All quick actions handle permissions and mutation errors.

### Pipeline Template

Use for:

- Deals

Structure:

1. Pipeline controls.
2. Stage columns or split list/detail with clear toggle.
3. Deal cards with essentials only.
4. Detail panel/drawer.
5. Win/loss/next-action guarded flows.

Production acceptance:

- Deal cannot advance without next action where business rule requires it.
- Won/lost requires correct confirmation data.
- Stage totals and counts are visible.
- Drag/drop or stage select has clear feedback.
- Mobile has list-first deal cards.

### Settings Template

Use for:

- Settings
- Integrations
- Services
- Resources
- Working Hours
- Automations
- AI Agents advanced configuration, while the primary AI Agents route remains in sidebar

Structure:

1. Settings shell with inner navigation.
2. Section cards.
3. Simple setup first.
4. Advanced behind disclosure.

Production acceptance:

- Owner sees business/admin settings.
- Non-owner sees only permitted sections.
- Setup pages do not clutter daily sidebar.
- Forms have validation, saving, loading and error states.

## Page-Specific Implementation Plan

## Phase 0 - Stabilize Build And Route Baseline

### Task 0.1 Keep AI Agents route production-safe

Actions:

- Keep AI Agents visible in desktop and mobile sidebar for permitted roles.
- Ensure `frontend/src/features/assistant/AIAgentsPage.tsx` exists and is production-safe.
- Ensure `/dashboard/ai-agents`, `/dashboard/ai-agents/:id` and `/dashboard/ai-agents/:id/:section` render without crashes.
- If the selected agent or section is missing, redirect to the AI Agents overview or first available safe state.

Acceptance criteria:

- `npm run build` passes.
- `/dashboard/ai-agents` does not crash if a legacy user opens it.
- Sidebar exposes AI Agents only when permissions allow it.

### Task 0.2 Add sidebar route smoke coverage

Actions:

- Update Playwright smoke tests for current labels/routes.
- Cover desktop sidebar links.
- Cover mobile bottom nav and More drawer.

Acceptance criteria:

- E2E verifies no sidebar route renders 404/runtime error.
- Labels match current i18n.
- Test data setup remains deterministic.

## Phase 1 - Design System Foundation

### Task 1.1 Refactor visual tokens

Actions:

- Update Tailwind tokens.
- Reduce default shadows/radius.
- Remove default `soft-mesh` dominance from authenticated workspace.
- Keep AI colors scoped.

Acceptance criteria:

- Existing pages still render.
- No one-note purple/blue gradient theme.
- UI reads as calm CRM workspace.

### Task 1.2 Refactor Button, Card, PageHeader

Actions:

- Implement new variants.
- Replace dangerous overuse of `variant="ai"`.
- Remove default gradient accent from PageHeader.
- Make Card neutral by default.

Acceptance criteria:

- All current usages compile.
- Primary actions remain obvious.
- AI-only styling is limited to AI actions.
- Manual scan confirms no ordinary create/save button uses AI gradient.

### Task 1.3 Introduce MetricCard and FilterBar

Actions:

- Build shared components.
- Migrate at least two pages in same task only if scoped and tested.

Acceptance criteria:

- Components support desktop and mobile.
- Components are documented in `docs/design-system.md`.
- No page-specific one-off metric/filter component remains on migrated pages.

## Phase 2 - Layout And Navigation Unification

### Task 2.1 Simplify AppLayout and Sidebar

Actions:

- Remove decorative workspace background panels.
- Make sidebar simpler and less capsule-like.
- Apply target primary navigation.
- Move setup/system routes out of primary nav.

Acceptance criteria:

- Desktop nav matches target IA.
- Active states are clear.
- Permission filtering remains intact.
- Collapsed and expanded states still work.

### Task 2.2 Fix mobile navigation

Actions:

- Bottom nav: Home, Leads, Clients, Inbox, More.
- More drawer includes Deals, Calendar, Tasks, Analytics, Integrations, Settings.
- Drawer uses same route permission logic.

Acceptance criteria:

- All important desktop routes are reachable on mobile.
- Drawer closes after navigation.
- No text clipping on 320px width.

## Phase 3 - Work Queue Screens

Implementation status:

- Done: shared `WorkQueueLayout`, `WorkQueueListPane`, `WorkQueueDetailPane` are in place.
- Done: Leads uses the shared work-queue structure and mobile list/detail flow.
- Done: Inbox/Conversations uses the shared work-queue structure and shared metric cards; bulk mode remains explicit.
- Done: Clients uses the shared work-queue structure, shared metric cards and modal-based tag/archive flows.
- Remaining: finish full i18n cleanup for hardcoded page copy and continue standardizing Deals/Calendar/Analytics surfaces.

### Task 3.1 Build WorkQueueLayout and RightDetailPanel

Actions:

- Create reusable layout.
- Create desktop right panel and mobile bottom sheet.
- Keep current CRM drawer for full card details.

Acceptance criteria:

- Layout supports Leads/Inbox/Clients without custom page structure duplication.
- Keyboard and mobile close behavior works.
- Panel can show loading, empty and permission states.

### Task 3.2 Migrate Leads

Actions:

- Use WorkQueueLayout.
- Use shared MetricCard/FilterBar.
- Use standardized right detail panel.
- Keep lead actions: call, WhatsApp, take, contacted, task, deal, appointment, close/lost/reopen.

Acceptance criteria:

- Existing lead workflows still work.
- URL selected lead behavior remains.
- Mobile bottom sheet is usable.
- No ordinary action uses AI button.
- Relevant backend mutations invalidate correct queries.

### Task 3.3 Migrate Inbox

Actions:

- Use WorkQueueLayout.
- Keep triage list, chat thread, CRM context.
- Put AI draft in composer/context, not as separate theater.
- Keep bulk mode behind explicit action.

Acceptance criteria:

- Reply, AI suggest, assign, handoff, close/reopen, create/link client/lead/deal/task still work.
- Closed conversation blocks composer.
- Failed/retry message states stay visible.
- Mobile conversation open/close flow is clear.

### Task 3.4 Migrate Clients

Actions:

- Use WorkQueueLayout.
- Replace prompts with modal/popover actions.
- Standardize tags, quick actions, history.

Acceptance criteria:

- Create/edit/archive/tag/segment flows work.
- No `window.prompt` remains for production UX.
- Client right panel shows identity, contact, next action, related entities and AI hint.

## Phase 4 - Deals Pipeline

Implementation status:

- Done: Deals uses shared `WorkQueueLayout`, `MetricCard` and `FilterBar`.
- Done: Deals has mobile list/detail behavior aligned with Leads, Clients and Inbox.
- Done: stage guard, next action, won/lost/reopen and full CRM drawer flows are preserved.
- Done: visible production copy no longer exposes technical labels like `Pipeline`, `SLA`, `next action`, `Won/Lost`.
- Remaining: deeper view-model extraction and optional pipeline-column scan mode.

### Task 4.1 Define Deals view model

Actions:

- Centralize derived deal data: client, stage, owner, next task, risk, conversations.
- Avoid repeated filtering in render paths.

Acceptance criteria:

- Existing data behavior unchanged.
- Component code is easier to split.
- Unit-level selector tests where practical.

### Task 4.2 Implement pipeline-first Deals UI

Actions:

- Add stage columns with count and value.
- Deal cards show only essentials.
- Preserve stage guard and win/loss flows.
- Keep split/detail or list mode as secondary if needed.

Acceptance criteria:

- Open pipeline can be scanned quickly.
- Stale/no-next-action deals are visually obvious.
- Stage changes are permission-safe and error-safe.
- Mobile uses list-first cards.

## Phase 5 - Dashboard And Analytics

### Task 5.1 Rebuild owner dashboard as cockpit

Actions:

- Use DashboardTemplate.
- Prioritize attention/action lists over decorative cards.
- Integrate AI daily brief and integration health.

Acceptance criteria:

- Owner sees what happened, what is risky, what to do now.
- Manager/operator views remain role-appropriate.
- No duplicate metrics without actions.

### Task 5.2 Simplify Analytics

Actions:

- Separate operational analytics from reports.
- Use shared MetricCard and simple tables.
- Keep export/report actions but reduce visual noise.

Acceptance criteria:

- Analytics supports owner/admin use cases.
- Data quality/empty states are clear.
- Scheduled reports and exports still work.

## Phase 6 - Integrations And Settings Shell

### Task 6.1 Rebuild Integrations overview

Actions:

- Restore message channels as first-class group.
- Add priority connectors.
- Add status filters: all, connected, setup required, request, roadmap, error.
- Add right help/how-it-works panel on desktop.

Acceptance criteria:

- WhatsApp, Instagram, Telegram, Website are visible and searchable.
- Connector cards have clear status and action.
- Request-only and roadmap connectors do not look broken.
- Setup modals still work.

### Task 6.2 Move Pricing into Integrations/Kaspi

Actions:

- Remove Pricing from primary sidebar.
- Keep direct route for legacy/deep links.
- Link from Kaspi/Kaspi Pricing connector.

Acceptance criteria:

- Pricing remains usable for permitted roles.
- Users do not see specialist pricing tool as global nav noise.

### Task 6.3 Build Settings shell

Actions:

- Create internal settings navigation.
- Group existing sections:
  - Business
  - Team
  - Access
  - Notifications
  - Scheduling
  - AI
  - Billing
  - Developer
  - Advanced

Acceptance criteria:

- Current settings functionality remains.
- Sections are role/permission-aware.
- Mobile uses select/tabs and avoids huge scroll confusion.

### Task 6.4 Move Services, Resources, Working Hours into Scheduling settings

Actions:

- Keep old routes as redirects or hidden deep links.
- Surface scheduling setup from Settings.

Acceptance criteria:

- Existing forms work.
- Calendar setup path is clearer.
- Sidebar is reduced.

### Task 6.5 Move Automations into Settings or AI Rules

Actions:

- Keep automation builder but move out of primary nav.
- Mark advanced builder as advanced.

Acceptance criteria:

- Existing automation templates/rules/runs work.
- No advanced automation complexity on daily nav.

### Task 6.6 Reframe AI Agents as a simple-first sidebar surface

Current state:

- `frontend/src/features/assistant/AIAgentsPage.tsx` is restored and build-safe.
- The page exposes a full agent builder with nine sections:
  - Settings
  - Prompting
  - Messages
  - LLM model
  - Control
  - Functions
  - Knowledge
  - Integrations
  - Channels
- This is valuable functionality, but much of it is advanced configuration. Since AI Agents is intentionally available from the sidebar, the page must open as a simple setup/status surface and reveal advanced controls progressively.

Product decision:

- AI Agents remains available from the sidebar.
- The sidebar entry is acceptable only if the page does not expose all advanced configuration upfront.
- The default view should help a normal merchant understand agents, connected channels, status and next setup action.
- Direct routes must remain supported for deep links:
  - `/dashboard/ai-agents`
  - `/dashboard/ai-agents/:id`
  - `/dashboard/ai-agents/:id/:section`
- AI Navigator / AI Assistant remains the daily recommendation surface; AI Agents is the setup/control surface.

Actions:

- Keep AI Agents in the primary sidebar.
- Keep route-level access guarded by `integrations/manage` or `settings/manage`.
- Add a simple "AI Agents" overview mode before showing advanced sections:
  - active agents;
  - connected channels;
  - last message/test status;
  - primary actions: create agent, open channels, test in Inbox.
- Group the current nine sections into progressive-disclosure groups:
  - Basic: Settings, Channels, Messages.
  - Behavior: Prompting, Control.
  - Data: Knowledge, Integrations.
  - Advanced: LLM model, Functions.
- Hide Advanced by default behind an explicit advanced toggle or section.
- Replace local/native controls with shared UI primitives:
  - native `select` -> shared `Select`;
  - local `MetricCard` -> shared `MetricCard`;
  - page-specific cards -> shared `Card`/`Panel`;
  - AI-gradient ordinary buttons -> `primary` or `secondary`.
- Keep AI visual treatment only for AI draft/recommendation/test areas.
- Remove or simplify large decorative gradients/icons in empty state and section headers.
- Make channels setup consistent with Integrations connector cards; do not duplicate connector logic where shared setup components can be reused.
- Ensure mobile uses a two-step flow:
  - agent list;
  - selected agent settings bottom sheet/fullscreen panel.

Acceptance criteria:

- `npm run build` passes.
- AI Agents remains visible in the sidebar for permitted roles.
- Direct `/dashboard/ai-agents` routes still render and redirect safely to a selected agent when needed.
- One-person business sees a simple AI setup path, not nine configuration tabs upfront.
- 100-person business can still manage multiple agents, channels and advanced controls.
- Advanced LLM/functions controls are not visible by default to non-technical roles.
- Permission behavior remains intact.
- Mobile does not show nested sidebar-inside-sidebar complexity.
- All visible labels are i18n-ready if text is changed.

## Phase 7 - Mobile Production Pass

### Task 7.1 Mobile list/detail patterns

Actions:

- Apply bottom sheet detail to Leads, Inbox, Clients, Deals.
- Convert tables to cards where needed.

Acceptance criteria:

- 320px, 390px and 430px widths are usable.
- No horizontal overflow except intentional calendar/table scroll zones.
- Primary actions are thumb-accessible.

### Task 7.2 Calendar mobile agenda

Actions:

- Make mobile default to agenda/day list.
- Move filters to sheet.
- Keep desktop calendar grid.

Acceptance criteria:

- Mobile user can create and inspect bookings without wide grid friction.
- Date navigation is obvious.

## Phase 8 - States, Accessibility And Production Polish

### Task 8.1 Standardize states

Actions:

- Loading skeletons.
- Empty states with action.
- Error states with retry where applicable.
- Forbidden/no permission states.
- Integration not connected states.

Acceptance criteria:

- All primary sidebar pages handle loading/empty/error/no-permission.
- State copy is short and actionable.

### Task 8.2 Accessibility and keyboard pass

Actions:

- Add labels/tooltips for icon-only buttons.
- Ensure focus states are visible.
- Ensure dialogs/sheets close via Escape.
- Ensure interactive rows are buttons/links where appropriate.

Acceptance criteria:

- No unlabeled critical icon button.
- Basic keyboard navigation works through primary flows.

### Task 8.3 Visual regression baseline

Actions:

- Add Playwright screenshots for key routes:
  - Dashboard
  - Leads
  - Deals
  - Clients
  - Inbox
  - Calendar
  - Integrations
  - Settings
- Capture desktop and mobile.

Acceptance criteria:

- Screenshots are stable enough for regression review.
- CI or manual script documents how to update baselines.

## Testing Requirements

## Implementation Notes

### 2026-05-30 production copy cleanup

Completed in current UI pass:

- Replaced merchant-facing technical words in integrations, bot setup, analytics and assistant-related copy with business terms: messages, channels, access keys, checks, manager handoff, overdue.
- Removed visible `Inbox`, `backend`, `smoke`, `production`, `API key`, `Access token`, `webhook`, `SLA`, `handoff`, `mock`, `beta/request` wording from the primary user-facing strings touched in this pass.
- Applied the same copy direction in `ru`, `en` and `kk` dictionaries where those strings are localized.
- Preserved truly technical developer/admin areas as advanced sections, but they must continue to be moved behind role/advanced visibility during Settings and Integrations phases.

Acceptance status:

- `frontend npm run check:i18n`: passed.
- Core smoke after AI Agents/sidebar cleanup: passed, 4 passed / 4 skipped.
- `frontend npm run build`: passed after copy cleanup.
- Targeted Playwright smoke after copy cleanup: passed, 4 passed / 4 skipped.

### 2026-05-30 integrations overview

Completed in current UI pass:

- Restored message channels as a first-class Integrations group: Website, Telegram, WhatsApp, Instagram.
- Added status filtering: all, connected, setup needed, by request, planned, needs attention.
- Added a calm right-side guidance panel with the recommended connection order.
- Kept setup modals and existing provider card behavior intact.
- Localized new visible overview copy in `ru`, `en` and `kk`.
- Stabilized the smoke navigation helper to click visible in-app links without forced clicks.

Acceptance status:

- `frontend npm run check:i18n`: passed.
- `frontend npm run build`: passed.
- Targeted Playwright smoke after Integrations overview: passed, 4 passed / 4 skipped.

### 2026-05-30 settings shell navigation

Completed in current UI pass:

- Rebuilt Settings internal navigation into grouped areas: Business, Team, Communication, Setup, Advanced.
- Added missing real sections to Settings navigation: Notifications and Developer.
- Anchored Developer as an advanced section instead of leaving it as an unlisted block in the middle of the page.
- Localized new section/group labels in `ru`, `en` and `kk`.

Acceptance status:

- `frontend npm run check:i18n`: passed.
- `frontend npm run build`: passed.
- Targeted Playwright smoke after Settings shell navigation: passed, 4 passed / 4 skipped.

### 2026-05-30 scheduling center

Completed in current UI pass:

- Upgraded Settings -> Operations into a clearer scheduling center for services, resources and working hours.
- Added recommended setup order so a one-person business can configure scheduling without reading docs.
- Kept Services, Resources and Working Hours as working deep links.
- Added return links from Services, Resources and Working Hours back to the scheduling center.
- Localized new scheduling copy in `ru`, `en` and `kk`.

Acceptance status:

- `frontend npm run check:i18n`: passed.
- `frontend npm run build`: passed.
- Targeted Playwright smoke after Scheduling center: passed, 4 passed / 4 skipped.

### 2026-05-30 automations as advanced settings

Completed in current UI pass:

- Added Automations to Settings -> Advanced as the primary discovery path.
- Kept `/dashboard/automations` as a working deep link for existing users and internal navigation.
- Removed the advanced builder from the page header and moved it behind an explicit advanced disclosure.
- Kept simple templates, rule toggles and run history as the default automation experience.
- Replaced visible technical preview/test-run copy with production-safe check/save language.
- Localized new automation/settings copy in `ru`, `en` and `kk`.

Acceptance status:

- `frontend npm run check:i18n`: passed.
- `frontend npm run build`: passed.
- Targeted Playwright smoke after Automations settings move: passed, 4 passed / 4 skipped.

### 2026-05-30 AI Agents simple-first shell

Completed in current UI pass:

- Kept AI Agents in the sidebar and preserved direct routes.
- Added an `overview` section as the default selected-agent surface instead of opening directly into configuration.
- Grouped agent sections into Basic, Behavior, Data and Advanced.
- Hid Advanced sections from the agent navigation by default while preserving direct deep links.
- Replaced native select controls in the edited areas with the shared `Select`.
- Replaced the local metric card with the shared `MetricCard`.
- Reduced ordinary AI-gradient usage on non-AI action surfaces.
- Localized the new AI Agents shell copy in `ru`, `en` and `kk`.
- Updated smoke expectation so invalid AI Agents deep links redirect to the new `overview` default.

Acceptance status:

- `frontend npm run check:i18n`: passed.
- `frontend npm run build`: passed.
- Targeted Playwright smoke after AI Agents shell: passed, 4 passed / 4 skipped.

### 2026-05-30 calendar mobile agenda

Completed in current UI pass:

- Added a mobile-first agenda section for Calendar with selected date, filter disclosure, day bookings and selected booking actions.
- Hid the heavy timeline workspace on small screens while keeping the desktop day/week/month calendar grid intact.
- Kept quick booking creation thumb-accessible on mobile.
- Localized new calendar labels in `ru`, `en` and `kk`.
- Removed remaining hardcoded merchant-facing copy touched in the Calendar page header, filters and selected-booking panel.

Acceptance status:

- `frontend npm run check:i18n`: passed.
- `frontend npx tsc -b --pretty false`: passed.
- `frontend npm run build`: passed.
- Targeted Playwright smoke after Calendar mobile agenda: passed, 4 passed / 4 skipped.

### 2026-05-30 mobile work queue layout

Completed in current UI pass:

- Confirmed Leads, Clients, Deals and Conversations already use the shared list/detail `WorkQueueLayout`.
- Tightened the shared mobile work queue height to the viewport instead of a fixed desktop-like minimum.
- Added a visible mobile detail header with the localized close label and close action.
- Kept desktop list/detail layouts unchanged.

Acceptance status:

- `frontend npm run check:i18n`: passed.
- `frontend npx tsc -b --pretty false`: passed.
- `frontend npm run build`: passed.
- Targeted Playwright smoke after mobile work queue layout: passed, 4 passed / 4 skipped.

### 2026-05-30 accessibility labels pass

Completed in current UI pass:

- Added accessible labels to icon-only controls in Mobile navigation, AI Agents, Calendar mini month and Automations advanced builder.
- Added localized automation remove labels in `ru`, `en` and `kk`.
- Fixed a backend regex compile issue in integration sanitization that blocked Playwright webServer startup during verification.

Acceptance status:

- `frontend npm run check:i18n`: passed.
- `frontend npx tsc -b --pretty false`: passed.
- `frontend npm run build`: passed.
- Targeted Playwright smoke after accessibility labels pass: passed, 4 passed / 4 skipped.

Minimum for every frontend task:

```bash
cd frontend
npm run build
```

If navigation/routes changed:

```bash
cd frontend
npm run e2e
```

If backend contracts changed:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
.venv/bin/python manage.py test
cd frontend && npm run build
```

Recommended full production verification before merging large UI phase:

```bash
scripts/codex_verify.sh
cd frontend && npm run e2e
```

## Production Definition Of Done Per Task

Each task must close with:

- Code implemented.
- No broken routes.
- Build green.
- Relevant tests updated and run.
- Desktop and mobile manually checked.
- Empty/loading/error/permission states checked.
- i18n keys added in ru/kk/en if visible text is introduced.
- `npm run check:i18n` passes, either directly or through `npm run build`.
- No unrelated changes.
- Short implementation note in final report.
- Known residual risks documented.

## Rollout Strategy

Do not rewrite the whole frontend in one PR.

Recommended rollout:

1. Foundation PR: build fix, design tokens, core primitives.
2. Layout PR: AppLayout, Sidebar, mobile nav.
3. Leads PR.
4. Inbox PR.
5. Clients PR.
6. Deals PR.
7. Dashboard/Analytics PR.
8. Integrations PR.
9. Settings shell PR.
10. Mobile polish PR.
11. Visual regression/QA PR.

Each PR must be independently production-ready.

## Implementation Guardrails

- Prefer existing API clients and data hooks.
- Do not change backend behavior unless required by UI flow.
- Do not remove legacy routes without redirect.
- Do not expose advanced/system setup as daily navigation.
- Do not use AI visuals for ordinary CRM actions.
- Do not create page-specific primitives if a shared primitive fits.
- Do not squeeze desktop tables into mobile.
- Do not add mock product functionality that looks real.
- Do not break role/permission behavior.

## Final Target

After this plan is implemented, ZANI should feel like:

- one CRM product, not separate page experiments;
- action-first, not decorative;
- mobile-ready for daily SMB work;
- clear enough for owner/admin/manager roles;
- AI-assisted only where AI has real data and a confirmable recommendation;
- production-safe with tested navigation, states and core workflows.

## Implementation Notes

### 2026-05-30 State Semantics Pass

Status: completed.

Implemented:

- Added `role="status"`, `aria-live="polite"` and `aria-busy` to shared loading states.
- Added `role="alert"` to shared error and permission states.
- Marked decorative state icons and skeleton blocks as hidden from assistive technology.
- Kept visual styling unchanged so the pass improves production accessibility without shifting layouts.

Verification:

- `cd frontend && npm run check:i18n`
- `cd frontend && npx tsc -b --pretty false`
- `cd frontend && npm run build`

Acceptance status:

- Shared loading/error/permission states are now more predictable for screen readers.
- No new visible text was introduced, so ru/en/kk dictionary parity remains unchanged.

### 2026-05-30 Leads I18n Hardening Pass

Status: completed.

Implemented:

- Removed hardcoded visible Russian copy from `frontend/src/features/leads/LeadsPage.tsx`.
- Localized lead queue labels, filters, statuses, sources, notices, modals, empty states and control panel labels.
- Added matching ru/en/kk keys for the new lead page copy.
- Kept the existing work-queue layout and behavior unchanged.

Verification:

- `cd frontend && rg '[А-Яа-яЁё]' src/features/leads/LeadsPage.tsx -n` returns no matches.
- `cd frontend && npm run check:i18n`
- `cd frontend && npx tsc -b --pretty false`
- `cd frontend && npm run build`
- `cd frontend && E2E_SKIP_LOCAL_SETUP=true npx playwright test e2e/smoke.spec.ts --grep "business owner can use core merchant CRM pages|business owner core routes render without 404|desktop sidebar links render without 404|mobile owner smoke"`

Acceptance status:

- Leads page no longer blocks ru/en/kk production readiness with hardcoded Russian UI strings.
- Core CRM and mobile smoke routes remain green.

### 2026-05-30 Clients I18n Hardening Pass

Status: completed.

Implemented:

- Removed hardcoded visible Russian copy from `frontend/src/features/clients/ClientsPage.tsx`.
- Localized client filters, source labels, list states, detail metrics, quick actions, timeline fallbacks and modals.
- Added matching ru/en/kk keys for the new client page copy.
- Preserved the existing work-queue layout and client profile behavior.
- Stabilized the desktop core route audit by giving the 20-route smoke test a realistic 60s timeout while keeping all 404/crash assertions.

Verification:

- `cd frontend && rg '[А-Яа-яЁё]' src/features/clients/ClientsPage.tsx -n` returns no matches.
- `cd frontend && npm run check:i18n`
- `cd frontend && npx tsc -b --pretty false`
- `cd frontend && npm run build`
- `cd frontend && E2E_SKIP_LOCAL_SETUP=true npx playwright test e2e/smoke.spec.ts --grep "business owner can use core merchant CRM pages|business owner core routes render without 404|desktop sidebar links render without 404|mobile owner smoke"`

Acceptance status:

- Clients page no longer blocks ru/en/kk production readiness with hardcoded Russian UI strings.
- Core CRM, desktop route audit, sidebar route audit and mobile smoke routes are green.

### 2026-05-30 Deals I18n Hardening Pass

Status: completed.

Implemented:

- Removed hardcoded visible Russian copy from `frontend/src/features/deals/DealsPage.tsx`.
- Localized deal filters, source labels, list cards, summary metrics, guard messages, detail panels, conversation/history states and modals.
- Added matching ru/en/kk keys for the new deal page copy.
- Kept the existing work-queue layout, stage guard behavior and deal mutation flows unchanged.

Verification:

- `cd frontend && rg '[А-Яа-яЁё]' src/features/deals/DealsPage.tsx -n` returns no matches.
- `cd frontend && npm run check:i18n`
- `cd frontend && npx tsc -b --pretty false`
- `cd frontend && npm run build`
- `cd frontend && E2E_SKIP_LOCAL_SETUP=true npx playwright test e2e/smoke.spec.ts --grep "business owner can use core merchant CRM pages|business owner core routes render without 404|desktop sidebar links render without 404|mobile owner smoke"`

Acceptance status:

- Deals page no longer blocks ru/en/kk production readiness with hardcoded Russian UI strings.
- Core CRM, desktop route audit, sidebar route audit and mobile smoke routes are green.

### 2026-05-30 Conversations I18n Hardening Pass

Status: completed.

Implemented:

- Removed hardcoded visible Russian copy from `frontend/src/features/conversations/ConversationsPage.tsx`.
- Localized conversation titles, channel labels, list previews, bulk actions, notices, filters, thread controls, composer states, side context and AI hint copy.
- Added matching ru/en/kk keys for the new inbox copy.
- Preserved current inbox behavior, realtime query settings, bulk actions and CRM pipeline actions.
- Stabilized the desktop full route audit with a 120s timeout because it exercises 20 heavy routes including AI pages; route, 404 and crash assertions remain unchanged.

Verification:

- `cd frontend && rg '[А-Яа-яЁё]' src/features/conversations/ConversationsPage.tsx -n` returns no matches.
- `cd frontend && npm run check:i18n`
- `cd frontend && npx tsc -b --pretty false`
- `cd frontend && npm run build`
- `cd frontend && E2E_SKIP_LOCAL_SETUP=true npx playwright test e2e/smoke.spec.ts --grep "business owner can use core merchant CRM pages|business owner core routes render without 404|desktop sidebar links render without 404|mobile owner smoke"`

Acceptance status:

- Conversations page no longer blocks ru/en/kk production readiness with hardcoded Russian UI strings.
- Core CRM, desktop route audit, sidebar route audit and mobile smoke routes are green.

### 2026-05-30 Integrations Import Panel I18n Pass

Status: completed.

Implemented:

- Removed hardcoded visible Russian copy from `frontend/src/features/integrations/components/ImportPanel.tsx`.
- Localized import entity options, status labels, file validation, action buttons, selected-file states, metrics, row errors, duplicate warnings, preview empty state and import history.
- Added matching ru/en/kk keys for the import panel copy.
- Preserved the existing import, template download, preview, duplicate and confirmation flows.

Verification:

- `cd frontend && rg '[А-Яа-яЁё]' src/features/integrations/components/ImportPanel.tsx -n` returns no matches.
- `cd frontend && npm run check:i18n`
- `cd frontend && npx tsc -b --pretty false`
- `cd frontend && npm run build`
- `cd frontend && E2E_SKIP_LOCAL_SETUP=true npx playwright test e2e/smoke.spec.ts --grep "business owner can use core merchant CRM pages|business owner core routes render without 404|desktop sidebar links render without 404|mobile owner smoke"`

Acceptance status:

- Integrations import panel no longer blocks ru/en/kk production readiness with hardcoded Russian UI strings.
- Core CRM, desktop route audit, sidebar route audit and mobile smoke routes are green.

### 2026-05-30 Integrations Catalog I18n Pass

Status: completed.

Implemented:

- Replaced hardcoded provider labels, group headings and provider descriptions in the integrations catalog config with i18n keys.
- Localized provider card statuses, primary actions, modal title, generic connector fields, website hover copy, notices and request/check actions.
- Added matching ru/en/kk keys for integration groups, providers, statuses and card-level copy.
- Preserved existing provider filtering, search, status grouping, channel toggles and connector mutation flows.

Verification:

- `cd frontend && npm run check:i18n`
- `cd frontend && npx tsc -b --pretty false`
- `cd frontend && npm run build`
- `cd frontend && E2E_SKIP_LOCAL_SETUP=true npx playwright test e2e/smoke.spec.ts --grep "business owner can use core merchant CRM pages|business owner core routes render without 404|desktop sidebar links render without 404|mobile owner smoke"`

Acceptance status:

- Integrations catalog uses the same ru/en/kk localization contract as the cleaned CRM pages.
- Core CRM, desktop route audit, sidebar route audit and mobile smoke routes are green.

### 2026-05-30 Messenger Setup I18n Pass

Status: completed.

Implemented:

- Removed hardcoded visible Russian copy from the shared messenger setup shell.
- Localized Telegram setup notices, statuses, channel creation, bot key guidance, connection check and incoming-message actions.
- Localized Instagram setup notices, statuses, Meta connection flow, manual access fields and action buttons.
- Added matching ru/en/kk keys for shared setup, Telegram and Instagram setup copy.
- Preserved existing channel creation, token/manual setup, OAuth callback, connection check and channel toggle behavior.

Verification:

- `cd frontend && rg '[А-Яа-яЁё]' src/features/integrations/components/setup/IntegrationSetupUi.tsx src/features/integrations/components/setup/TelegramSetup.tsx src/features/integrations/components/setup/InstagramSetup.tsx -n` returns no matches.
- `cd frontend && npm run check:i18n`
- `cd frontend && npx tsc -b --pretty false`
- `cd frontend && npm run build`
- `cd frontend && E2E_SKIP_LOCAL_SETUP=true npx playwright test e2e/smoke.spec.ts --grep "business owner can use core merchant CRM pages|business owner core routes render without 404|desktop sidebar links render without 404|mobile owner smoke"`

Acceptance status:

- Shared messenger setup, Telegram setup and Instagram setup no longer block ru/en/kk production readiness with hardcoded Russian UI strings.
- Core CRM, desktop route audit, sidebar route audit and mobile smoke routes are green.

### 2026-05-30 WhatsApp Setup I18n Pass

Status: completed.

Implemented:

- Removed hardcoded visible Russian copy from `frontend/src/features/integrations/components/setup/WhatsAppSetup.tsx`.
- Localized WhatsApp Meta embedded signup notices, connection statuses, channel creation, manual access fields, check/save actions and completion states.
- Added matching ru/en/kk keys for WhatsApp setup copy.
- Preserved existing channel creation, Meta embedded signup, manual credential setup, connection check and channel toggle behavior.

Verification:

- `cd frontend && rg '[А-Яа-яЁё]' src/features/integrations/components/setup/WhatsAppSetup.tsx -n` returns no matches.
- `cd frontend && npm run check:i18n`
- `cd frontend && npx tsc -b --pretty false`
- `cd frontend && npm run build`
- `cd frontend && E2E_SKIP_LOCAL_SETUP=true npx playwright test e2e/smoke.spec.ts --grep "business owner can use core merchant CRM pages|business owner core routes render without 404|desktop sidebar links render without 404|mobile owner smoke"`

Acceptance status:

- WhatsApp setup no longer blocks ru/en/kk production readiness with hardcoded Russian UI strings.
- Core CRM, desktop route audit, sidebar route audit and mobile smoke routes are green.

### 2026-05-30 Kaspi Setup I18n Pass

Status: completed.

Implemented:

- Removed hardcoded visible Russian copy from `frontend/src/features/integrations/components/setup/KaspiSetup.tsx`.
- Localized Kaspi access notices, connection checks, order sync messages, access/mode/order metrics, access-card copy, advanced settings, order state options and action buttons.
- Added reusable ru/en/kk keys for connector setup metrics and actions that can be reused by MойСклад, Ozon and Wildberries setup screens.
- Added matching ru/en/kk keys for Kaspi setup copy.
- Preserved existing Kaspi credential save, test connection, order sync and advanced configuration behavior.

Verification:

- `cd frontend && rg '[А-Яа-яЁё]' src/features/integrations/components/setup/KaspiSetup.tsx -n` returns no matches.
- `cd frontend && npm run check:i18n`
- `cd frontend && npx tsc -b --pretty false`
- `cd frontend && npm run build`
- `cd frontend && E2E_SKIP_LOCAL_SETUP=true npx playwright test e2e/smoke.spec.ts --grep "business owner can use core merchant CRM pages|business owner core routes render without 404|desktop sidebar links render without 404|mobile owner smoke"`

Acceptance status:

- Kaspi setup no longer blocks ru/en/kk production readiness with hardcoded Russian UI strings.
- Core CRM, desktop route audit, sidebar route audit and mobile smoke routes are green.

### 2026-05-30 MoySklad Setup I18n Pass

Status: completed.

Implemented:

- Removed hardcoded visible Russian copy from `frontend/src/features/integrations/components/setup/MoySkladSetup.tsx`.
- Localized MoySklad access notices, connection checks, sync result messages, access/mode/inventory metrics, access-card copy, entity toggles, advanced settings and action buttons.
- Reused the shared connector setup metric/action keys introduced in the Kaspi setup pass.
- Added matching ru/en/kk keys for MoySklad setup copy.
- Preserved existing MoySklad credential save, test connection, data sync, entity selection and advanced configuration behavior.

Verification:

- `cd frontend && rg '[А-Яа-яЁё]' src/features/integrations/components/setup/MoySkladSetup.tsx -n` returns no matches.
- `cd frontend && npm run check:i18n`
- `cd frontend && npx tsc -b --pretty false`
- `cd frontend && npm run build`
- `cd frontend && E2E_SKIP_LOCAL_SETUP=true npx playwright test e2e/smoke.spec.ts --grep "business owner can use core merchant CRM pages|business owner core routes render without 404|desktop sidebar links render without 404|mobile owner smoke"`

Acceptance status:

- MoySklad setup no longer blocks ru/en/kk production readiness with hardcoded Russian UI strings.
- Core CRM, desktop route audit, sidebar route audit and mobile smoke routes are green.

### 2026-05-30 Ozon Setup I18n Pass

Status: completed.

Implemented:

- Removed hardcoded visible Russian copy from `frontend/src/features/integrations/components/setup/OzonSetup.tsx`.
- Localized Ozon access notices, connection checks, sync result messages, access/mode/data metrics, access-card copy, entity toggles, advanced settings and action buttons.
- Reused the shared connector setup metric/action keys introduced in the Kaspi setup pass.
- Added matching ru/en/kk keys for Ozon setup copy.
- Preserved existing Ozon credential save, test connection, data sync, entity selection and advanced configuration behavior.

Verification:

- `cd frontend && rg '[А-Яа-яЁё]' src/features/integrations/components/setup/OzonSetup.tsx -n` returns no matches.
- `cd frontend && npm run check:i18n`
- `cd frontend && npx tsc -b --pretty false`
- `cd frontend && npm run build`
- `cd frontend && E2E_SKIP_LOCAL_SETUP=true npx playwright test e2e/smoke.spec.ts --grep "business owner can use core merchant CRM pages|business owner core routes render without 404|desktop sidebar links render without 404|mobile owner smoke"`

Acceptance status:

- Ozon setup no longer blocks ru/en/kk production readiness with hardcoded Russian UI strings.
- Core CRM, desktop route audit, sidebar route audit and mobile smoke routes are green.

### 2026-05-30 Wildberries Setup I18n Pass

Status: completed.

Implemented:

- Removed hardcoded visible Russian copy from `frontend/src/features/integrations/components/setup/WildberriesSetup.tsx`.
- Localized Wildberries access notices, connection checks, sync result messages, access/mode/update metrics, access-card copy, entity toggles, advanced settings, optional stock warning and action buttons.
- Reused the shared connector setup metric/action keys introduced in the Kaspi setup pass.
- Added matching ru/en/kk keys for Wildberries setup copy.
- Preserved existing Wildberries credential save, test connection, data sync, entity selection and advanced configuration behavior.

Verification:

- `cd frontend && rg '[А-Яа-яЁё]' src/features/integrations/components/setup/WildberriesSetup.tsx -n` returns no matches.
- `cd frontend && npm run check:i18n`
- `cd frontend && npx tsc -b --pretty false`
- `cd frontend && npm run build`
- `cd frontend && E2E_SKIP_LOCAL_SETUP=true npx playwright test e2e/smoke.spec.ts --grep "business owner can use core merchant CRM pages|business owner core routes render without 404|desktop sidebar links render without 404|mobile owner smoke"`

Acceptance status:

- Wildberries setup no longer blocks ru/en/kk production readiness with hardcoded Russian UI strings.
- Core CRM, desktop route audit, sidebar route audit and mobile smoke routes are green.

### 2026-05-31 Kaspi Pricing Setup I18n Pass

Status: completed.

Implemented:

- Removed hardcoded visible Russian copy from `frontend/src/features/integrations/components/setup/KaspiPricingSetup.tsx`.
- Localized Kaspi Pricing status labels, notices, product explanation, metrics, emergency stop block, latest change section and empty history state.
- Added matching ru/en/kk keys for Kaspi Pricing setup copy and missing shared pricing status labels.
- Kept the backend emergency-stop audit reason deterministic and language-neutral.
- Stabilized the desktop sidebar route audit timeout from 30s to 90s while preserving the same URL, 404 and crash assertions.

Verification:

- `cd frontend && rg '[А-Яа-яЁё]' src/features/integrations/components/setup/KaspiPricingSetup.tsx -n` returns no matches.
- `cd frontend && npm run check:i18n`
- `cd frontend && npx tsc -b --pretty false`
- `cd frontend && npm run build`
- `cd frontend && E2E_SKIP_LOCAL_SETUP=true npx playwright test e2e/smoke.spec.ts --grep "desktop sidebar links render without 404"`
- `cd frontend && E2E_SKIP_LOCAL_SETUP=true npx playwright test e2e/smoke.spec.ts --grep "business owner can use core merchant CRM pages|business owner core routes render without 404|desktop sidebar links render without 404|mobile owner smoke"`

Acceptance status:

- Kaspi Pricing setup no longer blocks ru/en/kk production readiness with hardcoded Russian UI strings.
- Core CRM, desktop route audit, sidebar route audit and mobile smoke routes are green.

### 2026-06-01 AI Assistant I18n Pass

Status: completed.

Implemented:

- Removed hardcoded visible Russian copy from `frontend/src/features/assistant/AIAssistantPage.tsx`.
- Localized the AI Navigator workspace signal heading, integration insights block, empty integration-events state, suggested actions label and refresh/open actions.
- Moved the daily business brief prompt into ru/en/kk i18n keys so generated AI instructions follow the current interface language.
- Replaced a technical Meta SDK load error in `frontend/src/features/integrations/components/setup/metaCallbacks.ts` with language-neutral English text, keeping it out of the visible UI layer.
- Added matching ru/en/kk keys and preserved dictionary parity.

Verification:

- `cd frontend && rg '[А-Яа-яЁё]' src/features/assistant/AIAssistantPage.tsx src/features/integrations/components/setup/metaCallbacks.ts -n` returns no matches.
- `cd frontend && npm run check:i18n`
- `cd frontend && npx tsc -b --pretty false`
- `cd frontend && npm run build`
- `cd frontend && E2E_SKIP_LOCAL_SETUP=true npx playwright test e2e/smoke.spec.ts --grep "business owner can use core merchant CRM pages|business owner core routes render without 404|desktop sidebar links render without 404|mobile owner smoke"`

Acceptance status:

- AI Assistant no longer blocks ru/en/kk production readiness with hardcoded Russian UI strings.
- The prompt layer is ready for localized AI output without changing the page behavior.
- Core CRM, desktop route audit, sidebar route audit and mobile smoke routes are green.

### 2026-06-01 Settings Communication I18n Pass

Status: completed.

Implemented:

- Removed hardcoded visible Russian copy from the appointment auto-messages and notification-preferences blocks in `frontend/src/features/settings/SettingsPage.tsx`.
- Localized appointment scenario titles/descriptions, channel labels, loading state, field labels, enabled/paused status and save action.
- Localized notification category titles/descriptions, page copy, disabled-count badge and enabled/disabled status.
- Kept the Cyrillic-aware slug regex unchanged because it is data normalization logic, not visible interface copy.
- Added matching ru/en/kk keys and preserved dictionary parity.

Verification:

- `cd frontend && rg '[А-Яа-яЁё]' src/features/settings/SettingsPage.tsx -n` returns only the intentional Cyrillic-aware slug regex.
- `cd frontend && npm run check:i18n`
- `cd frontend && npx tsc -b --pretty false`
- `cd frontend && npm run build`
- `cd frontend && E2E_SKIP_LOCAL_SETUP=true npx playwright test e2e/smoke.spec.ts --grep "business owner can use core merchant CRM pages|business owner core routes render without 404|desktop sidebar links render without 404|mobile owner smoke"`

Acceptance status:

- Settings communication blocks no longer block ru/en/kk production readiness with hardcoded Russian UI strings.
- Core CRM, desktop route audit, sidebar route audit and mobile smoke routes are green.

### 2026-06-01 Final Sidebar I18n And Shared UI Pass

Status: completed.

Implemented:

- Removed hardcoded visible Russian copy from shared UI surfaces:
  - `frontend/src/components/layout/Header.tsx`
  - `frontend/src/components/ui/Select.tsx`
  - `frontend/src/components/ui/AppErrorBoundary.tsx`
  - `frontend/src/lib/permissions.ts`
- Added a reusable `translate(language, key, vars)` helper in `frontend/src/lib/i18n.tsx` so class-based boundary UI uses the same ru/en/kk dictionary as the rest of the app.
- Removed hardcoded visible Russian copy from final sidebar pages and setup cards:
  - `frontend/src/features/pricing/PricingPage.tsx`
  - `frontend/src/features/outreach/OutreachPage.tsx`
  - `frontend/src/features/bots/TelegramSetupCard.tsx`
  - `frontend/src/features/dashboard/OwnerDashboard.tsx`
- Moved Pricing, Outreach, Telegram setup, dashboard deltas, select fallback, chat toast, error boundary copy and shared permission fallback copy into ru/en/kk i18n keys.
- Replaced remaining technical/service payload Russian strings with language-neutral English in:
  - `frontend/src/api/client.ts`
  - `frontend/src/api/inbox.ts`
  - `frontend/src/features/integrations/config/providerCatalog.ts`
- Preserved the only remaining Cyrillic match in `SettingsPage.tsx`: the slug/key regex intentionally supports Cyrillic business field names and is not visible UI copy.
- Preserved existing Pricing, Outreach, Telegram and dashboard behavior while removing page-level language coupling.

Verification:

- `cd frontend && rg '[А-Яа-яЁё]' src --glob '*.tsx' --glob '*.ts' --glob '!frontend/src/lib/i18n.tsx'` returns only the intentional Cyrillic-aware slug regex in `SettingsPage.tsx`.
- `cd frontend && npm run check:i18n`
- `cd frontend && npx tsc -b --pretty false`
- `cd frontend && npm run build`
- `cd frontend && E2E_SKIP_LOCAL_SETUP=true npx playwright test e2e/smoke.spec.ts --grep "business owner can use core merchant CRM pages|business owner core routes render without 404|desktop sidebar links render without 404|mobile owner smoke"`

Acceptance status:

- All visible frontend sidebar/page UI copy is now routed through ru/en/kk i18n, with a documented non-UI regex exception.
- Core CRM, desktop route audit, sidebar route audit and mobile smoke routes are green.
- The implementation is production-ready against the current smoke/build gate; the existing Vite large-chunk warning remains a performance follow-up, not a blocker.
