# Instagram Merchant Connector

Credential contract reconciled 2026-09-14 against committed implementation.
Current channel-ownership/OAuth WIP is not fully certified. Live acceptance is
separate: [provider rollout](../provider-rollout.md),
[backend audit](../../pilot/backend-development-audit.md).

## Purpose

Instagram is a per-merchant communication connector. A merchant connects an Instagram Professional account through Meta Graph API, and ZANI receives Direct messages, creates Inbox conversations, runs the AI/CRM pipeline, and sends manager replies back to Instagram.

## Recommended Setup Flow: Meta OAuth

Primary merchant path:

1. Merchant opens `/dashboard/integrations`.
2. Merchant opens Instagram settings.
3. Merchant clicks `Подключить через Meta`.
4. Merchant confirms access in Meta.
5. ZANI resolves a Facebook Page linked to an Instagram Business account.
6. ZANI stores the Page access token privately and marks the connector connected.

Manual Meta Graph credentials remain a support fallback.

Safe channel metadata is stored in `BotChannel.config_json`:

- `provider_mode=meta_graph`
- `instagram_user_id`
- `page_id`
- `username`

The Page `access_token` is a write-only setup/OAuth input, encrypted in the bound
connector's `ConnectorCredential` storage, not channel JSON. Responses expose
only masked/derived credential status. Use the shared credential helpers/keyring.

## Environment

Required for real Meta traffic:

```env
INSTAGRAM_ENABLED=True
INSTAGRAM_GRAPH_BASE_URL=https://graph.facebook.com
INSTAGRAM_GRAPH_API_VERSION=v25.0
INSTAGRAM_VERIFY_TOKEN=replace-with-platform-verify-token
INSTAGRAM_APP_SECRET=replace-with-meta-app-secret
META_APP_ID=replace-with-meta-app-id
META_APP_SECRET=replace-with-meta-app-secret
```

`INSTAGRAM_APP_SECRET` can be omitted when `META_APP_SECRET` is set.

## Test Setup Flow

1. Merchant opens `/dashboard/integrations`.
2. Merchant opens Instagram settings.
3. Merchant clicks `Подключить через Meta`.
4. ZANI encrypts credentials through connector credential helpers and stores only safe channel metadata/configured flags in JSON.
5. Merchant clicks `Проверить`.
7. Meta App Dashboard is configured with:
   - Callback URL: `https://YOUR_API_DOMAIN/api/integrations/instagram/webhook/`
   - Verify token: value of `INSTAGRAM_VERIFY_TOKEN`
   - Instagram messaging webhook subscription fields.
8. Send a Direct message to the connected Instagram account and verify it appears in Unified Inbox.

## Runtime Model

- Meta verifies the callback through `GET /api/integrations/instagram/webhook/`.
- Inbound messages arrive through `POST /api/integrations/instagram/webhook/`.
- ZANI validates `X-Hub-Signature-256` using `INSTAGRAM_APP_SECRET` or `META_APP_SECRET`.
- ZANI resolves the merchant by `entry.id` / `instagram_user_id`.
- ZANI stores inbound messages in `BotConversation` / `BotMessage`.
- Outbound manager replies use `/{instagram_user_id}/messages`.

## Local Real Test

1. Start local Django with real Meta settings:

```bash
DATABASE_URL=sqlite:///db.sqlite3 \
INSTAGRAM_ENABLED=True \
INSTAGRAM_VERIFY_TOKEN=... \
INSTAGRAM_APP_SECRET=... \
META_APP_ID=... \
META_APP_SECRET=... \
.venv/bin/python manage.py runserver 0.0.0.0:8000
```

2. Start a public HTTPS tunnel to Django port `8000`.
3. Run:

```bash
PUBLIC_URL=https://YOUR-TUNNEL-DOMAIN ./scripts/instagram_local_real_test.sh
```

4. Add the callback URL and verify token in Meta Dashboard.
5. Open `/dashboard/integrations`, connect through Meta OAuth and check Meta access.
6. Send a Direct message to the connected Instagram account.

## Smoke Check

Expected successful path:

1. Instagram channel has `instagram_user_id_configured=true`.
2. Instagram channel has `access_token_configured=true`.
3. `instagram-test-connection` returns `ok=true`.
4. Meta webhook verification returns the challenge.
5. Inbound Meta message creates an Instagram conversation and message.
6. Manager reply creates outbound `BotMessage` and provider `IntegrationEventLog`.
