# AUD-027 — permission-scoped CRM projections

## Task contract

- Source: full-product audit `fc22f727941845465eaf2d9ea7a2f658e57ed1ab`, AUD-027 (CRM cards, restricted custom fields, pipeline board).
- Mode: implementation; gap: confirmed code defect. Owner: this Backend task.
- Observable result: a permitted parent does not disclose forbidden related records, their fields, counts, next-task preview, notes, attachments or timeline through a nested read.
- Worktree: `C:/Users/user/Desktop/Zani-aud027-access-projections`; branch `codex/aud027-access-projections`; starting HEAD/base `fc22f727941845465eaf2d9ea7a2f658e57ed1ab`. Initial tracked, staged and untracked state clean. Canonical checkout has unrelated WIP and remains untouched.
- Reuse: `scope_queryset`, `can`, capability guards, existing custom-field role rules, CRM serializers and timeline filters. No second permission framework.
- Scope: existing CRM projection selectors, affected board/history readers, regression tests and their documentation. No lifecycle/write changes, new role policy, AUD-041/043/050 write fixes, billing or provider work.
- Acceptance: OWN/TEAM/BUSINESS, explicit deny, inactive member, disabled module, foreign tenant; permitted data retained; denied secondary data absent before counts/limits; field view restrictions; actor-aware sensitive-field serialization; card and pipeline UI/API checks.
- Permissions: enforce existing read rules. Notification/BusinessEvent/AI writes: none. No migrations, dependency changes, production DB operations, real messages or money.
- Verification: first failing regression on the starting implementation; isolated Django check/migration drift; projection and dependent core/CRM/access/activity/attachment/custom-field/performance tests; reachable browser cases using isolated fixtures and unchanged frontend artifact if its source matches. Full release gate is for subsequent integration, not a claim made from targeted PASS.
- Delivery: local task worktree; no automatic merge, push or deployment. AUD-027 is not CLOSED until accepted integration and verification. Other audit results remain attached to their original candidate.

## Checkpoint

2026-09-16: implementation verified in a local, **uncommitted** task snapshot.
Starting HEAD is unchanged; this is not an integrated fix or a production-readiness claim.
The final isolated gate passed **189 tests (17 new regressions)** in 220.690s,
plus Django system check and migration-drift check. No migrations were generated.

Runtime/test/helper file SHA-256 values are in `output/aud027/runtime-snapshot.json`.
Its SHA-256 is `950bfcaad099b207b0f06b7cdf8b58b1c087ae31ec23b69a68ee9747fec1eb6f`.
Documentation edits after the gate do not change that runtime snapshot.

## Implemented boundary

| Read surface | Correction | Regression evidence |
| --- | --- | --- |
| Client/lead/deal/appointment CRM cards | Apply existing resource VIEW scope and module capability before selecting primary fallbacks, related arrays, counts and limits | OWN, TEAM, BUSINESS; explicit denial; revoked membership; disabled tasks; permitted records retained |
| Client list/detail/card annotations | Compute next task, counters and derived activity only from readable related records; reject foreign historical back-references even for a multi-business actor | Direct detail/list and card consistency; poisoned back-reference fixture |
| Deal list/board/card task preview | Scope task prefetch independently of the permitted deal | Earlier hidden task cannot replace the permitted next task |
| Pipeline board | Shared configuration access does not authorize every deal; serializer receives request context | Manager TEAM hidden detail stays absent; support amounts remain masked |
| Card history/notes/tags/attachment metadata | Scoped entity predicates; a client back-reference cannot reintroduce a forbidden CRM entity's history | Hidden task event/note/file/tag absent, visible equivalents retained |
| Activity list/detail/search/actors | Intersect existing endpoint access with known referenced CRM entities before pagination and counts | Denied detail 404, search/count/actor options cannot reveal hidden task events |
| Custom fields in cards | Reuse direct API field view-role rules and settings VIEW decision | Restricted definition/value absent for manager; public definition remains |

The new `crm_read_scope.py` composes existing `can`, `scope_queryset` and
capability checks; it does not define roles or a second authorization policy.
History retains archived records where currently permitted. Non-CRM/system
event policy is unchanged. No lifecycle or generic write contracts were changed.
Card entry points now require an actor even outside HTTP.

## Verification log

All test runs used the installed interpreter
`C:/Users/user/Desktop/Zani/.venv/Scripts/python.exe`, the maintained
`scripts.codex_verify.isolated_runtime` environment, a disposable SQLite test DB,
temporary media, mock providers and a loopback-only socket guard. Ordinary
working and frozen audit databases were not used. No dependency installation.

Exact final command, from the task worktree:

```powershell
& 'C:/Users/user/Desktop/Zani/.venv/Scripts/python.exe' -X utf8 -B output/aud027/verify.py apps.core.tests_crm_projection_access apps.core.tests_crm_cards apps.core.tests_custom_fields apps.core.tests_b301_performance apps.activities.tests_timeline_workspace apps.crm.tests apps.clients.tests apps.businesses.tests_access apps.core.tests_tenant_isolation apps.core.tests_b2_roles_queues apps.core.tests_b3_contracts apps.core.tests_b101_capability_enforcement apps.core.tests_file_attachments apps.core.tests_business_flows_e2e
```

The helper executes `check`, `makemigrations --check --dry-run`, then Django
`test` for those exact labels. Output: `output/aud027/final-gate.log` — **PASS**.
`git -c core.safecrlf=false diff --check` and re-hashing all 11 snapshot entries
also passed after documentation edits.
Python `ast.parse` on the nine changed/new Python files also passed; no bytecode
or working-database writes were needed for that check.
The first focused post-fix run passed 28 tests; the expanded focused run passed
51; the first dependent run passed 137. These are intermediate runs, not extra
unique coverage on top of the final 189.

Failures retained, not hidden:

- `before-fix.log`: fixture setup error (duplicate empty user emails), corrected
  in test fixtures before reproduction; not a product failure.
- `before-fix-attempt02.log`: original product code, 9 tests, **8 FAIL / 1 PASS**.
  Reproduced secondary task/deal/appointment disclosure, custom fields,
  capability bypass, auxiliary history and board sensitive-field disclosure.
- `list-preview-before.log`: **2 FAIL**, proving the same disclosure through
  client annotations and deal-list task previews before those corrections.
- `performance-01.log`: SQL-size regression, 21,657 versus the existing 15,000
  character budget. Fixed by reusing simple scoped base querysets; no budget relaxed.
- `projections-history-performance-02.log`: 29 passing checks and one test-helper
  datetime JSON serialization error; assertion serialization corrected, no
  product behavior weakened.
- Final B301: 60→300 representative rows, 32→33 queries, maximum SQL **14,025**
  at both sizes, card payload **137,201 bytes**. Query/payload/growth budgets pass.

## Browser checkpoint

- Chromium via existing Playwright CLI; Russian, desktop 1440×1000.
- Backend `http://127.0.0.1:8361`, frontend `http://127.0.0.1:5361`.
- Unchanged frontend artifact from the clean audited candidate's `frontend/dist`;
  `git diff fc22f727 -- frontend` is empty. No new frontend build claimed.
- Isolated browser fixture:
  `C:/Users/user/AppData/Local/Temp/zani-aud027-browser-tc8zgz63/browser.sqlite3`.
  Two synthetic businesses, seven users, active canonical memberships and a
  support compatibility member; one two-member team; one client; paired
  visible/hidden leads, deals, resources, appointments and tasks; task events,
  notes, tags and attachment metadata; one bot/conversation; two custom fields.
  Attachments contain metadata only. No live messaging or real contacts.
- At handoff the three named task browser sessions and both loopback servers
  are stopped; ports 5361/8361 have no remaining listener. The isolated fixture
  DB is retained at the path above for reproducibility, outside the shared
  screenshot bundle. No working/audit data or prior evidence was deleted.
- Initial runtime was restarted against the same temporary DB after the final
  selector change. Files prefixed `aud027-final-` verify the final runtime.
- Operator: client card/list/drawer preserve the permitted task and event,
  exclude the other owner's task/event, and show a scoped count of one.
- Manager: board displays one team deal and its task; client drawer shows
  `Shared field`, not `owner-field-secret`.
  The browser uses `/api/deals/board/`; the alternative
  `/api/pipelines/{id}/board/` is additionally covered by API regressions.
- Specialist: permitted appointment renders with no forbidden tasks/deals;
  direct navigation to the other specialist's record does not disclose it.
- Owner: both custom fields and the owner-only stored value remain visible;
  drawer counters retain two tasks/events. The `hidden-*` fixture names describe
  access relative to restricted actors, not an absolute ban for the owner.
- Owner/admin preservation, support masking, inactive member and foreign-tenant
  denial also have API regression coverage; these are not claims of a full
  five-role/device/language browser certification.

Screenshots and snapshots are under `output/playwright/`; a separate additive
evidence bundle is saved to
`C:/Users/user/Desktop/zani-ui-ux-audit-screens/remediation-aud027-20260916`.
The earlier audit report, defect IDs, screenshots and checkpoint are not rewritten.
There are **12 reviewed PNGs**, including **six final-runtime captures**;
`SCREENS.md` in the evidence bundle provides captions and runtime boundaries.
The browser initially navigated before the server was ready and two screenshot
saves failed before the output directory existed; both setup issues were
resolved and are not counted as successful captures. Fresh unauthenticated
sessions return 400 for refresh without a refresh cookie; forbidden record
navigation returns 404. No clean-console claim is made from those sessions.

## Remaining boundary / next step

- Commit, merge, push, PR and deployment were not performed. Canonical checkout
  WIP was neither incorporated nor overwritten. Integration owner must select
  the accepted branch, inspect overlapping changes and run its candidate gate.
- No full `scripts/codex_verify.py --mode full`, PostgreSQL/concurrency gate,
  dependency/security scan, new frontend build, complete mobile/KK/EN pass or
  live-provider certification: this is a bounded backend permission correction,
  not a release candidate certification. Historical full-audit failures are not
  declared fixed by the scoped PASS.
- Generic write/action affordances, custom-field editing UX, archive/count
  semantics and unrelated nested serializer contracts remain their existing
  audit scope. In particular this package does not close AUD-041/043/050.
- Browser observation retained: hidden appointment gives a generic validation-like
  error instead of a useful unavailable-record explanation. Existing technical
  action labels and misleading empty copy remain visible; no UI redesign here.
- Next bounded step: integrate this verified snapshot and repeat affected gates
  on the accepted candidate; do not rerun or reimplement the old foundation.

The later end-to-end phase means the complete business cycle: received Inbox message → client/lead and handling/assignment → calendar booking and its lifecycle/result → activity/notifications and reconciled Analytics metrics. It is not page navigation and is not silently included in this bounded security package.
