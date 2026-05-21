# Automation Runtime

Phase 5 moves automations from simple inline execution toward a queue-safe runtime.

## Runtime Model

Automation events create `AutomationRun` records first.

Each run stores:

- `idempotency_key`;
- `status`;
- `attempts` / `max_attempts`;
- `run_after`;
- `next_retry_at`;
- `action_results`;
- `error`.

This gives the owner and support team a clear record of what happened and prevents duplicate CRM actions.

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

When `AUTOMATIONS_RUN_INLINE=False`, Celery receives the task with `eta=run_after`.

## Retry

Failed runs store:

- error text;
- attempt count;
- `next_retry_at`.

API:

```text
POST /api/automation-runs/{id}/retry/
```

Retry resets the run to pending and schedules or executes it according to `AUTOMATIONS_RUN_INLINE`.

## Current Supported Actions

- `create_task`;
- `create_notification`;
- `wait`.

Unsupported action types are preserved in the builder/DB for future phases, but are not executed by the runtime yet.

## Next Steps

- add per-business automation throttling;
- add scheduled beat task for due pending/retry runs;
- add webhook action delivery through integrations queue;
- add owner-facing run detail drawer;
- add circuit-breakers for noisy rules.
