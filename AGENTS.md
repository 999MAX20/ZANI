# AGENTS.md

Execution rules for Codex/AI agents in Platforma.CRM / Zani.
These rules govern work; live status and test counts belong in task evidence.

## 1. Start and restore context

1. Read [STATUS.md](STATUS.md), the selected checkpoint in
   [PRIMARY-SESSION](docs/testing/task-state/PRIMARY-SESSION.md), and the continuity
   section of [task template](docs/testing/CODEX_TASK_TEMPLATE.md).
2. Check [project handoff](actual_docs/PROJECT_HANDOFF.md),
   `.codex/project-session.json` and [rollover protocol](docs/testing/SESSION_ROLLOVER.md).
   Establish the registered owner, authorized scope, remaining result and one next step.
3. Verify actual repository root, branch, HEAD, staged/unstaged changes and untracked
   files. Separate task-owned work from user/other work; retain a starting snapshot.
4. Read the relevant contracts below and compare existing code/tests/closure evidence
   before creating models, endpoints, services or components. An old plan is not a new task.

Only `C:\Users\user\Desktop\Zani` is a writable source checkout (owner decision
2026-09-21). Do not create/use another worktree, clone or source copy for edits.
Alternate trees are read-only recovery sources until separately accepted/retired.
One repository-wide writer includes code, migrations, contracts and shared docs.
Parallel audits may only read an identified snapshot. Keep the current branch;
never switch a dirty/shared checkout or overwrite it to match a remembered revision.
Unexpected writer, branch/HEAD drift or affected-path changes pause writes until reconciled.
See [consolidation evidence](docs/testing/task-state/CONSOLIDATION-2026-09-21.md).

Run servers from the canonical folder. Before trusting localhost, verify backend,
frontend and worker source roots and build/profile. Do not stop others' processes.
Disposable test databases/build outputs are allowed, not alternate source trees.
Working-DB migrations and removal of old trees need their own agreed scope/checks.

## 2. One bounded work cycle

- Use the existing task ID/source and record a compact contract before implementation:
  mode, observable result, gap type (code/evidence/environment/policy/roadmap), reused
  layers, scope/non-goals, owner/root/base, acceptance and required checks. Use the
  [task template](docs/testing/CODEX_TASK_TEMPLATE.md); scale detail to the change.
  Clear user authorization suffices; routine steps need no repeated approval.
- Identify permission, notification, BusinessEvent, AI, migration/env impacts.
  An environment/evidence gap does not automatically authorize a code rewrite.
- Inspect, make the smallest sufficient change, verify the affected behavior, record
  evidence and publish under section 6. Prefer small services/selectors/components.
  Do not mix unrelated backend/UI/integration/docs changes without explicit scope.
- Preserve unrelated changes; never revert another person's work without authorization.
  Refactor only for acceptance or a demonstrated risk in the changed path. File size
  prompts review, not a rewrite. Record optional cleanup separately; no endless polish.
- Reopen closed work only for a reproduced regression, proven missing acceptance
  criterion or approved requirement change. Record prior closure, new evidence,
  minimal delta and regression check. Do not restart audits merely after compaction.
- After two equivalent failed attempts with unchanged inputs, change the hypothesis
  and run the smallest diagnostic. Explicit order/flakiness experiments remain valid.
  Fix in-scope failures; preserve evidence for external/unrelated blockers without
  silently expanding scope. Request direction only when needed.
- Code shows actual behavior; approved contracts define required behavior. Neither a
  newer timestamp nor an index resolves policy conflict. For unresolved permission,
  lifecycle, data-loss or external-effect policy, obtain an owner decision before
  dependent changes; continue independent authorized work.

## 3. Product and engineering invariants

Zani is an AI-first CRM/business control layer for SMB. The first paid release
serves dental administrators under [V1 rules](docs/product/V1_PRODUCT_RULES.md).
Keep daily work simple, fast, role-aware and action-oriented. Do not introduce
clinical records, a new permission framework or vertical-mode rewrite implicitly.
Do not turn it into heavy ERP, a full-sync warehouse, an admin maze, a developer
console for merchants or a mock-only demo.

Implementation order: domain invariants → state machines → audit/activity → API
contracts → frontend integration → E2E. Do not polish a page while rules are bypassable.

- Tenant isolation: merchant entities belong to `Business` or safely derive access
  through related objects; all linked entities must belong to the same business.
- Backend authorization is mandatory; hidden buttons and frontend validation are
  insufficient. Account assignees/owners/watchers/responsible users must be active
  business members. Appointment specialists follow their own approved domain contract.
- Keep business logic in services/selectors/state-machine helpers. Views validate,
  authorize, call services and return responses. CRM lifecycle fields (status/stage,
  completion/win/loss/archive timestamps, ownership/assignment) change through domain
  services, not ad hoc view/frontend writes.
- Deal stage must belong to the business and pipeline; terminal transitions use
  deal services; lost leads/deals require a reason. Booking/rescheduling respects
  working hours and overlap rules. Important actions write activity; sensitive or
  destructive actions write audit logs. Archive/restore critical data by default;
  merge/delete flows remain traceable.
- React uses `frontend/src/api/*`; no raw API calls in components. Search/reuse existing
  layers first. Provider-specific behavior stays behind connectors/provider adapters.
- Never expose secrets/tokens. Use env/config, encrypted credentials and masked
  serializers. Merchant daily UI hides provider technical complexity in setup/help.
- AI stays optional: ordinary CRM continues when it is unavailable. Critical changes
  require explicit user confirmation. Ground output in real entities/events with
  sources, or clearly say data is missing. A backend-only foundation is not complete
  without its applicable reachable user flow, permissions and tests.

## 4. Select relevant authority, not every document

Always follow [clean-code rules](plan/clean_code_rules/zani_required_clean_code_rules.md).
Use [docs index](docs/README.md) for document placement and
[V1 rules](docs/product/V1_PRODUCT_RULES.md) for product scope/behavior, AI, billing,
integrations and release acceptance. V1 overrides older proposals, not security.
For defect fixes, UI/UX audits or functional certification read
[defect knowledge](actual_docs/DEFECT_KNOWLEDGE_BASE.md).

| Work/question | Authority |
| --- | --- |
| Project identity/routing | `actual_docs/README.md`, `actual_docs/PROJECT_HANDOFF.md` |
| Pre-pilot order / backend gaps | `actual_docs/PRE_PILOT_CODE_READINESS_MASTER.md`, `docs/pilot/backend-open-logic-register.md` |
| Functional / recovery acceptance | `actual_docs/APP_FUNCTIONAL_CERTIFICATION.md`, `actual_docs/UNIFIED_FALLBACK_EXPERIENCE_PLAN.md` |
| CRM behavior | `docs/crm/CRM_PRODUCTION_LAYER_PLAN.md`, `docs/security/PERMISSION_MATRIX.md`, `docs/ai/AI_ASSISTANT_RULES.md`, `docs/automation/automation-runtime.md`, `docs/billing/entitlements.md` |
| Frontend | `docs/frontend/design-system.md`, `plan/ui_ux_design_system_reform.md` |
| Integrations | `docs/integrations/CONNECTOR_BLUEPRINT.md`, `docs/integrations/integrations.md`, `docs/integrations/provider-rollout.md` |
| Infrastructure | `docs/production/production-readiness.md`, `docs/production/production-readiness-10000-audit.md`, `docs/production/deployment.md`, `docs/production/paid-beta-gate.md` |
| Verification | `docs/testing/testing.md`, `docs/testing/CODEX_TASK_TEMPLATE.md` |

Indexes route to owners; archived plans, redirect stubs and historical checkpoints
never authorize new work. Do not chase missing historical plans. Correct stale
indexes only with unambiguous evidence and documentation scope.

## 5. Verification proportional to the change

[Testing guide](docs/testing/testing.md) owns exact commands and the matrix.
Use cross-platform `scripts/codex_verify.py`; Bash is not required. Select gates
before implementation; do not lower acceptance after a failure.

| Change | Required boundary |
| --- | --- |
| Docs only | Working/index/real committed-range diff hygiene; links, commands, consistency and new/untracked-file review. No unnecessary app build/install. |
| Backend iteration | Smallest isolated reproducer/regression; at phase close, system/migration-drift checks and affected/dependent suites. |
| Frontend / mixed flow | Build plus affected reachable UI/API evidence; backend checks when contracts change. |
| CRM lifecycle / security / AI / integration | Applicable happy path, permission denial, tenant isolation, recovery/no-data/approval/idempotency and secret handling under the guide. |
| Release-candidate integration | Full gate on the exact candidate/base plus acceptance-specific checks; scoped PASS is not full PASS. |
| Live/deployed acceptance | Explicitly authorized target/environment; local mock/eager evidence is not live readiness. |

The runner needs an explicit ancestor base different from HEAD. With no committed
range, use the documented isolated focused path and state that boundary; never
invent a base. Reuse evidence only for unchanged relevant inputs. New changes,
failures or unresolved concerns justify rechecks; unchanged docs do not invalidate
application evidence. Do not weaken assertions to make a gate green.

Generate only intentional migrations, test them in an isolated DB, and distinguish
that from applying them to a working DB. Working/staging/production migrations,
seed/reset or destructive smoke need explicit target/scope authorization. Never
repopulate ordinary `db.sqlite3` during verification.

Checkboxes require their applicable passed gate. A baseline failure needs evidence,
not an assertion; it still blocks any acceptance it leaves unproven. Record exact
commands, results, skipped checks/reasons, environment, coverage and commit or dirty
snapshot. Distinguish implemented, verified, committed, integrated and deployed.
If `.git` is absent, say branch/publication operations cannot be proven locally.

## 6. Verified commit and normal push

Standing owner authorization (2026-09-21): after an approved implementation/docs
change passes its required gates, commit and promptly normal-push to `origin`
(`https://github.com/999MAX20/ZANI.git`), target `main`. Read-only/no-push requests
and unresolved target/safety questions override it. This is not an automatic hook.

1. Verify canonical root, single owner, branch/HEAD, task-owned diff, pre-existing
   WIP and agreed target. Missing/ambiguous upstream blocks publication, not permission
   to choose one. Keep the branch; use agreed PR/branch only when requested.
2. Review the entire intended commit and outgoing range, including untracked files,
   for secrets, private data and unrelated work. Stage explicit reviewed paths/hunks.
3. Make a meaningful conventional commit; fetch the agreed target and prove normal
   fast-forward publication. Do not silently merge/rebase unrelated histories,
   reset, rewrite history or force-push. Conflict, unexpected writer or failed
   required gate stops publication; preserve work and report the blocker.
4. Push promptly and read back the remote SHA: it must match the intended commit.
   Inspect actual CI separately; queued/not run is not green. A failed push means
   committed locally, not synchronized. Inspect push-triggered deployment effects
   before first publication to a new target; resolve unexpected effects.
5. Report canonical root, branch/commit, exact checks/skips, push and actual CI.
   Do not claim full delivery while a required gate/publication is blocked.

One task is one bounded change set in the canonical folder, not another worktree.
PR summaries include business areas, checks, migration/env, permission, notification,
BusinessEvent/AI impact, manual evidence and risks. Standing publication permission
never authorizes new tasks, releases/tags, PR creation, deployment or working-DB migration.

## 7. Checkpoints, interruption and stopping

The current owner updates STATUS.md at scope changes, meaningful results, blockers
and before ending/agreed handoff. Keep it compact: state, decisions, links and next
step. Detailed scope/DoD, Git/dirty ownership, checks, failures/attempt limits, processes
and closed work belong in the existing checkpoint, not another backlog. Update relevant
docs after meaningful changes; update the CRM plan when its scope/status changes and
README only for setup/behavior/public-status changes. Preserve closed evidence/archive
bodies and unresolved approved contracts; do not archive unfinished work as complete.
Never store secrets/full chats or duplicate changing counts across indexes.
Strict read-only work reports context without writing files.

Compaction restores the same task in the same chat after Git/evidence checks.
It does not authorize ownership transfer, new tasks, commits, worktrees, scope expansion
or archive. Do not disable compaction or split scope to manufacture completion.
No background autosave is promised; abrupt closure may leave unsaved progress.

An explicit user command «Передай работу новому чату» invokes the managed handoff
in [SESSION_ROLLOVER](docs/testing/SESSION_ROLLOVER.md). It authorizes one successor
named Platforma.CRM in the same saved project/local canonical folder, its prepared
read-only context prompt, verified ownership transfer and archival of this source.
Follow the protocol without asking again for already-authorized steps. A quotation,
discussion/setup of this command, compaction, window closure or archive-button click
does not invoke it. Reuse an existing transition; never create a duplicate successor.
The command does not waive completion/ownership checks or authorize a product phase.

For an unavailable old chat, perform read-only reconstruction under the
[recovery protocol](docs/testing/SESSION_ROLLOVER.md). Unknown/non-primary/retired
chats cannot appoint themselves owner. An exceptional recovery needs an explicit
owner decision and verified absence of conflicting writers; no registry/hooks are
changed merely by reading STATUS.md. Ordinary handoff retains full DoD, required
checks/publication/actual CI, finished operations and verified successor comprehension.
Only the registered primary initiates it. A recorded pre-validated successor or
registered orchestrator may idempotently finalize only the same confirmed transition
following native archive readback. Unknown evidence keeps it frozen. Hooks are
read-only and separately reviewed/trusted; unit tests do not prove runtime activation.
A governance task cannot close another unfinished task or authorize the next phase.

For checklist work, one authorized phase is the stopping point. "Continue" covers
only current/next phase unless multi-phase work was explicit. A phase is an observable
result with acceptance, not a file count. Do not invent internal approval gates or
extra phases; a blocker never expands scope. Finish all authorized work in the phase,
then report completed items, changes, exact checks/skips, risks and next unfinished
item. After 60 minutes save/report a checkpoint and continue the same phase. Before
ending unfinished work preserve its checkpoint. On resume, inspect relevant delta;
old "continue" messages do not authorize multiple new phases.

## 8. Authenticated UI content

Every visible block must serve navigation, a metric, real business data, an action,
form, list/entity card, chart, integration status, meaningful empty-state action or
system alert. Do not invent decorative/marketing/demo/motivational/explanatory blocks
unless explicitly requested. Dashboard pages show business state, not explain Zani.

Copy comes from the prompt, existing page structure, approved content map,
i18n/constants or real API/model fields; do not invent static Russian page text.
Check each new block's purpose, allowed copy source and real backing (data/action/
navigation/form/setting/empty state/status). Fix failing new blocks within scope.
Do not remove an existing functional block merely because a negatively worded review
question got "no". Explicit explanatory requests still require truthful approved content.
