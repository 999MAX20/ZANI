# Backend Apps Map

Текущие Django apps соответствуют public product core NeuroBoost.

## Implemented

- `accounts` — users, roles, auth profile.
- `billing` — subscription plans and subscriptions.
- `businesses` — tenants and business membership.
- `clients` — merchant clients.
- `crm` — pipelines, stages, deals.
- `leads` — merchant leads.
- `scheduling` — resources, working hours, appointments.
- `services` — merchant services.
- `conversations` — conversations and messages.
- `notifications` — notifications.
- `analytics` — analytics events.
- `activities` — activity timeline, notes, tags.
- `automations` — automation foundation.
- `tasks` — CRM tasks.
- `core` — shared permissions, audit, health, tenant viewsets.

## Planned

- `bots` — AI bot product foundation.
- `ai_core` — shared AI abstraction and request logs.
- `integrations` — external channel/webhook skeletons.

Internal developer tools must stay outside this product core unless a roadmap step explicitly says otherwise.
