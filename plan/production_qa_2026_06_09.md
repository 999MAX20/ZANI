# Production QA - 2026-06-09

Цель: проверить готовность ZANI к production-пилоту после стабилизации, очистки планов и обновления UI/role/business foundations.

## Статус

- Старт QA: 2026-06-09
- Ветка: `main`
- Последний запушенный commit перед QA: `69a13a5`
- CI на GitHub: зеленый по сообщению владельца проекта
- Локальный QA: completed for automated/backend/frontend/API smoke scope

## Scope

Проверяем:

- Роли: owner, director, manager, operator, accountant.
- Основные страницы: dashboard, conversations, calendar, deals, clients, integrations, settings, AI agents, outreach.
- Бизнес-сценарии: входящее сообщение, unread/notifications, AI answer, CRM pipeline, lead/client/deal/task/appointment, calendar booking, reminders, outreach, business events.
- UI/UX: desktop/mobile, sidebar/header, рабочие панели без лишнего шума.
- Backend readiness: migrations, tests, build, permissions, production checks.

Не проверяем в этом документе:

- Реальную нагрузку 10k merchants.
- Реальные внешние провайдеры в production-режиме без валидных prod credentials.
- Платежный provider workflow, если он не подключен.

## Cleanup Before QA

Выполнено:

- Удалены устаревшие техпланы и старые QA-артефакты из `plan/`.
- В `references/` оставлена только папка `main_references/`.

Оставлены актуальные документы:

- `plan/README.md`
- `plan/readiness_plan.md`
- `plan/stabilization_audit_2026_06_08.md`
- `plan/commit_pr_split_plan_2026_06_08.md`
- `plan/clean_code_rules/zani_required_clean_code_rules.md`
- `plan/production_qa_2026_06_09.md`

## Technical Checks

| Check | Status | Notes |
| --- | --- | --- |
| `python manage.py check` | Passed | No issues |
| `python manage.py makemigrations --check --dry-run` | Passed | No changes detected |
| `python manage.py test --verbosity 1` | Passed | 552 tests OK |
| `npm --prefix frontend run build` | Passed | i18n parity OK, app and widget builds OK |
| `git diff --check` | Passed | No whitespace/errors |
| `npm --prefix frontend run e2e -- --reporter=list` | Passed | 18 passed, 10 skipped after updating smoke assertions and mobile sidebar click blocker |

## Role QA

| Role | Login | Navigation | Permissions | Critical flows | Status |
| --- | --- | --- | --- | --- | --- |
| Owner | `qa-owner@zani.local` | E2E owner routes pass | API smoke allows billing, conversations, analytics, outreach | Owner dashboard, core merchant flow, calendar booking covered | Passed |
| Director | `qa-director@zani.local` | API auth smoke pass | API smoke allows billing, conversations, analytics, outreach | Admin-level access works like owner in checked endpoints | Passed |
| Manager | `qa-manager@zani.local` | API auth smoke pass | Billing blocked; conversations, analytics, outreach currently allowed | Operational role can work with inbox and business data | Passed with role-policy note |
| Operator | `qa-operator@zani.local` | API auth smoke pass | Billing and owner analytics blocked; conversations and outreach currently allowed | Chat-operator access works for inbox | Passed with role-policy note |
| Accountant | `qa-accountant@zani.local` | API auth smoke pass | Billing view allowed, billing manage blocked; analytics allowed; conversations/outreach currently allowed | Finance/analytics access works | Passed with role-policy note |

Role API smoke факты:

- owner: `/api/auth/me/`, billing view/manage, conversations summary, owner analytics, outreach campaigns -> `200`.
- director/admin: `/api/auth/me/`, billing view/manage, conversations summary, owner analytics, outreach campaigns -> `200`.
- manager: billing view/manage -> `403`; conversations summary, owner analytics, outreach campaigns -> `200`.
- operator: billing view/manage and owner analytics -> `403`; conversations summary and outreach campaigns -> `200`.
- accountant: billing view -> `200`, billing manage -> `403`; conversations summary, owner analytics, outreach campaigns -> `200`.

## Scenario QA

| Scenario | Expected result | Status | Notes |
| --- | --- | --- | --- |
| Incoming message -> conversation | Message appears in conversations with unread state and role-aware notification | Partially covered | Backend tests and inbox route smoke pass. Real Telegram/WhatsApp provider inbound was not re-tested in this QA pass. |
| Open conversation -> mark read | Sidebar/header unread count decreases | Partially covered | Backend test suite passed; needs final browser check with live message before production pilot. |
| AI answer draft | AI creates draft without sending without confirmation where required | Covered by backend tests | Full Django test suite passed. Needs provider-specific prompt QA before live merchants. |
| CRM pipeline manual | Conversation can create/update lead/client/deal/task/appointment | Covered by E2E/API | Core merchant business flow E2E passed. |
| CRM pipeline automatic | Works only when safe mode/config allows automation | Partially covered | Backend tests passed. Real auto-mode should remain disabled until provider and tenant settings are verified. |
| Calendar booking | Shows available masters/time slots and creates appointment | Covered by E2E | Calendar UI create-appointment test passed with current selectors. |
| Appointment reminder | Reminder/confirmation event is scheduled and notification logic respects roles | Covered by backend tests | Real send via Telegram/WhatsApp provider not executed in this pass. |
| Deal won/lost | Deal can be closed with result and history event | Covered by backend tests | Manual UI closure flow still should be checked before pilot. |
| Outreach campaign | Allowed roles can launch, blocked roles cannot | Needs role-policy decision | Endpoint is currently accessible to manager/operator/accountant in API smoke. If only owner/admin/manager should launch, tighten permissions. |
| Business events -> AI Analyst | Analyst can read/source business events and propose actions | Covered by backend tests | No live provider events were generated in this pass. |

## Page QA

| Page | Desktop | Mobile | Notes |
| --- | --- | --- | --- |
| Dashboard | E2E covered | E2E covered | Current redesigned owner dashboard assertions pass. |
| Conversations | E2E/API covered | E2E covered | Inbox route and role-aware API access pass. Live provider inbound still pending. |
| Calendar | E2E covered | Not fully visual-QA'd in this pass | Create appointment from calendar UI passes. |
| Deals | Backend/API covered | Not fully visual-QA'd in this pass | Business logic covered by tests; visual QA before pilot recommended. |
| Clients | Backend/API covered | Not fully visual-QA'd in this pass | Business logic covered by tests; visual QA before pilot recommended. |
| Integrations | Backend/API covered | Not fully visual-QA'd in this pass | Provider credentials/send not executed. |
| Settings | Backend/API covered | Not fully visual-QA'd in this pass | Role restrictions covered in API smoke. |
| AI Agents | E2E covered | Not fully visual-QA'd in this pass | Invalid route/fallback behavior covered. |
| Outreach | Backend/API covered | Not fully visual-QA'd in this pass | Role-policy for campaign list/launch needs final product decision. |

## Findings

- Fixed: mobile sidebar close button was not clickable because content z-index was higher than the close control.
- Fixed: E2E smoke expected old pre-redesign copy and routes. Assertions were updated to the current UI.
- Fixed: calendar E2E used old selectors. It now clicks current accessible hour cells and exact create buttons.
- Role-policy note: `outreach.campaigns` is currently reachable by manager, operator and accountant in API smoke. This may be acceptable for list/read access, but campaign launch permissions must be checked separately before production.
- Role-policy note: accountant currently has conversations summary access. If accountant must be finance-only, restrict inbox summary/list endpoints.

## Fixed During QA

- Fixed mobile sidebar close button stacking: close button was visible but click was intercepted by the sidebar content because the sidebar had a higher z-index.
- Updated E2E smoke assertions for the current redesigned UI:
  - platform overview now uses `Обзор Zani`;
  - owner dashboard now uses `Главная`;
  - calendar now uses `Расписание бизнеса`;
  - AI agents fallback redirects to `profile` or `overview`;
  - activated landing owner now lands on the redesigned owner dashboard.
- Updated calendar E2E selectors to use current accessible hour cells and exact submit button matching.

## Production Blockers

No blocking automated-test failures remain in the checked scope.

Before a real production pilot, complete provider QA with live Telegram/WhatsApp/Kaspi/1C credentials and finalize the outreach/accountant inbox role policy.

## Follow-up Backlog

- Run live provider inbound QA: Telegram message -> conversation -> unread notification -> mark read.
- Run live outbound QA: AI/manual response through Telegram/WhatsApp provider.
- Verify outreach launch permissions separately from outreach list/read permissions.
- Decide whether accountant should see inbox summary/conversations.
- Do one visual QA pass in Browser for mobile calendar, deals, clients, integrations and outreach after the next UI sprint.
