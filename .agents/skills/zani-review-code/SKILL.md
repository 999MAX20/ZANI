---
name: zani-review-code
description: Review ZANI code changes for concrete correctness, regression, tenant isolation, authorization, CRM lifecycle, API contract, frontend state, migration, integration, AI, and test risks. Use when asked to review a diff, branch, patch, pull request, implementation, or repository area without implementing changes unless explicitly requested.
---

# Review ZANI Code

## Workflow

1. Read `AGENTS.md`, clean-code rules, task-relevant source-of-truth docs, changed code, callers, and tests.
2. Establish intended behavior from the request and contracts. Inspect before inferring; do not review only the visible diff when callers or schemas determine correctness.
3. Review tenant/permission boundaries first, then lifecycle invariants, data integrity, API compatibility, failure states, migrations/env, integrations/AI, and verification coverage.
4. Use `$zani-review-access`, `$zani-change-crm-domain`, or another focused ZANI skill when its domain applies.
5. Report only reproducible, actionable defects introduced or left exposed by the change. Include file/line, triggering scenario, impact, and the smallest useful correction direction.
6. Rank findings by impact: blocker, important, or minor. Do not inflate style preferences into defects.
7. If no findings exist, say so and name residual test or inspection gaps. Do not edit code during a review-only request.

Read [references/review-checklist.md](references/review-checklist.md) for coverage prompts.

## Output Contract

Lead with findings ordered by severity. Separate confirmed defects, questions/assumptions, and verification gaps. Distinguish unrelated baseline failures from change-specific failures.
