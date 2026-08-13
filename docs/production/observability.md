# Observability And Sentry

Дата: 23.05.2026

Goal: staging/production errors must be visible before paid beta.

## 1. Backend Sentry Env

Required for staging and production:

```env
SENTRY_DSN=https://...
SENTRY_TRACES_SAMPLE_RATE=0.05
ENVIRONMENT=staging
RELEASE=<git-sha-or-release-tag>
LOG_LEVEL=INFO
```

The backend initializes Sentry with:

```text
send_default_pii=False
environment=ENVIRONMENT
release=RELEASE
```

Do not log raw tokens, provider credentials, uploaded file contents, message payloads or customer PII.

## 2. Runtime Check

Check config without sending an event:

```bash
python manage.py observability_runtime_check
```

Fail deployment when Sentry is missing:

```bash
python manage.py observability_runtime_check --fail-on-missing
```

Send a safe smoke event:

```bash
python manage.py observability_runtime_check --capture-test-message
```

The smoke event contains only environment/release and no merchant/customer payload.

## 3. Render Smoke Script

After the backend deploy has `SENTRY_DSN`, `ENVIRONMENT` and `RELEASE`, run:

```bash
scripts/render_h3_observability_smoke.sh
```

To also send a safe Sentry event:

```bash
CAPTURE_SENTRY_SMOKE=true scripts/render_h3_observability_smoke.sh
```

The script fails fast when:

- `SENTRY_DSN` is missing;
- `ENVIRONMENT` is still `development`;
- `RELEASE` is empty or still `local`;
- the production readiness observability item is red.

## 4. Production Readiness Audit

The production readiness audit checks `SENTRY_DSN`:

```bash
python manage.py production_readiness_audit --fail-on-critical
```

The `observability.sentry` item must be green before paid beta.

## 5. Frontend Sentry

Frontend Sentry is intentionally deferred until backend staging monitoring is green.

When added later:

- use a separate frontend project or DSN;
- set environment/release;
- filter sensitive request payloads;
- source maps should be uploaded only in CI with private access.

## 6. H3 Acceptance

H3 is complete when:

- backend Sentry DSN is configured in staging;
- runtime check passes;
- safe test message appears in Sentry;
- production audit observability check is green;
- no secrets or raw customer payloads are captured.
