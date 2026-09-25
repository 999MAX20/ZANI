# AI Assistant And AI Analyst Rules

> **Later commercial decision, 2026-09-25:**
> [CRM packages include AI volume; billing work deferred](../billing/BILLING_DISCUSSION_DEFERRED_2026-09-25.md).
> This supersedes separate-AI/PAYG/no-package wording below. The client bot's unit
> is a completed dialogue with one client in one day; formal boundaries remain open.
> AI exhaustion pauses AI, not paid manual CRM. Assistant/analyst limits are open;
> grounding, staff approval, error/retry principles and historical evidence remain.

V1-M01/M02 (2026-09-22): BusinessEvent Analyst is operational only. Generic sale
events, service/deal values and manual payments do not certify receipts/refunds.
Its event payload excludes financial fields and its source policy forbids
financial conclusions from those events. Finance must use the
[verified source contract](../integrations/financial-source-contract.md), including
permissions, period, no-data and stale-snapshot boundaries. This package adds
neither a financial AI report nor live provider calls.

This document defines what ZANI AI features may do, what they must not do, and how they should use business data.

## Simplified agent setup — 2026-09-24

The agent page reuses profiles, knowledge and lifecycle actions in the order
profile → knowledge → behavior → channels → test. New drafts have a dental
receptionist preset; existing profiles are preserved unless the operator applies
the preset. Language, tone, instructions, behavior, model and temperature share
the editor save/unsaved-change guard. Advanced instructions/model/temperature
are optional. Live Inbox remains accessible through Open messages.

`POST /api/bots/{id}/preview/` rehearses up to 16 messages, 2000 characters each,
using the saved profile and shared qualification/reply/scheduling services.
It requires `ai_automation:manage` and `ai_assistant:suggest`, tenant-scoped bot
access and an active saved profile. Draft/paused agents need no channel to test.
The rehearsal is hypothetical: it bypasses launch prerequisites only for the
preview, never changes bot status and does not execute the automatic pipeline.
It creates no clients, CRM work, Inbox messages, events or notifications. AI logs
(`is_preview`) and ordinary AI request usage are recorded; a normal response
uses qualification + reply calls, a handoff uses qualification only. Channel
overrides are not part of the agent-level rehearsal. Mock mode is explicit;
provider failures return the existing safe error and preserve the typed message.

Readiness still requires a profile, active knowledge and active channel to
activate. A successful preview is not proof of channel delivery. Context includes
the business currency, timezone and current local date; the saved RU/KK/EN reply
language is a system constraint. Source badges identify supplied CRM/knowledge
context, not a guarantee that every generated sentence is accurate. Booking,
rescheduling, cancellation and deal outcomes remain staff actions.

Verification and publication status: [primary checkpoint](../testing/task-state/PRIMARY-SESSION.md).

## V1 action confirmation — locally verified, 2026-09-22

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

The target [subscription access policy](../billing/entitlements.md#commercial-decisions-20260925)
also applies: READ_ONLY allows technical inbound persistence but no CRM sales
pipeline, outgoing client messages, new paid AI calls or business automations.
Rules below for staff replies/drafts assume subscription access permits the
action. This 2026-09-25 requirement does not claim that the existing pipeline
already implements every subscription transition or unknown-sender mapping.

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

<a id="ai-billable-operation-20260925"></a>

### Logical AI action and charge — owner decision 2026-09-25

**Decision:** the customer billing unit is one completed useful user AI action,
not a message, token, internal LLM call or a whole conversation by assumption.
Examples are a bot reply, an assistant-produced answer/summary/draft, or an
analyst's analysis. Several model/tool calls within that operation do not create
several customer charges. Producing a draft does not authorize its CRM execution:
the staff-confirmation and staff-only action matrix remains unchanged.

Store provider cost separately from customer charge. Keep necessary organization/
operation identifiers, feature, model, input/output tokens, tool usage, provider
cost, status and billable classification with protected data and scoped access.
Use minimal necessary identifiers; no secrets or unnecessary patient/message
contents. Provider costs for attempts are retained even when customer charge is
zero. Logging costs/usage does not establish a wallet, money deduction or billing
acceptance; existing per-request counters are not automatically billable actions.

Errors are not billable. Automatic retry and webhook replay are not new actions;
record attempts and charge idempotently by logical operation. `org + event +
operation` is an illustrative identity, not a universal key for manual actions.
Keep a verifiable charge history and the version of price/operation weight that
applied, rather than silently recalculating historical charges at a later tariff.

**Proposals/conflict:** different operation weights (such as 1/5/10), uniform
pilot weight 1 and prices are not approved. Proposed action packages conflict
with the last explicit PAYG/no-ceiling/no-hard-package decision; preserve PAYG
and request a separate decision if packages are pursued. No technical security
or abuse guard is removed by this commercial policy.

**Open success boundaries:** generated-but-undelivered output, rejected suggestions,
invalid output, user/client retries, work crossing subscription expiration and
long-running analyses. Do not silently classify all of these as billable success
or promise semantic correctness. The principle "errors are not billed" is fixed;
the operation's exact success/charge transition still requires its contract.

[Subscription access](../billing/entitlements.md#commercial-decisions-20260925)
pauses new paid AI calls in READ_ONLY while preserving technical inbound storage.
GRACE keeps ordinary access and separate AI accounting; separate AI-debt and
in-flight restoration details remain open. This documentation does not change
the existing model calls, counters, prices, permissions or approved evidence.

## V1 quality contract — 2026-09-22

Staff chat/daily summary builds CRM context on the server with Business and role
scoping. The browser does not supply authoritative facts. Current totals are
separate from dates; up to eight records per category are samples, not complete
history. Structured answers must cite only supplied source IDs or explicitly
return no-data. A single JSON code fence is tolerated; unknown/mixed citations
or malformed output are rejected. This validates provenance identifiers, not
the semantic truth of every generated sentence.

The event analyst uses permitted BusinessEvents, returns no-data without a paid
call when sources are absent, rejects malformed/invented sources and uses
server-owned navigation. It cannot infer verified financial results from events.
Missing credentials, disabled AI and provider failures are unavailable states;
only an explicitly selected mock provider returns mock-labelled output.
Provider bodies, credentials and raw exception tracebacks are excluded from
user errors. Transient failures use the existing bounded job retry policy;
permanent rejection/invalid structured output stops retrying. Jobs are visible
only to their requester, whose permissions/context are checked again on execution.
The UI polls queued responses, preserves a pending job for a later retry and
exposes a recoverable error instead of an obsolete answer.

Bot replies use the active profile, validated model and finite temperature 0–1.
An empty model selection inherits environment configuration. Known OpenAI model
aliases are normalized for OpenRouter. Knowledge retrieval ranks up to 500 active
business entries and supplies at most eight; this is bounded lexical retrieval,
not full-corpus RAG. Scheduling uses active specialists and existing availability,
working-hours, overlap and absence rules. The latest inbound request takes priority;
name inflection matching is conservative and ambiguous cases need clarification.
Only today/tomorrow/day-after-tomorrow keywords have explicit date handling here.
Prices marked price_from are minimum prices. Replies must not claim a booking,
transfer or cancellation has been executed; staff confirmation rules remain.

Complaints, human-review requests and AI failures hand off through the existing
conversation service with internal notifications and audit/activity. Incoming
messages are preserved; no Lead/Task/Deal/appointment is created by this handoff.
Pause/handoff/readiness checks still stop autonomous AI. This adds no spam archive
policy or external notification campaign.

Evidence and remaining acceptance boundaries belong to
[the active checkpoint](../testing/task-state/PRIMARY-SESSION.md). Synthetic live
OpenRouter tests do not prove channel delivery, production workers, universal
answer accuracy or billing. The agent setup-page redesign remains separate.
