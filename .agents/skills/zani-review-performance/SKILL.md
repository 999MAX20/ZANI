---
name: zani-review-performance
description: Measure, diagnose, and improve ZANI backend, database, API, worker, and React performance without weakening tenant isolation or correctness. Use for slow endpoints/pages, N+1 queries, expensive aggregates, missing indexes, large payloads, queue bottlenecks, frontend waterfalls, render churn, bundle growth, caching, pagination, or load-readiness work.
---

# Review ZANI Performance

## Workflow

1. Read `AGENTS.md`, clean-code rules, relevant production/testing docs, and the affected request path.
2. Reproduce and measure the bottleneck with representative data. Record latency, query count/plan, payload size, worker timing, render/profile, or bundle evidence before changing code.
3. Confirm tenant and permission scope occurs before aggregation, prefetch, caching, or background processing.
4. Fix the narrow cause: remove N+1 access, select/prefetch only needed relations, paginate, bound exports, move safe work to workers, reduce payloads/waterfalls, or add a justified index.
5. For indexes, match real filters/orderings and consider `Business` as a leading key where tenant-scoped access patterns require it. Check migration and write-cost impact.
6. Cache only permission-safe results with explicit keys, invalidation, freshness, and failure behavior. Never share merchant data across tenants.
7. Preserve API semantics, domain invariants, audit/events, and no-data/error behavior.
8. Re-measure with the same method, add a regression test or budget where practical, and use `$zani-run-verification`.

Read [references/performance-checklist.md](references/performance-checklist.md) for the diagnostic pass.

## Output Contract

Report baseline evidence, root cause, change, tenant/correctness safeguards, before/after result, test data limits, and exact checks.
