# Frontend Features Map

`features/` хранит продуктовые зоны React-приложения.

## Implemented Merchant CRM

- `auth` — login and auth state.
- `dashboard` — merchant dashboard.
- `leads` — leads workspace.
- `clients` — client list and client actions.
- `deals` — CRM deals/pipeline page.
- `tasks` — CRM tasks.
- `appointments` — appointment list.
- `calendar` — calendar day view.
- `conversations` — CRM conversations.
- `timeline` — activity timeline.
- `bots` — merchant bot list and detail placeholder.
- `services` — merchant services.
- `resources` — resources.
- `settings` — business settings and working hours.
- `analytics` — MVP analytics page.
- `automations` — automation foundation UI.
- `assistant` — placeholder CRM assistant page.

## Implemented Platform Admin

- `platform` — protected Platform Admin placeholder pages and separate layout.

## Implemented Public Website

- `public` — public Zani website shell for `/`, `/pricing`, `/bots`, `/crm`, `/contacts`.

## Implemented Billing Foundation

- Public pricing loads plans from `/api/billing/plans/`.
- Merchant settings displays `/api/billing/current-subscription/`.

## Implemented Merchant CRM UI Upgrade

- Dashboard has quick actions, operational KPI cards, latest leads, upcoming appointments, attention items.
- Shared UI has loading skeletons, useful empty states, polished error states.
- Shared `DataTable` has upgraded visual styling, empty actions and loading state.
- Core merchant pages use clearer empty-state CTAs for first data entry.

## Implemented Bots Foundation

- Merchant bots live at `/dashboard/bots`.
- Bot detail placeholder lives at `/dashboard/bots/:id`.
- Public website `/bots` remains separate from Merchant CRM.
- API clients exist for bots, bot channels, bot conversations and bot messages.

## Implemented Website Chat Widget Foundation

- Bot detail has a website chat preview form.
- Website channel exposes a `public_token` for public chat endpoints.
- Preview can create bot conversations/messages and, with phone or email, website clients/leads.
- No realtime, AI replies, Telegram, WhatsApp or production embed SDK yet.

## Implemented Telegram Integration Skeleton

- Backend endpoint exists at `/api/integrations/telegram/webhook/`.
- Inbound Telegram updates are saved into bot conversations/messages.
- Merchant Telegram tokens remain in `BotChannel.config_json`, not frontend or env.
- No frontend Telegram UI is added yet.

## Implemented AI Core Foundation

- Backend AI Core exists in `apps.ai_core`.
- AI request logs and business knowledge items are tenant-scoped API resources.
- AI service layer returns a controlled mock when `OPENAI_API_KEY` is empty.
- Automatic bot replies are not wired yet.

## Implemented AI Assistant for CRM

- `/dashboard/ai-assistant` calls `/api/ai/assistant/chat/`.
- Assistant answers use tenant-safe CRM context from the active business.
- Responses show mock/model/log metadata and are saved in `AIRequestLog`.

## Implemented AI Bot Replies MVP

- Bot detail can request a suggested reply from `/api/bot-conversations/{id}/suggest-reply/`.
- Suggested replies use recent bot conversation messages and business knowledge.
- Replies are drafts only; they are not auto-sent and no outbound message is created.

## Planned

- Automation foundation.

Platform routes must stay separate from Merchant CRM layout.
