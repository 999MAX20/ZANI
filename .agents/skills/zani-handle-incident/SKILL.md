---
name: zani-handle-incident
description: Diagnose, contain, recover, and document ZANI staging or production incidents involving outages, elevated errors, tenant data exposure, broken deployments, queues, databases, integrations/webhooks, automations, AI providers, or frontend delivery. Use for incident response, rollback decisions, production debugging, recovery runbooks, and post-incident follow-up; do not mutate live systems without explicit user authorization.
---

# Handle ZANI Incident

## Workflow

1. Read `AGENTS.md`, `docs/production-readiness.md`, `docs/deployment.md`, provider rollout docs when relevant, and current evidence.
2. Establish severity, affected users/businesses, start time, current symptoms, recent changes, and whether confidentiality or tenant isolation may be compromised.
3. Begin with read-only evidence: health/readiness, logs, metrics, traces, deployment state, queue lag, provider status, database health, and a minimal safe reproduction.
4. Build a timestamped fact timeline. Separate confirmed evidence, hypotheses, and unknowns; do not overstate recovery.
5. Recommend the smallest reversible containment that protects users and data. Disabling a provider/feature, rollback, queue purge, data correction, credential rotation, or production write requires explicit user authorization and the relevant runbook.
6. Preserve evidence before destructive action. Avoid leaking credentials, customer data, raw payloads, or sensitive logs in chat and reports.
7. Verify recovery through user-facing checks, error/latency signals, queue/provider health, tenant boundaries, and a monitoring window.
8. Produce follow-up actions with owner, priority, test/alert/runbook improvement, and prevention evidence. Use `$zani-plan-observability` for visibility gaps and `$zani-run-verification` for fixes.

Read [references/incident-runbook.md](references/incident-runbook.md) during active response.

## Output Contract

Keep an incident log with impact, facts, hypotheses, containment options and risks, authorization status, recovery evidence, remaining risk, and next update. Never claim a live action was performed when it was only proposed.
