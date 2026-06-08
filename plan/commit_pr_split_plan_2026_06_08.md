# Commit / PR split plan - 2026-06-08

Цель: разложить текущий dirty worktree на понятные, проверяемые блоки. Проект не нужно переписывать с нуля; дальше идем через стабилизацию и небольшие PR, чтобы не потерять контроль над логикой CRM.

## Текущее состояние

Проверки уже пройдены:

- `python manage.py makemigrations --check --dry-run` - OK
- `python manage.py test apps.billing apps.core.tests_custom_fields --verbosity 1` - OK, 20 tests
- `python manage.py test --verbosity 1` - OK, 552 tests
- `npm --prefix frontend run build` - OK
- `git diff --check` - OK

Локальная причина падения `/api/auth/token/` устранена через применение миграций. Ошибка была из-за отсутствующей колонки `businesses_business.language` в SQLite.

## PR 1 - Database and backend settings foundation

Смысл: закрепить новые поля бизнес-настроек, billing controls и custom field permissions на уровне моделей/миграций/API.

Файлы:

- `apps/businesses/models.py`
- `apps/businesses/migrations/0005_business_operational_settings.py`
- `apps/billing/models.py`
- `apps/billing/views.py`
- `apps/billing/migrations/0005_subscription_billing_controls.py`
- `apps/core/models.py`
- `apps/core/serializers.py`
- `apps/core/custom_field_views.py`
- `apps/core/migrations/0008_customfielddefinition_permissions_json.py`

Что покрывает:

- `Business.language`, `currency`, legal/invoice/brand/policy/SLA/booking buffer поля.
- `Subscription.billing_email`, `payment_method`, `invoice_details_json`, `requested_plan`, `plan_change_requested_at`.
- API actions для subscription settings/change-plan/pause/resume/cancel.
- `CustomFieldDefinition.permissions_json`.
- Role-based view/edit filtering для custom fields.

Проверки перед PR:

- `python manage.py makemigrations --check --dry-run`
- `python manage.py test apps.businesses apps.billing apps.core.tests_custom_fields --verbosity 1`
- `python manage.py check`

Риски:

- `custom_field_views.py` сейчас фильтрует role permissions через Python-итерацию по queryset. Для пилота нормально, но перед нагрузкой нужно заменить на DB-level фильтрацию или кеш разрешений.
- Billing actions меняют статус подписки напрямую. Для реального биллинга позже нужен payment provider workflow и audit trail.

## PR 2 - Backend regression tests for new controls

Смысл: отдельно зафиксировать тестами новые права и бизнес-ограничения, чтобы дальше UI не ломал backend-контракты.

Файлы:

- `apps/billing/tests.py`
- `apps/core/tests_custom_fields.py`

Что покрывает:

- Owner может управлять billing settings, request plan change, pause/resume/cancel.
- Accountant может смотреть subscription, но не может управлять ей.
- Manager видит только разрешенные custom field definitions/values.
- Manager не может bulk-upsert owner-only custom field.

Проверки перед PR:

- `python manage.py test apps.billing apps.core.tests_custom_fields --verbosity 1`
- `python manage.py test --verbosity 1`

Риски:

- Эти тесты должны идти рядом с PR 1 или сразу после него. Без моделей/миграций из PR 1 они не применимы.

## PR 3 - CRM unified UI foundation

Смысл: вынести общий визуальный фундамент, чтобы следующие страницы не собирались разными стилями.

Файлы:

- `frontend/src/components/crm/CrmPageLayout.tsx`
- `frontend/src/components/ui/Badge.tsx`
- `frontend/src/components/ui/Tabs.tsx`
- `frontend/src/components/ui/Button.tsx`
- `frontend/src/components/ui/Card.tsx`
- `frontend/src/components/ui/Input.tsx`
- `frontend/src/components/ui/MetricCard.tsx`
- `frontend/src/components/ui/Modal.tsx`
- `frontend/src/components/ui/Select.tsx`
- `frontend/src/components/ui/Textarea.tsx`
- `frontend/src/styles.css`
- `frontend/tailwind.config.ts`
- `frontend/src/config/featureFlags.ts`

Что покрывает:

- Общий CRM layout.
- Единые badge/tabs/cards/inputs/modals/selects/textareas.
- Feature flags: `crmUnifiedDesign`, `crmKanbanDefault`.
- Цветовая и layout база для дальнейших страниц.

Проверки перед PR:

- `npm --prefix frontend run build`
- Browser QA: dashboard, conversations, clients, deals, calendar, settings.

Риски:

- Этот PR визуально широкий. Нужно не ограничиваться build, а пройти основные страницы в браузере.
- Если будет много визуальных регрессий, лучше включать через feature flag.

## PR 4 - Settings, business profile and billing UI

Смысл: дать владельцу/админу рабочую страницу настроек бизнеса и подписки.

Файлы:

- `frontend/src/features/settings/SettingsPage.tsx`
- `frontend/src/components/forms/BusinessSettingsForm.tsx`
- `frontend/src/api/billing.ts`
- `frontend/src/types/index.ts`
- `frontend/src/lib/i18n/ru.ts`
- `frontend/src/lib/i18n/kk.ts`
- `frontend/src/lib/i18n/en.ts`

Что покрывает:

- UI для business settings.
- UI для billing controls.
- Типы и API-client для новых backend actions.
- Переводы на RU/KZ/EN.

Проверки перед PR:

- `npm --prefix frontend run build`
- Browser QA settings под owner/director/accountant/manager.
- Проверить, что accountant видит billing, но не видит destructive/manage actions.

Риски:

- Страница `SettingsPage.tsx` изменилась крупно. Перед merge нужен ручной проход по табам и ролям.

## PR 5 - Owner/manager dashboard and AI work surfaces

Смысл: привести рабочие панели и AI-страницы к новому UX без смешивания с backend foundations.

Файлы:

- `frontend/src/features/dashboard/OwnerDashboard.tsx`
- `frontend/src/features/dashboard/ManagerDashboard.tsx`
- `frontend/src/features/assistant/AIAgentsPage.tsx`
- `frontend/src/app/router.tsx`
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/lib/i18n/ru.ts`
- `frontend/src/lib/i18n/kk.ts`
- `frontend/src/lib/i18n/en.ts`

Что покрывает:

- Owner dashboard.
- Manager dashboard.
- AI agents page.
- Router/layout links and labels.

Проверки перед PR:

- `npm --prefix frontend run build`
- Browser QA owner/director/manager/operator navigation.
- Проверить sidebar/header на desktop и mobile отдельно.

Риски:

- Sidebar уже важный рабочий инструмент. Любое изменение здесь должно проходить через визуальную QA.

## PR 6 - Deals, conversations and CRM worklist polish

Смысл: отдельно проверить рабочие CRM-экраны, потому что они ближе всего к ежедневной работе сотрудников.

Файлы:

- `frontend/src/features/conversations/ConversationsPage.tsx`
- `frontend/src/features/deals/DealsPage.tsx`
- `frontend/src/features/deals/components/DealListItem.tsx`
- `frontend/src/features/deals/components/DealsAIPriority.tsx`
- `frontend/src/features/deals/components/DealsFilters.tsx`
- `frontend/src/features/deals/components/DealsHeader.tsx`
- `frontend/src/features/deals/components/DealsList.tsx`
- `frontend/src/features/deals/components/DealsToolbar.tsx`
- `frontend/src/features/leads/components/common/MetricCard.tsx`
- `frontend/src/features/leads/components/common/MetricTile.tsx`

Что покрывает:

- Chat/conversation work surface.
- Deals pipeline/list polish.
- Shared metric blocks used by leads/deals.

Проверки перед PR:

- `npm --prefix frontend run build`
- Browser QA conversations:
  - unread badge;
  - open message marks read;
  - role-based notifications;
  - AI answer;
  - CRM pipeline button;
  - manual reply.
- Browser QA deals:
  - list/pipeline;
  - selected deal;
  - next action;
  - won/lost flow.

Риски:

- Нельзя ломать уже работающую chat logic. Любые UI-изменения conversations должны быть проверены через реальный сценарий входящего сообщения.

## PR 7 - Cleanup and project audit docs

Смысл: вынести чистку мусора и документацию отдельно, чтобы не смешивать с продуктовой логикой.

Файлы:

- `leadsorig` deletion
- `plan/stabilization_audit_2026_06_08.md`
- `plan/commit_pr_split_plan_2026_06_08.md`

Что покрывает:

- Удаление старого tracked artifact `leadsorig`.
- Фиксация решения: проект продолжаем, не переписываем.
- Техническая карта стабилизации.

Проверки перед PR:

- `git diff --check`
- Убедиться, что `leadsorig` нигде не импортируется и не используется.

## Рекомендуемый порядок merge

1. PR 7 - cleanup/docs, безопасный и маленький.
2. PR 1 - backend foundation.
3. PR 2 - backend regression tests.
4. PR 3 - UI foundation.
5. PR 4 - settings/business/billing UI.
6. PR 5 - dashboard/AI/layout.
7. PR 6 - conversations/deals/leads work surfaces.

Если нужно ускориться, PR 1 и PR 2 можно объединить, но frontend PR лучше держать отдельно.

## Что не коммитить одним куском

Не делать один коммит на весь dirty worktree. Сейчас изменения затрагивают backend schema, API permissions, frontend design system, layout, dashboards, settings, conversations и deals. Один большой коммит усложнит review и откат.

## Следующий практический шаг

Подготовить первый маленький коммит:

```bash
git add leadsorig plan/stabilization_audit_2026_06_08.md plan/commit_pr_split_plan_2026_06_08.md
git commit -m "Document stabilization plan and remove stale artifact"
```

После этого идти к backend foundation и тестам.
