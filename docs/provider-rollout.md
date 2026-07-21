# Provider Rollout Sequence

Zani does not enable all external providers at once. Every real provider must pass a readiness gate before it is exposed to merchants or paid beta traffic.

## Approved Order

1. Telegram real webhook.
2. Website widget and public forms production embed.
3. Excel/CSV real import as the first data connector.
4. Transactional email.
5. OpenRouter/OpenAI behind AI queue and usage limits.
6. WhatsApp provider pilot.
7. Instagram/Meta provider pilot.
8. Kaspi, marketplaces and 1C after event normalization and support workflow are proven.

## Required Gate For Every Provider

- provider adapter is registered behind `apps.integrations.providers`;
- merchant connector metadata exists in the connector catalog;
- credentials are stored/masked through provider settings or `ConnectorCredential`;
- webhook verification exists where relevant;
- inbound events are normalized through `BusinessEvent` / `IntegrationEventLog`;
- provider-specific inbound handlers and pull syncs feed CRM through `apps.integrations.crm_mapping` or `apps.integrations.sync_service`, not direct CRM mutations in views;
- provider-specific setup, status, test, sync and OAuth actions are routed through service/provider layers, not implemented inside DRF viewsets;
- duplicate delivery is handled by deduplication keys or idempotent processing;
- connector health is visible to support;
- tenant isolation is covered by tests;
- rollback and recovery steps are documented.

## Provider Readiness Matrix

This matrix is the current source of truth for merchant-facing readiness labels. Do not show a provider as live/production-ready in UI, sales copy, onboarding or support playbooks unless its row says `live-ready` and the required env/readiness gate has passed in the target environment.

| Provider | Channel/type | Live/mock status | Required env/setup | Setup owner | Test coverage | User-visible status |
| --- | --- | --- | --- | --- | --- | --- |
| Website widget and public forms | Owned web lead capture | `local/dev ready`; first production candidate after public throttles, domain/embed and abuse controls are configured | Public HTTPS app URL, public throttles/rate limits, form/widget settings; no paid provider credentials | Owner/admin configures; support helps embed/domain issues | Public form/chat flow, BusinessEvent normalization, tenant isolation and abuse-control tests | Available or setup required; never shown as third-party live provider |
| Excel/CSV | File import data connector | `local/dev ready`; controlled-pilot candidate; not an external live provider | Upload limits, allowed import entities and connector catalog metadata; no paid provider env | Owner/admin imports; support handles template/recovery | Import parser, clients/leads/deals/sales/catalog mapping, BusinessEvent output and rollback/retry checks | Import available; last import and errors shown safely |
| Telegram | Bot channel / messaging webhook | Real-provider candidate; expose as live only after readiness check and production env are green | `TELEGRAM_ENABLED=True`, `TELEGRAM_WEBHOOK_SECRET`, bot token in `ConnectorCredential`, public HTTPS webhook, Redis/Celery, Sentry | Owner/admin connects bot; support validates webhook/provider console | Provider readiness command, webhook verification, credential masking, duplicate delivery idempotency, permission and tenant tests | Beta/setup required until connected and readiness green; connected only after real webhook check |
| WhatsApp | Meta Cloud API messaging | Pilot only; not production-ready by default; manual credentials are support fallback | `WHATSAPP_ENABLED=True`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, page/phone access token in `ConnectorCredential`, public HTTPS webhook, Redis/Celery, Sentry | Owner/admin via Meta Embedded Signup when available; support fallback for manual creds | WhatsApp readiness check, webhook signature/token validation, credential masking, duplicate delivery, permission and tenant tests | Request access or pilot/setup required; do not show as generally live |
| Instagram / Meta | Instagram Business messaging | Pilot only; not production-ready by default; manual credentials are support fallback | `INSTAGRAM_ENABLED=True`, `INSTAGRAM_VERIFY_TOKEN`, `INSTAGRAM_APP_SECRET` or `META_APP_SECRET`, page token in `ConnectorCredential`, public HTTPS webhook, Redis/Celery, Sentry | Owner/admin via Meta OAuth; support fallback for account/page linking | Instagram readiness check, OAuth/manual setup tests, credential masking, duplicate delivery, permission and tenant tests | Request access or pilot/setup required; connected only after Meta OAuth/webhook validation |
| Kaspi | Marketplace orders import | Beta read-only pull sync; no write-back, repricing or order mutation | `KASPI_ENABLED=True`, merchant access key, sync schedule/runtime, support recovery path | Owner/admin provides key; support validates access and recovery | Connector config/status/sync tests, read-only BusinessEvents, permission and tenant tests | Beta read-only; connected/importing only when key and sync health are green |
| MoySklad | Catalog, stock, sales and client import | Beta read-only pull sync; write-back disabled | `MOYSKLAD_ENABLED=True`, merchant access key/token, sync schedule/runtime, support recovery path | Owner/admin provides key; support validates entity mapping | Connector config/status/sync tests, catalog/stock/sales/client event normalization, permission and tenant tests | Beta read-only; setup required until key and sync health are green |
| Wildberries / WB | Marketplace import | Beta read-only pull sync; price/card/supply/order write-back disabled | `WILDBERRIES_ENABLED=True`, merchant Statistics token, sync schedule/runtime, support recovery path | Owner/admin provides token; support validates data scope | Connector config/status/sync tests, read-only marketplace event normalization, permission and tenant tests | Beta read-only; no write-back claims |
| Ozon | Marketplace import | Beta read-only pull sync; price/stock/card/order write-back disabled | `OZON_ENABLED=True`, merchant `Client-Id` and API key, sync schedule/runtime, support recovery path | Owner/admin provides credentials; support validates data scope | Connector config/status/sync tests, read-only marketplace event normalization, permission and tenant tests | Beta read-only; no write-back claims |
| Transactional email | System email runtime | Runtime dependency; not a merchant data connector; rely on only after SMTP smoke is green | SMTP provider env, from-domain/DNS where applicable, `email_runtime_smoke` | Platform/operator configures; support monitors delivery | Email smoke, invitation/alert/recovery paths, safe fallback checks | System status only; not a daily connector card unless delivery needs attention |
| OpenRouter / OpenAI | AI provider runtime | Mock/dev by default; live only behind queue, throttles, usage limits and source-grounding checks | Provider API key/model/base URL, AI queue/runtime, usage limits, provider-disabled fallback | Platform/operator configures; owner/admin controls AI feature access | AI source/no-data/approval tests, provider-disabled behavior, masked logging and usage-limit checks | AI available only when enabled; otherwise safe mock/no-provider messaging |
| 1C | Future accounting/ERP bridge | Roadmap/request; target is push-based ZANI Agent/app flow; no raw endpoint/token primary UX | Future agent/app installer and support playbook; no production env approved yet | Product/support-led pilot only | Future provider tests required before exposure | Request/roadmap only |
| Other future providers | Future marketplaces, payments, delivery or accounting | Roadmap/request until adapter, event normalization, support workflow and rollback are proven | Provider-specific future env and support playbook | Product/support | Future readiness gate and provider tests | Request/roadmap only |

Status labels:

- `local/dev ready`: safe to test without live third-party traffic.
- `controlled-pilot candidate`: can be used with selected merchants after the documented local/staging gate.
- `beta read-only`: real provider data may be imported, but write-back/mutations are disabled.
- `pilot only`: provider is not generally production-ready and must stay behind support/product approval.
- `live-ready`: provider can be shown as generally available only after env, readiness command, rollback and monitoring are green for that environment.

## Readiness Command

Run all checks:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py provider_rollout_readiness_check
```

Fail deployment when selected provider has blockers:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py provider_rollout_readiness_check \
  --provider telegram \
  --fail-on-blockers
```

JSON output for CI/runbooks:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py provider_rollout_readiness_check --format=json
```

Render/deploy wrapper:

```bash
scripts/render_h7_provider_rollout_check.sh
PROVIDER=telegram scripts/render_h7_provider_rollout_check.sh
```

Use the provider-specific form before turning on any real provider env flag.

## Current Provider Notes

- Update 2026-07-14: connector setup/status/test/sync/OAuth actions are service-backed for BusinessConnector providers, and Telegram/WhatsApp/Instagram bot-channel setup/status/test/sync actions are service-backed for BotChannel endpoints. Telegram/Instagram/WhatsApp bot-channel credentials use `ConnectorCredential`, and inbound provider messages have database-backed delivery idempotency by `conversation + direction + external_message_id`. This is a rollout boundary only; provider live flags and readiness gates below still control production exposure.
- Update 2026-07-16: merchant integration UI must keep daily setup simple. Credentials, webhook/callback values, raw provider errors and advanced import knobs stay behind owner/admin/support fallback controls; daily cards show only status, business value, safe actions and merchant-safe recovery messages.
- Telegram: has provider adapter, webhook verification, credential storage for bot tokens and replay-safe inbound messages. Real mode requires `TELEGRAM_ENABLED=True`, `TELEGRAM_WEBHOOK_SECRET`, Redis/Celery runtime and Sentry.
- Website/public forms: can be used first because it does not require paid provider credentials. Keep public throttles enabled.
- Excel/CSV: available as the first data connector. It is not an external provider, but it must keep connector catalog metadata, clients/leads/deals/sales/catalog import entity support, upload limits and BusinessEvent normalization green before merchant data onboarding.
- Transactional email: configure SMTP and run `email_runtime_smoke` before relying on invitations, alerts or recovery emails.
- OpenRouter/OpenAI: keep mock mode unless AI queue, throttles and usage limits are ready. AI must stay optional for merchants.
- WhatsApp: production path is Meta Embedded Signup + Meta Cloud API. Manual credentials are support fallback only. Do not set `WHATSAPP_ENABLED=True` until `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, public HTTPS webhook delivery, Redis/Celery runtime, Sentry and the WhatsApp readiness check are green.
- Instagram/Meta: primary path is Meta OAuth for a Page linked to Instagram Business; page access tokens are stored in `ConnectorCredential` and removed from channel config. Manual credentials are support fallback only. Do not set `INSTAGRAM_ENABLED=True` until `INSTAGRAM_VERIFY_TOKEN`, `INSTAGRAM_APP_SECRET` or `META_APP_SECRET`, public HTTPS webhook delivery, Redis/Celery runtime, Sentry and the Instagram readiness check are green.
- Kaspi: beta read-only orders import is available behind `KASPI_ENABLED`; current self-service baseline uses merchant access key, with official partner authorization as the long-term target. Keep write-back, repricing and order mutations disabled.
- МойСклад: beta read-only catalog/stock/sales/client import is available behind `MOYSKLAD_ENABLED`; current self-service baseline uses merchant access key, with app/install authorization as the long-term target. Keep write-back disabled.
- Wildberries: beta read-only marketplace import is available behind `WILDBERRIES_ENABLED`; current self-service baseline uses merchant Statistics token. Keep price/card/supply/order write-back disabled.
- Ozon: beta read-only marketplace import is available behind `OZON_ENABLED`; current self-service baseline uses merchant `Client-Id` and `API key`. Keep price/stock/card/order write-back disabled.
- 1C: target is push-based ZANI Agent/app flow. Do not make raw endpoint/token setup the primary merchant UX.
- Other marketplaces: keep request/roadmap until reconciliation, support tooling and data import/export recovery are stable.

## Environment Rule

Provider env flags are not feature toggles for experiments in production. If a flag enables real external traffic, it must be paired with:

- production secrets;
- provider-specific recovery instructions;
- queue-backed runtime;
- error monitoring;
- support-visible connector status;
- tenant isolation tests.

## Rollback Rule

Every provider activation needs a rollback note before going live:

```text
Provider:
Enabled flag/env:
How to disable:
Webhook/provider console rollback:
Expected merchant impact:
Support message:
Owner:
```

If rollback is not documented, keep the provider in request/pilot mode.
