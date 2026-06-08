# Deals Feature

Страница сделок разделена на оркестратор, хуки бизнес-логики и презентационные компоненты.

## Structure

- `DealsPage.tsx` собирает страницу, синхронизирует верхнеуровневое состояние и подключает drawer/modals.
- `hooks/useDeals.ts` загружает CRM-данные и строит карты клиентов, стадий и задач.
- `hooks/useDealFilters.ts` хранит фильтры в URL и `localStorage` с debounce.
- `hooks/useDealMetrics.ts` считает KPI, quick filters, risk и priority deal.
- `hooks/useDealActions.ts` содержит mutations для создания, смены стадии, закрытия и задач.
- `hooks/useDealSelection.ts` управляет текущей сделкой, мобильной панелью и bulk selection.
- `components/` содержит header, AI priority, metrics, filters, toolbar, list, detail panel и modals.
- `components/common/` содержит малые UI-элементы: amount, stage badge, risk, quick actions, timeline.

## Main Flows

Создание сделки:
1. `DealsHeader` открывает `CreateDealModal`.
2. `useDealActions.createMutation` вызывает `dealsApi.create`.
3. После успеха инвалидируется `deals` query и новая сделка выбирается в списке.

Фильтрация:
1. `DealsFilters` меняет `DealFiltersState`.
2. `useDealFilters` сохраняет состояние в URL и `localStorage`.
3. `useDealMetrics` пересчитывает `rows`, stage chips, quick filters и metrics.

Bulk actions:
1. `DealsList` отмечает сделки чекбоксами.
2. `DealsToolbar` показывает selected count и bulk controls.
3. Delete подтверждается через `window.confirm` и вызывает `dealsApi.remove` для выбранных сделок.

Смена стадии:
1. Select в detail panel или drag-and-drop в списке вызывает `handleStageChange`.
2. Won/lost стадии открывают подтверждающую модалку.
3. Продвижение открытой сделки без следующего шага открывает modal создания задачи.

## Accessibility

Интерактивные элементы используют semantic buttons, `aria-label` для icon buttons и видимые focus rings из базовых UI-компонентов. Keyboard shortcuts поддерживаются на уровне страницы: arrows, Enter, Escape, Cmd/Ctrl+N, Cmd/Ctrl+F и Delete.
