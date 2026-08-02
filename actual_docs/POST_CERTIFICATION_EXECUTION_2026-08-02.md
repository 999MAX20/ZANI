# ZANI Post-Certification Execution — 2026-08-02

Status: Phase PC-1 complete and ready for owner review. Phase PC-2 is a
reviewable draft and has not started.

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

Status: `DRAFT — NOT STARTED`

This phase captures the agreed direction for review. It is not authorization to
implement dentistry-specific adaptation or clinical functionality.

### N-101 — Canonical business access profiles

- [ ] Standardize the core business profiles as Owner, Administrator/Director,
  Manager, Operator and Specialist.
- [ ] Treat dentist, master, barber, coach and similar names as later vertical
  display titles or job titles, not hard-coded authorization roles.
- [ ] Keep marketer and accountant as optional templates rather than required
  pilot roles.
- [ ] Keep platform administration/support roles outside merchant CRM roles.

### N-102 — Permission preset alignment

- [ ] Separate owner-only authority from delegated administrator authority.
- [ ] Give an appointment-handling operator the required booking/reschedule
  permissions without granting settings, billing or integration control.
- [ ] Scope a Specialist to assigned appointments, tasks and necessary linked
  client context instead of unrestricted merchant-wide clinical context.
- [ ] Preserve backend Business scoping, object checks and OWN/TEAM/BUSINESS
  semantics with denial and tenant-isolation tests.

### N-103 — Industry-neutral calendar/resource language

- [ ] Replace generic product mentions of master, doctor, barber and salon with
  neutral wording such as `Исполнитель / ресурс`.
- [ ] Use neutral helper concepts: employee, room or workplace.
- [ ] Align RU/KK/EN labels, placeholders, empty states, bot scheduling context
  and accessibility names.
- [ ] Do not rename an inbound Lead/Request into an Appointment: unscheduled
  demand and a booked time slot remain separate CRM entities.

### N-104 — Generic CRM baseline before vertical adaptation

- [ ] Keep the canonical modules and entities available in the generic CRM
  baseline: Inbox, Leads/Requests, Clients, Deals, Appointments, Calendar,
  Tasks, Timeline and Analytics.
- [ ] Store business type without silently presenting a completed vertical
  adaptation until that vertical phase is explicitly approved.
- [ ] Keep Deals distinct from a future clinical treatment plan.
- [ ] Do not add medical history, diagnosis, radiographs, treatment plans,
  consent or other clinical-record behavior in this phase.

### N-105 — Neutralization acceptance gate

- [ ] Backend permission happy-path, denial and tenant-isolation coverage.
- [ ] Frontend build, i18n parity and bundle budget.
- [ ] Browser verification of role visibility and calendar create/edit flows on
  desktop and mobile.
- [ ] Final diff review and owner-facing report.

## 4. Phase boundary

PC-1 must stop after the canonical integration branch is green, documented and
pushed. PC-2 may begin only after a new explicit owner instruction following
the PC-1 completion report.
