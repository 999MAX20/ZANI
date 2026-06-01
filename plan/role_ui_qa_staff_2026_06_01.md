# Role QA: Staff

Date: 2026-06-01

## Account

- Email: `roleqa-staff@example.com`
- Password: `RoleQa12345!`
- Business role: `staff`
- Header label: `Сотрудник`

## UI Checks

- Login: PASS.
- Dashboard: PASS.
- Leads: PASS.
- Deals: PASS as forbidden.
- Clients: PASS.
- Conversations: PASS as forbidden.
- Calendar: PASS.
- Tasks: PASS.
- Integrations: PASS as forbidden.
- AI Assistant: PASS.
- AI Agents: PASS as forbidden.
- Automations: PASS as forbidden.
- Outreach: PASS read-only.
- Analytics: PASS as forbidden.
- Settings: PASS as forbidden.

## Backend Evidence

- `/api/auth/me/`: `200`.
- `/api/security/audit/`: `403`.
- `/api/billing/current-subscription/`: `403`.

## Result

PASS.
