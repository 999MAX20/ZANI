# Zani Mobile

React Native + Expo mobile app shell for the Zani merchant control app.

## Run

```bash
cd mobile
npm install
cp .env.example .env
npm run start
```

Set `EXPO_PUBLIC_API_URL` to the backend origin, for example:

```text
http://127.0.0.1:8000
```

Set `EXPO_PUBLIC_EAS_PROJECT_ID` for production EAS builds so Expo push tokens are issued for the correct project.

Set `EXPO_PUBLIC_APP_VERSION` and `EXPO_PUBLIC_BUILD_NUMBER` for release builds. The backend controls minimum supported versions through `/api/mobile/v1/bootstrap/`.

Set `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_ENVIRONMENT` and `EXPO_PUBLIC_RELEASE` for production crash reporting.

The app uses `/api/mobile/v1/` endpoints and stores the native refresh token in SecureStore.

## Current scope

- Mobile auth with access-token memory storage and refresh-token SecureStore storage.
- Bootstrap restore and business switcher for users with multiple businesses.
- Operational tabs: home, today, actions, inbox, leads, clients, tasks, calendar and notifications.
- Native detail drill-down for clients, leads, tasks, appointments and inbox conversations.
- Inbox write action: sending a manager reply through `/api/mobile/v1/inbox/{id}/reply/` with `Idempotency-Key`.
- Lead write actions: assigning and taking a lead into work through `/api/mobile/v1/leads/{id}/assign/` and `/api/mobile/v1/leads/{id}/qualify/` with `Idempotency-Key`.
- Task write actions: completing, assigning to self, cancelling and snoozing through `/api/mobile/v1/tasks/{id}/.../` with `Idempotency-Key`.
- Alerts write action: marking a notification read through `/api/mobile/v1/notifications/{id}/mark-read/` with `Idempotency-Key`.
- Calendar write actions: confirming, cancelling and rescheduling an appointment through `/api/mobile/v1/appointments/{id}/.../` with `Idempotency-Key`.
- AI approval write actions: approving or rejecting pending approval requests through `/api/mobile/v1/ai/approval-requests/{id}/approve/` and `/reject/` with `Idempotency-Key`.
- Device tab for listing and revoking current user's mobile devices.
- Native push permission/token registration through Expo Notifications and `/api/mobile/v1/push-tokens/register/`.
- Mobile push preferences through `/api/mobile/v1/notification-preferences/`, with per-category enablement and redacted notification text by default.
- EAS build profiles for development, staging and production channels.
- Sentry bootstrap controlled by public Expo env values.
- Deep-link runtime and contract for `zani://...` and `https://app.zani.kz/mobile/...`.
- Backend-controlled version policy with a native forced-update screen for unsupported app versions.
- `X-Request-ID` propagation on mobile API calls for backend/mobile error correlation.
- Bounded AsyncStorage offline action queue with idempotency-key dedupe, automatic replay, retry limits, stale-state checks and visible conflict state.
- Full-screen native detail drill-down for clients, leads, tasks, appointments and inbox conversations.
- Local/staging smoke scripts: `npm run smoke:api` and `npm run smoke:push`.
- Non-physical staging load smoke: `npm run load:api`.
- Release gate script: `npm run release:gate`.
- RU, KK and EN dictionaries.
- Light/dark native theme loaded from `../design-tokens/zani-native.tokens.json`.

Operational docs:

- `../docs/mobile-observability-runbook.md`
- `../docs/mobile-monitoring-dashboard.md`
- `../docs/mobile-store-release-checklist.md`
- `../docs/mobile-privacy-copy.md`

Remaining production work: real physical-device push delivery confirmation, store upload/review checks and automated mobile E2E on a staging device farm.
