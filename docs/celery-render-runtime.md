# Redis / Celery Runtime On Render

Дата: 23.05.2026

Цель: перевести staging/predicate-production Zani с режима `web + database` на queue-backed runtime, чтобы автоматизации, интеграции, уведомления и AI не выполнялись внутри HTTP request.

## 1. Provider Decision

Recommended staging Redis:

- Upstash Redis;
- Redis Cloud;
- any managed Redis with TLS support.

Use `redis://...` or `rediss://...` in `REDIS_URL`.

Do not use a Redis instance inside the same ephemeral web container on Render.

## 2. Backend Web Service Env

Required queue-related env:

```env
REDIS_URL=rediss://default:<password>@<host>:<port>
AUTOMATIONS_RUN_INLINE=False
CELERY_TASK_ALWAYS_EAGER=False
CELERY_TASK_STORE_EAGER_RESULT=False
CELERY_TASK_DEFAULT_QUEUE=default
CELERY_TASK_ACKS_LATE=True
CELERY_WORKER_PREFETCH_MULTIPLIER=1
```

Run the readiness audit after setting env:

```bash
.venv/bin/python manage.py production_readiness_audit --fail-on-critical
```

For staging, critical failures unrelated to H1 can still exist until storage/Sentry/email phases are completed. Queue items should be green.

## 3. Render Worker Services

Create separate Render Background Worker services from the same repository.

The repository also includes a safe blueprint example:

```text
deploy/render.h1.example.yaml
```

Do not rename it to `render.yaml` blindly. Review names, regions, plans and env groups first, because a root `render.yaml` can change how Render manages services.

Minimum H1 service set:

- backend web service;
- `zani-worker-default` for `default,automations,notifications`;
- `zani-worker-integrations` for `integrations,webhooks_outbound`;
- optional `zani-worker-ai`;
- optional `zani-celery-beat`.

All backend and worker services must share the same:

- `DATABASE_URL`;
- `REDIS_URL`;
- `SECRET_KEY`;
- queue env values from section 2.

### Default / Automation / Notification Worker

```bash
celery -A config worker --loglevel=info --queues=default,automations,notifications --concurrency=${CELERY_WORKER_CONCURRENCY:-1}
```

### Integrations Worker

```bash
celery -A config worker --loglevel=info --queues=integrations,webhooks_outbound --concurrency=${CELERY_WORKER_CONCURRENCY:-1}
```

### AI Worker

```bash
celery -A config worker --loglevel=info --queues=ai --concurrency=${CELERY_AI_WORKER_CONCURRENCY:-1}
```

Only enable the AI worker when AI provider keys, cost controls and usage limits are ready.

### Beat / Scheduler

```bash
celery -A config beat --loglevel=info
```

Beat is optional in early staging. Enable it when due automation/retry/report jobs must run without manual command execution.

## 4. Queue Runtime Smoke

The repository includes a safe smoke command:

```bash
python manage.py queue_runtime_smoke --business-id <business_id> --timeout 45
```

For Render Shell or any production-like env, prefer the wrapper:

```bash
scripts/render_h1_queue_smoke.sh
```

Optional variables:

```bash
PYTHON_BIN=python
BUSINESS_ID=<business_id>
QUEUE_SMOKE_TIMEOUT=60
```

What it does:

1. Creates a temporary automation rule for the selected business.
2. Creates an `AutomationRun`.
3. Dispatches `automations.process_automation_run` to the `automations` queue.
4. Polls until a worker processes the run and creates a low-priority smoke task.

Optional cleanup:

```bash
python manage.py queue_runtime_smoke --business-id <business_id> --timeout 45 --cleanup
```

If it times out:

- `REDIS_URL` may be wrong;
- worker service may be stopped;
- worker may not listen to the `automations` queue;
- `AUTOMATIONS_RUN_INLINE` may still be `True` in staging;
- Render worker may be deployed from an old commit.
- backend web and worker services may point to different databases or Redis URLs.

Quick worker log checklist:

```text
Connected to redis...
celery@... ready.
Queues: automations, default, notifications
Task automations.process_automation_run received
Task automations.process_automation_run succeeded
```

## 5. Failure / Retry Notes

- Automation runs are stored in `AutomationRun`.
- Failed runs keep `error`, `attempts`, `next_retry_at` and `action_results`.
- Manual retry endpoint exists:

```text
POST /api/automation-runs/{id}/retry/
```

For production, monitor:

- failed automation runs;
- worker crashes;
- queue latency;
- Redis connection errors;
- repeated retries for the same business.

## 6. H1 Acceptance

H1 is complete when:

- `REDIS_URL` is set in backend and workers;
- at least one Render worker listens to `automations`;
- backend web service boots with `AUTOMATIONS_RUN_INLINE=False`;
- `queue_runtime_smoke` passes on staging;
- `production_readiness_audit` queue checks are green;
- docs and env templates are updated.

## 7. Render H1 Deployment Steps

1. Provision managed Redis.
2. Put the same `REDIS_URL` into backend web and all worker services.
3. Set these values on backend web and workers:

```env
AUTOMATIONS_RUN_INLINE=False
CELERY_TASK_ALWAYS_EAGER=False
CELERY_TASK_STORE_EAGER_RESULT=False
CELERY_TASK_ACKS_LATE=True
CELERY_WORKER_PREFETCH_MULTIPLIER=1
CELERY_TASK_DEFAULT_QUEUE=default
```

4. Add the default worker:

```bash
celery -A config worker --loglevel=info --queues=default,automations,notifications --concurrency=${CELERY_WORKER_CONCURRENCY:-1}
```

5. Add integrations worker if connector events/webhooks are enabled:

```bash
celery -A config worker --loglevel=info --queues=integrations,webhooks_outbound --concurrency=${CELERY_WORKER_CONCURRENCY:-1}
```

6. Redeploy backend and workers from the same commit.
7. Open backend Render Shell and run:

```bash
BUSINESS_ID=<real-business-id> scripts/render_h1_queue_smoke.sh
```

8. H1 is green only when the wrapper prints:

```text
H1 queue runtime smoke passed.
```
