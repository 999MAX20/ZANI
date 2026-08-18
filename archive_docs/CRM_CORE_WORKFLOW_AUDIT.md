# ZANI Core CRM Workflow Audit

Date: 2026-07-16
Status: Phase 1 audit artifact
Scope: authenticated `/app` CRM product only

## 1. Purpose

This document executes Phase 1 from `actual_docs/CRM_TECHNICAL_MAP_AND_VERTICAL_MODES.md`: audit the current core CRM workflows before starting App 2.0 UI/UX implementation.

The goal is to determine whether the current frontend represents the backend CRM capabilities well enough, and what must be fixed before ZANI can feel like a premium, unified SaaS CRM.

## 2. Non-Goals

This phase does not:

- rewrite backend domain logic;
- implement vertical business modes;
- hide Deals or reorganize the app around dentistry or any other niche;
- redesign screens visually;
- mark implementation phases as complete.

Vertical adaptation remains deferred. The immediate focus is core CRM logic, workflow completeness and unified App 2.0 foundations.

## 3. Sources Inspected

Project direction and rules:

- `AGENTS.md`
- `plan/clean_code_rules/zani_required_clean_code_rules.md`
- `CRM_PRODUCTION_LAYER_PLAN.md`
- `docs/PERMISSION_MATRIX.md`
- `docs/AI_ASSISTANT_RULES.md`
- `docs/automation-runtime.md`
- `docs/entitlements.md`
- `docs/design-system.md`
- `plan/ui_ux_design_system_reform.md`

Current execution plans:

- `actual_docs/CRM_TECHNICAL_MAP_AND_VERTICAL_MODES.md`
- `actual_docs/APP_UI_UX_REDESIGN_TASK.md`

Frontend map:

- `frontend/src/app/router.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/crm/*`
- `frontend/src/features/*`
- `frontend/src/api/*`

Backend map:

- `config/urls.py`
- CRM-related `apps/*/views.py`
- CRM-related services and tests discovered through repository search

Repo-local skills used for this audit:

- `zani-analyze-crm-product`
- `zani-review-frontend`
- `zani-change-crm-domain`

## 4. Executive Conclusion

The backend/domain foundation is materially stronger than the current `/app` user experience.

ZANI already has many of the mechanics expected from a serious SMB CRM: tenant-scoped workspace, role permissions, lifecycle services, CRM cards, inbox-to-CRM actions, tasks, appointments, activity timeline, audit, automations, integrations and source-grounded AI.

The main gap is not that the backend is missing. The main gap is that the frontend still exposes this power through mixed page patterns, query-param drawers, local modals and inconsistent workspace structures. A user can access many actions, but the product does not yet feel like one premium operating system.

Therefore the next work should not be a full backend rewrite. It should be:

1. a short hardening pass for any remaining workflow evidence gaps;
2. entity experience foundation;
3. App 2.0 shell/workbench redesign;
4. role-based daily work surfaces;
5. vertical adaptation later.

## 5. Current `/app` Route Coverage

| Area | Current route(s) | Frontend status | Backend dependency | Audit verdict |
| --- | --- | --- | --- | --- |
| Dashboard | `/app`, `/app/dashboard` | Exists; owner/manager dashboard variants exist | analytics, work queues, AI brief, integrations | Good foundation, but needs App 2.0 daily cockpit pattern and role-specific completeness |
| Leads | `/app/leads` | Rich CRM page with filters, actions, modals, drawer | leads API, lead lifecycle, lead forms, CRM card, appointments, tasks | Strong feature coverage; needs full lead workspace instead of drawer-first deep view |
| Deals | `/app/deals` | Pipeline/list page with drawer and actions | deals API, pipelines, stage transitions, terminal lifecycle | Strong backend; UI needs unified workbench and full deal workspace |
| Clients | `/app/clients` | Table/inspector/drawer flow exists | clients API, duplicate checks, merge, archive, CRM card | Strong backend; client workspace is the most important missing premium surface |
| Tasks | `/app/tasks` | Task list/drawer/actions exist | task lifecycle, workload, templates, assignment, comments | Strong backend; needs consistent App 2.0 task execution pattern |
| Calendar | `/app/calendar` | Calendar page and appointment drawer exist | appointments, resources, working hours, lifecycle, slots | Strong backend; needs unified appointment workspace and visual QA with realistic volume |
| Conversations / Inbox | `/app/conversations`, `/app/inbox` | Split inbox and CRM action links exist | inbox conversations, messages, quick replies, AI suggestions, link/create CRM actions | Strong operational value; needs right-context alignment with new entity workspace |
| Timeline | `/app/timeline` | Dedicated timeline route exists | activity events, notes, BusinessEvents | Good foundation; timeline should become embedded in each entity workspace |
| Integrations | `/app/integrations`, `/app/bots`, `/app/bots/:id` | Provider cards/setup/status exist | connectors, credentials, sync runs, webhooks, provider health | Backend is broad; UI should keep technical details out of daily work |
| AI Assistant | `/app/ai-assistant`, `/app/ai`, `/app/assistant` | AI assistant route exists | chat, analyst brief, owner brief, tool suggest/execute, approvals | Needs consistent source/no-data/provider/approval states inside App 2.0 |
| AI Agents | `/app/ai-agents`, nested sections | Agent management exists | agent profiles, knowledge, channels, runtime state | Needs App 2.0 control-surface treatment |
| Automations | `/app/automations` | Automation page exists | automation rules, actions, conditions, runs | Needs merchant-readable run/status UX consistency |
| Outreach | `/app/outreach` | Campaign surface exists | templates, campaigns, recipients, consents | Needs same App 2.0 surface rules as other operational modules |
| Services | `/app/services` | Settings-adjacent setup page exists | services API | Functional; should be grouped cleanly under operations setup |
| Resources | `/app/resources` | Settings-adjacent setup page exists | resources API | Functional; should align with calendar setup |
| Working hours | `/app/working-hours` | Settings-adjacent setup page exists | working-hours API | Functional; should align with calendar setup |
| Analytics | `/app/analytics` | Analytics route exists | report widgets, reports, owner dashboard | Needs premium reporting layout and consistent loading/empty/error states |
| Settings | `/app/settings`, `/app/billing` | Exists and permission-gated | team, permissions, billing, security, preferences | Needs decluttering to avoid an admin-maze feel |

## 6. Backend Capability Map

| Domain | Server capability already present | Product meaning |
| --- | --- | --- |
| Workspace and access | Business workspace, business members, roles, permission catalog, team management | CRM can be tenant-scoped and role-aware |
| Leads | lifecycle actions, lead-to-deal, lead-to-client, appointment/task creation, duplicate checks, CRM card | Leads can become real work, not just rows |
| Deals | pipelines, stages, stage transitions, move-stage, won/lost/reopen, CRM card | Deal lifecycle can be controlled through services |
| Clients | CRM card, duplicate checks, merge/dry-run, archive/restore, tags/segments/custom fields | Client record can become the central workspace |
| Tasks | lifecycle actions, assignment, watchers, comments, templates, workload, smart ordering | Daily work can be routed and tracked |
| Calendar | slots, working hours, resources, appointment lifecycle, reschedule/cancel/no-show/complete, CRM card | Appointment workflows are operationally meaningful |
| Conversations | inbox summary, messages, retry, assign, handoff, priority, close/reopen, suggest reply, create/link client/lead/deal/task/appointment | Messages can become CRM work directly |
| Activity and audit | activity events, notes, timeline, audit/security endpoints, BusinessEvents | Important actions can be explainable and traceable |
| Automation | rules, conditions, actions, runs, retry/cancel, templates, preview/manual run | Repetitive CRM work can become controlled automation |
| Integrations | connectors, credentials, business events, sync runs, health/test/sync/retry, webhooks | External systems can feed CRM without leaking provider complexity |
| AI | assistant, analyst brief, owner brief, tool suggestion/execution, approval requests | AI can assist while staying source-grounded and permission-aware |
| Reporting | owner dashboard, reports summary/export, report widgets, analytics events | Management surfaces can show business state |

## 7. Workflow Coverage Assessment

### 7.1 Lead / Request Workflow

Current server coverage is strong. The backend supports lifecycle state, owner assignment, contact handling, lost/closed/reopen actions, deal creation, client conversion, task creation, appointment creation, notes, duplicate checks and CRM card context.

Current frontend coverage is meaningful but not final. `/app/leads` has a richer page than many other modules, but deep inspection still depends on `CrmEntityDrawer` and modal flows.

Gap:

- lead record does not yet have a full URL-addressable workspace;
- related messages, tasks, appointments, deals and timeline are available through CRM card concepts, but not presented as a premium full entity experience;
- the page should be refit into the same workbench structure as clients, deals, tasks and calendar.

Verdict: backend ready for App 2.0; frontend needs entity workspace redesign.

### 7.2 Client Workflow

Current server coverage is strong. The backend supports client CRM card, related context, duplicate detection, merge, archive/restore, consent/source information, custom fields, tags, notes, timeline and cross-entity links.

This is the most important App 2.0 surface. A premium CRM should make the client record feel like the source of truth: identity, conversations, requests, deals, tasks, appointments, files, notes, timeline and AI next step.

Gap:

- current client UX is still drawer/table centric;
- client record should not feel like a side panel;
- client workspace needs a full layout with overview, communication, work, commercial, calendar and history zones;
- drawer can remain as quick inspector, but not as the main deep-work pattern.

Verdict: client backend is ready; client workspace should be the first major UI build after the hardening/evidence pass.

### 7.3 Deal Workflow

Current server coverage is strong. Deals have pipeline/stage mechanics, movement, terminal status actions, CRM card context and lifecycle tests according to the production plan and discovered actions.

Gap:

- the deal page has useful operational controls, but should be normalized into the same App 2.0 workbench shell;
- deal detail should become a full workspace when the user needs context, not only a half-screen drawer;
- deal timeline, linked client, tasks, appointments and activity should be visible without forcing navigation jumps.

Verdict: do not hide Deals now. Keep Deals as core CRM and redesign them consistently.

### 7.4 Appointment Workflow

Current server coverage is strong. Scheduling supports resources, working hours, available slots, creation from lead, cancel, complete, no-show, reschedule, follow-ups and notifications.

Gap:

- current calendar UI needs production-like volume QA;
- appointment detail should align with entity experience patterns;
- reschedule/cancel/no-show/complete actions must be visibly clear but not crowded;
- calendar should show conflict/availability/business-hour states in a calm, high-trust way.

Verdict: backend is suitable for App 2.0; UI needs consistency and realistic-data verification.

### 7.5 Task Workflow

Current server coverage is strong. Tasks support status actions, assignment, watchers, comments, due quick actions, workload, templates, conversation links and notification routing.

Gap:

- tasks should have a clearer "daily execution" surface for assigned work, overdue work and watched work;
- task drawer exists, but task context should follow the same quick-inspector/full-workspace model;
- role-based views for owner, manager, operator and staff are still not formalized enough.

Verdict: backend ready; frontend needs role-aware work surfaces.

### 7.6 Conversation Workflow

Current server coverage is strong. Inbox actions include assignment, handoff, priority, read/unread, close/reopen, retry, AI reply suggestion, qualification, pipeline run, and create/link actions for CRM entities.

This is one of the strongest product differentiators because CRM work often starts from messages.

Gap:

- conversation context should integrate with the new entity workspace model;
- when a conversation is linked to a client/lead/deal/task/appointment, the user should see a clear relationship graph;
- appointment/task creation from inbox should feel like part of one workflow, not a separate modal detour;
- AI suggestions need consistent source, confidence, approval and no-data states.

Verdict: operationally strong; needs premium interaction model.

### 7.7 Automation Workflow

Current server coverage is strong. Automation rules, conditions, actions, runs, retry/cancel and templates exist.

Gap:

- UI must make automations understandable for merchants;
- technical execution details should be available but not dominate;
- run history should show what happened, what failed, whether retry is safe, and which CRM object was affected;
- automation actions must remain service-backed and auditable.

Verdict: backend foundation is good; App 2.0 should make it safer and easier to understand.

### 7.8 AI Workflow

Current server coverage is strong for safety constraints: source grounding, no-data behavior, provider failure states, approval requests and permission checks are documented as production-layer requirements.

Gap:

- AI UI should not be a separate magic box;
- AI recommendations should appear near the relevant entity/workflow with citations to real records;
- tool execution should always show what will change and require approval where needed;
- empty/provider/error states should be consistent across dashboard, assistant, inbox and entity workspaces.

Verdict: keep AI controlled and embedded into workflows.

### 7.9 Integration Workflow

Current server coverage is broad. Connectors, credentials, health checks, events, sync runs, retry and webhooks exist.

Gap:

- integration setup must stay merchant-safe;
- provider secrets and webhook details should not dominate daily CRM pages;
- event logs should connect to business outcomes: messages received, clients updated, events added, sync failed, retry needed;
- integration status should be visible on dashboard/control surfaces only when actionable.

Verdict: backend is capable; UX should reduce technical noise.

## 8. Cross-Entity Experience Map

The most important App 2.0 concept is a two-level entity experience:

1. Quick Inspector: lightweight right-side context for fast checking and minor actions.
2. Full Entity Workspace: URL-addressable deep workspace for real work.

The current `CrmEntityDrawer` already proves that one shared CRM card pattern is possible. It loads `crmCardsApi.get({ type, id })`, supports tabs such as overview, timeline, tasks, appointments, deals, files, messages and notes, and has entity-specific content for appointment, lead, deal and client.

That is a strong foundation, but the current drawer should not remain the main deep-work surface. It is good as a bridge and quick inspector. For premium CRM work, ZANI needs full workspaces:

- `/app/clients/:id`
- `/app/leads/:id`
- `/app/deals/:id`
- `/app/tasks/:id` if task depth requires it
- `/app/calendar/:id` or `/app/appointments/:id` if appointment depth requires it
- conversation detail routes or stable query state for inbox context

The full workspace should preserve the same CRM card data model, not invent a second data contract.

## 9. Main Gaps Blocking Premium App 2.0

### P0. Unified Entity Workspace Is Missing

The backend can provide linked context, but the frontend still treats many entity details as drawer content. This limits the feeling of a serious CRM record.

Required outcome:

- client, lead and deal have full workspaces;
- drawer becomes quick inspector;
- workspace has stable URL/deep-link behavior;
- tabs and related objects use one shared data contract.

### P0. Workbench Layout Is Not Uniform Enough

Leads, deals, clients, tasks, calendar, conversations, automations, integrations and analytics do not yet feel like one system.

Required outcome:

- shared `AppShell 2.0`;
- shared page header/action/filter language;
- shared list/table/kanban/calendar/inbox container rules;
- shared loading, empty, error, forbidden and upgrade states.

### P0. Role-Based Daily Work Surfaces Are Partial

Permissions exist, and owner/manager dashboard logic exists, but the product still needs clearer work surfaces for:

- owner/director;
- manager/team lead;
- sales manager;
- messenger operator;
- staff/specialist;
- marketer;
- support.

Required outcome:

- user sees the work that matters for their role;
- irrelevant controls are de-emphasized;
- permissions stay backend-enforced.

### P0. Production-Like UI QA Is Still Needed

The production plan itself keeps production-like QA as a follow-up for calendar, tasks, client, deal and inbox flows.

Required outcome:

- realistic data volume;
- empty/error/forbidden/loading states checked;
- desktop and mobile layout screenshots;
- no critical overlap, cramped drawer-only workflows or unreadable dense surfaces.

### P1. Settings And Integrations Need Merchant-Safe Grouping

Settings, services, resources, working hours, billing, team, automations and integrations are functional but risk becoming an admin maze.

Required outcome:

- daily work pages stay clean;
- setup pages are grouped by merchant mental model;
- provider technical details are progressively disclosed.

### P1. AI/Automation/Integration States Need Shared UX Rules

The backend has strong safety rules, but the UI must express them consistently.

Required outcome:

- all AI recommendations show source/no-data/provider/approval states;
- automation run states show affected object, result and retry safety;
- integration events map to business impact.

### P2. Vertical Adaptation Is Valuable Later

Vertical modes should adapt labels, defaults, module emphasis and dashboards later. They should not drive current implementation.

Required outcome later:

- business type selected during registration;
- profile stored as configuration;
- presentation/defaults adapt over shared CRM core;
- no separate backend per niche.

## 10. Does Frontend Currently Match Backend Functionality?

Short answer: partially.

The frontend covers the major modules and many actions, but it does not yet present the backend as one cohesive premium CRM.

What matches well:

- primary `/app` routes exist for core CRM modules;
- permissions gate routes and sidebar items;
- shared CRM card/drawer infrastructure exists;
- many APIs already have frontend clients;
- leads/deals/clients/tasks/calendar/conversations expose real actions;
- dashboard links into operational pages;
- inbox can create/link CRM objects;
- integrations, automations and AI have user-facing routes.

What does not match well enough:

- backend has cross-entity context, but UI lacks full entity workspaces;
- backend has lifecycle rigor, but UI patterns vary by module;
- backend has timeline/audit/BusinessEvents, but timeline is not consistently central in entity workflows;
- backend has role permissions, but role-specific work surfaces are incomplete;
- backend has AI approval/source rules, but App 2.0 does not yet define one consistent AI UX language;
- backend has integration event models, but daily UI should translate these into business outcomes more clearly;
- current drawer can feel large and still cramped because it tries to do deep work in a side panel.

## 11. Recommended Execution Order From Here

### Phase 2A: Short Core Hardening And Evidence Pass

Do this before large UI rebuild.

Tasks:

- confirm all critical CRM actions on frontend call service-backed endpoints, not generic patch shortcuts;
- spot-check permission/tenant-denial flows for the highest-risk actions;
- document exact API contract required by entity workspaces;
- identify any missing CRM card fields needed by client/lead/deal workspaces;
- create realistic QA seed scenarios for client, lead, deal, task, appointment and inbox.

Expected duration: short and bounded.

Reason: avoid building a beautiful App 2.0 on top of an unverified edge.

### Phase 2B: Entity Workspace Contract

Tasks:

- define shared entity workspace data model;
- reuse existing CRM card contract where possible;
- add route plan for full workspaces;
- define quick inspector vs full workspace responsibilities;
- define tab model and action placement.

Expected result:

- implementation can start without debating drawer behavior on every page.

### Phase 3: Client Workspace First

Build client workspace first because it unifies the whole product.

Must show:

- identity and contact data;
- conversations;
- leads/requests;
- deals;
- tasks;
- appointments;
- notes/files;
- timeline;
- AI/CRM next step.

### Phase 4: Lead And Deal Workspaces

Tasks:

- lead workspace with source, conversation, qualification, tasks, appointments, conversion actions;
- deal workspace with stage, value, client, tasks, appointments, activity and won/lost reasoning;
- keep Deals visible in core CRM.

### Phase 5: AppShell 2.0 And Workbench Standardization

Tasks:

- shared shell;
- shared page headers;
- shared filters/search/saved views;
- shared workbench containers;
- unified state views;
- visual QA across all `/app` pages.

### Phase 6: Role-Based Daily Work Views

Tasks:

- owner cockpit;
- manager queue;
- operator inbox;
- sales follow-up board;
- staff schedule/tasks;
- marketer outreach surface.

### Later: Vertical Adaptation

Tasks:

- store business profile during registration;
- adapt labels/defaults/navigation emphasis;
- configure dashboards by business type;
- keep shared CRM core.

## 12. Phase 1 Acceptance Checklist

- [x] All primary `/app` routes mapped.
- [x] Main backend CRM endpoints and actions mapped at domain level.
- [x] Current frontend coverage compared to backend capability.
- [x] Main workflow gaps identified.
- [x] Entity drawer/workspace direction clarified.
- [x] Vertical adaptation kept out of immediate scope.
- [x] Next implementation order proposed.

## 13. Verification Notes

This phase changed documentation only.

Checks performed:

- repository route/API/workflow search with `rg`;
- frontend route/sidebar/entity drawer inspection;
- backend URL/action inventory inspection;
- production plan and UI/UX plan comparison.

Checks not run:

- Django tests were not run because no backend code changed;
- frontend build was not run because no frontend code changed;
- browser visual QA was not run because this phase produced the audit contract, not UI changes.

## 14. Final Decision

Proceed with the plan, but do it in the right order.

Do not rebuild the backend from scratch.

Do not begin with vertical adaptation.

Do not start by restyling every page independently.

Start with a bounded hardening/evidence pass, then build the entity workspace foundation. The current backend is already strong enough that the biggest product gain will come from a unified App 2.0 experience that exposes existing CRM power cleanly.
