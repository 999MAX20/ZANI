# ZANI CRM Technical Map, Implementation Status And Vertical Modes

Date: 2026-07-16

Purpose: compare the current ZANI CRM implementation with the required CRM product mechanics, then define the practical direction for the shared CRM core and the first dentistry-focused launch mode.

This document is a status map and product-technical plan. It does not mark implementation tasks as complete by itself. Runtime code, tests and the current API contract remain the implementation source of truth.

Current correction 2026-07-16: the previous version treated vertical modes as later/non-urgent. Product direction has changed: the first commercial launch should be dentistry-first, while the CRM core remains shared and reusable for other SMB verticals.

## 1. Product Conclusion

ZANI should remain a strong universal SMB CRM and business control layer, but the first launch profile should be dentistry-first.

The immediate goal is not to create separate CRM codebases for every niche. The goal is one shared CRM core plus a product profile/capability layer that changes which modules, labels and default workflows are visible for a business type.

For the generic CRM core, the workflow remains:

```text
lead / request / message
-> client
-> task / appointment / deal / next action
-> responsible user
-> notification / escalation
-> activity timeline
-> manager dashboard
-> AI suggestion with sources and confirmation
```

The core CRM axis is:

```text
tenant -> role -> permission -> ownership -> next action -> lifecycle -> audit -> analytics -> UI workflow
```

The product already has many backend capabilities. The main risk now is not missing pages. The main risk is that the UI and workflows do not expose the existing backend functionality as one calm, understandable, premium SaaS system.

For dentistry, the default workflow should be shorter:

```text
messenger / call / public form request
-> bot/operator qualification
-> client
-> appointment in calendar
-> responsible doctor/resource/operator
-> reminder / follow-up task / no-show recovery
-> activity timeline
-> owner/manager dashboard
-> AI summary and next-best action
```

In this dentistry profile, Deals should be optional/disabled by default only after a backend and frontend capability layer exists. Hiding the Deals menu in the sidebar without backend guards would be an incomplete implementation.

Therefore the correct priority is:

1. stabilize and complete core CRM logic;
2. make all core workflows reachable and consistent in UI;
3. redesign `/app` into one unified App 2.0 experience;
4. implement a dentistry-first capability/profile layer before launch;
5. later reuse the same profile mechanism for medcenters, auto service, retail/service businesses and other SMB verticals.

## 2. Current Priority Statement

### P0 Now

Core CRM production logic and workflow completeness:

- leads / requests;
- clients;
- deals;
- tasks;
- calendar / appointments;
- inbox / conversations;
- assignments and responsible users;
- activity timeline;
- audit;
- notifications;
- role-aware dashboards;
- AI assistant / analyst with source grounding;
- integrations status;
- automation visibility;
- UI/UX redesign of authenticated `/app`;
- dentistry-first product profile/capability layer:
  - enabled modules per business type;
  - backend guard for disabled modules;
  - role-aware navigation and routes;
  - appointment-first dashboard and calendar workflow;
  - module-aware AI/tool suggestions;
  - module-aware onboarding copy and checklist.

### Not P0 Now

Overbuilt vertical complexity:

- separate CRM codebases per industry;
- frontend-only hiding of Deals for dentistry;
- deep medical records, treatment charting, insurance flows or clinical EHR logic;
- Bitrix/ERP-style admin surfaces;
- dozens of industry templates before the dentistry profile is stable;
- business-type-specific AI action policies that are not backed by permissions and module capabilities.

The profile layer is valuable now because dentistry is the first launch vertical. The heavy industry-specific feature set is later.

## 3. Relationship To UI/UX Redesign Plan

This document defines what the CRM must do and which logic matters first.

`actual_docs/APP_UI_UX_REDESIGN_TASK.md` defines how the authenticated app should look, feel and behave as a premium SaaS interface.

The two plans should be executed in this order:

```text
Core CRM logic map
-> workflow gaps and backend/frontend consistency
-> AppShell / Workbench / Entity Experience redesign
-> page-by-page UI implementation
-> visual QA and role smoke
-> dentistry-first product profile
-> future vertical modes
```

The UI/UX redesign must not become a cosmetic restyle. Every new App 2.0 screen must expose real CRM work:

- who needs attention;
- what changed;
- who is responsible;
- what action is next;
- what is overdue;
- what is blocked;
- what AI suggests and why;
- what source data supports the view.

## 4. Benchmark From Top CRM Systems

The practical lesson from top SaaS CRM products is not that ZANI should copy their screens. The useful lesson is how they structure work, ownership, permissions and context.

### HubSpot

Useful product mechanics:

- clear record ownership;
- contact/company/deal/activity relationship;
- saved views and filtered work queues;
- activity timeline as the center of record context;
- permission sets for actions;
- record access rules for visibility;
- guided sales workspace;
- operational dashboards rather than only vanity totals.

What ZANI should learn:

- every record needs owner/responsible context;
- list views should support daily work, not only data browsing;
- entity pages should show timeline, tasks, communication and related objects together;
- AI should assist inside the work context, not live as a separate decorative chat.

### Salesforce

Useful product mechanics:

- separation between profiles/permissions and role hierarchy/visibility;
- queues for unassigned or team-owned work;
- assignment rules;
- escalation rules;
- audit/history for important state changes;
- strong object-level access model.

What ZANI should learn:

- permission is not the same as visibility;
- assignment is not the same as ownership;
- queues should be intentional, not accidental unassigned state;
- critical mutations need backend enforcement and traceability.

### Pipedrive

Useful product mechanics:

- pipeline-first deal management;
- next activity discipline;
- simple deal cards with stage, value, owner and next action;
- visibility groups;
- automatic assignment;
- activity-based sales execution.

What ZANI should learn:

- Deals should remain simple and action-oriented;
- pipeline cards should surface next action and risk, not become decorative;
- stuck/no-next-action deals should be visible immediately;
- stage changes must be controlled and auditable.

### Zoho CRM

Useful product mechanics:

- roles and profiles;
- sharing rules;
- assignment rules;
- workflow rules;
- broad CRM coverage with configurable modules.

What ZANI should learn:

- flexibility is useful only when it remains understandable for SMB users;
- settings should not become an admin maze;
- advanced configuration should exist behind clear boundaries;
- daily users should see work, not system internals.

### Benchmark Conclusion

Top CRMs converge on these principles:

1. Users need clear daily work queues.
2. Records need owners, next actions and history.
3. Permissions, visibility and assignment are separate concepts.
4. Dashboards should show operational risk and work, not only totals.
5. Automation and AI must be explainable and controlled.
6. Settings must hide complexity from daily users.
7. A CRM record without activity, next action or ownership is not operationally useful.

For ZANI, the right interpretation is:

```text
simple SMB surface
+ strong backend rules
+ unified entity context
+ role-aware work queues
+ controlled AI
+ premium App 2.0 UI
```

## 5. Current Strong Foundation

ZANI already has a serious foundation for a real CRM product.

### Workspace And Access

Implemented or already represented in the project:

- `Business`;
- `BusinessMember`;
- `BusinessRole`;
- `RolePermission`;
- `RolePreset`;
- `Team`;
- `TeamMember`;
- `BusinessInvitation`;
- `business_type`;
- tenant-scoped merchant workspace.

### CRM Objects

Implemented or already represented:

- `Client`;
- client merge log;
- `Lead`;
- lead forms and submissions;
- `Pipeline`;
- `PipelineStage`;
- `Deal`;
- deal stage history;
- deal value history;
- `Task`;
- task comments;
- `Appointment`;
- `Resource`;
- working hours;
- services.

### Messaging And Bots

Implemented or already represented:

- bots;
- bot channels;
- conversations;
- messages;
- quick replies;
- inbox actions;
- handoff;
- AI qualification preview;
- conversation-to-CRM actions.

### Operations

Implemented or already represented:

- notifications;
- notification preferences;
- activity events;
- audit logs;
- notes;
- tags;
- segments;
- automation rules;
- automation runs.

### Integrations And Analytics

Implemented or already represented:

- business connectors;
- connector credentials;
- business events;
- integration event logs;
- connector sync runs;
- API tokens;
- webhook endpoints;
- webhook delivery logs;
- analytics events;
- report widgets;
- scheduled reports;
- billing entitlements and limits.

### AI

Implemented or documented:

- source-grounded assistant rules;
- analyst rules;
- no-data fallback;
- approval gate for critical mutating AI actions;
- audit for AI tool execution and approvals.

## 6. Implementation Snapshot And Evidence Boundaries

This section should be treated as a product-technical map, not as a claim that every item is finished perfectly in UI.

### Already Strong

ZANI already appears to have enough foundation to become a real CRM product without rewriting the backend:

- multi-tenant `Business` workspace;
- role and permission foundation;
- clients, leads, deals, appointments, tasks and conversations;
- bots, channels and quick replies;
- activity and audit concepts;
- integration events and connector status concepts;
- automation rules and runs;
- AI assistant and analyst safety rules;
- billing/entitlement foundations.

### Still Needs Proof Per Workflow

Before declaring the CRM production-ready, each workflow needs evidence:

- reachable UI path;
- backend permission enforcement;
- tenant isolation;
- lifecycle service usage;
- activity/audit records where needed;
- notification behavior where needed;
- loading/error/empty/forbidden states;
- tests or focused manual QA.

### Important Distinction

A model or endpoint is not the same as a completed product capability.

For example:

- a `Deal` model is not a complete pipeline workflow unless stage changes, ownership, next action, won/lost, loss reason, timeline and permissions work together;
- a `Task` model is not daily execution unless assignee, due date, priority, related entity, completion/cancel flow and overdue visibility are present;
- a `BotConversation` is not a full inbox unless the operator can read, assign, handoff, reply, link CRM objects and act from context;
- an AI endpoint is not a usable AI assistant unless it cites sources, handles no-data and respects permissions.

## 7. Necessary CRM Core Components

### 7.1 Tenant And Workspace

Required entities:

- Business;
- business profile;
- business settings;
- business status;
- subscription / entitlement;
- audit log;
- support access grant, later if needed.

Required logic:

- every merchant entity is scoped to `Business`;
- every API read/write is business-scoped;
- platform/admin access is separated from merchant CRM access;
- support access is explicit and audited;
- billing/limits use entitlement services, not scattered checks.

Current direction:

- keep this shared for all businesses;
- do not create separate CRM roots per niche;
- do not move merchant workflow configuration into technical/developer UI.

### 7.2 Users, Roles And Access

Required entities:

- User;
- BusinessMember;
- BusinessRole;
- RolePermission;
- RolePreset;
- Team;
- TeamMember;
- BusinessInvitation.

Required role model:

- Owner / Director;
- Admin;
- Manager / Team Lead;
- Sales Manager;
- Messenger Operator;
- Staff / Specialist;
- Marketer;
- Accountant;
- Support.

Required access concepts:

- action permission: view, create, update, delete/manage;
- record visibility: own, assigned, team, business;
- ownership: who owns the record;
- responsibility: who must act;
- assignment: who currently handles the work;
- queue: intentionally unassigned work pool.

Priority:

- harden mutation checks for object scope;
- make role presets practical for SMB teams;
- make frontend role-aware without treating frontend hiding as security.

### 7.3 Product Modules

Current product modules:

- dashboard;
- leads / requests;
- clients;
- deals / pipeline;
- tasks;
- calendar / appointments;
- inbox / conversations;
- services;
- resources;
- working hours;
- analytics;
- AI assistant / analyst;
- automations;
- integrations;
- outreach;
- settings;
- billing.

Current priority:

- keep modules available as the generic CRM product;
- make them visually and operationally consistent;
- add a capability/profile layer before changing module visibility by business type.

Later:

- a business-type product profile can recommend module defaults;
- optional modules can be enabled/disabled by owner;
- vertical labels and dashboards can adapt the same CRM core.

### 7.4 Client Identity

Required entities and behavior:

- normalized phone/email identity where possible;
- source attribution;
- duplicate detection;
- merge log;
- consent / communication preferences;
- tags and segments;
- archive/restore instead of hard delete.

Required UI:

- contact information;
- source and consent;
- related leads;
- related deals;
- related tasks;
- related appointments;
- related conversations;
- notes;
- timeline;
- AI/CRM next step.

Client workspace should become one of the strongest screens in App 2.0.

### 7.5 Leads / Requests

Required behavior:

- capture from forms, messenger, manual create, import, bot or integration;
- preserve source and business;
- assign responsible user/team/queue;
- detect possible duplicate client;
- convert/link to client;
- create appointment/task/deal;
- close/lost requires reason;
- important changes write activity/audit.

Required UI:

- saved views;
- source/status/responsible/next action columns;
- quick action to contact/create task/book appointment/create deal;
- selected lead inspector;
- full lead workspace.

### 7.6 Deals / Pipeline

Required behavior:

- business-owned pipeline and stages;
- controlled stage transitions;
- owner/responsible user;
- amount/currency;
- next action;
- won/lost/reopen;
- lost reason;
- stage/value history;
- stale/no-next-action visibility.

Current decision:

- Deals stay part of the shared CRM core;
- dentistry launch should disable or de-emphasize Deals by default only through a real capability layer;
- generic and sales-heavy businesses should still get Deals as a coherent pipeline workbench.

Later:

- business-type profiles may rename Deals or map them to treatment plans/cases when the business actually needs a longer sales/service cycle;
- long-cycle service businesses may use Deals as cases, treatment plans, estimates or projects.

### 7.7 Calendar / Appointments

Required behavior:

- appointment belongs to business;
- service, resource and responsible user are valid for business;
- booking respects working hours;
- overlap rules are enforced;
- reschedule/cancel/no-show/complete are controlled;
- reason required where operationally important;
- reminders and follow-up tasks are supported;
- notifications route to the right responsible user/resource.

Required UI:

- day/week/month/list views;
- resource/service filters;
- appointment inspector;
- linked client/lead/deal/task context;
- visible lifecycle actions;
- mobile-friendly appointment view.

### 7.8 Tasks And Daily Work

Required behavior:

- task can link to client, lead, deal, appointment or conversation;
- assignee is an active business member;
- priority and due date are visible;
- completion/cancel/snooze/comment are controlled;
- overdue work is visible;
- workload by assignee is visible.

Required UI:

- My;
- Today;
- Overdue;
- Team;
- Watching;
- Done;
- compact table/list;
- quick complete/snooze/comment;
- linked entity navigation.

### 7.9 Inbox / Conversations / Bots

Required behavior:

- inbound message creates/updates conversation;
- conversation belongs to business and channel;
- unread/handoff/assigned states are visible;
- operator can assign/reassign/take conversation;
- bot state is visible;
- handoff stops automation where needed;
- AI draft/qualification requires proper confirmation before mutation;
- CRM objects can be created/linked from conversation.

Required UI:

- conversation list;
- chat pane;
- right client/context panel;
- quick replies;
- AI draft;
- CRM action shortcuts;
- queue filters.

### 7.10 Queues, Assignment And Escalation

Required behavior:

- new work can be routed to owner, user, team or queue;
- unassigned queue is visible to the right role;
- manager can reassign;
- stale/unanswered/overdue items are visible;
- escalation creates notifications and dashboard risk.

Potential future entities:

- AssignmentRule;
- AssignmentQueue;
- QueueMembership;
- UserAvailability;
- EscalationPolicy;
- SLAPolicy.

Current priority:

- clarify ownership/responsible/assignee semantics first;
- implement minimal role-aware queues before complex routing engine.

### 7.11 Notifications

Required behavior:

- notifications are business-scoped;
- category and urgency are explicit;
- noisy notifications are avoided;
- assigned user receives direct work notifications;
- managers receive team risk notifications;
- owners receive business risk and connector/billing notifications;
- urgent items can bypass ordinary preference settings where appropriate.

Required UI:

- entity link;
- action expected;
- urgency;
- resolved/unresolved state;
- clear empty state.

### 7.12 Analytics And Reporting

Required answers:

- where leads come from;
- who owns work;
- which tasks are overdue;
- which deals are stuck;
- which conversations are unanswered;
- which appointments are upcoming/cancelled/no-show;
- which integrations are failing;
- which team member is overloaded;
- what AI recommends and which sources support it.

Avoid:

- vanity totals without action;
- charts disconnected from workflow;
- fake demo numbers;
- reports that ignore permissions.

### 7.13 AI Assistant And Analyst

Required behavior:

- source-grounded answers;
- no-data fallback;
- provider failure state;
- permission-aware sources;
- confirmation for critical actions;
- audit log for AI tool execution;
- no hidden mutation;
- no deterministic local hint disguised as AI.

Required UI:

- source chips;
- confidence/limitation where useful;
- recommended action;
- approval controls;
- clear no-data/provider-unavailable state.

### 7.14 Integrations

Required behavior:

- credentials are masked/encrypted;
- provider-specific complexity remains behind connector layer;
- webhook/pull syncs are idempotent;
- BusinessEvents are normalized;
- connector health is visible;
- failed syncs are recoverable where safe.

Required UI:

- provider cards;
- connected/degraded/disconnected;
- last sync;
- failed sync reason;
- retry/setup/help action;
- technical payload hidden behind advanced/admin controls.

## 8. Main Product Gaps To Prioritize

### 8.1 Unified Workflow Surface

Problem:

Core entities exist, but the user may still need to jump between pages, drawers and modals to understand one customer or one piece of work.

Required outcome:

For any lead, client, deal, appointment, task or conversation, the user should quickly understand:

- what this object is;
- who owns it;
- current status;
- next action;
- related client / lead / deal / appointment / task / conversation;
- history and timeline;
- available actions;
- permission limitations;
- AI suggestions where relevant.

This is the bridge to the App 2.0 `Entity Workspace` and `Quick Inspector` model.

### 8.2 Ownership And Responsibility

Problem:

A CRM becomes weak when work can exist without clear ownership.

Required outcome:

Every operational object should have clear ownership semantics:

- owner;
- responsible user;
- assignee;
- watcher;
- queue or unassigned state where intentional;
- team scope where relevant.

Objects that need ownership:

- leads;
- deals;
- tasks;
- appointments;
- conversations;
- follow-up actions;
- automation-generated work;
- AI-suggested work after confirmation.

Important rule:

Unassigned is allowed only when it means "in queue", not when the system simply lost responsibility.

### 8.3 Next Action Discipline

Problem:

Users should not need to infer what to do next from raw status values.

Required outcome:

Core CRM views should expose next actions:

- call / message client;
- assign owner;
- create task;
- book appointment;
- move deal stage;
- close as won/lost with reason;
- mark no-show/cancelled with reason;
- follow up;
- retry failed sync;
- review AI recommendation.

Every primary page should answer:

```text
What needs action now?
Who owns it?
What happens if nobody acts?
```

### 8.4 Lifecycle Integrity

Problem:

If statuses can be changed casually from UI or view code, the CRM becomes unreliable.

Required outcome:

Lifecycle changes must go through backend services and state-machine helpers where applicable:

- lead qualification;
- lead lost/closed reason;
- lead conversion;
- deal stage movement;
- won/lost/reopen;
- appointment booking/rescheduling/cancel/no-show/complete;
- task start/complete/cancel/snooze;
- conversation handoff/close/reopen;
- archive/restore.

Each critical transition should produce:

- validated state change;
- permission check;
- tenant check;
- activity event;
- audit log where sensitive;
- notification where operationally useful.

### 8.5 Activity Timeline

Problem:

The user needs trust and context, not only current field values.

Required outcome:

Every important CRM entity should have a useful timeline:

- created;
- assigned;
- status changed;
- stage moved;
- message received/sent;
- appointment booked/rescheduled/cancelled;
- task created/completed;
- AI recommendation generated;
- AI action approved/executed;
- integration event received;
- merge/archive/restore.

The timeline should be readable in the new entity workspace.

### 8.6 Notifications And Escalations

Problem:

Notifications can become noise if they do not match role, urgency and ownership.

Required outcome:

Notifications should be role-aware and action-oriented:

- operator gets assigned inbox/conversation/request items;
- manager gets team risks, overdue work and reassignment events;
- owner gets business risks, connector failures, high-priority escalations and billing/limits;
- staff gets appointments and tasks assigned to them;
- AI actions notify only when a human decision is needed.

Notification UI should show:

- what happened;
- what entity it belongs to;
- what action is expected;
- urgency;
- whether it is already resolved.

### 8.7 Dashboard As Daily Control Surface

Problem:

Dashboard must not be vanity metrics or decorative cards.

Required outcome:

Dashboard should answer:

- what requires attention today;
- new leads/requests;
- unanswered conversations;
- overdue tasks;
- upcoming appointments;
- stalled deals;
- connector problems;
- team workload;
- AI recommendations with sources;
- role-specific priorities.

Dashboard can remain generic for now. Vertical dashboards are a later layer.

### 8.8 Inbox To CRM Conversion

Problem:

For many SMBs, the real start of CRM work is a message, not a manually created lead.

Required outcome:

Inbox should make it easy to:

- view conversation;
- see client context;
- create or link client;
- create or link lead;
- create task;
- create appointment;
- create deal where relevant;
- assign conversation;
- handoff / stop bot;
- apply quick reply;
- review AI draft;
- see source and channel.

### 8.9 AI Must Stay Controlled

Problem:

AI can become decorative or unsafe if it is not tied to real data and permissions.

Required outcome:

AI surfaces should:

- cite real source entities/events;
- show no-data state when evidence is missing;
- respect user permissions;
- avoid critical mutations without confirmation;
- show provider unavailable state;
- write audit/activity for AI tool calls;
- never present deterministic local hints as AI.

### 8.10 Integrations Must Be Merchant-Friendly

Problem:

Integration screens can easily become developer consoles.

Required outcome:

Daily integration UI should show:

- connected / disconnected / degraded;
- last sync;
- failed sync reason in human language;
- retry action where safe;
- what CRM data is affected;
- setup progress;
- advanced technical details only behind admin/advanced surfaces.

## 9. Core Workflows That Must Feel Complete

### 9.1 Lead / Request Workflow

Required user path:

```text
lead created from source
-> duplicate/client context visible
-> responsible user assigned
-> next action set
-> user contacts client or creates appointment/deal/task
-> lead is converted, qualified, closed or lost with reason
-> timeline and audit are updated
```

Required UI:

- list/table with source, status, responsible, next action and last activity;
- selected lead inspector;
- full lead workspace;
- quick actions;
- explicit empty/error/forbidden states.

### 9.2 Client Workflow

Required user path:

```text
client opened
-> all related leads/deals/tasks/appointments/conversations visible
-> timeline visible
-> user can perform next action
-> duplicate/merge/archive flows are safe and traceable
```

Required UI:

- client list;
- full client workspace;
- timeline;
- related records;
- contact/source/consent context;
- notes and activity.

### 9.3 Deal Workflow

Required user path:

```text
deal created or linked
-> pipeline/stage visible
-> amount and owner visible
-> next action required
-> stage changes are controlled
-> won/lost/reopen use domain service
-> lost requires reason
-> timeline/value/stage history visible
```

Deals remain part of the shared core CRM. For dentistry, the target product mode should hide or de-emphasize Deals by default only after module capabilities are enforced in backend permissions/API behavior, navigation, dashboards, AI tools and search.

Required UI:

- pipeline board;
- list alternative;
- selected deal inspector;
- full deal workspace;
- stage totals;
- stale/no-next-action markers.

### 9.4 Task Workflow

Required user path:

```text
task created
-> assigned
-> due date and priority visible
-> user completes/cancels/snoozes/comments
-> linked entity is reachable
-> overdue tasks escalate or appear in priority queues
```

Required UI:

- My / Today / Overdue / Team / Watching / Done views;
- compact list/table;
- task inspector;
- linked entity context.

### 9.5 Appointment Workflow

Required user path:

```text
appointment created
-> service/resource/client/lead context set
-> working hours and overlap rules respected
-> responsible user/resource visible
-> appointment can be confirmed/rescheduled/cancelled/no-show/completed
-> reason required where needed
-> follow-up task can be created
```

Required UI:

- day/week/month/list views;
- appointment inspector;
- resource/service filters;
- full appointment context;
- clear lifecycle actions.

### 9.6 Conversation Workflow

Required user path:

```text
message arrives
-> conversation appears in inbox
-> operator sees context
-> bot/AI state visible
-> conversation can be assigned/handoffed/closed
-> client/lead/task/appointment/deal can be created or linked
```

Required UI:

- conversation queue;
- chat pane;
- right context panel;
- quick replies;
- AI draft/recommendation;
- CRM actions.

### 9.7 Automation Workflow

Required user path:

```text
rule exists
-> trigger/action readable
-> run visible
-> failed run understandable
-> retry/cancel where safe
-> domain services used for mutations
```

Required UI:

- active rules;
- recent runs;
- failed runs;
- human-readable reason;
- advanced payload hidden by default.

## 10. Role-Based Screen Map

The current product does not need vertical-specific mode first, but it does need role-aware work surfaces.

### 10.1 Owner / Director

Primary screens:

- Dashboard;
- Inbox overview;
- Leads;
- Clients;
- Deals;
- Calendar;
- Tasks;
- Analytics;
- Integrations;
- Automations;
- AI;
- Team/Settings;
- Billing.

Main jobs:

- understand business health;
- see missed opportunities and risks;
- manage team and roles;
- connect channels;
- review AI analyst output;
- control settings and billing.

Dashboard should emphasize:

- new leads/requests;
- unanswered conversations;
- overdue tasks;
- stalled deals;
- upcoming/cancelled/no-show appointments;
- connector health;
- team workload;
- AI recommendations with sources.

### 10.2 Manager / Team Lead

Primary screens:

- Team dashboard;
- team inbox/queue;
- leads;
- clients;
- deals;
- calendar;
- tasks;
- workload;
- analytics scoped to team.

Main jobs:

- distribute work;
- reassign requests/tasks/conversations;
- control SLA;
- monitor team load;
- handle escalations;
- coach operators/managers.

### 10.3 Sales Manager

Primary screens:

- My dashboard;
- my leads;
- my clients;
- my deals;
- my tasks;
- my calendar;
- assigned conversations.

Main jobs:

- process assigned leads;
- contact clients;
- move deals;
- create next tasks;
- book appointments where relevant;
- follow up.

### 10.4 Messenger Operator

Primary screens:

- Inbox;
- assigned conversations;
- unassigned queue where allowed;
- leads/requests;
- client lookup;
- tasks;
- calendar booking action where allowed.

Main jobs:

- answer incoming messages;
- use quick replies;
- create/link client and lead;
- create appointment/task/deal where relevant;
- escalate unclear cases;
- handoff/stop bot.

Hidden or limited by default:

- billing;
- broad analytics;
- role settings;
- integration secrets;
- advanced automation settings.

### 10.5 Staff / Specialist

Primary screens:

- My appointments;
- My tasks;
- limited client context;
- schedule.

Main jobs:

- see today's work;
- update visit/task outcome;
- complete assigned tasks;
- request follow-up where needed.

### 10.6 Marketer

Primary screens:

- campaigns/outreach if enabled;
- segments/tags where allowed;
- analytics;
- templates;
- integration status for marketing channels where allowed.

Main jobs:

- understand source/channel performance;
- manage campaigns safely;
- review audience and consent;
- avoid messaging users without allowed consent context.

### 10.7 Accountant

Primary screens:

- billing/finance surfaces where enabled;
- invoices/payment settings;
- limited analytics if granted.

Hidden or limited:

- inbox operations;
- CRM lifecycle mutations;
- AI mutating actions;
- integration secrets.

### 10.8 Support

Primary screens:

- only explicit support surfaces;
- no merchant data without grant;
- all support access audited.

## 11. Priority Roadmap

### Phase 1: Core CRM Workflow Audit

Goal:

Confirm exactly which core workflows are fully implemented, partially implemented or only backend-foundation.

Deliverables:

- route inventory for `/app`;
- backend endpoint/workflow inventory;
- page-to-backend coverage map;
- entity-to-related-entity map;
- list of missing user-facing actions;
- list of lifecycle actions that bypass services or lack activity/audit;
- list of missing loading/error/empty/forbidden states.

Acceptance:

- every primary CRM object has a mapped UI workflow;
- gaps are grouped by impact and dependency;
- no vertical-mode implementation is included in this phase.

### Phase 2: Core Logic Hardening

Goal:

Fix the highest-risk backend/frontend consistency gaps before the visual rebuild.

Priority areas:

- object-level permission checks for mutations;
- owner/responsible/assignee validation;
- lifecycle services/state transitions;
- lost/cancel/no-show reason enforcement;
- activity/audit events for critical changes;
- notification routing;
- task/appointment/deal/lead relationship consistency;
- AI confirmation and source-grounding gaps.

Acceptance:

- critical CRM actions are service-backed;
- tenant and permission checks are enforced server-side;
- important actions write activity/audit;
- frontend uses existing API clients, not raw calls.

### Phase 3: Entity Experience Foundation

Goal:

Create the product model that lets users understand a client/lead/deal/task/appointment/conversation without jumping across the app.

Deliverables:

- common entity header model;
- entity summary strip;
- related records panels;
- timeline model;
- action model;
- `Quick Inspector` requirements;
- `Full Entity Workspace` requirements.

Acceptance:

- client workspace can show leads, deals, tasks, appointments, conversations and timeline;
- lead/deal/task/appointment workspaces expose lifecycle actions;
- old drawer can be reduced or replaced progressively.

### Phase 4: App 2.0 UI/UX Redesign

Goal:

Execute `actual_docs/APP_UI_UX_REDESIGN_TASK.md`.

Deliverables:

- AppShell 2.0;
- WorkbenchLayout;
- PageHeader;
- shared toolbar/filter/saved views;
- shared states;
- QuickInspector;
- EntityWorkspace;
- redesigned core pages.

Page priority:

1. Dashboard;
2. Leads;
3. Clients;
4. Deals;
5. Tasks;
6. Calendar;
7. Conversations;
8. Integrations;
9. Automations;
10. AI Assistant / Analyst;
11. Analytics;
12. Settings.

Acceptance:

- app feels like one product;
- pages share one design language;
- no page looks like an isolated prototype;
- workflows stay connected to backend services;
- mobile is not a broken desktop copy.

### Phase 5: Role-Based Work Views

Goal:

Make the app useful for owner, manager, operator and staff without changing the whole product by vertical.

Deliverables:

- owner daily dashboard;
- manager team queue;
- operator inbox/request queue;
- staff appointment/task view;
- role-aware navigation and empty states;
- permission-aware analytics.

Acceptance:

- each role sees work that matches responsibility;
- forbidden actions are handled clearly;
- frontend hiding remains UX only, backend still enforces permissions.

### Phase 6: Dentistry-First Product Profile

Goal:

Adapt CRM presentation based on the business sphere selected during registration, starting with dentistry.

This phase is now required for the first launch vertical, but it must stay a configuration/product-profile layer over the shared CRM core.

Required concept:

```text
signup business_type
-> business profile / workflow mode
-> recommended defaults
-> labels
-> optional modules
-> dashboard preset
-> AI policy preset
```

Possible future behavior:

- dentistry may emphasize patients, appointments, services and doctors;
- beauty may emphasize bookings, masters, services and repeat visits;
- autoservice may emphasize vehicles, service orders and diagnostics;
- education may emphasize students, courses and trial lessons;
- sales-heavy businesses may emphasize deals and pipeline.

Important future rule:

Vertical mode should adapt presentation and defaults. It should not duplicate the CRM core or create separate models for every niche.

Do not implement dentistry mode as frontend-only hiding. Disabled modules must be respected by backend action availability, frontend navigation, dashboards, search, quick actions and AI tool suggestions.

## 12. Product Profile And Vertical Adaptation Layer

This section defines the vertical-mode product layer. It is immediate for dentistry and reusable later for other SMB verticals.

### 12.1 Why Vertical Adaptation Matters

During registration, the user already indicates the business sphere. That should help the app feel immediately relevant without creating separate CRM implementations.

Target behavior:

```text
business_type selected during signup
-> suggested workflow mode
-> recommended modules
-> default labels
-> dashboard preset
-> AI policy preset
-> automation templates
-> settings preset
```

This should be a presentation/configuration layer over the shared CRM core.

It should not create separate CRM implementations.

Good:

```text
Client model + label "Patient" for medical/dentistry
Lead model + label "Request"
Deal module still available, but optionally de-emphasized
Appointment-first dashboard preset
```

Bad:

```text
DentistryClient model
BeautyClient model
Separate CRM routes per industry
Hard-coded business_type checks scattered through components
```

### 12.2 Product Profile Concept

Implementation should add:

```text
BusinessProductProfile
- business
- preset_key
- workflow_mode
- enabled_modules_json
- labels_json
- default_dashboard
- ai_policy_json
- automation_policy_json
```

Possible workflow modes:

- generic_crm;
- appointment_first;
- pipeline_sales;
- service_order;
- reservation_first;
- course_enrollment.

This is required before ZANI can honestly launch a dentistry-specific workspace where Deals are disabled or de-emphasized by default.

### 12.3 Module Registry

Potential module keys:

- dashboard;
- inbox;
- requests;
- clients;
- deals;
- calendar;
- tasks;
- services;
- resources;
- working_hours;
- analytics;
- ai_assistant;
- automations;
- integrations;
- settings;
- billing;
- outreach;
- custom_fields;
- api_tokens;
- webhooks.

Required rule:

```text
visible = hasPermission(user, resource, action) && isModuleEnabled(business, module)
```

Until this rule exists across backend and frontend, module hiding should be treated as incomplete UX-only behavior.

### 12.4 Dentistry Mode

This is the first launch mode.

Possible dentistry workflow:

```text
messenger / bot
-> inbox conversation
-> request
-> patient
-> appointment
-> visit outcome
-> follow-up / recall
-> owner analytics
```

Possible future labels:

- Clients -> Patients;
- Leads -> Requests;
- Appointments -> Visits / Appointments;
- Resources -> Doctors / Rooms;
- Services -> Services;
- Deals -> Treatment Plans / Cases, if enabled.

Important current decision:

- make dentistry appointment-first by default;
- disable or de-emphasize Deals only through the module/profile layer;
- keep the underlying CRM core shared with generic/sales-heavy businesses.

### 12.5 Future Vertical Examples

Dentistry / medical:

- appointment-first;
- patients;
- services/doctors/resources;
- reminders;
- follow-up tasks;
- no-show/cancel analytics;
- treatment plans optional.

Beauty / salon:

- appointment-first;
- clients;
- masters/resources;
- services;
- repeat visit tasks;
- reviews/loyalty later.

Autoservice:

- service-order mode;
- clients;
- vehicles later;
- diagnostics;
- appointments/tasks;
- estimates/work orders later.

Education:

- trial lesson to enrollment;
- students;
- trial lessons;
- courses/groups later;
- tasks/reminders.

Sauna / reservation business:

- reservation-first;
- clients;
- calendar;
- rooms/halls/resources;
- prepayment reminders later.

Pipeline-sales business:

- pipeline-first;
- leads;
- clients;
- deals;
- tasks;
- forecasting;
- stale/no-next-action deals.

### 12.6 Vertical Backlog

Required dentistry-first tasks:

1. Add product profile or enabled modules layer.
2. Define module registry.
3. Add business-type presets.
4. Make backend action availability module-aware.
5. Make navigation, routing and search module-aware.
6. Make dashboards module-aware.
7. Make AI suggestions module-aware.
8. Make onboarding module-aware.
9. Add owner setting to turn optional modules on/off.
10. Add tests that disabled modules are hidden and blocked.
11. Add migration path for existing businesses.

Do not implement as:

- frontend-only hiding of Deals for dentistry;
- hard-coded business-type branches scattered through pages;
- blocking routes without clear UX/empty/upgrade states;
- changing all labels by niche before module capabilities exist;
- building separate pages per industry.

## 13. Technical Principles

### 13.1 Backend Remains Source Of Truth

Frontend can hide, simplify and guide, but backend must enforce:

- tenant isolation;
- permissions;
- object scope;
- lifecycle rules;
- required reasons;
- audit/activity;
- AI approval gates.

### 13.2 Domain Services Own Business Actions

Do not mutate critical CRM fields casually from views or React.

Critical fields include:

- lead status;
- deal stage/status;
- appointment status;
- task status;
- owner/responsible/assignee;
- archived/restored state;
- won/lost timestamps;
- cancelled/no-show reason.

### 13.3 Frontend Uses API Layer

No raw API calls in React components.

Use:

- `frontend/src/api/*`;
- typed hooks;
- shared mutation helpers where suitable;
- consistent query keys;
- explicit loading/error/empty/forbidden states.

### 13.4 UI Must Be Operational

Every authenticated UI block must serve one of these purposes:

- navigation;
- KPI / metric;
- real business data;
- action;
- form;
- table/list/entity card;
- chart/analytics;
- integration status;
- empty state with real next action;
- system notification or alert.

No decorative product marketing inside `/app`.

## 14. Risks To Avoid

### 14.1 Cosmetic Redesign Without Workflow Repair

Risk:

The app becomes visually cleaner but still requires users to jump between pages, drawers and modals to complete simple work.

Avoid by:

- building around user workflows;
- using entity workspaces;
- preserving action context;
- mapping every UI section to real backend data/action.

### 14.2 Frontend-Only Security

Risk:

Buttons are hidden, but APIs still allow unauthorized mutations.

Avoid by:

- backend permissions;
- object-scope checks;
- tenant-aware querysets;
- tests for denial and tenant isolation.

### 14.3 Unclear Ownership

Risk:

Leads, conversations, tasks or appointments exist but nobody is responsible.

Avoid by:

- explicit owner/responsible/assignee fields;
- queue semantics;
- dashboard and notification visibility for unassigned work.

### 14.4 Activity Timeline Gaps

Risk:

Users cannot understand why a record changed.

Avoid by:

- writing activity events for important changes;
- writing audit logs for sensitive/destructive changes;
- showing timeline in entity workspace.

### 14.5 AI Overreach

Risk:

AI suggests or performs actions without sources, permission or confirmation.

Avoid by:

- source chips;
- no-data fallback;
- provider failure state;
- explicit approval for critical mutations;
- audit trail.

### 14.6 Settings Becomes An Admin Maze

Risk:

SMB owners see too many technical controls.

Avoid by:

- grouping settings by merchant job;
- hiding advanced/provider/API payloads;
- moving operational tools to dedicated pages;
- preserving simple language.

### 14.7 Premature Verticalization

Risk:

The product spends time hiding/renaming modules before the core CRM and UI are strong.

Avoid by:

- keeping vertical adaptation as later phase;
- designing App 2.0 around reusable workbench/entity patterns;
- using one shared CRM core.

## 15. Core Acceptance Criteria

The current CRM core is ready for the full App 2.0 UI/UX redesign when:

- every primary route has a clear workflow purpose;
- every primary entity has a responsible/owner/assignee model or intentional queue state;
- every primary entity shows next action or explains why none exists;
- lifecycle actions go through backend services;
- tenant isolation and permission checks are server-side;
- critical actions write activity/audit;
- notifications are role-aware enough to avoid noise;
- AI recommendations cite sources or show no-data/provider states;
- dashboard shows action-oriented business state;
- entity drawer/workspace model is defined;
- frontend uses API clients and typed data;
- loading/error/empty/forbidden states exist for primary workflows;
- the UI/UX redesign can proceed without inventing fake data or fake workflows.

## 16. Recommended Immediate Task Order

### First

Keep source-of-truth docs and API contracts aligned with the current implementation:

- this technical map;
- `CRM_PRODUCTION_LAYER_PLAN.md`;
- `CRM_IMPLEMENTATION_TASKS.md`;
- `CRM_AUDIT_REQUIRED_CHANGES.md`;
- `API_ACTION_CONTRACT.md`.

Output:

- what is implemented and verified;
- what is closed historical checklist;
- what is active product/technical backlog;
- which endpoints/actions the frontend must use.

### Second

Run a core CRM workflow audit:

- leads;
- clients;
- deals;
- tasks;
- appointments;
- conversations;
- dashboard;
- AI;
- automations;
- integrations.

Output:

- what is fully usable;
- what has backend but weak UI;
- what has UI but weak backend enforcement;
- what lacks activity/audit/notification;
- what blocks App 2.0.

### Third

Fix highest-risk core logic gaps:

- object-scope permission mutations;
- lifecycle service consistency;
- activity/audit gaps;
- assignment/responsible-user gaps;
- notification routing gaps;
- no-data/forbidden states.

### Fourth

Implement App 2.0 foundation:

- AppShell;
- WorkbenchLayout;
- shared states;
- entity inspector/workspace;
- page rhythm.

### Fifth

Redesign core pages:

- Dashboard;
- Leads;
- Clients;
- Deals;
- Tasks;
- Calendar;
- Conversations.

### Sixth

Implement dentistry-first product profile:

- appointment-first dashboard/work queues;
- Deals disabled/de-emphasized by default through module capabilities;
- patients/requests labels where useful;
- calendar and inbox as primary work surfaces;
- owner setting to re-enable Deals if the clinic has treatment plans/cases;
- role-specific navigation for owner, manager, operator and doctor/resource-linked users.

### Seventh

Redesign control surfaces:

- Integrations;
- Automations;
- AI;
- Analytics;
- Settings.

### Later

Add more vertical business modes:

- business-type-driven presets;
- optional labels;
- optional module recommendations;
- vertical dashboards;
- vertical AI policies.

## 17. Final Direction

For the current stage, ZANI should keep one shared CRM core and launch with a dentistry-first product profile.

It should become a high-quality SMB CRM where:

- every record has context;
- every user understands their work;
- every action has a clear next step;
- every critical mutation is safe;
- every page is connected to real backend functionality;
- the interface feels unified, light, premium and fast.

Vertical adaptation is now a product-profile layer:

```text
business sphere selected at registration
-> CRM adapts labels, defaults, modules and dashboards
```

The main work is:

```text
core CRM logic + workflow completeness
-> unified App 2.0 UI/UX
-> dentistry-first product profile
-> future vertical adaptation for other SMB niches
```
