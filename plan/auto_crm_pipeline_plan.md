# Auto CRM Pipeline Plan

## Goal

Implement a controlled automatic mode for the existing AI-qualified CRM pipeline:

```text
channel webhook -> BotConversation/BotMessage -> AI qualification -> guarded CRM actions
```

The first production-safe version must automate only low-risk business actions. It must not silently send AI replies, book appointments, close deals, merge duplicates, reserve stock, or change payments.

## Current State

Implemented:

- Manual `CRM pipeline` action exists in Conversations.
- Backend service `run_conversation_pipeline` can create/reuse:
  - client;
  - lead;
  - deal;
  - next task.
- AI qualification runs before pipeline execution.
- Qualification returns intent, confidence, summary, service, preferred time, urgency, next action, and action flags.
- Pipeline stores qualification and `ai_log_id` in `conversation.metadata_json`.
- Pipeline is idempotent for repeated manual runs.
- Guarded auto runner exists in `apps/conversations/auto_pipeline.py`.
- Auto settings can be read from `Bot.settings_json.auto_crm_pipeline` and overridden by `BotChannel.config_json.auto_crm_pipeline`.
- Inbound Telegram, WhatsApp, and Website Chat now call the guarded runner after message registration.
- `lead_task` mode is implemented and covered by backend tests.
- Auto decisions are saved in `conversation.metadata_json.auto_crm_pipeline` and written as activity events.

Not implemented yet:

- Duplicate conflict handling for auto mode.
- Manager approval queue for low-confidence or risky actions.
- Appointment proposal/booking.
- UI for reviewing automatic decisions.
- Settings UI for enabling auto mode.

## Auto Mode Levels

### Level 0 - Off

Default for every bot/channel.

Behavior:

- webhook creates conversation and message only;
- manager manually clicks `CRM pipeline`.

### Level 1 - Auto Triage

Safe first auto mode.

Behavior:

- webhook creates conversation and message;
- AI qualification runs automatically;
- result is saved to `conversation.metadata_json`;
- no CRM entities are created.

Use when:

- business wants visibility into AI intent/confidence without automatic mutations.

### Level 2 - Auto Client + Lead + Task

Recommended first production automation.

Behavior:

- create/reuse client;
- create lead when qualification allows;
- create next task for manager;
- do not create deal unless Level 3 conditions pass;
- do not create appointment.

Allowed when:

- `confidence >= 0.70`;
- `intent` is not spam/complaint/support-only;
- no duplicate conflict;
- `requires_human_review = false` or only low-impact task is created.

### Level 3 - Auto Draft Deal

Commercial automation with guards.

Behavior:

- create/reuse client;
- create lead;
- create draft/open deal with `amount = 0 KZT` unless explicit value is extracted safely;
- create next task.

Allowed only when:

- `confidence >= 0.80`;
- `intent in appointment_request, purchase_interest, price_question`;
- `requires_human_review = false`;
- no duplicate conflict;
- conversation is not support/complaint/refund/negative;
- channel is enabled for auto deal creation.

### Level 4 - Appointment Proposal

Not real booking yet.

Behavior:

- AI extracts service/time preference;
- system creates task: `Подтвердить запись: {service/time}`;
- optional appointment draft can be stored later when draft model exists.

Blocked actions:

- no real calendar booking without manager confirmation;
- no client-facing confirmation message.

## Guard Rules

Never automate these actions in the first production version:

- send AI reply to customer;
- book appointment in calendar;
- mark deal as won/lost;
- merge duplicate clients;
- delete/archive entities;
- reserve stock;
- create payment/invoice;
- change 1C/Kaspi/warehouse state.

Always require manager review when:

- `confidence < 0.70`;
- AI output is invalid and fallback was used;
- duplicate client candidates exist;
- message is complaint/support/refund/negative;
- intent is unclear;
- extracted phone/name conflicts with existing client data;
- action would create a deal from a non-commercial message.

## Data Model / Settings

Prefer no migration for the first slice if possible:

- store bot/channel auto settings in existing `Bot.settings_json` or `BotChannel.config_json`.

Suggested config:

```json
{
  "auto_crm_pipeline": {
    "enabled": true,
    "mode": "triage|lead_task|draft_deal",
    "min_lead_confidence": 0.7,
    "min_deal_confidence": 0.8,
    "allow_deal_intents": ["appointment_request", "purchase_interest", "price_question"],
    "require_review_on_fallback": true,
    "create_appointment": false,
    "auto_send_reply": false
  }
}
```

## Backend Implementation Steps

1. Add auto settings resolver: `Implemented`

```text
apps/conversations/auto_pipeline.py
```

Responsibilities:

- read business/bot/channel config;
- return normalized mode and thresholds;
- default to disabled.

2. Add guarded runner: `Implemented`

```text
maybe_run_auto_pipeline(conversation, message)
```

Responsibilities:

- call AI qualification;
- evaluate guard rules;
- call `run_conversation_pipeline` with safe flags;
- save decision status to `conversation.metadata_json`.

3. Add decision statuses: `Partially implemented`

```text
skipped_disabled
qualified_only
created_lead_task
created_draft_deal
needs_review
blocked_low_confidence
blocked_risky_intent
blocked_fallback
failed
```

Remaining:

- `blocked_duplicate`;
- `failed`.

4. Hook runner into inbound integrations after message registration: `Implemented`

- Telegram inbound handler;
- WhatsApp inbound handler;
- Website chat handler;
- future Instagram handler.

5. Add activity/audit events: `Partially implemented`

- implemented generic `auto_pipeline_{status}` activity event.
- still need dedicated analytics/reporting views for these events.

6. Add tests: `Partially implemented`

- implemented: website `lead_task` mode creates client/lead/task and stays idempotent on repeated message.
- still needed: disabled mode, triage mode, draft deal guard, fallback review block, duplicate block, tenant isolation for provider webhooks.

## Frontend Implementation Steps

1. Add settings UI later under bot/channel settings:

- Auto CRM Pipeline toggle;
- mode selector;
- confidence thresholds;
- allowed intents;
- review-required options.

2. Add Conversations UI indicators:

- AI qualified;
- auto-created lead/task/deal;
- needs review;
- blocked reason.

3. Add review action:

- `Approve CRM pipeline`;
- `Create lead/task only`;
- `Ignore`;
- `Open AI log`.

## First Implementation Slice

Build this first:

```text
BotChannel.config_json.auto_crm_pipeline.mode = lead_task
```

Scope:

- auto-run only when explicitly enabled in config; `Implemented`
- create client + lead + task; `Implemented`
- do not create deal automatically yet unless `mode = draft_deal`;
- save all decisions in metadata; `Implemented`
- add backend tests; `Partially implemented`

## Done Criteria

The auto CRM pipeline is ready for pilot when:

- default state is off;
- enabling per channel works;
- inbound message can auto-create client/lead/task without duplicate entities;
- deal auto-creation is gated by confidence and commercial intent;
- every automatic decision is visible in metadata/logs;
- low confidence and duplicate cases are blocked, not guessed;
- full backend tests pass;
- readiness plan is updated.
