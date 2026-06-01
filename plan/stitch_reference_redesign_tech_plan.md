# ZANI Stitch Reference Redesign Analysis And Technical Plan

Date: 2026-06-01

Status: proposed production implementation plan

Scope: frontend UI/UX redesign based on local Stitch references from `references/stitch_references`.

## Goal

Use the Stitch screens as a visual and structural reference for the next ZANI redesign phase without breaking current product behavior.

The redesign must improve clarity, consistency and speed of daily CRM work. It must not change API contracts, routes, roles, permissions, business logic or existing data flows.

## Hard Constraints

- Do not change API.
- Do not change routes.
- Do not change roles or permission gates.
- Do not remove current business blocks.
- Do not replace existing working flows with static Stitch HTML.
- Do not introduce a second design system.
- Do not add visible technical text to production UI.
- All visible strings must stay localized in `ru`, `en` and `kk`.
- Every implemented step must be production-ready before moving to the next one.

## Reference Files Reviewed

- `_1/screen.png` - owner dashboard / business control panel.
- `_2/screen.png` - conversations / AI-assisted inbox.
- `_3/screen.png` - leads work queue.
- `_4/screen.png` - analytics.
- `_5/screen.png` - integrations.
- `_6/screen.png` - settings.
- `crm/screen.png` - clients and retention.
- `zani_business_intelligence/DESIGN.md` - design tokens and visual principles.

## Stitch Reference Summary

The Stitch concept presents ZANI as a calm business control layer for owners and operators. Its strongest idea is not decoration. Its strongest idea is page architecture:

- persistent navigation;
- one clear page job;
- one high-priority AI insight;
- CRM data grouped into simple cards, lists or tables;
- visible next actions;
- fewer admin surfaces;
- AI used as business prioritization, not as visual noise.

This direction fits ZANI's product priority: avoid a Bitrix24-like overloaded interface while still supporting both one-person businesses and teams around 100 employees.

## Main Strengths Of Stitch References

### 1. Clear Product Shell

Stitch uses a stable desktop shell:

- fixed left sidebar around `260px`;
- top header around `64px`;
- light gray page canvas;
- white content cards;
- consistent page padding;
- active sidebar state with left border and tinted background.

Why this is good for ZANI:

- users always know where they are;
- pages feel like one product;
- navigation does not compete with content;
- daily CRM loops are easier to scan.

Implementation direction:

- keep current `AppLayout`, `Sidebar`, `Header` and `MobileNav`;
- restyle them through shared tokens instead of creating new layouts;
- keep AI Agents in sidebar by previous product decision;
- avoid adding new top-level sidebar items unless explicitly approved.

### 2. Calm Visual Language

The reference uses a practical CRM palette:

- background: cool light gray;
- cards: white;
- primary: deep navy;
- action blue: focused on primary actions;
- green/orange/red: semantic states;
- violet-blue gradient: reserved for AI/smart features.

Why this is good for ZANI:

- business data stays readable;
- status and risk are visible without heavy decoration;
- AI can be recognized quickly without taking over every screen.

Implementation direction:

- map Stitch tokens into existing Tailwind/theme variables;
- limit gradients to AI insight cards, AI priority badges and selected smart states;
- remove broad decorative gradients from ordinary CRM surfaces.

### 3. Owner-First Dashboard

The dashboard reference is the strongest screen. It gives an owner a fast answer:

- what changed;
- what is risky;
- what needs action now;
- which channels/integrations are healthy;
- which conversations are waiting.

Why this is good for ZANI:

- it supports one-person companies because the page is immediately useful;
- it supports larger teams because the same page becomes a control tower;
- it reduces the need for many separate admin pages.

Implementation direction:

- make Dashboard the pilot page for the redesign;
- use one primary AI insight at the top;
- keep KPI cards compact and comparable;
- show urgent actions and unanswered conversations as operational queues;
- do not expose implementation/debug details in production text.

### 4. AI As Prioritization, Not Decoration

Stitch uses AI cards for specific business recommendations:

- prioritize a lead;
- reactivate a client;
- optimize spend;
- suggest a reply;
- surface a risk.

Why this is good for ZANI:

- AI becomes actionable;
- users do not need to understand technical AI settings;
- AI visual treatment has meaning.

Implementation direction:

- create or standardize a reusable `AIInsightCard`;
- every AI insight must have a short explanation and a concrete action;
- avoid generic "AI magic" copy;
- hide advanced AI configuration behind Settings or AI Agents page sections.

### 5. Work Queue Patterns

The leads, clients and dashboard screens use focused queues:

- new leads;
- overdue leads;
- unassigned leads;
- inactive clients;
- unanswered chats;
- urgent business actions.

Why this is good for ZANI:

- operators can start work without configuring filters;
- owners can see bottlenecks;
- teams can scale through assignment/status, not more menus.

Implementation direction:

- reuse a single work queue structure across Leads, Clients, Deals and Dashboard;
- keep filters compact;
- provide saved/simple defaults before advanced filtering;
- use drawers or details panels for deeper actions.

### 6. CRM Tables Stay Understandable

The clients screen uses a table that is easier to scan than a dense enterprise CRM table:

- client identity;
- status;
- last contact;
- value;
- tags;
- one contextual action.

Why this is good for ZANI:

- users see the business object first;
- secondary metadata does not dominate;
- risk rows can be highlighted without adding extra columns.

Implementation direction:

- standardize table density, row height, badges and action placement;
- add mobile card representation for wide tables;
- keep row actions contextual and minimal.

### 7. Integrations Are Grouped By User Meaning

The integrations screen groups connectors by business category:

- messengers;
- marketplace;
- finance;
- imports.

Why this is good for ZANI:

- integrations feel like business tools, not technical providers;
- one-person businesses understand what to connect first;
- larger companies can still find setup surfaces.

Implementation direction:

- keep current integration business logic;
- redesign cards with consistent status, description and action;
- reduce oversized decorative banners;
- keep advanced setup inside connector details.

### 8. Settings Are Structured Around Real Business Areas

The settings reference separates:

- business profile;
- employees and roles;
- AI copilots;
- notifications;
- security.

Why this is good for ZANI:

- settings become predictable;
- high-risk security actions are visually separated;
- role/team management can scale without overwhelming small companies.

Implementation direction:

- keep settings sections;
- hide advanced options by default;
- separate dangerous actions with clear semantic styling;
- preserve all permission checks.

### 9. Mobile Direction Is Clear

The design spec suggests:

- sidebar hidden on mobile;
- bottom navigation;
- sticky top header;
- reduced padding;
- mobile-friendly content cards.

Why this is good for ZANI:

- mobile becomes first-class;
- operators can handle daily work from phone;
- tables and complex grids can become cards/bottom sheets.

Implementation direction:

- keep current mobile navigation decisions;
- validate every redesigned page at mobile width;
- use bottom sheets/drawers for detail surfaces;
- avoid squeezing desktop tables into mobile.

## What Not To Copy From Stitch

Do not copy these parts directly:

- generated static HTML structure;
- demo profile images and fake avatars;
- external images;
- Material Symbols if current code uses another icon system;
- hardcoded Russian text;
- fake business numbers;
- decorative gradients on non-AI sections;
- hover scaling that shifts layout;
- oversized cards where production pages need density;
- any technical copy from demo screens.

Stitch is a reference for layout, hierarchy and product feeling. The implementation must be native to the current frontend.

## Target Design Direction For ZANI

ZANI should feel like:

- a calm SMB business cockpit;
- a CRM that tells the user what matters next;
- an AI-native assistant for prioritization;
- a product with simple defaults and advanced power hidden until needed.

ZANI should not feel like:

- Bitrix24;
- a settings-heavy admin panel;
- a collection of unrelated pages;
- a static AI demo;
- an interface where every feature gets its own menu item.

## Target UI Architecture

### Global Shell

Desktop:

- fixed sidebar;
- compact header;
- content max width for readability;
- consistent page padding;
- stable route title and action area.

Mobile:

- sticky top header;
- bottom navigation;
- page content in one-column flow;
- details in bottom sheets or drawers;
- tables converted to cards.

### Page Template Types

Use a small set of templates instead of unique layouts per page:

1. Control Dashboard Template
   - Dashboard, role dashboards, owner cockpit.

2. Work Queue Template
   - Leads, Deals, Tasks, Clients at-risk views.

3. Inbox Template
   - Conversations and support/operator flows.

4. Data Table Template
   - Clients, employees, audit-like lists.

5. Analytics Template
   - KPI, charts, breakdowns, trends.

6. Setup Catalog Template
   - Integrations, AI agents, connector setup.

7. Settings Template
   - Business profile, permissions, security, notifications.

## Required Shared Components

Standardize or create these components before broad page redesign:

- `PageShell` / page layout primitives if current layout needs consolidation.
- `PageHeader` with title, description, status, primary action and optional search.
- `Card` variants:
  - default;
  - metric;
  - table container;
  - AI insight;
  - warning/danger.
- `Button` variants:
  - primary;
  - secondary;
  - ghost;
  - outline;
  - danger;
  - icon.
- `Input` and `SearchInput`.
- `FilterBar`.
- `StatusBadge`.
- `MetricCard`.
- `AIInsightCard`.
- `WorkQueueCard`.
- `EmptyState`, `LoadingState`, `ErrorState`, `NoAccessState`.
- `ResponsiveTable` or table-to-card pattern.
- `SectionHeader`.
- `IntegrationCard`.
- `SettingsSection`.

## Design Token Plan

Add or align tokens through the current styling system:

### Color Tokens

- page background: cool light gray;
- surface: white;
- surface muted: light gray;
- border: low-contrast cool gray;
- text primary: deep navy/near-black;
- text secondary: muted slate;
- primary action: blue;
- AI accent: violet to blue;
- success/warning/error: semantic, not decorative.

### Radius Tokens

- cards and sections: `12px`;
- buttons and inputs: `8px`;
- pills and badges: full radius;
- avoid inconsistent large radii across production CRM screens.

### Spacing Tokens

- desktop page padding: `24px`;
- mobile page padding: `16px`;
- card gap: `20px`;
- section gap: `32px`;
- dense table/list internal spacing must stay consistent.

### Shadow And Elevation

- default cards: subtle shadow or border, not both heavily;
- AI cards: subtle gradient border/glow;
- modals/drawers: stronger elevation;
- no layout-shifting hover animations.

### Motion Tokens

- hover/focus transitions: `150-200ms`;
- drawer/sheet transitions: `180-240ms`;
- pressed state: opacity/background change or minimal scale only when it does not affect layout;
- respect reduced motion.

## Page-By-Page Redesign Plan

### Phase 0 - Baseline Audit

Goal: lock current behavior before visual changes.

Tasks:

- Capture desktop and mobile screenshots for all sidebar routes.
- List current route components and permission gates.
- Identify hardcoded visible strings in pages that will be touched.
- Confirm i18n parity for `ru`, `en`, `kk`.
- Confirm current smoke tests pass.

Acceptance:

- Baseline screenshots saved or documented.
- Current build is green before redesign work starts.
- No redesign task starts from a broken frontend.

Recommended checks:

```bash
cd frontend
npm run check:i18n
npx tsc -b --pretty false
npm run build
```

### Phase 1 - Design Tokens And Shared Foundations

Goal: make the current app able to express the Stitch visual system through native components.

Tasks:

- Align global background, surface, border, text and action colors.
- Normalize radius, shadow, spacing and focus styles.
- Standardize base `Card`, `Button`, `Input`, `Badge`, `PageHeader`.
- Add `AIInsightCard` variant with restrained gradient border.
- Add consistent empty/loading/error/no-access state components if missing.
- Confirm all new text uses i18n keys.

Acceptance:

- Existing pages still render.
- No API/route/role changes.
- Shared components support production states.
- No broad visual regressions from one-off overrides.

### Phase 2 - Sidebar And Header Redesign

Goal: make navigation feel consistent with Stitch while preserving current route structure.

Tasks:

- Restyle sidebar active, hover and collapsed/mobile states.
- Keep AI Agents link visible in sidebar.
- Keep existing route permissions.
- Align header search/status/profile controls.
- Ensure mobile bottom nav and More drawer remain complete.

Acceptance:

- Every sidebar link still navigates to the same route.
- Role-based visibility is unchanged.
- Desktop and mobile navigation are usable.
- No hidden route becomes unreachable.

### Phase 3 - Dashboard Pilot

Goal: implement the reference visual system on the highest-value page first.

Tasks:

- Introduce owner-style dashboard hierarchy:
  - page header;
  - one primary AI insight;
  - KPI cards;
  - urgent actions;
  - unanswered conversations;
  - integration health.
- Keep existing dashboard data and business logic.
- Remove technical/debug copy from visible UI.
- Use shared `MetricCard`, `AIInsightCard`, `WorkQueueCard`.
- Validate mobile layout.

Acceptance:

- Dashboard is production-ready.
- Data sources are unchanged.
- Actions call existing handlers.
- Empty/loading/error/no-access states are handled.
- Screenshots show a coherent visual system.

### Phase 4 - Leads And Deals Work Queues

Goal: make sales execution simple and consistent.

Tasks:

- Apply work queue template to Leads.
- Apply same structure to Deals where applicable.
- Standardize filters, view toggles, cards/table states and row actions.
- Use AI priority banner only for real priority signals.
- Keep assignment, status and ownership behavior unchanged.

Acceptance:

- Existing lead/deal flows still work.
- Role permissions remain intact.
- Mobile cards are usable.
- Bulk/advanced controls are not primary unless needed.

### Phase 5 - Inbox / Conversations

Goal: align conversations with Stitch's split-pane AI-assisted inbox.

Tasks:

- Standardize conversation list density and status badges.
- Keep channel filters compact.
- Keep conversation detail/composer behavior unchanged.
- Add or restyle AI reply suggestion as a restrained action block.
- Ensure transfer/resolve actions remain role-safe.

Acceptance:

- Existing send/reply/resolve flows still work.
- AI suggestions do not override user control.
- Mobile conversation navigation is clear.
- Empty/loading/error states are complete.

### Phase 6 - Clients / CRM

Goal: make client management readable and retention-oriented.

Tasks:

- Apply data table template on desktop.
- Add mobile card representation.
- Standardize columns around identity, status, last contact, value, tags and action.
- Add AI retention insight only when connected to real client data.
- Keep client detail routes/actions unchanged.

Acceptance:

- Current client data and actions are preserved.
- Table is scannable on desktop.
- Mobile layout does not require horizontal scrolling for core fields.
- i18n keys cover all labels and states.

### Phase 7 - Analytics

Goal: make analytics useful for business decisions, not just visual charts.

Tasks:

- Apply analytics template:
  - one insight;
  - primary KPI/chart;
  - secondary breakdowns;
  - channel or manager comparison.
- Keep chart data sources unchanged.
- Standardize chart cards and legends.
- Avoid overusing violet/blue AI accents in normal charts.

Acceptance:

- Existing analytics still load.
- Charts remain readable in ru/en/kk.
- Mobile stacks charts cleanly.
- Empty/no-data states are explicit.

### Phase 8 - Integrations

Goal: convert integrations into a simple setup catalog.

Tasks:

- Group integrations by user meaning:
  - messaging;
  - sales/marketplaces;
  - finance;
  - imports/exports;
  - automation or advanced if needed.
- Use consistent `IntegrationCard`.
- Show connection status clearly.
- Keep connector setup actions and routes unchanged.
- Move technical setup details into existing detail/modals/drawers.

Acceptance:

- Existing integrations still connect/configure through current logic.
- Technical provider details are not primary UI.
- One-person company sees obvious first steps.
- Larger team can still reach advanced setup.

### Phase 9 - Settings

Goal: make settings predictable and safe.

Tasks:

- Group settings by business profile, team/roles, AI, notifications and security.
- Keep dangerous actions visually separated.
- Hide advanced settings behind disclosure.
- Keep role visibility and permission checks unchanged.
- Remove unnecessary technical text.

Acceptance:

- Current settings behavior remains unchanged.
- Permissions are preserved.
- Security actions are clear and visually distinct.
- Settings do not become a dumping ground for every feature.

### Phase 10 - AI Agents Page

Goal: align AI Agents with the setup catalog/settings pattern while keeping it simple-first.

Tasks:

- Keep AI Agents link in sidebar.
- Use same shell, header, cards, badges and empty states as other pages.
- Show agent status, purpose and primary action clearly.
- Hide advanced configuration until needed.
- Remove technical/debug text from visible production UI.
- Ensure all strings are localized in `ru`, `en`, `kk`.

Acceptance:

- Existing AI Agents behavior remains intact.
- Page is understandable for non-technical owners.
- Advanced controls do not dominate initial view.
- Sidebar route remains available.

### Phase 11 - Cross-Page Polish And Regression

Goal: ensure the redesign feels like one product.

Tasks:

- Remove leftover one-off button/card/filter styles.
- Check all sidebar routes visually.
- Check responsive behavior.
- Check i18n in `ru`, `en`, `kk`.
- Check empty/loading/error/no-access states.
- Confirm no business logic, route, role or API changes slipped in.

Acceptance:

- All core routes pass visual review.
- Automated checks are green.
- No page looks like it belongs to the old style.
- No route is less usable than before.

## QA Strategy

Every production implementation step must run the relevant checks.

Minimum checks:

```bash
cd frontend
npm run check:i18n
npx tsc -b --pretty false
npm run build
```

For pages with route or layout changes:

- run existing Playwright smoke tests;
- add/update smoke coverage when labels or core flows change;
- capture desktop screenshot;
- capture mobile screenshot;
- manually verify no overlap, clipping or hidden primary actions.

For role-sensitive pages:

- verify owner/admin view;
- verify restricted role view if applicable;
- verify no-permission state.

For i18n:

- no new visible hardcoded Russian/English/Kazakh text;
- all new keys present in `ru`, `en`, `kk`;
- text must fit buttons/cards in all three locales.

## Implementation Order

Recommended order:

1. Baseline audit.
2. Tokens and shared components.
3. Sidebar/header.
4. Dashboard pilot.
5. Leads/deals.
6. Inbox.
7. Clients.
8. Analytics.
9. Integrations.
10. Settings.
11. AI Agents.
12. Final visual and regression pass.

Reasoning:

- Dashboard proves the visual language first.
- Shared components prevent each page from becoming a custom redesign.
- Daily work pages come before setup pages.
- AI Agents is kept in sidebar but redesigned after the shared setup/catalog patterns exist.

## Production Definition Of Done

A task from this plan is done only when:

- UI is implemented through current components or approved shared components.
- Current API calls are unchanged.
- Current routes are unchanged.
- Current roles and permission gates are unchanged.
- Existing business blocks are still present.
- Empty/loading/error/no-access states are handled.
- All visible strings are localized in `ru`, `en`, `kk`.
- Desktop and mobile layouts were checked.
- `npm run check:i18n` passes.
- TypeScript passes.
- Build passes.
- Relevant smoke tests pass or test gap is explicitly documented.
- No visible technical/demo text remains.

## Key Risks

### Risk: Copying Stitch HTML Directly

Impact:

- duplicated design system;
- hardcoded strings;
- fake data;
- broken production behavior.

Mitigation:

- use Stitch only as visual reference;
- implement through current React components and data.

### Risk: Overusing AI Gradients

Impact:

- UI becomes noisy;
- AI no longer means priority.

Mitigation:

- reserve AI styling for insights, recommendations and smart-priority states.

### Risk: Recreating Bitrix-Like Complexity

Impact:

- small businesses cannot understand the platform;
- sidebar and settings become overloaded.

Mitigation:

- no new top-level nav items without explicit approval;
- advanced settings behind disclosure;
- default-first workflows.

### Risk: Breaking Role-Specific UI

Impact:

- users see actions they should not see;
- existing permission model becomes unreliable.

Mitigation:

- preserve existing permission checks;
- test owner/admin and restricted roles.

### Risk: i18n Regression

Impact:

- production UI becomes inconsistent across languages.

Mitigation:

- add all keys in `ru`, `en`, `kk`;
- run i18n check after every task.

## Final Recommendation

Proceed with a controlled redesign rollout, not a full visual rewrite.

The correct next implementation step is:

1. Lock baseline screenshots and checks.
2. Align design tokens and shared components.
3. Redesign Dashboard as the pilot page.
4. Only after pilot approval, propagate the same system to the remaining sidebar pages.

This gives ZANI the strongest parts of the Stitch direction while protecting current production behavior.
