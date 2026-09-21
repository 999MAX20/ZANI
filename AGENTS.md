# AGENTS.md

This file defines how Codex/AI agents must work in the Zani repository.

## Single Canonical Working Folder — Owner Decision 2026-09-21

- The only writable source checkout for Platforma.CRM is
  `C:\Users\user\Desktop\Zani`. Verify the resolved repository root before edits.
- Do not create or use another worktree, clone or source copy for code changes.
  Existing alternate trees are read-only integration/recovery sources until
  separately accepted and retired. This overrides older separate-worktree rules.
- One active writer for the entire repository, including code, contracts,
  migrations and shared docs. Parallel audits may only read an identified snapshot.
  Before writing, check task ownership and current branch/HEAD/dirty files;
  unexpected changes pause writes until reconciled. Preserve existing user work.
- Keep the current branch unless an explicit agreed Git step requires a change.
  A branch is not a second working folder. Never switch a dirty/shared checkout
  or overwrite files merely to make it match a remembered Git revision.
- Run development servers from this folder. Before trusting localhost, verify
  backend/frontend/worker source roots and build/profile; do not stop other
  people's processes. Disposable test databases/build outputs are allowed;
  they are not alternative source trees or permission to change working data.
- Commit/push follows the standing completion authorization below. Migrations
  on working databases and removal of old trees require their own agreed scope
  and checks. One folder does not prove readiness or serialize independent agents.
- Current consolidation ownership/evidence:
  `docs/testing/task-state/CONSOLIDATION-2026-09-21.md`.

## Verified Commit And Push — Owner Decision 2026-09-21

The owner explicitly authorizes commit and immediate normal push after each
approved implementation/documentation task passes its required checks. Do not
ask for the same permission on every task. Read-only requests, explicit
"no commit/push", and unresolved safety/target questions override this default.
Agreed destination: `origin` (`https://github.com/999MAX20/ZANI.git`), branch
`main`. Unrelated local/remote histories remain a blocker, not authorization
to replace remote code without reconciliation.

1. Work only in the canonical folder with one active writer. Identify the
   task-owned diff, pre-existing WIP, branch, HEAD and agreed remote/target branch.
   Missing or ambiguous upstream is a blocker, not permission to choose main.
2. Run the task's required gates; reuse evidence only for unchanged verified
   inputs. Review the entire intended commit and outgoing commit range, including
   untracked files, for secrets, private data and unrelated unfinished work.
   Stage explicit reviewed paths/hunks, never blindly stage the whole repository.
3. Make a meaningful conventional commit, fetch the agreed target and verify
   normal fast-forward publication. Do not silently merge/rebase unrelated work,
   switch a dirty checkout, rewrite history, reset or force-push. A conflict,
   unrelated history, failed gate or unexpected writer stops publication.
4. Push promptly to the agreed remote branch, then read back its SHA. For a
   fully synchronized task it must equal the intended local commit. Check the
   applicable CI status separately: queued/not run is not green. If push fails,
   preserve the commit and report "committed locally, not synchronized".
5. Report canonical path, branch/commit, checks and actual push/CI result.
   Do not declare the task fully delivered while a required gate/publication
   is blocked. New tasks, PR creation, releases, tags, deployment and working-DB
   migrations are not authorized by this rule. Inspect push-triggered deployment
   effects before first publication to a new target; resolve unexpected effects.

This is an agent workflow rule, not a background auto-commit hook. Compaction,
an audit finding or another writer's edits never trigger publication by themselves.

## Task Continuity — Required

Before starting, resuming or continuing after compaction, read the continuity
section in `docs/testing/CODEX_TASK_TEMPLATE.md` and the selected task checkpoint.
Recheck the actual checkout, branch, HEAD, dirty scope and evidence before edits.
Maintain a compact checkpoint during multi-step work without waiting for the
user to request a summary; strict read-only requests still prohibit file writes.
One scope has one active owner. Do not repeat completed work, invent readiness
percentages, restart exhausted checks or expand the latest authorized scope.
Compaction does not authorize commits, new product scope or moving worktrees.
Owner decision 2026-09-21 supersedes automatic handoff on compaction: restore
the checkpoint, recheck Git and continue the same agreed task in the same chat.
Neither a nearly full context window nor actual compaction permits task creation,
transfer or archival. Do not disable engine compaction or split the agreed scope
retroactively to declare a convenient subtask complete.
Read `actual_docs/PROJECT_HANDOFF.md`, `.codex/project-session.json`,
`docs/testing/task-state/PRIMARY-SESSION.md` and `docs/testing/SESSION_ROLLOVER.md`.
Handoff is allowed only after the entire current DoD, required checks/review,
agreed publication and actual CI (when required) are complete, owned operations
have finished, and successor comprehension has been verified. FAILED, BLOCKED,
PENDING and unknown are unfinished: preserve the checkpoint and attempt limits,
report the issue and defer rotation. A completed governance edit does not close
another unfinished task or authorize the next product phase.
Only the registered primary initiates an eligible handoff. Non-primary and
retired tasks cannot start product writes or rotate. A recorded, pre-validated
successor or the registered orchestrator may idempotently finalize only that
same confirmed transition after native archive readback, without relying on the
archived source to resume. Unknown tasks cannot infer ownership; incomplete
evidence keeps the transition frozen. Hooks stay read-only and require separate
review/trust; unit tests do not prove runtime activation.

## Current Source Of Truth

Before non-trivial work, read only the documents that are relevant to the task. Do not follow references to missing historical plan files.

This file owns execution rules, not live task statuses, readiness percentages or
test counts. Keep those with the relevant task and its evidence.

Required for all work:

1. `AGENTS.md`
2. `plan/clean_code_rules/zani_required_clean_code_rules.md`
3. `docs/README.md` when choosing documentation paths
4. `actual_docs/DEFECT_KNOWLEDGE_BASE.md` for defect remediation, UI/UX audits and functional certification
5. Relevant app/frontend files for the task
6. `docs/product/V1_PRODUCT_RULES.md` for product scope, CRM behavior, AI, billing, integrations and first-release acceptance; owner-approved V1 requirements take precedence over older product proposals, not over security invariants.

When choosing or resuming work, use the relevant authority, not every document:

| Question | Authority |
| --- | --- |
| Active document routing / project identity | `actual_docs/README.md`, `actual_docs/PROJECT_HANDOFF.md` |
| Pre-pilot dependency order | `actual_docs/PRE_PILOT_CODE_READINESS_MASTER.md` |
| Remaining backend gap IDs | `docs/pilot/backend-open-logic-register.md` |
| Functional acceptance | `actual_docs/APP_FUNCTIONAL_CERTIFICATION.md` |
| Fallback/recovery acceptance | `actual_docs/UNIFIED_FALLBACK_EXPERIENCE_PLAN.md` |
| CRM requirements and invariants | `docs/crm/CRM_PRODUCTION_LAYER_PLAN.md` |

Indexes route to the detailed owner; they do not override its evidence. Archived
plans, redirect stubs and historical checkpoints never authorize new work.
Code shows actual behavior; the approved contract defines required behavior.
A newer timestamp alone does not resolve a disagreement. Correct stale indexes
when evidence is unambiguous and docs changes are in scope. For unresolved
permission, lifecycle, data-loss or external-effect policy, request an owner
decision before changing the dependent behavior; continue only independent,
already-authorized work. Do not silently make code or docs match either side.

For CRM business logic work:

```text
docs/crm/CRM_PRODUCTION_LAYER_PLAN.md
docs/security/PERMISSION_MATRIX.md
docs/ai/AI_ASSISTANT_RULES.md
docs/automation/automation-runtime.md
docs/billing/entitlements.md
```

For frontend UI work:

```text
docs/frontend/design-system.md
plan/ui_ux_design_system_reform.md
```

For integrations:

```text
docs/integrations/CONNECTOR_BLUEPRINT.md
docs/integrations/integrations.md
docs/integrations/provider-rollout.md
```

For production infrastructure:

```text
docs/production/production-readiness.md
docs/production/production-readiness-10000-audit.md
docs/production/deployment.md
docs/production/paid-beta-gate.md
```

For testing and task format:

```text
docs/testing/testing.md
docs/testing/CODEX_TASK_TEMPLATE.md
```

## Task Contract And Change Ownership

Before implementation, record one compact contract using
`docs/testing/CODEX_TASK_TEMPLATE.md`: existing ID/source, work mode, observable
result, gap type (code/evidence/environment/policy/roadmap), reused layers,
scope/non-goals, owner/worktree/base, acceptance criteria and required checks.
Search existing task IDs, services, tests and closure evidence first. If no ID
exists, use a bounded task title; do not create a second backlog. Clear user
authorization is sufficient: do not require approval of routine implementation
steps. A roadmap mention alone does not add scope or authorize implementation.

Before the first write, verify cwd, worktree, branch, HEAD, staged/unstaged diff
and untracked files. Keep a starting snapshot for the affected paths.
All implementations use the canonical folder and one repository-wide writer.
Do not use separate worktrees to parallelize implementation.
Task names such as Backend or UI/UX are not ownership boundaries.
Do not switch a shared dirty checkout to another branch or edit unrelated user
changes. Unexpected branch/HEAD drift or another writer's changes in affected
paths pause writes until reconciled. Worktrees do not isolate databases,
ports, queues or providers: isolate those resources separately when used.

## Anti-Rework And Resume Rules

- Reopen a closed task only for a reproducible regression, a proven missing
  acceptance criterion, or an explicitly approved requirement change. Record
  the prior closure, new evidence, minimal delta and regression check.
  An old checklist or preferred architecture is not sufficient. Rechecking
  affected behavior does not require reimplementing a closed foundation.
- On resume or context recovery, read the task checkpoint, compare the current
  state with its snapshot, and continue the unfinished item. Do not restart a
  repository-wide audit without a request or new evidence justifying its scope.
- Keep checkpoints in the existing task record or handoff, not a new master
  plan: scope, Git state, implemented/verified work, failures, remaining item,
  one next step and closed work that must not be reopened. Never store secrets.
- After two equivalent failed attempts with unchanged inputs, do not repeat
  blindly. State what was learned, a revised hypothesis and the smallest next
  diagnostic. Repeating a test to investigate order/flakiness is valid when
  that hypothesis and changed conditions are explicit.
- Refactor only as needed for acceptance or a demonstrated risk in the changed
  path. File size prompts design review, not an unrelated rewrite. Record
  optional cleanup separately and do not prolong a completed phase for it.

## Product Direction

Zani is an AI-first CRM and business control layer for SMB.

The owner-approved first paid release targets dental clinics, with the operator/
administrator as the primary daily user. Read
[First-version product rules](docs/product/V1_PRODUCT_RULES.md) before changing
scope or behavior. This does not introduce clinical records, a new permission
framework or an automatic vertical-mode rewrite. Required AI features must
remain operationally optional: ordinary CRM work continues when AI is unavailable.

Do not turn it into:

- a heavy ERP;
- a full-sync data warehouse;
- a Bitrix-style admin maze;
- a developer console for merchants;
- a mock-only demo product.

Daily merchant workflows must stay simple, fast, role-aware and action-oriented.

## Current CRM Production Strategy

For CRM production work, use `docs/crm/CRM_PRODUCTION_LAYER_PLAN.md`.

The current implementation strategy is layer-based, not page-based:

```text
domain invariants -> state machines -> audit/activity -> API contracts -> frontend integration -> E2E flows
```

Do not make one page perfect while backend business rules remain bypassable.

## Non-Negotiable Engineering Rules

1. Tenant isolation is mandatory.
   Every merchant entity must be scoped to `Business` or safely derive business access from related objects.

2. Backend permissions are mandatory.
   Frontend hiding is not security.

3. Business logic must live in services/selectors/state-machine helpers, not in bloated views.
   Views should accept request, validate serializer, check permissions, call service, return response.

4. CRM lifecycle changes must go through domain services.
   Do not casually mutate `status`, `stage`, `won_at`, `lost_at`, `completed_at`, `archived_at`, `responsible_user`, `owner`, or `assignee` in views or frontend.

5. Do not put raw API calls in React components.
   Use `frontend/src/api/*`.

6. Do not expose provider tokens or secrets.
   Use env/config, encrypted credentials and masked serializers.

7. Do not hard-delete critical CRM data by default.
   Prefer archive/restore with audit. Merge/delete flows must be traceable.

8. Provider-specific code must stay behind provider/connector layers.
   CRM logic must not depend directly on WhatsApp/Telegram/Meta/OpenAI implementations.

9. Do not create duplicate models/endpoints/components before searching existing layers.

10. Do not mark foundation work as complete without user-facing flow, permissions and tests where applicable.

11. Keep AI optional and controlled.
    AI may summarize, suggest and assist. Critical changes need explicit user confirmation.

12. AI must be source-grounded.
    AI analyst and assistant output must cite real entities/events or clearly say that data is missing.

13. Merchant setup must hide technical complexity.
    Connector keys, webhook details and provider errors should live in setup/help flows, not dominate daily UI.

## CRM Domain Rules

For any CRM business action, preserve these invariants:

- all related entities belong to the same `Business`;
- assignees, owners, watchers and responsible users are active business members;
- stage belongs to the deal pipeline and business;
- terminal deal status changes only through deal service actions;
- lost lead/deal requires a reason;
- appointment booking/rescheduling respects working hours and overlap rules;
- important CRM actions write activity timeline;
- sensitive/destructive actions write audit logs;
- role restrictions are enforced on the backend;
- frontend-only validation is never enough.

## Required Checks

`docs/testing/testing.md` owns the verification matrix and safe commands.
Use the existing cross-platform `scripts/codex_verify.py`; Unix shell wrappers
are optional, not a requirement to install Bash. Select focused checks while
iterating, dependency-area checks at phase close, and the full required gate
for release-candidate integration. Do not substitute a scoped PASS for a full
gate or weaken assertions to obtain green results.

The runner requires an explicit ancestor base different from HEAD. While the
task has no committed range, use the documented isolated focused path and report
that boundary; never invent a base just to bypass validation. Docs-only changes
use the docs gate, not an unnecessary application build/install.

Migration generation, test-DB migration and applying to a working database are
separate actions. Generate only intentional schema changes and verify them in
an isolated database. Applying migrations, seed/reset or destructive smoke to
an existing working/staging/production database requires explicit target/scope
authorization. Do not repopulate ordinary `db.sqlite3` during verification.

Final responses and PR summaries must list exact commands, results, skipped
checks/reasons, candidate or dirty-snapshot identity, environment and coverage.

## Task Completion Gate

For the active task contract, Codex must not mark a task as complete until its
required implementation and verification are both done. Closed or archived
checklists are evidence, not the current work queue.

Rules:

- A checkbox may be changed to `[x]` only after the task's required test gate has passed.
- For every completed task, record or report exactly what checks were run and what was skipped with the reason.
- Before starting a task, identify the affected areas when relevant:
  - permissions impact;
  - notification impact;
  - BusinessEvent impact;
  - AI impact;
  - migration/env impact.
- If tests fail because of a pre-existing or unrelated baseline issue, do not hide it. Record it as a baseline failure and do not mark the current task complete unless the task's own acceptance criteria are still provably satisfied.
- Classify a failure as baseline only with evidence. Fix in-scope regressions;
  do not silently expand the task to unrelated repairs. An unresolved required
  gate blocks the corresponding acceptance claim even if focused tests pass.
- If `.git` is missing, the branch/PR rule is temporarily not executable locally. State that explicitly in summaries instead of pretending a branch or PR exists.
- If a task is user-facing, it is not complete without a reachable UI/API flow, not only backend foundation code.
- If a task changes CRM lifecycle behavior, the verification must include happy path, permission denial and tenant isolation coverage where applicable.

Distinguish implemented, locally verified, committed, integrated and accepted
for the target environment. A local PASS is not a commit/merge/deploy claim.
Evidence belongs to a commit or an identified dirty snapshot, commands and
environment, not to a branch name alone. Later relevant changes invalidate the
affected acceptance evidence until rechecked, not all historical closures.
Recheck dependent contracts; use the full gate for release acceptance.

## Phase Execution Stop Gate

For phase-based checklist work, one completed phase is the default stopping point.

Define the phase by an observable result and acceptance criteria, not a file
count. Do not invent extra phases or mandatory human checkpoints within an
already-authorized scope. A blocker does not authorize scope expansion.

Rules:

- Codex may complete all checklist items inside the current or next named phase in one assistant run, but must stop after that phase is implemented, verified, documented and marked complete.
- A user message like "continue" or "продолжай" authorizes only the current/next phase. It expires after that phase is complete.
- Codex must not automatically start the next phase after closing the current phase unless the latest user message explicitly requested multi-phase autonomous work.
- Within a phase, Codex may mark multiple checkboxes `[x]`, but each checkbox still requires its own implementation and relevant verification gate before being marked complete.
- After completing a phase, Codex must stop and report:
  - which phase was completed;
  - which checklist items were completed inside the phase;
  - what changed;
  - checks run;
  - checks skipped and why;
  - known risks or baseline failures;
  - the next unchecked phase or next unfinished item.
- If work on one phase runs longer than 60 minutes, Codex must provide a checkpoint summary and continue the same phase unless the user asks to stop.
- Save the compact checkpoint before handing off, pausing or ending unfinished
  work. On resume, verify only the relevant delta before continuing.
- If the conversation resumes after context compaction, treat the current user message as the active authorization boundary. Do not infer permission to continue multiple old phases from earlier "continue" messages.

## Documentation Rule

After a completed phase or meaningful behavior change:

- update `docs/crm/CRM_PRODUCTION_LAYER_PLAN.md` if CRM production scope/status changes;
- update relevant docs in `docs/`;
- update `README.md` only when setup, behavior, or public project status changes;
- do not add new historical roadmap files when one current plan can be updated.
- keep status/evidence with its owner and link from indexes instead of copying
  changing test counts into multiple summaries;
- preserve closed evidence and archive bodies; unresolved approved scope or an
  active security/domain contract must not be archived as if complete;
- report the canonical folder and whether changes are local, committed or
  accepted. Historical worktree evidence is not proof of current integration.

## Work Style

- One bounded task at a time.
- Inspect before editing.
- Preserve unrelated user changes.
- Never revert work you did not make unless explicitly requested.
- If checks fail, diagnose and fix in-scope failures before closing the task.
  For an external or unrelated blocker, preserve evidence and request direction
  only when necessary; do not start unrequested repairs or a new phase.
- Prefer small services/selectors/components over large God files.
- Do not mix unrelated UI, backend, integration and docs changes in the same PR unless the task explicitly requires the full workflow.

## Pull Request Rule

For feature or production-hardening work:

```text
one task = one bounded change set in the canonical folder
```

Use an agreed branch/PR when requested. This rule never authorizes a second
worktree or automatic branch switches in the shared canonical checkout.

Every PR summary should include:

- business areas changed;
- checks run;
- migration/env changes;
- permission impact;
- notification impact;
- BusinessEvent/AI impact;
- manual checks and known risks.

## UI Content Rule

Codex must not create decorative, marketing, demo, motivational, or explanatory UI blocks unless explicitly required.

Every visible block on an authenticated Zani page must have a clear product purpose:

1. navigation;
2. KPI / metric;
3. real business data;
4. action button;
5. form;
6. table/list/entity card;
7. chart/analytics;
8. integration status;
9. empty state with a real next action;
10. system notification or alert.

Do not invent static Russian text for pages. Visible text must come from:

- the task prompt;
- existing page structure;
- approved copy/content map;
- i18n/constants file;
- real API/data model fields.

Inside the authenticated app, dashboard pages must not explain what Zani is. They must show business state, actions, metrics, tasks, leads, deals, alerts, integrations and AI recommendations.

Before finishing any UI task, every new block must pass all three checks:

- it serves one of the product purposes listed above;
- its visible copy has an allowed source;
- it is backed by real data, an action, navigation, a form, a meaningful empty
  state, a setting or an actual system status, not fabricated demo content.

Remove or correct new blocks that fail these checks within the task scope.
Do not remove an existing functional block merely because a negatively worded
review question was answered "no". Explicitly requested explanatory content
remains subject to truthful data and the approved content scope.
