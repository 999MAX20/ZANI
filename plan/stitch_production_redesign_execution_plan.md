# ZANI Stitch Production Redesign Execution Plan

Date: 2026-06-01

Status: ready for implementation

Scope: production-safe frontend redesign using Stitch references from `references/stitch_references/stitch_zani_ai_business_control_dashboard`.

## Purpose

Bring ZANI frontend to a production-level CRM UI/UX using Stitch references as the visual contract, while preserving all current business logic.

This plan is not a cosmetic pass. The target is to make ZANI pages structurally match the Stitch reference architecture: shell, spacing, bento grids, cards, AI insight blocks, work queues, tables, settings and integration catalogs.

## Non-Negotiable Constraints

These rules apply to every implementation task:

- Do not change API contracts.
- Do not change backend payload shape.
- Do not change routes.
- Do not change role definitions.
- Do not change permission gates.
- Do not change query keys unless a test explicitly requires it and the user approves.
- Do not change mutation payloads.
- Do not remove current business blocks.
- Do not copy Stitch static HTML directly.
- Do not introduce hardcoded visible text.
- Do not introduce a second design system.
- All visible strings must be localized in `ru`, `en`, `kk`.
- Every page migration must be production-ready before moving to the next page.

## Key Principle

Pages keep their existing data and behavior. New redesign components are presentational.

The page component remains responsible for:

- queries;
- mutations;
- permissions;
- routing;
- role visibility;
- data mapping;
- event handlers.

The new UI components receive already prepared props and render them according to the Stitch visual contract.

## Stitch Visual Contract

Use these local references as the source of truth:

- `_1/screen.png` - Dashboard / owner control panel.
- `_2/screen.png` - Conversations / AI-assisted inbox.
- `_3/screen.png` - Leads work queue.
- `_4/screen.png` - Analytics.
- `_5/screen.png` - Integrations.
- `_6/screen.png` - Settings.
- `crm/screen.png` - Clients and retention.
- `zani_business_intelligence/DESIGN.md` - colors, spacing, typography, surface rules.

## Target Product Feel

ZANI should feel like:

- a calm SMB business cockpit;
- a CRM that shows the next action clearly;
- an AI-native prioritization layer;
- a production tool for one employee and for teams up to 100 people;
- a clean alternative to overloaded CRM systems.

ZANI should not feel like:

- Bitrix24;
- a technical admin panel;
- a demo landing page;
- a set of unrelated screens;
- a product where every feature gets a new primary menu item.

## Current Main Gap

The current first redesign pass improved the visual tokens but did not fully match Stitch.

Main differences:

- current sidebar is icon-first and floating; Stitch sidebar is fixed, wide and text-first;
- current header is floating/glass; Stitch header is flat, sticky and operational;
- current Dashboard still uses the old information architecture;
- Stitch Dashboard uses a bento structure:
  - greeting;
  - large AI smart intelligence card;
  - integration status card;
  - KPI row;
  - urgent actions;
  - unanswered chats;
- current KPI content differs from Stitch;
- current bottom panels do not match the Stitch screen architecture.

This plan corrects that by migrating shell first, then shared components, then pages.

## Implementation Strategy

Use a controlled migration:

1. Lock the current behavior.
2. Build the Stitch-compatible shell.
3. Build shared presentational components.
4. Rewrite Dashboard 1:1 by structure.
5. Rewrite each sidebar page one at a time.
6. Run production checks after every page.

## Phase 0 - Baseline And Safety Lock

Goal: preserve current behavior before visual migration.

Tasks:

- Capture current desktop and mobile screenshots for:
  - Dashboard;
  - Leads;
  - Deals;
  - Clients;
  - Conversations;
  - Analytics;
  - Integrations;
  - AI Agents;
  - Settings.
- List route components for every sidebar item.
- Confirm sidebar includes AI Agents.
- Confirm current role/permission gates per page.
- Confirm current i18n parity.
- Confirm current TypeScript/build state.

Acceptance:

- A baseline screenshot set exists or is documented.
- `npm run check:i18n` passes.
- `npx tsc -b --pretty false` passes.
- `npm run build` passes.
- No redesign starts from a broken state.

## Phase 1 - Stitch Shell Migration

Goal: make every app page sit inside the Stitch shell without changing page logic.

Target shell:

- desktop sidebar width: `260px`;
- sidebar is fixed and full height;
- sidebar background: `#F2F4F7`;
- sidebar active state: left border `4px`, muted background, navy text;
- sidebar inactive state: muted icon/text, hover background only;
- sidebar footer shows current user/business role;
- header height: `64px`;
- header is flat/sticky, not floating glass;
- header left side: page context / owner mode / status;
- header right side: pill search, notifications, profile;
- page canvas background: `#f8f9fb`;
- content max width: `1400px`;
- desktop padding: `24px`;
- mobile padding: `16px`;
- card gap: `20px`.

Tasks:

- Refactor `AppLayout` to use a fixed `260px` desktop sidebar.
- Refactor `Sidebar` visual style to match Stitch.
- Preserve current visible route list and permission filtering.
- Keep AI Agents visible in sidebar.
- Refactor `Header` style to flat operational bar.
- Keep existing search, notifications, language and logout behavior.
- Ensure mobile still uses bottom nav and drawer.
- Remove decorative shell effects that make CRM screens look like marketing UI.

Files likely touched:

- `frontend/src/components/layout/AppLayout.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/components/layout/MobileNav.tsx`
- `frontend/src/styles.css`
- `frontend/tailwind.config.ts`

Acceptance:

- All existing sidebar links still point to the same routes.
- All permission checks remain in place.
- AI Agents link remains visible when user has permission.
- Desktop shell visually matches Stitch shell.
- Mobile navigation remains complete.
- No route becomes unreachable.

## Phase 2 - Stitch Component Layer

Goal: create production-ready presentational components that can reproduce Stitch pages without touching business logic.

Create or standardize:

- `StitchPageCanvas`
- `StitchPageHeader`
- `StitchCard`
- `StitchAiCard`
- `StitchKpiCard`
- `StitchIntegrationStatusCard`
- `StitchActionList`
- `StitchChatPreviewCard`
- `StitchLeadCard`
- `StitchClientTable`
- `StitchFilterBar`
- `StitchStatusBadge`
- `StitchSectionHeader`
- `StitchSettingsSection`
- `StitchEmptyState`
- `StitchLoadingState`
- `StitchErrorState`
- `StitchNoAccessState`

Component rules:

- Components must be presentational.
- Components must not fetch data.
- Components must not call APIs.
- Components must not know roles.
- Components must not hardcode visible strings.
- Components receive translated labels via props or use existing i18n keys only when scoped and approved.
- Components must support mobile.

Acceptance:

- Components are reusable across pages.
- Components use shared tokens.
- Components do not introduce new business behavior.
- All interactive elements expose accessible labels.
- Components support empty/loading/error/no-access states where relevant.

## Phase 3 - Dashboard Full Stitch Rewrite

Goal: make Dashboard match `_1/screen.png` by structure and visual hierarchy.

Target structure:

1. Greeting block:
   - title like "Доброе утро, {name/business}.";
   - subtitle like "Вот состояние вашего бизнеса.";

2. Bento top section:
   - large AI Smart Intelligence card, `lg:col-span-2`;
   - right integration status card.

3. KPI row:
   - Revenue;
   - Leads;
   - Sales;
   - Clients.

4. Lower grid:
   - urgent actions card;
   - unanswered chats card.

5. Optional follow-up sections below fold:
   - latest leads;
   - upcoming bookings;
   - setup recommendations.

Current business data mapping:

- Revenue: use existing revenue data or revenue missing state.
- Leads: use existing lead counts.
- Sales: use existing completed/sales proxy data where available.
- Clients: use existing clients length.
- Urgent actions:
  - unassigned leads;
  - no-answer leads/chats;
  - stale deals proxy;
  - overdue tasks.
- Unanswered chats:
  - use existing conversations/inbox data if already available;
  - if not available in Dashboard props, show safe link-based summary without new API calls in first pass.
- Integrations:
  - use existing setup sources and connection readiness.

Tasks:

- Replace current Dashboard layout with Stitch bento layout.
- Remove period selector from first viewport.
- Remove filter button from first viewport.
- Keep all existing links/actions.
- Add proper KPI cards with trend badges and small sparkline placeholders.
- Add large AI card with two actions.
- Add integration status card.
- Add urgent action rows with colored left accents.
- Add unanswered chats card or safe summary.
- Preserve existing loading/error states.
- Preserve current data fallback behavior.

Files likely touched:

- `frontend/src/features/dashboard/OwnerDashboard.tsx`
- `frontend/src/features/dashboard/DashboardPage.tsx` if data needs to be passed through
- shared Stitch components
- `frontend/src/lib/i18n.tsx`

Acceptance:

- Desktop Dashboard structure matches `_1/screen.png`.
- Mobile Dashboard preserves same hierarchy in one column.
- No existing Dashboard data source is removed.
- No current route/action is broken.
- No hardcoded visible strings.
- `ru/en/kk` parity passes.

## Phase 4 - Leads Page Stitch Rewrite

Reference: `_3/screen.png`.

Target structure:

- page title and subtitle;
- primary action "Create lead";
- AI priority banner;
- filter/view control row;
- compact status counter;
- lead cards grid;
- empty/loading states.

Tasks:

- Preserve current lead queries/mutations.
- Preserve create/edit/status/assignment actions.
- Recompose the page into Stitch work-queue layout.
- Use shared `StitchLeadCard`.
- Use compact filters and view toggles.
- Move advanced actions behind contextual controls.

Acceptance:

- Leads page visually matches `_3/screen.png` structure.
- All existing lead actions still work.
- Assignment/status permissions remain intact.
- Mobile card layout is usable.

## Phase 5 - Deals Page Alignment

Reference: use Leads pattern plus CRM deal semantics.

Target structure:

- work queue / pipeline-first layout;
- simple filters;
- stuck deal signals;
- deal cards/table with clear next action.

Tasks:

- Preserve current deals queries/mutations.
- Use same work queue components as Leads.
- Keep deal stage changes and permissions.
- Add AI/stuck deal banner only from existing data.

Acceptance:

- Deals visually align with Stitch Leads/Dashboard patterns.
- Current deal behavior is unchanged.

## Phase 6 - Conversations Stitch Rewrite

Reference: `_2/screen.png`.

Target structure:

- split-pane layout:
  - left conversation list;
  - right active conversation;
- compact channel filter chips;
- conversation header with customer status;
- message area;
- AI reply suggestion card;
- bottom composer.

Tasks:

- Preserve inbox API and send/resolve/transfer handlers.
- Preserve unread counts.
- Preserve channel filters.
- Rebuild layout around split-pane Stitch structure.
- Add mobile conversation list/detail behavior.
- Use AI suggestion as assistive block, not auto-send.

Acceptance:

- Conversations visually match `_2/screen.png`.
- Existing send/resolve/transfer behavior works.
- Mobile does not squeeze split pane.
- No permissions regress.

## Phase 7 - Clients / CRM Stitch Rewrite

Reference: `crm/screen.png`.

Target structure:

- AI retention banner;
- search/filter/action row;
- desktop client table;
- mobile client cards;
- bottom KPI cards.

Tasks:

- Preserve client queries/mutations.
- Preserve create/edit/archive/tag/segment actions.
- Convert layout to retention-oriented table.
- Use semantic row highlighting for inactive/risk clients.
- Keep detail drawer behavior.

Acceptance:

- Clients page visually matches `crm/screen.png`.
- Current client actions still work.
- Mobile layout is readable.
- Table columns remain business-focused, not technical.

## Phase 8 - Analytics Stitch Rewrite

Reference: `_4/screen.png`.

Target structure:

- AI report banner;
- primary revenue/trend chart card;
- lead structure/donut card;
- manager conversion card;
- top channels card.

Tasks:

- Preserve analytics data source.
- Standardize chart cards and legends.
- Do not overuse AI gradient in normal charts.
- Keep no-data/error states.

Acceptance:

- Analytics visually matches `_4/screen.png`.
- Charts remain readable and responsive.
- Existing analytics behavior remains unchanged.

## Phase 9 - Integrations Stitch Rewrite

Reference: `_5/screen.png`.

Target structure:

- page title and description;
- simple filter/search;
- category sections:
  - messengers;
  - marketplace;
  - finance;
  - import/export;
- integration cards with status and primary action.

Adjustment:

The large empty gradient banner in Stitch should be reduced or converted into a meaningful AI/setup recommendation. Empty decorative blocks are not production UI.

Tasks:

- Preserve provider catalog and connector setup flows.
- Preserve setup modals/drawers/routes.
- Use consistent cards for all providers.
- Hide technical setup details until connector detail is opened.

Acceptance:

- Integrations page visually follows `_5/screen.png`.
- Existing connector actions still work.
- No technical provider internals dominate first view.

## Phase 10 - Settings Stitch Rewrite

Reference: `_6/screen.png`.

Target structure:

- business profile card;
- AI copilot card;
- employees and roles table;
- notifications card;
- security card.

Tasks:

- Preserve settings forms and mutations.
- Preserve role/team permissions.
- Keep advanced sections behind disclosure.
- Visually separate dangerous security actions.
- Remove production-visible technical noise.

Acceptance:

- Settings visually follows `_6/screen.png`.
- Existing forms still submit same payloads.
- Permission gates remain intact.
- Advanced controls do not dominate first view.

## Phase 11 - AI Agents Page Alignment

Reference: use Integrations/Settings setup catalog pattern.

Target structure:

- AI Agents stays in sidebar.
- Page presents agents as business-purpose cards.
- Status, scope, owner and primary action are clear.
- Advanced configuration is hidden until opened.

Tasks:

- Preserve existing AI Agents route.
- Preserve existing AI Agents data/actions.
- Use setup catalog cards.
- Hide technical/debug copy.
- Ensure i18n ru/en/kk.

Acceptance:

- AI Agents is visually aligned with the rest of redesigned ZANI.
- Sidebar link remains available.
- Current logic is not changed.

## Phase 12 - Cross-Page Visual QA

Goal: make redesigned pages feel like one product.

Tasks:

- Visit every sidebar route on desktop.
- Visit every sidebar route on mobile.
- Compare each redesigned page against its Stitch reference.
- Check no overlapping text.
- Check no clipped buttons.
- Check empty/loading/error/no-access states.
- Check all role-dependent surfaces.
- Check language switch ru/en/kk.

Acceptance:

- All sidebar pages share one shell.
- Buttons/cards/inputs/badges are consistent.
- AI styling is reserved for AI/smart-priority blocks.
- No page looks like old ZANI style.
- No page exposes unnecessary technical text.

## QA Commands

Run after every page migration:

```bash
cd frontend
npm run check:i18n
npx tsc -b --pretty false
npm run build
```

Run visual/browser checks:

- desktop screenshot;
- mobile screenshot;
- sidebar route navigation;
- primary action smoke;
- no-permission state if page is role-protected.

Run existing Playwright smoke tests when route labels, navigation or core page structure changes.

## Page Migration Checklist

Before editing a page:

- Read current page component.
- Identify queries.
- Identify mutations.
- Identify permission checks.
- Identify route links.
- Identify current empty/loading/error states.
- Identify i18n keys used.

During editing:

- Move layout to Stitch components.
- Keep queries and mutations untouched.
- Keep handlers untouched.
- Keep permissions untouched.
- Keep routes untouched.
- Pass data into presentational components.
- Add missing i18n keys in `ru/en/kk`.

After editing:

- Run i18n check.
- Run TypeScript.
- Run build.
- Check desktop screenshot.
- Check mobile screenshot.
- Confirm no visible hardcoded strings.
- Confirm no business block disappeared.

## Definition Of Done

A redesigned page is done only when:

- it matches the corresponding Stitch reference by structure;
- all previous business logic remains available;
- all routes are unchanged;
- all API calls are unchanged;
- all permission gates are unchanged;
- all current user actions remain reachable;
- empty/loading/error/no-access states are implemented;
- visible text is localized in `ru/en/kk`;
- desktop and mobile views are verified;
- i18n check passes;
- TypeScript passes;
- production build passes;
- any remaining visual difference is documented and intentional.

## Risk Register

### Risk: Visual 1:1 Breaks Existing Logic

Mitigation:

- Use presentational components only.
- Keep page-level data/control logic unchanged.
- Avoid rewriting hooks and handlers.

### Risk: Stitch Static Demo Data Replaces Real Data

Mitigation:

- Never use Stitch numbers as production values.
- Map existing real data into Stitch layouts.
- Use fallback states when data is missing.

### Risk: Sidebar Permission Regression

Mitigation:

- Preserve existing permission filtering.
- Do not manually duplicate route visibility logic in new components.

### Risk: i18n Regression

Mitigation:

- No hardcoded visible text.
- Add every new key in all dictionaries.
- Run `npm run check:i18n`.

### Risk: Mobile Regression

Mitigation:

- Every page must have a mobile layout.
- Split panes become list/detail flows.
- Tables become cards or horizontally safe layouts.

### Risk: Overloaded Bitrix-Like Interface

Mitigation:

- No new primary sidebar items by default.
- Advanced settings behind disclosure.
- One primary action per page.
- Technical details inside setup/details panels.

## Recommended Start

Start with:

1. Phase 1: Stitch Shell Migration.
2. Phase 2: Stitch Component Layer.
3. Phase 3: Dashboard Full Stitch Rewrite.

Do not continue page-by-page work until Dashboard proves the visual system works with real ZANI data.

## Implementation Note

The goal is "1:1 by screen architecture", not byte-identical CSS.

Allowed differences:

- real ZANI data instead of Stitch demo data;
- current routes instead of `#`;
- current icon library if consistent;
- AI Agents remains in sidebar;
- production-safe copy instead of demo/technical text;
- safer mobile layout when Stitch static screen is desktop-only.

Not allowed:

- keeping old page architecture when Stitch reference provides a clear structure;
- leaving old floating/collapsed desktop shell as the primary CRM shell;
- using decorative gradients outside AI/smart blocks;
- shipping untranslated strings;
- removing current actions to make the screen easier to copy.
