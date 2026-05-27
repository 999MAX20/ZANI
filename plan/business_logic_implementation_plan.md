# ZANI Business Logic Implementation Plan

Last updated: 2026-05-27

## Purpose

This document defines the core dynamic CRM business scenarios that must be implemented before production. It focuses on real workflows, not page visuals.

Primary goal:

```text
Inbound events, conversations, leads, deals, appointments, tasks, integrations, and AI recommendations must work as one connected business system.
```

## Implementation Principles

- Build scenarios as backend workflows first, then expose them in UI.
- Keep every automated action auditable.
- Prefer explicit confirmation when AI confidence is low or the action changes business state.
- Do not let AI silently mutate CRM records without logging source context, confidence, and result.
- Reuse existing models and APIs where possible:
  - `BotConversation`
  - `BotMessage`
  - `Client`
  - `Lead`
  - `Deal`
  - `Appointment`
  - `Task`
  - `AutomationRule`
  - `IntegrationEventLog`
  - `AIRequestLog`
  - `AIToolCallLog`
- Every core scenario needs backend tests and at least one frontend E2E test.

## Target Core Scenarios

### 1. Conversation To Lead

Status: `Partially Implemented`

Current state:

- Website chat can create `Client` and `Lead` when phone/email is provided.
- Telegram and WhatsApp webhooks can create `BotConversation` and `BotMessage`.
- Inbox has manual action to create lead from conversation.
- Instagram provider is currently placeholder-level.

Target workflow:

```text
Instagram / WhatsApp / Telegram / Website message
→ normalize inbound event
→ create or update conversation
→ identify or create client
→ extract lead intent and contact data
→ create or update lead
→ link conversation, client, and lead
→ assign owner or queue
→ create next action
→ write audit/activity events
```

Backend tasks:

- Create a shared inbound workflow service:

```text
apps/bots/business_workflows.py
```

Suggested service API:

```python
process_inbound_message(conversation, message, *, source_event=None)
```

- Add normalized extraction result object:

```text
client_name
phone
email
channel_user_id
intent
service_name
preferred_time
urgency
confidence
missing_fields
```

- Add deterministic client matching:
  - phone;
  - email;
  - channel + external user id;
  - fallback to conversation identity.
- Add lead creation/update rules:
  - create only one active lead per client/channel unless business rule allows duplicates;
  - append new message/context to existing active lead;
  - do not overwrite manually edited fields without audit.
- Add source mapping:
  - website;
  - telegram;
  - whatsapp;
  - instagram;
  - kaspi;
  - manual;
  - parser;
  - other.
- Add audit/activity event:

```text
conversation_processed
client_created_from_conversation
lead_created_from_conversation
lead_updated_from_conversation
```

UI tasks:

- In Conversations, show whether conversation is:
  - not linked;
  - linked to client;
  - linked to lead;
  - auto-created by bot;
  - needs confirmation.
- In Leads, show origin conversation and extracted fields.

Tests:

- Telegram inbound creates conversation and lead when contact data exists.
- WhatsApp inbound updates existing client by phone.
- Website chat does not create duplicate lead for same active client.
- Low-confidence extraction creates suggested action, not silent lead mutation.
- Manual lead creation still works.

Production acceptance:

- A new inbound message can become a linked client + lead without manual UI work when required data is present and confidence is high.

---

### 2. Lead Qualification

Status: `Partially Implemented`

Current state:

- Leads have statuses and responsible user.
- Leads page has a qualification queue UI.
- AI can suggest responses, but does not yet produce structured qualification.

Target workflow:

```text
Lead created
→ collect missing fields
→ classify intent
→ score lead quality
→ assign responsible manager
→ require next action
→ move lead through statuses
```

Backend tasks:

- Add qualification service:

```text
apps/leads/qualification_service.py
```

- Define qualification fields:
  - intent;
  - service/product interest;
  - budget if relevant;
  - preferred time;
  - urgency;
  - contact completeness;
  - source quality;
  - AI confidence;
  - missing fields.
- Add lead score:

```text
cold
warm
hot
invalid
```

- Add next action requirement for active leads:
  - title;
  - due_at;
  - owner.
- Add lost reason model or structured lost reason choices.
- Add no-response/SLA rules:
  - first response overdue;
  - no next action;
  - stale lead.

UI tasks:

- Add qualification summary to lead work panel.
- Add missing-fields block.
- Replace browser prompt for lost reason with project-styled modal.
- Add specific teammate assignment.
- Add next-action editor.
- Add duplicate/merge entry point.

Tests:

- Lead cannot move into active status without next action.
- Lead can be marked lost only with reason.
- Lead SLA state is calculated correctly.
- Duplicate check catches phone/email duplicates.

Production acceptance:

- Every active lead has an owner, status, next action, and clear qualification state.

---

### 3. Lead To Deal

Status: `Partially Implemented`

Current state:

- Deals exist.
- Deals can be created from inbox.
- Leads can create deals via API.
- Deals page still needs reform.

Target workflow:

```text
Qualified lead
→ create deal
→ attach client and lead
→ choose pipeline/stage
→ set amount/probability/source/owner
→ require next action
→ track stage movement
→ win/loss with reason
```

Backend tasks:

- Add deal creation rules from lead:
  - prevent duplicate open deal for same lead unless confirmed;
  - inherit source, owner, client, service/product interest;
  - create first next action.
- Add required next action for open deals.
- Add stale deal rules based on:
  - last activity;
  - missing next action;
  - stage age.
- Add structured won/lost flow:
  - won_at;
  - lost_at;
  - lost_reason;
  - close_note.

UI tasks:

- Reform Deals into focused pipeline:
  - left/pipeline board;
  - right selected deal panel;
  - next action;
  - client context;
  - linked conversations;
  - activity history.
- Add create deal from selected lead without losing context.
- Add won/lost modal.

Tests:

- Create deal from lead links client and lead.
- Moving stage persists.
- Open deal without next action is flagged.
- Lost deal requires reason.
- Won deal writes activity event.

Production acceptance:

- A qualified lead can become a managed deal with stage, owner, next action, and close outcome.

---

### 4. Lead Or Deal To Appointment

Status: `Partially Implemented`

Current state:

- Appointment model exists.
- `create_appointment_from_lead` exists.
- Availability validation exists.
- Leads UI can create appointment.

Target workflow:

```text
Client wants booking
→ identify service/resource
→ parse or choose preferred time
→ check availability
→ propose available slots
→ confirm with client
→ create appointment
→ update lead/deal status
→ create reminder
→ calendar shows visit state
```

Backend tasks:

- Add booking intent extraction from conversation/lead.
- Add slot suggestion service:

```text
apps/scheduling/slot_suggestion_service.py
```

- Add appointment proposal state:
  - proposed slots;
  - selected slot;
  - confirmation status;
  - source conversation/message.
- Add deal appointment linking if deal exists.
- Add appointment lifecycle:
  - created;
  - confirmed;
  - completed;
  - no_show;
  - cancelled;
  - rescheduled.
- Add visit result required for past appointments:
  - came;
  - no show;
  - rescheduled;
  - cancelled.

UI tasks:

- Add slot picker in Conversations and Leads.
- Add calendar state badges.
- Add quick actions:
  - confirm visit;
  - no show;
  - reschedule;
  - cancel.
- Show linked appointment in lead/deal/client panels.

Tests:

- Busy slot is rejected.
- Appointment creation updates lead status.
- Reminder notification is created.
- Appointment cannot be completed/no-show before start time unless role allows override.
- Reschedule keeps history.

Production acceptance:

- A manager or bot-assisted flow can turn client intent into a calendar appointment with validated availability and visit status.

---

### 5. Task And Follow-Up Engine

Status: `Partially Implemented`

Current state:

- Tasks exist.
- Inbox can create tasks.
- Automations can create tasks and notifications.

Target workflow:

```text
Any CRM object needs next action
→ create task/follow-up
→ assign owner
→ set due time/reminder
→ show overdue state
→ complete or reschedule
→ write activity event
```

Backend tasks:

- Standardize next action across:
  - lead;
  - deal;
  - conversation;
  - appointment;
  - client.
- Add follow-up rules:
  - no response after N minutes;
  - appointment tomorrow;
  - deal stale;
  - client inactive;
  - order issue.
- Add recurring follow-up support if needed.
- Add notification/reminder guarantees.

UI tasks:

- Reform Tasks page into action queue.
- Add “next action” controls inside lead/deal/conversation panels.
- Add overdue and today queues.

Tests:

- Task creation links related entity.
- Overdue calculation works.
- Completing task writes activity.
- Follow-up automation creates one task, not duplicates.

Production acceptance:

- Managers can trust ZANI to show what must be done next across the CRM.

---

### 6. Integration Event To CRM Action

Status: `Needs Work`

Current state:

- Integration event logs exist.
- Connector cards and logs are visible.
- Telegram/WhatsApp inbound message ingestion exists.
- Kaspi/1C/stock flows are not production-grade yet.

Target workflow:

```text
Integration emits event
→ normalize event
→ match business entity
→ create/update CRM object
→ detect conflict or missing data
→ create task or alert when needed
→ show event and resolution status
```

Priority event types:

- message received;
- order created;
- order paid;
- order cancelled;
- stock low;
- product not found;
- sync failed;
- credential expired;
- payment received;
- delivery issue.

Backend tasks:

- Create event normalization service:

```text
apps/integrations/event_router.py
```

- Add event idempotency.
- Add entity matching:
  - client by phone/email/channel id;
  - order by external id;
  - product by SKU/vendor code;
  - lead/deal by client and active state.
- Add resolution states:
  - processed;
  - ignored;
  - needs_review;
  - failed;
  - retried;
  - resolved.
- Add CRM actions:
  - create client;
  - create lead;
  - create deal/order record;
  - create task;
  - update stock status;
  - notify owner.

UI tasks:

- In Integrations, show event queue by resolution state.
- Add actions:
  - retry;
  - link entity;
  - ignore;
  - resolve;
  - create task.
- Show integration-origin events in client/lead/deal timeline.

Tests:

- Duplicate integration event does not create duplicate CRM record.
- Failed event can be retried.
- Missing product creates review task.
- Credential failure appears as connector health issue.

Production acceptance:

- External systems can change CRM state through controlled, logged, idempotent events.

---

### 7. AI Analyst To Confirmed Action

Status: `Needs Work`

Current state:

- AI Assistant exists.
- AI reply drafts work through OpenRouter.
- AI tool registry exists, but it is not yet a grounded business analyst workflow.

Target workflow:

```text
AI scans CRM/integration data
→ detects risk or opportunity
→ cites source records
→ proposes action
→ user confirms
→ CRM executes action
→ action is logged
```

Example insights:

- Hot leads without response.
- Deals without next action.
- Conversations requiring handoff.
- Appointments likely to no-show.
- Integration sync failures.
- Kaspi order blocked by stock issue.
- Low conversion source.

Backend tasks:

- Add analyst context service:

```text
apps/ai_core/analyst_context.py
```

- Add analyst insight model or persisted insight records:
  - type;
  - severity;
  - title;
  - source records;
  - recommendation;
  - confidence;
  - status.
- Add confirmable action executor:
  - create task;
  - assign lead;
  - create follow-up;
  - mark integration event for retry;
  - create notification;
  - draft message.
- Require source citations for every insight.
- Log:
  - prompt version;
  - model;
  - input record ids;
  - output;
  - confirmed action;
  - user.

UI tasks:

- Reform AI Assistant into AI Analyst.
- Show insight queue, not generic chat first.
- Add action buttons:
  - create task;
  - assign;
  - draft reply;
  - open record;
  - dismiss.
- Show source records inline.

Tests:

- Analyst does not cite records outside tenant.
- Insight creation is grounded in actual data.
- Confirmed action creates expected CRM object.
- Dismissed insight is not repeatedly shown.

Production acceptance:

- AI helps owner/operator make decisions using CRM data and never performs hidden mutations.

---

### 8. Retention And Repeat Sales

Status: `Needs Work`

Current state:

- Clients, appointments, tasks, analytics exist separately.
- No complete retention workflow yet.

Target workflow:

```text
Client completed visit/order
→ schedule follow-up
→ recommend repeat service/product
→ send or draft message
→ create new lead/deal/appointment if interested
```

Backend tasks:

- Add lifecycle triggers:
  - appointment completed;
  - order completed;
  - client inactive;
  - birthday/date event if available.
- Add retention task templates.
- Add repeat service interval rules.

UI tasks:

- Add retention queue to Tasks or Clients.
- Add client profile summary:
  - last visit;
  - last order;
  - next recommended action;
  - lifetime value estimate.

Tests:

- Completed appointment creates follow-up when rule enabled.
- Repeat follow-up does not duplicate.
- Client inactive trigger works.

Production acceptance:

- CRM supports not only first sale, but repeat business.

## Recommended Implementation Order

### Phase 1 - Core Flow Foundation

1. Create shared inbound workflow service.
2. Implement Conversation To Lead for website, Telegram, WhatsApp.
3. Add structured lead qualification fields and next action.
4. Add teammate assignment and duplicate/merge basics.
5. Add backend tests for inbound lead creation.

### Phase 2 - Sales And Booking

1. Reform Deals logic and UI.
2. Implement Lead To Deal rules.
3. Add appointment proposal/confirmation workflow.
4. Add calendar visit state.
5. Add E2E tests for lead -> deal -> appointment.

### Phase 3 - Task Engine And Reliability

1. Standardize next action across CRM objects.
2. Reform Tasks page.
3. Add follow-up automations.
4. Add SLA/no-response timers.
5. Add overdue/attention dashboard signals.

### Phase 4 - Integration Event Router

1. Implement integration event normalization.
2. Add idempotency and entity matching.
3. Implement event resolution workflow.
4. Add Kaspi/1C/stock event mapping.
5. Add retry/reconnect/resolve UI.

### Phase 5 - AI Analyst

1. Build grounded analyst context.
2. Persist insight records.
3. Add source citations.
4. Add confirmed action executor.
5. Replace generic AI Assistant first screen with AI Analyst queue.

### Phase 6 - Retention

1. Add completed appointment/order lifecycle triggers.
2. Add retention follow-up tasks.
3. Add repeat sale recommendations.
4. Add client profile retention panel.

## Minimal Production Checklist

Before production, these checks must pass:

- Inbound message can create/update conversation, client, and lead.
- Active lead requires owner and next action.
- Lead can become deal without losing source/client/conversation context.
- Lead/deal can become appointment with availability validation.
- Calendar supports visit outcome.
- Tasks show overdue and next actions reliably.
- Integration event processing is idempotent.
- AI actions are confirmable and auditable.
- Every core mutation writes activity/audit log.
- Tenant isolation tests cover every scenario.
- E2E tests cover:
  - conversation to lead;
  - lead qualification;
  - lead to deal;
  - lead to appointment;
  - task follow-up;
  - integration event resolution;
  - AI analyst confirmed action.
