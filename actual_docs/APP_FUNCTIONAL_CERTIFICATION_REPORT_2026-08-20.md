# ZANI Functional Certification Report - 2026-08-20

## Decision

Status: **PARTIAL - FC-004 AND FC-006 PASS; FC-003 AND FC-008 OPEN**.

The repository has deterministic failure/recovery coverage and exact
UI-to-API-to-persistence evidence for all ten critical merchant journeys.
`FC-004` and `FC-006` are accepted. Full application certification is not
declared because the 43-entry route/action registry remains structural: every
entry is still marked `NOT_RUN`, so it does not yet prove every interactive
control's expected result or approved exclusion. The current candidate also
requires its final committed-range gate before `FC-008` can be reconciled.

This is an evidence-granularity gap, not a known failing user journey and not
permission to mark unexecuted control contracts as passed.

## 2026-09-08 Reconciliation Addendum

- Candidate branch: `codex/be-gap-003-functional-certification`
- Base: `81167518fb60887c023069a1fd7fa83f90fba6aa`
- Merchant-journey registry: 10/10 exact journeys accepted
- Failure registry: 744 journey/role/state/viewport cells accepted
- Added browser journeys: J06 lead import, J07 team role change and J10
  source-grounded AI approval; 3/3 pass on desktop, tablet and mobile Chromium
- Clean current-candidate desktop project: 62 scenarios discovered; exit 0 on
  a disposable SQLite database
- Added backend regressions: lead duplicate preview and active-business team
  collection scoping pass together with existing AI approval and role audit
  flows
- Final candidate commit and full committed-range gate: pending

## Tested Range

- Branch: `codex/backend-rem-007-functional-certification`
- Base: `00b1e2146f05cd92dbebc976ed3c3163eee3b958`
- Certified implementation commit: `42db5d4`
- Providers: deterministic mock or disabled; no live external writes
- Database: disposable/local SQLite test databases
- Browser projects: desktop Chromium, tablet Chromium and mobile Chromium
- Merchant roles: owner, administrator, manager, operator and specialist
- Production credentials and managed runtime services: out of scope

## Delivered Evidence

- `frontend/e2e/certification/route-action-registry.mjs` contains 43 complete
  structural entries covering 85 router declarations and 81 unique paths in
  the current candidate.
- `frontend/scripts/check-functional-certification.mjs` and its guard test fail
  when active routes are absent or registry metadata is incomplete.
- `frontend/e2e/functional-certification.spec.ts` adds semantic search/filter,
  action-feedback, stale-response and active-business option contracts.
- The shared E2E fixtures now provide all five canonical merchant profiles,
  multiple accessible businesses and foreign-tenant records.
- Resource option selectors use a complete tenant-scoped endpoint instead of a
  paginated list.
- Team-member selectors pass the active business and the backend filters it
  after the existing accessible-business authorization check.
- Workspace focus restoration and background-render measurement are stable and
  covered by repeatable browser assertions.
- `frontend/e2e/certification/merchant-journey-registry.mjs` now maps exactly
  ten required journeys to route, role, persistence entity and exact browser
  and backend evidence markers.
- `frontend/e2e/merchant-journeys-certification.spec.ts` closes the previously
  missing end-to-end evidence for J06, J07 and J10.
- Lead import duplicate preview now applies when lead rows resolve an existing
  client identity; team roles, departments and invitations can be scoped to
  the active accessible business; AI task suggestions require a selected
  source conversation and explicit approval before execution.

## Exact Verification Results

```text
npx playwright test --workers=1
Result: 138 scenarios discovered across desktop/tablet/mobile; exit 0

.\.venv\Scripts\python.exe manage.py test -v 1
Result: 901 tests passed in 1511.830s; OK

.\.venv\Scripts\python.exe manage.py check
Result: System check identified no issues (0 silenced)

.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
Result: No changes detected

npm run check:certification
Result: 43 entries cover 81 router declarations (77 unique)

npm run test:certification-registry
Result: 1 passed, 0 failed

ZANI_QUALITY_GATE=1 VITE_API_URL=http://127.0.0.1:8000 node --test scripts/tests/*.test.mjs
Result: 29 passed, 0 failed

npm run build
Result: 4662 RU/KK/EN keys; TypeScript, application and widget builds passed

npm run check:bundle
Result: no JS chunk above 500 kB; app shell 261.6 kB below 400 kB budget

npm audit --omit=dev
npm audit
Result: 0 vulnerabilities in both trees

pip-audit
Result: no known vulnerabilities

npm run audit:interaction
Result: 12 workspaces; 0 auth redirects, 0 unexpected errors, 0 API issues
Artifact: output/playwright/interaction-audit-2026-08-20T13-34-13

npm run audit:visual
Result: 13 views; 0 horizontal overflow, transparent-surface, API or auth issues
Artifact: output/playwright/visual-audit-2026-08-20T13-38-22

.\.venv\Scripts\python.exe scripts\codex_verify.py --mode full --base-ref 00b1e2146f05cd92dbebc976ed3c3163eee3b958
Result: PASS against committed range ending at 42db5d4; all backend, frontend,
browser and security stages passed in 1561s
```

Current reconciliation checks before the final committed-range gate:

```text
npm run check:merchant-journeys
Result: 10/10 required merchant journeys accepted

npm run check:certification
Result: 43 entries cover 85 router declarations (81 unique)

npm run test:merchant-journey-certification
Result: 1 passed, 0 failed

npm run check:failure-certification
Result: 744 cells across 10 journeys, 5 roles, 12 states and 2 viewports

npm run test:failure-certification
Result: 1 passed, 0 failed

npx playwright test e2e/merchant-journeys-certification.spec.ts --project=desktop-chromium
Result: 3 passed in 1.3m

npx playwright test e2e/merchant-journeys-certification.spec.ts --project=tablet-chromium --project=mobile-chromium --workers=1
Result: 6 passed in 2.2m

npx playwright test --project=desktop-chromium --workers=1
Result: 62 scenarios discovered on a disposable SQLite database; exit 0 in 621.6s

focused Django certification regressions
Result: 6 passed across lead import, team scoping/permissions/audit and AI approval

npm run build
Result: 4841 RU/KK/EN keys; TypeScript, application and widget builds passed
```

## Defects Found And Corrected During Certification

1. The complete resource selector was accidentally limited by paginated list
   data. A dedicated tenant-scoped options action and regression test now
   return the full permitted set.
2. Team-member selectors could combine memberships from multiple businesses,
   producing duplicate React keys and incorrect assignment choices. Every
   caller now sends the active business, while the backend retains the
   accessible-business authorization boundary and rejects invalid IDs safely.
3. The workspace render-budget test could begin measurement before background
   queries settled. It now waits for a quiet render window and passed three
   focused repeats plus the complete browser run.
4. The accessibility test could inspect a route during its entry animation. It
   now waits for the real main surface to reach full opacity before Axe.
5. Two policy assertions described superseded product decisions: a separate
   `doctor` technical role and Inbox retry controls. They now enforce the
   canonical `specialist` mapping and the approved absence of retry controls.
6. Lead import preview omitted duplicate-client warnings even though lead rows
   resolve client identity. The lead path now reuses the same duplicate preview
   contract as client import and has backend plus browser regression coverage.
7. Settings loaded role, department and invitation collections from every
   accessible business. This could pair a member from one active business with
   a role id from another and cause a rejected update. Collection endpoints now
   preserve access checks and optionally scope to the active business; the UI
   always supplies that business.
8. AI tool execution had backend suggestion, approval and audit foundations but
   no source-grounded merchant UI flow. The assistant now requires a real
   conversation source, exposes the suggested action, and executes only after
   an explicit confirmation and approval record.
9. The working-hours editor restored focus to the first matching resource node,
   which could be a hidden duplicate in the responsive DOM. It now restores
   focus to the visible trigger after close and after confirmed discard.
10. Certification fixtures had drifted from current contracts: service
    activation is action-only, platform landing activation requires real MFA
    step-up, owner dashboard no longer duplicates manager appointment rows and
    retry UI is present only for backend-declared retryable errors. The tests
    now exercise those canonical contracts without bypassing their gates.

## Coverage Decision By Phase

| Phase | Result | Reason |
| --- | --- | --- |
| FC-001 registry | PASS | Structural coverage and guard test are green. |
| FC-002 search/filter contracts | PASS | Semantic browser assertions are green. |
| FC-003 form/mutation/dialog/session | PARTIAL | The 43 route/action entries still have `NOT_RUN`; control-level semantic evidence and approved exclusions remain open. |
| FC-004 data/fault fixtures | PASS | FB-010 deterministically covers 744 journey/role/state/viewport combinations. |
| FC-005 role/capability/tenant | PASS | Browser and 901-test backend evidence are green. |
| FC-006 ten merchant journeys | PASS | Exactly 10/10 journeys map to frontend, API and persistence evidence; missing J06/J07/J10 browser flows pass. |
| FC-007 non-functional matrix | PASS | Viewports, Axe, focus, request/render and bundle budgets pass; current J06/J07/J10 journeys pass on tablet/mobile and the clean desktop project exits zero. |
| FC-008 final closeout | PARTIAL | The prior committed-range gate passed; the current candidate gate and FC-003 reconciliation remain open. |

## Remaining Required Work

No newly invented CRM feature is required by this report. The remaining work is
formal semantic certification debt:

1. For every route/action entry, record executed expected-result evidence or an
   approved exclusion and replace `NOT_RUN` only when that evidence exists.
2. Run the final committed-candidate full gate and reconcile the exact result in
   this report.
3. Close `FC-003`, then publish the final `FC-008` acceptance decision.

Until those items are complete, BE-REM-007 remains `PARTIAL`, not `DONE`.
