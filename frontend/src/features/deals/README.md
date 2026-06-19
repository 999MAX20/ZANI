# Deals Feature

Страница сделок разделена на оркестратор, хуки бизнес-логики и презентационные компоненты.

## Structure

- `DealsPage.tsx` собирает страницу, синхронизирует верхнеуровневое состояние и подключает drawer/modals.
- `hooks/useDeals.ts` загружает CRM-данные и строит карты клиентов, стадий и задач.
- `hooks/useDealFilters.ts` хранит фильтры в URL и `localStorage` с debounce.
- `hooks/useDealMetrics.ts` считает KPI, quick filters, risk и priority deal.
- `hooks/useDealActions.ts` содержит mutations для создания, смены стадии, закрытия и задач.
- `hooks/useDealSelection.ts` управляет текущей сделкой, мобильной панелью и bulk selection.
- `components/` содержит filters, kanban/list surface, business widgets, detail panel и modals.
- `components/common/` содержит малые UI-элементы: amount, stage badge, risk, quick actions, timeline.

## Main Flows

Создание сделки:
1. `DealsPage` регистрирует primary action в `PageHeader`.
2. `useDealActions.createMutation` вызывает `dealsApi.create`.
3. После успеха инвалидируется `deals` query и новая сделка выбирается в списке.

Фильтрация:
1. `useDealFilters` читает состояние из URL и `localStorage`.
2. Глобальный поиск страницы синхронизирует `search` query param.
3. `useDealMetrics` пересчитывает `rows`, stage chips, quick filters и metrics.

Bulk actions:
1. `DealsList` отмечает сделки чекбоксами.
2. `useDealSelection` хранит выбранные сделки.
3. Delete подтверждается через `window.confirm` и вызывает `dealsApi.remove` для выбранных сделок.

Смена стадии:
1. Select в detail panel или drag-and-drop в списке вызывает `handleStageChange`.
2. Won/lost стадии открывают подтверждающую модалку.
3. Продвижение открытой сделки без следующего шага открывает modal создания задачи.

## Accessibility

Интерактивные элементы используют semantic buttons, `aria-label` для icon buttons и видимые focus rings из базовых UI-компонентов. Keyboard shortcuts поддерживаются на уровне страницы: arrows, Enter, Escape, Cmd/Ctrl+N, Cmd/Ctrl+F и Delete.
