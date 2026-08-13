# Live Connector Test Runbook

This runbook is for the first real local test of the production connector paths:

- WhatsApp: Meta Embedded Signup -> Meta Cloud API -> per-merchant channel;
- Instagram: Meta OAuth -> linked Page/Instagram Business account -> per-merchant channel;
- Kaspi: merchant access key -> read-only orders import;
- МойСклад: merchant access key -> read-only product/stock/sales/client import.
- Wildberries: merchant Statistics token -> read-only orders/sales/returns import.
- Ozon: merchant Client-Id/API key -> read-only FBS/FBO postings and stock import.

## Required Values

Do not use placeholders for a live test.

```env
META_APP_ID=
META_APP_SECRET=

WHATSAPP_ENABLED=True
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID=
WHATSAPP_GRAPH_BASE_URL=https://graph.facebook.com
WHATSAPP_GRAPH_API_VERSION=v25.0
WHATSAPP_EMBEDDED_SIGNUP_LOGIN_URL=https://www.facebook.com/dialog/oauth

INSTAGRAM_ENABLED=True
INSTAGRAM_VERIFY_TOKEN=
INSTAGRAM_APP_SECRET=
INSTAGRAM_GRAPH_BASE_URL=https://graph.facebook.com
INSTAGRAM_GRAPH_API_VERSION=v25.0

KASPI_ENABLED=True
KASPI_API_BASE_URL=https://kaspi.kz/shop/api/v2

MOYSKLAD_ENABLED=True
MOYSKLAD_API_BASE_URL=https://api.moysklad.ru/api/remap/1.2

WILDBERRIES_ENABLED=True
WILDBERRIES_STATISTICS_API_BASE_URL=https://statistics-api.wildberries.ru

OZON_ENABLED=True
OZON_SELLER_API_BASE_URL=https://api-seller.ozon.ru
```

`INSTAGRAM_APP_SECRET` can match `META_APP_SECRET` when the same Meta app handles Instagram webhooks.

## Public HTTPS

Meta cannot call `localhost`. Start a public HTTPS tunnel to local Django port `8000`.

Expected public URLs:

- WhatsApp webhook: `https://PUBLIC-DOMAIN/api/integrations/whatsapp/webhook/`
- Instagram webhook: `https://PUBLIC-DOMAIN/api/integrations/instagram/webhook/`
- WhatsApp Embedded Signup redirect: `https://PUBLIC-DOMAIN/dashboard/integrations`
- Instagram OAuth redirect: `https://PUBLIC-DOMAIN/dashboard/integrations?zani_provider=instagram`

For a quick local tunnel when no dedicated tunnel is installed:

```bash
npx localtunnel --port 8000
```

Use the returned HTTPS URL as `PUBLIC_URL`.

## Meta App Setup

In Meta App Dashboard:

1. Add the WhatsApp product and Embedded Signup configuration.
2. Add valid OAuth redirect URIs:
   - `https://PUBLIC-DOMAIN/dashboard/integrations`
   - `https://PUBLIC-DOMAIN/dashboard/integrations?zani_provider=instagram`
3. Configure WhatsApp webhook:
   - callback URL: `https://PUBLIC-DOMAIN/api/integrations/whatsapp/webhook/`
   - verify token: `WHATSAPP_VERIFY_TOKEN`
   - subscribe to messages.
4. Configure Instagram webhook:
   - callback URL: `https://PUBLIC-DOMAIN/api/integrations/instagram/webhook/`
   - verify token: `INSTAGRAM_VERIFY_TOKEN`
   - subscribe to Instagram messaging events.

## Run Local Services

Restart Django after editing `.env`.

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py runserver 0.0.0.0:8000
```

Frontend:

```bash
cd frontend
npm run dev -- --host 0.0.0.0
```

## Merchant Connection Test

1. Open `/dashboard/integrations`.
2. WhatsApp: click `Подключить через Meta`, finish Embedded Signup, then run `Проверить Meta доступ`.
3. Instagram: click `Подключить через Meta`, finish Meta OAuth, then run `Проверить`.
4. Kaspi: open guided key panel, save the seller access key, run `Проверить`, then `Загрузить заказы`.
5. МойСклад: open guided key panel, save the access key, run `Проверить`, then `Загрузить данные`.
6. Wildberries: open guided key panel, save the Statistics token, run `Проверить`, then `Загрузить данные`.
7. Ozon: open guided key panel, save `Client-Id` and `API key`, run `Проверить`, then `Загрузить данные`.

## One Command Readiness Gate

After saving Kaspi and МойСклад keys in the UI, get their connector ids from the API/admin/network response and run:

```bash
PUBLIC_URL=https://PUBLIC-DOMAIN \
CONNECTOR_ID_KASPI=123 \
CONNECTOR_ID_MOYSKLAD=456 \
CONNECTOR_ID_WILDBERRIES=789 \
CONNECTOR_ID_OZON=321 \
scripts/live_connectors_readiness.sh
```

To make real validation calls to Kaspi and МойСклад:

```bash
PUBLIC_URL=https://PUBLIC-DOMAIN \
CONNECTOR_ID_KASPI=123 \
CONNECTOR_ID_MOYSKLAD=456 \
CONNECTOR_ID_WILDBERRIES=789 \
CONNECTOR_ID_OZON=321 \
VALIDATE=1 \
scripts/live_connectors_readiness.sh
```

The command must pass before calling the setup production-ready.
