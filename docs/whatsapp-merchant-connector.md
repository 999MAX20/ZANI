# WhatsApp Merchant Connector

## Purpose

WhatsApp is a per-merchant communication connector. A merchant connects their own WhatsApp Business phone number through Meta Cloud API, and ZANI uses that number to receive client messages, create inbox conversations, run the AI/CRM pipeline, and send manager replies back to WhatsApp.

## Provider

Current production path: Meta Cloud API.

Future adapters can be added behind the same provider interface:

- 360dialog
- Twilio WhatsApp
- provider-assisted QR pilot

## Production Environment

Required for real Meta Cloud traffic:

```env
WHATSAPP_ENABLED=True
WHATSAPP_GRAPH_BASE_URL=https://graph.facebook.com
WHATSAPP_GRAPH_API_VERSION=v25.0
WHATSAPP_VERIFY_TOKEN=replace-with-platform-verify-token
WHATSAPP_APP_SECRET=replace-with-meta-app-secret
META_APP_ID=replace-with-meta-app-id
META_APP_SECRET=replace-with-meta-app-secret
WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID=replace-with-meta-config-id
WHATSAPP_EMBEDDED_SIGNUP_LOGIN_URL=https://www.facebook.com/dialog/oauth
```

Recommended before paid traffic:

```env
AUTOMATIONS_RUN_INLINE=False
SENTRY_DSN=...
```

The API must be available through public HTTPS. Meta cannot deliver production webhooks to localhost.

## Merchant Credentials

Stored per merchant channel in `BotChannel.config_json`:

- `provider_mode=meta_cloud`
- `phone_number_id`
- `access_token`
- `business_account_id`
- `display_phone_number`

Sensitive values are masked in API responses.

## Recommended Setup Flow: Embedded Signup

1. Merchant opens `/dashboard/integrations`.
2. Merchant opens WhatsApp settings.
3. Merchant clicks `Подключить через Meta`.
4. ZANI calls `POST /api/business-connectors/whatsapp-embedded-signup/start/`.
5. ZANI opens the returned `authorization_url`.
6. Merchant logs in to Meta and selects/creates Business, WABA and phone number.
7. Meta returns an authorization `code` and selected WhatsApp phone metadata.
8. The integrations UI listens for the OAuth popup callback and Meta Embedded Signup `postMessage` result, then fills the returned `code`, `state`, `phone_number_id`, `waba_id` and display phone when Meta provides them.
9. ZANI calls `POST /api/business-connectors/whatsapp-embedded-signup/complete/` with:
   - `business`;
   - `code`;
   - `state`;
   - `redirect_uri`;
   - `phone_number_id`;
   - `waba_id`;
   - `display_phone_number`.
10. Backend exchanges `code` for access token, stores credentials in `BotChannel`, and marks the connector connected.
11. Merchant sends a message to the connected WhatsApp number and verifies it appears in Unified Inbox.

## Manual Fallback Flow

This is for support/debugging, not the primary merchant path.

1. Create or select a merchant bot in ZANI.
2. Open `/dashboard/integrations`.
3. Open WhatsApp settings.
4. Create WhatsApp channel if missing.
5. Paste Meta `phone_number_id` and `access_token`.
6. Save credentials.
7. Check Meta access.
8. In Meta App dashboard, configure webhook:
   - Callback URL: `https://YOUR_API_DOMAIN/api/integrations/whatsapp/webhook/`
   - Verify token: value of `WHATSAPP_VERIFY_TOKEN`
   - Subscribe to WhatsApp messages.
9. Send a message to the connected WhatsApp number.
10. Verify the message appears in Unified Inbox.

## Runtime Model

- Meta verifies the callback through `GET /api/integrations/whatsapp/webhook/`.
- Inbound messages arrive through `POST /api/integrations/whatsapp/webhook/`.
- ZANI validates `X-Hub-Signature-256` using `WHATSAPP_APP_SECRET`.
- ZANI resolves the merchant by `metadata.phone_number_id`.
- ZANI stores inbound messages in `BotConversation` / `BotMessage`.
- Outbound manager replies use `/{phone_number_id}/messages`.

## Local Development

When `WHATSAPP_ENABLED=False`, credentials can be saved and checked in mock mode. Real inbound webhooks require public HTTPS or a tunneling tool.

## Local Real Test

Use this flow before staging:

1. Start the local Django API with real Meta settings:

```bash
DATABASE_URL=sqlite:///db.sqlite3 \
WHATSAPP_ENABLED=True \
WHATSAPP_VERIFY_TOKEN=... \
WHATSAPP_APP_SECRET=... \
META_APP_ID=... \
META_APP_SECRET=... \
WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID=... \
.venv/bin/python manage.py runserver 0.0.0.0:8000
```

2. Start a public HTTPS tunnel to Django, for example to local port `8000`.
3. Run the local real-test checklist:

```bash
DATABASE_URL=sqlite:///db.sqlite3 \
WHATSAPP_ENABLED=True \
WHATSAPP_VERIFY_TOKEN=... \
WHATSAPP_APP_SECRET=... \
META_APP_ID=... \
META_APP_SECRET=... \
WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID=... \
.venv/bin/python manage.py whatsapp_local_real_test_check --public-url https://YOUR-TUNNEL-DOMAIN --fail-on-missing
```

4. In Meta App Dashboard configure:
   - Webhook callback URL from the command output;
   - Verify token from `WHATSAPP_VERIFY_TOKEN`;
   - Embedded Signup redirect URI from the command output.
5. Open ZANI through the same public app origin if testing Meta JS SDK browser restrictions, then use `/dashboard/integrations` -> WhatsApp -> `Подключить через Meta`.
6. After Embedded Signup completes, press `Завершить подключение`, then `Проверить Meta доступ`.
7. Send a WhatsApp message to the connected number and confirm it appears in Unified Inbox.

## Rollback

Disable one merchant:

1. Set their WhatsApp `BotChannel.status` to `paused`, or set `provider_mode=disabled`.
2. Remove/disable the webhook subscription in Meta if needed.
3. Tell support inbound WhatsApp messages will not enter ZANI until reconnected.

Disable platform traffic:

```env
WHATSAPP_ENABLED=False
```

## Smoke Check

Expected successful path:

1. WhatsApp channel has `phone_number_id_configured=true`.
2. WhatsApp channel has `access_token_configured=true`.
3. `whatsapp-test-connection` returns `ok=true`.
4. Meta webhook verification returns the challenge.
5. Inbound Meta message creates a WhatsApp conversation and message.
6. Manager reply creates outbound `BotMessage` and provider `IntegrationEventLog`.
