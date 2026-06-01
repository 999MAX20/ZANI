# ZANI Full Platform QA

Date: 2026-06-01

## Scope

Full functional QA pass for the local ZANI workspace:

- smoke and route stability;
- role-based access;
- CRM core flows;
- conversations and AI actions;
- notifications;
- outreach;
- integrations;
- calendar/tasks/settings;
- mobile reachability.

## Environment

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:8000`
- Primary QA business: `Role QA Business`
- Primary QA business id: `30`
- QA password: `RoleQa12345!`

## Tooling Notes

- Browser automation was executed through Playwright against the running local app.
- Computer Use was attempted for Chrome app-state inspection, but the tool timed out after 120 seconds. This is recorded as a tooling limitation, not an app failure.
- Screenshots were saved in `plan/`:
  - `full_qa_calendar.png`
  - `full_qa_conversations.png`
  - `full_qa_integrations.png`
  - `full_qa_mobile.png`

## Results Summary

Status: broad QA pass completed for local product flows.

Production readiness conclusion: the core CRM/role/UI foundation is testable and mostly stable locally. The platform is not yet fully production-certified for real external provider delivery, because Telegram/WhatsApp/Instagram/Kaspi/MoySklad/1C-style real-provider E2E checks require live credentials, provider webhooks, and delivery confirmations.

One real routing bug was found and fixed:

- Public `/pricing` was being captured by an authenticated legacy merchant route and redirected to `/login`.
- Fixed in `frontend/src/app/router.tsx` by removing the legacy root `/pricing` merchant route. Public pricing now remains available at `/pricing`; merchant pricing remains under `/dashboard/pricing`.

## Smoke

Existing Playwright smoke suite:

- Result before fixes: 10 passed, 8 failed, 10 skipped.
- Most failures were stale test expectations after the UI reform:
  - platform page expected old English copy;
  - calendar expected old heading `Календарь бизнеса`, while current UI uses `Расписание бизнеса`;
  - first-run/activated landing expected older text;
  - platform admin account password had drifted and was repaired.
- Real product failure found: public `/pricing` route redirected to login.

Targeted retest after fixes:

- Platform admin direct object access smoke: passed after fixing the QA platform account password.
- Public routes smoke including `/pricing`: passed after router fix.

## Backend Domain Tests

Command:

```bash
.venv/bin/python manage.py test apps.businesses apps.accounts apps.conversations apps.notifications apps.outreach apps.ai_core apps.crm apps.scheduling apps.tasks
```

Result:

- `Ran 140 tests`
- `OK`
- `System check identified no issues`

Covered domains:

- accounts and team invitations;
- role access and business scoping;
- conversations/inbox;
- notifications;
- outreach campaigns/templates/consents;
- AI assistant/analyst/tool execution;
- CRM deals;
- scheduling/appointments/working hours;
- tasks.

## API QA

Owner API flow passed:

- login;
- create/update client;
- create service/resource;
- apply working-hours preset;
- fetch available appointment slots;
- create appointment;
- create lead;
- create deal from lead;
- create/start/complete task;
- inbox summary and conversation list;
- mark conversation unread/read;
- assign conversation;
- update conversation priority;
- send conversation message;
- AI suggest reply;
- run CRM pipeline from conversation;
- AI status/chat/analyst brief;
- notifications summary and mark-all-read;
- integrations/connectors/capabilities;
- business events;
- bots and bot channels;
- outreach campaigns/templates;
- audit and billing.

Role-sensitive API checks:

- Operator: audit forbidden, billing forbidden.
- Marketer: audit forbidden, billing forbidden.
- Accountant: audit forbidden, billing allowed.
- Support: audit forbidden, billing forbidden.
- Staff: audit forbidden, billing forbidden.

## Roles

Role QA was documented separately:

- `role_ui_qa_owner_2026_06_01.md`
- `role_ui_qa_director_2026_06_01.md`
- `role_ui_qa_manager_2026_06_01.md`
- `role_ui_qa_operator_2026_06_01.md`
- `role_ui_qa_marketer_2026_06_01.md`
- `role_ui_qa_accountant_2026_06_01.md`
- `role_ui_qa_support_2026_06_01.md`
- `role_ui_qa_staff_2026_06_01.md`

Main outcome:

- Owner/director have broad workspace visibility.
- Manager has operational CRM access without admin integrations access.
- Operator is focused on conversations/leads/tasks and is blocked from sensitive admin pages.
- Marketer has outreach/analytics/automation-oriented access.
- Accountant has billing-oriented access and is blocked from operational chat/admin areas.
- Support has operational read/help access with sensitive deal values masked where expected.
- Staff has limited task/calendar/client access and is blocked from admin/sensitive areas.

## Main Route Matrix

Owner routes verified:

- `/dashboard`
- `/dashboard/leads`
- `/dashboard/deals`
- `/dashboard/clients`
- `/dashboard/conversations`
- `/dashboard/calendar`
- `/dashboard/tasks`
- `/dashboard/integrations`
- `/dashboard/ai-assistant`
- `/dashboard/ai-agents`
- `/dashboard/automations`
- `/dashboard/outreach`
- `/dashboard/analytics`
- `/dashboard/settings`

Public routes verified:

- `/`
- `/pricing`
- `/bots`
- `/crm`
- `/contacts`

Mobile viewport verified at 393x852:

- `/dashboard`
- `/dashboard/leads`
- `/dashboard/conversations`
- `/dashboard/clients`
- `/dashboard/calendar`
- `/dashboard/settings`

## CRM Core

Checked:

- leads page route stability;
- deals page route stability;
- clients workbench layout;
- client creation/update API;
- lead creation API;
- deal creation from lead API;
- task creation/start/complete API.

Result:

- Core CRM entities work locally.
- The UI is now closer to workbench format, but production polish still needs deeper manual UX review on long data lists, empty states, and fast keyboard workflows.

## Conversations And AI

Checked:

- conversations route opens;
- conversation list renders;
- chat workbench renders;
- conversation status/actions are available in compact icon-button format;
- mark unread/read API works;
- assignment API works;
- priority API works;
- message send API works;
- AI reply suggestion API works;
- CRM pipeline API action works;
- AI assistant chat and analyst brief APIs work.

Observation:

- Current conversations UI uses compact/icon controls in the tested state. Text-label detection for old `AI-ответ`/pipeline controls is no longer reliable. Screenshot `full_qa_conversations.png` should be used for visual review.

## Calendar And Tasks

Checked:

- `/dashboard/calendar` opens with heading `Расписание бизнеса`;
- new booking modal opens;
- working-hours preset API works;
- available slots API returns slots;
- appointment creation API works;
- tasks route opens;
- task lifecycle API works.

Screenshot:

- `full_qa_calendar.png`

## Integrations

Checked:

- `/dashboard/integrations` route opens;
- provider cards render;
- Website / Landing forms card is visible;
- setup modal opens;
- modal is centered with focused overlay;
- connector capabilities API works.

Screenshot:

- `full_qa_integrations.png`

Remaining production risk:

- This QA does not prove real Telegram/WhatsApp/Instagram/Kaspi/MoySklad/1C provider delivery. That requires live credentials, webhook tunneling/public callback URLs, provider-side event delivery, and outbound send confirmations.

## Outreach And Notifications

Checked:

- outreach page route opens;
- campaigns/templates APIs work;
- notification summary API works;
- mark-all-read API works;
- role restrictions for outreach/billing/audit were checked through API and UI route tests.

Remaining production risk:

- Real WhatsApp/Telegram broadcast delivery and rate-limit behavior still need provider-level tests.
- Appointment reminder/confirmation automation needs end-to-end verification with real delivery channels.

## Settings

Checked:

- settings route opens for permitted roles;
- forbidden for roles that should not administer workspace settings.

## Mobile

Checked:

- mobile routes load in a 393x852 viewport;
- main mobile CRM pages are reachable;
- screenshot saved as `full_qa_mobile.png`.

Remaining mobile work:

- Full gesture/manual QA is still needed for side navigation, bottom nav conflicts, modal scroll locking, and long forms.

## Issues And Follow-Ups

Fixed:

- Public `/pricing` route redirected to login because it was still registered as a legacy authenticated merchant route.

Needs test cleanup:

- Update Playwright smoke expectations for the new Russian UI copy and rebuilt page headings.
- Replace brittle text-only checks with role-aware route and component checks.

Needs production/provider QA:

- Telegram inbound webhook -> conversation -> AI qualification -> client/lead/deal/appointment.
- WhatsApp inbound/outbound delivery.
- Instagram Direct inbound handoff.
- Kaspi/MoySklad/1C-style event sync.
- Appointment confirmation/reminder delivery.
- Outreach campaign send/cancel/metrics with real provider limits.

## Verification Commands

```bash
cd "/Users/maksim/Desktop/zani 2"
python manage.py check
npm --prefix frontend run build
.venv/bin/python manage.py test apps.businesses apps.accounts apps.conversations apps.notifications apps.outreach apps.ai_core apps.crm apps.scheduling apps.tasks
E2E_SKIP_LOCAL_SETUP=true E2E_PASSWORD='RoleQa12345!' E2E_OWNER_EMAIL='roleqa-owner@example.com' E2E_OPERATOR_EMAIL='roleqa-operator@example.com' E2E_PLATFORM_EMAIL='platform_admin@example.com' E2E_API_BASE_URL='http://127.0.0.1:8000' E2E_BASE_URL='http://127.0.0.1:5173' npx --prefix frontend playwright test --reporter=list
```
