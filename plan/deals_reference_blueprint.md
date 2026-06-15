# Deals Reference Blueprint

Дата: 2026-06-09

Источник правды:

`references/main_references/deals_desktop.jpeg`

Цель: реализовать страницу Deals в ZANI по структуре и визуальной логике референса. Не придумывать новый layout поверх текущего. Сначала повторить композицию, затем подключать/сохранять текущие бизнес-действия.

## Главное Правило

Deals page = pipeline-first рабочий экран.

На desktop основная область должна быть занята воронкой сделок. Никакая боковая detail panel не должна съедать ширину pipeline. Полная карточка сделки открывается через drawer/modal по клику на сделку.

## Desktop Structure

Страница внутри общего app shell строится так:

```txt
Global app sidebar
Global app header/search

Deals page content:
1. Page title block
2. Controls row
3. Horizontal kanban pipeline
4. Bottom business widgets row
```

## 1. Page Title Block

Расположение:

- находится в верхней части контента под global header;
- слева;
- без большой карточки/баннера;
- без KPI-карточек над ним.

Содержимое:

```txt
H1: Сделки
Subtitle: Управляйте воронкой продаж и закрывайте больше сделок.
```

Визуал:

- H1 крупный, жирный, темный;
- subtitle маленький, серый;
- блок занимает только нужную высоту;
- нет декоративного gradient hero.

## 2. Controls Row

Расположение:

- сразу под title block;
- одна горизонтальная строка;
- слева фильтры;
- справа действия.

Левая часть:

```txt
[Воронка продаж v]
[Сегодня, 15 мая v]
[Ответственный: все v]
```

Правая часть:

```txt
[Настроить воронку]
[+ Новая сделка]
```

Правила:

- controls compact;
- высота около 40px;
- radius около 8-10px;
- border #E2E8F0;
- кнопка "Новая сделка" primary blue/violet gradient допускается, но без лишнего glow;
- не показывать большую панель расширенных фильтров по умолчанию;
- поиск/экспорт/статусы можно оставить в secondary menu позже, но не как главный шум.

## 3. Horizontal Kanban Pipeline

Расположение:

- главный блок страницы;
- начинается сразу под controls row;
- занимает основную ширину;
- горизонтальный scroll при большом количестве стадий.

Layout:

```txt
Kanban container
  Stage column
  Stage column
  Stage column
  Stage column
  Stage column
```

Размеры:

- column width: примерно 250-280px;
- gap between columns: 12-16px;
- column min-height: около 390-460px;
- card gap внутри колонки: 8-10px;
- весь kanban не должен быть зажат detail panel справа.

### Stage Column

Header содержит:

```txt
Stage name                 count
Stage total amount
Colored progress/accent line
```

Пример:

```txt
Новые                      12
2 350 000 ₸
──────── colored line
```

Визуал:

- column background white;
- border #E2E8F0;
- radius 12px;
- light shadow;
- header без тяжелой заливки;
- внутри cards на очень светлом сером фоне или white.

### Deal Card

Card содержит:

```txt
Colored dot + Deal title
Client/company
Amount · stage/status · date/time
Owner initial/avatar
Message/task indicator if available
```

Пример:

```txt
• Поставка оборудования          E
ТОО «GreenTech»
1 250 000 ₸ · Новая · Сегодня, 10:30   💬 2
```

Правила:

- card compact;
- без больших badges;
- без большого checkbox по умолчанию;
- checkbox/actions появляются только hover или secondary;
- card click selects/opens deal drawer;
- drag/drop between stages remains;
- card double click can open full CRM card.

## 4. Bottom Business Widgets Row

Расположение:

- под kanban;
- три блока в одну строку на desktop;
- на mobile/узких экранах stacking.

Структура:

```txt
[AI-подсказка] [Прогноз закрытий] [Активность]
```

### AI Hint Widget

Содержит:

- title: AI-подсказка;
- 2-3 короткие рекомендации;
- link/action: Смотреть все подсказки;
- легкий violet accent;
- небольшой decorative glow допустим только внутри блока, как на reference.

Запрещено:

- большая AI-панель над kanban;
- generic AI text без действия;
- делать AI-блок главным визуальным элементом страницы.

### Forecast Widget

Содержит:

- title: Прогноз закрытий;
- dropdown period: На этот месяц;
- circular progress около 75%;
- expected revenue;
- small green delta.

### Activity Widget

Содержит:

- title: Активность;
- список последних событий;
- время справа;
- link/action: Все события.

## What We Do Not Implement On Main Desktop Surface

Не показывать на главной surface:

- постоянную right detail panel;
- огромные KPI-карточки над kanban;
- expanded advanced filters по умолчанию;
- table/list view переключатель как главный control;
- декоративный hero;
- карточки внутри карточек;
- перегруженные badges на deal card.

Эти функции могут остаться:

- full deal card через drawer/modal;
- advanced filters через "Настроить воронку" или secondary menu;
- table/list как отдельный режим позже, но не в первом pass.

## Business Logic To Preserve

При визуальном rebuild нельзя ломать:

- create deal modal;
- drag/drop deal between stages;
- stage guard requiring next action where applicable;
- create next task;
- mark won/lost;
- reopen deal;
- open CRM drawer for deal/client;
- export can stay accessible, but not visually primary.

## Implementation Plan

1. Remove current split layout from Deals desktop.
2. Use reference page structure:
   - title block;
   - compact controls row;
   - full-width kanban;
   - bottom widgets.
3. Rebuild `DealsList` kanban column/card styles to match reference.
4. Keep existing modals/actions/hooks.
5. Run frontend build.
6. Open `/dashboard/deals` in Browser.
7. Compare screenshot with reference.
8. Iterate only on visual differences.

## Acceptance Criteria

Page is acceptable only when:

- first screen visually reads like `deals_desktop.jpeg`;
- kanban is the dominant element;
- controls row matches reference composition;
- no permanent right detail panel is visible;
- deal cards are compact;
- stage columns show count + amount + accent line;
- bottom row has exactly AI hint, forecast, activity;
- business actions still work;
- no TypeScript/build errors.

