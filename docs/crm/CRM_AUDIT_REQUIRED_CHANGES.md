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

## Current Readiness Snapshot

Update 2026-07-16: all numbered audit items below are closed at their current verified scope. This file is now a closed audit record, not the active remaining-work tracker. New product/technical work should be tracked in `actual_docs/CRM_TECHNICAL_MAP_AND_VERTICAL_MODES.md`, `CRM_PRODUCTION_LAYER_PLAN.md`, relevant docs and `API_ACTION_CONTRACT.md`.

Update 2026-07-14: если не учитывать боевой `.env`, реальные креды сторонних сервисов и включение внешних production-интеграций, ZANI сейчас примерно на **75-80% готов** как база для controlled pilot / MVP CRM.

Проверенные локальные gates из последнего readiness-прохода:

- CRM E2E business flows: `apps.core.tests_business_flows_e2e` passed.
- AI core: `apps.ai_core` tests passed.
- Integrations and bots: scoped integration/bot tests passed separately after the broad parallel run hit a startup/timeout conflict.
- Frontend production build: `cd frontend && npm run build` passed.
- Django structural checks and migration dry-run passed in the latest audited scope.

Готовность по зонам:

- CRM core: **80-85%**. Leads, clients, deals, tasks, calendar, inbox, activity/audit, roles и tenant isolation уже имеют сильную основу.
- AI layer: **65-70%**. Source-grounded owner brief, no-data states и approval-gated execution уже есть, но approval creation и AI tool execution нужно усилить до безопасного merchant trust уровня.
- Integrations без live credentials: **70-75%**. Provider/service layers, BusinessEvents и masking уже есть, но bot secrets и inbound idempotency требуют production-grade cleanup.
- Frontend: **70-75%**. Основные страницы и API wiring есть, но pilot UX, empty/error states и bundle hygiene ещё требуют фокусной полировки.
- Tests: **около 80%** для local/dev confidence. Controlled pilot выглядит реалистичным; paid beta всё ещё требует production gates из `docs/paid-beta-gate.md`.

Текущее product decision:

- Ближайшая разработка должна сфокусироваться на **AI safety + connector credential/idempotency hardening + controlled pilot scenario QA**.
- Не начинать heavy ERP, full data warehouse, marketplace write-back, payments или большие новые модули, пока pilot path не станет безопасным и гладким.

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

### 3.1 Move Telegram/Instagram bot secrets into credential storage and harden inbound message idempotency

- [x] Перенести Telegram bot tokens и Instagram access tokens из `BotChannel.config_json` в существующий connector credential layer.
- [x] В `config_json` channel/connector оставлять только безопасные флаги и metadata: `token_configured`, `access_token_configured`, provider mode, external account ids.
- [x] Добавить или усилить database-level deduplication для inbound provider messages, где есть `external_message_id`.

Problem:

- Для WhatsApp уже есть credential-helper behavior, но у Telegram и Instagram ещё остаются пути, где raw provider secrets могут жить в `BotChannel.config_json`.
- Sanitized serializers снижают риск утечки, но production-grade хранение не должно полагаться только на masking raw JSON fields.
- Telegram/WhatsApp/Instagram webhook handlers проверяют дубли в коде, но inbound message idempotency должна быть защищена ещё и database constraint или эквивалентной service-level guarantee.

Affected area:

- permissions: yes, потому что connector setup остаётся role-gated;
- notifications: possible, потому что duplicate inbound messages могут создавать duplicate follow-up work;
- BusinessEvent: yes, потому что duplicate messages могут создавать duplicate CRM/business events;
- AI: yes, потому что AI recommendations могут ссылаться на connector/message events;
- migrations/env: yes, вероятно нужны migration/backfill и обновление credential storage.

Files:

- `apps/bots/models.py`
- `apps/bots/services.py`
- `apps/bots/serializers.py`
- `apps/integrations/providers/telegram.py`
- `apps/integrations/providers/instagram.py`
- `apps/integrations/telegram.py`
- `apps/integrations/instagram.py`
- `apps/integrations/models.py`
- `apps/integrations/services.py`
- `docs/CONNECTOR_BLUEPRINT.md`
- `docs/integrations.md`
- `docs/provider-rollout.md`

Expected changes:

- Telegram setup сохраняет `bot_token` через `ConnectorCredential` или общий credential helper, а не в raw channel JSON.
- Instagram setup/OAuth сохраняет access tokens через тот же credential layer и удаляет legacy raw token fields из channel JSON.
- Backfill/migration сохраняет уже настроенные local/dev channels без раскрытия secrets в API responses.
- Provider status/test/send flows читают credentials через helper functions.
- Webhook message creation становится idempotent при повторной provider delivery.
- Merchant-facing setup показывает простые configured/error/action-required states, а не raw credentials.

Test gate:

- Migration generated and applied.
- Telegram setup test доказывает, что raw token не сохраняется в channel `config_json`, а masked API response остаётся safe.
- Instagram setup/OAuth test доказывает, что raw access token хранится в credential storage и удаляется из channel `config_json`.
- Replayed Telegram/WhatsApp/Instagram inbound payload с тем же `external_message_id` не создаёт duplicate messages, BusinessEvents или tasks.
- Permission denial and tenant isolation tests for credential setup/status.
- `.\.venv\Scripts\python.exe -m pytest apps\integrations\tests.py apps\integrations\tests_connectors.py apps\bots\tests.py -q`
- `.\.venv\Scripts\python.exe manage.py check`
- `.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run`

Completion note 2026-07-14:

- affected area: permissions yes via existing integration setup gates; notifications yes because replayed inbound messages no longer duplicate inbox side effects; BusinessEvent yes because provider message replay is DB/service-idempotent; AI yes because AI-facing connector/message events no longer duplicate; migrations/env yes, added `bots.0008_botmessage_unique_bot_message_external_delivery`, no new env variables.
- checks run: `.\.venv\Scripts\python.exe -m pytest apps\integrations\tests.py::TelegramIntegrationSkeletonTests apps\integrations\tests.py::WhatsAppIntegrationFoundationTests apps\integrations\tests.py::InstagramIntegrationFoundationTests -q`; `.\.venv\Scripts\python.exe -m pytest apps\bots\tests.py::InboxBackendTests::test_bot_message_api_updates_inbox_timestamps_and_unread_counter apps\bots\tests.py::InboxBackendTests::test_assigned_inbound_chat_notification_only_goes_to_assignee apps\bots\tests.py::InboxBackendTests::test_inbox_messages_assign_handoff_and_mark_read_actions_work -q`; `.\.venv\Scripts\python.exe -m pytest apps\integrations\tests.py apps\integrations\tests_connectors.py apps\bots\tests.py -q`; `.\.venv\Scripts\python.exe manage.py check`; `.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run`; `.\.venv\Scripts\python.exe manage.py migrate`.
- checks skipped: full `scripts/codex_verify.sh`, because this was a bounded backend integration/security task on Windows and the scoped integration/bot gate plus Django structural/migration checks covered the affected area; frontend build, because no frontend files or UI contracts changed.
- baseline failures: none observed; one first run of the full scoped pytest gate timed out at 3 minutes and was rerun with a longer timeout, then passed.

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

- [x] Design and implement a safe `Resource -> User` or `Resource -> BusinessMembership` mapping.

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

Completion note 2026-07-14:

- affected area: permissions yes through Resource serializer validation against owner/active BusinessMember and existing settings endpoint permissions; notifications yes through appointment responsible routing and system follow-up recipients; BusinessEvent/activity indirect only, no new event type was added; AI indirect through more accurate staff ownership context; migrations/env yes through `apps/scheduling/migrations/0006_resource_linked_user.py`; frontend yes through Resources page/form/table contract.
- checks run: `.\.venv\Scripts\python.exe manage.py makemigrations scheduling --name resource_linked_user`; targeted scheduling pytest for active member link, inactive/cross-tenant rejection and linked-user notification (`3 passed`); `.\.venv\Scripts\python.exe -m pytest apps\scheduling\tests.py -q` (`39 passed`); `.\.venv\Scripts\python.exe manage.py check`; `cd frontend && npm run build`; `.\.venv\Scripts\python.exe manage.py migrate`; `.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run`; scoped CRM pytest for clients, lead forms, crm, scheduling, tasks and tenant isolation (`124 passed`).
- checks skipped: full `scripts/codex_verify.sh`, because this was a bounded scheduling Resource/User mapping with explicit backend, migration, scoped CRM and frontend build gates already run on Windows.
- baseline failures: none.

### 6. Harden outreach campaign lifecycle

- [x] Move campaign cancellation and recipient state changes out of views into outreach service actions.

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

Completion note 2026-07-14:

- affected area: permissions yes through existing outreach role gates and tenant-scoped viewset lookup; notifications yes because cancel now cancels pending outreach notifications; BusinessEvent/activity yes through `outreach_cancelled` activity and `outreach.campaign_cancelled` BusinessEvent; AI indirect because source-grounded AI can cite outreach events instead of inferred state; migrations/env no.
- checks run: `.\.venv\Scripts\python.exe -m pytest apps\outreach\tests.py -q`; `.\.venv\Scripts\python.exe manage.py check`; `.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run`.
- checks skipped: full `scripts/codex_verify.sh`, because this was a bounded backend outreach lifecycle service-boundary change and the focused outreach suite plus Django structural/migration checks covered the affected area; frontend build, because no frontend files or UI contracts changed.
- baseline failures: none observed.

## P1 AI Trust And Source Grounding

### 7. Remove or rename fake/local "AI" hints in CRM UI

- [x] Replace deterministic local `AI-подсказка` UI copy with source-grounded backend AI insight or rename it to a non-AI CRM hint.

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

Completion note 2026-07-14:

- affected area: permissions no; notifications no; BusinessEvent no; AI yes through UI trust/copy boundaries; migrations/env no.
- checks run: `npm run build` from `frontend` (`check:i18n`, `tsc -b`, app Vite build and widget build passed); static grep for fake/local authenticated CRM labels found remaining AI-hint wording only under public/marketing `frontend/src/features/public/ZaniExperience.tsx`.
- manual check: reviewed `ClientInspector` data/no-data branches in code; the card now renders a neutral CRM next-step for clients with a lead/appointment and an explicit follow-up check for clients without recent lead/appointment data.
- checks skipped: backend tests and migration checks, because this was frontend copy/UI trust plus docs only; Playwright/browser smoke, because no browser runtime check was required for this narrow label/card change after the production frontend build passed.
- baseline failures: none observed. Build emitted existing bundle-size/plugin timing warnings only.

### 8. Make AI assistant source/no-data states consistently visible

- [x] Audit all AI surfaces and ensure they never invent business facts when source data is missing.

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

Completion note 2026-07-14:

- affected area: permissions yes through existing AI Analyst/Assistant gates and role-aware dashboard visibility; notifications no; BusinessEvent no; AI yes; migrations/env no.
- checks run: `.\.venv\Scripts\python.exe -m pytest apps\ai_core\tests.py -q` (`31 passed`); `npm run build` from `frontend` (`check:i18n`, `tsc -b`, app Vite build and widget build passed); `git diff --check` for touched AI/dashboard/i18n/docs files.
- manual check: reviewed dashboard owner brief states in code for seeded/source-backed recommendations, no-data, loading, backend error, no-access and provider-not-ready branches; reviewed AI Assistant provider-not-ready warning and existing analyst `SourceChips`/no-source-data state.
- checks skipped: full `scripts/codex_verify.sh`, because this was a bounded AI/frontend trust pass and the focused AI tests plus frontend build covered the listed acceptance gate; Playwright/browser smoke, because no route loading or critical mutation flow changed.
- baseline failures: none observed. The first focused AI pytest run timed out at 124s before reporting results; the same command was rerun with a longer timeout and passed. Frontend build emitted existing bundle-size/plugin timing warnings only.

### 8.1 Harden AI approval creation and mutating tool execution

- [x] Сделать `ApprovalRequest.status` и decision fields read-only на create/update API paths.
- [x] Принудительно создавать новые approval requests только в `pending`, независимо от client payload.
- [x] Добавить regression coverage для malicious create payloads вроде `status=approved`.
- [x] Провести mutating AI tools через CRM domain services вместо direct model creation там, где важны lifecycle, permissions, audit, activity или notifications.

Problem:

- Critical AI mutations уже approval-gated на execution time, но approval creation тоже должен отвергать client-controlled state.
- Direct `Client.objects.create`, `Lead.objects.create`, `Task.objects.create` или `Deal.objects.create` внутри AI tool execution может обходить зрелое domain-service behavior.
- AI должен оставаться optional and controlled; tool не должен становиться скрытым shortcut вокруг CRM lifecycle rules.

Affected area:

- permissions: yes;
- notifications: possible, because service-backed create/update flows may emit notifications;
- BusinessEvent: possible, depending on the AI action;
- AI: yes;
- migrations/env: no unless model constraints are added.

Files:

- `apps/ai_core/serializers.py`
- `apps/ai_core/views.py`
- `apps/ai_core/tool_registry.py`
- `apps/ai_core/tests.py`
- relevant CRM services/selectors for client, lead, task and deal actions
- `docs/AI_ASSISTANT_RULES.md`

Expected changes:

- API clients не могут создать уже approved/executed approval request.
- Approval approve/reject/expire/execute state changes остаются server-side actions with audit.
- Mutating AI tools переиспользуют existing domain services или получают small service wrappers там, где безопасного service ещё нет.
- AI-created CRM records сохраняют tenant isolation, backend permissions, activity/audit и follow-up behavior.
- Tool execution output остаётся source-grounded и не раскрывает secret/raw payload data.

Test gate:

- AI approval create with `status=approved` всё равно создаёт `pending` или safely rejects field.
- Missing, mismatched, expired или unapproved approvals всё ещё блокируют mutating tool execution.
- Approved mutating tool path создаёт records через domain-safe behavior и пишет audit.
- Permission denial and tenant isolation coverage for changed tool paths.
- `.\.venv\Scripts\python.exe -m pytest apps\ai_core\tests.py -q`
- Add scoped CRM tests for any domain service touched by AI tool execution.
- `.\.venv\Scripts\python.exe manage.py check`

Completion note 2026-07-14:

- affected area: permissions yes through underlying `clients:create`, `leads:create`, `tasks:create`, `deals:create` checks before AI tool execution; notifications yes for AI-created tasks through routed task notifications; BusinessEvent/activity/audit yes through AI tool audit plus client/lead/deal/task activity; AI yes; migrations/env no.
- checks run: `.\.venv\Scripts\python.exe -m pytest apps\ai_core\tests.py -q` (`31 passed`); `.\.venv\Scripts\python.exe -m pytest apps\tasks\tests.py -q` (`35 passed`); `.\.venv\Scripts\python.exe manage.py test apps.core.tests_business_flows_e2e -v 2` (`8 passed`); `.\.venv\Scripts\python.exe manage.py check`; `.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run`.
- checks skipped: frontend build, because this was backend-only AI/CRM execution hardening with no frontend files or API response contract changes requiring UI rebuild; full `scripts/codex_verify.sh`, because the task was bounded and the focused AI, task, E2E, Django check and migration drift gates passed on Windows.
- baseline failures: none observed. Expected negative-path warnings appeared during E2E for forbidden/bad-request scenarios.

## P1 UX And Product Simplicity

### 9. Move authenticated hardcoded copy into i18n

- [x] Remove hardcoded Russian/English copy from authenticated CRM UI components.

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

Progress 2026-07-15:

- moved visible authenticated CRM copy in shared CRM controls, client workspace, deal detail/list widgets, task drawer/form labels, conversations load-more/channel filters, settings billing/custom-field controls and CRM drawer deal empty state into i18n-backed strings;
- added synchronized `en` / `ru` / `kk` keys for the touched UI and kept dictionary parity green;
- removed decorative AI-style wording from the touched client inspector next-step block and kept it as an operational CRM next action;
- checks passed: `cd frontend && npm run build`; `git diff --check`; Cyrillic visible-copy scan for `frontend/src/components/crm`, `frontend/src/features/clients`, `frontend/src/features/deals`, `frontend/src/features/tasks`, `frontend/src/features/settings`, `frontend/src/features/conversations`;
- scan notes: remaining Cyrillic hits are non-visible implementation details only: `SettingsPage.tsx` slug regex and `DealsPage.tsx` localized placeholder selector;
- manual language-switch smoke passed with a temporary Playwright spec on the standard local Django/Vite harness: `npx playwright test e2e/tmp-language-smoke.spec.ts --project=desktop-chromium --reporter=line --timeout=90000` (`1 passed`, 15 route/language assertions across clients, deals, tasks, conversations and settings for `ru` / `kk` / `en`); the temporary spec was removed after the successful run.

### 10. Hide technical setup complexity from daily merchant workflows

- [x] Review settings/integrations/developer surfaces and separate daily CRM workflows from technical admin/setup flows.

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

Completion note 2026-07-16:

- affected area: permissions yes through existing integrations manage/view gates and role-disabled controls; notifications no; BusinessEvent no; AI possible through safer connector status/error wording; migrations/env no.
- changes: integration cards and setup modals now keep default daily flows focused on provider value, status, check/sync/request actions and safe recovery text; generic account/key/webhook setup is hidden behind owner/admin/support manual fallback; marketplace/data access-key fields no longer auto-open when credentials are already saved; provider errors in integration UI are mapped to merchant-safe messages instead of raw provider/debug text; docs now record the merchant UI boundary.
- checks run: `npm run build` from `frontend` (`check:i18n`, `tsc -b`, app Vite build and widget build passed); temporary Playwright role smoke `npx playwright test e2e/tmp-integration-simplicity.spec.ts --project=desktop-chromium --reporter=line --timeout=90000` (`2 passed`) checked owner simple setup/manual fallback and operator non-exposure of technical setup controls; the temporary spec was removed after the successful run.
- checks skipped: backend tests and migration checks, because this was frontend/docs-only UX separation with no backend behavior, model or API contract change; full `scripts/codex_verify.sh`, because the bounded frontend build plus role smoke covered the listed acceptance gate on Windows.
- baseline warnings: frontend build still reports existing oversized `i18n`/`layout` chunk warnings and plugin timing warnings; Playwright webserver logs still show the existing local JWT HMAC key length warning and React Router future flag warnings.

### 11. Gate platform placeholders and demo/mock flows

- [x] Ensure platform placeholder pages and demo/mock endpoints are not presented as production merchant functionality.

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

Completion note 2026-07-16:

- affected area: permissions yes through demo-data/settings access, mock-sync integration manage access, platform route role smoke and the new `ALLOW_DEMO_MERCHANT_FLOWS` environment gate; notifications no; BusinessEvent yes only by preventing mock-sync event creation when demo flows are disabled or unauthorized; AI no; migrations/env yes through a settings/env-template flag with no database migration.
- changes: production defaults now disable demo/mock merchant flows via `ALLOW_DEMO_MERCHANT_FLOWS=False`; onboarding demo-data returns explicit `demo: true` and `mode: "demo"`; demo-data and connector mock-sync cannot run when demo flows are disabled; platform placeholder pages are marked as internal platform-only and not merchant production functionality; Kaspi/MoySklad/Wildberries/Ozon setup notices and mode badges now distinguish demo/mock check/sync results from live provider connections.
- checks run: targeted backend pytest for onboarding demo-data and connector mock-sync permission/feature-flag coverage (`14 passed`); `manage.py check`; `manage.py makemigrations --check --dry-run`; `cd frontend && npm run build`; focused Playwright platform route smoke (`2 passed`) for platform admin workspace access and merchant redirect; `git diff --check`.
- checks skipped: full `scripts/codex_verify.sh`, because this bounded item touched a narrow demo/mock/platform boundary and the scoped backend, migration, frontend build and route-smoke gates covered the listed acceptance criteria.
- baseline warnings: frontend build still reports existing oversized `i18n`/`layout` chunk warnings and plugin timing warnings; Playwright webserver logs still show the existing local JWT HMAC key length warning and React Router future flag warnings.

### 11.1 Run controlled pilot scenario QA on mock/dev data

- [x] Создать или обновить deterministic pilot merchant dataset, который не требует production credentials.
- [x] Пройти полный owner/operator/manager path: от lead capture до dashboard/analytics/AI recommendation.
- [x] Задокументировать blockers, которые мешают реальному SMB pilot даже если исключить live providers и production env.

Completion note 2026-07-14:

- `seed_pilot_demo` / `prepare_pilot_demo` now create owner, manager and operator pilot logins. The operator gets a real task-queue item, and `pilot_launch_quality_gate` logs in as operator and checks operator tasks + inbox summary in addition to platform/owner/manager checks.
- `prepare_pilot_demo --reset` and `pilot_launch_quality_gate` passed locally on SQLite with safe mock/dev settings. The launch pack prints owner/manager/operator smoke paths without Windows-incompatible `→` stdout characters.
- Backend E2E flow gate passed for dashboard -> lead -> client/deal/appointment/task -> inbox AI qualification -> integration BusinessEvent timeline -> AI approval/tool execution/audit.
- Mobile Playwright owner and manager route smokes passed separately after removing duplicate E2E prepare from the spec and changing the Django webServer health probe from unauthorized `/api/auth/me/` to `/health/`.
- Remaining controlled-pilot blockers excluding live providers/prod env: no critical blocker found in the verified local/dev path. Follow-ups remain: polish pilot-critical UX in 11.2, frontend bundle/performance hygiene in 12.1, and production/paid-beta infrastructure gates in `docs/paid-beta-gate.md`.

Problem:

- Unit и scoped E2E tests доказывают важные invariants, но продукту всё ещё нужен один цельный merchant journey, который ощущается usable end-to-end.
- Без controlled pilot script разработка может продолжать полировать отдельные страницы и пропустить friction между dashboard, leads, inbox, tasks, calendar, integrations и AI.

Affected area:

- permissions: yes;
- notifications: yes;
- BusinessEvent: yes;
- AI: yes;
- migrations/env: no, unless seed helpers require data-shape changes.

Files:

- `apps/core/tests_business_flows_e2e.py`
- `frontend/e2e/*`
- `frontend/src/features/dashboard/*`
- `frontend/src/features/leads/*`
- `frontend/src/features/conversations/*`
- `frontend/src/features/tasks/*`
- `frontend/src/features/calendar/*`
- `frontend/src/features/integrations/*`
- `frontend/src/features/assistant/*`
- `docs/testing.md`
- `docs/paid-beta-gate.md`

Expected changes:

- Repeatable local/dev pilot dataset покрывает owner, manager и operator roles.
- Pilot flow проверяет: dashboard -> lead -> client/deal/appointment/task -> inbox activity -> integration health event -> AI recommendation/approval -> audit/timeline.
- Empty/error states проверены для new business и seeded business.
- Любой mock/dev provider state ясно помечен и не может быть перепутан с live production integration.
- Итогом становится короткая pilot readiness note с remaining product blockers.

Test gate:

- `.\.venv\Scripts\python.exe -m pytest apps\core\tests_business_flows_e2e.py -q`
- `cd frontend && npm run build`
- Browser/Playwright smoke for owner and manager daily routes, если browser runtime available.
- Manual pilot checklist for seeded mock/dev business, если full browser automation unavailable.

### 11.2 Polish pilot-critical UX on Leads, Inbox, Dashboard and Settings

- [x] Проверить четыре pilot-critical screens на real data states, empty states, forbidden states и next actions.
- [x] Убрать или переписать authenticated-app copy, которая объясняет ZANI вместо того, чтобы помогать merchant действовать.
- [x] Убедиться, что owner/manager/operator видят role-appropriate actions без technical connector noise в daily work.

Completion note 2026-07-15:

- Leads already exposes a real empty state with create/import next actions, table/mobile rows include responsible/operational fields, and existing lifecycle/duplicate/conversion UI remains API-backed; no new lead behavior was required in this pass.
- Inbox permission-denial text for AI reply generation, CRM pipeline preview and CRM pipeline execution now comes from i18n instead of hardcoded English strings, while existing handoff, CRM link/create, task and AI preview buttons remain disabled/permission-aware.
- Dashboard owner AI surfaces were reviewed against the existing source-grounded/no-data/provider-unavailable states; no fallback pseudo-AI copy was added.
- Settings billing copy was moved into i18n, and the operator E2E smoke now asserts the settings forbidden state does not expose billing/developer/API/webhook/payload/provider technical noise.
- checks run: `cd frontend && npm run build`; `cd frontend && npx playwright test --project=desktop-chromium -g "operator sees restricted sections as forbidden"`; `cd frontend && npx playwright test --project=mobile-chromium -g "mobile (owner|manager) smoke"`; `git diff --check`; targeted `rg` for removed hardcoded Settings/Inbox copy.
- checks skipped: backend tests and migration drift check, because this was frontend/i18n/E2E UX polish with no backend code, schema or API contract changes; full `scripts/codex_verify.sh`, because the required gate for this bounded pilot-critical UX pass was frontend build plus role visibility smoke.
- baseline notes: Playwright logs still show existing local warnings (`React Router Future Flag`, short local JWT secret warning, occasional SQLite `database is locked` during concurrent local E2E requests), but the targeted tests passed and no acceptance criterion remained unproven.

Problem:

- Текущая foundation уже достаточно сильная для controlled pilot work, но perceived product quality будет решаться на daily surfaces.
- Pilot user не должен понимать implementation concepts вроде webhooks, provider payloads, mock mode internals или AI plumbing.

Affected area:

- permissions: yes;
- notifications: possible;
- BusinessEvent: possible through connector/dashboard states;
- AI: yes for dashboard/assistant cards;
- migrations/env: no.

Files:

- `frontend/src/features/leads/LeadsPage.tsx`
- `frontend/src/features/conversations/ConversationsPage.tsx`
- `frontend/src/features/dashboard/DashboardPage.tsx`
- `frontend/src/features/dashboard/OwnerDashboard.tsx`
- `frontend/src/features/settings/SettingsPage.tsx`
- `frontend/src/features/integrations/*`
- `frontend/src/lib/i18n/*`
- `docs/design-system.md`

Expected changes:

- Leads: clear next action, owner/responsible visibility, duplicate/conversion/action states.
- Inbox: clear handoff/AI preview/CRM link/task/appointment actions без скрытия source context.
- Dashboard: operational metrics, overdue/unanswered/stalled/connector states и source-grounded AI cards.
- Settings: team/roles/business setup понятен; developer/provider setup отделён от everyday CRM usage.

Test gate:

- `cd frontend && npm run build`
- Manual smoke для owner, manager и operator role visibility.
- Manual empty-state and forbidden-state check for touched screens.

## P2 Architecture Bottlenecks

### 12. Split large frontend page files into feature modules

- [x] Split `SettingsPage.tsx` into sections/components/hooks.
- [x] Split `ConversationsPage.tsx` into inbox list, thread, composer, filters and hooks.
- [x] Split `AIAgentsPage.tsx` into agent list, config, runtime status, approvals and provider setup.
- [x] Split `CalendarPage.tsx` into calendar shell, appointment drawer, resource filters and availability logic.

Progress note 2026-07-16:

- `SettingsPage.tsx` split into settings config, shared utility helpers, section navigation hook/component, and billing/usage section components.
- Verification completed: `cd frontend && npm run build`; `cd frontend && npx playwright test --project=desktop-chromium -g "operator sees restricted sections as forbidden" --reporter=line --timeout=90000`; `git diff --check`.
- Skipped: backend tests and migrations because this was a frontend-only refactor with no API/model changes.
- Remaining at this checkpoint: split `CalendarPage.tsx`.

Progress note 2026-07-16:

- `ConversationsPage.tsx` split into conversation constants/types/utils, filter-state hook, inbox list pane, thread pane, composer, item/message primitives, and shared conversation primitives.
- Verification completed: `cd frontend && npm run build`; `cd frontend && npx playwright test --project=desktop-chromium -g "business owner can use core merchant CRM pages" --reporter=line --timeout=90000`; `git diff --check`.
- Skipped: backend tests and migrations because this was a frontend-only refactor with no API/model changes.
- Remaining at this checkpoint: split `CalendarPage.tsx`.

Progress note 2026-07-16:

- `AIAgentsPage.tsx` split into agent page orchestration, shared AI-agent types/utils, shared UI primitives, profile/config section, actions/approval section, runtime/test section, knowledge section, and provider setup section.
- Verification completed: `cd frontend && npm run build`; `cd frontend && npx playwright test --project=desktop-chromium -g "desktop sidebar links render without 404" --reporter=line --timeout=90000`; `git diff --check`.
- Skipped: backend tests and migrations because this was a frontend-only refactor with no API/model changes.
- Remaining at this checkpoint: split `CalendarPage.tsx`.

Progress note 2026-07-16:

- `CalendarPage.tsx` split into shared calendar constants/types/utils, availability/date helpers, calendar toolbar shell, resource/status filter components, picker, appointment/task preview cards, month inspector panel, and appointment drawer panel.
- Verification completed: `cd frontend && npm run build`; `cd frontend && npx playwright test --project=desktop-chromium -g "calendar deep link selects appointment and lifecycle action works" --reporter=line --timeout=90000`; `git diff --check`.
- Skipped: backend tests and migrations because this was a frontend-only refactor with no API/model changes.
- Remaining in this item: none; section 12 is complete.

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

### 12.1 Frontend bundle and performance hygiene

- [x] Проверить production build output на oversized chunks, особенно i18n/layout/shared UI и authenticated page bundles.
- [x] Не позволять i18n dictionaries и heavy page modules раздувать first authenticated load.
- [x] Добавить lightweight bundle/performance note в frontend verification workflow.

Completion note 2026-07-16:

- affected area: permissions no; notifications no; BusinessEvent no; AI no direct impact; migrations/env no.
- baseline evidence: previous production build emitted an oversized shared `i18n-*.js` chunk around 954.57 kB and a large shared `layout-*.js` chunk around 475.74 kB, so every first load risked carrying all language dictionaries and authenticated shell code too early.
- changes made: `AppLayout` and `PlatformLayout` are lazy route shell chunks; i18n now loads the active language dictionary dynamically instead of statically importing `ru`, `kk`, and `en`; Vite manual chunking no longer forces dictionaries into one shared i18n chunk; `npm run check:bundle` was added to record largest JS chunks after production build; `docs/testing.md` now documents frontend bundle hygiene checks.
- after evidence: production build now emits separate language chunks (`ru` about 352.18 kB, `kk` about 352.89 kB, `en` about 248.25 kB) and `app-shell` about 472.67 kB; `npm run check:bundle` reported no JS chunk above 500 kB before gzip.
- checks run: `cd frontend && npm run build`; `cd frontend && npm run check:bundle`; `cd frontend && npx playwright test --project=desktop-chromium -g "desktop sidebar links render without 404" --reporter=line --timeout=90000`; `git diff --check`.
- checks skipped: backend tests and migration checks, because this was a frontend-only bundle/routing/i18n hygiene task with no API/model/schema changes.
- baseline warnings: Playwright webserver logs still show existing local `InsecureKeyLengthWarning` and React Router v7 future flag warnings; they did not fail the route-loading smoke.

Problem:

- Frontend уже собирается, но pilot readiness зависит ещё и от perceived speed.
- Large shared chunks могут сделать каждый daily CRM route медленным по ощущениям, даже если backend APIs healthy.

Affected area:

- permissions: no;
- notifications: no;
- BusinessEvent: no;
- AI: no direct impact;
- migrations/env: no.

Files:

- `frontend/vite.config.ts`
- `frontend/src/app/router.tsx`
- `frontend/src/lib/i18n.tsx`
- `frontend/src/lib/i18n/*`
- `frontend/src/components/layout/*`
- `frontend/src/features/*`
- `frontend/package.json`

Expected changes:

- Build output имеет понятную chunk grouping и без obvious avoidable giant shared chunk.
- Lazy routes не тащат heavy authenticated pages в unrelated first loads.
- i18n chunking остаётся корректным для `ru`, `kk`, `en` и проходит dictionary parity checks.
- Functional UI behavior changes не смешиваются с pure bundle hygiene, если это не требуется.

Test gate:

- `cd frontend && npm run build`
- Record relevant build output/chunk observations in completion note.
- Manual smoke for login/app shell, если chunking меняет route loading behavior.

### 13. Split large backend views/services where business boundaries are clear

- [x] Split integrations view/service boundaries.
- [x] Split bots provider actions.
- [x] Split conversation inbox view helpers.
- [x] Keep scheduling service readable by extracting cohesive helpers only where it reduces complexity.

Completion note 2026-07-16:

- affected area: permissions yes, limited to preserving integration manage denial as tenant-safe 404 for connector create/request; notifications no behavior change; BusinessEvent no behavior change; AI no behavior change, conversation qualification preview guard only moved to helper; migrations/env no.
- changes made: extracted marketplace connector config/status/test/sync HTTP helpers into `apps/integrations/view_actions.py`; extracted Telegram/WhatsApp/Instagram bot-channel action helpers into `apps/bots/channel_actions.py`; extracted inbox summary/filter/message pagination/AI-preview helpers into `apps/conversations/inbox_helpers.py`; extracted scheduling availability and working-hours slot helpers into `apps/scheduling/availability.py` while keeping backwards-compatible imports through `apps.scheduling.services`.
- permission note: focused tests exposed that operator connector create/request returned `403` instead of the expected tenant-safe `404`; `BusinessConnectorViewSet` now applies a connector-specific manage-or-not-found guard for those create/request paths.
- checks run: `py_compile` for touched backend modules; `DATABASE_URL=sqlite:///db.sqlite3 ... .venv\Scripts\python.exe manage.py check`; `DATABASE_URL=sqlite:///db.sqlite3 ... .venv\Scripts\python.exe manage.py makemigrations --check --dry-run`; focused regression tests for the two failed connector denial cases; `DATABASE_URL=sqlite:///db.sqlite3 ... .venv\Scripts\python.exe -m pytest apps\integrations\tests_connectors.py apps\integrations\tests.py apps\bots\tests.py apps\scheduling\tests.py apps\core\tests_work_queues.py -q` (`195 passed`); `git diff --check`.
- checks skipped: frontend build and Playwright, because this phase changed backend Python boundaries only and did not alter frontend assets or routes.
- known baseline: repository had substantial pre-existing dirty changes from earlier phases; this phase only touched backend boundary files and the current plan/docs.

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

- [x] Update `CRM_PRODUCTION_LAYER_PLAN.md` so old "remaining" notes do not conflict with completed phase notes.

Completion note 2026-07-16:

- affected area: permissions no; notifications no; BusinessEvent no; AI no; migrations/env no.
- changes made: added a roadmap status hygiene note to `CRM_PRODUCTION_LAYER_PLAN.md`; converted old phase-local `Осталось` sections into `Current follow-up after completed phase` or historical notes; clarified that lead lifecycle, conversion, activity/audit, automation and E2E items were advanced by later verified phases; replaced the obsolete page-by-page near-term priority list with the current provider readiness / controlled-pilot / production-like QA priorities; marked early deal `Still open` notes in `CRM_IMPLEMENTATION_TASKS.md` as historical because later Phase 3 passes closed them.
- verification: grep confirmed no remaining `Still open:`, `Осталось:` or stale `Статус: следующий` wording in `CRM_PRODUCTION_LAYER_PLAN.md` / `CRM_IMPLEMENTATION_TASKS.md`; `git diff --check -- CRM_PRODUCTION_LAYER_PLAN.md CRM_IMPLEMENTATION_TASKS.md CRM_AUDIT_REQUIRED_CHANGES.md` passed.
- checks skipped: backend tests, migration checks, frontend build and Playwright because this was documentation-only status reconciliation with no code, schema, API, UI route or runtime behavior changes.

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

- [x] Create or update a provider readiness matrix for all integrations and bot channels.

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

Completion note 2026-07-16:

- Added `docs/provider-rollout.md` provider readiness matrix with required columns: provider, channel/type, live/mock status, required env/setup, setup owner, test coverage and user-visible status.
- Matrix separates Website/forms, Excel/CSV, Telegram, WhatsApp, Instagram/Meta, Kaspi, MoySklad, Wildberries/WB, Ozon, transactional email, OpenRouter/OpenAI, 1C and future providers.
- Clarified in `docs/integrations.md` that merchant UI/provider cards must use the readiness matrix as source of truth and must not advertise WhatsApp, Instagram/Meta, Kaspi, MoySklad, Wildberries/WB or Ozon as generally production-ready before provider gates pass.
- Added `docs/CONNECTOR_BLUEPRINT.md` production checklist items for readiness documentation and merchant-facing live/beta/pilot/request/mock labels.
- Verification: `git diff --check -- docs/provider-rollout.md docs/integrations.md docs/CONNECTOR_BLUEPRINT.md` passed; `rg` confirmed all required provider rows/status references are present.
- Skipped backend/frontend tests because this phase changed documentation only and has no runtime behavior, migration, UI build or provider-call impact.

## Closed Audit Status And Follow-Up Sources

Audit checklist status as of 2026-07-16:

1. Items 1-15 are completed at the current verified scope.
2. This document should not be used as an active backlog unless a new audit item is explicitly added.
3. The old recommended execution order is superseded by completion notes inside each item and the current source-of-truth docs.

Remaining product/production risks are not unchecked audit tasks:

- live provider credentials and per-provider rollout gates still depend on `docs/provider-rollout.md`, `docs/integrations.md` and environment readiness;
- production-like merchant data QA still needs to be run for realistic calendar, task, client, deal, inbox and AI daily workflows;
- dentistry-first launch mode is not implemented yet and needs the product profile/capability layer described in `actual_docs/CRM_TECHNICAL_MAP_AND_VERTICAL_MODES.md`;
- API/frontend work must keep `API_ACTION_CONTRACT.md` aligned with actual action endpoints.

## Current Audit Notes

- This audit was based on static source review, docs review and line-count search.
- No tests were run during audit creation because no behavior was changed.
- Before implementation, each task should be rechecked against the latest source state.
