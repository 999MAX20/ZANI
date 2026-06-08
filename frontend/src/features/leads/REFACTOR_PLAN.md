# LeadsPage Refactoring Plan

## Goals
- Reduce file size from 1896 lines to ~500 lines (orchestrator pattern)
- Implement mobile-first "banking business" design
- Compact UI elements (KPI cards, filters, headers)
- Better empty states with explanations
- AI insights as actionable summaries

## Architecture Changes

### 1. Extract Hooks
- [ ] `useLeadData.ts` - data fetching & transformations
- [ ] `useLeadFilters.ts` - filter logic (already exists, enhance)
- [ ] `useLeadActions.ts` - mutations & actions
- [ ] `useLeadKeyboardShortcuts.ts` - keyboard navigation
- [ ] `useLeadOfflineMode.ts` - offline queue management

### 2. Extract Components
- [ ] `LeadsHeader.tsx` - page header with search & actions
- [ ] `LeadsFilterBar.tsx` - chips filters (mobile + desktop)
- [ ] `LeadsAIBanner.tsx` - AI priority banner (unified)
- [ ] `LeadsEmptyState.tsx` - enhanced empty state with suggestions
- [ ] `LeadsBulkActions.tsx` - bulk selection toolbar
- [ ] `LeadContextMenu.tsx` - right-click context menu

### 3. UI Improvements

#### Header (Compact)
- Reduce h1 from text-2xl to text-xl
- Reduce description from text-sm to text-xs
- Reduce search from h-11 to h-10
- Reduce view toggle buttons from h-9 to h-8
- Reduce icon sizes from 18 to 16-17

#### KPI Cards (Mobile)
- Use horizontal scroll on mobile
- Reduce card height
- Smaller icons (h-8 w-8 instead of h-9 w-9)
- Compact text (text-xs labels, text-sm values)

#### Filters (Chips Pattern)
- Mobile: horizontal scroll with min-h-8, px-2.5, text-xs
- Desktop: same but visible all at once
- Show counts in compact badges
- Source filters as chips with icons

#### AI Banner
- Single component for both mobile/desktop
- Reduce padding from p-4 to p-3
- Smaller icon container (h-8 w-8)
- Compact text (text-sm title, text-xs description)

#### Empty State
- Explain WHY there's no data
- Show available integration sources
- Two CTAs: Create manually OR Connect sources
- Visual indicators (chips) for WhatsApp, Telegram, etc.

### 4. Mobile-Specific
- [ ] Add Floating Action Button (+) for creating leads
- [ ] Bottom sheet for lead details (instead of right panel)
- [ ] Touch-friendly targets (min 44x44px)
- [ ] No horizontal scroll in main content
- [ ] Simplified header actions (hide less important)

### 5. Performance
- [ ] Memoize filtered rows calculation
- [ ] Lazy load detail panel
- [ ] Virtualize long lists (already done)
- [ ] Debounce search input (300ms)

## Implementation Order

### Phase 1: Foundation (Priority: Critical)
1. Create extracted hooks
2. Create basic components (Header, FilterBar, AIBanner)
3. Implement compact styling

### Phase 2: UX Improvements (Priority: High)
4. Enhanced empty states
5. Mobile optimizations (FAB, bottom sheet)
6. Context menu improvements

### Phase 3: Polish (Priority: Medium)
7. Keyboard shortcuts enhancement
8. Bulk actions toolbar
9. Performance optimizations

## Success Metrics
- File size: < 500 lines for main component
- Load time: < 2s on mobile 3G
- Lighthouse score: > 90
- User feedback: simpler, faster, clearer

## Reference Designs
- `/workspace/references/main_references/leads_mobile.jpeg`
- `/workspace/references/main_references/leads_desktop.jpeg`
- `/workspace/references/main_references/prompts/zani_codex_prompts_full_updated.md` (section 7)
