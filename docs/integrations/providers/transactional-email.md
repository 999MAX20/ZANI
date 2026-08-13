# Transactional Email

Дата: 23.05.2026

Goal: staging/production can send operational emails through a real provider before paid beta.

## 1. Provider Decision

Recommended providers:

- Resend;
- Postmark;
- SendGrid.

For early staging, choose one provider and configure SMTP env. Do not hardcode provider-specific SDK calls in views.

## 2. Required Env

```env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=
EMAIL_PORT=587
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=Zani <no-reply@your-domain.com>
```

Local/test can use:

```env
EMAIL_BACKEND=django.core.mail.backends.locmem.EmailBackend
```

## 3. Runtime Smoke

Check config:

```bash
python manage.py email_runtime_smoke
```

Fail when provider is missing:

```bash
python manage.py email_runtime_smoke --fail-on-missing
```

Send a safe smoke email:

```bash
python manage.py email_runtime_smoke --send --to owner@example.com
```

The smoke message contains no merchant/customer data.

## 4. Render Smoke Script

After SMTP env is configured on Render, run:

```bash
scripts/render_h4_email_smoke.sh
```

To send a real safe smoke email:

```bash
SEND_EMAIL_SMOKE=true EMAIL_SMOKE_TO=owner@example.com scripts/render_h4_email_smoke.sh
```

The script rejects staging/production deploys that still use `locmem` or `console` email backends.

## 5. Architecture Rule

Email sending must go through service/provider code, not directly from views.

Current helper:

```text
apps.notifications.email
```

Future notification delivery should use the queue runtime and write delivery/failure state back to `Notification`.

## 6. H4 Acceptance

H4 is complete when:

- staging SMTP provider is configured;
- `email_runtime_smoke --send` succeeds;
- failures are visible in logs/Sentry;
- production readiness audit email check is green;
- notification delivery remains service/queue-ready.
