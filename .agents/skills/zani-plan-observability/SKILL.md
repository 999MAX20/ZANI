---
name: zani-plan-observability
description: Design or review actionable ZANI production observability across Django APIs, Celery workers, connectors/webhooks, automations, AI providers, and React delivery using safe structured logs, metrics, traces, dashboards, alerts, health checks, and correlation. Use for instrumentation, Sentry, operational dashboards, alerting, SLOs, readiness, or diagnosing visibility gaps.
---

# Plan ZANI Observability

## Workflow

1. Read `AGENTS.md`, `docs/production-readiness.md`, `docs/production-readiness-10000-audit.md`, `docs/deployment.md`, and affected runtime code.
2. Define the operational questions, user impact, owner, and recovery action before adding telemetry.
3. Map the request path across web, database, queue/worker, provider, and frontend boundaries. Reuse a safe correlation identifier.
4. Add structured events and bounded-cardinality metrics for traffic, latency, errors, saturation, queue lag, retries, provider health, webhook failures, automation outcomes, and AI cost/latency as applicable.
5. Keep audit history separate from operational telemetry. Never log secrets, tokens, raw credentials, full sensitive messages, or unbounded provider payloads.
6. Prefer alerts tied to user impact or exhausted recovery budgets. Give each alert an owner, threshold/window, diagnostic link, and first recovery step.
7. Add health/readiness checks that prove dependencies required by the serving role without turning transient optional-provider failures into global outages.
8. Verify emitted signals and failure paths in staging or tests, then use `$zani-run-verification` for code changes.

Read [references/observability-checklist.md](references/observability-checklist.md) before proposing telemetry.

## Output Contract

Report operational questions, signals, dimensions, privacy/cardinality limits, alert ownership and actions, validation, and known blind spots.
