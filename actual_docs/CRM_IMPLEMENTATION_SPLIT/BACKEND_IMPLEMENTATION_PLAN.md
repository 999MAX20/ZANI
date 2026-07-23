# ZANI CRM Backend Implementation Plan

Date: 2026-07-23

Status: superseded implementation backlog; B0-B6 closed at verified scope

Scope: backend-only Django/DRF domain, permissions, runtime and API work

## 1. Status

The original deep-audit backlog contained 145 unchecked implementation items.
It is no longer the active task tracker. Those items were consolidated and
implemented through verified backend phases B0-B6:

- [x] B0 tenant isolation, authorization and cross-business relation invariants;
- [x] B1 queue-backed notification, automation and AI runtime safety;
- [x] B2 role-scoped queues, assignment, handoff, availability and escalation;
- [x] B3 aggregate, API error and resumable onboarding contracts;
- [x] B4 dentistry capability profile and backend module enforcement;
- [x] B5 performance, exports, indexes, correlation logs and operations health;
- [x] B6 public CRM contract cleanup and removal of misleading unsupported actions.

Verified B6 baseline:

- complete Django suite: `445 passed, 7 warnings`;
- focused contract suite: `90 passed, 2 warnings`;
- Django check, migration drift, frontend contract build and diff hygiene passed.

## 2. Current Execution Source

The active backend reliability and release tracker is:

```text
actual_docs/CRM_IMPLEMENTATION_SPLIT/BACKEND_RELIABILITY_EXECUTION_PLAN.md
```

It continues from the completed B0-B6 foundation with:

- [x] R0 clean sequential integration baseline;
- [x] R1 transactional outbound message outbox;
- [x] R2 idempotent critical CRM create commands;
- [x] R3 automatic routing and SLA escalation;
- [x] R4 explicit domain API error taxonomy;
- [x] R5 production gate resilience and final release verification.

Do not reopen the old 145-item list as if the implementation were missing.
Use current code, tests, `CRM_PRODUCTION_LAYER_PLAN.md`, the reliability plan
and production-readiness docs as the source of truth.

## 3. External Deployment Gates

These remain open because they require real target infrastructure rather than
additional local repository code:

- [ ] managed TLS PostgreSQL and tested backup restore;
- [ ] TLS Redis with real Celery worker and beat;
- [ ] private S3-compatible object storage;
- [ ] transactional SMTP;
- [ ] Sentry/release monitoring;
- [ ] real provider credentials, webhooks and rollback smoke;
- [ ] production-like load and recovery tests.

Until these gates have environment evidence, the repository may be code-ready
for deployment setup but must not be declared paid-beta production-ready.
