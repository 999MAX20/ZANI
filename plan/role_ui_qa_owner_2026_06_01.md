# Role QA: Owner

Date: 2026-06-01

## Account

- Email: `roleqa-owner@example.com`
- Password: `RoleQa12345!`
- Business role: `owner`
- Header label: `Владелец`

## UI Checks

- Login: PASS.
- Dashboard: PASS; retest heading is `Доброе утро`.
- Leads: PASS.
- Deals: PASS; sees `Role QA Sensitive Deal` and amount `250 000 KZT`.
- Clients: PASS.
- Conversations: PASS; sees `Role QA Client`, linked client/lead/deal chips, and chat actions.
- Calendar: PASS.
- Tasks: PASS.
- Integrations: PASS.
- AI Assistant: PASS.
- AI Agents: PASS.
- Automations: PASS.
- Outreach: PASS; role block says owner can launch campaigns.
- Analytics: PASS.
- Settings: PASS.

## Backend Evidence

- `/api/auth/me/`: `200`.
- `/api/deals/`: `200`, amount is visible as `250000.00`.
- `/api/security/audit/`: `200`.
- `/api/billing/current-subscription/`: `200`.

## Result

PASS.
