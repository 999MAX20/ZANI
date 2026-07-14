---
name: zani-build-integration-reliability
description: Implement or review ZANI connectors, provider adapters, webhooks, pull syncs, retries, credential handling, normalized BusinessEvents, and merchant integration status for security, idempotency, tenant isolation, recovery, and provider rollout readiness. Use for apps/integrations, provider-specific clients, connector settings, import/sync flows, webhooks, or integration UI and tests.
---

# Build ZANI Integration Reliability

## Workflow

1. Read `AGENTS.md`, `docs/CONNECTOR_BLUEPRINT.md`, `docs/integrations.md`, `docs/provider-rollout.md`, `docs/PERMISSION_MATRIX.md`, and affected code/tests.
2. Search existing connector, provider, credential, event, sync, and CRM-mapping layers before adding anything.
3. Keep provider-specific behavior behind adapters/clients. Route CRM writes through provider-neutral mapping or domain services rather than views.
4. Establish tenant mapping before reading or writing merchant data. Enforce backend view/manage permissions.
5. Protect credentials and public endpoints: encrypt/store secrets appropriately, mask serializers and logs, validate signatures/tokens, rate-limit, and use safe merchant-facing errors.
6. Design delivery for duplicates and partial failure with stable deduplication keys, idempotent processing, bounded timeouts, retries/backoff, and replay-safe recovery.
7. Emit normalized `BusinessEvent` or integration logs with safe source metadata and CRM links where applicable.
8. Expose connected/attention/error status, last activity, safe retry/reconnect, and a simple setup path without raw technical detail.
9. Mock external services in tests. Cover tenant isolation, permission denial, masking, duplicate delivery, retry eligibility, failure recovery, and event normalization.
10. Run provider readiness checks when rollout state changes, then use `$zani-run-verification`.

Read [references/integration-checklist.md](references/integration-checklist.md) before implementation or review.

## Output Contract

Report provider boundary, credentials/env impact, tenant and permission impact, idempotency/retry behavior, BusinessEvent impact, rollout status, and exact checks.
