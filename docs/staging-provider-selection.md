# Zani Staging Provider Selection

Дата: 21.05.2026

Цель: выбрать минимальный набор сервисов для первого production-like staging окружения без преждевременного подключения WhatsApp/Meta/OpenAI/payment providers.

## 1. Recommended Default Stack

Для первого staging используем:

| Layer | Recommended | Why |
| --- | --- | --- |
| Backend runtime | Render / Railway / Fly.io / DigitalOcean App Platform | Быстрый деплой Docker/Django без Kubernetes. |
| PostgreSQL | Supabase Postgres or Neon | Managed Postgres, backups, easy dashboard. |
| Redis | Upstash Redis or Redis Cloud | Managed Redis для Celery queues без VPS-администрирования. |
| Object storage | Supabase Storage or Cloudflare R2 | S3-compatible private files, quotas later. |
| Frontend | Cloudflare Pages or Vercel | Быстрый static hosting, preview deploys. |
| Domain/DNS/CDN | Cloudflare | DNS, HTTPS, WAF/rate-limit options. |
| Errors | Sentry | Ошибки backend/frontend, release tracking. |
| Email | Resend / Postmark / SendGrid | Transactional email для invites, password flows, alerts. |

## 2. Preferred Path For This Project

Так как команда уже привыкла к Supabase, допустимый staging path:

- Supabase Postgres as `DATABASE_URL`;
- Supabase Storage as S3-compatible object storage if compatible endpoint is stable for chosen SDK/settings;
- Upstash Redis for queues;
- Cloudflare Pages for frontend;
- Render/Railway/Fly.io for Django web + Celery workers;
- Sentry for backend/frontend;
- Resend for transactional email.

Django остается application backend и источником бизнес-прав, tenant isolation, audit, automations and provider orchestration.

## 3. Why Not Full Supabase Replacement

Не заменяем Django на Supabase Auth/Edge Functions сейчас, потому что в Django уже реализованы:

- RBAC/ABAC;
- tenant-aware querysets;
- audit/security center;
- automations runtime;
- billing entitlements;
- integrations provider layer;
- CRM business logic.

Supabase лучше использовать как managed infrastructure:

- Postgres;
- Storage;
- backups/dashboard.

Auth можно пересмотреть позже отдельной фазой, но не в staging foundation.

## 4. Staging Environment Checklist

Перед staging deploy:

1. Создать backend service.
2. Создать managed Postgres.
3. Создать managed Redis.
4. Создать private object storage bucket.
5. Создать Sentry project.
6. Создать transactional email sender/domain.
7. Настроить frontend static hosting.
8. Настроить domains:
   - `api-staging.zani.example`;
   - `app-staging.zani.example`.
9. Заполнить env из:
   - `.env.staging.example`;
   - `frontend/.env.staging.example`.
10. Запустить:

```bash
python manage.py production_readiness_audit --fail-on-critical
python manage.py migrate
python manage.py collectstatic --noinput
```

11. Выполнить first production-like smoke:

```bash
API_BASE_URL=https://api-staging.zani.example \
FRONTEND_URL=https://app-staging.zani.example \
PLATFORM_ADMIN_EMAIL=platform_admin@example.com \
PLATFORM_ADMIN_PASSWORD='***' \
MERCHANT_OWNER_EMAIL=business_owner@example.com \
MERCHANT_OWNER_PASSWORD='***' \
scripts/staging_smoke.sh
```

Подробный порядок: `docs/staging-smoke-runbook.md`.

## 5. Production Provider Upgrade

Когда staging стабилен:

- отдельный Supabase/managed Postgres project for production;
- отдельный Redis instance;
- отдельный storage bucket;
- отдельный Sentry environment;
- отдельный email sender/domain;
- Cloudflare production domain;
- no shared secrets between staging and production.

## 6. Services To Delay

Не подключать до прохождения staging foundation:

- WhatsApp production API;
- Meta/Instagram API;
- OpenRouter/OpenAI paid production traffic;
- payment provider;
- complex BI exports;
- WebSocket/SSE.

Сначала должны быть зелёными:

- deploy;
- audit;
- migrations;
- login;
- file upload/download;
- queue worker;
- automation run;
- connector health-check.
