# E2E QA And Scale Baseline

Phase 8 adds a repeatable smoke layer above unit/API tests.

## What It Covers

Playwright smoke tests cover:

- platform admin login and `/platform` access;
- business owner login and core merchant pages;
- merchant user blocking from `/platform`;
- operator role restriction on hidden settings;
- mobile owner path from dashboard to calendar.

The goal is not full browser automation for every feature yet. The goal is to catch broken auth, role routing, blank pages and mobile navigation regressions before manual testing.

## Commands

Install Playwright browsers once per machine:

```bash
cd frontend
npx playwright install chromium
```

Run smoke tests:

```bash
cd frontend
npm run e2e
```

Open the UI runner:

```bash
cd frontend
npm run e2e:ui
```

List tests without running browsers:

```bash
cd frontend
npx playwright test --list
```

## Seed Data

The E2E suite uses deterministic test accounts and demo data.

Manual seed:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py prepare_e2e_smoke_data
```

Accounts:

- `platform_admin@example.com`;
- `business_owner@example.com`;
- `business_operator@example.com`.

Password:

```text
ZaniTest123!
```

The command is idempotent and creates/updates:

- demo business;
- owner/operator memberships;
- growth subscription;
- services/resources/working hours;
- lead/deal/appointment/task;
- website communication channel and first message.

## Local Server Behavior

`frontend/playwright.config.ts` starts:

- Django on `127.0.0.1:8000`;
- Vite on `127.0.0.1:5173`.

Existing local servers are reused.

Workers are intentionally set to `1` because local SQLite can lock under parallel write-heavy seed setup. CI/PostgreSQL can raise concurrency later.

## Basic Load Testing Plan

Before paid beta:

1. API smoke load:
   - auth token obtain/refresh;
   - list clients/leads/deals/tasks/conversations;
   - create lead;
   - create task;
   - create bot message.
2. Target starter thresholds:
   - p95 read endpoints under 300 ms on staging;
   - p95 write endpoints under 600 ms on staging;
   - zero cross-tenant leaks in response samples;
   - no 5xx under a small sustained smoke load.
3. Suggested first tool:
   - `k6` for HTTP load scripts;
   - one scenario per role: owner/operator/platform.
4. Data volume baseline:
   - 100 merchants;
   - 10 users per merchant;
   - 2,000 clients per merchant;
   - 10,000 messages per active merchant;
   - 1,000 tasks/leads/deals per active merchant.
5. Production-readiness follow-up:
   - run against PostgreSQL, not SQLite;
   - collect DB slow queries;
   - add indexes only from observed slow paths;
   - keep AI/provider calls mocked or queued during load smoke.

## Latest Result

```text
npm run e2e
9 passed, 1 intentionally skipped
```

The skipped test is the mobile-only calendar smoke inside the desktop project. It runs and passes in the mobile project.
