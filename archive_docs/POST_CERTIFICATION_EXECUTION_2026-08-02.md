# ZANI Post-Certification Execution — 2026-08-02

Status: Phases PC-1 and PC-2 are complete, independently verified and ready
for owner review.

Owner decision: accept the completed 22-item browser UI/UX remediation and the
Serenity login rebuild into the canonical integration branch, independently
reverify the result, publish exact evidence and keep `main` untouched.

## 1. Fixed boundaries

- Canonical acceptance branch: `codex/project-integration-2026-07`.
- Certified pre-change base: `266705c208ff28385a7706477b5257a9f356e954`.
- UI/UX remediation commit: `a7d9ce3f7dfdef0db3430801718a5a4be244f345`.
- Serenity login commit: `b41b44ba9fbc12f1873ac575b0f0fc84a2a1542f`.
- The accepted source is a direct descendant of the certified base, so PC-1
  must use a fast-forward-only integration.
- Never modify or push `main`.
- Do not add production credentials, live provider traffic, new integrations,
  clinical dentistry records, a new vertical workflow or unrelated features.
- Preserve tenant isolation, backend permissions, CRM lifecycle services,
  audit/activity, notifications, AI approval rules and capability enforcement.

## 2. Phase PC-1 — Canonical post-certification integration

Status: `DONE`

### PC-101 — Preflight and fast-forward

- [x] Fetch origin and confirm the integration worktree is clean.
- [x] Confirm local and origin integration both point to `266705c`.
- [x] Confirm `b41b44b` descends directly through `a7d9ce3` from `266705c`.
- [x] Fast-forward `codex/project-integration-2026-07` to `b41b44b`.

### PC-102 — Independent manager review

- [x] Review the complete `266705c..b41b44b` range.
- [x] Check tenant and permission boundaries before UI findings.
- [x] Check authentication/session restoration and logout behavior.
- [x] Check CRM/API compatibility, lifecycle effects, i18n and responsive UX.
- [x] Record confirmed defects or state that no blocking finding remains.

### PC-103 — Independent verification

- [x] Run focused authentication and changed-backend regressions.
- [x] Run frontend policy/build/bundle checks.
- [x] Run browser-backed route, responsive and login verification.
- [x] Run the deterministic full manager gate from certified base `266705c`.
- [x] Record all commands, results, skipped checks and environmental failures.

Required full gate:

```powershell
& 'C:\Users\user\Desktop\ZANI-main\.venv\Scripts\python.exe' `
  scripts\codex_verify.py --mode full --base-ref 266705c
```

### PC-104 — Evidence and handoff

- [x] Update this document with exact review and verification evidence.
- [x] Mark PC-1 `DONE` only after all required gates pass.
- [x] Commit the post-certification evidence as a focused documentation commit.
- [x] Push `codex/project-integration-2026-07`.
- [x] Stop for owner review before PC-2.

### PC-1 acceptance evidence

#### Integrated range and review

- Fast-forwarded the canonical integration branch from `266705c` through
  `a7d9ce3` to `b41b44b`; no merge commit was created.
- Independently reviewed all 62 changed files in `266705c..b41b44b` (2,308
  insertions and 392 deletions), including tenant/permission boundaries,
  HTTP-only refresh-cookie authentication, CRM card contracts, i18n and
  responsive behavior.
- No blocking tenant-isolation, authorization, CRM lifecycle, API-contract or
  frontend-layer finding remains after the correction below.

#### Blocking regression found and corrected

- The first deterministic full gate found one real regression in 849 Django
  tests: `client_crm_card` used 184 SQL queries against a budget of 40.
- Root cause: the CRM card adopted `DealListSerializer`, whose next-task fields
  require the filtered task prefetch already used by the normal Deal list, but
  the CRM-card queryset did not provide it.
- Correction commit: `25ed90e422cb13f817e20bcf9d94fd47a75ecf41`.
- The correction adds the same bounded task prefetch with explicit
  `business=business` scoping, excludes archived/terminal tasks and preserves
  the API response and permission model.
- Re-measurement on the identical representative dataset: 30 queries (budget
  40) and 136,464 payload bytes (budget 150,000), down from 184 queries.

#### Verification results

- `git diff --check`: passed before and after the correction.
- Focused backend regression command for accounts, business activation/demo
  seed, CRM cards and Lead creation: 66 passed; 10 local short-key warnings.
- Focused frontend policy tests: 16 passed across action feedback, bundle
  budget, dashboard appointment deduplication, daily workspaces and gate-env.
- `npm run build`: passed; TypeScript, app/widget builds and i18n parity passed
  with 4,621 keys across RU/KK/EN.
- `npm run check:bundle`: passed; app shell 255.8 kB before gzip against a
  400 kB budget, and no JavaScript chunk exceeded 500 kB.
- First full gate: correctly failed only on the 184-query CRM-card regression.
- Corrected full gate:

  ```powershell
  & 'C:\Users\user\Desktop\ZANI-main\.venv\Scripts\python.exe' `
    scripts\codex_verify.py --mode full --base-ref 266705c
  ```

  Passed with exit code 0: diff hygiene, migration drift, Django system check,
  all 849 Django tests, deterministic npm install, Vite environment isolation,
  frontend build/i18n, bundle budget, mobile owner/manager Playwright smoke,
  locked Python installability, Python dependency audit, npm moderate-severity
  audit and final diff hygiene.
- `npm run audit:interaction`: passed on 12 authenticated work areas with no
  auth redirects, unexpected application errors or API issues.
- `npm run audit:visual`: passed on 13 route/view variants with zero horizontal
  overflow, transparent-surface issues, API issues, auth API issues and auth-me
  server errors.
- Playwright login smoke: desktop RU and mobile EN rendered correctly; empty
  submit produced localized accessible field alerts; mobile 390 x 844 had zero
  horizontal overflow. Screenshots are in ignored local `output/playwright/`.

#### Non-blocking local observations and skipped scope

- An unauthenticated login-page load records the expected failed refresh call
  (`400` with no refresh cookie), and Vite has no favicon asset (`404`). Neither
  affects rendering, validation, authentication, the authenticated audits or
  the manager gate.
- The first manual browser start used a non-allowlisted origin and was rejected
  by CORS as designed; the canonical gate origin passed without CORS errors.
- Live provider traffic, production credentials, production deployment and
  dentistry-specific/clinical behavior were not run because they are outside
  PC-1 scope.
- `main` was neither modified nor pushed.

## 3. Phase PC-2 — Neutral CRM roles and terminology

Status: `DONE`

This phase captures the agreed direction for review. It is not authorization to
implement dentistry-specific adaptation or clinical functionality.

### N-101 — Canonical business access profiles

- [x] Standardize the core business profiles as Owner, Administrator/Director,
  Manager, Operator and Specialist.
- [x] Treat dentist, master, barber, coach and similar names as later vertical
  display titles or job titles, not hard-coded authorization roles.
- [x] Keep marketer and accountant as optional compatibility templates rather than required
  pilot roles.
- [x] Keep platform administration/support roles outside merchant CRM roles.

### N-102 — Permission preset alignment

- [x] Separate owner-only authority from delegated administrator authority.
- [x] Give an appointment-handling operator the required booking/reschedule
  permissions without granting settings, billing or integration control.
- [x] Scope a Specialist to assigned appointments, tasks and necessary linked
  client context instead of unrestricted merchant-wide clinical context.
- [x] Preserve backend Business scoping, object checks and OWN/TEAM/BUSINESS
  semantics with denial and tenant-isolation tests.

### N-103 — Industry-neutral calendar/resource language

- [x] Replace generic product mentions of master, doctor, barber and salon with
  neutral wording such as `Исполнитель / ресурс`.
- [x] Use neutral helper concepts: specialist, employee, room or workplace.
- [x] Align RU/KK/EN labels, placeholders, empty states, bot scheduling context
  and accessibility names.
- [x] Do not rename an inbound Lead/Request into an Appointment: unscheduled
  demand and a booked time slot remain separate CRM entities.

### N-104 — Generic CRM baseline before vertical adaptation

- [x] Keep the canonical modules and entities available in the generic CRM
  baseline: Inbox, Leads/Requests, Clients, Deals, Appointments, Calendar,
  Tasks, Timeline and Analytics.
- [x] Store business type without silently presenting a completed vertical
  adaptation until that vertical phase is explicitly approved.
- [x] Keep Deals distinct from a future clinical treatment plan.
- [x] Do not add medical history, diagnosis, radiographs, treatment plans,
  consent or other clinical-record behavior in this phase.

### N-105 — Neutralization acceptance gate

- [x] Backend permission happy-path, denial and tenant-isolation coverage.
- [x] Frontend build, i18n parity and bundle budget.
- [x] Browser verification of role visibility and calendar create/edit flows on
  desktop and mobile.
- [x] Final diff review and owner-facing report.

### PC-2 acceptance evidence

#### Implemented foundation

- Added the canonical merchant profile `specialist`; new memberships and
  invitations now default to it. Owner, administrator, manager, operator and
  specialist are the five merchant-facing profiles.
- Kept historical staff/doctor/marketer/accountant/support presets for data
  compatibility, but removed them from the default merchant role selector.
- Preserved owner-only authority, allowed administrators to manage delegated
  settings, gave operators business-wide booking/reschedule access without
  billing/settings/integration control, and scoped specialists to their own
  appointments, resources, tasks, leads and notifications.
- Added exact Resource and WorkingHours scoping through an active same-business
  `linked_user`, so specialist calendar reads cannot expose another employee's
  schedule or another tenant's records.
- Restored the generic CRM capability baseline for every business type. Merely
  selecting dentistry no longer hides Deals or switches to an implicit
  appointment-first vertical.
- Replaced profession-specific calendar, booking, bot and outreach language
  with neutral specialist/resource terminology across RU, KK and EN.
- Added migration `businesses.0010` for the canonical role choice/default; no
  environment variable or production infrastructure change was introduced.

#### Defects found during acceptance and corrected

- The first mobile Playwright run exposed that OWN-scoped specialists could
  read their appointment but not its linked Resource. Resource and
  WorkingHours scope resolution was added, covered by backend API tests and the
  repeated browser run.
- The first full manager gate found one stale tenant-isolation expectation: an
  operator with the new appointment permission was still expected to see an
  empty scheduling catalog. The contract now proves same-tenant catalog reads,
  foreign-tenant exclusion and continued settings mutation denial.
- Django generated the migration with CRLF endings; committed-range hygiene
  rejected it. The file was normalized to LF without changing migration state.
- An early browser attempt used a frontend port whose Vite proxy did not point
  to the backend. It was an environment-only start error; the canonical
  backend port was used for the accepted runs.

#### Verification results

- Focused canonical role/capability tests: 10 passed.
- Focused post-correction role and tenant contract: 6 passed.
- `manage.py makemigrations --check --dry-run`: no changes detected.
- `manage.py check`: no issues.
- `npm run build`: passed TypeScript, RU/KK/EN i18n parity and app/widget Vite
  builds.
- `npm run check:bundle`: passed the 400 kB app-shell and 500 kB chunk budgets.
- Role/calendar Playwright matrix on desktop and mobile: 5 passed, 3 expected
  project-specific skips.
- Deterministic full gate:

  ```powershell
  & 'C:\Users\user\Desktop\ZANI-main\.venv\Scripts\python.exe' `
    scripts\codex_verify.py --mode full --base-ref 9da4210
  ```

  Passed with exit code 0: working/index/committed-range diff hygiene,
  migration drift, Django system check, all 854 Django tests, deterministic npm
  install, frontend environment isolation, build/i18n, bundle budget, browser
  smoke, locked Python installability, Python dependency audit, npm audit and
  final diff hygiene.
- Live provider traffic, production credentials/deployment and
  dentistry-specific or clinical behavior were not run because they are
  explicitly outside PC-2 scope.
- `main` was neither modified nor pushed.

## 4. Phase boundary

PC-2 stops here after implementation, verification, documentation and task
branch publication. No vertical adaptation, new phase or production work may
start without a new explicit owner instruction.
