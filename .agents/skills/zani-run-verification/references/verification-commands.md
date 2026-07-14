# Verification commands

Run from the repository root in PowerShell. Select only the commands justified by the change, then report every skipped gate.

## Safe local environment

```powershell
$env:DATABASE_URL = 'sqlite:///db.sqlite3'
$env:SECURE_SSL_REDIRECT = 'False'
$env:SESSION_COOKIE_SECURE = 'False'
$env:CSRF_COOKIE_SECURE = 'False'
$env:REDIS_URL = 'memory://'
$env:CELERY_TASK_ALWAYS_EAGER = 'True'
$env:CELERY_TASK_STORE_EAGER_RESULT = 'False'
$env:AUTOMATIONS_RUN_INLINE = 'True'
```

## Backend structure and migrations

```powershell
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
```

If migrations were intentionally added:

```powershell
.\.venv\Scripts\python.exe manage.py migrate
```

## Focused and scoped backend tests

```powershell
.\.venv\Scripts\python.exe -m pytest path\to\test_module.py -q
.\.venv\Scripts\python.exe manage.py test apps.core.tests_business_flows_e2e -v 2
```

For broad CRM coverage, use the current scoped command from `AGENTS.md`; do not copy a stale module list from this reference.

## Frontend

```powershell
Push-Location frontend
npm run build
npx playwright test --project=mobile-chromium -g "mobile (owner|manager) smoke"
Pop-Location
```

Run Playwright when the changed flow is user-facing and business-critical. Preserve its local Django/Vite setup unless services were deliberately started with explicit E2E environment variables.

## Gate selection

- Backend-only: focused tests, `manage.py check`, migration drift check, then relevant scoped tests.
- CRM lifecycle: backend-only gate plus happy path, permission denial, tenant isolation, and business-flow coverage.
- Frontend-only: `npm run build` plus targeted browser coverage when critical.
- Mixed user flow: backend gate, frontend build, and reachable E2E or manual flow evidence.
- Integration: focused provider tests with network disabled, retry/idempotency/error-state coverage, then relevant scoped tests.
- AI: source/no-data/approval tests, provider-disabled behavior, masked logging checks, then relevant scoped tests.

Do not run destructive production commands or real provider calls as verification.
