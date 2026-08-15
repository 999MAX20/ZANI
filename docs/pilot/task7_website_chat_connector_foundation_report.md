# Task 7 — Website Chat E2E + Connector Activation Foundation

## Scope
This task keeps the pilot focused: Website Chat becomes the first end-to-end connector, while the connector catalog now has tariff/availability metadata for future paid packages and integrations.

## Changes
- Added connector capability metadata without DB schema changes:
  - availability
  - required_plan
  - setup_state
  - action_behavior
  - primary_action_label
- Improved Integrations UI so each connector has a clear state:
  - self-service/included
  - upgrade-required
  - request-required
  - roadmap/disabled
- Prevented roadmap/request connectors from behaving like broken buttons.
- Improved Bot Detail website chat preview:
  - shows public widget token
  - shows embeddable widget snippet
  - creates a public website conversation
  - can append a follow-up message to the same conversation
  - links manager directly to Inbox for verification
- Added connector catalog test expectations for tariff/activation metadata.

## Pilot rule
Do not promise production WhatsApp/Instagram/Kaspi/1C. Website Chat is the safe pilot connector. Telegram remains beta; WhatsApp/Instagram are request-based.

## Manual smoke path
1. Login as demo-owner.
2. Open `/dashboard/bots`.
3. Open the demo bot.
4. Confirm Website channel exists.
5. Send website chat preview message.
6. Send follow-up message.
7. Open Inbox and confirm the conversation/messages are visible.
8. Open Integrations and confirm connector statuses are honest and no roadmap button leads to a dead flow.
