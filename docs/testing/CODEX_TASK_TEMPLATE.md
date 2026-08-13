# Codex Task Template

Use this template when creating work for Codex. The goal is to keep every task narrow, reviewable and tied to a real business outcome.

## Default Prompt Shape

```text
Goal:
...

Business context:
...

Allowed scope:
- ...

Do not change:
- ...

Required behavior:
- ...

Roles/permissions to preserve:
- ...

Checks to run:
- ...

Final response must include:
- files changed
- checks run
- known risks
- manual checks
```

## Study Without Changes

Use when the next step is unclear.

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
