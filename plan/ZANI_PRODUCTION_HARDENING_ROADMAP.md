# Zani Production Hardening Roadmap

Дата: 23.05.2026

Статус: актуальный execution roadmap после закрытия core/pilot и первого Render staging.

## 1. Почему Нужен Новый Roadmap

`plan/ZANI_MASTER_TECH_PLAN.md` закрыл controlled-pilot foundation:

- CRM core;
- Platform Admin foundation;
- merchant workspace;
- RBAC/ABAC foundation;
- integrations foundation;
- onboarding/demo/smoke;
- Render frontend/backend staging;
- Supabase Postgres staging;
- browser E2E smoke.

Следующий этап больше не про расширение поверхности продукта. Он про надежность, эксплуатацию и путь к 10 000 активных мерчантов.

## 2. Правила Этого Roadmap

1. Не добавлять новые крупные бизнес-модули, пока production foundation не выдерживает paid beta.
2. Любая production-фича должна иметь документацию, env, smoke/check и rollback notes.
3. Реальные внешние провайдеры подключаются только через существующий provider/connector layer.
4. AI и автоматизации должны работать через очередь, лимиты и audit.
5. Storage, exports, credentials and support access считаются security-sensitive.
6. UI/UX улучшается точечно там, где это снижает поддержку и ошибки владельца/оператора.

## 3. Phase H1 — Redis / Celery Runtime On Render

Goal: staging перестает быть только web+db и получает queue-backed runtime.

Status: code/docs ready on 2026-05-23. Render worker provisioning is the remaining environment action.

Must build:

- managed Redis decision for staging;
- Render worker service commands:
  - default worker;
  - automations/notifications worker;
  - integrations worker;
  - optional beat;
- `AUTOMATIONS_RUN_INLINE=False` staging path;
- queue smoke command/runbook;
- worker failure/retry notes;
- docs update.

Acceptance:

- `/ready/` remains green;
- automation run can be queued and processed by worker;
- failed worker does not break web startup;
- staging env variables are documented.

Implemented:

- `CELERY_TASK_ALWAYS_EAGER` and `CELERY_TASK_STORE_EAGER_RESULT` env controls;
- production audit accepts both `redis://` and TLS `rediss://` broker URLs;
- `python manage.py queue_runtime_smoke` command dispatches a real automation run to the `automations` queue and waits for worker completion;
- Render worker commands and failure notes documented in `docs/celery-render-runtime.md`;
- staging/production env templates include queue runtime flags.

## 4. Phase H2 — Object Storage Production Switch

Goal: file attachments stop depending on local container disk.

Status: code/docs ready on 2026-05-23. Bucket provisioning is the remaining environment action.

Must build:

- choose staging storage provider: Supabase Storage S3-compatible endpoint or Cloudflare R2;
- bucket/prefix policy:
  - `business-{id}/attachments/...`;
  - private by default;
- env template verified;
- upload/download smoke;
- storage quota smoke;
- private download audit check;
- docs update.

Acceptance:

- uploaded file survives redeploy;
- operator cannot access another business file;
- owner sees usage/quota;
- audit log records private download.

Implemented:

- `python manage.py storage_runtime_smoke` command writes a tiny private `FileAttachment` through the active Django storage backend;
- business-scoped object key strategy documented;
- staging/production S3-compatible env templates are present;
- storage runtime smoke and cutover checklist documented in `docs/file-storage.md`.

## 5. Phase H3 — Sentry / Error Monitoring

Goal: staging/production errors are observable.

Status: code/docs ready on 2026-05-23. Sentry project/DSN provisioning is the remaining environment action.

Must build:

- backend Sentry env setup;
- frontend Sentry decision and optional setup;
- release/environment tags;
- PII-safe error policy;
- smoke test for captured backend exception in staging-safe endpoint or command;
- docs update.

Acceptance:

- `production_readiness_audit --fail-on-critical` passes Sentry check when DSN exists;
- errors include environment/release;
- no secrets/user payloads are logged.

Implemented:

- backend Sentry setup already uses `environment`, `release`, `traces_sample_rate` and `send_default_pii=False`;
- `python manage.py observability_runtime_check` command verifies Sentry config and can send a safe smoke message;
- docs in `docs/observability.md`;
- staging/production env templates include Sentry variables.

## 6. Phase H4 — Transactional Email

Goal: system can send operational emails without mock-only behavior.

Status: code/docs ready on 2026-05-23. SMTP provider provisioning is the remaining environment action.

Must build:

- provider decision: Resend/Postmark/SendGrid;
- env templates;
- email provider test command;
- notification email delivery path through queue-ready service;
- bounce/failure logging foundation;
- docs update.

Acceptance:

- staging can send a test email;
- failures are visible;
- email sending is not hardcoded in views.

Implemented:

- provider-neutral email helper in `apps.notifications.email`;
- `python manage.py email_runtime_smoke` command checks provider config and can send a safe smoke email;
- docs in `docs/transactional-email.md`;
- staging/production env templates include SMTP variables.

## 7. Phase H5 — Backup / Restore Drill

Goal: data can be restored before real merchants rely on the system.

Status: code/docs ready on 2026-05-23. Real provider backup/restore rehearsal is the remaining environment action.

Must build:

- Supabase/Postgres backup policy;
- restore drill runbook;
- object storage backup/lifecycle policy;
- test restore checklist;
- owner-impact communication template for incidents;
- docs update.

Acceptance:

- documented restore point objective;
- restore drill has concrete steps;
- staging restore drill can be rehearsed without production data.

Implemented:

- `python manage.py backup_restore_readiness_check` command validates backup prerequisites and can fail on paid-beta blockers;
- readiness JSON output for CI/staging gates;
- `docs/backup-restore.md` updated with readiness check and incident communication template.

## 8. Phase H6 — Load / Scale Baseline

Goal: get numbers before promising 10 000 merchants.

Status: script/docs ready on 2026-05-23. Real staging measurements are the remaining environment action.

Must build:

- realistic seed command or fixture scale profile;
- API load smoke for auth, dashboard, leads, inbox, integrations;
- DB slow query capture plan;
- worker queue lag thresholds;
- frontend bundle and route performance notes;
- docs update.

Acceptance:

- baseline RPS/latency numbers are recorded;
- obvious N+1/pagination risks are listed;
- no load test hits real external providers.

Implemented:

- `scripts/api_load_smoke.py` performs authenticated API latency smoke with JSON output;
- docs in `docs/e2e-scale-baseline.md` now include command examples and initial p95 threshold guidance.

## 9. Phase H7 — Provider Rollout Sequence

Goal: connect real providers safely, one by one.

Status: code/docs ready on 2026-05-23. Real provider credentials and provider-specific production rehearsals remain environment actions.

Order:

1. Telegram real webhook.
2. Website widget/public forms production embed.
3. Transactional email.
4. OpenRouter/OpenAI behind AI queue and usage limits.
5. WhatsApp provider pilot.
6. Instagram/Meta provider pilot.
7. Kaspi/marketplace/1C after event normalization and support workflow are proven.

Acceptance for every provider:

- provider adapter;
- credential storage/masking;
- webhook verification where relevant;
- event normalization;
- idempotency;
- support-visible connector health;
- tenant isolation tests;
- recovery instructions.

Implemented:

- `apps.integrations.provider_rollout` defines the approved rollout order and safety gates;
- `python manage.py provider_rollout_readiness_check` reports provider readiness and can fail CI/deploys on blockers;
- Telegram real mode is blocked until webhook secret, queue runtime and observability gates pass;
- WhatsApp and Instagram real env flags are blocked while their adapters remain pilot/request-only;
- docs in `docs/provider-rollout.md` describe provider order, gates and current provider status.

## 10. Phase H8 — Support / Operations UX

Goal: reduce manual debugging during paid beta.

Status: backend/frontend/docs ready on 2026-05-23. Real incident rehearsals and support team usage remain operational actions.

Must build:

- Platform Admin operational health page;
- worker/queue status summary;
- connector request queue;
- failed automation/integration events view;
- support access grant workflow polish;
- merchant-safe incident notes.

Acceptance:

- platform operator can answer “что сломалось у мерча?” without DB shell;
- risky support actions are audited;
- merchant UI stays simple.

Implemented:

- platform-only endpoint `GET /api/platform/operations-health/`;
- platform page `/platform/operations`;
- runtime queue summary with failed automation/sync/webhook counters;
- production readiness, backup readiness and provider rollout summaries in one support view;
- connector request queue and failed automation/integration event lists;
- platform-only permission tests;
- docs in `docs/platform-operations-health.md`.

## 11. Phase H9 — Paid Beta Gate

Goal: decide when real paid beta is allowed.

Status: code/docs ready on 2026-05-23. The gate intentionally stays red until staging infra, smoke/E2E, backups, support grant rehearsal and provider rollback checks are actually completed.

Required green gates:

- staging smoke green;
- browser E2E green;
- production readiness audit has no critical failures;
- Redis/Celery enabled;
- object storage enabled;
- Sentry enabled;
- transactional email enabled;
- backup/restore drill documented;
- support access grant flow tested;
- no real provider is enabled without rollback path.

Implemented:

- `apps.core.paid_beta_gate` aggregates paid-beta blockers;
- `python manage.py paid_beta_gate_check` command with JSON and `--fail-on-blockers`;
- env-controlled manual confirmations for staging smoke, browser E2E, backup drill and support grant flow;
- docs in `docs/paid-beta-gate.md`;
- staging/production env templates include paid beta gate flags.

## 12. Current Next Task

Production hardening phases H1-H9 are now code/docs ready. Remaining work is operational: provision real services, run deployed smoke/E2E/load checks, complete backup restore rehearsal, and keep the paid-beta gate red until every production dependency is green.

Operational launch pack status: code/docs ready on 2026-05-23.

Implemented:

- `scripts/paid_beta_launch_check.sh` combines readiness audits, runtime checks, provider rollout, queue/storage smoke, remote staging smoke, optional load smoke and final paid beta gate;
- `docs/paid-beta-launch-runbook.md` documents the real service checklist, env confirmations, backup drill and support grant drill;
- README references the launch pack.
