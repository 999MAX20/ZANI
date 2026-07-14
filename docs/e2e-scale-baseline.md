# E2E QA And Scale Baseline

Phase 8 adds a repeatable smoke layer above unit/API tests.

## What It Covers

Playwright smoke tests cover:

- platform admin login and `/platform` access;
- business owner login and core merchant pages;
- merchant user blocking from `/platform`;
- operator role restriction on hidden settings;
- mobile owner path from dashboard to calendar.
- API-backed merchant core flow:
  - apply working-hours preset;
  - create client/service/resource;
  - fetch available slots;
  - create appointment;
  - create lead;
  - create deal from lead;
  - create related task.
- direct-object tenant isolation:
  - an operator/owner from one merchant cannot read another tenant's client object by URL.

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

Run only the fast desktop smoke:

```bash
cd frontend
npm run e2e -- --project=desktop-chromium
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

The suite also caches JWT tokens inside one Playwright run. This avoids false failures from local/staging auth throttles while still exercising authenticated routes, tenant permissions and business flows.

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

## API Load Smoke

The repository includes a dependency-free staging smoke script:

```bash
python scripts/api_load_smoke.py \
  --api-base-url https://zani-9lnp.onrender.com \
  --email business_owner@example.com \
  --password '***' \
  --iterations 5 \
  --output-file load-baseline.json
```

Optional p95 gate:

```bash
python scripts/api_load_smoke.py \
  --api-base-url https://zani-9lnp.onrender.com \
  --email business_owner@example.com \
  --password '***' \
  --iterations 10 \
  --business-id 1 \
  --fail-p95-ms 800
```

Render/staging wrapper:

```bash
API_BASE_URL=https://zani-9lnp.onrender.com \
MERCHANT_OWNER_EMAIL=business_owner@example.com \
MERCHANT_OWNER_PASSWORD='***' \
BUSINESS_ID=1 \
LOAD_SMOKE_ITERATIONS=10 \
LOAD_SMOKE_FAIL_P95_MS=800 \
LOAD_SMOKE_OUTPUT_FILE=load-baseline.json \
scripts/render_h6_load_baseline.sh
```

The wrapper refuses production runs unless `ALLOW_PRODUCTION_LOAD_SMOKE=true` is set explicitly.

Covered endpoints:

- auth login;
- `/api/auth/me/`;
- businesses;
- clients;
- leads;
- deals;
- tasks;
- appointments;
- bot conversations / inbox;
- business connectors / integrations;
- billing usage summary.

Output is JSON with min/avg/p95/max per endpoint, total request count and timestamps. It does not include the login password.
This is not a real load test replacement; it is a fast staging regression signal before heavier k6/Locust work.

Initial staging target:

- no 5xx;
- no auth failures;
- p95 read endpoints under 800 ms on free/cheap staging;
- investigate anything above threshold before adding more load.

## H6 Risk Register

Track these before promising 10,000 merchants:

- pagination: every list endpoint must keep page size bounded and avoid unbounded exports in request/response cycles;
- N+1 reads: client/lead/deal/task/inbox lists must be checked under realistic related data volume;
- search: global search must remain indexed and scoped by business;
- dashboard aggregation: expensive analytics should move to cached summaries or async materialized counters;
- queues: automation, notification, AI and provider webhook queues need lag metrics before real provider rollout;
- external providers: load smoke must not send real Telegram/WhatsApp/Instagram/OpenAI requests;
- file storage: upload/download load should be measured separately from API list/read smoke;
- frontend bundle: route-level lazy loading must stay in place and `npm run build` should remain warning-free.

## Measurement Log Template

Record every staging run:

```text
Date:
Release:
Environment:
Dataset size:
Iterations:
P95 threshold:
Slow endpoints:
5xx/errors:
Action items:
```

## Latest Result

```text
npm run e2e -- --project=desktop-chromium
10 passed, 1 intentionally skipped
```

The skipped test is the mobile-only calendar smoke inside the desktop project. It runs and passes in the mobile project.
