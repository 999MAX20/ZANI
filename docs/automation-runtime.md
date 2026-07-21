# Automation Runtime

Phase 10 moves automations into a service-backed CRM runtime.

## Runtime Model

Automation events create `AutomationRun` records first.

Each run stores:

- `idempotency_key`;
- `status`;
- `attempts` / `max_attempts`;
- `run_after`;
- `next_retry_at`;
- `action_results`;
- `current_action_index`;
- `error`.

This gives the owner and support team a clear record of what happened and prevents duplicate CRM actions.

## Supported CRM Triggers

The runtime currently executes business-scoped rules for:

- `lead_created`;
- `lead_status_changed`;
- `deal_stage_changed`;
- `appointment_cancelled`;
- `appointment_completed`;
- `task_overdue`;
- `conversation_unread`.

Lifecycle triggers are emitted by the same CRM services that users call from the API. This keeps automation behavior aligned with permission-aware lead, deal, appointment, task and inbox flows instead of bypassing domain rules.

## Idempotency

`run_automations_for_event(...)` computes a stable key from:

- rule id;
- trigger type;
- entity type;
- entity id;
- payload.

The database enforces uniqueness with:

```text
business + idempotency_key
```

If the same CRM event is emitted twice, the existing run is returned and actions are not duplicated.

## Queue Behavior

Celery tasks:

- `automations.process_automation_run`;
- `automations.process_due_automation_runs`.

Local/dev behavior:

```text
AUTOMATIONS_RUN_INLINE=True
```

Immediate actions execute synchronously so the CRM works without Redis/Celery during local MVP work.

Production/staging behavior:

```text
AUTOMATIONS_RUN_INLINE=False
```

Runs are dispatched to the `automations` Celery queue.

## Delays And Wait Actions

Rules with `WAIT` actions or action-level `delay_seconds` set `run_after`.

When `AUTOMATIONS_RUN_INLINE=True`, future runs remain `pending` and are not executed inside the HTTP request.

When `AUTOMATIONS_RUN_INLINE=False`, Celery workers and beat claim due runs from the `automations` queue. `WAIT` persists the next action index, moves the run to `waiting`, and resumes without replaying completed actions.

## Retry

Failed runs store:

- error text;
- attempt count;
- `next_retry_at`.

Transient failures move to `retry_scheduled`; due selection includes pending, waiting and retry-scheduled runs. Claims use a conditional state transition so two workers cannot execute the same run. Stale running claims are recovered after the configured timeout.

API:

```text
POST /api/automation-runs/{id}/retry/
```

Retry resets the run to pending and schedules or executes it according to `AUTOMATIONS_RUN_INLINE`.

Cancelled runs can also be retried when the user has automation management access.

## Cancel

API:

```text
POST /api/automation-runs/{id}/cancel/
```

Cancel is available for pending, running and failed runs. It is gated by `automations:manage` and writes the terminal `cancelled` status without executing remaining actions.

## Current Supported Actions

- `create_task`;
- `create_notification`;
- `assign_user`;
- `add_note`;
- `create_follow_up`;
- `wait`.

All mutating CRM actions call domain services/helpers:

- tasks and follow-ups use task service creation with business/member validation;
- notifications use role-aware notification routing;
- user assignment validates active business membership before changing ownership/assignee fields;
- notes use the activity timeline service and same-business entity resolution.

Unsupported action types are rejected during execution and stored on the failed run with an error.

## Noisy Rule Protection

Before creating a new non-duplicate run, the engine checks how many recent runs the same business/rule produced inside a rolling window.

Optional settings:

```text
AUTOMATION_RULE_RUN_LIMIT=20
AUTOMATION_RULE_RUN_WINDOW_MINUTES=10
```

If the limit is exceeded, the engine stores a `skipped` run with throttle metadata instead of executing the actions. Idempotent duplicate events still return the existing run and do not count as a new action execution.

## Run Visibility

The Automations page exposes a run detail drawer with:

- run status, rule, entity and attempt metadata;
- original payload;
- action results;
- error details;
- retry and cancel controls where the current status allows them.

## Next Steps

- add webhook action delivery through integrations queue;
- add deeper circuit-breakers for repeatedly failing rules;
- add richer owner-facing filtering/search over run history.
