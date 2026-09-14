# Integrations Foundation

Phase 4 adds the first production-oriented integration foundation for merchant connectors.

## Core Concepts

- `BusinessConnector` is the merchant-facing connection object.
- `ConnectorCredential` stores provider secrets per connector in a versioned AES-256-GCM envelope with an independent key ID. Use `connector-credential-key-rotation.md` for key setup, legacy migration, rollback and recovery.
- `BusinessEvent` stores normalized inbound events with idempotency.
- `ConnectorSyncRun` stores health checks and future pull/webhook sync runs.

This keeps integration state separate from CRM entities and avoids putting provider-specific logic directly into CRM views.

Update 2026-07-14: provider-specific connector and bot-channel actions are now service-backed. `BusinessConnectorViewSet` validates HTTP input and delegates marketplace/Meta/WhatsApp/Kaspi/MoySklad/Wildberries/Ozon config, status, test and sync orchestration to `apps.integrations.services`. `BotChannelViewSet` delegates Telegram, WhatsApp and Instagram setup/test/status/sync orchestration to `apps.bots.services`. Raw provider credentials remain write-only or masked in connector/channel API responses.

Update 2026-08-21: Telegram/WhatsApp webhook secrets, Telegram bot tokens and
WhatsApp/Instagram access tokens use `ConnectorCredential`. Generic connector
and channel JSON rejects secret-like keys recursively, including nested and
case/separator variants. Migration `integrations.0006` extracts any historical
plaintext credentials before removing them from JSON. Config JSON contains only
safe flags, lookup digests and operational metadata.

## Documentation Map

- `README.md` — integrations documentation index.
- `CONNECTOR_BLUEPRINT.md` — connector architecture and review contract.
- `provider-rollout.md` — provider readiness gates and rollout order.
- `marketplace-integrations.md` — Wildberries, Ozon and Kaspi product/technical direction.
- `marketplace-onboarding-runbook.md` — merchant-facing onboarding fields and copy.
- `marketplace-inventory-write-plan.md` — stock reservation and write-back implementation plan.

## API

Merchant endpoints:

- `GET /api/business-connectors/capabilities/`
- `GET /api/business-connectors/`
- `POST /api/business-connectors/`
- `POST /api/business-connectors/{id}/health-check/`
- `POST /api/business-connectors/{id}/connect/`
- `POST /api/business-connectors/{id}/disconnect/`
- `POST /api/business-connectors/{id}/events/`
- `GET /api/connector-credentials/`
- `POST /api/connector-credentials/`
- `GET /api/business-events/`
- `GET /api/connector-sync-runs/`
- `POST /api/connector-sync-runs/{id}/retry/`

Frontend routes:

- `/app/integrations` — business-level external data, marketplace and system connections.
- `/app/ai-agents/:id/channels` — Website, Telegram, WhatsApp and Instagram endpoint setup for one exact AI agent.

`BusinessConnector` remains the internal business-level credential and provider-health record for messenger channels. It does not authorize a second messenger setup UI on `/app/integrations`.

## Merchant UI Boundary

The integrations page is the merchant-facing status center, not a connector developer console.

Messenger setup is intentionally excluded from this page. A merchant configures a messenger endpoint in the selected AI agent's Channels section, where the product can preserve agent ownership, readiness and direct navigation to conversations. Until a dedicated multi-account relation is introduced, a business may assign one Telegram, one WhatsApp and one Instagram endpoint across all agents; attempting to assign the same provider to another agent fails with an ownership conflict. Website channels remain per-agent.

Provider cards must use `docs/integrations/provider-rollout.md` as the readiness source of truth. The UI may show a provider as `connected`, `available`, `beta read-only`, `pilot/setup required`, `request access`, `mock/dev` or `roadmap`, but it must not imply general live readiness when the provider matrix still requires env, support approval or readiness checks.

Default daily cards and setup dialogs show:

- provider name and business value;
- connected, setup required, attention, error or request status;
- safe check, retry, sync or request actions when the role can manage integrations;
- read-only status for regular staff.

Technical setup stays behind owner/admin/support fallback controls:

- access keys, bot tokens, account IDs and webhook verification values;
- provider callback/setup details;
- advanced import windows, entity filters and pagination controls;
- raw provider failure details.

Provider errors shown in the UI must be translated into merchant-safe recovery messages such as reconnect, retry later, ask the owner, or support review. Do not surface raw provider payloads, tokens, callback URLs or debug text in daily CRM workflows.

## Readiness Labels

The current provider matrix is maintained in `docs/integrations/provider-rollout.md`.

- Website forms/widget and Excel/CSV are the safest first onboarding surfaces because they do not require paid third-party provider credentials.
- Telegram may become a live messaging provider only after the Telegram env, webhook, monitoring and readiness gate are green.
- WhatsApp and Instagram/Meta stay `pilot/setup required` until Meta signup/OAuth, public webhook delivery, Redis/Celery, Sentry and provider-specific readiness checks are green.
- Kaspi, MoySklad, Wildberries/WB and Ozon stay `beta read-only`; write-back, repricing, order mutation and stock/card mutation must not be advertised or enabled from the merchant UI.
- Transactional email and OpenRouter/OpenAI are runtime providers, not normal merchant data connectors; show only safe system/AI availability or no-provider messages.
- 1C and other future providers stay `request/roadmap` until adapter, support workflow, tests and rollback are documented.

Owner/admin roles can manage connector setup where enabled. Staff/operator roles should see safe read-only statuses or ask-owner/support actions instead of credential forms.

## CRM Mapping

Current Phase 11 behavior:

- website forms create `lead.captured` BusinessEvents linked to client, lead and form submission;
- website chat creates `message.received` BusinessEvents linked to conversation and, when present, client/lead/deal;
- Telegram, WhatsApp and Instagram inbound messages create `message.received` BusinessEvents after auto-pipeline so CRM links are preserved where configured;
- Excel/CSV import supports clients, leads, deals, sales and catalog; clients/leads/deals emit `*.imported` BusinessEvents and sales/catalog keep their existing event output;
- marketplace pull syncs use `apps.integrations.sync_service.execute_connector_sync`, which normalizes provider events through one adapter before API responses.

Safe retry is intentionally limited to failed health checks and read-only pull/manual sync runs where the connector service can re-run without write-back.

## Credentials

Raw credentials are write-only.

Bot-channel credential behavior:

- Telegram `bot_token` is accepted by setup, encrypted into `ConnectorCredential(key="bot_token")`, and removed from `BotChannel.config_json`.
- Telegram `webhook_secret` is encrypted into `ConnectorCredential(key="webhook_secret")`; channel resolution uses a keyed lookup digest followed by constant-time comparison of the decrypted candidate.
- Instagram manual setup and Meta OAuth page tokens are encrypted into `ConnectorCredential(key="access_token")` and removed from `BotChannel.config_json`.
- WhatsApp access tokens and per-channel webhook secrets use `ConnectorCredential`.
- `BotChannel.config_json` and connector config should expose only safe configured flags and account metadata.
- Generic `BusinessConnector.config_json` and `BotChannel.config_json` writes reject credentials. Provider-specific credential values must use the encrypted credential endpoint or the dedicated provider/channel setup action.

API responses return:

- `masked_value`;
- connector metadata;
- rotation timestamps.

API responses never return:

- raw token;
- raw webhook secret;
- raw API key;
- encrypted storage envelope.

The current implementation uses versioned AES-256-GCM envelopes and a separate
credential keyring. Production must supply a non-local active key and retain old
keys until rotation is complete. Before high-scale production, prefer an
external secret manager or KMS-backed envelope encryption.

## Idempotency

Inbound events are normalized through `normalize_business_event`.

Deduplication is based on:

- `business`;
- `source`;
- `event_type`;
- `external_id` when present;
- otherwise a stable hash of payload.

The database enforces uniqueness with:

```text
business + source + deduplication_key
```

Inbound bot messages add an additional database guard for provider delivery replay:

```text
conversation + direction + external_message_id
```

The constraint applies only when `external_message_id` is present, so manual/internal messages without provider ids remain allowed. Telegram, WhatsApp and Instagram webhook handlers use the shared idempotent message helper and return the existing message on duplicate delivery without creating duplicate `BusinessEvent`, automation work or inbox side effects.

## Outbound Webhook Egress Safety

Custom outbound webhook delivery is fail closed:

- production delivery permits HTTPS only and rejects credentials, fragments,
  localhost and every private, loopback, link-local, multicast, reserved or
  unspecified target address;
- all DNS answers must be public, and the client connects to a validated,
  pinned answer while retaining the hostname for TLS certificate validation;
- the actual socket peer is checked before any request bytes are sent;
- redirects are manual, loop-checked, limited to three hops and each target is
  independently parsed and resolved before it receives the payload;
- response bodies are read through a 2000-byte bound before sanitization and
  persistence, so a receiver cannot make the worker buffer an unbounded body;
- delivery payloads, errors and response excerpts continue through the shared
  sanitization boundary before they reach delivery logs or APIs.

Any URL or peer validation failure is stored as a sanitized failed delivery and
is eligible for the existing controlled retry flow. Do not weaken these checks
for a merchant endpoint; use a publicly reachable HTTPS receiver with a valid
certificate.

## Permissions

### Messenger channel configuration boundary (2026-09-13)

Generic connector/channel POST, PUT and PATCH do not stand in for provider setup:

- Messenger `config_json` is server-owned. Exact echoes are discarded before
  persistence; changed or cleared configurations are rejected. Draft channel
  creation accepts empty configuration and the legacy explicit `mock` default.
  Unbound pending connection requests retain only allowlisted textual form
  metadata; they cannot contain provider IDs, credentials or verification flags.
- A channel's bot and provider type cannot be reassigned through generic updates.
  Messenger `external_id` is written only by dedicated setup/OAuth actions.
- A connector cannot be converted to or from a messenger provider. Generic
  updates preserve its authentication type and server-owned channel binding.
- A bound messenger credential must be rotated through the corresponding channel
  setup action, not the generic credential write/delete API. Unbound connector bootstrap
  and non-messenger credential workflows retain their existing contract.
- Channel credential reads require the exact channel binding. Webhook-secret
  resolution additionally requires a positive integer channel ID, matching
  provider and the connector's Business. Invalid authenticated bindings cannot
  fall through to another legacy channel. Legacy plaintext migration remains
  available only through the existing trusted compatibility path.
  Unbound encrypted credentials are not guessed from the first business
  connector: owners must explicitly configure their channel; stored data is not deleted.
- WhatsApp/Instagram reactivation requires setup-owned `connection_verified`,
  not just a generic connector `connected` health status. Configuration changes
  reset verification. Existing channels without this marker must run the
  dedicated connection test before reactivation; no data migration guesses
  whether an old connection was verified. Mock success remains mock, not live
  provider certification.
- Telegram token/secret replacement invalidates webhook setup; replacing the
  bot token also invalidates token verification. Automatic missing-secret
  regeneration invalidates webhook setup as well.
- Generic creation and trusted setup share a Business row lock. Writes recheck
  current bindings after acquiring the lock. Setup gets a new `setup_revision`;
  delayed provider/OAuth results are rejected if the channel changed during the
  external request. Provider network calls are outside the commit lock.
- WhatsApp OAuth checks access to the exact returned phone-number identity
  before saving credentials or marking the selected channel verified. OAuth
  reconnect uses the existing bound connector even after its display name changes.
- Legacy OAuth without an explicit channel uses the same business-wide channel
  ownership guard as current agent setup; it cannot create a duplicate endpoint
  on a different agent.

The ownership-boundary change alone did not fix AI pause/inbound coupling.
Its separate ZD-012 follow-up is described below; neither phase certifies live providers.

Connectors use the existing `integrations` resource.

- owner/admin: can manage connectors;
- operator: cannot manage connectors;
- tenant filtering stays server-side;
- cross-business connector reads return empty list or 404.

## Next Steps

### AI pause / inbound follow-up (2026-09-14)

Implementation scope: transport resolution no longer depends on `Bot.status`
or AI profile/knowledge. Channel status, public token, webhook authentication,
exact credential binding, same-Business checks and replay guards remain enforced.
Autonomous pipeline and bot outbox delivery use current persisted eligibility,
including the exact conversation channel and handoff/closed/archived states.
See [API contract](../api/API_ACTION_CONTRACT.md#ai-agent-lifecycle-and-channels)
for the behavior matrix and deterministic-versus-AI boundary.

The follow-up runs in `C:\Users\user\Desktop\Zani-ai-pause-inbound`, branch
`codex/ai-pause-inbound`, starting from `4ba3cbf9fddcc6e1baa172b494c781550c090693`
plus the existing canonical backend AI/channel working changes. Those changes
are prerequisites, not newly reimplemented work: 20 tracked Python files and
five existing untracked lifecycle/ownership/readiness files were carried forward,
along with the existing defect/API/integration documentation changes. Frontend,
UI-toolkit and unrelated documentation-audit/AGENTS worktrees were not imported.
The canonical dirty checkout was not edited. No new models, migration, dependency,
environment flags, queue-backed connector sync or support-policy changes.

Verification status: implemented and focused-verified locally. The final corrected
26-test rerun passed; the expanded probe and its single harness failure are
reported separately below. This is not integrated, FC-003/008 certified or
pilot/release approved.

Verification evidence (local working snapshot, not a committed release gate):

- Initial reproducer: the two previously reported public website-chat tests
  independently returned `403` instead of `201` before the implementation.
  The first draft of the new fixture had duplicate blank user emails; the fixture
  was corrected before any successful regression evidence was counted.
- Structural checks: `check`, `makemigrations --check --dry-run` and `compileall -q`
  for the 11 changed Python files pass. `git -c core.safecrlf=false diff --check`
  and Markdown link/fence checks for the four changed documents pass.
- Focused gate: 22 tests passed in 24.321 seconds (11 new pause/inbound tests
  at that point plus the 11 existing readiness tests). An additional regression
  then covered pause during reply generation; no runtime code changed after that.
- Expanded gate: 325 tests ran in 503.499 seconds; 324 passed and one
  `assertLogs` case failed because the ad-hoc runner disabled logging globally.
  The failing test was
  `apps.integrations.tests_connectors.BusinessConnectorFoundationTests.test_provider_exception_is_logged_but_public_reason_is_generic`.
  This is not a zero-exit aggregate gate. No application change was made for it.
- Final rerun with normal logging: **26/26 passed in 26.169 seconds**, including
  that logging test, all 12 new regressions, 11 readiness tests and the two
  original website reproducers. Django check and migration drift passed again.
  The application code was unchanged between the 325-test probe and this rerun.
- Earlier non-acceptance probes: the in-memory expanded run ended with a native
  Python/SQLite access violation during setup. A subsequent ad-hoc file-DB probe
  configured the test DB too late and lost the DB between test classes; that
  probe had 11 setup errors and a Telegram fixture expecting a different denial
  status. DB configuration now happens before Django initialization and the
  Telegram fixture explicitly configures a global secret. Failed probes are not
  counted as passing checks and are not described as application regressions.

Scope and residual gates:

- The existing source backend snapshot in the canonical checkout was rechecked
  unchanged (tracked diff plus hashes of the five untracked prerequisites).
- No install, frontend build/browser, full repository/complete Django suite,
  dependency audit, real-provider, Redis/worker or PostgreSQL concurrency gate
  was run. This phase changes backend behavior only; external credentials and
  traffic are out of scope. There is no new committed range for the full runner.
- Persisted-state checks cover pauses at the tested boundaries; they do not
  recall an already dispatched provider request or certify linearizable
  PostgreSQL races. Old failed automatic replies do not restart on resume.
- FC-003/008, editor/save/onboarding follow-ups, connector sync queues and the
  support-note policy decision remain separate. Next step is controlled integration
  of this delta with the existing AI/channel package and one candidate gate.

Reproduction of the final focused rerun: from this worktree, use the existing canonical virtualenv without
installing dependencies. The file DB and provider-disabled environment are
temporary. Keep normal logging: some security tests assert log emission.

```powershell
@'
import os, sys, tempfile, logging, faulthandler
from pathlib import Path
from unittest.mock import patch
from scripts.codex_verify import safe_environment
faulthandler.enable()
with tempfile.TemporaryDirectory(prefix='zani-ai-pause-gate-') as phase_directory:
    phase_env = safe_environment(database_path=Path(phase_directory) / 'gate.sqlite3', python=sys.executable, django_port=8193, frontend_port=5193)
    phase_env.update(ALLOWED_HOSTS='testserver,localhost,127.0.0.1', DJANGO_SETTINGS_MODULE='config.settings')
    os.environ.clear()
    os.environ.update(phase_env)
    sys.argv = ['manage.py', 'test']
    import config.settings as phase_settings
    phase_settings.DATABASES['default']['TEST'] = {'NAME': str(Path(phase_directory) / 'test.sqlite3')}
    import django
    django.setup()
    from django.core.management import call_command
    from django.db import connections
    try:
        with patch('socket.socket.connect', side_effect=AssertionError('External network forbidden in this gate')):
            call_command('check')
            call_command('makemigrations', check=True, dry_run=True)
            call_command('test', *[
                'apps.integrations.tests_connectors.BusinessConnectorFoundationTests.test_provider_exception_is_logged_but_public_reason_is_generic',
                'apps.bots.tests_pause_inbound',
                'apps.bots.tests_readiness',
                'apps.bots.tests.BotsFoundationTests.test_public_website_chat_creates_conversation_message_client_and_lead',
                'apps.bots.tests.InboxBackendTests.test_public_website_chat_flows_into_inbox_and_manager_reply_updates_state',
            ], verbosity=1, interactive=False)
    finally:
        connections.close_all()
'@ | & C:\Users\user\Desktop\Zani\.venv\Scripts\python.exe -B -
```

Changed-code snapshot digest (LF-normalized UTF-8 file hashes, sorted
`path hash` lines joined with LF, then SHA-256):
`f22c75e70154e7fa30f4739968110d4021ff43f2d17232262961e8dd5d5a58c9`.


### Remaining independent integration work

- add queue-backed sync jobs;
- move long-running health checks to Celery;
- expand connector setup recovery copy as support playbooks mature;
- keep advanced credential and webhook setup out of daily CRM pages as provider coverage expands;
- broaden BusinessEvent-to-timeline mapping for conversation-only events when product wants conversation timeline cards.
- implement the marketplace onboarding UI from `marketplace-onboarding-runbook.md`;
- implement stock reservation/write-back foundation from `marketplace-inventory-write-plan.md` before enabling inventory write for merchants.
