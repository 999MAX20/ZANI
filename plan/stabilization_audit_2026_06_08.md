# ZANI Main Stabilization Audit

Date: 2026-06-08

## Decision

Do not rewrite from scratch.

Continue `Zani Main`, but move development into a stabilization-first workflow:

1. Freeze and separate the current dirty tree into coherent blocks.
2. Keep only product code and migrations in commits.
3. Remove or isolate local artifacts.
4. Require tests/build before each merge.
5. Continue feature work only after the current baseline is clean.

## Current Health

Validated locally:

```bash
.venv/bin/python manage.py check
.venv/bin/python manage.py makemigrations --check --dry-run
.venv/bin/python manage.py test apps.businesses apps.accounts apps.conversations apps.notifications apps.outreach apps.ai_core apps.crm apps.scheduling apps.tasks --verbosity 1
npm --prefix frontend run build
```

Results:

- Django system check: OK.
- Pending model migrations check: OK, no missing migrations detected.
- Backend domain test slice: 144 tests OK.
- Full backend test suite: 552 tests OK after adding targeted billing/custom-field permission coverage.
- Frontend production build: OK.
- i18n parity: 3989 keys across `ru`, `kk`, `en`.

Recent local database issue:

- `/api/auth/token/` failed with `sqlite3.OperationalError: no such column: businesses_business.language`.
- Root cause: local SQLite database had not applied `businesses.0005_business_operational_settings`.
- Fixed locally with `manage.py migrate`.

## Dirty Tree Blocks

### Block 1: Billing Controls

Files:

- `apps/billing/models.py`
- `apps/billing/views.py`
- `apps/billing/migrations/0005_subscription_billing_controls.py`
- `frontend/src/api/billing.ts`

Purpose:

- Billing email, payment method, invoice details.
- Requested plan and plan-change timestamp.
- Subscription actions: settings update, change plan, pause, resume, cancel.

Risk:

- Role/permission tests were added for owner manage access and accountant view-only access.
- API tests were added for settings update, plan change request, pause, resume and cancel.
- Still needs browser QA for the billing/settings UI.

### Block 2: Business Operational Settings

Files:

- `apps/businesses/models.py`
- `apps/businesses/migrations/0005_business_operational_settings.py`
- `frontend/src/components/forms/BusinessSettingsForm.tsx`
- `frontend/src/features/settings/SettingsPage.tsx`
- `frontend/src/types/index.ts`

Purpose:

- Business language, currency, legal details, invoice email.
- Brand color/logo.
- Cancellation/prepayment policies.
- SLA and booking buffer.

Risk:

- These fields are now required by runtime code after migration.
- Any environment using an old database must run migrations before login works.

### Block 3: Custom Field Permissions

Files:

- `apps/core/models.py`
- `apps/core/serializers.py`
- `apps/core/custom_field_views.py`
- `apps/core/migrations/0008_customfielddefinition_permissions_json.py`

Purpose:

- `permissions_json` for custom field definitions.
- Role-based view/edit checks for custom field values.

Risk:

- Current filtering loops over queryset objects in Python. It is acceptable for pilot scale, but should be optimized if custom fields grow.
- Role-specific view/edit behavior is now covered by targeted tests.

### Block 4: CRM/UI Refresh

Files include:

- `frontend/src/app/router.tsx`
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/ui/*`
- `frontend/src/features/dashboard/*`
- `frontend/src/features/deals/*`
- `frontend/src/features/conversations/ConversationsPage.tsx`
- `frontend/src/features/assistant/AIAgentsPage.tsx`
- `frontend/src/styles.css`
- `frontend/tailwind.config.ts`
- `frontend/src/config/*`

Purpose:

- UI unification and design system polish.
- Dashboard rebuild.
- Deals page polish.
- Shared UI primitives.
- New config/tokens.

Risk:

- This block is large and should not be mixed with backend billing/settings changes.
- Needs browser QA screenshots for dashboard, deals, conversations, settings, mobile.

### Block 5: `leadsorig`

File:

- `leadsorig`

Status:

- Tracked by git, but also listed in `.gitignore`.
- Looks like an old copied `LeadsPage.tsx` artifact, not product code.
- Was removed from the working tree as artifact cleanup.

Recommended action:

- Commit its deletion as an artifact cleanup.
- If it must be restored as a reference later, place it under `references/` or `useless/` with a clear name.

## Why Continuing Is Better Than Rewriting

The project already has:

- production-shaped Django domains;
- CRM, conversations, AI, integrations, billing, scheduling and outreach logic;
- migrations across all key entities;
- hundreds of backend tests;
- frontend route-level lazy loading and split chunks;
- production readiness docs and runbooks;
- local health checks that pass.

Starting from scratch would lose too much validated business logic and would likely recreate the same complexity later.

## Required Stabilization Before More Feature Work

1. Split dirty changes into separate commits/PRs:
   - billing controls;
   - business operational settings;
   - custom field permissions;
   - UI refresh;
   - artifact cleanup.

2. Add/confirm tests:
   - billing manage permissions;
   - subscription settings and plan change;
   - business settings serializer/API behavior;
   - custom field role permissions;
   - route permissions for settings/billing;
   - UI smoke for dashboard/deals/settings.

3. Clean local artifacts:
   - remove tracked `leadsorig` if not needed;
   - ensure `.DS_Store`, build outputs and tsbuildinfo files remain ignored;
   - avoid committing local SQLite data, logs or screenshots unless explicitly needed.

4. Run the stable verification set:

```bash
.venv/bin/python manage.py check
.venv/bin/python manage.py makemigrations --check --dry-run
.venv/bin/python manage.py test
npm --prefix frontend run build
npm --prefix frontend run e2e -- --reporter=list
```

5. Only after this, continue product work:
   - performance/lite mode;
   - real provider E2E;
   - production queues and webhooks;
   - load baseline;
   - observability and alerting.

## Current Recommendation

Continue this project.

The next engineering move should be a cleanup/stabilization branch, not a rewrite.
