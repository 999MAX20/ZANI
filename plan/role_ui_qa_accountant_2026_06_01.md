# Role QA: Accountant

Date: 2026-06-01

## Account

- Email: `roleqa-accountant@example.com`
- Password: `RoleQa12345!`
- Business role: `accountant`
- Header label: `Бухгалтер`

## UI Checks

- Login: PASS.
- Dashboard: PASS.
- Leads: PASS as forbidden.
- Deals: PASS as forbidden.
- Clients: PASS.
- Conversations: PASS as forbidden.
- Calendar: PASS as forbidden.
- Tasks: PASS as forbidden.
- Integrations: PASS as forbidden.
- AI Assistant: PASS as forbidden.
- AI Agents: PASS as forbidden.
- Automations: PASS as forbidden.
- Outreach: PASS read-only.
- Analytics: PASS.
- Settings: PASS as forbidden.

## Backend Evidence

- `/api/auth/me/`: `200`.
- `/api/billing/current-subscription/`: `200`.
- `/api/security/audit/`: `403`.

## Result

PASS.
