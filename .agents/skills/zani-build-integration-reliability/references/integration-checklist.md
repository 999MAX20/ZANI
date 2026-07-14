# Integration Reliability Checklist

- Adapter registered behind `apps.integrations.providers`; no provider-specific CRM logic in views.
- Connector, credentials, events, logs, and sync runs are Business-scoped.
- Raw credentials never appear in API responses, logs, audits, errors, fixtures, or frontend state.
- Webhooks authenticate where supported and public endpoints are throttled.
- Duplicate delivery produces one durable effect using a stable business/source/deduplication identity.
- Retries are bounded and safe; write-back is not retried unless explicitly designed as idempotent.
- Timeouts and provider failures produce durable, merchant-safe status and recovery actions.
- Normalized BusinessEvents carry source time and safe source identifiers.
- CRM mutations use existing mapping/domain services and preserve activity/audit rules.
- Tests use mocks and assert no real external network call.
- A provider remains disabled or in pilot until its readiness and rollback gates pass.
