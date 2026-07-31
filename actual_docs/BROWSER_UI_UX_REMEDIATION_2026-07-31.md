# ZANI Browser UI/UX Remediation — 2026-07-31

Status: implementation complete; final certification recorded below.

Scope: the 22 findings from `BROWSER_UI_UX_AUDIT_2026-07-31.md`. This pass does not add product features, production integrations, vertical-specific behavior, or deployment work.

## Finding closure

| Finding | Result | Implementation evidence |
| --- | --- | --- |
| UX-001 | DONE | Login/signup/social authentication set an HTTP-only refresh cookie, refresh restores the session, logout clears the cookie, and frontend startup performs one deduplicated restore even under React StrictMode. |
| UX-002 | DONE | Runtime localization coverage was completed for RU/KK/EN and `check:i18n` now rejects literal runtime keys and locale parity failures. |
| UX-003 | DONE | Seeded tasks, connector alerts, AI brief copy, conversation states and operational labels use the localized product vocabulary. |
| UX-004 | DONE | Primary navigation and repeated route controls expose stable accessible names in expanded, compact and mobile states. |
| UX-005 | DONE | Global CRM search is visually and semantically distinct from local workbench search/filter controls; redundant task controls were removed. |
| UX-006 | DONE | CRM workbench context panels are closable and table/board layout no longer creates page-level horizontal overflow. |
| UX-007 | DONE | Workbench surface and scroll ownership were simplified across deals, conversations, tasks and settings. |
| UX-008 | DONE | Dashboard metric, queue and empty-state copy now identifies personal/global scope and avoids contradictory states. |
| UX-009 | DONE | Integrations show merchant-facing connection status, setup, retry and help copy instead of roadmap/upsell language. |
| UX-010 | DONE | The pilot seed is one coherent beauty-business scenario with `Asia/Almaty`, localized connector/task copy and consistent business data. |
| UX-011 | DONE | Client identity is required by frontend and backend Lead creation; the empty form remains open with `Выберите клиента`. |
| UX-012 | DONE | Shared business-timezone formatting is used across dashboard, calendar, entity drawers and detail workspaces. |
| UX-013 | DONE | CRM summary cards and detail routes share owner, stage, source, next-action and linked-entity fields; risk and probability remain separately labelled concepts. |
| UX-014 | DONE | Conversation drafts are stored per business and conversation and restored after route navigation. |
| UX-015 | DONE | Operator draft state is separate from AI recommendation state and the UI shows explicit recommendation provenance. |
| UX-016 | DONE | Inbox connection recovery opens the channel connection workspace instead of the unrelated provider inventory. |
| UX-017 | DONE | AI readiness derives from real prerequisites and the action matrix distinguishes suggest-only, approval-required and autonomous behavior. |
| UX-018 | DONE | Expanded navigation uses a deterministic responsive layout and no longer hides the active workbench. |
| UX-019 | DONE | Route metadata supplies the correct shell title for Outreach, Services, Account and the other authenticated routes. |
| UX-020 | DONE | Repeated row/provider/entity actions include contextual accessible names and CRM controls have stable labels. |
| UX-021 | DONE | Tasks empty states are bound to the displayed filtered collection; a populated table no longer shows a false empty result. |
| UX-022 | DONE | CRM actions/navigation, AI assistance and warning/attention states use their documented brand, violet and amber/red semantics. |

## Browser certification

- Desktop route sweep: `/app`, leads, deals, clients, tasks, calendar, conversations, integrations, settings, outreach, AI agents, analytics, timeline, services, resources, working hours and account.
- All 17 routes remained authenticated, rendered without an application error, had no page-level horizontal overflow and exposed none of the audited raw keys/placeholders or mojibake markers.
- Mobile `390x844` and tablet `768x1024`: dashboard, leads, tasks, conversations and calendar rendered without application errors or page-level horizontal overflow and retained navigation controls.
- Empty Lead: count remained unchanged, the modal stayed open, `Выберите клиента` was visible and no success notification appeared.
- Appointment consistency: the same seeded appointment displayed `15:00` on dashboard, calendar and appointment detail.
- Lead consistency: Alina retained status, source and `Demo Manager` ownership between the list inspector and `/app/leads/12`.
- Deal consistency: the seeded deal retained client, stage, `Demo Owner`, amount and linked CRM context between the board inspector and `/app/deals/3`.
- Inbox draft: `Черновик проверки UX 31-07` survived navigation away and back; the AI recommendation remained the separate `Подготовьте черновик ответа для клиента.` state.

## Verification

- `git diff --check`
- Django `manage.py check`
- Focused backend regression suite for accounts, CRM cards, business activation/demo seed and Lead creation
- Frontend policy tests: action feedback, bundle budget, dashboard appointment deduplication, daily workspaces and gate environment
- Frontend localization, TypeScript/application/widget build and bundle check
- Browser interaction and visual audit scripts
- Playwright desktop and mobile role smoke for owner, manager, operator and doctor

Exact command results and any skipped checks are reported in the branch handoff.

## Boundary after closure

This document closes only the audited 22 UI/UX defects. It does not certify live provider credentials, production infrastructure, paid services or a full production rollout. The branch must stop for owner review after final green gates.
