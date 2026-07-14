# Block 10 — Clean Pilot Package / Production Readiness

Status: pilot-ready package foundation.

This block does **not** add billing, payment, tariff restrictions, marketplace automation, or a landing generator. Those decisions remain outside this block.

## Goal

Prepare ZANI for controlled pilot delivery with a clean archive, repeatable local smoke checks, clear launch boundaries, and a simple handoff checklist for the technical/marketing team.

## Pilot scope that can be demonstrated

Safe demo/pilot scope:

- External landing is created outside ZANI by Codex/agents/templates.
- ZANI receives public form submissions from the landing.
- Lead, Client, LeadFormSubmission and Notification are created.
- Platform activation creates Business, Owner, CRM Light pipeline, LeadForm and trial state.
- Owner dashboard shows business pulse, setup score, quick connect cards and mobile onboarding.
- Integration onboarding shows safe statuses: available, beta, soon, by request, roadmap.
- Unified inbox summarizes website/landing conversations and positions WhatsApp/Instagram as beta/roadmap unless production provider is enabled.
- AI can suggest an action and create a Task only after user confirmation.
- Import sample files allow sales/catalog/clients data to be loaded for pilot demos.
- `seed_pilot_demo --reset` creates a demo merchant for sales/product demos.

## Not included in this block

Do not promise these as ready in pilot:

- Full WhatsApp Business API production integration.
- Instagram Direct production integration.
- Kaspi/Wildberries/Ozon/Yandex Marketplace direct integrations.
- Automatic repricing / price correction.
- Bonus/QR wallet ecosystem.
- Full payment/subscription automation.
- AI director/autonomous business management.
- Landing generator inside ZANI Core.

## New script

Run the full local pilot smoke package:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
./scripts/pilot_smoke_check.sh
```

The script runs:

1. Django migrations.
2. Django system check.
3. Core pilot test suite.
4. Import sample export.
5. Demo merchant seed.
6. Frontend production build.
7. Widget production build.

## Clean archive

Create a clean package without local database, virtualenv, node_modules, cache files, build outputs, reports, logs or zip files:

```bash
./scripts/make_clean_archive.sh zani-pilot-clean.zip
```

## Manual smoke after starting the app

Backend:

```bash
source .venv/bin/activate
export DEBUG=True
export SECRET_KEY="dev-secret-key-change-for-production-32-plus-chars"
export DATABASE_URL="sqlite:///db.sqlite3"
export REDIS_URL="memory://"
export CELERY_TASK_ALWAYS_EAGER=True
export CELERY_TASK_STORE_EAGER_RESULT=False
export AUTOMATIONS_RUN_INLINE=True
export SECURE_SSL_REDIRECT=False
export SESSION_COOKIE_SECURE=False
export CSRF_COOKIE_SECURE=False
export ALLOWED_HOSTS="localhost,127.0.0.1"
export CORS_ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
python manage.py migrate
python manage.py seed_pilot_demo --reset
python manage.py runserver
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open: `http://localhost:5173`

Demo owner:

```text
demo-owner@zani.local
DemoOwner123!
```

Demo manager:

```text
demo-manager@zani.local
DemoManager123!
```

## Demo path

For a first sales/product demo, use this path:

1. Dashboard — business pulse, setup score, mobile owner start.
2. Leads — landing leads and statuses.
3. Inbox — Business Inbox Pulse and website conversation.
4. AI Assistant — AI suggested action and task creation flow.
5. Tasks — created AI action task.
6. Integrations — safe connection catalog and statuses.
7. Settings/Data Import — import templates and CSV path.

## Pilot readiness criteria

The package is considered ready for controlled pilot when all pass:

- `./scripts/pilot_smoke_check.sh` succeeds.
- Owner and manager can login locally.
- Demo dashboard opens without empty/dead screen.
- Test public form creates Lead, Client, LeadFormSubmission and Notification.
- Demo owner can view dashboard, leads, inbox, integrations, AI assistant and tasks.
- Marketing uses only the safe pilot promises listed in this document.

## Return later

Already postponed by product/marketing decision:

- Billing / Trial / tariff limits.
- Pilot QA polish after manual owner/manager cabinet review.
