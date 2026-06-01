# Role QA: Operator

Date: 2026-06-01

## Account

- Email: `roleqa-operator@example.com`
- Password: `RoleQa12345!`
- Business role: `operator`
- Header label: `Оператор чатов`

## UI Checks

- Login: PASS.
- Dashboard: PASS; sees chat/operator work surface.
- Leads: PASS.
- Deals: PASS as forbidden.
- Clients: PASS.
- Conversations: PASS; sees assigned/inbound conversation and chat actions.
- Calendar: PASS as forbidden.
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
