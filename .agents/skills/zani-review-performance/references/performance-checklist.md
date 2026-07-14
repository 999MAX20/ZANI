# Performance Diagnostic Checklist

## Backend and database

- Count queries and inspect repeated relation access, serializers, permission checks, and per-row aggregates.
- Inspect SQL plan, filtered row counts, ordering, indexes, pagination, and response size.
- Keep Business/permission scope inside the query; do not fetch globally and filter in memory.
- Avoid loading full timelines, messages, events, or exports when a page or summary is sufficient.
- Bound worker retries, batches, concurrency, and provider timeouts.

## Frontend

- Inspect request waterfalls, duplicate fetches, cache keys, bundle chunks, expensive renders, large lists, and image/font weight.
- Preserve loading/error/empty states while reducing work.
- Virtualize or paginate only when measurement justifies the complexity.

## Proof

- Compare the same scenario and dataset before/after.
- State cold/warm cache and environment assumptions.
- Add a query-count, payload, timing, load, or bundle regression gate when stable enough.
