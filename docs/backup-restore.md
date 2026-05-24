# Zani Backup And Restore Baseline

Date: 2026-05-20

This document defines the minimum backup/restore posture before production merchants.

## 1. What Must Be Backed Up

Critical:

- PostgreSQL database;
- object storage bucket;
- environment/secrets inventory;
- deployment release metadata.

Not critical:

- frontend build artifacts, because they can be rebuilt;
- Docker images, if they are stored in a registry;
- local dev SQLite databases.

## 2. PostgreSQL Backups

For production, use managed Postgres with:

- daily automated backups;
- Point-in-Time Recovery if available;
- at least 7-14 days retention for early production;
- longer retention when paid contracts require it.

Manual backup before risky migrations:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=zani-backup-$(date +%Y%m%d-%H%M).dump
```

Restore to a new database:

```bash
createdb zani_restore
pg_restore --dbname=zani_restore --clean --if-exists zani-backup.dump
```

Never test restore directly against production.

## 3. Object Storage Backups

For S3-compatible storage:

- enable bucket versioning if provider supports it;
- enable lifecycle rules for deleted/old versions;
- keep bucket access private;
- document bucket name, region and endpoint in secret inventory.

Future storage phase must add:

- per-business prefixes;
- storage usage accounting;
- file retention policy;
- sensitive download audit;
- antivirus/provider interface.

## 4. Restore Drill

Before paid production:

1. Create a staging restore database.
2. Restore latest production-like backup.
3. Point staging app to restored DB.
4. Verify:
   - login;
   - `/api/auth/me/`;
   - business list;
   - clients/leads;
   - file metadata;
   - migrations status.
5. Document restore time.

Target early-stage RTO/RPO:

- RPO: 24 hours for MVP, improve with PITR.
- RTO: 4 hours for early paid beta, improve as merchant count grows.

## 5. Readiness Check

Run before paid-beta drills:

```bash
python manage.py backup_restore_readiness_check
```

JSON mode:

```bash
python manage.py backup_restore_readiness_check --format=json
```

Fail when paid-beta blockers exist:

```bash
python manage.py backup_restore_readiness_check --fail-on-blockers
```

The command checks:

- managed PostgreSQL instead of SQLite;
- DB connection reuse;
- object storage enabled;
- bucket endpoint/region presence;
- explicit staging/production environment naming.

It does not perform a real `pg_dump` or provider restore. It is a gate that verifies prerequisites before running the provider-specific drill.

Render/CI gate:

```bash
scripts/render_h5_backup_readiness.sh
```

This script must be followed by a manual restore rehearsal into a separate staging database.

## 6. Secrets Backup

Do not put secrets in git.

Keep a secure inventory of:

- production `.env` values;
- provider keys;
- storage credentials;
- Sentry DSN;
- email credentials;
- deploy keys.

Use a password manager or managed secret store.

## 7. Incident Communication Template

For paid beta incidents, prepare a short merchant-facing update:

```text
Мы обнаружили проблему с доступностью/данными Zani.
Данные защищены, команда выполняет восстановление из резервной копии.
Ожидаемое время восстановления: <RTO>.
Следующее обновление: <time>.
```

Do not disclose internal provider credentials, database hosts or security implementation details in merchant-facing updates.
