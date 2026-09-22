# Client payments — implementation contract

## Owner decision 2026-09-22 — manual accounting is separate

The existing journal is named **Ручной учёт** (Manual accounting). Preserve all
receipts, partial payments, refunds, links, permissions, history, merge behavior
and replay protection. No destructive migration or rewriting of ledger facts.
It is not automatically added to financial KPIs or reconciled/summed with an
accounting-system feed. The earlier proposal to feed Payment into general
financial analytics is superseded by V1-M01/M02.

General financial reporting requires a supported, verified accounting source,
complete period coverage and a real last-successful-update timestamp. A connector
status, imported sale/order event or service-price estimate cannot establish
that evidence. Missing or incomplete first data means unavailable, not zero.
Verified zero requires complete coverage and no receipts/refunds. A failed or
stopped refresh retains the last accessible verified snapshot, clearly marked
with its real source/period/as-of and a warning; it never bypasses permissions.

Operational deal/service estimates remain explicitly separate from received
money. CRM operational analytics and the CRM's own SaaS billing remain available.
No currently registered provider proves this financial coverage contract;
production must not promote mocks/imported events into a financial source.
The bounded implementation and evidence are tracked in
[PRIMARY-SESSION](../testing/task-state/PRIMARY-SESSION.md). A live accounting
connector, reconciliation rules and provider credentials are a separate scope.

The original manual-journal acceptance and evidence below are retained as history;
this decision does not reopen or erase completed ledger invariants.

## Bounded phase: manual payment journal

Approved workflow: Clients header → Payments → journal → Add payment. The client
drawer and full client workspace open the same journal with the client selected.
This records money already received; it does not initiate bank transactions.

Scope: receipts, partial receipts, partial/full refunds, server pagination/search,
client and optional deal OR appointment linkage, amount, currency, time, method,
actor and manual provenance. No edit/delete of ledger facts; refund requires a
reason and cannot exceed the remaining received amount. Standalone prepayments
are allowed. Manual entry is not represented as bank/1C confirmation.

Non-goals: 1C import/reconciliation, analytics KPI changes, fiscal receipts,
invoices, exchange rates, bank transfers, AI tools and any change to deal lifecycle.

### Impact

- Permissions: dedicated `payments:view/create/manage`, mapped to Clients
  capability. Owner/admin can view/create/refund; manager defaults view/create.
  Other roles require explicit grants. Both payment and client record scope are
  enforced; linked deals/appointments require their own view access.
- Notifications: none; journal confirmation and cache refresh only.
- Activity/audit: atomic audit with ledger reference; client activity carries no
  monetary amount, note or reason accessible through broader client permissions.
- BusinessEvent/AI: no new automation trigger or AI financial source in this phase.
- Migration: new `payments.Payment` ledger, positive decimal amount, durable
  business-scoped submission identity and refund constraints. No new env/secrets.
- Merge: preserve ledger rows and move their client association in the audited
  existing client merge; historical submission hashes are retained.
- RU/KK/EN and shared drawer/form primitives; no sidebar changes.

### Acceptance checklist

- [x] Model/migration and service: positive precise amount, business currency,
  no future payment time, same-business/client links, immutable financial facts.
- [x] API: paginated journal, receipt/refund, durable retry protection, permissions,
  inactive membership denial, OWN/TEAM scope and foreign-tenant isolation tests.
- [ ] Both UI entrances share journal/form; loading, error/retry, empty, validation,
  pending, success, refund and existing-client context are working.
- [x] Client merge keeps payments, refund chain and audit consistent.
- [ ] Build, migration drift/system checks and scoped backend tests pass.
- [ ] Real browser flow: receipt, retry/refund, client entry, keyboard/focus and
  responsive journal; no ordinary development database seeded by tests.

## Verification record

Backend checks passed on 2026-09-14:

- `manage.py test apps.payments.tests apps.clients.tests --verbosity=1 --noinput`
  (safe gate environment): 32 passed (19 payment + 13 existing client tests).
- `manage.py test apps.payments.tests --verbosity=1 --noinput`: 21 passed after
  adding explicit-denial, client-scope and TEAM tests. Includes rollback if audit
  fails, immutable API, receipt/refund replay, amounts/currency/time, capabilities,
  link visibility and archive/merge preservation.
- `python scripts/codex_verify.py --mode backend --backend-target
  apps.businesses.tests_access --base-ref d4f7c8fa6414ce919c5172dabe8656ebb6243a52`:
  passed; 41 access tests, migration drift, system check and diff hygiene.
- `manage.py test apps.core.tests_tenant_isolation --verbosity=1 --noinput`
  (safe gate environment): 11 passed.
- Initial payment tests had invalid fixture email values and an incorrect
  expectation that the shared error handler would rethrow an audit failure.
  Both test defects were corrected; rollback now asserts HTTP 500 and no ledger row.

Local migration: verified `DATABASES.default` is the canonical local SQLite
`C:/Users/user/Desktop/Zani/db.sqlite3`. `manage.py migrate payments --plan`
contained only `payments.0001_initial`; applied with `manage.py migrate payments`.
Online SQLite backup before migration:
`C:/Users/user/AppData/Local/Temp/zani-before-payments-iwbrzy7d/db.sqlite3`.
No seed/demo rows were added to the ordinary database.

Browser verification uses Django 8199 / Vite 5199 and a separately generated
temporary database, with the project's `safe_environment` and disabled providers.
UI final acceptance and final production build are in progress.
