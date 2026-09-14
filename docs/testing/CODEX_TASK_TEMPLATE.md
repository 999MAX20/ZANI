# Codex Task Template

Use this template when creating work for Codex. The goal is to keep every task narrow, reviewable and tied to a real business outcome.

This is the single task-contract template, not another backlog. Reuse the
existing task/defect/phase ID; if none exists, use a bounded task title in the
current task record. Fill it concisely before implementation. Explicit user
authorization and clear requirements are sufficient to proceed without another
approval of this form. Mark irrelevant fields `N/A` with a short reason.

For resumed work, update the checkpoint and inspect the relevant delta instead
of repeating the entire discovery or a repository-wide audit.

## Default Prompt Shape

```text
Existing ID (or bounded title) and active source document:
...

Mode: audit / implementation / verification / operation
Gap type: code / evidence / environment / policy / roadmap

Observable result and business context:
...

Existing implementation/tests/closure evidence to reuse:
...

Allowed scope (flows, contracts and expected file areas):
- ...

Non-goals / do not change:
- ...

Owner and overlap check:
...

Worktree, branch, starting HEAD/base and affected-path dirty snapshot:
...

Acceptance criteria and one phase completion condition:
- ...

Dependencies / unresolved decisions:
...

Permissions / tenant / notification / BusinessEvent / AI impact:
...

Migration / environment / external-side-effect impact:
...

Required verification (testing.md matrix):
- focused:
- affected-area:
- UI/API flow:
- candidate integration / environment, if in scope:

Delivery boundary (local work / commit / integration / deployment):
...
```

Audit mode is read-only unless a requested documentation artifact or other
specific mutation is explicitly in scope. Verification does not authorize
unrelated implementation; operation mode requires an exact target and effects.
An environment or evidence gap must not be converted into a code rewrite.

## Reopening A Closed Task

Only reopen for a reproduced regression, a proven missed acceptance criterion,
or an explicitly approved requirement change. Record:

```text
Existing closed ID and evidence:
New reproduction / missing criterion / approved requirement:
Observed behavior vs required behavior:
Minimal change and regression check:
```

An old checklist, another chat title or a preferred architecture is not a new
requirement. A regression check on a changed flow does not reopen its entire
foundation. A code/contract policy conflict requires the relevant owner decision
before the dependent change, not a guess that the newer text must be right.

## Resume And Handoff Checkpoint

Store this in the existing task record or relevant handoff, without secrets:

```text
Task / current phase / authorized scope:
Worktree / branch / starting base / current HEAD:
Affected-path dirty snapshot (including required untracked files):
Implemented:
Verified: command, result, state identity, environment, coverage
Failed / skipped checks and evidence/reason:
Unfinished acceptance criterion / blocker:
One next step:
Closed work not to reopen:
Delivery: local / committed / integrated / accepted environment
Integration owner and overlapping work, if relevant:
```

Do not claim a worktree change is present in the main checkout before integration.
After relevant code, dependency, config or fixture changes, recheck affected
acceptance evidence; keep valid historical closures attached to their old SHA.

## Closeout

```text
Result / completed acceptance criteria:
Files and contracts changed:
Checks run: exact commands, outcomes, snapshot/commit and environment
Checks skipped: reason and acceptance impact
Known risks / proven baseline failures:
Manual checks:
Actual delivery boundary:
Next unfinished item (not started):
```

If a required check fails, the corresponding acceptance remains open. Do not
change a checkbox to complete because only a narrower test passed.

## Scope-Specific Additions

Use only the applicable example below in addition to the compact contract.
Examples do not expand authorized scope or replace the verification matrix in
[testing.md](testing.md#verification-selection-and-evidence).

For each user-facing action, include the expected persistence and failure state,
not only the presence of a button or endpoint. For backend lifecycle changes:

```text
Roles/permissions and same-business relations to preserve:
- ...
Happy path / permission denial / tenant isolation / side effects:
...
```

## Study Without Changes

Use when the next step is unclear and no sufficient current evidence exists.
If a relevant audit/checkpoint already exists, identify what changed and inspect
that delta; do not repeat discovery solely because the conversation resumed.

```text
Study this area without editing files:
- pages/modules:
- related docs/plans:

Return:
- current implementation summary
- missing business logic
- UX/API risks
- recommended next task
```

## Frontend Page Task

```text
Implement/refine this page:
- route:
- primary user:
- primary job:
- allowed components/files:

Rules:
- no marketing/filler blocks
- no duplicated actions
- use existing API clients
- keep mobile and desktop states stable
- preserve role guards

Checks:
- frontend build
- browser/Playwright check if the page is business-critical
```

## Backend/API Task

```text
Implement/refine this backend flow:
- endpoint/service:
- models involved:
- business event output:
- role rules:

Rules:
- business logic in services/selectors/providers/tasks
- views stay thin
- tenant isolation by Business is mandatory
- tokens/secrets must be masked
- add focused tests

Checks:
- makemigrations --check --dry-run
- manage.py check
- scoped tests
```

## Integration Task

```text
Implement/refine this connector:
- provider:
- auth method:
- inbound/outbound flow:
- expected BusinessEvent types:

Rules:
- lightweight integration, no full ERP sync
- connector must expose status, health, last sync and error state
- merchant setup must stay simple
- provider details stay behind connector/provider layer
- no raw tokens in frontend or logs
```

## AI Task

```text
Implement/refine this AI behavior:
- AI actor:
- input sources:
- allowed actions:
- actions requiring confirmation:

Rules:
- AI must not invent data
- AI must cite source events/entities
- critical actions require role-aware confirmation
- log provider/model/cost status when applicable
```

## PR Summary Template

```text
Summary:
- ...

Task/source and accepted criteria:
- ...

Worktree, base, candidate/dirty snapshot and actual delivery state:
- ...

Business areas changed:
- ...

Checks:
- ...

Production readiness:
- Migrations:
- Env vars:
- Permissions:
- Notifications:
- BusinessEvents:
- AI actions:

Manual checks:
- ...

Risks:
- ...
```
