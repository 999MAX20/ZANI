# ZANI Functional Certification Report - 2026-08-20

## Decision

Status: **INDEPENDENT GATES PASS / FULL CERTIFICATION BLOCKED**.

The repository state passed every backend, frontend, browser, accessibility,
responsive, performance, migration and dependency-security gate executed in
BE-REM-007. Full application certification is not declared because the source
plan explicitly requires the unified failure-and-recovery layer. FB-001 through
FB-010 in `actual_docs/UNIFIED_FALLBACK_EXPERIENCE_PLAN.md` remain `NOT_STARTED`.

This is a scope dependency, not a test failure and not permission to mark
untested recovery behavior as passed.

## Tested Range

- Branch: `codex/backend-rem-007-functional-certification`
- Base: `00b1e2146f05cd92dbebc976ed3c3163eee3b958`
- Providers: deterministic mock or disabled; no live external writes
- Database: disposable/local SQLite test databases
- Browser projects: desktop Chromium, tablet Chromium and mobile Chromium
- Merchant roles: owner, administrator, manager, operator and specialist
- Production credentials and managed runtime services: out of scope

## Delivered Evidence

- `frontend/e2e/certification/route-action-registry.mjs` contains 43 complete
  structural entries covering 81 router declarations and 77 unique paths.
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

## Coverage Decision By Phase

| Phase | Result | Reason |
| --- | --- | --- |
| FC-001 registry | PASS | Structural coverage and guard test are green. |
| FC-002 search/filter contracts | PASS | Semantic browser assertions are green. |
| FC-003 form/mutation/dialog/session | PARTIAL | Representative contracts pass; exhaustive recovery depends on fallback. |
| FC-004 data/fault fixtures | PARTIAL | Deterministic role/tenant/large-data fixtures exist; full fault matrix is open. |
| FC-005 role/capability/tenant | PASS | Browser and 901-test backend evidence are green. |
| FC-006 ten merchant journeys | PARTIAL | Representative workflows pass; all ten are not yet fully UI/API/persistence certified. |
| FC-007 non-functional matrix | PASS | Viewports, Axe, focus, request/render and bundle budgets pass. |
| FC-008 final closeout | BLOCKED | Committed-range gate is pending and fallback prerequisite remains open. |

## Remaining Required Work

No newly invented CRM feature is required by this report. The remaining work is
the already approved quality debt:

1. Implement FB-001 through FB-010 from the unified fallback plan.
2. Execute the complete 400/401/403/404/409/429/500/timeout/offline/stale-response
   browser recovery matrix across relevant roles.
3. Complete UI/API/persistence evidence for each of the ten FC-5 merchant
   journeys.
4. Change registry entries from `NOT_RUN` only when each entry's complete
   action and failure contract has evidence.
5. Run the deterministic committed-range full gate and record its final commit.

Until those items are complete, BE-REM-007 remains `BLOCKED`, not `DONE`.
