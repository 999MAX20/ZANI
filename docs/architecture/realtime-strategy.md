# Zani Realtime Strategy

Date: 2026-05-20

Zani needs near-realtime behavior for inbox, notifications, assignments, handoff and future SLA timers.

## Current Decision

Start with reliable polling.

Why:

- simple deployment;
- works on cheap hosting;
- no additional ASGI/WebSocket infrastructure yet;
- good enough for controlled pilots;
- avoids cross-tenant realtime complexity too early.

## Current Polling Baseline

Frontend intervals live in:

```text
frontend/src/lib/realtime.ts
```

Current intervals:

- notifications: 20 seconds;
- inbox conversation list: 12 seconds;
- selected inbox messages: 7 seconds.

Queries also refetch on window focus and reconnect.

## What This Covers

- notification count updates;
- notification dropdown freshness;
- new inbox conversations/messages after a short delay;
- assignment/handoff state after polling or mutation invalidation;
- mobile-friendly baseline without permanent socket connection.

## Limitations

Polling is not true realtime.

It does not yet cover:

- instant typing indicators;
- live multi-agent collaboration;
- high-frequency message streams;
- exact SLA timers;
- push notifications;
- server-driven invalidation.

## When To Move To SSE/WebSocket

Upgrade when at least one is true:

- inbox becomes the main daily workspace for many operators;
- message volume makes 7-12 second polling too slow or too expensive;
- customers need live assignment/handoff;
- SLA timers must be exact;
- mobile push/realtime notifications become product-critical.

## Recommended Future Architecture

Preferred path:

1. Keep polling fallback.
2. Add SSE for notifications/inbox events first.
3. Add WebSocket only if bidirectional live collaboration is needed.

Event channels must be tenant-scoped:

```text
business:{business_id}:notifications
business:{business_id}:inbox
conversation:{conversation_id}:messages
```

Never broadcast merchant events without backend permission checks and business scoping.

## Acceptance For Current Phase

- frontend build passes;
- polling constants are centralized;
- notification summary/list refresh without full page reload;
- inbox conversations/messages refresh without full page reload;
- deployment docs clearly say this is polling, not WebSocket/SSE.
