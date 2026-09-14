# Аудит технической документации ZANI

Дата: 2026-09-14. База: `4ba3cbf9fddcc6e1baa172b494c781550c090693`.
Документационная ветка: `codex/backend-docs-audit-2026-09-14`.
Рабочая папка результата: `C:\Users\user\Desktop\Zani-backend-docs-audit`.

## Итог и критерий актуальности

Проинвентаризированы **105 tracked Markdown-файлов** в `docs/`, `actual_docs/`,
`plan/` на указанном HEAD. Это полный перечень этих трёх деревьев на базе,
а не заявление о построчном аудите всей frontend-документации или внешних файлов.
Backend/permissions/fallback/security/production источники сопоставлялись с кодом
и проверками; UI/reference документы оставлены профильному владельцу.

**26 документов перенесены в архив**: закрытые execution records и superseded
исторические планы/отчёты. По старым путям оставлены короткие указатели.
79 исходных документов сохранены вне этой новой архивной партии, включая
уже архивный UI-документ. Новые два аудита и архивный индекс не входят в 105.

Архивация означает прекращение использования старого текста как текущей
очереди, а не объявление всех его пожеланий реализованными. Результат пока
на отдельном worktree; основной dirty checkout не изменён этим аудитом.

Различаются:

- `CLOSED` / `CLOSED_HISTORICAL`: завершённый объём с историческими evidence.
- `HISTORICAL_DELIVERY`: отчёт о выполненном пакете; сохранены ограничения
  исходных проверок, новая полная сертификация не заявляется.
- `SUPERSEDED`: заменён новым источником; незакрытые желания не превращаются
  в автоматически разрешённые задачи.
- `ACTIVE_*`: действующее правило, очередь, gate или повторяемый runbook.
  Реализованная permission/credential policy должна остаться активной.
- `GENERATED`: производный инвентарь, не ручной backlog и не доказательство PASS.
- `REFERENCE_*`: продуктовый/архитектурный контекст, не разрешение писать код.

## Основные несогласованности и принятые действия

| Несогласованность | Почему опасно | Что сделано / что не закрыто |
| --- | --- | --- |
| actual_docs index: UX-3 next, FC-004/006 partial, 954 tests как последний gate | Повторная реализация уже закрытых фаз | Индекс reconciled: UX-3 DONE, FC-004/006 PASS, historical d4f7c8f 962; FC-003/008 остаются open |
| Master/handoff: ранние security findings и ownership blocker выглядят текущими | Повтор PP-SEC и BE-GAP-001 | Добавлен приоритетный dated checkpoint; старые оценки помечены historical |
| CRM checklist: 11 пустых DoD-чекбоксов при 232 выполненных пунктах | Ошибочная трактовка шаблона как невыполненных задач | Полное историческое тело архивировано; active domain plan сохранён |
| Майские readiness/competitive/PR plans повторяют automations, merge, entitlements, quotas | Дублирующие service layers и переписывание закрытого | Архив SUPERSEDED; остатки разделены на current gaps и deferred scope |
| BE-GAP-006 утверждал queue-backed integration sync | Redis может быть ошибочно принят за завершение реализации | Исправлено на PARTIAL / ENV_GATED: ручной sync/retry вызывают provider в request path |
| Telegram/WhatsApp/Instagram merchant docs описывали tokens в channel JSON | Устаревшая инструкция возвращает небезопасное хранение | Исправлено на encrypted ConnectorCredential + safe metadata; не новая credential реализация |
| privileged-mfa пропускал platform_manager | Неверный список обязательных MFA ролей | Приведено к текущему mfa.py; это не решение отдельного support-write policy |
| Production 10000 audit заявлял paid-beta suitability | Исторический текст принимается за текущую приемку | Уточнены candidate/env acceptance границы; paid gate не объявлен зелёным |
| Telegram MVP говорит next implementation block, хотя foundation уже есть | Второй connector/setup пакет | Архив SUPERSEDED; merchant/provider rollout runbooks остаются актуальными |
| Старый staging report закрывал свою майскую задачу | Старый deployed smoke принимается за готовность нынешнего окружения | Архив CLOSED_HISTORICAL; Redis/storage/backup/live gates остаются в BE-GAP-007 |
| Permission matrix vs support-note endpoint | Неясная допустимость platform_manager writes | BE-GAP-004 не разрешён автоматически; требуется policy decision |
| AI pause vs inbound и website 403 | Неясный жизненный цикл и несовпадение тестов | Зафиксировано в backend-аудите; WIP не исправлялся под видом документации |
| Документы UI-testing toolkit добавились параллельно в canonical | Новый источник может потеряться при copy/overwrite | Не копировался; при интеграции сохранить чужое добавление docs/README и toolkit docs |

## Что остаётся активным и почему

- `PRE_PILOT_CODE_READINESS_MASTER`: overall sequence ещё не завершена.
- `BACKEND_AUDIT_REMEDIATION_PLAN`: BE-REM-007 partial.
- `APP_FUNCTIONAL_CERTIFICATION` и dated report: FC-003/008 ещё открыты,
  несмотря на дату имени отчёта. Они не закрытые архивные документы.
- `UNIFIED_FALLBACK_EXPERIENCE_PLAN`: FB-008 и FB-009 не закрыты.
- `CRM_WORKSPACE_UX_REFORM`: UX-4 не закрыт.
- Permission, AI, automation, entitlement, API и provider contracts остаются
  правилами разработки даже после реализации.
- Production/storage/backup/monitoring runbooks повторно нужны при эксплуатации.
- `marketplace-inventory-write-plan`, lightweight roadmap, deals reference —
  отложенный контекст; их наличие не расширяет текущий controlled pilot.
- Канонический WIP `DEFECT_KNOWLEDGE_BASE`, API/frontend/integrations docs
  не перезаписывались содержимым документационного worktree.

## Архивный manifest

Полные тела сохранены под `archive_docs/2026-09-14/<original-path>`.
Добавлена только пометка архива; исторические строки и ограничения сохранены.
Старые относительные ссылки внутри исторического тела разрешаются от
исходного пути; новые redirect/index ссылки проверяются отдельно.

| Исходный путь | Классификация | Актуальный источник |
| --- | --- | --- |
| [docs/crm/CRM_IMPLEMENTATION_TASKS.md](../../archive_docs/2026-09-14/docs/crm/CRM_IMPLEMENTATION_TASKS.md) | `CLOSED` | [docs/crm/CRM_PRODUCTION_LAYER_PLAN.md](../crm/CRM_PRODUCTION_LAYER_PLAN.md) |
| [docs/crm/CRM_AUDIT_REQUIRED_CHANGES.md](../../archive_docs/2026-09-14/docs/crm/CRM_AUDIT_REQUIRED_CHANGES.md) | `CLOSED` | [docs/pilot/backend-open-logic-register.md](../pilot/backend-open-logic-register.md) |
| [docs/pilot/block5-unified-inbox.md](../../archive_docs/2026-09-14/docs/pilot/block5-unified-inbox.md) | `HISTORICAL_DELIVERY` | [docs/pilot/backend-open-logic-register.md](../pilot/backend-open-logic-register.md) |
| [docs/pilot/block7-mobile-owner-ux.md](../../archive_docs/2026-09-14/docs/pilot/block7-mobile-owner-ux.md) | `HISTORICAL_DELIVERY` | [docs/pilot/backend-open-logic-register.md](../pilot/backend-open-logic-register.md) |
| [docs/pilot/block8-pilot-smoke-demo.md](../../archive_docs/2026-09-14/docs/pilot/block8-pilot-smoke-demo.md) | `HISTORICAL_DELIVERY` | [docs/pilot/backend-open-logic-register.md](../pilot/backend-open-logic-register.md) |
| [docs/pilot/block9-data-import-pilot.md](../../archive_docs/2026-09-14/docs/pilot/block9-data-import-pilot.md) | `HISTORICAL_DELIVERY` | [docs/pilot/backend-open-logic-register.md](../pilot/backend-open-logic-register.md) |
| [docs/pilot/block10-clean-pilot-package.md](../../archive_docs/2026-09-14/docs/pilot/block10-clean-pilot-package.md) | `HISTORICAL_DELIVERY` | [docs/pilot/backend-open-logic-register.md](../pilot/backend-open-logic-register.md) |
| [docs/pilot/block11-pilot-smoke-cleanup.md](../../archive_docs/2026-09-14/docs/pilot/block11-pilot-smoke-cleanup.md) | `HISTORICAL_DELIVERY` | [docs/pilot/backend-open-logic-register.md](../pilot/backend-open-logic-register.md) |
| [docs/pilot/block12-platform-operations-panel.md](../../archive_docs/2026-09-14/docs/pilot/block12-platform-operations-panel.md) | `HISTORICAL_DELIVERY` | [docs/pilot/backend-open-logic-register.md](../pilot/backend-open-logic-register.md) |
| [docs/pilot/block13-support-operator-workflow.md](../../archive_docs/2026-09-14/docs/pilot/block13-support-operator-workflow.md) | `HISTORICAL_DELIVERY` | [docs/pilot/backend-open-logic-register.md](../pilot/backend-open-logic-register.md) |
| [docs/pilot/block14-pilot-demo-launch.md](../../archive_docs/2026-09-14/docs/pilot/block14-pilot-demo-launch.md) | `HISTORICAL_DELIVERY` | [docs/pilot/backend-open-logic-register.md](../pilot/backend-open-logic-register.md) |
| [docs/pilot/task3_task_calendar_flow_polish.md](../../archive_docs/2026-09-14/docs/pilot/task3_task_calendar_flow_polish.md) | `HISTORICAL_DELIVERY` | [actual_docs/APP_FUNCTIONAL_CERTIFICATION.md](../../actual_docs/APP_FUNCTIONAL_CERTIFICATION.md) |
| [docs/pilot/task5_pilot_qa_polish_report.md](../../archive_docs/2026-09-14/docs/pilot/task5_pilot_qa_polish_report.md) | `HISTORICAL_DELIVERY` | [actual_docs/APP_FUNCTIONAL_CERTIFICATION.md](../../actual_docs/APP_FUNCTIONAL_CERTIFICATION.md) |
| [docs/pilot/task6_pilot_readiness_checklist_report.md](../../archive_docs/2026-09-14/docs/pilot/task6_pilot_readiness_checklist_report.md) | `HISTORICAL_DELIVERY` | [actual_docs/APP_FUNCTIONAL_CERTIFICATION.md](../../actual_docs/APP_FUNCTIONAL_CERTIFICATION.md) |
| [docs/pilot/task7_website_chat_connector_foundation_report.md](../../archive_docs/2026-09-14/docs/pilot/task7_website_chat_connector_foundation_report.md) | `HISTORICAL_DELIVERY` | [actual_docs/APP_FUNCTIONAL_CERTIFICATION.md](../../actual_docs/APP_FUNCTIONAL_CERTIFICATION.md) |
| [docs/pilot/task8_inbox_polish_report.md](../../archive_docs/2026-09-14/docs/pilot/task8_inbox_polish_report.md) | `HISTORICAL_DELIVERY` | [actual_docs/APP_FUNCTIONAL_CERTIFICATION.md](../../actual_docs/APP_FUNCTIONAL_CERTIFICATION.md) |
| [docs/pilot/task9_integrations_status_polish_report.md](../../archive_docs/2026-09-14/docs/pilot/task9_integrations_status_polish_report.md) | `HISTORICAL_DELIVERY` | [actual_docs/APP_FUNCTIONAL_CERTIFICATION.md](../../actual_docs/APP_FUNCTIONAL_CERTIFICATION.md) |
| [docs/testing/regression-report.md](../../archive_docs/2026-09-14/docs/testing/regression-report.md) | `CLOSED_HISTORICAL` | [docs/testing/testing.md](../testing/testing.md) |
| [plan/readiness_plan.md](../../archive_docs/2026-09-14/plan/readiness_plan.md) | `SUPERSEDED` | [docs/pilot/backend-open-logic-register.md](../pilot/backend-open-logic-register.md) |
| [plan/commit_pr_split_plan_2026_06_08.md](../../archive_docs/2026-09-14/plan/commit_pr_split_plan_2026_06_08.md) | `SUPERSEDED` | [actual_docs/PROJECT_HANDOFF.md](../../actual_docs/PROJECT_HANDOFF.md) |
| [plan/stabilization_audit_2026_06_08.md](../../archive_docs/2026-09-14/plan/stabilization_audit_2026_06_08.md) | `SUPERSEDED` | [actual_docs/PRE_PILOT_CODE_READINESS_MASTER.md](../../actual_docs/PRE_PILOT_CODE_READINESS_MASTER.md) |
| [plan/production_qa_2026_06_09.md](../../archive_docs/2026-09-14/plan/production_qa_2026_06_09.md) | `CLOSED_HISTORICAL` | [actual_docs/APP_FUNCTIONAL_CERTIFICATION.md](../../actual_docs/APP_FUNCTIONAL_CERTIFICATION.md) |
| [docs/production/staging/staging-render-execution-report.md](../../archive_docs/2026-09-14/docs/production/staging/staging-render-execution-report.md) | `CLOSED_HISTORICAL` | [docs/production/staging/staging-smoke-runbook.md](../production/staging/staging-smoke-runbook.md) |
| [docs/product/competitive-regression-report.md](../../archive_docs/2026-09-14/docs/product/competitive-regression-report.md) | `SUPERSEDED` | [docs/pilot/backend-open-logic-register.md](../pilot/backend-open-logic-register.md) |
| [docs/integrations/providers/telegram-connector-mvp.md](../../archive_docs/2026-09-14/docs/integrations/providers/telegram-connector-mvp.md) | `SUPERSEDED` | [docs/integrations/providers/telegram-merchant-connector.md](../integrations/providers/telegram-merchant-connector.md) |
| [docs/frontend/ui-ux-polish-phase-10.md](../../archive_docs/2026-09-14/docs/frontend/ui-ux-polish-phase-10.md) | `HISTORICAL_DELIVERY` | [actual_docs/CRM_WORKSPACE_UX_REFORM.md](../../actual_docs/CRM_WORKSPACE_UX_REFORM.md) |

## Полный инвентарь исходных 105 документов

В колонке «Документ» архивные позиции ведут на сохранённое тело, а не на stub.
Статус не является checkbox разрешения на реализацию.

| Документ | Статус | Назначение / граница |
| --- | --- | --- |
| [actual_docs/APP_FUNCTIONAL_CERTIFICATION.md](../../actual_docs/APP_FUNCTIONAL_CERTIFICATION.md) | `ACTIVE_PARTIAL` | FC-003/008 открыты; FC-004/006 PASS на историческом candidate. |
| [actual_docs/APP_FUNCTIONAL_CERTIFICATION_REPORT_2026-08-20.md](../../actual_docs/APP_FUNCTIONAL_CERTIFICATION_REPORT_2026-08-20.md) | `ACTIVE_PARTIAL` | FC-003/008 открыты; FC-004/006 PASS на историческом candidate. |
| [actual_docs/BACKEND_AUDIT_REMEDIATION_PLAN.md](../../actual_docs/BACKEND_AUDIT_REMEDIATION_PLAN.md) | `ACTIVE_PARTIAL` | BE-REM-001…006 DONE, BE-REM-007 PARTIAL; не архивировать целиком. |
| [actual_docs/CRM_WORKSPACE_UX_REFORM.md](../../actual_docs/CRM_WORKSPACE_UX_REFORM.md) | `ACTIVE_PARTIAL` | UX-3 DONE; UX-4 не закрыт; сохранять текущий UX contract. |
| [actual_docs/DEFECT_KNOWLEDGE_BASE.md](../../actual_docs/DEFECT_KNOWLEDGE_BASE.md) | `ACTIVE_EVIDENCE` | Обязательные precedents; canonical WIP ZD-012/013 отсутствует в чистом HEAD worktree. |
| [actual_docs/PRE_PILOT_CODE_READINESS_MASTER.md](../../actual_docs/PRE_PILOT_CODE_READINESS_MASTER.md) | `ACTIVE_SEQUENCE` | Владеет pre-pilot sequence; старые проценты/SEC findings не новая очередь. |
| [actual_docs/PROJECT_HANDOFF.md](../../actual_docs/PROJECT_HANDOFF.md) | `ACTIVE_HANDOFF` | Идентичность/guardrails; старые SHA и статусы только historical. |
| [actual_docs/README.md](../../actual_docs/README.md) | `INDEX` | Навигация, не отдельная очередь задач. |
| [actual_docs/UNIFIED_FALLBACK_EXPERIENCE_PLAN.md](../../actual_docs/UNIFIED_FALLBACK_EXPERIENCE_PLAN.md) | `ACTIVE_PARTIAL` | FB-008 live и FB-009 manual evidence остаются открытыми. |
| [actual_docs/UNIFIED_FALLBACK_INVENTORY.generated.md](../../actual_docs/UNIFIED_FALLBACK_INVENTORY.generated.md) | `GENERATED` | Только регенерация после фиксации исходников; не hand-edit и не PASS proof. |
| [docs/README.md](../README.md) | `INDEX` | Навигация, не отдельная очередь задач. |
| [docs/WARM_PREMIUM_CRM_REDESIGN_BRIEF.md](../WARM_PREMIUM_CRM_REDESIGN_BRIEF.md) | `REFERENCE_UI` | Оставлен для UI-владельца; не backend backlog. Полная UI-certification вне этого аудита. |
| [docs/ai/AI_ASSISTANT_RULES.md](../ai/AI_ASSISTANT_RULES.md) | `ACTIVE_REFERENCE` | Предметный контракт/граница продукта; реализованные части не архивируются как правила. |
| [docs/analytics/analytics-reporting.md](../analytics/analytics-reporting.md) | `ACTIVE_REFERENCE` | Предметный контракт/граница продукта; реализованные части не архивируются как правила. |
| [docs/api/API_ACTION_CONTRACT.md](../api/API_ACTION_CONTRACT.md) | `ACTIVE_REFERENCE` | Предметный контракт/граница продукта; реализованные части не архивируются как правила. |
| [docs/architecture/realtime-strategy.md](../architecture/realtime-strategy.md) | `ACTIVE_REFERENCE` | Предметный контракт/граница продукта; реализованные части не архивируются как правила. |
| [docs/auth/social-auth.md](../auth/social-auth.md) | `ACTIVE_REFERENCE` | Предметный контракт/граница продукта; реализованные части не архивируются как правила. |
| [docs/automation/automation-runtime.md](../automation/automation-runtime.md) | `ACTIVE_REFERENCE` | Предметный контракт/граница продукта; реализованные части не архивируются как правила. |
| [docs/billing/entitlements.md](../billing/entitlements.md) | `ACTIVE_REFERENCE` | Предметный контракт/граница продукта; реализованные части не архивируются как правила. |
| [docs/crm/CRM_AUDIT_REQUIRED_CHANGES.md](../../archive_docs/2026-09-14/docs/crm/CRM_AUDIT_REQUIRED_CHANGES.md) | `CLOSED` | Архив; замена: `docs/pilot/backend-open-logic-register.md` |
| [docs/crm/CRM_IMPLEMENTATION_TASKS.md](../../archive_docs/2026-09-14/docs/crm/CRM_IMPLEMENTATION_TASKS.md) | `CLOSED` | Архив; замена: `docs/crm/CRM_PRODUCTION_LAYER_PLAN.md` |
| [docs/crm/CRM_PRODUCTION_LAYER_PLAN.md](../crm/CRM_PRODUCTION_LAYER_PLAN.md) | `ACTIVE_CONTRACT` | CRM strategy/invariants; завершённые checkpoints — evidence, не повторный backlog. |
| [docs/data-exports.md](../data-exports.md) | `ACTIVE_REFERENCE` | Предметный контракт/граница продукта; реализованные части не архивируются как правила. |
| [docs/frontend/archive/APP_UI_UX_REDESIGN_TASK.md](../frontend/archive/APP_UI_UX_REDESIGN_TASK.md) | `ALREADY_ARCHIVED` | Уже historical; не перемещать повторно и не открывать как новую задачу. |
| [docs/frontend/design-system.md](../frontend/design-system.md) | `REFERENCE_UI` | Оставлен для UI-владельца; не backend backlog. Полная UI-certification вне этого аудита. |
| [docs/frontend/product-ui-reform.md](../frontend/product-ui-reform.md) | `REFERENCE_UI` | Оставлен для UI-владельца; не backend backlog. Полная UI-certification вне этого аудита. |
| [docs/frontend/ui-ux-implementation-standard.md](../frontend/ui-ux-implementation-standard.md) | `REFERENCE_UI` | Оставлен для UI-владельца; не backend backlog. Полная UI-certification вне этого аудита. |
| [docs/frontend/ui-ux-polish-phase-10.md](../../archive_docs/2026-09-14/docs/frontend/ui-ux-polish-phase-10.md) | `HISTORICAL_DELIVERY` | Архив; замена: `actual_docs/CRM_WORKSPACE_UX_REFORM.md` |
| [docs/integrations/CONNECTOR_BLUEPRINT.md](../integrations/CONNECTOR_BLUEPRINT.md) | `ACTIVE_CONTRACT_RUNBOOK` | Текущий provider/import contract; live availability отдельно в provider-rollout; WIP учитывать при интеграции. |
| [docs/integrations/README.md](../integrations/README.md) | `INDEX` | Навигация, не отдельная очередь задач. |
| [docs/integrations/communication-onboarding.md](../integrations/communication-onboarding.md) | `ACTIVE_CONTRACT_RUNBOOK` | Текущий provider/import contract; live availability отдельно в provider-rollout; WIP учитывать при интеграции. |
| [docs/integrations/connector-credential-key-rotation.md](../integrations/connector-credential-key-rotation.md) | `ACTIVE_CONTRACT_RUNBOOK` | Текущий provider/import contract; live availability отдельно в provider-rollout; WIP учитывать при интеграции. |
| [docs/integrations/imports/data-imports.md](../integrations/imports/data-imports.md) | `ACTIVE_CONTRACT_RUNBOOK` | Текущий provider/import contract; live availability отдельно в provider-rollout; WIP учитывать при интеграции. |
| [docs/integrations/imports/excel-csv-real-import-mvp.md](../integrations/imports/excel-csv-real-import-mvp.md) | `ACTIVE_CONTRACT_RUNBOOK` | Текущий provider/import contract; live availability отдельно в provider-rollout; WIP учитывать при интеграции. |
| [docs/integrations/integrations.md](../integrations/integrations.md) | `ACTIVE_CONTRACT_RUNBOOK` | Текущий provider/import contract; live availability отдельно в provider-rollout; WIP учитывать при интеграции. |
| [docs/integrations/lightweight-integrations-roadmap.md](../integrations/lightweight-integrations-roadmap.md) | `REFERENCE_DEFERRED` | Не auto-authorized pilot backlog; применимы ограничения BE-GAP-009/010/012 и canonical CRM. |
| [docs/integrations/live-connector-test-runbook.md](../integrations/live-connector-test-runbook.md) | `ACTIVE_CONTRACT_RUNBOOK` | Текущий provider/import contract; live availability отдельно в provider-rollout; WIP учитывать при интеграции. |
| [docs/integrations/marketplace-integrations.md](../integrations/marketplace-integrations.md) | `ACTIVE_CONTRACT_RUNBOOK` | Текущий provider/import contract; live availability отдельно в provider-rollout; WIP учитывать при интеграции. |
| [docs/integrations/marketplace-inventory-write-plan.md](../integrations/marketplace-inventory-write-plan.md) | `REFERENCE_DEFERRED` | Не auto-authorized pilot backlog; применимы ограничения BE-GAP-009/010/012 и canonical CRM. |
| [docs/integrations/marketplace-onboarding-runbook.md](../integrations/marketplace-onboarding-runbook.md) | `ACTIVE_CONTRACT_RUNBOOK` | Текущий provider/import contract; live availability отдельно в provider-rollout; WIP учитывать при интеграции. |
| [docs/integrations/marketplaces/kaspi-merchant-connector.md](../integrations/marketplaces/kaspi-merchant-connector.md) | `ACTIVE_CONTRACT_RUNBOOK` | Текущий provider/import contract; live availability отдельно в provider-rollout; WIP учитывать при интеграции. |
| [docs/integrations/marketplaces/kaspi-pricing-agent.md](../integrations/marketplaces/kaspi-pricing-agent.md) | `ACTIVE_CONTRACT_RUNBOOK` | Текущий provider/import contract; live availability отдельно в provider-rollout; WIP учитывать при интеграции. |
| [docs/integrations/marketplaces/moysklad-merchant-connector.md](../integrations/marketplaces/moysklad-merchant-connector.md) | `ACTIVE_CONTRACT_RUNBOOK` | Текущий provider/import contract; live availability отдельно в provider-rollout; WIP учитывать при интеграции. |
| [docs/integrations/marketplaces/ozon-merchant-connector.md](../integrations/marketplaces/ozon-merchant-connector.md) | `ACTIVE_CONTRACT_RUNBOOK` | Текущий provider/import contract; live availability отдельно в provider-rollout; WIP учитывать при интеграции. |
| [docs/integrations/marketplaces/wildberries-merchant-connector.md](../integrations/marketplaces/wildberries-merchant-connector.md) | `ACTIVE_CONTRACT_RUNBOOK` | Текущий provider/import contract; live availability отдельно в provider-rollout; WIP учитывать при интеграции. |
| [docs/integrations/provider-rollout.md](../integrations/provider-rollout.md) | `ACTIVE_CONTRACT_RUNBOOK` | Текущий provider/import contract; live availability отдельно в provider-rollout; WIP учитывать при интеграции. |
| [docs/integrations/providers/instagram-merchant-connector.md](../integrations/providers/instagram-merchant-connector.md) | `ACTIVE_CONTRACT_RUNBOOK` | Текущий provider/import contract; live availability отдельно в provider-rollout; WIP учитывать при интеграции. |
| [docs/integrations/providers/telegram-connector-mvp.md](../../archive_docs/2026-09-14/docs/integrations/providers/telegram-connector-mvp.md) | `SUPERSEDED` | Архив; замена: `docs/integrations/providers/telegram-merchant-connector.md` |
| [docs/integrations/providers/telegram-merchant-connector.md](../integrations/providers/telegram-merchant-connector.md) | `ACTIVE_CONTRACT_RUNBOOK` | Текущий provider/import contract; live availability отдельно в provider-rollout; WIP учитывать при интеграции. |
| [docs/integrations/providers/transactional-email.md](../integrations/providers/transactional-email.md) | `ACTIVE_CONTRACT_RUNBOOK` | Текущий provider/import contract; live availability отдельно в provider-rollout; WIP учитывать при интеграции. |
| [docs/integrations/providers/whatsapp-merchant-connector.md](../integrations/providers/whatsapp-merchant-connector.md) | `ACTIVE_CONTRACT_RUNBOOK` | Текущий provider/import contract; live availability отдельно в provider-rollout; WIP учитывать при интеграции. |
| [docs/integrations/providers/widget-sdk.md](../integrations/providers/widget-sdk.md) | `ACTIVE_CONTRACT_RUNBOOK` | Текущий provider/import contract; live availability отдельно в provider-rollout; WIP учитывать при интеграции. |
| [docs/integrations/public-lead-capture.md](../integrations/public-lead-capture.md) | `ACTIVE_CONTRACT_RUNBOOK` | Текущий provider/import contract; live availability отдельно в provider-rollout; WIP учитывать при интеграции. |
| [docs/operations/internal-dev-tools-boundary.md](internal-dev-tools-boundary.md) | `ACTIVE_REFERENCE` | Предметный контракт/граница продукта; реализованные части не архивируются как правила. |
| [docs/operations/platform-operations-health.md](platform-operations-health.md) | `ACTIVE_REFERENCE` | Предметный контракт/граница продукта; реализованные части не архивируются как правила. |
| [docs/pilot/backend-open-logic-register.md](../pilot/backend-open-logic-register.md) | `ACTIVE_BACKLOG` | Единая очередь backend gaps; BE-GAP-006 PARTIAL/ENV_GATED. |
| [docs/pilot/block10-clean-pilot-package.md](../../archive_docs/2026-09-14/docs/pilot/block10-clean-pilot-package.md) | `HISTORICAL_DELIVERY` | Архив; замена: `docs/pilot/backend-open-logic-register.md` |
| [docs/pilot/block11-pilot-smoke-cleanup.md](../../archive_docs/2026-09-14/docs/pilot/block11-pilot-smoke-cleanup.md) | `HISTORICAL_DELIVERY` | Архив; замена: `docs/pilot/backend-open-logic-register.md` |
| [docs/pilot/block12-platform-operations-panel.md](../../archive_docs/2026-09-14/docs/pilot/block12-platform-operations-panel.md) | `HISTORICAL_DELIVERY` | Архив; замена: `docs/pilot/backend-open-logic-register.md` |
| [docs/pilot/block13-support-operator-workflow.md](../../archive_docs/2026-09-14/docs/pilot/block13-support-operator-workflow.md) | `HISTORICAL_DELIVERY` | Архив; замена: `docs/pilot/backend-open-logic-register.md` |
| [docs/pilot/block14-pilot-demo-launch.md](../../archive_docs/2026-09-14/docs/pilot/block14-pilot-demo-launch.md) | `HISTORICAL_DELIVERY` | Архив; замена: `docs/pilot/backend-open-logic-register.md` |
| [docs/pilot/block5-unified-inbox.md](../../archive_docs/2026-09-14/docs/pilot/block5-unified-inbox.md) | `HISTORICAL_DELIVERY` | Архив; замена: `docs/pilot/backend-open-logic-register.md` |
| [docs/pilot/block7-mobile-owner-ux.md](../../archive_docs/2026-09-14/docs/pilot/block7-mobile-owner-ux.md) | `HISTORICAL_DELIVERY` | Архив; замена: `docs/pilot/backend-open-logic-register.md` |
| [docs/pilot/block8-pilot-smoke-demo.md](../../archive_docs/2026-09-14/docs/pilot/block8-pilot-smoke-demo.md) | `HISTORICAL_DELIVERY` | Архив; замена: `docs/pilot/backend-open-logic-register.md` |
| [docs/pilot/block9-data-import-pilot.md](../../archive_docs/2026-09-14/docs/pilot/block9-data-import-pilot.md) | `HISTORICAL_DELIVERY` | Архив; замена: `docs/pilot/backend-open-logic-register.md` |
| [docs/pilot/pilot-production-qa-checklist.md](../pilot/pilot-production-qa-checklist.md) | `ACTIVE_REUSABLE_CHECKLIST` | Перед каждым deploy; исторические команды использовать лишь в безопасной test DB. |
| [docs/pilot/pilot-safe-promises.md](../pilot/pilot-safe-promises.md) | `ACTIVE_PRODUCT_BOUNDARY` | Ограничения обещаний сохраняются; проверять актуальные capabilities/provider rollout. |
| [docs/pilot/task3_task_calendar_flow_polish.md](../../archive_docs/2026-09-14/docs/pilot/task3_task_calendar_flow_polish.md) | `HISTORICAL_DELIVERY` | Архив; замена: `actual_docs/APP_FUNCTIONAL_CERTIFICATION.md` |
| [docs/pilot/task5_pilot_qa_polish_report.md](../../archive_docs/2026-09-14/docs/pilot/task5_pilot_qa_polish_report.md) | `HISTORICAL_DELIVERY` | Архив; замена: `actual_docs/APP_FUNCTIONAL_CERTIFICATION.md` |
| [docs/pilot/task6_pilot_readiness_checklist_report.md](../../archive_docs/2026-09-14/docs/pilot/task6_pilot_readiness_checklist_report.md) | `HISTORICAL_DELIVERY` | Архив; замена: `actual_docs/APP_FUNCTIONAL_CERTIFICATION.md` |
| [docs/pilot/task7_website_chat_connector_foundation_report.md](../../archive_docs/2026-09-14/docs/pilot/task7_website_chat_connector_foundation_report.md) | `HISTORICAL_DELIVERY` | Архив; замена: `actual_docs/APP_FUNCTIONAL_CERTIFICATION.md` |
| [docs/pilot/task8_inbox_polish_report.md](../../archive_docs/2026-09-14/docs/pilot/task8_inbox_polish_report.md) | `HISTORICAL_DELIVERY` | Архив; замена: `actual_docs/APP_FUNCTIONAL_CERTIFICATION.md` |
| [docs/pilot/task9_integrations_status_polish_report.md](../../archive_docs/2026-09-14/docs/pilot/task9_integrations_status_polish_report.md) | `HISTORICAL_DELIVERY` | Архив; замена: `actual_docs/APP_FUNCTIONAL_CERTIFICATION.md` |
| [docs/product-capabilities.md](../product-capabilities.md) | `ACTIVE_REFERENCE` | Предметный контракт/граница продукта; реализованные части не архивируются как правила. |
| [docs/product/competitive-regression-report.md](../../archive_docs/2026-09-14/docs/product/competitive-regression-report.md) | `SUPERSEDED` | Архив; замена: `docs/pilot/backend-open-logic-register.md` |
| [docs/product/landing-activation.md](../product/landing-activation.md) | `ACTIVE_REFERENCE` | Предметный контракт/граница продукта; реализованные части не архивируются как правила. |
| [docs/production/backup-restore.md](../production/backup-restore.md) | `ACTIVE_ENV_RUNBOOK` | Повторяемый env/operations gate; наличие команды не доказывает текущий deployed PASS. |
| [docs/production/celery-render-runtime.md](../production/celery-render-runtime.md) | `ACTIVE_ENV_RUNBOOK` | Повторяемый env/operations gate; наличие команды не доказывает текущий deployed PASS. |
| [docs/production/deployment.md](../production/deployment.md) | `ACTIVE_ENV_RUNBOOK` | Повторяемый env/operations gate; наличие команды не доказывает текущий deployed PASS. |
| [docs/production/file-storage.md](../production/file-storage.md) | `ACTIVE_ENV_RUNBOOK` | Повторяемый env/operations gate; наличие команды не доказывает текущий deployed PASS. |
| [docs/production/monitoring-runbook.md](../production/monitoring-runbook.md) | `ACTIVE_ENV_RUNBOOK` | Повторяемый env/operations gate; наличие команды не доказывает текущий deployed PASS. |
| [docs/production/observability.md](../production/observability.md) | `ACTIVE_ENV_RUNBOOK` | Повторяемый env/operations gate; наличие команды не доказывает текущий deployed PASS. |
| [docs/production/paid-beta-gate.md](../production/paid-beta-gate.md) | `ACTIVE_ENV_RUNBOOK` | Повторяемый env/operations gate; наличие команды не доказывает текущий deployed PASS. |
| [docs/production/paid-beta-launch-runbook.md](../production/paid-beta-launch-runbook.md) | `ACTIVE_ENV_RUNBOOK` | Повторяемый env/operations gate; наличие команды не доказывает текущий deployed PASS. |
| [docs/production/production-readiness-10000-audit.md](../production/production-readiness-10000-audit.md) | `ACTIVE_ENV_RUNBOOK` | Повторяемый env/operations gate; наличие команды не доказывает текущий deployed PASS. |
| [docs/production/production-readiness.md](../production/production-readiness.md) | `ACTIVE_ENV_RUNBOOK` | Повторяемый env/operations gate; наличие команды не доказывает текущий deployed PASS. |
| [docs/production/staging/staging-ci-cd-checklist.md](../production/staging/staging-ci-cd-checklist.md) | `ACTIVE_ENV_RUNBOOK` | Повторяемый env/operations gate; наличие команды не доказывает текущий deployed PASS. |
| [docs/production/staging/staging-provider-selection.md](../production/staging/staging-provider-selection.md) | `ACTIVE_ENV_RUNBOOK` | Повторяемый env/operations gate; наличие команды не доказывает текущий deployed PASS. |
| [docs/production/staging/staging-render-execution-report.md](../../archive_docs/2026-09-14/docs/production/staging/staging-render-execution-report.md) | `CLOSED_HISTORICAL` | Архив; замена: `docs/production/staging/staging-smoke-runbook.md` |
| [docs/production/staging/staging-smoke-runbook.md](../production/staging/staging-smoke-runbook.md) | `ACTIVE_ENV_RUNBOOK` | Повторяемый env/operations gate; наличие команды не доказывает текущий deployed PASS. |
| [docs/security/PERMISSION_MATRIX.md](../security/PERMISSION_MATRIX.md) | `ACTIVE_SECURITY_CONTRACT` | Не архивировать реализованную policy; BE-GAP-004 остаётся явным conflict. |
| [docs/security/privileged-mfa.md](../security/privileged-mfa.md) | `ACTIVE_SECURITY_CONTRACT` | Не архивировать реализованную policy; BE-GAP-004 остаётся явным conflict. |
| [docs/security/rate-limits.md](../security/rate-limits.md) | `ACTIVE_SECURITY_CONTRACT` | Не архивировать реализованную policy; BE-GAP-004 остаётся явным conflict. |
| [docs/testing/CODEX_TASK_TEMPLATE.md](../testing/CODEX_TASK_TEMPLATE.md) | `ACTIVE_VERIFICATION` | Повторяемые инструкции/gates; не одноразовый completed report. |
| [docs/testing/e2e-scale-baseline.md](../testing/e2e-scale-baseline.md) | `ACTIVE_VERIFICATION` | Повторяемые инструкции/gates; не одноразовый completed report. |
| [docs/testing/regression-report.md](../../archive_docs/2026-09-14/docs/testing/regression-report.md) | `CLOSED_HISTORICAL` | Архив; замена: `docs/testing/testing.md` |
| [docs/testing/testing.md](../testing/testing.md) | `ACTIVE_VERIFICATION` | Повторяемые инструкции/gates; не одноразовый completed report. |
| [plan/README.md](../../plan/README.md) | `INDEX` | Навигация, не отдельная очередь задач. |
| [plan/clean_code_rules/zani_required_clean_code_rules.md](../../plan/clean_code_rules/zani_required_clean_code_rules.md) | `ACTIVE_RULES` | Обязательные инженерные правила. |
| [plan/commit_pr_split_plan_2026_06_08.md](../../archive_docs/2026-09-14/plan/commit_pr_split_plan_2026_06_08.md) | `SUPERSEDED` | Архив; замена: `actual_docs/PROJECT_HANDOFF.md` |
| [plan/deals_reference_blueprint.md](../../plan/deals_reference_blueprint.md) | `REFERENCE_DEFERRED` | Не auto-authorized pilot backlog; применимы ограничения BE-GAP-009/010/012 и canonical CRM. |
| [plan/production_qa_2026_06_09.md](../../archive_docs/2026-09-14/plan/production_qa_2026_06_09.md) | `CLOSED_HISTORICAL` | Архив; замена: `actual_docs/APP_FUNCTIONAL_CERTIFICATION.md` |
| [plan/readiness_plan.md](../../archive_docs/2026-09-14/plan/readiness_plan.md) | `SUPERSEDED` | Архив; замена: `docs/pilot/backend-open-logic-register.md` |
| [plan/stabilization_audit_2026_06_08.md](../../archive_docs/2026-09-14/plan/stabilization_audit_2026_06_08.md) | `SUPERSEDED` | Архив; замена: `actual_docs/PRE_PILOT_CODE_READINESS_MASTER.md` |
| [plan/ui_ux_design_system_reform.md](../../plan/ui_ux_design_system_reform.md) | `REFERENCE_UI` | Оставлен для UI-владельца; не backend backlog. Полная UI-certification вне этого аудита. |

## Правило поддержки после аудита

1. Новый work item сначала сопоставить с existing gap/defect/phase ID и кодом.
2. Current status хранить у его владельца; индексы направляют к нему, не
   копируют неподдерживаемые проценты готовности.
3. Закрытие: implementation + требуемый gate + candidate SHA + skipped checks.
4. Историческое зелёное число тестов всегда связывать с SHA, не с названием ветки.
5. Архивировать весь документ только если в нём нет действующего контракта или
   незавершённой утверждённой очереди. Иначе выделить historical checkpoint.
6. Удалять старый путь не обязательно: короткий redirect безопаснее сотен
   сломанных ссылок. Полное тело остаётся в архиве.
7. `AGENTS.md` и clean-code rules не изменялись. Их ссылки на прежние checklist
   пути остаются разрешимыми через redirect.
8. Перед объединением documentation branch с canonical checkout сохранить
   параллельные additions в `docs/README.md` и не заменить WIP contracts старым HEAD.

## Проверки и ограничения

Проверяемый документационный gate: ровно 26 manifest entries; каждое архивное
тело после удаления archive banner совпадает с `git show HEAD:<original-path>`
при нормализации CRLF/LF; исходный путь содержит redirect; replacement и новые
Markdown targets существуют; все 105 документов классифицированы ровно один раз;
application source files не изменены; `git diff --check` чистый.

Фактический результат: **PASS** — 26/26 тел совпали с HEAD, 289 актуальных
локальных Markdown targets существуют, инвентарь 105/105 без пропусков/дублей,
69 Markdown-изменений и 0 изменений исполняемого кода. После удаления лишних
пустых строк в конце redirects повторный `git diff --check` прошёл.

Существующие ссылки в сохранённом историческом тексте не переписывались и
не сертифицировались как актуальные. Внешние live URLs из старых отчётов не
проверялись. Старые проверки не запускались повторно как часть архивации.
Новые backend проверки и два воспроизведённых failures перечислены в
[backend-аудите](../pilot/backend-development-audit.md#10-проверки-и-ограничения-этого-аудита).

Не выполнялись commit/push/merge, удаление данных, applied migrations,
seed/reset, backend/frontend implementation или production changes.
