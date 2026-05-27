# ZANI Production Readiness Plan

Last updated: 2026-05-27

## Purpose

This document tracks what is already implemented across the merchant CRM product and what must be completed before a production launch. It is intentionally practical: each page is evaluated by business workflow readiness, not by visual completeness alone.

## Readiness Scale

- `MVP Ready`: usable for a controlled pilot with known limits.
- `Needs Work`: important flows exist, but production gaps remain.
- `Not Ready`: page is mostly prototype, placeholder, or lacks core business logic.

## Current Product Direction

ZANI is being refocused around six core loops:

1. Lead or bot conversation enters CRM.
2. Manager/operator responds, qualifies, and assigns ownership.
3. Lead becomes client and deal.
4. Deal moves through pipeline with a required next action.
5. Integrations emit business events: messages, orders, payments, stock, sync errors.
6. AI Analyst summarizes risks and proposes confirmable actions.

Primary navigation after reform:

- Dashboard
- Leads
- Deals
- Conversations / Inbox
- Integrations
- AI Assistant

Secondary surfaces:

- Clients
- Tasks
- Analytics
- Automations
- Calendar / Appointments
- Settings
- Services / Resources / Working hours
- Bots / AI Agents
- Platform operations

Detailed implementation plan for dynamic CRM workflows:

```text
business_logic_implementation_plan.md
```

## Overall Reform Analysis - 2026-05-27

The reform moved the product away from a visually busy prototype and toward an operational CRM. The main improvement is not cosmetic: the primary pages now follow clearer business loops and give the user direct actions where decisions happen.

### What Improved

Implemented:

- Navigation now reflects the core product loops instead of exposing every route as equally important.
- Dashboard is closer to an owner cockpit: fewer decorative blocks, more attention to active business states.
- Leads became a qualification queue with a selected lead work panel, fast actions, conversion actions, and less visual noise.
- Conversations became a unified inbox with simple queue controls, AI-agent filtering, bulk actions, CRM actions, manual reply, and AI draft insertion.
- Integrations became a status center with provider cards, sync/event visibility, connector groups, import entry point, and integration logos.
- Forms and modals now use a shared product style instead of detached native-looking form blocks.
- Visible native browser selects were replaced on the reformed pages with the shared custom `Select` component.
- A calmer color system was introduced:
  - neutral white/slate base for business work;
  - blue for CRM selection and primary workflow accents;
  - violet for AI-only actions;
  - midnight for critical CTAs.
- `docs/design-system.md` now documents the baseline UI rules so future pages do not drift back into inconsistent styling.

### What Is Still Weak

Remaining weaknesses:

- The dynamic business workflow is not complete yet. The system can receive messages, create conversations, and now run an AI-qualified manual inbox pipeline that guarantees `conversation -> client -> lead -> deal -> next task` when qualification says a commercial CRM flow is appropriate. It still does not run the full automatic chain: channel message -> bot qualification -> client/lead creation -> service/time extraction -> appointment booking -> calendar visit state.
- Several pages still exist as functional surfaces, but not yet as strong business tools: tasks, calendar, analytics, automations, settings, bots/AI agents, AI assistant.
- Production business logic is incomplete in several core flows:
  - assignment to a specific teammate;
  - required next action;
  - SLA/no-response timers;
  - duplicate detection and merge;
  - deal stale rules;
  - real connector setup and diagnostics;
  - grounded AI analyst actions.
- Many UI flows still need E2E coverage before they can be trusted in production.
- Permissions, tenant isolation, audit logs, and credential handling need a full security pass.
- High-volume behavior is not production-ready yet: pagination, infinite scroll, query optimization, and realtime updates are still needed for inbox/leads/integrations.

### Current Product Readiness Summary

- `MVP Ready`: Leads, Deals, Clients, Conversations / Unified Inbox, Integrations.
- `Needs Work`: Dashboard, AI Assistant, Tasks, Calendar/Appointments, Analytics, Automations, Bots/AI Agents, Settings, public/auth pages.
- `Not Ready`: Platform operations, unless explicitly removed from first production scope.

### Production Definition

Before calling ZANI production-ready, the product must satisfy these minimum conditions:

- An inbound message from a connected channel can be processed as a full business event: conversation is created, client is identified or created, lead is created/updated, intent/service/time is extracted, appointment is booked when confidence and availability allow, and every automated decision is logged.
- A manager can process a new lead from source to client/deal/appointment without leaving the main workflow.
- An operator can process inbox conversations, use AI drafts, hand off, and run a one-click CRM pipeline that AI-qualifies intent/confidence/next action before creating or reusing client, lead, deal, and next task. Message delivery/error UX still needs production hardening.
- An owner can inspect leads, deals, conversations, integration health, and AI analyst risks from reliable data.
- Connectors have credential setup, health checks, retry/reconnect flows, audit logs, and clear error states.
- AI outputs are grounded in source records, logged, and converted into confirmable actions rather than silent mutations.
- Role permissions and tenant isolation are tested for every critical API and page.
- Core flows have E2E tests and backend integration tests.
- The UI system is consistent across forms, filters, cards, modals, colors, empty states, and action hierarchy.

### Priority Roadmap

Priority 1 - close the core CRM loop:

- Build the automatic inbound business workflow: channel webhook -> conversation -> AI qualification -> client/lead -> appointment proposal/booking -> calendar event -> audit log.
- Extend the new manual inbox pipeline into webhook-driven auto mode with confidence thresholds, duplicate policy, and manager approval for risky actions.
- Finish Leads production gaps: teammate assignment, duplicate/merge, next action, SLA/no-response, bulk actions, E2E tests.
- Finish Conversations production gaps: teammate assignment, attachments, real error states, CRM side drawer, realtime updates, E2E tests.
- Finish Deals production gaps: enforce required next action, add stale deal rules, replace prompt-based task creation with a structured modal, and add conversion tests from lead.

Priority 2 - make the product trustworthy:

- Add role/permission gates across core routes and APIs.
- Add tenant isolation tests.
- Add audit logs for sensitive actions.
- Add production-grade empty/error/loading states.
- Add observability for backend errors, integration failures, AI failures, and frontend crashes.

Priority 3 - make integrations real:

- Implement connector setup flows for priority providers.
- Add webhook verification, retry, pause/reconnect, credential rotation, and event reconciliation.
- Add connector-specific mapping for chat channels, stock, 1C, Kaspi, and spreadsheet imports.

Priority 4 - turn AI into a business analyst:

- Reframe `/dashboard/ai-assistant` from generic chat into grounded AI Analyst.
- Require source citations for insights.
- Add confirmable actions and action audit trail.
- Add model/prompt/context logging and guardrails.

Priority 5 - unify the remaining surfaces:

- Finish Clients production gaps: duplicate/merge in-profile, consent/source fields, privacy permissions, and structured quick-create actions for related entities.
- Reform Tasks into a follow-up command center.
- Reform Calendar/Appointments around booking reliability.
- Reform Analytics around a small set of production metrics.
- Clean Settings into business, team, roles, billing, security, notifications, integrations/developer sections.

## Reform Work Already Completed

### Navigation

Implemented:

- Sidebar was simplified to primary CRM loops.
- Mobile navigation was reduced to the most important work surfaces.
- Secondary pages remain reachable, but no longer dominate the main navigation.

Production gaps:

- Validate permission-based visibility for every role.
- Validate navigation on mobile with real business data.
- Add product analytics for page usage and abandoned flows.

### Dashboard

Implemented:

- Owner dashboard was simplified from an overloaded overview into a more focused operational cockpit.
- Kept attention items, AI brief, latest leads, upcoming bookings, and core operational metrics.
- Removed noisy empty/team KPI layers and unnecessary blocks.

Production gaps:

- Replace proxy/stub deltas with real analytics.
- Add role-specific dashboard variants for owner, manager, operator, accountant, marketer.
- Add configurable date ranges where useful, without turning dashboard into analytics.
- Add error/empty states for each data source.
- Add tests around dashboard API shape and permission scope.

### Leads

Implemented:

- Leads page was refactored from a mixed hero/list/kanban surface into a focused qualification queue.
- The page now uses a two-pane work layout:
  - left queue with search, source filter, and operational tabs;
  - right detail panel for the selected lead.
- The selected lead panel shows client request, current status, source, service, responsible manager, next action, and control metadata.
- Primary actions are now directly attached to the selected lead:
  - call;
  - WhatsApp;
  - assign to self;
  - mark contacted;
  - take into work;
  - create deal;
  - create appointment;
  - close successfully;
  - mark lost;
  - reopen;
  - open full client/lead drawer.
- Old visual noise was removed: command hero, AI hint panels, list/kanban toggle, drag/drop board, decorative lead cards.
- Build and browser smoke checks passed.

Production gaps:

- Add specific teammate assignment, not only assign to self.
- Add bulk actions for lead queues.
- Add duplicate/merge workflow directly in the qualification flow.
- Add required next action/due date before moving active leads forward.
- Add no-response/SLA indicators.
- Add better lost reason UX than browser prompt.
- Add E2E tests for create, qualify, assign, convert, book, close, lost, reopen, duplicate handling.

### Integrations

Implemented:

- Integrations page was refactored into a status center.
- Integration logos from `media/integrations_logos` were copied into `frontend/public/integrations_logos`.
- Current provider groups include messaging, data, marketplace, and system providers.
- Page shows connected count, attention count, business events, sync errors.
- Page supports search/filter by provider group.
- Provider cards were rebuilt into a cleaner channel-card format: logo, provider name, status pill, short business purpose, and a primary `Connect` / `Configure` action.
- Clicking `Connect` / `Configure` now opens a provider setup modal with the required key/token/account fields for the channel class. Telegram uses the real bot-token setup flow inside the modal.
- Provider quick actions such as health check, demo sync, request connector, inbox link, and import scroll are now grouped inside the setup modal instead of crowding the cards.
- Excel/CSV import panel was simplified.
- Business events, integration logs, and sync runs are shown in compact tables.
- Build and browser smoke checks passed.

Production gaps:

- Replace demo sync behavior with production sync flows per connector.
- Replace prototype `BusinessConnector.config_json` secret storage with production credential storage, rotation, masking, and backend-only reads.
- Add real OAuth/API credential setup flows for each supported connector.
- Add connector-specific health diagnostics with actionable error messages.
- Add retry, pause, reconnect, credential rotation, and webhook verification flows.
- Add source-specific event mapping for 1C, MoySklad, Kaspi, Wildberries, Google Sheets, WhatsApp, Instagram, Telegram.
- Add event deduplication UI and conflict resolution for orders/clients/products.
- Add permission gates for credential visibility and connector management.
- Add audit log for credential changes and sync actions.
- Add integration E2E tests for success, expired credential, failed webhook, duplicate event, and partial sync.

### Conversations / Unified Inbox

Implemented:

- Page was refactored from an overloaded CRM panel into a clean unified inbox inspired by the local `Unified Inbox.png` reference and MoonAI's dialogue manager positioning.
- Layout now has:
  - Left inbox column.
  - AI-agent selector.
  - Search by name/phone/message.
  - Simple tabs: `All`, `Errors`, `Paused`.
  - Filter drawer for channel, read state, and assignment.
  - Conversation list.
  - Empty state: select a dialogue.
  - Conversation thread.
  - Composer for manual reply.
  - Compact action bar for AI draft, assign to me, pause/start bot, mark read.
  - Compact CRM actions: create client, create lead, create deal, create task, handoff to operator, close/reopen.
- Backend inbox filtering now supports `bot` query parameter.
- Frontend `InboxFilters` now supports `bot`.
- AI-agent selector uses `botsApi.list`.
- Bulk selection was added for visible conversations.
- Bulk actions were added:
  - Mark read.
  - Assign to me.
  - Pause bot.
  - Handoff to operator.
  - Close.
- Build, Django check, conversations test, and browser smoke checks passed.
- Backend now has a shared `run_conversation_pipeline` service for the core manual flow:
  - calls `conversation_qualification` AI before pipeline execution when enabled;
  - parses structured AI output: intent, confidence, summary, service, preferred time, urgency, action decisions, next action, human-review flag;
  - falls back to deterministic keyword qualification when the AI provider is mock or returns invalid JSON;
  - reuses or creates a client from conversation/channel identity;
  - creates a lead before a deal;
  - creates a deal linked to the lead and client;
  - creates/reuses a next task linked to client, lead, and deal;
  - stores pipeline ids, qualification result, and AI log id in `conversation.metadata_json` for idempotency/audit;
  - writes activity events for created CRM entities.
- Inbox API now exposes `POST /api/inbox/conversations/{id}/run-pipeline/`.
- Conversations UI now has a primary `CRM pipeline` action for one-click promotion from dialogue to CRM work.
- Chat action toolbar was reorganized into production groups:
  - AI actions;
  - dialogue ownership/bot controls;
  - CRM entity actions;
  - operator/close controls;
  - hover tooltips for each mechanical and AI action;
  - inline AI/pipeline insight from conversation metadata.
- Legacy `create-deal` now uses the shared pipeline service, so a deal created from conversation no longer skips lead creation.
- Targeted backend tests cover idempotent pipeline creation and legacy deal creation.
- First auto CRM pipeline slice is implemented:
  - auto runner is disabled by default;
  - settings are read from `Bot.settings_json.auto_crm_pipeline` and `BotChannel.config_json.auto_crm_pipeline`;
  - Telegram, WhatsApp, and Website Chat inbound messages call the guarded runner after message registration;
  - `lead_task` mode can auto-create/reuse client, lead, and task;
  - auto decisions are saved to `conversation.metadata_json.auto_crm_pipeline`;
  - website `lead_task` mode has an idempotency backend test.

Production gaps:

- Add assignment to a specific teammate, not only `assign to me`.
- Add attachments: files, images, voice notes, and previews.
- Add robust error tracking:
  - failed outbound messages;
  - failed AI responses;
  - failed webhook events;
  - integration event errors linked to the conversation.
- Improve `Errors` tab semantics. Current implementation uses `handoff_required`; production should distinguish handoff, failed messages, provider errors, and AI uncertainty.
- Add bulk selection across pagination, not only visible conversations.
- Add pagination/infinite scroll handling for high-volume inboxes.
- Add CRM side drawer for client, lead, deal, tasks, and history without leaving the inbox.
- Add pipeline preview/confirmation before creation when duplicate client candidates, low AI confidence, or missing identity are detected.
- Expand auto CRM pipeline coverage:
  - add duplicate-conflict blocking;
  - add triage/draft-deal guard tests;
  - add settings UI;
  - add review UI for blocked/needs-review decisions.
- Improve AI qualification beyond the first production slice:
  - stricter JSON schema validation;
  - richer duplicate policy;
  - appointment slot extraction and booking proposal;
  - manager approval queue for low-confidence actions;
  - source-message citations in the UI.
- Add appointment proposal/booking step after lead/deal creation when service and time are clear.
- Add SLA timers, first response time, overdue state, and queue ownership.
- Add operator handoff history and reasons.
- Add AI response moderation workflow:
  - approve;
  - edit;
  - reject;
  - log source context used by AI.
- Add WebSocket or server-sent realtime updates. Current flow relies on polling.
- Add role/permission checks for bulk actions and handoff.
- Add E2E tests for:
  - selecting a bot;
  - filtering by channel/read state/assignee;
  - sending a reply;
  - AI draft insertion;
  - creating CRM entities from inbox;
  - bulk actions;
  - closed conversation composer lock.

## Page-by-Page Readiness

### `/dashboard` - Dashboard

Status: `Needs Work`

Implemented:

- Operational owner dashboard exists.
- Dashboard shows attention items and links to leads, conversations, deals, tasks, integrations, calendar, analytics, and AI assistant.
- Manager dashboard exists separately.
- Dashboard was simplified as part of reform.

Before production:

- Remove hardcoded/proxy values from KPI deltas.
- Make dashboard metrics consistent with backend analytics definitions.
- Add role-based dashboard content per business role.
- Add reliable empty states for businesses without data.
- Add loading/error states for each panel.
- Add acceptance tests for owner and manager dashboard variants.

### `/dashboard/leads` - Leads

Status: `MVP Ready`

Implemented:

- Leads page exists.
- Lead form and lead workflows are wired into the CRM.
- Leads can be linked from inbox conversations.
- Dashboard links into leads for unassigned leads and latest leads.
- Page has been refactored into a focused lead qualification queue.
- Selected lead has a work panel with request, next action, fast communication, assignment, deal/appointment conversion, close/lost/reopen, and CRM drawers.
- Selected lead now shows real linked context counts for deals, appointments, and conversations.
- Lead next action can now be created as a real task with title, due date, assignee, and priority.
- Lead responsible user can now be changed from the work panel with the existing team member assignment API.
- Lost flow now uses a project-styled modal with reason category/comment instead of `window.prompt`.
- Build check passed after the production-logic pass.

Before production:

- Confirm final lead statuses, ownership, source, next action, and conversion rules.
- Add duplicate detection and merge workflow inside the work panel.
- Add bulk assignment and status changes for queues.
- Add filters by source/channel/owner/status/date.
- Add SLA/no-response indicators.
- Enforce required next action at backend/API level for selected status transitions.
- Add no-response timers and overdue queue state.
- Add activity timeline directly in the lead panel.
- Add E2E tests for create, qualify, assign, convert, close, duplicate handling.

### `/dashboard/deals` - Deals

Status: `MVP Ready`

Implemented:

- Deals page exists.
- Deals can be created from inbox conversations through the shared conversation pipeline.
- Dashboard links to stale deals and deals page.
- Pipeline/stage models exist in backend.
- Page was refactored from a heavy drag/drop kanban into a focused sales pipeline workspace.
- Current layout:
  - pipeline and status filters at the top;
  - stage chips with deal counts;
  - deal list on the left;
  - selected deal work panel on the right.
- Selected deal panel now shows:
  - current status, stage, amount, probability, source;
  - linked client and contact action;
  - linked lead;
  - next action block;
  - stage move selector;
  - related conversations;
  - deal history;
  - notes.
- Won/lost flow is now handled through project-styled modals instead of raw prompt dialogs.
- Reopen action remains available for closed deals.
- Manager can create a next action task from the selected deal.
- Deal next action now uses a structured modal with title, due date, assignee, and priority.
- Deal stage advancement is blocked in the UI when an open deal has no next action.
- Deal owner can be changed from the selected deal panel.
- Deal list can be filtered by owner.
- Deal panel now shows stale/risk state based on SLA, expected close date, and missing next action.
- Inbox-created deals now preserve conversation context through linked client, lead, deal, and task entities.
- Full CRM drawer remains available as a secondary detailed view.
- Build check passed after the reform.

Before production:

- Enforce required next action and stage rules at backend/API level, not only in the UI.
- Add stale deal rules based on last activity, not only expected close/SLA/next action.
- Add role visibility and permission tests for owner changes.
- Add stronger lost reason taxonomy and reporting.
- Add conversion path from lead to deal with preserved source and conversation context.
- Add pipeline customization governance.
- Add pagination/virtualization for large pipelines.
- Add E2E tests for filtering, stage move, winning, losing, reopening, creating from lead, next action, and permissions.

### `/dashboard/conversations` and `/dashboard/inbox` - Unified Inbox

Status: `MVP Ready`

Implemented:

- See `Conversations / Unified Inbox` section above.

Before production:

- Add specific assignee selection.
- Add attachments and voice/image support.
- Add true error tracking, not only handoff-based errors.
- Add CRM drawer.
- Add SLA and operator queue state.
- Add pagination and selection across pages.
- Add realtime updates.
- Add full E2E coverage for critical inbox actions.

### `/dashboard/integrations` - Integrations

Status: `MVP Ready`

Implemented:

- See `Integrations` section above.

Before production:

- Implement production-grade setup flows per connector.
- Add credential management, diagnostics, retry, and audit.
- Add connector-specific tests and event reconciliation.

### `/dashboard/ai-assistant` - AI Assistant / AI Analyst

Status: `Needs Work`

Implemented:

- AI assistant page exists.
- Page calls `/api/ai/assistant/chat/`.
- AI assistant links to leads, conversations, tasks, deals, and integrations.

Before production:

- Reposition from generic chat to AI Analyst with grounded business context.
- Make every insight cite source records: leads, deals, conversations, orders, stock, integrations.
- Add confirmable actions with audit trail.
- Add safety rules for destructive actions.
- Add memory/session model per business.
- Add prompt/version logging.
- Add tests for grounded answer, missing data, hallucination guard, and permission scope.

### `/dashboard/clients` - Clients

Status: `MVP Ready`

Implemented:

- Clients page exists.
- Clients can be created from inbox conversations.
- Appointment and lead forms link to clients.
- Page was refactored from a card/list surface with drawer-first behavior into a two-pane customer profile workspace.
- Current layout:
  - search, source, tag, segment, and operational filters;
  - client list on the left;
  - selected client profile on the right.
- Selected client profile now shows:
  - contact identity and source;
  - quick WhatsApp action;
  - edit action;
  - full CRM drawer action;
  - counts for leads, deals, open deal value, appointments, and conversations;
  - quick actions for card, tags, new client, archive;
  - tags and notes;
  - active tasks;
  - timeline combining leads, deals, appointments, and conversations.
- Segment creation and client create/edit modal remain available.
- Build check passed after the reform.

Before production:

- Add duplicate detection and merge flow directly in the profile.
- Add structured quick-create actions for related lead, deal, appointment, and task.
- Add source attribution and consent fields.
- Add import/export validation.
- Add permission-based visibility for personal data.
- Add customer orders/payments/stock events when commerce integrations are connected.
- Add E2E tests for search, source/tag/segment filters, create, edit, merge, archive, link from inbox, and profile history.

### `/dashboard/tasks` - Tasks

Status: `Needs Work`

Implemented:

- Tasks page exists.
- Tasks can be created from inbox conversations.
- Dashboard links to overdue/my tasks.

Before production:

- Add clear task ownership, priority, due date, relation to client/lead/deal/conversation.
- Add recurring/follow-up tasks where needed.
- Add reminders/notifications.
- Add bulk complete/reassign.
- Add E2E tests for create, assign, overdue, complete, and permission scope.

### `/dashboard/calendar` and `/dashboard/appointments`

Status: `Needs Work`

Implemented:

- Calendar and appointments pages exist.
- Dashboard shows upcoming bookings.
- Appointment form links to clients, services, resources, working hours.

Before production:

- Validate booking conflict rules.
- Add timezone handling and working-hour enforcement.
- Add resource/service availability.
- Add cancellation/reschedule workflows.
- Add customer reminders.
- Add E2E tests for create, reschedule, conflict, cancellation, permissions.

### `/dashboard/analytics` and `/dashboard/timeline`

Status: `Needs Work`

Implemented:

- Analytics page exists.
- Timeline page exists.
- Dashboard links to analytics.

Before production:

- Define production metrics and ensure they match backend queries.
- Separate operational dashboard metrics from analytical reports.
- Add funnel conversion, channel attribution, response time, deal velocity, integration health.
- Add export/download where required.
- Add tests for metric correctness and date range handling.

### `/dashboard/automations`

Status: `Needs Work`

Implemented:

- Automations page exists.
- Navigation includes automations as secondary surface.

Before production:

- Define automation model: triggers, conditions, actions, owner, logs, failures.
- Add safe preview/test mode.
- Add run history and retry.
- Add permission and audit model.
- Add E2E tests for trigger creation, execution, failure, and disable.

### `/dashboard/bots`, `/dashboard/bots/:id`, `/dashboard/ai-agents`

Status: `Needs Work`

Implemented:

- Bots page exists.
- Bot detail page exists.
- AI agents page exists.
- Bot detail can open inbox.
- Telegram/WhatsApp setup components exist.
- Inbox now filters by bot.

Before production:

- Consolidate naming: decide whether product calls them `Bots`, `AI Agents`, or both with clear hierarchy.
- Add complete bot lifecycle: draft, test, launch, pause, archive.
- Add prompt/version management and rollback.
- Add channel connection status per bot.
- Add test chat sandbox.
- Add knowledge base attachment and source management.
- Add quality monitoring and failed-response review.
- Add E2E tests for create bot, configure prompt, connect channel, test, launch, pause.

### `/dashboard/settings`

Status: `Needs Work`

Implemented:

- Settings page exists.
- Developer section exists.
- Billing route redirects to settings hash.
- Service/resource/working-hour pages exist as separate settings-related surfaces.

Before production:

- Split settings into clear sections: business profile, team, roles, billing, security, integrations/developer, notifications.
- Add role/permission matrix UI.
- Add invite lifecycle management.
- Add audit log.
- Add 2FA/security settings if required.
- Add tests for permissions, invites, billing visibility, and developer token flows.

### `/dashboard/services`, `/dashboard/resources`, `/dashboard/working-hours`

Status: `Needs Work`

Implemented:

- Services page exists.
- Resources page exists.
- Working hours page exists.
- Appointment form depends on these surfaces.

Before production:

- Validate how services/resources interact with appointment availability.
- Add conflict prevention and time zone handling.
- Add clear empty states and import/export if needed.
- Add tests around booking availability.

### `/dashboard/onboarding` and `/dashboard/pilot-readiness`

Status: `Needs Work`

Implemented:

- Onboarding page exists.
- Pilot readiness page exists.
- Pilot page links to settings, onboarding, inbox, and integrations.

Before production:

- Convert pilot readiness into a real checklist backed by system state.
- Add completion state, blockers, owner, and next actions.
- Add production launch checklist.
- Add tests for readiness status calculation.

### `/platform/*` - Platform Operations

Status: `Not Ready`

Implemented:

- Platform overview exists.
- Platform operations, merchants, and merchant detail pages exist.
- Several platform routes are placeholders.

Before production:

- Decide whether platform admin is part of first production scope.
- Complete merchant management, billing, outreach, analytics, and settings if in scope.
- Add strict platform-level permissions.
- Add audit logs for platform actions.
- Add tests for cross-tenant isolation.

### Public Pages and Auth

Status: `Needs Work`

Implemented:

- Public home, pricing, bots, CRM, contacts pages exist.
- Login, signup, forgot password, reset password, invite accept pages exist.

Before production:

- Validate brand messaging against actual product capabilities.
- Do not promise roadmap integrations as production-ready.
- Add legal pages: privacy policy, terms, data processing, cookies if required.
- Add auth rate limiting and abuse protection.
- Add password reset and invite E2E tests.
- Add analytics/conversion tracking if needed.

## Cross-Cutting Production Requirements

### Security and Permissions

Before production:

- Audit every API endpoint for tenant isolation.
- Audit every frontend route for permission gating.
- Add tests for owner/admin/manager/operator/accountant/marketer/support roles.
- Add audit logs for sensitive actions.
- Add secure handling for connector credentials and tokens.

### Data Quality

Before production:

- Define duplicate rules for clients, leads, orders, and products.
- Add merge/reconciliation workflows.
- Add import validation with partial failure reporting.
- Add data retention and deletion policy.

### Reliability

Before production:

- Add production observability: logs, metrics, traces, error reporting.
- Add background job monitoring if async syncs are used.
- Add retry and dead-letter handling for integrations.
- Add backup and restore procedures.

### AI Safety and Auditability

Before production:

- Log AI prompt version, model, context records, output, user action, and final decision.
- Require confirmation for CRM mutations proposed by AI.
- Add hallucination guardrails and source citations.
- Add fallback behavior when source data is missing or stale.

### Testing

Before production:

- Add frontend E2E tests for core flows.
- Add backend integration tests for permissions, tenant isolation, and business workflows.
- Add contract tests for API shapes used by the frontend.
- Add smoke tests for local and staging deployments.

### Performance

Before production:

- Add pagination/infinite scroll for high-volume lists.
- Add query optimization for inbox, leads, deals, analytics, integrations.
- Split large frontend chunks where needed.
- Add load tests for inbox and integration event ingestion.

## Immediate Next Steps

1. Finish `/dashboard/conversations` production gaps:
   - specific assignee;
   - attachments;
   - true error tracking;
   - CRM drawer;
   - E2E tests.
2. Finish `/dashboard/leads` production gaps:
   - specific assignee;
   - duplicate/merge workflow;
   - required next action;
   - SLA/no-response indicators;
   - E2E tests.
3. Reform `/dashboard/deals` into a pipeline with required next action.
4. Turn `/dashboard/ai-assistant` into grounded AI Analyst.
5. Add production-grade integration setup and diagnostics.
