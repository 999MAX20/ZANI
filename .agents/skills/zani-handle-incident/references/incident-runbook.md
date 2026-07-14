# Incident Runbook

## Triage

- Identify user-visible impact, affected roles/businesses/providers, severity, start time, and incident owner.
- Treat suspected cross-tenant exposure, credential leakage, or unauthorized mutation as a security incident.
- Check recent deploys, migrations, env/config changes, provider activations, queue state, and dependency health.

## Containment decision

- Prefer reversible, scoped controls with a known rollback path.
- State data-loss, availability, duplicate-processing, and recovery risks for each option.
- Obtain explicit authorization before production mutation, rollback, disablement, purge, replay, correction, or secret rotation.
- Preserve logs, event identifiers, deployment versions, and relevant sanitized evidence.

## Recovery proof

- Verify the actual merchant flow, API health, background jobs, database state, provider/webhook delivery, and error/latency trend as applicable.
- Check more than a single successful request and watch for recurrence.
- Confirm tenant and permission boundaries after any data/security incident.

## Follow-up

- Document root cause only when evidence supports it; otherwise record the leading hypothesis.
- Add a regression test, monitor/alert, runbook correction, and bounded owner/date for each prevention action.
