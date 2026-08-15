# Block 8 — Pilot smoke demo merchant

This block adds a repeatable demo/staging seed for the pilot sales flow. It does **not** add new product modules or landing generation inside ZANI Core.

## Goal

Create one realistic demo merchant that validates the pilot path:

```text
External landing activation
→ ZANI business account
→ CRM Light
→ demo leads
→ sales/import signals
→ business pulse dashboard
→ unified inbox
→ AI action task
```

## Command

```bash
python manage.py seed_pilot_demo --reset
```

Optional credentials:

```bash
python manage.py seed_pilot_demo \
  --reset \
  --landing-id=demo-pilot-landing-001 \
  --business-name="ZANI Demo Beauty" \
  --owner-email=demo-owner@zani.local \
  --owner-password='DemoOwner123!' \
  --manager-email=demo-manager@zani.local \
  --manager-password='DemoManager123!'
```

## What it creates

- trial business account via existing landing activation service;
- owner user and manager user;
- CRM Light pipeline and landing lead form;
- 3 services;
- 3 demo leads from landing/Instagram/WhatsApp context;
- connected website and Excel/CSV connectors;
- beta/needs-attention Telegram and WhatsApp connector states;
- 3 sale.recorded business events for dashboard revenue;
- website inbox conversation with unread/handoff state;
- demo bot and website channel;
- AI tool call log + task + notification;
- quick reply templates.

## Safe pilot positioning

The demo intentionally shows:

- Website / landing forms: available;
- Excel / CSV: available;
- Telegram: beta;
- WhatsApp: button/beta, not production API;
- Instagram/marketplace modules: roadmap outside this demo.

## Local verification

```bash
python manage.py check
python manage.py test apps.businesses.tests_demo_seed -v 2
```

Recommended extended check:

```bash
python manage.py test \
  apps.businesses.tests_activation \
  apps.businesses.tests_demo_seed \
  apps.analytics.tests \
  apps.bots.tests.InboxBackendTests \
  apps.ai_core.tests \
  apps.tasks.tests \
  apps.notifications.tests -v 2
```

## Demo path

1. Login as owner.
2. Open dashboard and confirm business pulse/mobile onboarding is not empty.
3. Open leads and verify demo leads exist.
4. Open inbox and verify website conversation needs handoff.
5. Open tasks and verify AI action task exists.
6. Open integrations and confirm connected/beta/roadmap statuses.
