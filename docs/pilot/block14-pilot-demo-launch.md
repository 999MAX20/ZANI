# Block 14 — Pilot Demo Launch

Purpose: prepare a complete local/staging demo launch pack in one command, without rebuilding the product manually before every sales/marketing/internal review.

## Command

```bash
python manage.py prepare_pilot_demo --reset
```

The command creates/updates:

- platform admin account;
- demo owner account;
- demo manager account;
- demo merchant using the real landing activation flow;
- CRM Light pipeline and active lead form;
- demo leads, clients, services, sales events, inbox conversation, AI task, notification, connectors and quick replies.

## Default logins

- Platform admin: `platform@zani.local / Platform123!`
- Demo owner: `demo-owner@zani.local / DemoOwner123!`
- Demo manager: `demo-manager@zani.local / DemoManager123!`

## Demo URLs

- Frontend: `http://localhost:5173`
- Backend: `http://127.0.0.1:8000`
- Platform: `http://localhost:5173/platform`
- Owner dashboard: `http://localhost:5173/dashboard`
- Pilot readiness: `http://localhost:5173/dashboard/pilot-readiness`

The command also prints:

- active `LeadForm.public_id`;
- public form GET/submit URLs;
- a ready-to-run `curl` example for an external landing form;
- key API checks;
- key frontend routes;
- safe pilot promises and "do not promise yet" boundaries.

## Quality gate

Run the full local pilot gate:

```bash
./scripts/pilot_smoke_check.sh
```

Fast backend-only handoff check:

```bash
SKIP_FRONTEND_BUILD=true ./scripts/pilot_smoke_check.sh
```

API-only quality gate after preparing the demo:

```bash
python manage.py pilot_launch_quality_gate
```

The API gate verifies:

- health/readiness endpoints;
- platform, owner and manager logins;
- owner `me`, leads, clients, tasks, inbox summary, analytics and pilot readiness;
- platform overview;
- public lead form availability.

## Smoke path

1. Login as platform admin and open platform overview / merchants / support workflow.
2. Login as demo owner and open dashboard, leads, inbox, AI action, integrations.
3. Login as demo manager and verify assigned leads/tasks/inbox handoff.
4. Optional: submit a public form request with the generated lead form `public_id`.

## Safe pilot positioning

Can show:

- Landing Start entry;
- CRM Light;
- owner dashboard/business pulse;
- source connection onboarding;
- unified inbox foundation;
- AI recommendation → task flow;
- import templates.

Do not sell as ready yet:

- production WhatsApp/Instagram integrations;
- marketplace repricing;
- full loyalty/bonus ecosystem;
- autonomous AI director.
