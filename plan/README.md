# ZANI Plan Index

Last cleaned: 2026-05-27

This folder now contains only active planning documents that should guide future implementation. Old prompt packs, outdated master plans, duplicate UI references, empty files, and historical `.docx` plans were removed because they conflicted with the current CRM reform direction.

## Current Source Of Truth

Primary product readiness plan:

```text
readiness_plan.md
```

Use this before deciding what to build next. It tracks:

- what is already implemented;
- page-by-page readiness;
- production gaps;
- priority roadmap;
- the automatic inbound workflow gap;
- cross-cutting production requirements.

Primary UI/design rules:

```text
docs/design-system.md
```

Use this before frontend work. It defines:

- color system;
- form and modal style;
- filter style;
- page layout principles;
- CRM vs AI visual hierarchy.

## Active Documents In This Folder

### Business Logic

```text
plan/business_logic_implementation_plan.md
plan/auto_crm_pipeline_plan.md
```

Use for core CRM workflow work:

- manual and automatic inbound pipeline;
- AI qualification guard rules;
- conversation to client/lead/deal/task logic;
- production-safe automation boundaries.

### Production Hardening

```text
plan/ZANI_PRODUCTION_HARDENING_ROADMAP.md
```

Use for infrastructure and production reliability work:

- Redis/Celery;
- object storage;
- Sentry/error reporting;
- transactional email;
- backups;
- load testing;
- provider rollout.

### Clean Code Rules

```text
plan/clean_code_rules/zani_required_clean_code_rules.md
```

Use as the engineering contract for new implementation:

- reuse existing layers first;
- preserve tenant isolation;
- keep business logic out of bloated views;
- avoid frontend page monoliths;
- keep API clients/types separate from UI;
- test permissions and critical workflows.

## Cleanup Summary

Removed categories:

- old master plans from 13.05, 20.05, 25.05, 26.05;
- generated Codex prompt packs;
- duplicated UI reference analysis files;
- historical archive documents;
- obsolete `.docx` planning files;
- empty and system files.

Reason:

- The current reform is now tracked in `readiness_plan.md`.
- UI decisions are now tracked in `docs/design-system.md`.
- Keeping old prompt packs made future work ambiguous and encouraged outdated implementation paths.

## Working Rule

For product work, read in this order:

1. `readiness_plan.md`
2. `docs/design-system.md`
3. `plan/business_logic_implementation_plan.md` or `plan/auto_crm_pipeline_plan.md` if the task touches CRM workflows.
4. `plan/clean_code_rules/zani_required_clean_code_rules.md`
5. `plan/ZANI_PRODUCTION_HARDENING_ROADMAP.md` only if the task touches production infrastructure.
