# CRM Audit Required Changes

Рабочий список изменений по итогам аудита CRM, AI, ботов и интеграций.

Документ создан как отдельный audit backlog. Он не заменяет `CRM_IMPLEMENTATION_TASKS.md`, но фиксирует найденные слабые места, bottlenecks и некорректные реализации, которые мешают довести Zani до удобной production CRM.

## Completion Rules

- Чекбокс можно менять на `[x]` только после реализации и прохождения указанного test gate.
- Для каждой закрытой задачи нужно указать:
  - affected area: permissions, notifications, BusinessEvent, AI, migrations/env;
  - checks run;
  - checks skipped and why;
  - baseline failures, если они есть.
- Для lifecycle-задач обязательно проверять happy path, permission denial и tenant isolation, если применимо.
- Если задача user-facing, она не считается завершенной без reachable UI/API flow.
- Если найден unrelated baseline failure, его нужно зафиксировать и не прятать в summary.

## P0/P1 Critical Product And Security Fixes

### 1. Align legacy AI route permissions with `/app` routes

- [x] Исправить legacy routes `/ai-assistant`, `/assistant`, `/ai`, `/ai-agents`, чтобы они использовали те же resources, что и новые `/app` routes.

Problem:

- Сейчас новые AI routes защищены `ai_assistant` и `ai_automation`, но legacy routes используют `conversations` и `integrations`.
- Это создает permission mismatch и может открыть AI-разделы пользователю не по той матрице доступа.

Affected area:

- permissions: yes;
- notifications: no;
- BusinessEvent: no;
- AI: yes;
- migrations/env: no.

Files:

- `frontend/src/app/router.tsx`
- `frontend/src/app/PermissionRoute.tsx`
- `docs/PERMISSION_MATRIX.md`

Expected changes:

- Legacy AI assistant routes должны редиректить в `/app/ai-assistant` или использовать `resource: "ai_assistant"`.
- Legacy AI agents routes должны редиректить в `/app/ai-agents` или использовать `resource: "ai_automation"`.
- Проверить, что sidebar/navigation и direct URL ведут себя одинаково.

Test gate:

- Frontend route/unit coverage or focused manual route check for users with and without `ai_assistant:view`.
- `cd frontend && npm run build`

Completion note 2026-07-14:

- affected area: permissions yes; AI yes; notifications no; BusinessEvent no; migrations/env no.
- checks run: static route check confirmed legacy `/ai-assistant`, `/ai`, `/assistant` use `ai_assistant` and `/ai-agents` uses `ai_automation`; `cd frontend && npm run build`.
- checks skipped: backend tests, because this is frontend route gating only and no backend/API behavior changed; Playwright route smoke, because the focused static route check plus production build covered the acceptance gate for this narrow change.
- baseline failures: none observed.

### 2. Move appointment reply handling into scheduling lifecycle services

- [x] Убрать прямое изменение `appointment.status` из notification delivery flow.

Problem:

- В `apps/notifications/delivery.py` клиентский reply может напрямую поставить appointment в `CONFIRMED` или `CANCELLED`.
- Это bypass-ит scheduling service, audit, cancellation reason, automation side effects, follow-up handling и terminal guards.

Affected area:

- permissions: indirect;
- notifications: yes;
- BusinessEvent: yes;
- AI: indirect;
- migrations/env: no.

Files:

- `apps/notifications/delivery.py`
- `apps/scheduling/services.py`
- `apps/activities/taxonomy.py`
- `apps/scheduling/tests.py` or related scheduling/notification tests

Expected changes:

- Confirmation/cancellation from client reply must call a scheduling service action.
- Cancellation from client reply must record source/channel metadata and an explicit system/client reason.
- Event type must use taxonomy-backed activity event constants.
- Follow-up reminders and automations must be cancelled or triggered consistently.
- Audit/activity timeline must show who/what caused the transition.

Test gate:

- Happy path: positive reply confirms appointment.
- Happy path: cancel reply cancels appointment and records reason/source metadata.
- Terminal guard: cancelled/completed/no-show appointment cannot be incorrectly transitioned.
- Activity/audit assertion for cancellation.
- Notification side effects assertion where applicable.
- Backend scoped tests for scheduling/notifications.

Completion note 2026-07-14:

- affected area: permissions indirect; notifications yes; BusinessEvent/activity yes; AI indirect; migrations/env no.
- checks run: `DATABASE_URL=sqlite:///db.sqlite3 .\.venv\Scripts\python.exe -m pytest apps\notifications\tests.py apps\scheduling\tests.py -q`; `DATABASE_URL=sqlite:///db.sqlite3 .\.venv\Scripts\python.exe manage.py check`.
- checks skipped: full `scripts/codex_verify.sh`, because this was a narrow backend CRM lifecycle fix and the required scoped scheduling/notification gate passed on Windows.
- baseline failures: none observed.

### 3. Refactor provider-specific integration actions out of viewsets

- [x] Вынести Kaspi, MoySklad, Wildberries, Ozon, WhatsApp, Instagram actions из `BusinessConnectorViewSet` в provider/service layer.
- [x] Вынести Telegram, WhatsApp, Instagram bot channel setup/test/status/sync из `BotChannelViewSet` в provider/service layer.

Problem:

- Provider-specific setup, test, health check and sync logic живет во views.
- Это нарушает connector blueprint и делает добавление новых провайдеров дорогим и рискованным.

Affected area:

- permissions: yes;
- notifications: possible;
- BusinessEvent: yes;
- AI: possible through failed connector recommendations;
- migrations/env: no.

Files:

- `apps/integrations/views.py`
- `apps/integrations/services.py`
- `apps/integrations/connectors.py`
- `apps/integrations/providers/*`
- `apps/bots/views.py`
- `apps/bots/services.py`
- `docs/CONNECTOR_BLUEPRINT.md`
- `docs/integrations.md`

Expected changes:

- Views should validate request, check permission, call provider/service, return response.
- Provider-specific behavior should be behind a registry or provider adapter.
- Test connection, status, sync and config flows should share response shape.
- Masked secrets must remain masked in serializers and logs.

Test gate:

- Existing integration tests pass.
- Add focused tests for at least one connector config/test/status path through the new provider service.
- Permission denial test for connector action.
- Tenant isolation test for connector action.

Completion note 2026-07-14:

- affected area: permissions yes; notifications no direct change; BusinessEvent yes through connector sync/event service boundaries; AI indirect through connector health/recommendation source data; migrations/env no.
- checks run: `.\.venv\Scripts\python.exe -m pytest apps\integrations\tests.py::TelegramIntegrationSkeletonTests -q`; `.\.venv\Scripts\python.exe -m pytest apps\integrations\tests.py apps\integrations\tests_connectors.py apps\bots\tests.py -q`; `.\.venv\Scripts\python.exe manage.py check`; `.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run`.
- checks skipped: full `scripts/codex_verify.sh`, because this was a bounded backend integrations refactor on Windows and the scoped integration/bot/API gate plus Django structural checks covered the task; frontend build, because no frontend files or UI contracts changed.
- baseline failures: none observed.

## P1 CRM Lifecycle And Business Logic Hardening

### 4. Normalize lead/deal/task lifecycle transitions through services

- [x] Audit direct assignments to lifecycle fields and move unsafe transitions into services/selectors/state-machine helpers.

Problem:

- Some flows still risk direct mutation of lifecycle fields such as `status`, `stage`, `completed_at`, `archived_at`, `responsible_user`, `assignee`.
- Direct mutation makes audit, permissions and side effects inconsistent.

Affected area:

- permissions: yes;
- notifications: yes;
- BusinessEvent: yes;
- AI: yes, because AI recommendations depend on reliable lifecycle state;
- migrations/env: no unless model constraints are added.

Files to audit:

- `apps/leads/*`
- `apps/deals/*`
- `apps/tasks/*`
- `apps/scheduling/*`
- `apps/conversations/*`
- `apps/outreach/*`

Expected changes:

- Critical CRM state changes go through domain services.
- Activity timeline and audit logs are written consistently.
- Lost lead/deal transitions require reason.
- Archive/restore paths are traceable.

Test gate:

- Happy path, permission denial and tenant isolation coverage for each changed lifecycle action.
- Relevant backend scoped tests.

Completion note 2026-07-14:

- affected area: permissions yes through existing lead/inbox API gates; notifications yes through lead responsible and appointment follow-up routing; BusinessEvent/activity/audit yes through lead lifecycle activity, audit and automation trigger; AI indirect through reliable source-grounded lead lifecycle state; migrations/env no.
- checks run: targeted lifecycle pytest for lead create-appointment, scheduling service create-appointment, inbox create-appointment and auto-booking invalid-transition paths (`9 passed`); `.\.venv\Scripts\python.exe -m pytest apps\leads\tests_crm_light.py apps\scheduling\tests.py apps\bots\tests.py -q` (`106 passed`); `.\.venv\Scripts\python.exe manage.py check`; `.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run`; equivalent AGENTS CRM scoped file-path pytest for clients, lead forms, crm, scheduling, tasks and tenant isolation (`121 passed`); `.\.venv\Scripts\python.exe -m pytest apps\core\tests_business_flows_e2e.py -q` (`8 passed`, JWT dev-secret warnings only).
- checks skipped: frontend build, because this is backend-only lifecycle/service/test work with no frontend files or API response shape changes; full `scripts/codex_verify.sh`, because this was a narrow backend CRM lifecycle pass on Windows and the focused/scoped Django gates above covered the changed behavior.
- baseline failures: none. The literal dotted-module AGENTS pytest command was not executable by current pytest (`file or directory not found: apps.clients.tests`), so the same scoped gate was rerun with real file paths and passed.

### 5. Add Resource to User mapping for scheduling staff ownership

- [ ] Design and implement a safe `Resource -> User` or `Resource -> BusinessMembership` mapping.

Problem:

- Appointment `Resource` can represent a real staff member, but currently direct responsible notifications cannot reliably target that staff user.
- This weakens scheduling UX for salons, clinics and service businesses.

Affected area:

- permissions: yes;
- notifications: yes;
- BusinessEvent: yes;
- AI: possible;
- migrations/env: yes.

Files:

- `apps/scheduling/models.py`
- `apps/scheduling/services.py`
- `apps/scheduling/serializers.py`
- `apps/scheduling/views.py`
- `docs/PERMISSION_MATRIX.md`
- `CRM_PRODUCTION_LAYER_PLAN.md`

Expected changes:

- Resource can optionally link to an active business member/user.
- Appointment notifications can target resource owner when available.
- Access must stay tenant-safe.
- UI/API should make assignment understandable without exposing technical internals.

Test gate:

- Migration generated and applied.
- Resource can link only to active member of same business.
- Appointment notification targets linked user.
- Cross-tenant assignment rejected.

### 6. Harden outreach campaign lifecycle

- [ ] Move campaign cancellation and recipient state changes out of views into outreach service actions.

Problem:

- Outreach campaign status/recipient status changes can be view-heavy and risk inconsistent audit/BusinessEvent behavior.

Affected area:

- permissions: yes;
- notifications: possible;
- BusinessEvent: yes;
- AI: possible;
- migrations/env: no.

Files:

- `apps/outreach/views.py`
- `apps/outreach/services.py`
- `apps/outreach/tests.py`

Expected changes:

- Campaign cancel/pause/resume lifecycle goes through service actions.
- Bulk recipient changes write consistent metadata/events.
- Permission checks remain backend-enforced.

Test gate:

- Campaign cancel happy path.
- Permission denial.
- Tenant isolation.
- BusinessEvent/activity assertion where applicable.

## P1 AI Trust And Source Grounding

### 7. Remove or rename fake/local "AI" hints in CRM UI

- [ ] Replace deterministic local `AI-подсказка` UI copy with source-grounded backend AI insight or rename it to a non-AI CRM hint.

Problem:

- Some UI labels imply AI insight while the text is produced by simple local conditions.
- This reduces user trust and violates the source-grounding direction.

Affected area:

- permissions: no;
- notifications: no;
- BusinessEvent: no;
- AI: yes;
- migrations/env: no.

Files:

- `frontend/src/features/clients/components/ClientInspector.tsx`
- `apps/ai_core/recommendations.py`
- `docs/AI_ASSISTANT_RULES.md`

Expected changes:

- If visible text says AI, it must come from source-grounded AI/backend recommendation data.
- If it is local deterministic guidance, label it as CRM hint or next step, not AI.
- Empty/no-data state must be explicit.

Test gate:

- Frontend build.
- Focused UI test or manual check for client with data and client without data.

### 8. Make AI assistant source/no-data states consistently visible

- [ ] Audit all AI surfaces and ensure they never invent business facts when source data is missing.

Problem:

- AI features are valuable only when grounded in real CRM data.
- Sparse businesses should see clear no-data/needs-data states, not generic confident advice.

Affected area:

- permissions: yes;
- notifications: no;
- BusinessEvent: no;
- AI: yes;
- migrations/env: no.

Files:

- `apps/ai_core/*`
- `frontend/src/features/assistant/*`
- `frontend/src/features/dashboard/*`
- `docs/AI_ASSISTANT_RULES.md`

Expected changes:

- Every AI card/recommendation exposes source entity IDs or a clear no-data state.
- Mutating AI actions stay approval-gated.
- Provider unavailable states are visible and not hidden behind generic text.

Test gate:

- Backend AI tests for source IDs/no-data.
- Frontend build.
- Manual UI check with empty business and seeded business.

## P1 UX And Product Simplicity

### 9. Move authenticated hardcoded copy into i18n

- [ ] Remove hardcoded Russian/English copy from authenticated CRM UI components.

Problem:

- Many authenticated pages/components contain visible Russian strings outside i18n.
- This breaks language consistency and makes product copy hard to maintain.

Affected area:

- permissions: no;
- notifications: no;
- BusinessEvent: no;
- AI: possible for AI copy;
- migrations/env: no.

Files to audit first:

- `frontend/src/components/crm/*`
- `frontend/src/features/clients/*`
- `frontend/src/features/deals/*`
- `frontend/src/features/tasks/*`
- `frontend/src/features/settings/SettingsPage.tsx`
- `frontend/src/features/conversations/ConversationsPage.tsx`
- `frontend/src/lib/i18n/en.ts`
- `frontend/src/lib/i18n/ru.ts`
- `frontend/src/lib/i18n/kk.ts`

Expected changes:

- All visible authenticated UI copy comes from i18n/constants or approved copy map.
- No decorative/explanatory SaaS copy inside authenticated app.
- Empty states contain real next action.

Test gate:

- `cd frontend && npm run build`
- Manual language switch smoke check for touched screens.

### 10. Hide technical setup complexity from daily merchant workflows

- [ ] Review settings/integrations/developer surfaces and separate daily CRM workflows from technical admin/setup flows.

Problem:

- SMB users should not feel they are working inside a connector developer console.
- Provider keys, webhook details, raw errors and mock statuses should not dominate daily CRM pages.

Affected area:

- permissions: yes;
- notifications: no;
- BusinessEvent: no;
- AI: possible through connector status recommendations;
- migrations/env: no.

Files:

- `frontend/src/features/settings/SettingsPage.tsx`
- `frontend/src/features/integrations/*`
- `frontend/src/features/assistant/AIAgentsPage.tsx`
- `docs/integrations.md`
- `docs/provider-rollout.md`

Expected changes:

- Daily views show simple connected/error/action-required states.
- Technical fields live in setup/admin/developer subflows.
- Provider errors are translated into user-actionable messages.
- Mock/demo modes are clearly labeled and gated.

Test gate:

- Frontend build.
- Manual check for owner/admin and regular staff permissions.

### 11. Gate platform placeholders and demo/mock flows

- [ ] Ensure platform placeholder pages and demo/mock endpoints are not presented as production merchant functionality.

Problem:

- Placeholder/demo copy can damage trust if a real merchant sees it in production context.

Affected area:

- permissions: yes;
- notifications: no;
- BusinessEvent: no;
- AI: no;
- migrations/env: possible if feature flags change.

Files:

- `frontend/src/features/platform/*`
- `frontend/src/lib/i18n/*`
- `apps/onboarding/*`
- `apps/integrations/*`

Expected changes:

- Platform placeholder routes are internal/admin/feature-flagged.
- Demo data creation is explicit and not confused with real merchant data.
- Mock connector actions are not shown as live integrations.

Test gate:

- Permission/feature flag checks.
- Frontend build.
- Backend tests for demo endpoint permissions if changed.

## P2 Architecture Bottlenecks

### 12. Split large frontend page files into feature modules

- [ ] Split `SettingsPage.tsx` into sections/components/hooks.
- [ ] Split `ConversationsPage.tsx` into inbox list, thread, composer, filters and hooks.
- [ ] Split `AIAgentsPage.tsx` into agent list, config, runtime status, approvals and provider setup.
- [ ] Split `CalendarPage.tsx` into calendar shell, appointment drawer, resource filters and availability logic.

Problem:

- Current page files are too large and slow down safe iteration.
- UI bugs become harder to isolate and test.

Affected area:

- permissions: possible;
- notifications: possible for conversations/calendar;
- BusinessEvent: no unless behavior changes;
- AI: yes for AI agents;
- migrations/env: no.

Expected changes:

- Pages become thin composition layers.
- Business API calls remain in `frontend/src/api/*`.
- Shared UI pieces stay reusable but not over-abstracted.

Test gate:

- `cd frontend && npm run build`
- Focused manual smoke check for each split page.

### 13. Split large backend views/services where business boundaries are clear

- [ ] Split integrations view/service boundaries.
- [ ] Split bots provider actions.
- [ ] Split conversation inbox view helpers.
- [ ] Keep scheduling service readable by extracting cohesive helpers only where it reduces complexity.

Problem:

- Large backend files concentrate too much behavior in one place.
- This increases regression risk during CRM lifecycle and integration work.

Affected area:

- permissions: yes;
- notifications: yes;
- BusinessEvent: yes;
- AI: possible;
- migrations/env: no unless model changes are included separately.

Expected changes:

- Views stay thin.
- Services/selectors own business logic.
- Provider code stays behind provider adapters.
- Tests cover the public API contracts, not private implementation details.

Test gate:

- Backend scoped tests for each touched app.
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check`

## P2 Documentation And Operational Clarity

### 14. Reconcile CRM roadmap/status docs with implemented behavior

- [ ] Update `CRM_PRODUCTION_LAYER_PLAN.md` so old "remaining" notes do not conflict with completed phase notes.

Problem:

- Some docs appear older than current implementation state.
- This creates planning noise and increases the risk of duplicate work.

Affected area:

- permissions: no;
- notifications: no;
- BusinessEvent: no;
- AI: no;
- migrations/env: no.

Files:

- `CRM_PRODUCTION_LAYER_PLAN.md`
- `CRM_IMPLEMENTATION_TASKS.md`
- relevant `docs/*`

Expected changes:

- Current state, remaining risks and next phases are clearly separated.
- Completed work references checks that actually ran.
- Known baseline failures stay visible.

Test gate:

- Documentation review only.

### 15. Document provider live/mock readiness matrix

- [ ] Create or update a provider readiness matrix for all integrations and bot channels.

Problem:

- The product has many provider surfaces, but readiness is not equally production-proven.
- Users and operators need to know what is live, mocked, feature-flagged, or needs setup.

Affected area:

- permissions: no;
- notifications: possible;
- BusinessEvent: possible;
- AI: possible through connector recommendations;
- migrations/env: no.

Files:

- `docs/provider-rollout.md`
- `docs/integrations.md`
- `docs/CONNECTOR_BLUEPRINT.md`

Expected changes:

- Matrix columns: provider, channel/type, live/mock status, required env, setup owner, test coverage, user-visible status.
- WhatsApp/Instagram/Kaspi/MoySklad/WB/Ozon must not be implied production-ready until verified.

Test gate:

- Documentation review only.

## Recommended Execution Order

1. Legacy AI route permission alignment.
2. Appointment reply lifecycle service fix.
3. Provider action service refactor for integrations and bots.
4. Source-grounded AI UI cleanup.
5. Authenticated i18n cleanup.
6. Resource to User mapping.
7. Technical setup UX simplification.
8. Large file split work.
9. Provider readiness docs.
10. CRM roadmap/status reconciliation.

## Current Audit Notes

- This audit was based on static source review, docs review and line-count search.
- No tests were run during audit creation because no behavior was changed.
- Before implementation, each task should be rechecked against the latest source state.
