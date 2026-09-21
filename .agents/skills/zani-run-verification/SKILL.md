---
name: zani-run-verification
description: Select, run, and report the appropriate ZANI verification gate for Django, DRF, React, CRM, integration, AI, migration, documentation, or mixed changes. Use after meaningful implementation, before completing checklist work, when reproducing a regression, or when a scoped or broad test run exposes a possible baseline failure.
---

# Run ZANI Verification

Treat verification as evidence for the requested behavior, not as a ceremonial command list.

## Select the gate

1. Read `AGENTS.md`, `docs/testing/testing.md`, and the current task contract or checkpoint. On resume, inspect the relevant delta rather than restarting discovery.
2. Inventory changed or investigated areas: backend, frontend, CRM lifecycle, permissions, tenant isolation, integration, AI, migration, environment, and docs.
3. Start with the narrowest command that can reproduce or validate the behavior.
4. Expand to the required scoped or project gate after the focused check passes.
5. Use [references/verification-commands.md](references/verification-commands.md) for PowerShell-compatible commands and selection rules.

## Preserve test integrity

- Use the existing verification runner's isolated runtime unless the task explicitly requires another environment. Do not reuse ordinary `db.sqlite3` or rely on a few inherited environment overrides.
- Prevent real external provider calls; mock or disable OpenAI, messaging, email, and connector clients.
- For CRM lifecycle changes, require happy path, permission denial, and tenant isolation coverage where applicable.
- For user-facing changes, verify a reachable API/UI flow, not only backend foundations.
- For migrations, check drift and verify intentional migrations in an isolated database. Applying migrate or seed/reset to an existing working database requires explicit target/scope authorization.
- For frontend changes, run the build and targeted Playwright coverage when the flow is business-critical.

## Handle failures honestly

1. Capture the exact failing command, test, assertion, and environment.
2. Re-run the smallest failing target to distinguish deterministic failure from order dependence.
3. Trace the underlying selector, service, endpoint, or component before changing behavior.
4. Classify unrelated failures as baseline only with evidence; do not hide them.
5. Do not mark the task complete when its acceptance criteria remain unproven.
6. After equivalent failures with unchanged inputs, revise the hypothesis before retrying. Do not silently expand to unrelated repairs or lower the required gate.

## Report the gate

List exactly:

- commands run and their outcomes;
- checks skipped and the reason;
- acceptance criteria proven;
- baseline or unrelated failures;
- manual checks performed;
- remaining risks.

Attach evidence to the candidate commit or identified dirty snapshot, coverage
and environment. Local verification, commit, integration and live acceptance
are different claims. Historical PASS does not certify subsequent changes.

Use `scripts/codex_verify.py` directly when Bash is unavailable. Follow the docs
gate for instructions-only changes and the documented isolated focused path
when the task base still equals HEAD; do not invent a committed range.
