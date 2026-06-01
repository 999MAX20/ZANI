# Role QA: Support

Date: 2026-06-01

## Account

- Email: `roleqa-support@example.com`
- Password: `RoleQa12345!`
- Business role: `support`
- Header label: `Поддержка`

## UI Checks

- Login: PASS.
- Dashboard: PASS.
- Leads: PASS.
- Deals: PASS; deal is visible, sensitive amount is masked to `0`.
- Clients: PASS.
- Conversations: PASS.
- Calendar: PASS.
- Tasks: PASS as forbidden.
- Integrations: PASS as forbidden.
- AI Assistant: PASS.
- AI Agents: PASS as forbidden.
- Automations: PASS as forbidden.
- Outreach: PASS read-only.
- Analytics: PASS as forbidden.
- Settings: PASS as forbidden.

## Backend Evidence

- `/api/deals/`: `200`, but sensitive fields are masked: `amount=None`, `currency=""`, `notes=""`.
- `/api/security/audit/`: `403`.
- `/api/billing/current-subscription/`: `403`.

## Result

PASS.
