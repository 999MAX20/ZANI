# Role QA: Director

Date: 2026-06-01

## Account

- Email: `roleqa-director@example.com`
- Password: `RoleQa12345!`
- Business role: `admin`
- Header label: `Директор`

## UI Checks

- Login: PASS.
- Dashboard: PASS.
- Leads: PASS.
- Deals: PASS; full pipeline and amount access expected for admin/director.
- Clients: PASS.
- Conversations: PASS.
- Calendar: PASS.
- Tasks: PASS.
- Integrations: PASS.
- AI Assistant: PASS.
- AI Agents: PASS.
- Automations: PASS.
- Outreach: PASS; role block says director can launch campaigns.
- Analytics: PASS.
- Settings: PASS; team, roles, security, notifications and advanced settings are available.

## Backend Evidence

- `/api/auth/me/`: `200`.
- `/api/deals/`: `200`, amount is visible as `250000.00`.
- `/api/security/audit/`: `200`.
- `/api/billing/current-subscription/`: `200`.

## Result

PASS.
