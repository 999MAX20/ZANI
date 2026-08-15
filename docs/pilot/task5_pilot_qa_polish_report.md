# Zani Task 5 — Pilot QA Polish / Broken Flow Fixes

## Scope
This task keeps the current architecture unchanged and focuses on pilot clickability.

## Changes
- Added safe wildcard route (`*`) with a friendly pilot-safe screen instead of a blank/crashed page.
- Added merchant route aliases:
  - `/dashboard/assistant` → AI Assistant
  - `/dashboard/inbox` → Conversations/Inbox
  - `/dashboard/billing` → Settings billing section
  - legacy `/assistant`, `/inbox`, `/billing` aliases are also guarded for merchant users.
- Added platform placeholder routes:
  - `/platform/landings`
  - `/platform/outreach`
- Added these items to Platform Admin navigation with safe placeholder pages.
- Preserved the internal tools boundary: no parser, landing generator, real outreach or external API integration was added.

## Checks run
- `python manage.py check` — passed.
- `cd frontend && npm run build` — passed, including widget build.
- Backend tests were started, but full test suite is slow in this container due throttling test timing and hit tool timeout. Run locally with `python manage.py test --verbosity=1`.

## Local smoke path
1. Login as `admin@platform.local` and open `/platform`, `/platform/merchants`, `/platform/landings`, `/platform/outreach`.
2. Login as demo owner and open `/dashboard`, `/dashboard/leads`, `/dashboard/inbox`, `/dashboard/assistant`, `/dashboard/billing`.
3. Open a random wrong URL and confirm it shows a safe page, not a crash.
