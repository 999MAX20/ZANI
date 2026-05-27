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
8. ZANI calls `POST /api/business-connectors/whatsapp-embedded-signup/complete/` with:
   - `business`;
   - `code`;
   - `state`;
   - `redirect_uri`;
   - `phone_number_id`;
   - `waba_id`;
   - `display_phone_number`.
9. Backend exchanges `code` for access token, stores credentials in `BotChannel`, and marks the connector connected.
10. Merchant sends a message to the connected WhatsApp number and verifies it appears in Unified Inbox.

## Manual Fallback Flow

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
