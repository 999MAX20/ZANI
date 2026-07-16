# Mobile Observability Runbook

Date: 2026-06-27

Use this runbook for native Zani mobile incidents and staging release checks.

## Signals

Backend mobile signals are emitted through the `zani.mobile` logger and the mobile telemetry summary endpoint:

```text
GET /api/mobile/v1/operations/summary/?business=<business_id>
```

The endpoint returns device/session counts, active/revoked push-token counts, idempotency counts by endpoint and recent mobile telemetry events. It never exposes raw push tokens, refresh tokens or idempotency keys.

## If Push Does Not Arrive

1. Check that the device is not revoked:

   ```text
   GET /api/mobile/v1/devices/?business=<business_id>
   ```

2. Check operations summary:

   ```text
   push_tokens.active > 0
   telemetry.by_kind.push_delivery
   telemetry.recent status planned | sent | failed | skipped
   ```

3. Check worker/runtime:

   ```text
   MOBILE_PUSH_QUEUE_ENABLED=True
   MOBILE_PUSH_DELIVERY_ENABLED=True only after physical-device smoke
   notifications Celery queue is running
   ```

4. Run physical-device smoke:

   ```bash
   cd mobile
   ZANI_MOBILE_API_URL=https://api.example \
   ZANI_MOBILE_EMAIL=owner@example.com \
   ZANI_MOBILE_PASSWORD=... \
   ZANI_EXPO_PUSH_TOKEN=ExponentPushToken[...] \
   npm run smoke:push
   ```

5. Revoke the device and verify no further pushes are delivered to that token.

## If A Mobile Action Did Not Apply

1. Check the app-visible error:

   ```text
   401 -> session expired
   403 -> backend permission denied
   409 stale_state -> entity changed before replay
   400/422 -> validation issue
   5xx/network -> retry/offline queue
   ```

2. Check operations summary:

   ```text
   telemetry.by_kind.idempotency_created
   telemetry.by_kind.idempotency_replay
   telemetry.by_kind.idempotency_conflict
   telemetry.by_kind.stale_conflict
   idempotency.<endpoint>
   ```

3. For `stale_state`, refresh the affected screen and repeat the action from fresh data. Do not blindly replay stale writes.

4. For repeated idempotency conflicts, verify the app is not reusing an `Idempotency-Key` with a different body.

## Staging Release Gate

Backend:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.mobile.tests apps.notifications.tests -v 2
```

Mobile:

```bash
cd mobile
npm run release:gate
```

With staging credentials, `release:gate` also runs API smoke and physical push smoke when the relevant env values are present.

Optional non-physical load smoke:

```bash
cd mobile
ZANI_MOBILE_API_URL=https://staging-api.example \
ZANI_MOBILE_EMAIL=owner@example.com \
ZANI_MOBILE_PASSWORD=... \
ZANI_MOBILE_LOAD_TEST=true \
ZANI_MOBILE_LOAD_CONCURRENCY=8 \
ZANI_MOBILE_LOAD_ITERATIONS=40 \
npm run release:gate
```

Dashboard and alert requirements are defined in `docs/mobile-monitoring-dashboard.md`.

## Required Manual Checks Before Mobile Production

- API smoke passes against staging.
- A physical iOS or Android device registers a push token.
- A real notification is delivered to that device.
- Revoking the device disables future push delivery.
- Offline write replay is tested by disabling network, creating a safe action, restoring network and refreshing.
- Stale conflict is tested by queuing an action, changing the entity elsewhere and replaying.
- Store upload, TestFlight/internal-track review and signing validation are covered in `docs/mobile-store-release-checklist.md`.
