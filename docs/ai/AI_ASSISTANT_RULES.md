# AI Assistant And AI Analyst Rules

V1-M01/M02 (2026-09-22): BusinessEvent Analyst is operational only. Generic sale
events, service/deal values and manual payments do not certify receipts/refunds.
Its event payload excludes financial fields and its source policy forbids
financial conclusions from those events. Finance must use the
[verified source contract](../integrations/financial-source-contract.md), including
permissions, period, no-data and stale-snapshot boundaries. This package adds
neither a financial AI report nor live provider calls.

This document defines what ZANI AI features may do, what they must not do, and how they should use business data.

## V1 action confirmation — implementation candidate, 2026-09-22

Legacy `auto_lead_task`, `draft_deal`, `appointment_explicit` and mode-based
settings now propose CRM work. The automatic conversation pipeline may associate
or create a client; it cannot create a Lead, Task or Deal. Website chat contact
capture follows the same boundary, including when phone/email is supplied.
The separate website lead form is outside this change.

Inbox qualification is a read-only preview. The operator reviews its summary,
selects individual lead/task/draft-deal actions and confirms them. `run-pipeline`
requires `confirmed_actions` matching the requested creation flags and, when AI
qualification is used, `preview_id` equal to the reviewed `qualified_at` value.
Missing, replaced or stale previews cannot execute. The domain service rechecks
the preview after locking the conversation, enforces actor and underlying
permissions, and reuses previously linked results on replay. Existing assistant
tool approvals remain a separate supported path with their existing audit rules.

Appointment creation/rescheduling/cancellation and deal outcomes remain staff
actions. Auto replies are independent of CRM writes and retain pause/handoff
and fallback checks. No live provider or billing behavior is accepted here.
Exact verification/publication: [primary checkpoint](../testing/task-state/PRIMARY-SESSION.md).

## Approved V1 policy — 2026-09-16

[Owner-approved V1 rules](../product/V1_PRODUCT_RULES.md), section 6, control
first-release behavior where the historical contracts below differ. Automatic
client dialogue and automatic creation of a new client card from an incoming
contact are allowed within the approved scope. AI-created leads, tasks and
draft deals require confirmation of the particular action by an authorized
operator. Booking, rescheduling/cancellation and deal-result changes are
suggestions only: a staff member performs the actual action.

This is a target policy, not proof of implementation or authority to change code.
Legacy pipeline modes must be checked for gaps; none may silently bypass this
matrix. Employee assistant, customer bot and owner analyst are all required V1
features. Ordinary CRM work continues without AI. Separate AI request pricing
has no monetary spending ceiling; see V1 section 8 for the final owner correction.

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

Outside the explicitly approved V1 automatic dialogue/client-intake exceptions,
confirmation is required for the actions below. For V1 booking, rescheduling,
cancellation and deal-result changes, the stricter suggestion-only rule above
applies: approval does not authorize an AI tool to execute them.

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

Approval creation is not a decision. New `ApprovalRequest` records must always start as `pending`; `approved`, `rejected`, `expired` and `executed` states are server-side transitions only. Even after a matching approval is present, mutating AI tools must still pass the user's underlying CRM permission such as `clients:create`, `leads:create`, `tasks:create` or `deals:create`.

Historical conversation CRM pipeline modes (implementation inventory, not V1
authorization). The auto-create/booking behavior described below is superseded
as a target by the approved V1 matrix. Do not present these modes as accepted
V1 behavior until an exact-version implementation check confirms compliance:

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
7. Agent pause/draft or missing active profile/business knowledge blocks autonomous
   AI, not incoming transport. An explicitly active channel must still deliver
   authenticated messages to Inbox and permit authorized manager replies.
   Channel disablement is a separate operation. Recheck persisted eligibility
   after provider work and at outbox delivery; do not send an old queued bot reply
   merely because the agent was ready when it was created. An already dispatched
   provider request cannot be recalled by this local check.

Website contact capture and explicit client appointment confirmations are not
AI qualification; disabling autonomous AI must not silently disable those
existing deterministic CRM flows. Manually invoked drafts and approved AI tools
continue to use their existing permissions and confirmation gates.

## Analyst Output Format

Owner-facing AI analyst output should be concise and action-oriented:

- what happened;
- why it matters;
- source;
- recommended action;
- risk or confidence note.

Avoid generic motivational text and unsupported claims.

Authenticated CRM UI must not label deterministic local guidance as an AI insight. If a card is produced from local counts, entity presence or simple status checks, label it as a CRM hint, next step or operational recommendation. Use AI labels and AI visual treatment only when the output comes from an AI/backend recommendation path with permission-scoped source data or an explicit no-data/provider-unavailable state.

Dashboard and assistant AI surfaces must expose source IDs or source chips for source-backed recommendations. When the backend AI brief is unavailable, forbidden by role, still loading, missing source data or backed by an unready provider, the UI must show that state directly instead of substituting confident local advice.

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
