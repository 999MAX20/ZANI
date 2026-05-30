# Telegram Merchant Connector

## Purpose

Telegram is a per-merchant communication connector. Each merchant connects their own BotFather bot, and ZANI uses that bot to receive client messages, create inbox conversations, run the AI/CRM pipeline, and send manager replies back to Telegram.

## Production Environment

Required:

```env
TELEGRAM_ENABLED=True
TELEGRAM_BASE_API_URL=https://api.telegram.org
```

Recommended before paid traffic:

```env
AUTOMATIONS_RUN_INLINE=False
SENTRY_DSN=...
```

The API must be available through public HTTPS. Telegram delivers merchant messages only to the configured webhook URL.

## Merchant Setup Flow

1. Merchant creates a bot in `@BotFather`.
2. Merchant copies the bot token.
3. In ZANI, open the merchant bot detail page.
4. Add a Telegram channel if it does not exist.
5. Paste the BotFather token into the Telegram setup card.
6. Save token.
7. Test token.
8. Connect webhook.
9. Send a message to the Telegram bot and verify it appears in Unified Inbox.

## Runtime Model

- Raw `bot_token` is stored only in `BotChannel.config_json.bot_token`.
- A per-channel `webhook_secret` is generated when missing.
- `setWebhook` sends the per-channel secret to Telegram as `secret_token`.
- Incoming webhooks are accepted only when the Telegram secret header matches a configured Telegram channel secret or the optional platform fallback secret.
- ZANI resolves the merchant channel by secret and routes messages into `BotConversation` / `BotMessage`.

Webhook endpoint:

```text
POST /api/integrations/telegram/webhook/
```

## Rollback

Disable a merchant Telegram connector:

1. Set the merchant `BotChannel.status` to `paused` or remove the Telegram webhook in BotFather/provider API.
2. If global traffic must stop, set `TELEGRAM_ENABLED=False`.
3. Tell support that inbound Telegram messages will not enter ZANI until the channel is reconnected.

## Production Smoke Check

Expected successful path:

1. `telegram-test-connection` returns `ok=true`.
2. `set-telegram-webhook` returns `ok=true`.
3. A client message creates a Telegram `BotConversation`.
4. A manager reply from Inbox creates an outbound `BotMessage`.
5. `IntegrationEventLog` has processed inbound and sent outbound Telegram events.
