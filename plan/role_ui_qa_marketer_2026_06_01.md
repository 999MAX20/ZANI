# Role QA: Marketer

Date: 2026-06-01

## Account

- Email: `roleqa-marketer@example.com`
- Password: `RoleQa12345!`
- Business role: `marketer`
- Header label: `Маркетолог`

## UI Checks

- Login: PASS.
- Dashboard: PASS.
- Leads: PASS.
- Deals: PASS as forbidden.
- Clients: PASS.
- Conversations: PASS as forbidden.
- Calendar: PASS as forbidden.
- Tasks: PASS as forbidden.
- Integrations: PASS as forbidden.
- AI Assistant: PASS.
- AI Agents: PASS as forbidden.
- Automations: PASS; marketer can access automation/outreach work surface.
- Outreach: PASS; role block says marketer can launch campaigns.
- Analytics: PASS.
- Settings: PASS as forbidden.

## Backend Evidence

- `/api/auth/me/`: `200`.
- `/api/security/audit/`: `403`.
- `/api/billing/current-subscription/`: `403`.

## Result

PASS.
