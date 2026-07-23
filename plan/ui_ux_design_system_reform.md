# UI/UX Design System Reform

Дата: 2026-06-09

Цель: зафиксировать единый визуальный стандарт ZANI перед полной реформой страниц, чтобы новые экраны не проектировались разрозненно.

## Product Direction

ZANI должен выглядеть как светлая, плотная и рабочая CRM-платформа с AI-функциями внутри бизнес-процессов.

Ключевая формула:

`Clean Business CRM + AI Accent`

### 2026-07-16 Visual Direction Update

The current color and background source of truth is `docs/design-system.md`.

The authenticated CRM direction is now:

```txt
Warm Premium CRM
Warm ivory workspace + saturated orange actions + plum AI accent
```

This update supersedes the earlier blue-primary color direction below. The previous page structure and operational-density rules still apply: authenticated CRM screens must stay compact, useful, role-aware, and free from decorative/marketing blocks.

The key background rule is: normal CRM pages should show one stable viewport/layout background and one primary work-surface background. Extra muted or semantic backgrounds are allowed only for real grouping, selected/active states, alerts, AI blocks, or status indicators.

Это означает:

- интерфейс в первую очередь помогает работать с клиентами, лидами, сделками, календарем и сообщениями;
- AI заметен как полезный помощник, но не превращает весь продукт в декоративную AI-витрину;
- страницы должны быть плотными, сканируемыми и понятными для ежедневной работы;
- визуальный шум, большие декоративные блоки, лишние градиенты и карточки без задачи должны удаляться.

## Approved Design Truth Sources

Основные источники правды находятся в `references/main_references/`.

### Deals

Файл: `references/main_references/deals_desktop.jpeg`

Отвечает за:

- структуру pipeline-first экрана;
- kanban-воронку сделок;
- компактные карточки сделок;
- фильтры над воронкой;
- нижние/боковые business widgets;
- AI-подсказки для сделок и прогнозов.

Правило для ZANI:

Deals должен быть рабочим pipeline, а не декоративным списком. Главная задача страницы - быстро видеть этапы, суммы, next action и проблемные сделки.

### Inbox / Conversations

Файл: `references/main_references/inbox_desktop.jpeg`

Отвечает за:

- split-view inbox;
- список диалогов слева;
- чат в центре;
- client/context panel справа;
- KPI по сообщениям;
- фильтры по статусам и каналам;
- AI-подсказку как рабочий action-блок.

Правило для ZANI:

Conversations должен быть полноценным рабочим inbox. Оператор должен видеть диалог, клиента, канал, ответственного, следующую задачу и AI-предложение без переходов на другие страницы.

### Leads

Файл: `references/main_references/leads_desktop.jpeg`

Отвечает за:

- таблицу лидов;
- верхние метрики;
- фильтры по статусам/каналам;
- выбранную строку;
- right detail panel;
- историю лида;
- next action;
- быстрые действия;
- AI-приоритизацию.

Правило для ZANI:

Leads должен быть экраном обработки входящего потока. Главная задача - быстро понять, кому ответить, кто горячий, какой следующий шаг и кто ответственный.

## Core Layout Pattern

Для основных рабочих страниц используется единая структура:

```txt
Sidebar
Header
Page title + short description
Metrics row
Filters row
Main work area
Right detail/context panel when useful
AI insight/action block when useful
```

Main work area зависит от страницы:

```txt
Deals        -> Kanban pipeline
Leads        -> Table + selected lead
Conversations-> Conversation list + chat + client panel
Clients      -> Client list + profile/timeline
Calendar     -> Schedule grid + appointment details
Integrations -> Cards grid + setup modal
Outreach     -> Campaign table/list + campaign details
Analytics    -> KPI + charts + AI interpretation
Settings     -> Structured forms by sections
```

Settings scope:

- keep persistent workspace configuration: business profile, team/access, roles, security, communication preferences, quick replies, appointment messages, billing/usage and guarded custom fields;
- keep operational tools out of Settings: import/export, lead capture forms, automation builders, connector/developer setup and workflow shortcuts belong on their dedicated pages;
- avoid developer-console surfaces inside merchant settings unless explicitly gated by a separate advanced/admin route.

## Approved Color Direction

Основной стиль: светлая business CRM с синим primary и фиолетовым AI-акцентом.

### Base

```txt
Background:        #F8FAFC
Surface/Card:      #FFFFFF
Surface Muted:     #F1F5F9
Border:            #E2E8F0
```

### Text

```txt
Text Primary:      #0F172A
Text Secondary:    #475569
Text Muted:        #94A3B8
```

### Actions

```txt
Primary:           #2563EB
Primary Hover:     #1D4ED8
Primary Soft:      #EFF6FF
```

### AI

```txt
AI Accent:         #7C3AED
AI Soft:           #F5F3FF
```

### Status

```txt
Success:           #16A34A
Success Soft:      #F0FDF4

Warning:           #D97706
Warning Soft:      #FFFBEB

Danger:            #DC2626
Danger Soft:       #FEF2F2

Info:              #0284C7
Info Soft:         #F0F9FF
```

## Color Usage Rules

- Blue primary is used for normal CRM actions: create, save, assign, launch, selected state, primary focus.
- Violet AI is used only for AI actions: AI answer, AI analyst, AI pipeline, generate, AI insight.
- Green is used only for success/connected/won/confirmed/completed.
- Orange is used only for attention/waiting/needs operator/not confirmed.
- Red is used only for error/lost/failed/expired/destructive.
- Do not use violet/blue gradients as generic decoration.
- Do not make pages dominated by one purple-blue hue.

## Component Shape

```txt
Card radius:       12px
Control radius:    10px
Button radius:     10px
Modal radius:      16px
Sidebar radius:    20-24px for shell only
Border:            1px solid #E2E8F0
Card shadow:       0 4px 12px rgba(15, 23, 42, 0.05)
Panel shadow:      0 16px 40px rgba(15, 23, 42, 0.10)
```

## Density Rules

- CRM pages should be compact and scannable.
- Metrics cards should be useful, not decorative.
- Tables and lists should show operational fields: status, source, responsible, next action, last activity.
- Detail panels should explain the selected entity and expose immediate actions.
- AI blocks should recommend a concrete action, not generic text.
- Avoid cards inside cards unless the inner card is a real repeated item, modal, or selected entity preview.

## Page Reform Priority

1. Deals
2. Leads
3. Conversations
4. Clients
5. Calendar
6. Integrations
7. Outreach
8. Dashboard by role
9. Analytics
10. Settings / Billing / Team / AI Agents

## Acceptance Checklist Per Page

Перед тем как считать страницу приведенной к новому стандарту:

- page layout matches approved references;
- colors use approved tokens;
- filters use one consistent style;
- primary actions are obvious;
- right detail/context panel exists when the page has selected entity workflow;
- AI block is action-oriented and uses violet AI accent only;
- mobile layout is not a broken desktop copy;
- no horizontal overflow;
- no text overlap;
- empty/loading/error states exist;
- Browser visual QA is done for desktop and mobile;
- readiness document is updated.

## Implementation Checkpoints

### 2026-06-21 Shared UI cleanup

Выполнен первый проход по общим UI-компонентам:

- `Card`, `DataTable`, `MetricCard`, `PageHeader`, `StateViews` приведены к более плотному CRM-стилю;
- старые glass/blur surfaces в shared-компонентах заменены на белые поверхности с `slate` border;
- generic active states в `Primitives` переведены с AI-gradient на обычный CRM blue;
- `zani-ai-surface` упрощен до спокойной AI-поверхности без декоративного radial/gradient фона;
- базовые shadows стали мягче и ближе к принятому `Clean Business CRM + AI Accent`.

Осталось:

- пройти feature-level блоки, где еще вручную используются `rounded-3xl`, `bg-white/80`, `shadow-soft`, `hover:-translate-y-*`;
- унифицировать формы и modal footer/content layout;
- завершить перевод transient action errors в bottom-right notifications;
- провести desktop/mobile visual QA по приоритетным страницам.
