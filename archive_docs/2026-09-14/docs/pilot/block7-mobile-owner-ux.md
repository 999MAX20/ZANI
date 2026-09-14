<!-- ZANI_ARCHIVE_HEADER_BEGIN -->
> ARCHIVED 2026-09-14 · HISTORICAL_DELIVERY
>
> Original path: `docs/pilot/block7-mobile-owner-ux.md`. Source: `4ba3cbf9fddcc6e1baa172b494c781550c090693`.
> Исторический отчёт delivery-блока. Его проверки относятся только к исходному снимку; оставшиеся live/policy gates не закрываются архивацией.
> Historical evidence only; not an implementation queue or current release approval.
> Original relative references below are preserved as historical text; resolve them against the original path.
<!-- ZANI_ARCHIVE_HEADER_END -->

# Block 7 — Mobile-first owner onboarding UX

Goal: make the first owner experience feel like a simple mobile business control layer rather than a desktop CRM.

Implemented:
- `mobile_onboarding` payload in owner dashboard API.
- Mobile-only owner start card on Dashboard.
- Setup progress, next best action, and swipeable setup steps.
- Safer mobile defaults for input font-size and card radius.

This block does not add heavy integrations, marketplace logic, or a landing generator. It only improves pilot UX and makes the existing onboarding path clear on phone screens.
