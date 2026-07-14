# Observability Checklist

- Identify service/user impact, owning component, and recovery action for each signal.
- Use stable event names and safe correlation, Business, connector, run, or request identifiers where authorized.
- Keep labels bounded; do not use customer text, URLs, arbitrary errors, or entity IDs as metric labels.
- Track request latency/error rate, DB pressure, worker queue lag/failures, webhook delivery, connector sync, automation runs, AI latency/errors/cost, and deployment health as relevant.
- Sanitize exception context, breadcrumbs, structured logs, and third-party monitoring payloads.
- Distinguish expected business denials from defects and dependency degradation.
- Alert on sustained impact, exhausted retries, or SLO risk rather than every individual error.
- Document dashboard/alert owner, threshold, window, runbook entry, and recovery command or decision.
- Test that a controlled failure emits the expected signal without leaking data.
