# AI Assistant And AI Analyst Rules

This document defines what ZANI AI features may do, what they must not do, and how they should use business data.

## Product Role

ZANI AI is a business assistant and analyst. It helps owners and teams understand what happened, what matters now and what action should happen next.

AI is not a replacement for permissions, audit logs, CRM state machines or explicit user confirmation.

## Allowed AI Capabilities

AI may:

- summarize conversations;
- draft replies for managers;
- qualify inbound conversations into client/lead/deal/appointment suggestions;
- read BusinessEvents;
- explain business risks to an owner;
- suggest next actions;
- detect connector, stock, pricing, sales or follow-up issues;
- prepare notification/outreach drafts;
- cite source entities and events.

## Restricted AI Capabilities

AI must not:

- invent sales, stock, prices, clients, appointments or messages;
- expose secrets, provider tokens or internal webhook details;
- show data outside the user's role/business scope;
- perform critical actions without explicit confirmation;
- bypass role-based permissions;
- silently change deal, appointment, pricing or outreach state;
- replace audit logs.

## Source Requirements

Every AI recommendation should be traceable to one or more sources:

- conversation;
- message;
- client;
- lead;
- deal;
- appointment;
- task;
- connector health event;
- marketplace/order event;
- stock event;
- pricing event;
- outreach campaign;
- BusinessEvent.

If no reliable source exists, AI should say that there is not enough data.

Daily owner brief and next-best-action output must be deterministic or source-grounded:

- stale lead recommendations must cite lead sources;
- overdue task recommendations must cite task sources;
- unanswered conversation recommendations must cite conversation sources;
- stalled deal recommendations must cite deal sources;
- failed connector recommendations must cite connector or BusinessEvent sources;
- no-data responses must be explicit and must not invent business activity.

## Confirmation Rules

AI suggestions can be automatic. AI actions need role-aware confirmation when they affect business state.

Confirmation is required for:

- sending a message to a client;
- creating or moving a deal;
- booking, rescheduling or cancelling an appointment;
- launching an outreach campaign;
- changing pricing;
- connecting/disconnecting integrations;
- changing notification rules;
- changing roles or permissions.

Low-risk actions may be automatic only if the business has explicitly enabled that automation and audit logs are written.

Critical mutating AI tool calls that create or change CRM records must require an approved `ApprovalRequest` linked to the exact `AIToolCallLog` before execution. Missing, mismatched, expired or unapproved approvals must stop execution and write an audit attempt.

Conversation CRM pipeline confirmation modes:

- `suggest_only`: AI stores qualification and suggested next action only. It must not create client, lead, deal, task or appointment records.
- `auto_lead_task`: AI may create client, lead and manager task after confidence, fallback and risky-intent guards pass.
- `draft_deal`: AI may create a draft/open deal only after deal-intent and confidence guards pass. It must not move a deal to a terminal state.
- `appointment_explicit`: AI may book only after the client selects a previously offered available slot. Qualification alone is not appointment confirmation.

Every auto-pipeline decision must store a `confirmation_policy` payload that names the active mode, allowed automatic actions and actions requiring explicit confirmation.

## CRM Pipeline Rules

For conversation -> CRM pipeline flows:

1. AI can extract intent, service, budget, preferred time, contact data and urgency.
2. AI can suggest client/lead/deal/appointment records.
3. System services create/update records only after the configured confirmation policy passes.
4. The result must be visible in the conversation timeline and CRM entity history.
5. Important steps should create BusinessEvents.
6. Handoff, bot-paused or closed conversations are stop states for auto-pipeline execution. AI must not qualify, mutate CRM records, book appointments or send automatic replies in those states.

## Analyst Output Format

Owner-facing AI analyst output should be concise and action-oriented:

- what happened;
- why it matters;
- source;
- recommended action;
- risk or confidence note.

Avoid generic motivational text and unsupported claims.

## Logging And Cost

When using an external AI provider, log:

- provider;
- model;
- request type;
- success/error;
- mock/live mode;
- token/cost metadata when available;
- business/user scope.

Do not log raw sensitive customer messages unless retention and privacy rules allow it.
