# Zani Testing Guide

## Verification Selection And Evidence

This guide owns command selection and test-environment safety for `AGENTS.md`,
the task template and verification skills. Choose required checks before coding;
do not lower the agreed acceptance criteria after a failure.

| Change / checkpoint | Required evidence |
| --- | --- |
| Docs/instructions only | Working-tree/index diff hygiene; committed-range hygiene when a range exists; changed links/anchors, command examples and instruction consistency; explicitly inspect new/untracked files |
| Focused backend iteration | Smallest reproducer/regression check in an isolated environment |
| Backend phase close | Django check and migration drift, affected/dependent test suites; happy path, role denial and tenant isolation for CRM lifecycle changes |
| Integration / AI | Backend gate plus applicable auth, idempotency/replay, retry/recovery, no-data/approval and secret-masking checks; no live provider calls |
| Frontend / reachable mixed flow | Build and affected UI/API flow evidence; targeted browser checks for business-critical behavior; backend gate when contracts change |
| Intentional migrations | Drift check, clean isolated migration and applicable compatibility/data-migration proof; never apply to a working database implicitly |
| Release-candidate integration | `full` on the exact candidate/base, plus any additional acceptance-specific browser/contract suites |
| Live-provider / deployed acceptance | Explicitly authorized target-environment, recovery and rollback checks; local eager/mock PASS is not live readiness |

For each check record command, exit/result, coverage, environment and commit or
identified dirty snapshot (base/HEAD and the affected tracked/untracked content).
Record failed/skipped checks and their acceptance impact. An unchanged branch
name is not proof that the files stayed unchanged. Relevant later code,
dependency, config or fixture changes require rechecking affected evidence.
Historical closures at their named commits remain historical facts.

An unresolved required gate blocks the corresponding acceptance claim. Call a
failure baseline only with evidence; fix in-scope regressions and do not silently
expand into unrelated repairs. Two equivalent failed attempts without changed
inputs require a revised hypothesis before another blind rerun.

For docs-only tasks, use `git diff --check` and `git diff --cached --check`,
plus `git diff --check <base>...HEAD` only when an actual task range exists.
Check local targets/anchors and inspect executable examples against the current
CLI/helper implementation. Diff hygiene does not inspect untracked files and
does not prove instruction behavior. For a changed skill, also validate its
frontmatter/references and reason through relevant decision scenarios.

Use separate worktrees for parallel code changes, and separate databases,
loopback ports and worker queues for their checks. Never use an existing merchant
database, real credentials or someone else's server as a convenient test fixture.

## Deterministic Local Quality Gate

The cross-platform gate is the single local entrypoint for acceptance checks:

```powershell
.\.venv\Scripts\python.exe scripts\codex_verify.py --mode full --base-ref <task-base-sha>
```

```bash
.venv/bin/python scripts/codex_verify.py --mode full --base-ref <task-base-sha>
```

`full` runs, in fail-fast order:

1. Python and frontend lock validation plus working-tree, index and committed-range Git diff hygiene;
2. Django migration drift and system checks;
3. the full Django test suite;
4. `npm ci`, actual Vite env-file isolation, i18n/type checking, production
   builds and the bundle budget;
5. the focused Playwright mobile owner/manager CRM smoke;
6. hashed Python lock installability, `pip-audit`, and npm moderate-severity audit;
7. final diff hygiene.

It creates a unique temporary SQLite database for every invocation, allocates
dedicated loopback ports for browser runs, refuses to reuse existing servers,
and removes the database in a `finally`-equivalent context on pass or failure.
It never writes ordinary `db.sqlite3`, even when `DATABASE_URL` is inherited.

The gate passes through only the minimum OS process environment. It explicitly
selects the Python runtime and deterministic seed identities, uses
in-memory/eager workers and the locmem email backend, and clears known AI,
provider, cloud-storage, SMTP and monitoring credentials. Values from a
developer shell or `.env` cannot opt the quality gate into live services.
Every tracked `VITE_*` runtime variable is set in the process environment, so
Vite's process-over-file precedence prevents ignored `frontend/.env*` files
from enabling telemetry, OAuth clients or CRM flags. A gate regression uses
Vite's own `loadEnv` against a controlled unsafe `.env` fixture.

Every invocation requires an explicit fetched task or PR base:

```powershell
.\.venv\Scripts\python.exe scripts\codex_verify.py --mode static --base-ref <task-base-sha>
```

The base must resolve to a commit, be an ancestor of `HEAD`, and differ from
`HEAD`. Shallow CI checkouts must fetch the base history; CI uses
`fetch-depth: 0` and passes the PR base SHA or push `before` SHA explicitly.

Capture the real starting/task base before implementation. If HEAD still equals
that base, do not select an arbitrary older commit to manufacture a passing
committed range. Use the isolated focused path below for local WIP; report that
no task committed-range gate has run. Once the intended candidate is committed,
run the required gate against the captured base. `--list-stages` previews a
plan after preflight; it does not execute or pass the listed tests.

Use the smallest constituent mode while iterating:

```powershell
.\.venv\Scripts\python.exe scripts\codex_verify.py --mode static --base-ref <task-base-sha>
.\.venv\Scripts\python.exe scripts\codex_verify.py --mode backend --backend-target apps.core.tests_tenant_isolation --base-ref <task-base-sha>
.\.venv\Scripts\python.exe scripts\codex_verify.py --mode frontend --base-ref <task-base-sha>
.\.venv\Scripts\python.exe scripts\codex_verify.py --mode browser --base-ref <task-base-sha>
.\.venv\Scripts\python.exe scripts\codex_verify.py --mode security --base-ref <task-base-sha>
```

`--backend-target` is valid only with `--mode backend`. It is rejected with
`full`, so the integration plan always contains the unscoped
`python manage.py test -v 2` command.

`scripts/codex_verify.sh` and `scripts/check_local_ci.sh` are Unix wrappers over
the same implementation; they do not maintain separate verification logic.

### Dependency lock maintenance

`requirements.in` is the human-edited set of direct Python constraints.
`requirements.txt` is the complete, hashed installation lock. Regenerate it
only through pip-tools and review the resulting dependency/security diff:

```bash
python -m pip install pip-tools
python -m piptools compile requirements.in \
  --output-file requirements.txt \
  --generate-hashes \
  --strip-extras \
  --allow-unsafe \
  --resolver backtracking
python -m pip install --require-hashes -r requirements.txt
```

`requirements-dev.in` and `requirements-dev.txt` pin the verification tools
(`pip-audit` and `pip-tools`) without adding them to the production image:

```bash
python -m piptools compile requirements-dev.in \
  --output-file requirements-dev.txt \
  --generate-hashes \
  --strip-extras \
  --allow-unsafe \
  --resolver backtracking
python -m pip install --require-hashes -r requirements-dev.txt
```

The frontend uses the committed npm v3 lock at
`frontend/package-lock.json`; do not add lockfiles in directories without a
matching `package.json`. `npm ci` is the acceptance install path and
`npm audit --audit-level=moderate` is the required threshold.
The pinned React Router runtime requires Node.js `>=22.22.0`; local and CI
frontend verification must satisfy that engine.

The production Docker image and the backend CI job both install
`requirements.txt` with `--require-hashes` on Python 3.11. The CI backend job
also installs `requirements-dev.txt` with hashes and runs `pip-audit`; that job
is the authoritative Python 3.11 lock proof when a local 3.11 runtime or Docker
daemon is unavailable.

## Isolated Focused Checks Before A Committed Range

Run from the task's repository root. Use its installed Python, or an explicitly
selected compatible existing interpreter for a linked worktree. Do not install
another environment solely to inspect docs or list command help.

This narrow PowerShell example reuses the existing runner's isolation helper;
it is not another gate implementation. It runs Django checks and explicit test
labels without pretending to verify a committed range:

```powershell
$zaniPython = '.\.venv\Scripts\python.exe'
$zaniFocusedCheck = @'
import subprocess
import sys
from scripts.codex_verify import isolated_runtime

labels = sys.argv[1:]
if not labels or any(label.startswith("-") for label in labels):
    raise SystemExit("Provide explicit Django test labels, not options.")
with isolated_runtime(python=sys.executable) as runtime:
    commands = (
        ("check",),
        ("makemigrations", "--check", "--dry-run"),
        ("test", *labels, "-v", "2"),
    )
    for command in commands:
        subprocess.run(
            [sys.executable, "manage.py", *command],
            env=runtime.environment,
            check=True,
        )
'@
& $zaniPython -c $zaniFocusedCheck apps.core.tests_tenant_isolation
if ($LASTEXITCODE -ne 0) { throw 'Focused verification failed.' }
```

On Unix, run the same Python body with the task's interpreter and explicit
labels; do not replace the isolation helper with a few inherited env overrides.
Tests still must mock provider clients as described under External Network Policy.
Use Django dotted labels with `manage.py test`; use actual file/node paths for
pytest, not a copied list of dotted Django modules without the proper adapter.

For a committed backend task, prefer `--mode backend --backend-target <label>`;
repeat `--backend-target` for the affected dependencies. Scope selection follows
changed behavior rather than a permanently frozen app list.

For frontend acceptance, use the documented frontend mode. Its `npm ci` stage
already performs a deterministic install; do not manually delete node_modules
or regenerate lockfiles as a routine first response to a failed check.

## Frontend Bundle Hygiene

After frontend-only routing, i18n, layout, or page-splitting work, record the relevant production build output instead of treating bundle warnings as noise:

```bash
cd frontend
npm run build
npm run check:bundle
```

Use this as a lightweight regression note for large first-load risks. Pay special attention to:

- `i18n-*` chunks: the app should not load all supported language dictionaries for every first load;
- authenticated route chunks: large CRM pages should stay behind lazy route boundaries;
- shell chunks such as app layout, search, public pages, and platform layout;
- any JS chunk above 500 kB before gzip, which should be explained or split when the cause is avoidable.

## CRM E2E Business Flow Gates

Cross-entity CRM coverage uses Django label `apps.core.tests_business_flows_e2e`.
Run it through the isolated focused path above, or:

```powershell
.\.venv\Scripts\python.exe scripts\codex_verify.py --mode backend --backend-target apps.core.tests_business_flows_e2e --base-ref <task-base-sha>
```

It covers owner login/dashboard/lead assignment, client-backed lead -> appointment -> task, lead -> deal won/lost, inbox AI qualification -> lead/task, duplicate merge, appointment lifecycle, BusinessEvent timeline mapping and AI approval-gated tool execution.

Mobile owner/manager smoke is in `frontend/e2e/smoke.spec.ts`. The browser gate
supplies isolated DB/ports and the safe environment to Playwright, whose local
setup uses `frontend/e2e/django-e2e.mjs` to prepare and start Django:

```bash
.venv/bin/python scripts/codex_verify.py --mode browser --base-ref <task-base-sha>
```

If deliberately starting services yourself, first verify an isolated disposable
DB, safe provider settings and dedicated ports. Only then set
`E2E_SKIP_LOCAL_SETUP=true`, `E2E_BASE_URL` and `E2E_API_BASE_URL`. Do not let
Playwright migrate/seed an ordinary working database through inherited settings.

## Controlled Pilot QA

Use this gate before claiming a local/dev merchant journey is ready for a controlled pilot without production credentials or live provider traffic.

Use the `full` candidate gate above and the applicable functional certification
criteria. `prepare_pilot_demo --reset`, `pilot_launch_quality_gate` and scripts
such as `pilot_smoke_check.sh` are not read-only diagnostics: inspect their
setup/data effects before running them. Do not run them against ordinary
`db.sqlite3` or assume a new worktree has a separate database.

For explicitly requested demo/manual QA, provision a fresh disposable database
under a unique temporary directory, use the runner's safe environment and
dedicated ports, and verify the resolved database target before migrate/seed.
Keep the isolated runtime alive for the manual session and clean up only its
verified task-owned resources afterwards. Existing working/staging/production
databases require explicit authorization for the exact mutation and target.

The pilot demo seed is deterministic for local/dev QA and includes platform admin, business owner, manager and operator users. It creates a demo merchant with leads, clients, tasks, inbox handoff, website/Excel connector signals, sales events and a safe AI-created task flow. Mock/dev connector states must stay visibly separated from live production providers.

`ALLOW_DEMO_MERCHANT_FLOWS=True` is required for local/staging demo-data and mock-sync QA. Keep it `False` in production so onboarding demo-data and connector mock-sync cannot be presented as live merchant functionality.

When demo-seed behavior is changed, include `apps.businesses.tests_demo_seed`
and `apps.core.tests_business_flows_e2e` in the focused/scoped backend checks,
then run the required candidate and user-flow gate. Seed data is not evidence
that a real provider is connected.

Manual fallback when browser automation is unavailable:

1. In the explicitly requested isolated demo session described above, prepare
   fixtures and log in as owner, manager and operator; do not reset a working DB.
2. Owner path: dashboard -> leads -> inbox -> AI assistant/action -> integrations -> analytics.
3. Manager path: assigned leads/tasks/inbox handoff.
4. Operator path: task queue and inbox handoff visibility.
5. Confirm `/api/pilot/readiness/`, owner dashboard, inbox summary and integration health states are reachable and do not imply live providers are connected.

## External Network Policy

Backend tests must not call real external services.

During `manage.py test`, settings force safe defaults:

- `OPENAI_API_KEY=""`;
- `TELEGRAM_ENABLED=False`;
- `WHATSAPP_ENABLED=False`;
- `INSTAGRAM_ENABLED=False`;
- `EMAIL_BACKEND=django.core.mail.backends.locmem.EmailBackend`.

OpenAI code must return controlled mock responses when `OPENAI_API_KEY` is empty. Telegram outbound must return a mock result when `TELEGRAM_ENABLED=False`.

If a future test needs a provider integration, mock the provider/client explicitly and assert that no real network call is made.

## If Tests Hang

1. Capture the last test name, command and environment from the existing run.
2. Reproduce the smallest target with the isolated verbose focused path above.
3. Search that test for external calls such as `urlopen`, `requests`, SDK clients, email backends or long sleeps.
4. Disable the provider with `override_settings(...)` or patch the network client.
5. Run the affected/dependent gate after the fix; run the full required gate for
   candidate integration. Preserve unrelated failure evidence instead of
   expanding into another feature stage or repeating the same hanging command.
