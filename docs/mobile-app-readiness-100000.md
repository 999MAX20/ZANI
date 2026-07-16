# Zani Mobile App Readiness For 100,000 Merchants

Date: 2026-06-27

This document defines the production path for a native mobile Zani app after the web launch. The target is not a thin MVP copy of the web cabinet. The target is a scalable merchant control app that can support at least 100,000 merchants without bypassing backend permissions, tenant isolation, audit, queues or operational observability.

Use this document with:

```text
docs/production-readiness.md
docs/production-readiness-10000-audit.md
docs/realtime-strategy.md
docs/design-system.md
docs/PERMISSION_MATRIX.md
docs/automation-runtime.md
docs/entitlements.md
docs/mobile-observability-runbook.md
docs/mobile-monitoring-dashboard.md
docs/mobile-store-release-checklist.md
docs/mobile-privacy-copy.md
```

## 1. Product Principle

The mobile app is an operational control surface, not a compressed desktop CRM.

Primary mobile jobs:

- see what needs attention now;
- answer new messages quickly;
- process and assign leads;
- view today's calendar;
- create or complete tasks;
- open client context before calling or replying;
- receive push notifications for urgent business events;
- approve or reject AI-assisted actions when confirmation is required.

The app must not become:

- a full admin console;
- a developer settings surface;
- a complete replacement for complex desktop setup;
- a mock-only demo client;
- a separate permission model.

## 2. Scale Target

Design target:

- 100,000 merchants;
- 1-10 active users per merchant on average;
- bursty mobile traffic at opening hours and evening closeout;
- high notification fanout for leads, inbox, tasks and appointments;
- mobile cold start p95 under 2.5s on a healthy connection;
- primary mobile home API p95 under 400ms from application backend excluding network;
- push event write path must be queue-backed and retryable.

Do not assume one mobile request can load the same payload as a desktop dashboard. Mobile endpoints must be compact, paginated and purpose-built.

## 3. Architecture Decision

Recommended first production stack:

```text
React Native + Expo
```

Reason:

- reuses TypeScript domain types and API client patterns;
- faster first app release than fully native iOS/Android;
- supports EAS build, OTA updates with release discipline, and push notification integration;
- lets the product team iterate mobile workflows while backend contracts stay stable.

Native SwiftUI/Kotlin remains a later option if a specific workflow needs deeper platform performance. The backend must not depend on this choice.

## 4. Non-Negotiable Backend Rules

Mobile must use the same production backend rules as web:

- tenant isolation is enforced by backend queryset/service layers;
- role permissions are enforced by backend permissions;
- lifecycle transitions go through domain services;
- destructive actions are archive/audit-first;
- AI can assist, but critical actions require explicit confirmation;
- provider credentials never reach mobile clients;
- mobile endpoints must not return data from other businesses, even when users switch workspaces.

Mobile-specific APIs are allowed only as orchestration/read-model endpoints. They must call the same services/selectors used by the main CRM.

## 5. Mobile Auth And Session Model

Web uses HttpOnly refresh cookie. Native mobile needs a separate token storage model:

- access token: memory only;
- refresh token: iOS Keychain / Android Keystore through the mobile runtime;
- refresh token rotation enabled;
- refresh token reuse detection should revoke the affected mobile session;
- logout must revoke the current device session;
- security settings must support "log out from all devices";
- platform/support users should not receive merchant mobile access by default unless explicitly supported.

Required backend foundation:

```text
MobileDevice
MobileSession
MobilePushToken
```

Minimum fields:

```text
business
user
device_id_hash
platform: ios | android
app_version
build_number
os_version
device_model
push_provider: apns | fcm | expo
push_token_hash
last_seen_at
last_ip
revoked_at
revoked_reason
created_at
updated_at
```

Raw push tokens and refresh tokens must not be exposed in serializers or logs.

## 6. API Versioning

Before the mobile app ships, add a stable mobile API namespace:

```text
/api/mobile/v1/
```

Do not point the mobile app directly at arbitrary web endpoints for primary screens. Web endpoints may remain available for shared CRUD, but mobile screens need stable contracts with explicit payload budgets.

Required first endpoints:

```text
POST /api/mobile/v1/auth/login/
POST /api/mobile/v1/auth/refresh/
POST /api/mobile/v1/auth/logout/
POST /api/mobile/v1/devices/register/
GET /api/mobile/v1/devices/
POST /api/mobile/v1/devices/{id}/revoke/

GET /api/mobile/v1/bootstrap/
GET /api/mobile/v1/home/
GET /api/mobile/v1/today/
GET /api/mobile/v1/actions/
GET /api/mobile/v1/inbox/
GET /api/mobile/v1/leads/
GET /api/mobile/v1/clients/
GET /api/mobile/v1/tasks/
GET /api/mobile/v1/appointments/
GET /api/mobile/v1/notifications/
GET /api/mobile/v1/notification-preferences/
GET /api/mobile/v1/inbox/{id}/
GET /api/mobile/v1/leads/{id}/
GET /api/mobile/v1/clients/{id}/
GET /api/mobile/v1/tasks/{id}/
GET /api/mobile/v1/appointments/{id}/
```

`GET /api/mobile/v1/bootstrap/` must include `version_policy` so the backend can require an app update before breaking mobile API changes reach production clients.

Write endpoints should reuse existing domain services:

```text
POST /api/mobile/v1/leads/{id}/assign/
POST /api/mobile/v1/leads/{id}/qualify/
POST /api/mobile/v1/tasks/{id}/complete/
POST /api/mobile/v1/tasks/{id}/assign-to-me/
POST /api/mobile/v1/tasks/{id}/cancel/
POST /api/mobile/v1/tasks/{id}/snooze/
POST /api/mobile/v1/notification-preferences/
POST /api/mobile/v1/notifications/{id}/mark-read/
POST /api/mobile/v1/appointments/{id}/confirm/
POST /api/mobile/v1/inbox/{id}/reply/
POST /api/mobile/v1/appointments/{id}/cancel/
POST /api/mobile/v1/appointments/{id}/reschedule/
POST /api/mobile/v1/ai/approval-requests/{id}/approve/
POST /api/mobile/v1/ai/approval-requests/{id}/reject/
```

## 7. Payload Budgets

Mobile endpoints must have budgets so they stay fast at scale.

Initial targets:

| Endpoint | Max JSON target | Notes |
| --- | ---: | --- |
| `/bootstrap/` | 30 KB | user, businesses, permissions summary, feature flags, theme/version metadata |
| `/home/` | 50 KB | only today's KPIs, attention items, unread counts, urgent actions |
| `/today/` | 80 KB | appointments/tasks for visible date range only |
| `/actions/` | 50 KB | prioritized actionable queue |
| `/inbox/` | 100 KB | paginated conversation list, latest message preview only |
| `/leads/` | 100 KB | paginated lead queue with compact client summary |
| `/clients/` | 100 KB | paginated client directory with compact contact fields |
| `/tasks/` | 100 KB | paginated task queue, status/due filters only |
| `/appointments/` | 100 KB | paginated calendar list, date/status filters only |
| `/notifications/` | 80 KB | paginated unread/recent notifications |

Large detail payloads must load on demand. Avoid sending full nested entities to mobile list screens.

## 8. Push Notifications

Push must be built as a queue-backed delivery layer, not as inline work inside API requests.

Event sources:

- new lead;
- new website/Telegram/WhatsApp/Instagram message;
- conversation assigned to user;
- task assigned or overdue;
- appointment due, changed, confirmed or cancelled;
- integration failure requiring owner attention;
- AI approval request awaiting confirmation.

Required behavior:

- notification writes are idempotent;
- push delivery is async through `notifications` queue;
- failed push attempts are stored with retry metadata;
- user notification preferences are respected;
- urgent system/security events can bypass normal noise preferences where product rules allow;
- device revocation stops future push delivery;
- no sensitive customer text in push body unless allowed by merchant/user privacy settings.

Suggested default push content:

```text
New lead in Zani
Open to respond
```

Detailed client names/message text should be controlled by a privacy setting.

## 9. Realtime Strategy

Use existing realtime strategy as baseline:

```text
docs/realtime-strategy.md
```

Mobile v1 can use polling plus push:

- home/actions: refresh on foreground and every 60 seconds while active;
- inbox: refresh every 15-20 seconds while open;
- notifications: refresh every 20-30 seconds while active;
- push wakes the app into a targeted refresh.

Do not require permanent sockets for v1. Add SSE/WebSocket later only when inbox SLA and collaborative workflows need it.

## 10. Offline And Idempotency

Mobile must handle poor networks without corrupting CRM state.

Phase 1 offline:

- cache bootstrap, home, today, recent inbox and recent leads;
- show stale-data state with last sync time;
- queue only safe actions:
  - create note;
  - complete task;
  - mark notification read;
  - draft reply locally before send.

Phase 2 offline:

- enqueue lead status changes and task edits with idempotency keys;
- conflict detection for stale entity versions;
- retry with exponential backoff;
- user-visible failure state for actions that cannot be replayed.

Every mobile write endpoint must accept:

```text
Idempotency-Key
```

The server should store idempotency per business, user, endpoint and key for a bounded retention window.

## 11. Data Model Additions

Do not add these blindly in one migration without reviewing existing notifications and auth layers. This is the required model direction.

Recommended apps:

```text
apps.mobile
apps.notifications
```

New or extended models:

- `MobileDevice`;
- `MobileSession`;
- `MobilePushToken`;
- `MobileIdempotencyKey`;
- optional `MobileAppEvent` for product analytics sampling.

Integration points:

- `apps.accounts` for user/session ownership;
- `apps.businesses` for business membership and active role checks;
- `apps.notifications` for push fanout and preferences;
- `apps.core.audit` for session revocation and security-sensitive events.

## 12. Mobile Screen Map

First release should include:

1. Auth and business switcher.
2. Home/action center.
3. Leads queue.
4. Inbox/conversations.
5. Today calendar.
6. Clients search/detail.
7. Tasks.
8. Notifications.
9. Account/device/session settings.

Not first release:

- full integration setup;
- pricing/repricing controls;
- platform admin;
- complex analytics dashboards;
- heavy data import/export;
- full automation builder.

Those stay web-first until mobile usage proves they are daily workflows.

## 13. Design System For Native App

The mobile app must reuse Zani design tokens, not copy CSS classes.

Required token export:

```text
colors
spacing
radius
typography
shadow/elevation
status colors
light/dark theme values
```

Rules:

- light and dark themes differ by color tokens only;
- authenticated app screens remain operational, not marketing-like;
- pink accent is restrained and follows `docs/design-system.md`;
- cards, lists and rows must match the web dashboard rhythm but use native mobile density;
- all text must come from i18n dictionaries from day one: RU, KK, EN.

## 14. Observability

Mobile production requires:

- Sentry mobile SDK;
- release and build number in every error;
- API request correlation id;
- device/session id hash in backend logs;
- push delivery metrics;
- mobile auth failure metrics;
- cold start, screen load and API latency product metrics;
- crash-free sessions dashboard.

Do not log:

- refresh tokens;
- push tokens;
- provider credentials;
- full customer message bodies unless explicitly sanitized and required for debugging.

## 15. Rate Limits And Abuse Controls

Mobile scopes should be separate from web/public scopes.

Recommended initial scopes:

```text
mobile_auth_login: 10/min
mobile_auth_refresh: 60/min
mobile_device_register: 20/hour
mobile_bootstrap: 60/min
mobile_home: 120/min
mobile_list: 180/min
mobile_write: 60/min
mobile_push_register: 20/hour
```

These must be tuned with real traffic. High refresh rates should be investigated because they usually indicate app lifecycle bugs.

## 16. 100,000 Merchant Infrastructure Notes

Mobile increases read bursts and notification fanout.

Before public mobile launch, production infrastructure must include:

- managed Postgres with PITR;
- read replica strategy for heavy read/reporting later;
- managed Redis with queue visibility;
- separate worker pool for push/notifications;
- object storage for media and attachments;
- CDN for public static/mobile assets;
- Sentry and uptime monitoring;
- alerts for API p95 latency, DB slow queries, queue lag and push failures.

Scale assumptions to validate through load tests:

- mobile home peak RPS;
- inbox polling RPS;
- refresh-token rotation pressure;
- push fanout throughput;
- database indexes for `business_id`, `user_id`, `updated_at`, status fields and assigned-user fields;
- queue lag under notification bursts.

## 17. Build And Release Discipline

Mobile release must have:

- separate staging and production apps;
- separate API base URLs;
- EAS channels or equivalent release tracks;
- feature flags for incomplete mobile surfaces;
- forced minimum version support for breaking API changes;
- rollback plan for app config and backend feature flags.

Do not ship mobile clients against unstable unversioned API contracts.

## 18. Implementation Phases

### Phase 0: Contracts And Readiness

- Create `/api/mobile/v1/` namespace.
- Define OpenAPI/schema snapshots for mobile endpoints.
- Add mobile auth/session/device models behind feature flag.
- Add mobile rate-limit scopes.
- Export design tokens for native app.
- Add mobile API tests for tenant isolation and permissions.

Exit criteria:

- mobile login/refresh/logout works in backend tests;
- device registration stores no raw tokens in API output;
- mobile bootstrap respects business membership and permissions;
- web auth remains unchanged.

### Phase 1: Native App Foundation

- Create Expo app package.
- Add auth, secure storage, API client, i18n and theme.
- Implement bootstrap, business switcher, home, actions and notifications.
- Add Sentry mobile.

Exit criteria:

- owner and manager can log in on staging;
- app restores session after restart;
- theme and language switching work;
- mobile home cold start budget is measured.

### Phase 2: Daily Merchant Workflows

- Leads queue.
- Inbox reply.
- Today calendar.
- Task complete/assign.
- Client search/detail.
- Push notification registration and delivery.

Exit criteria:

- every write action has backend permission tests;
- push delivery is queue-backed;
- critical actions write audit/activity where required;
- app works under poor network with clear stale/error states.

### Phase 3: Scale Hardening

- Load test mobile endpoints.
- Add queue lag dashboards.
- Tune DB indexes.
- Add idempotency key storage for mobile writes.
- Add session/device security UI.
- Add mobile e2e smoke on staging.
- Add non-physical API load smoke to release gate.
- Add mobile dashboard, store-release and privacy checklists.

Exit criteria:

- load test report covers 10k and projected 100k merchant paths;
- no endpoint depends on unbounded nested payloads;
- mobile API p95 budgets are tracked.
- store submission is blocked only by physical-device, signing and store-review gates.

## 19. First Engineering Tasks

Recommended next code tasks, in order:

1. Add `apps.mobile` with device/session/idempotency models and tests. Done.
2. Add mobile auth views under `/api/mobile/v1/auth/`. Done.
3. Add `/api/mobile/v1/bootstrap/` selector with compact permissions/business payload. Done.
4. Add mobile rate-limit scopes and production audit checks. Done.
5. Add push token registration endpoint without push provider delivery yet. Done.
6. Add `/api/mobile/v1/home/` compact read model with payload budget and permission-aware sections. Done.
7. Export design tokens from web theme into a JSON artifact for native app.
8. Scaffold Expo app with secure native session storage and first login/home flow. Done.
9. Add mobile today/actions/inbox compact read models with payload budget tests. Done.
10. Add mobile leads/notifications/clients/tasks/appointments compact read models with payload budget tests. Done.
11. Add native design token JSON contract and consume it from Expo theme. Done.
12. Store mobile push tokens encrypted for future provider delivery without exposing raw tokens in serializers. Done.
13. Add mobile device list/revoke security endpoints and app tab. Done.
14. Add mobile idempotency service and first task-complete write endpoint/app action. Done.
15. Add native Expo push permission/token registration against the mobile push-token endpoint. Done.
16. Add async mobile push delivery task on the `notifications` Celery queue with dry-run planning and retry/backoff. Done.
17. Add mobile notification mark-read write endpoint/app action with idempotency. Done.
18. Add mobile appointment confirm write endpoint/app action with idempotency. Done.
19. Add mobile lead assign and qualify/take-in-work write endpoints, plus native lead processing action, with backend permissions and idempotency. Done.
20. Add mobile AI approval review actions in the prioritized action queue, plus approve/reject endpoints with explicit native confirmation, backend permissions and idempotency. Done.
21. Add mobile inbox reply endpoint and native reply composer with backend conversation permissions and idempotency. Done.
22. Add mobile task assign-to-me, cancel and snooze endpoints plus native quick actions, reusing task services and idempotency. Done.
23. Add mobile appointment cancel and reschedule endpoints plus native quick actions, reusing scheduling services and idempotency. Done.
24. Add EAS build profiles, deep-link contract, Sentry mobile bootstrap and durable offline action-queue foundation. Done.
25. Add compact mobile detail endpoints and native drill-down modal for clients, leads, tasks, appointments and inbox conversations. Done.
26. Wire native deep links into runtime so `zani://...` and `/mobile/...` links open the right tab/detail after authentication. Done.
27. Add backend-controlled mobile app version policy and native forced-update screen for unsupported app versions. Done.
28. Add mobile API request-id propagation through `X-Request-ID` for backend/mobile error correlation. Done.
29. Add mobile push preferences with per-category enablement and redacted-by-default privacy mode. Done.
30. Add automatic offline replay with visible conflict state for idempotent mobile writes. Done.
31. Add mobile API contract regression coverage and local/staging smoke scripts. Done.
32. Move native detail drill-down from modal-only rendering to app stack detail-screen rendering. Done.
33. Add non-physical mobile API load smoke, monitoring dashboard spec, store-release checklist and privacy copy baseline. Done.

This keeps the mobile app scalable from the first commit instead of retrofitting security and contracts after a prototype.

## 20. Current Backend Foundation Status

Implemented on 2026-06-27:

- `apps.mobile` Django app.
- `MobileDevice`, `MobileSession`, `MobilePushToken`, `MobileIdempotencyKey`.
- HMAC hashing for raw mobile device IDs and push-token lookup.
- Encrypted mobile push-token storage for future delivery; serializers do not expose raw token, hash or encrypted value.
- `/api/mobile/v1/auth/login/`.
- `/api/mobile/v1/auth/refresh/`.
- `/api/mobile/v1/auth/logout/`.
- `/api/mobile/v1/devices/register/`.
- `/api/mobile/v1/devices/`.
- `/api/mobile/v1/devices/{id}/revoke/`.
- `/api/mobile/v1/push-tokens/register/`.
- `/api/mobile/v1/bootstrap/`.
- `/api/mobile/v1/home/`.
- `/api/mobile/v1/today/`.
- `/api/mobile/v1/actions/`.
- `/api/mobile/v1/inbox/`.
- `/api/mobile/v1/inbox/{id}/`.
- `/api/mobile/v1/leads/`.
- `/api/mobile/v1/leads/{id}/`.
- `/api/mobile/v1/leads/{id}/assign/`.
- `/api/mobile/v1/leads/{id}/qualify/`.
- `/api/mobile/v1/clients/`.
- `/api/mobile/v1/clients/{id}/`.
- `/api/mobile/v1/tasks/`.
- `/api/mobile/v1/tasks/{id}/`.
- `/api/mobile/v1/tasks/{id}/complete/`.
- `/api/mobile/v1/tasks/{id}/assign-to-me/`.
- `/api/mobile/v1/tasks/{id}/cancel/`.
- `/api/mobile/v1/tasks/{id}/snooze/`.
- `/api/mobile/v1/appointments/`.
- `/api/mobile/v1/appointments/{id}/`.
- `/api/mobile/v1/appointments/{id}/confirm/`.
- `/api/mobile/v1/appointments/{id}/cancel/`.
- `/api/mobile/v1/appointments/{id}/reschedule/`.
- `/api/mobile/v1/notifications/`.
- `/api/mobile/v1/notification-preferences/`.
- `/api/mobile/v1/inbox/{id}/reply/`.
- `POST /api/mobile/v1/ai/approval-requests/{id}/approve/`.
- `POST /api/mobile/v1/ai/approval-requests/{id}/reject/`.
- `design-tokens/zani-native.tokens.json`.
- Permission-aware mobile home sections for leads, tasks, appointments, conversations, deals and revenue.
- Permission-aware mobile today/actions/inbox/leads/clients/tasks/appointments/notifications read models with payload budgets.
- Permission-aware mobile detail read models for clients, leads, tasks, appointments and inbox conversations, with bounded related entities/messages/comments.
- `mobile/` Expo app scaffold with login, bootstrap restore, home/today/actions/inbox/leads/clients/tasks/calendar/notifications read models, SecureStore refresh token storage and three-language UI dictionary.
- Native drill-down detail modal from lists/action queue for clients, leads, tasks, appointments and inbox conversations.
- Mobile business switcher for users with access to multiple businesses.
- Mobile device/session security tab; revoking a device revokes active mobile sessions and push tokens for that device.
- Mobile task completion from the native tasks/today tabs through `/api/mobile/v1/tasks/{id}/complete/`, backend permissions, existing task service and `Idempotency-Key` replay protection.
- Mobile task assign-to-me, cancel and snooze from native task quick actions through `/api/mobile/v1/tasks/{id}/assign-to-me/`, `/cancel/` and `/snooze/`, backend permissions, existing task services, activity/audit where service requires it and `Idempotency-Key` replay protection.
- Mobile lead assignment and qualify/take-in-work from native leads/actions tabs through `/api/mobile/v1/leads/{id}/assign/` and `/api/mobile/v1/leads/{id}/qualify/`, backend permissions, existing lead services and `Idempotency-Key` replay protection.
- Mobile notification mark-read from the native alerts tab through `/api/mobile/v1/notifications/{id}/mark-read/` with backend permissions, recipient visibility and `Idempotency-Key` replay protection.
- Mobile appointment confirmation from native today/calendar tabs through `/api/mobile/v1/appointments/{id}/confirm/`, existing scheduling service and `Idempotency-Key` replay protection.
- Mobile appointment cancel and next-day reschedule from native calendar quick actions through `/api/mobile/v1/appointments/{id}/cancel/` and `/reschedule/`, existing scheduling services, availability validation and `Idempotency-Key` replay protection.
- Mobile inbox manager reply from native inbox composer through `/api/mobile/v1/inbox/{id}/reply/`, existing provider/conversation service and `Idempotency-Key` replay protection.
- Mobile AI approval review from the native actions queue through `/api/mobile/v1/ai/approval-requests/{id}/approve/` and `/reject/`, with explicit native confirmation, backend permission checks by approval action type and `Idempotency-Key` replay protection.
- Native Expo push permission/token registration from authenticated mobile sessions.
- Expo push provider foundation that builds targeted, redacted dry-run delivery plans from in-app notifications.
- Per-user, per-business notification preferences now control mobile push delivery by category; push bodies are redacted by default and can show compact notification text only when the user explicitly selects full privacy mode.
- Async mobile push delivery worker task on the `notifications` Celery queue with sanitized activity logs and retry/backoff for provider failures.
- EAS build profiles for development, staging and production channels.
- Native Sentry bootstrap controlled by `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_ENVIRONMENT`, `EXPO_PUBLIC_RELEASE` and trace-sampling env values.
- Native deep-link runtime and contract for `zani://...` and `https://app.zani.kz/mobile/...` targets, including direct tab/detail routing after auth restore.
- Backend-controlled mobile app version policy in bootstrap, configured through `MOBILE_API_VERSION`, `MOBILE_APP_MIN_SUPPORTED_VERSION`, `MOBILE_APP_LATEST_VERSION`, `MOBILE_APP_UPDATE_URL_IOS` and `MOBILE_APP_UPDATE_URL_ANDROID`.
- Native forced-update screen that blocks unsupported app versions before users enter the CRM workspace.
- Mobile API requests send `X-Request-ID`; backend echoes/generates the same header through middleware for error correlation across app and server logs.
- Durable AsyncStorage offline action queue with bounded size, idempotency-key dedupe, automatic replay on refresh/load, retry limits, stale-state checks through `expected_updated_at` and visible conflict state for actions that cannot be safely replayed.
- Mobile API contract regression test fixes stable top-level response keys for `/api/mobile/v1/` read endpoints.
- Mobile API smoke script covers login, bootstrap and primary read endpoints against local/staging.
- Mobile API load smoke script covers repeated primary mobile read endpoints with configurable concurrency, iterations and p95 budget.
- Physical-device Expo push smoke script registers a real device token for manual delivery/revoke verification.
- Native detail drill-down now renders as a full detail screen with back behavior inside the app stack state instead of a modal-only drill-down.
- Mobile observability runbook documents push failures, action replay failures, stale conflicts, operations summary and release-gate commands.
- Mobile monitoring dashboard spec documents required panels, alerts and log fields for `zani.mobile` telemetry.
- Mobile store-release checklist documents EAS, App Store, Google Play, backend version policy and physical gates.
- Mobile privacy copy baseline documents RU/KK/EN push/session wording and store data categories.
- Mobile DRF throttle scopes and production-rate audit coverage.
- Regression tests for mobile auth/session rotation, tenant-scoped bootstrap, stable mobile API contracts, device list/revoke scoping, foreign-business rejection, encrypted push-token redaction, targeted push delivery planning, queued push dispatch, stale mobile write rejection, idempotent lead assignment/qualification, idempotent AI approval decisions, idempotent task completion and mobile home/today/actions/inbox/leads/clients/tasks/appointments/notifications tenant/permission scoping.

Still not implemented:

- real production Expo push delivery confirmation on a physical device;
- automated mobile E2E on a staging device farm.
