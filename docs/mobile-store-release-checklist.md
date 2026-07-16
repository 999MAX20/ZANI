# Mobile Store Release Checklist

Date: 2026-06-27

This checklist covers release items that cannot be proven by unit tests alone. Keep staging and production credentials separate.

## Build Configuration

- `mobile/app.json` has stable identifiers:
  - iOS bundle id: `kz.zani.mobile`
  - Android package: `kz.zani.mobile`
  - URL scheme: `zani`
  - universal/app links: `https://app.zani.kz/mobile/...`
- `mobile/eas.json` has separate `development`, `staging` and `production` channels.
- `EXPO_PUBLIC_EAS_PROJECT_ID` is set for any build that registers Expo push tokens.
- `EXPO_PUBLIC_API_URL` points to the matching backend environment.
- `EXPO_PUBLIC_APP_VERSION`, `EXPO_PUBLIC_BUILD_NUMBER` and `EXPO_PUBLIC_RELEASE` match the submitted build.
- `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_ENVIRONMENT` and trace sample rate are set for staging/production.

## Apple App Store

- Apple Developer team membership is active.
- App Store Connect app record exists for `kz.zani.mobile`.
- App icon, launch screen and screenshots are prepared for required device sizes.
- Privacy policy URL and support URL are final.
- Sign in flow is testable by Apple review without private merchant data.
- Push notification entitlement is enabled before physical push smoke.
- Associated domain file is served for `app.zani.kz`.

## Google Play

- Google Play app record exists for `kz.zani.mobile`.
- Play App Signing is configured.
- Internal testing track is available before production rollout.
- Privacy policy URL, data safety answers and support contact are final.
- Android app links are verified for `app.zani.kz`.
- FCM/Expo push configuration is complete before physical push smoke.

## Backend Release Gates

- `MOBILE_API_VERSION`, `MOBILE_APP_MIN_SUPPORTED_VERSION`, `MOBILE_APP_LATEST_VERSION`, `MOBILE_APP_UPDATE_URL_IOS` and `MOBILE_APP_UPDATE_URL_ANDROID` are set for the target environment.
- Mobile rate-limit scopes are configured.
- Push worker queue is running with `MOBILE_PUSH_QUEUE_ENABLED=True`.
- `MOBILE_PUSH_DELIVERY_ENABLED=True` is enabled only after physical-device smoke succeeds.
- Sentry backend and mobile projects share release naming for correlation.

## Automated Checks

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test apps.mobile.tests apps.notifications.tests -v 2

cd mobile
npm run typecheck
npm run release:gate
```

With staging credentials:

```bash
cd mobile
ZANI_MOBILE_API_URL=https://staging-api.example \
ZANI_MOBILE_EMAIL=owner@example.com \
ZANI_MOBILE_PASSWORD=... \
ZANI_MOBILE_LOAD_TEST=true \
npm run release:gate
```

## Physical Gates

These gates require a real device or store account access:

- iOS physical-device login and session restore.
- Android physical-device login and session restore.
- Real Expo/APNS/FCM token registration.
- Real notification delivery.
- Device revoke stops future push delivery.
- App Store/TestFlight upload and reviewer login.
- Google Play internal track upload and reviewer login.
