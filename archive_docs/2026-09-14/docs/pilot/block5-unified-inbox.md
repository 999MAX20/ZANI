<!-- ZANI_ARCHIVE_HEADER_BEGIN -->
> ARCHIVED 2026-09-14 · HISTORICAL_DELIVERY
>
> Original path: `docs/pilot/block5-unified-inbox.md`. Source: `4ba3cbf9fddcc6e1baa172b494c781550c090693`.
> Исторический отчёт delivery-блока. Его проверки относятся только к исходному снимку; оставшиеся live/policy gates не закрываются архивацией.
> Historical evidence only; not an implementation queue or current release approval.
> Original relative references below are preserved as historical text; resolve them against the original path.
<!-- ZANI_ARCHIVE_HEADER_END -->

# ZANI Block 5 — Unified Inbox / Business Inbox Pulse

## Goal
Strengthen the pilot-ready inbox without promising full production omnichannel.

ZANI now exposes a merchant-safe inbox summary that shows:

- total conversations;
- unread conversations;
- handoff-required conversations;
- assigned-to-me conversations;
- unassigned conversations;
- urgent/high-priority conversations;
- paused-bot conversations;
- channel health for Website, Telegram, WhatsApp, Instagram;
- next actions for the owner/manager;
- clear pilot positioning so WhatsApp/Instagram are not sold as production-ready too early.

## Backend
Added list-level endpoint:

```http
GET /api/inbox/conversations/summary/
```

The endpoint is tenant-safe and uses the same merchant permission logic as the inbox.

## Frontend
The Conversations page now shows a Business Inbox Pulse card above the inbox:

- key counters;
- channel cards;
- pilot notes;
- next actions.

## Important positioning
Website/landing chat is available for pilot.
Telegram is beta.
WhatsApp and Instagram are roadmap/production provider work, not a ready production promise.

## Tests
Added tests for:

- inbox summary channel health;
- tenant safety;
- roadmap positioning.
