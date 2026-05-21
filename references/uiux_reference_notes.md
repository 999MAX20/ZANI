# Zani UI/UX Reference Pack 01

Дата: 14.05.2026

Назначение: первый reference pack для будущего UI/UX polish. Эти материалы нужны как ориентир по паттернам, а не как источник для копирования чужого дизайна один-в-один.

## Sources

### SaaSUI

- Vercel Dashboard: https://www.saasui.design/pattern/dashboard/vercel
- Baremetrics Dashboard: https://www.saasui.design/pattern/dashboard/baremetrics
- HubSpot Dashboard: https://www.saasui.design/pattern/dashboard/hubspot
- HubSpot Application: https://www.saasui.design/application/hubspot
- Intercom Application: https://www.saasui.design/application/intercom
- Intercom Email/Inbox Pattern: https://www.saasui.design/pattern/email/intercom
- Calendly Calendar: https://www.saasui.design/pattern/calendar/calendly
- Reclaim Dashboard: https://www.saasui.design/pattern/dashboard/reclaim
- SaaS UI Trends 2026: https://www.saasui.design/blog/7-saas-ui-design-trends-2026

### Dribbble

- CRM Dashboard Clean Scalable SaaS Dashboard UI: https://dribbble.com/shots/27063083-CRM-Dashboard-Clean-Scalable-SaaS-Dashboard-UI
- Velo Business Automation CRM Dashboard: https://dribbble.com/shots/27100188-Velo-Business-Automation-CRM-Dashboard-SaaS-UX-UI-Design
- AI CRM Dashboard UI Design: https://dribbble.com/shots/27109250-AI-CRM-Dashboard-UI-Design-SaaS-Analytics-Interface
- CRM Dashboard Components SaaS UI System: https://dribbble.com/shots/27086155-CRM-Dashboard-Components-SaaS-UI-System
- Ryven CRM Client Management Dashboard UI: https://dribbble.com/shots/26893713-Ryven-CRM-Client-Management-Dashboard-UI

## Local Screenshots

```text
references/uiux/dashboard/
references/uiux/crm-card/
references/uiux/inbox/
references/uiux/kanban/
references/uiux/calendar/
```

Manifest:

```text
references/uiux/capture_manifest.json
```

## What To Learn For Zani

### 1. Dashboard

Relevant screenshots:

- `dashboard/saasui_vercel_dashboard.png`
- `dashboard/saasui_baremetrics_dashboard.png`
- `dashboard/saasui_hubspot_dashboard.png`
- `dashboard/dribbble_crm_dashboard_clean_scalable.png`
- `dashboard/dribbble_ai_crm_dashboard.png`
- `dashboard/dribbble_crm_components_system.png`

Patterns to adapt:

- Dashboard should be a cockpit, not a report page.
- First screen should show 5-7 meaningful cards max.
- Use “what needs attention” as the primary business action block.
- Charts should be secondary and sparse.
- Every metric should have a natural next action or drill-down.
- Keep visual hierarchy calm: heading, KPI row, action block, recent entities.

Avoid:

- decorative charts without action;
- too many gradients;
- dark dashboard as the only theme;
- KPI overload;
- AI cards that do not help the manager do something.

Zani application:

- Dashboard should answer: “what happened, what is risky, what should I do now?”
- Keep cards compact and scannable for SMB owners.
- Use source breakdowns and overdue tasks as action lists, not BI widgets.

### 2. CRM Card / Client Profile

Relevant screenshots:

- `crm-card/saasui_hubspot_application.png`
- `crm-card/dribbble_ryven_crm_client_dashboard.png`

Patterns to adapt:

- Entity card should feel like the main workspace.
- Header must show identity, status, ownership and primary actions.
- Tabs should be few and task-oriented:
  - Overview;
  - Timeline;
  - Tasks;
  - Messages;
  - Notes.
- Context should be visible without opening many pages.
- Related objects should be previewed, not dumped as huge tables.

Avoid:

- 10+ tabs;
- every field visible by default;
- full-page navigation for every small action;
- cramped panels inside panels.

Zani application:

- Current `CrmEntityDrawer` direction is correct.
- Future improvements should focus on better information density, quick actions, and cleaner mobile drawer.
- Custom fields should not overpower core identity/status/actions.

### 3. Inbox / Conversations

Relevant screenshots:

- `inbox/saasui_intercom_application.png`
- `inbox/saasui_intercom_email.png`

Patterns to adapt:

- Inbox should be triage-first:
  - who wrote;
  - what channel;
  - urgency;
  - assigned manager;
  - latest message;
  - next action.
- Composer should be obvious and fast.
- AI suggestions should appear as drafts, not separate AI theatre.
- Context panel should show linked CRM entities and actions.
- Message status should be visible when queued/failed.

Avoid:

- separating CRM context from conversation;
- AI response in a disconnected popup;
- too many actions at the top level;
- technical labels like raw ids as primary text.

Zani application:

- Current B1/B5 work is aligned: URL-selected conversation, handoff filter, AI draft insertion.
- Next step B4 should make create/link client/lead/deal feel natural, not technical.

### 4. Calendar / Scheduling

Relevant screenshots:

- `calendar/saasui_calendly_calendar.png`
- `calendar/saasui_reclaim_dashboard.png`

Patterns to adapt:

- Calendar should be calm and touch-friendly.
- Date navigation must be visually obvious.
- Day/week views should prioritize availability and appointments.
- Appointment cards should show:
  - time;
  - client;
  - service;
  - resource;
  - status.
- Creating booking should be one primary CTA.

Avoid:

- dense enterprise calendar grids too early;
- tiny date controls on mobile;
- unclear status colors;
- modal forms with too many fields at once.

Zani application:

- Calendar needs future polish after scheduling logic matures.
- The day view can stay simple, but date picker and mobile appointment cards must become stronger.

### 5. Kanban / Pipeline

Relevant screenshots:

- `kanban/dribbble_velo_crm_dashboard.png`
- `dashboard/saasui_hubspot_dashboard.png`

Patterns to adapt:

- Kanban cards should show only essentials:
  - deal/client name;
  - amount or service;
  - next action;
  - SLA/overdue;
  - owner.
- Stage headers should show count and total value.
- Drag/drop feedback should be clear.
- Empty columns should teach what belongs there.

Avoid:

- card overload;
- too many inline buttons;
- hiding loss/win reasons;
- letting lost stage happen without reason.

Zani application:

- Current A5 direction is correct.
- Future C1/C1.2 permissions/accountability should protect pipeline from hiding mistakes.

### 6. Mobile

Patterns to adapt:

- Bottom navigation for daily actions.
- Drawer becomes near-fullscreen.
- Tables become cards.
- Filters collapse into compact chips/sheets.
- Primary action stays thumb-accessible.

Avoid:

- desktop table squeezed into phone;
- tiny icon-only controls without clear labels;
- fixed headers that consume too much vertical space.

Zani application:

- Do not wait until D7 for mobile thinking.
- Every frontend prompt should keep mobile smoke in scope.

## Design Direction For Zani

Use references as pattern input, but keep Zani distinct:

- calm SaaS, not flashy dashboard;
- action-oriented CRM, not analytics theatre;
- AI as workflow helper, not separate feature island;
- strong permissions/audit hidden behind simple role UX;
- mobile-first enough for SMB daily usage;
- fewer screens, more drawers and contextual actions.

## Immediate Use In Upcoming Prompts

### B4 Conversation to CRM Linking

Use Intercom/HubSpot patterns:

- context panel with linked entities;
- clear “Create client / Create lead / Create deal” actions;
- duplicate warning before creating;
- no raw technical workflow.

### C1 RBAC/ABAC

Use SaaSUI 2026 trend notes:

- role-based adaptive interfaces;
- hide irrelevant sections;
- simple presets first;
- advanced only behind progressive disclosure.

### D7 Mobile Polish

Use Calendly/Reclaim references:

- calm date navigation;
- large touch targets;
- compact appointment cards;
- no horizontal scroll.

