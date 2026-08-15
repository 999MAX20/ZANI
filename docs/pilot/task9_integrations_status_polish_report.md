# Task 9 — Integrations Status Polish / Connector UX

## Goal
Bring the integrations screen to a pilot-ready state where every connector is understandable, tariff-aware, and has a safe action model. No connector button should lead to a dead end.

## Changes

### Frontend
- Improved `/dashboard/integrations` UX.
- Added summary cards:
  - included connectors;
  - request/manual connectors;
  - soon/roadmap connectors;
  - connected connectors.
- Added search by connector name/provider/description/category.
- Added filters:
  - all;
  - included;
  - self-service;
  - request;
  - upgrade;
  - soon/roadmap.
- Added category filter:
  - communications;
  - sales;
  - calendar;
  - finance;
  - inventory;
  - marketing;
  - custom.
- Added clear filters action.
- Improved connector cards with owner-friendly instructions.
- Request-only connectors now create a connector card/request draft instead of acting like a broken disabled button.
- Roadmap/soon/upgrade connectors remain disabled but now have clear explanation.
- Removed duplicated Access Token option in credentials selector.

### Connector policy
- Self-service: can be created in the pilot.
- Request: creates a pilot request/connector draft, but does not promise external API activation.
- Upgrade/Soon/Roadmap: shown as upsell/future modules with disabled actions and explanation.

## Not done intentionally
- No real WhatsApp API.
- No real Instagram API.
- No payment enforcement.
- No external provider onboarding.
- No parser/landing/outreach modules.

## Verification
- `python manage.py check` — OK.
- `python manage.py test apps.integrations.tests_connectors --verbosity=1` — OK.
- `cd frontend && npm run build` — OK.
- Widget build — OK.

## Manual smoke test
1. Login as `demo-owner@zani.local`.
2. Open `/dashboard/integrations`.
3. Check summary cards.
4. Search for `WhatsApp`, `Excel`, `Kaspi`.
5. Test filters: included, self-service, request, roadmap.
6. Create Website/Excel connector.
7. Create WhatsApp/Instagram request connector.
8. Verify roadmap connectors have disabled buttons with explanation.
