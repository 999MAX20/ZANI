# Zani Staging CI/CD Checklist

Дата: 21.05.2026

Цель: зафиксировать минимальный CI/CD и staging-процесс, который должен быть выполнен до первого production-like окружения.

## 1. Что Добавлено

GitHub Actions workflow:

```text
.github/workflows/ci.yml
```

Локальный эквивалент CI:

```bash
scripts/check_local_ci.sh
```

CI выполняет:

- backend dependency install;
- `python manage.py makemigrations --check --dry-run`;
- `python manage.py check`;
- `python manage.py production_readiness_audit --format=json`;
- `python manage.py test`;
- frontend `npm ci`;
- frontend `npm run build`.

## 2. Staging Secrets

Use templates:

```text
.env.staging.example
frontend/.env.staging.example
```

Перед staging deploy создать отдельные secrets, не production:

- `SECRET_KEY`;
- `DATABASE_URL`;
- `REDIS_URL`;
- `ALLOWED_HOSTS`;
- `CORS_ALLOWED_ORIGINS`;
- `CSRF_TRUSTED_ORIGINS`;
- `SENTRY_DSN`;
- object storage keys;
- email SMTP credentials;
- `VITE_API_URL`.

Не использовать локальный `.env` для staging.

## 3. Staging Deploy Gate

Перед каждым staging deploy:

```bash
python manage.py makemigrations --check --dry-run
python manage.py check
python manage.py production_readiness_audit --fail-on-critical
python manage.py test
cd frontend && npm run build
```

Если `production_readiness_audit --fail-on-critical` падает, staging не считается production-like.

## 4. Staging Smoke

После deploy запустить:

```bash
API_BASE_URL=https://api-staging.zani.example \
FRONTEND_URL=https://app-staging.zani.example \
PLATFORM_ADMIN_EMAIL=platform_admin@example.com \
PLATFORM_ADMIN_PASSWORD='***' \
MERCHANT_OWNER_EMAIL=business_owner@example.com \
MERCHANT_OWNER_PASSWORD='***' \
scripts/staging_smoke.sh
```

Скрипт проверяет:

- `GET /health/`;
- `GET /health/db/`;
- `GET /ready/`;
- login as platform admin;
- login as business owner;
- `/api/auth/me/`;
- platform ping;
- merchant businesses, leads, conversations and usage summary;
- frontend root response.

Manual smoke still required for:

- merchant dashboard;
- leads page;
- conversations page;
- settings forbidden state for operator;
- one file upload/download in private storage;
- one automation run in queue mode;
- one connector health-check.

После API smoke можно запускать browser smoke against deployed frontend:

```bash
cd frontend
E2E_BASE_URL=https://app-staging.zani.example \
E2E_PLATFORM_EMAIL=platform_admin@example.com \
E2E_OWNER_EMAIL=business_owner@example.com \
E2E_OPERATOR_EMAIL=business_operator@example.com \
E2E_PASSWORD='***' \
npm run e2e:staging
```

## 5. Release Discipline

Каждый deploy должен иметь:

- `RELEASE` value;
- frontend build tied to the same release;
- migration step separated from web startup where possible;
- rollback plan;
- backup/PITR confirmed before destructive migrations.

## 6. What This Does Not Solve Yet

Этот этап не создает реальный deploy provider и не подключает staging secrets автоматически.

Следующие шаги:

- выбрать hosting/provider;
- создать staging env;
- подключить managed PostgreSQL/Redis/storage/Sentry;
- включить `production_readiness_audit --fail-on-critical` в deploy gate;
- добавить E2E smoke against deployed staging URL.
