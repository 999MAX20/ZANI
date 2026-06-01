# Role QA: Manager

Date: 2026-06-01

## Account

- Email: `roleqa-manager@example.com`
- Password: `RoleQa12345!`
- Business role: `manager`
- Header label: `Менеджер продаж`

## UI Checks

- Login: PASS.
- Dashboard: PASS; sees working-day operator/manager surface.
- Leads: PASS.
- Deals: PASS; page shows `Role QA Sensitive Deal`, pipeline/stage, and amount `250 000 KZT`.
- Clients: PASS.
- Conversations: PASS.
- Calendar: PASS.
- Tasks: PASS.
- Integrations: PASS as forbidden.
- AI Assistant: PASS.
- AI Agents: PASS as forbidden.
- Automations: PASS as forbidden.
- Outreach: PASS read-only; role block says manager can only view.
- Analytics: PASS.
- Settings: PASS limited view.

## Backend Evidence

- `/api/deals/`: `200`, manager-owned deal is visible with amount `250000.00`.
- `/api/pipelines/`: `200`, returns 1 shared pipeline.
- `/api/pipeline-stages/`: `200`, returns 1 shared stage.
- `/api/security/audit/`: `403`.
- `/api/billing/current-subscription/`: `403`.

## Fixed Issue

Manager originally could see deals but could not see shared pipeline/stage definitions. This made the Deals page unusable for active sales work. The fix keeps `Pipeline`, `PipelineStage`, and `StageTransition` business-scoped for roles that can view deals, while deal rows still respect own/team/business scope.

## Result

PASS.
