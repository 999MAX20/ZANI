# ZANI Backend Audit Remediation Plan

- Status: **ACTIVE / IN PROGRESS**
- Created: 2026-08-18
- Scope: remaining repository, security and verification debt discovered by the backend audit
- Execution state: **IN PROGRESS - BE-REM-001 THROUGH BE-REM-003 DONE**
- Owner: ZANI manager workflow

## Purpose

This document is the single execution queue for the remaining backend findings from the 2026-08-18 audit. It does not reopen the completed B0-B6 implementation plan and does not add new CRM features.

The target outcome is:

```text
green repository gate
  -> patched dependency baseline
  -> hardened authentication and secrets
  -> safe API failure contract
  -> verified privileged access
  -> complete cross-application certification evidence
```

Creating this document authorizes planning only. Implementation begins only after an explicit owner instruction. Each remediation item is completed on a focused branch and is not merged or pushed to `main` automatically.

## Audit Baseline

Audit workspace:

```text
C:\Users\user\Desktop\Zani
branch: codex/zani-canonical-2026-08-15
baseline commit: 3789ce7
```

Confirmed results:

- `python manage.py check`: passed with no issues;
- `python manage.py makemigrations --check --dry-run`: no changes detected;
- `python -m pip check`: no broken requirements;
- frontend production build, i18n check and bundle gate: passed in the current audit cycle;
- full Django suite after BE-REM-001: `858` tests passed;
- full Django suite after BE-REM-003: `868` tests passed;
- declared Python runtime lock after BE-REM-002: `0` known advisories;
- rebuilt local `.venv`: matches the committed runtime/development locks and has no broken requirements;
- frontend production dependency tree after BE-REM-002: `0` known advisories;
- local production-readiness audit: `6 pass`, `1 warn`, `10 fail`, which is expected while the runtime remains on local SQLite/mock infrastructure.

The audit's only full-suite failure was repository path drift. BE-REM-001 aligned the test with the canonical `docs/integrations/imports/samples/` location and restored the green full-suite gate.

## Scope Boundary

This plan covers the seven audit findings below. It does not include:

- a new CRM entity or workflow;
- dentistry-specific adaptation;
- payment-provider implementation;
- new external integrations;
- visual UI/UX redesign;
- production credentials or purchasing managed services.

External production services are listed as a release gate because repository hardening cannot prove them locally.

## Execution Rules

1. One remediation item equals one focused branch and reviewable commit.
2. Do not edit or push `main`.
3. Do not close an item until its focused tests and required manager gate pass.
4. Dependency locks must be regenerated through the documented lock workflow, not manually edited as unreviewed version strings.
5. Security controls must be enforced by the backend. Frontend hiding is not an acceptance criterion.
6. Never place credentials, refresh tokens, raw provider payloads or stack traces in tests, documentation, logs or screenshots.
7. Any changed authentication or authorization flow requires happy-path, denial, expiry/revocation and tenant-safety coverage where applicable.

## Execution Queue

| ID | Work item | Priority | Status | Depends on |
| --- | --- | --- | --- | --- |
| BE-REM-001 | Restore the clean full test gate | P0 | DONE | none |
| BE-REM-002 | Patch and rebuild dependency baselines | P0 | DONE | BE-REM-001 |
| BE-REM-003 | Harden refresh sessions and password flows | P0 | DONE | BE-REM-002 |
| BE-REM-004 | Guarantee the safe API error envelope for unknown failures | P0 | NOT_STARTED | BE-REM-003 |
| BE-REM-005 | Replace connector secret encryption and add key rotation | P1 | NOT_STARTED | BE-REM-002 |
| BE-REM-006 | Add privileged-account MFA foundation | P1 | NOT_STARTED | BE-REM-003 |
| BE-REM-007 | Complete the functional certification evidence | P1 | NOT_STARTED | BE-REM-001..006 |

## BE-REM-001 - Restore The Clean Full Test Gate

### Confirmed finding

The application test suite is functionally close to green, but the committed sample-path assertion still points to the old documentation location.

### Required change

- update `apps/core/tests_import_samples.py` to use the canonical sample path;
- keep one canonical set of sample CSV files;
- do not copy the same templates back into a second legacy directory;
- verify that the sample-writing management command still produces headers matching `IMPORT_TEMPLATES`;
- scan documentation and scripts for stale `docs/import_samples` references.

### Acceptance criteria

- all committed sample files remain under `docs/integrations/imports/samples/`;
- focused import-sample tests pass;
- the complete Django suite passes with no failures;
- no migration drift is introduced;
- repository diff contains no generated database, environment or cache files.

### Required verification

```powershell
.\.venv\Scripts\python.exe manage.py test apps.core.tests_import_samples -v 2
.\.venv\Scripts\python.exe manage.py test -v 2
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
.\.venv\Scripts\python.exe manage.py check
```

## BE-REM-002 - Patch And Rebuild Dependency Baselines

### Confirmed finding

Declared runtime dependencies contain known advisories:

- `cryptography==48.0.1`: three advisories; the audit-safe target is at least `50.0.0`;
- `sqlparse==0.5.5`: four advisories; the fixed target is at least `0.6.0`.

The local `.venv` is also stale relative to the committed locks:

- Django `5.2.15` instead of the declared patched `5.2.16`;
- cryptography `46.0.7` instead of the declared `48.0.1`;
- pip `25.0.1` instead of the declared `26.1.2`.

The frontend production tree currently reports two high and one moderate advisory.

### Required change

- update direct constraints in `requirements.in` only after checking framework compatibility;
- regenerate `requirements.txt` with hashes through pip-tools;
- update development constraints and regenerate `requirements-dev.txt` when required;
- rebuild the local virtual environment from the committed locks;
- update the frontend lock with the smallest compatible transitive upgrades;
- do not use an unreviewed force-upgrade that changes major application behavior;
- record any accepted advisory exception with package, exploitability, compensating control and expiry date.

### Acceptance criteria

- `pip-audit -r requirements.txt` has no unaccepted runtime advisories;
- the rebuilt environment matches the committed locks;
- `npm audit --omit=dev` has no high or critical findings;
- Django checks, full backend tests, frontend build and bundle gate pass;
- dependency and behavior changes are reviewable in one focused diff.

### Required verification

```powershell
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m pip_audit -r requirements.txt --disable-pip
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py test -v 2
Set-Location frontend
npm ci
npm audit --omit=dev
npm run build
npm run check:bundle
```

## BE-REM-003 - Harden Refresh Sessions And Password Flows

### Confirmed finding

Refresh credentials are persisted in an HttpOnly cookie, but login and refresh responses also retain the refresh token in the JSON body. Logout clears the cookie without explicitly blacklisting the presented refresh token. Password change and password-reset confirmation do not currently provide a verified global session-revocation path.

The project configures Django password validators, but owner signup, password change and password-reset confirmation only enforce `min_length=8` in their serializers.

### Required change

- keep refresh credentials cookie-only for browser flows;
- remove refresh tokens from browser-facing JSON responses;
- blacklist the current refresh token on logout when present and valid;
- revoke other active refresh sessions after password change/reset;
- apply Django `validate_password` consistently to signup, change, reset and invitation flows;
- preserve the single-flight frontend refresh behavior;
- define safe behavior for expired, malformed, reused and already-blacklisted tokens;
- record login/logout/password/security events without logging credentials.

### Acceptance criteria

- browser JavaScript never receives a refresh token;
- access tokens remain short-lived and refresh rotation still works;
- logout makes the current refresh credential unusable;
- password change/reset invalidates earlier refresh sessions;
- all password entry points apply the same policy and return safe field-level feedback;
- CSRF/cookie attributes are verified for local and production-like settings;
- authentication throttles remain active.

### Required coverage

- successful login/refresh/logout;
- cookie-only token handling;
- refresh rotation and reuse rejection;
- revoked-token rejection;
- password validator cases;
- password reset/change session invalidation;
- throttling and safe error envelopes;
- no token values in response logs or audit metadata.

## BE-REM-004 - Safe API Envelope For Unknown Failures

### Confirmed finding

Known DRF and domain exceptions already use a stable envelope:

```json
{
  "code": "schedule_conflict",
  "request_id": "...",
  "detail": "...",
  "errors": {}
}
```

When DRF cannot handle an exception, `api_exception_handler` currently returns `None`. Django then produces its default 500 behavior, so the response is not guaranteed to follow the safe contract.

### Required change

- normalize every uncaught API exception to `internal_error`;
- return a safe generic detail and correlation/request ID;
- never return exception type, stack trace, SQL, path, payload or provider response to the merchant;
- log the full server-side exception with request ID and sanitized context;
- report it to Sentry when monitoring is configured;
- preserve explicit domain codes for validation, permissions, conflicts, throttling and provider availability;
- align this work with `UNIFIED_FALLBACK_EXPERIENCE_PLAN.md` instead of creating a second error taxonomy.

### Acceptance criteria

- forced unknown exceptions return JSON in the canonical envelope;
- production-like responses contain no technical details or secrets;
- server logs and Sentry evidence can be correlated by request ID;
- known 4xx/domain behavior remains unchanged;
- frontend can map the stable code without parsing English `detail` text.

## BE-REM-005 - Standard Connector Secret Encryption And Rotation

### Confirmed finding

Connector credentials are not stored as plaintext, but the current custom scheme builds an XOR keystream from `SECRET_KEY` and a salt and then signs the envelope. It has no independent key version, managed rotation or standard AEAD authentication model suitable for long-lived live provider credentials.

### Required change

- adopt a reviewed AEAD/envelope-encryption implementation;
- separate credential-encryption keys from Django `SECRET_KEY`;
- include key ID and envelope version;
- support decrypt-old/encrypt-new rotation;
- migrate existing encrypted credentials without exposing plaintext;
- preserve masked serializers and log sanitization;
- define failure behavior for missing keys, corrupt ciphertext and expired credentials;
- prefer managed KMS/secret storage in production while retaining a safe local development adapter.

### Acceptance criteria

- tampering causes safe decryption failure;
- old credentials can be rotated without service-wide plaintext export;
- no API/admin/log surface exposes raw values;
- tenant and permission checks remain enforced;
- provider smoke tests use mock credentials locally and real credentials only in an approved external environment;
- a rollback and key-recovery runbook exists before production migration.

## BE-REM-006 - Privileged Account MFA Foundation

### Confirmed finding

The current repository has no confirmed TOTP, passkey or WebAuthn flow for owner and administrator accounts. Password plus refresh-token protection is a reasonable local baseline but insufficient as the only control for privileged accounts holding real company and clinic data.

### Required baseline

- TOTP enrollment for owner and administrator roles;
- one-time recovery codes stored as hashes;
- step-up confirmation for security-sensitive actions;
- throttled verification and replay prevention;
- audited enrollment, disablement, recovery and failed attempts;
- owner-visible session/recovery management;
- no mandatory MFA for lower roles until the owner policy is approved;
- preserve a path to passkeys/WebAuthn later without replacing the session model again.

### Product decision before implementation

The owner must confirm whether MFA is:

1. mandatory for owner and administrator from the first paid pilot; or
2. optional during pilot and mandatory before general availability.

### Acceptance criteria

- tenant users cannot manage another user's MFA;
- recovery codes are single-use and never returned after initial display;
- disabling MFA requires recent authentication and an audited reason;
- brute-force and replay tests pass;
- account recovery does not expose whether an unrelated email exists.

## BE-REM-007 - Complete Functional Certification Evidence

### Confirmed finding

The codebase has strong focused coverage, but the project does not yet have a single durable matrix proving every supported action, role, data state and failure mode. `APP_FUNCTIONAL_CERTIFICATION.md` remains `PLANNED / ON HOLD`, and ZD-001 still carries cross-page search regression test debt.

### Required work

Execute the existing FC-001 through FC-008 queue without duplicating it here:

- route/action coverage registry;
- shared search/filter/sort/pagination contracts;
- form/mutation/dialog/session contracts;
- deterministic data-state and failure fixtures;
- role/capability/tenant browser matrix;
- ten critical merchant journeys;
- desktop/tablet/mobile non-functional matrix;
- clean final gate and certification report.

The unified fallback plan is a prerequisite for the failure-and-recovery portion of this certification.

### Acceptance criteria

- every supported merchant route and critical action has an owner and evidence;
- owner, administrator, manager, operator and specialist are checked against their intended capability boundaries;
- tenant denial is verified server-side;
- no known `REPORTED`, `CONFIRMED`, `FIXED_BRANCH` or `TEST_DEBT` item is omitted;
- full backend, frontend, browser and security gates are green;
- skipped checks are explicit and do not silently become a pass.

## External Production Release Gate

These are not repository implementation tasks, but they block a paid-production declaration:

- managed TLS PostgreSQL and a proven backup restore;
- TLS Redis with real Celery worker and beat;
- private S3-compatible object storage;
- transactional SMTP;
- Sentry/release monitoring;
- real Telegram, WhatsApp and Instagram credentials with signed webhook smoke;
- production secret, host, CORS, CSRF, HTTPS and support-access configuration;
- staging load, queue recovery and disaster-recovery evidence.

An integration marked `pass` while disabled only proves that the disabled guardrail is safe. It does not prove that a live provider is operational.

## Manager Gates

### Gate B-A - Repository baseline

- BE-REM-001 and BE-REM-002 complete;
- full test and dependency gates green.

### Gate B-B - Security contract

- BE-REM-003 through BE-REM-006 complete;
- authentication, unknown-error and secret-storage adversarial tests green;
- no credentials or raw technical errors in browser-facing responses.

### Gate B-C - Certification

- BE-REM-007 and unified fallback certification complete;
- production services remain explicitly blocked or have real evidence;
- final report separates local/pilot readiness from production readiness.

## Definition Of Done

This plan is complete only when:

- BE-REM-001 through BE-REM-007 are `DONE` with exact verification evidence;
- the complete Django suite is green;
- runtime Python and frontend production dependencies have no unaccepted high or critical advisories;
- authentication and secret-management acceptance tests pass;
- every API failure has a safe stable envelope;
- functional certification is complete;
- production-only blockers remain visibly separate from repository completion;
- the accepted integration branch is clean and pushed, while `main` remains untouched until explicit owner approval.

## Evidence Log

### BE-REM-001 - Restore The Clean Full Test Gate

```text
Task: BE-REM-001
Branch: codex/backend-rem-001-import-sample-gate
Implementation commit: 72b7cc1
Files changed: apps/core/tests_import_samples.py
Checks run and exact result:
- .\.venv\Scripts\python.exe manage.py test apps.core.tests_import_samples -v 2 -> 2 tests passed
- .\.venv\Scripts\python.exe manage.py test -v 1 -> 858 tests passed in 1574.400s
- .\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run -> No changes detected
- .\.venv\Scripts\python.exe manage.py check -> System check identified no issues
- stale docs/import_samples reference scan outside this historical plan -> 0 matches
- git diff --check -> passed
Checks skipped and reason: frontend and browser gates were not repeated because the change only corrects a backend test fixture path and does not alter runtime or frontend code
Migration/env impact: none
Permission impact: none
Notification/BusinessEvent/AI impact: none
Residual risk: dependency remediation is tracked and completed by BE-REM-002; this task does not change production readiness
```

### BE-REM-002 - Patch And Rebuild Dependency Baselines

```text
Task: BE-REM-002
Branch: codex/backend-rem-002-dependency-baseline
Implementation commit: b708a59
Files changed: requirements.in, requirements.txt, frontend/package-lock.json
Resolved Python advisories: cryptography 48.0.1 -> 50.0.0; sqlparse 0.5.5 -> 0.6.0
Resolved frontend advisories: brace-expansion 5.0.8 -> 5.0.9; dompurify 3.4.12 -> 3.4.13; nanoid 3.3.16 -> 3.3.18
Checks run and exact result:
- pip-compile regenerated requirements.txt with hashes; requirements-dev.txt remained unchanged after regeneration
- local .venv recreated with Python 3.12.13 and installed from requirements.txt plus requirements-dev.txt using --require-hashes
- .\.venv\Scripts\python.exe -m pip check -> No broken requirements found
- .\.venv\Scripts\pip-sync.exe --dry-run requirements.txt requirements-dev.txt -> Everything up-to-date
- .\.venv\Scripts\python.exe -m pip_audit -r requirements.txt --disable-pip -> No known vulnerabilities found
- npm ci -> 246 packages installed; audit reported 0 vulnerabilities
- npm audit --omit=dev -> 0 vulnerabilities
- .\.venv\Scripts\python.exe manage.py check -> System check identified no issues
- .\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run -> No changes detected
- .\.venv\Scripts\python.exe manage.py test -v 2 -> 858 tests passed in 1642.358s
- npm run build -> passed, including i18n, TypeScript, app and widget production builds
- npm run check:bundle -> passed; no chunk or app-shell budget violations
- git diff --check -> passed
Checks skipped and reason: browser E2E and visual gates were not repeated because no application or UI source changed; live provider checks remain outside this repository-only dependency task
Migration/env impact: no migrations or application environment variables changed; local .venv and frontend node_modules were rebuilt from committed locks
Permission impact: none; full authorization and tenant suite remained green
Notification/BusinessEvent/AI impact: no contract changes; complete backend suite remained green
Residual risk: future advisories require recurring audits; production infrastructure readiness is unchanged; BE-REM-003 is next
```

### BE-REM-003 - Harden Refresh Sessions And Password Flows

```text
Task: BE-REM-003
Branch: codex/backend-rem-003-auth-session-hardening
Implementation commit: 6eee7e0
Files changed: apps/accounts auth views, serializers, password/session security helpers and tests; business invitation password validation; frontend auth clients and Playwright token contracts
Behavior delivered:
- browser login, social signup, owner signup and refresh responses return access tokens only; refresh credentials remain in an HttpOnly cookie
- refresh rotation replaces the cookie and rejects reused, malformed, expired and blacklisted credentials with safe responses
- logout blacklists the presented refresh credential, clears the cookie and remains idempotent for invalid or already-revoked tokens
- password change revokes all earlier refresh sessions transactionally and issues one replacement cookie for the authenticated browser
- password-reset confirmation revokes every earlier refresh session and clears the browser cookie
- signup, password change, password reset and invitation acceptance share the configured Django password policy with field-level validation feedback
- login, logout, password-reset request, password change and password-reset confirmation record sanitized security history without credential material
- the existing frontend single-flight refresh path is preserved; password change/reset requests explicitly accept cookie updates
Checks run and exact result:
- .\.venv\Scripts\python.exe manage.py test apps.accounts.tests.AuthSecurityBaselineTests -v 2 -> 23 focused auth tests passed in 40.443s before the final two refresh edge/throttle regressions were added; the final full suite covers all 25 auth tests
- .\.venv\Scripts\python.exe manage.py test apps.businesses.tests_access.TeamAccessTests.test_accept_invitation_rejects_common_password -v 2 -> 1 test passed
- .\.venv\Scripts\python.exe scripts\codex_verify.py --mode full --base-ref f7c6db0 -> migration drift and system check passed; 868 Django tests passed in 1451.618s; frontend stages passed; browser launch stopped only because the newly required Playwright Chromium 1223 binary was not installed locally
- npx playwright install chromium -> installed Chromium and headless-shell revision 1223 in the local Playwright cache; no repository files changed
- .\.venv\Scripts\python.exe scripts\codex_verify.py --mode browser --base-ref f7c6db0 -> passed; mobile manager and owner smoke 2/2 passed
- .\.venv\Scripts\python.exe scripts\codex_verify.py --mode frontend --base-ref f7c6db0 -> passed; clean npm install reported 0 vulnerabilities, env isolation/i18n/TypeScript/app/widget builds passed, bundle budgets passed
- .\.venv\Scripts\python.exe scripts\codex_verify.py --mode security --base-ref f7c6db0 -> passed; hashed production/development locks installable, pip-audit found 0 known vulnerabilities, npm audit found 0 vulnerabilities
- git diff --check for the committed range and working tree -> passed
Checks skipped and reason: no checks skipped; the environment-only browser-runtime failure was corrected and the failed browser stage plus all remaining full-gate stages were rerun through their dedicated deterministic modes
Migration/env impact: no migrations and no application environment variables changed; Playwright Chromium 1223 was added only to the local user cache
Permission impact: no role or tenant permission contract changed; the complete authorization and tenant suite remained green
Notification/BusinessEvent/AI impact: none
Residual risk: access JWTs issued before password change/reset remain valid until the configured short 15-minute expiry; production cookie/CORS/CSRF values still require the external deployment gate; BE-REM-004 is next
```

Add one entry per subsequent completed item:

```text
Task:
Branch:
Commit:
Files changed:
Checks run and exact result:
Checks skipped and reason:
Migration/env impact:
Permission impact:
Notification/BusinessEvent/AI impact:
Residual risk:
```
