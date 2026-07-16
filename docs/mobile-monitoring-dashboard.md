# Mobile Monitoring Dashboard

Date: 2026-06-27

Use this dashboard spec for staging and production mobile operations. It is based on the `zani.mobile` backend logger and `GET /api/mobile/v1/operations/summary/?business=<business_id>`.

## Required Panels

| Panel | Source | Target |
| --- | --- | --- |
| Mobile API p50/p95 by endpoint | `kind=api_response`, `path`, `duration_ms` | p95 under 400ms for `/home/`, under 800ms for list/detail endpoints |
| Mobile API error rate | `kind=api_response`, `status_code` | 5xx under 0.5% over 15 minutes |
| Auth/session failures | `path=/api/mobile/v1/auth/*`, `status_code=401/403` | spikes investigated within 15 minutes |
| Stale write conflicts | `kind=stale_conflict` | visible but low; sudden growth means offline replay or UI freshness issue |
| Idempotency health | `kind=idempotency_created/replay/conflict` | replay is normal; conflict must stay near zero |
| Push delivery | `kind=push_delivery`, `status=planned/sent/failed/skipped` | failed under 1%; skipped explained by preferences/revoked devices |
| Payload budget warnings | `kind=api_response`, `payload_bytes`, `path` | mobile lists stay within documented payload budgets |
| Device/session count | operations summary `devices`, `sessions`, `push_tokens` | unexpected active-session growth reviewed |
| Crash-free mobile sessions | Sentry mobile project | 99.5%+ before broad rollout |
| Release adoption | Sentry release/build tags and bootstrap version policy | unsupported versions trend down after forced update |

## Alerts

- Page on-call when mobile API 5xx rate is above 1% for 5 minutes.
- Page on-call when `/api/mobile/v1/auth/refresh/` 401 spikes after a release.
- Notify product/engineering when `stale_conflict` doubles versus the previous day.
- Notify engineering when `idempotency_conflict` is non-zero for 10 minutes.
- Notify engineering when push `failed` is above 3% for 15 minutes.
- Block release when staging `npm run load:api` fails or any primary endpoint exceeds the configured p95 budget.

## Log Fields

Dashboards must index these fields from JSON logs:

```text
kind
business_id
user_id
path
method
status_code
duration_ms
payload_bytes
endpoint
event_id
status
request_id
```

Do not index raw refresh tokens, push tokens, provider credentials or full customer message bodies.

## Staging Verification

Run non-physical checks before a mobile build is promoted:

```bash
cd mobile
ZANI_MOBILE_API_URL=https://staging-api.example \
ZANI_MOBILE_EMAIL=owner@example.com \
ZANI_MOBILE_PASSWORD=... \
npm run smoke:api

ZANI_MOBILE_API_URL=https://staging-api.example \
ZANI_MOBILE_EMAIL=owner@example.com \
ZANI_MOBILE_PASSWORD=... \
ZANI_MOBILE_LOAD_TEST=true \
ZANI_MOBILE_LOAD_CONCURRENCY=8 \
ZANI_MOBILE_LOAD_ITERATIONS=40 \
npm run release:gate
```

Physical-device push delivery and store review remain separate manual gates.
