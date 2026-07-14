# Zani Production Readiness Audit For 10,000 Merchants

Дата: 21.05.2026

Цель: зафиксировать, что нужно довести до production-ready состояния перед ростом до 10 000 активных мерчантов, и дать проверяемый способ аудита окружения.

## 1. Новый Проверяемый Артефакт

Добавлена management command:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py production_readiness_audit
```

JSON для CI:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py production_readiness_audit --format=json
```

Жесткий режим для staging/production pipeline:

```bash
.venv/bin/python manage.py production_readiness_audit --fail-on-critical
```

Команда проверяет:

- `DEBUG`;
- `SECRET_KEY`;
- `ALLOWED_HOSTS`;
- CORS/CSRF origins;
- HTTPS/security flags;
- support access grants;
- PostgreSQL vs SQLite;
- DB connection reuse;
- Redis/Celery broker;
- async automation runtime;
- object storage;
- Sentry;
- transactional email;
- required API throttling scopes.

Rate-limit policy:

```text
docs/rate-limits.md
```

## 2. Текущая Оценка

Кодовая база уже подходит для controlled pilot и paid beta с ручной поддержкой, потому что реализованы:

- tenant-aware API;
- RBAC/ABAC foundation;
- audit/security center;
- private file attachment foundation;
- entitlements and billing limits;
- automation runtime;
- integration connector foundation;
- E2E smoke suite.

Но для 10 000 активных мерчантов пока нельзя идти без hardening:

- production PostgreSQL with PITR;
- managed Redis and workers;
- object storage;
- Sentry/logging;
- backup/restore drill;
- real rate-limit policy for auth, public forms/widgets, webhooks, public API and AI endpoints;
- load tests;
- deployment/rollback playbook;
- provider-specific integration hardening.

## 3. Минимальная Staging Архитектура

Подходит для пилотов и внутреннего QA:

- 1 backend web instance: 2 vCPU / 2-4 GB RAM;
- 1 Celery worker: 1-2 vCPU / 2 GB RAM;
- managed Postgres: 2 vCPU / 4 GB RAM / 20-50 GB storage;
- managed Redis: 256 MB-1 GB;
- object storage bucket;
- static frontend on Cloudflare Pages / Vercel / Netlify;
- Sentry free/pro/team tier.

## 4. Initial Production Архитектура

Для первых реальных платящих клиентов:

- 2 backend web instances behind load balancer: each 2 vCPU / 4 GB RAM;
- 1 default worker: 2 vCPU / 4 GB RAM;
- 1 integration/webhook worker: 2 vCPU / 2-4 GB RAM;
- 1 automation/notification worker: 2 vCPU / 2-4 GB RAM;
- managed Postgres: 4 vCPU / 8-16 GB RAM / 100+ GB storage / PITR;
- managed Redis: 1-2 GB;
- object storage + CDN/private signed URLs;
- Sentry;
- uptime monitoring;
- daily backups and restore drill.

## 5. 10,000 Merchants Target Architecture

Ориентир, не финальный sizing:

- 4-8 backend web instances, autoscaling by CPU/RPS;
- separate worker pools:
  - `default`;
  - `integrations`;
  - `webhooks_outbound`;
  - `automations`;
  - `notifications`;
  - `ai`;
  - `reports_exports`;
- managed Postgres:
  - 8-16 vCPU;
  - 32-64 GB RAM;
  - read replica for heavy reports;
  - PITR and slow-query monitoring;
- Redis:
  - 4-8 GB depending on queue volume;
- object storage:
  - per-merchant quota through entitlements;
  - lifecycle rules;
  - malware scan provider later;
- observability:
  - Sentry;
  - structured logs;
  - metrics dashboards;
  - alerts for worker lag, DB latency, error rate, failed webhooks.

## 6. Production Env Timing

Production env variables заполняются не в конце разработки, а перед первым staging deploy.

Порядок:

1. Staging env:
   - real domains;
   - HTTPS;
   - managed Postgres;
   - Redis;
   - object storage;
   - Sentry.
2. Проверить:
   - `manage.py check`;
   - `manage.py production_readiness_audit --fail-on-critical`;
   - smoke login;
   - E2E.
3. Production env:
   - отдельные ключи и базы;
   - отдельные buckets;
   - отдельные Sentry environment/release;
   - backups and rollback playbook.

## 7. Что Не Подключать Прямо Сейчас

Не нужно сразу подключать:

- WhatsApp production provider;
- Meta/Instagram production API;
- OpenRouter/OpenAI production AI;
- payment provider;
- сложные BI/reporting exports.

Почему:

- сначала нужно довести deployment, storage, queue, monitoring and rollback;
- реальные provider credentials усложнят поддержку и безопасность;
- AI должен идти через очередь, лимиты, audit и fallback.

## 8. Что Подключать Следующим

Минимально нужно для production-like staging:

- managed PostgreSQL;
- managed Redis;
- object storage;
- Sentry;
- frontend hosting + domain/HTTPS;
- transactional email.

После этого:

- Telegram as first real channel;
- Website widget/public forms;
- WhatsApp only after connector/provider hardening;
- OpenRouter/OpenAI only after AI queue and cost controls are confirmed.

## 9. Env Templates And Provider Selection

Use:

```text
.env.staging.example
.env.production.example
frontend/.env.staging.example
frontend/.env.production.example
docs/staging-provider-selection.md
```

Recommended first staging stack:

- Supabase Postgres or Neon;
- Upstash Redis or Redis Cloud;
- Supabase Storage or Cloudflare R2;
- Cloudflare Pages or Vercel for frontend;
- Render/Railway/Fly.io/DigitalOcean App Platform for backend;
- Sentry;
- Resend/Postmark/SendGrid.
