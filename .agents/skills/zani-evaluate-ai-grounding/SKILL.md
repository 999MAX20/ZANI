---
name: zani-evaluate-ai-grounding
description: Implement or review ZANI AI assistant, analyst, recommendation, owner brief, tool-call, and approval behavior for source grounding, tenant and role permissions, safe no-data fallbacks, sanitized logging, provider failures, and explicit confirmation of critical mutations. Use for changes under apps/ai_core, AI-facing APIs, dashboard AI cards, AI tools, prompts, or AI tests.
---

# Evaluate ZANI AI Grounding

## Workflow

1. Read `AGENTS.md`, `docs/AI_ASSISTANT_RULES.md`, `docs/PERMISSION_MATRIX.md`, and the affected code and tests. Read `docs/entitlements.md` when availability or plan limits change.
2. Inventory the actor, permitted source entities, requested output, provider state, and any possible mutation.
3. Trace each factual output to permission-scoped records or deterministic calculations. Return an explicit no-data or provider-unavailable state when evidence is missing.
4. Keep source identifiers safe for the API and UI. Never expose hidden entities, raw prompts, secrets, tokens, or sensitive provider payloads.
5. Require the underlying backend permission for every action. For a critical mutation, require a valid approved `ApprovalRequest` linked to the exact `AIToolCallLog`; reject missing, mismatched, expired, or unapproved requests and audit the attempt.
6. Keep provider code behind the AI provider layer. Preserve controlled behavior when the provider is disabled or fails.
7. Add tests for the live-data path, no-data path, role scope, tenant isolation, provider failure, and approval denial/success as applicable.
8. Use `$zani-run-verification` after implementation.

Read [references/ai-checklist.md](references/ai-checklist.md) for the detailed review contract.

## Output Contract

Report the behavior changed, sources used, permission and approval impact, logging/privacy impact, provider fallback, tests run, and tests skipped.
