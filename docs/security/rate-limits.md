# Zani Rate Limit And Abuse Guardrails

Дата: 21.05.2026

Цель: закрыть базовый публичный периметр до первого staging/prod трафика, не усложняя CRM бизнес-логику.

## 1. Covered Surfaces

Rate limits are configured through DRF scoped throttles.

| Scope | Default | Covers |
| --- | --- | --- |
| `auth_login` | `10/min` | `POST /api/auth/token/` |
| `auth_refresh` | `30/min` | `POST /api/auth/token/refresh/` |
| `public_api` | `120/min` | Public API token endpoints, currently `/api/public-api/clients/` |
| `public_form` | `60/min` | Public lead form read/submit |
| `public_widget` | `120/min` | Website chat/widget public endpoints |
| `integration_webhook` | `300/min` | Telegram/WhatsApp webhook endpoints |
| `ai_assistant` | `30/min` | CRM AI assistant chat endpoint |

## 2. Env Variables

Use:

```env
AUTH_LOGIN_RATE=10/min
AUTH_REFRESH_RATE=30/min
PUBLIC_API_RATE=120/min
PUBLIC_FORM_RATE=60/min
PUBLIC_WIDGET_RATE=120/min
INTEGRATION_WEBHOOK_RATE=300/min
AI_ASSISTANT_RATE=30/min
```

The same variables exist in:

```text
.env.example
.env.staging.example
.env.production.example
```

## 3. Staging Guidance

For first staging, keep defaults. If widget tests or webhook provider tests hit limits, raise only the specific scope.

Do not disable throttling globally to fix local/staging problems. Tune the individual scope instead.

## 4. Production Guidance

Initial production defaults are intentionally conservative. Review after real traffic:

- failed login rate;
- public form submission volume;
- website widget message volume;
- webhook provider retry behavior;
- AI assistant usage and cost.

For 10,000 merchants, application-level throttles are not enough. Add edge-level controls:

- Cloudflare WAF/rate limiting for public paths;
- provider-level webhook verification;
- alerts on `429` spikes;
- per-business quota checks through entitlements where cost is involved.

## 5. Current Limitations

This phase does not add:

- per-business dynamic throttling;
- CAPTCHA/challenge for public forms;
- IP reputation provider;
- Cloudflare rules;
- webhook queue backpressure metrics.

Those should be added after staging traffic and provider behavior are observable.
