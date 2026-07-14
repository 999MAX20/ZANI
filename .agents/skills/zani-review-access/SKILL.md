---
name: zani-review-access
description: Review ZANI Django and DRF code for Business tenant isolation, backend authorization, IDOR, membership validation, scoped querysets, cross-tenant writes, and permission test coverage. Use for CRM endpoints, serializers, services, selectors, custom actions, bulk operations, background jobs, exports, and any change that reads or mutates merchant data.
---

# Review ZANI Access

Treat `AGENTS.md` and repository documentation as authoritative. Use this skill as a focused access-control workflow, not as a replacement for project rules.

## Establish context

1. Read `AGENTS.md` and `plan/clean_code_rules/zani_required_clean_code_rules.md`.
2. Read `docs/PERMISSION_MATRIX.md` and the relevant models, services, selectors, permissions, serializers, views, tasks, and tests.
3. Search for an existing tenant-aware layer before proposing a new manager, mixin, permission, endpoint, or helper.
4. Identify the affected roles, entities, Business ownership paths, and platform/support exceptions.

## Trace access end to end

1. Trace where each identifier enters through a URL, query parameter, request body, import, task payload, or provider event.
2. Trace the object lookup and confirm the queryset is scoped to an accessible `Business` before retrieval or mutation.
3. Check list, retrieve, create, update, archive, restore, delete, bulk, export, and custom actions separately.
4. Confirm related objects, owners, assignees, watchers, responsible users, stages, and pipelines belong to the same Business and reference active members where required.
5. Confirm frontend hiding is only UX; enforce every permission on the backend.
6. Confirm cross-tenant requests do not reveal whether a foreign object exists.
7. For background work, carry explicit tenant context and re-resolve objects through a tenant-aware layer.
8. For sensitive or destructive actions, confirm audit logging and traceable archive/restore behavior.

Use [references/access-checklist.md](references/access-checklist.md) for the endpoint and test checklist.

## Act according to the request

- For review or diagnosis, report evidence-backed findings without editing files.
- For implementation, make the smallest complete change through existing layers and add focused tests.
- Mark facts as verified from code/tests or inferred from incomplete evidence.
- Do not prescribe PostgreSQL RLS, UUID migration, or a new authorization framework unless the task and current architecture justify it.

## Require proof

Cover the happy path, permission denial, and tenant isolation for changed business behavior. Add a regression test when extending an existing flow. Do not declare the review clean when a material path was not inspected; state the gap instead.

Report affected permissions, audit or BusinessEvent impact, tests run, tests skipped with reasons, and remaining risks.
