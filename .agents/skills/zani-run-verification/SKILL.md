---
name: zani-run-verification
description: Select, run, and report the appropriate ZANI verification gate for Django, DRF, React, CRM, integration, AI, migration, documentation, or mixed changes. Use after meaningful implementation, before completing checklist work, when reproducing a regression, or when a scoped or broad test run exposes a possible baseline failure.
---

# Run ZANI Verification

Treat verification as evidence for the requested behavior, not as a ceremonial command list.

## Select the gate

1. Read `AGENTS.md`, `docs/testing.md`, and the acceptance criteria.
2. Inventory changed or investigated areas: backend, frontend, CRM lifecycle, permissions, tenant isolation, integration, AI, migration, environment, and docs.
3. Start with the narrowest command that can reproduce or validate the behavior.
4. Expand to the required scoped or project gate after the focused check passes.
5. Use [references/verification-commands.md](references/verification-commands.md) for PowerShell-compatible commands and selection rules.

## Preserve test integrity

- Use SQLite and safe local overrides unless the task explicitly requires another environment.
- Prevent real external provider calls; mock or disable OpenAI, messaging, email, and connector clients.
- For CRM lifecycle changes, require happy path, permission denial, and tenant isolation coverage where applicable.
- For user-facing changes, verify a reachable API/UI flow, not only backend foundations.
- For migrations, run `makemigrations --check --dry-run`; run migrate only when migrations were intentionally added.
- For frontend changes, run the build and targeted Playwright coverage when the flow is business-critical.

## Handle failures honestly

1. Capture the exact failing command, test, assertion, and environment.
2. Re-run the smallest failing target to distinguish deterministic failure from order dependence.
3. Trace the underlying selector, service, endpoint, or component before changing behavior.
4. Classify unrelated failures as baseline only with evidence; do not hide them.
5. Do not mark the task complete when its acceptance criteria remain unproven.

## Report the gate

List exactly:

- commands run and their outcomes;
- checks skipped and the reason;
- acceptance criteria proven;
- baseline or unrelated failures;
- manual checks performed;
- remaining risks.

If `scripts/codex_verify.sh` cannot run in the current shell, run documented equivalents and state that substitution explicitly.
