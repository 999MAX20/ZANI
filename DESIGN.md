# Zani Taste-Skill UI/UX Rules

This file is the design source of truth for the `taste-skill-uiux` worktree.

## Mandatory Taste-Skill Usage

Before any non-trivial frontend UI/UX work in this worktree, the agent must read and apply the relevant local taste-skill files from:

```text
/Users/maksim/.agents/skills
```

Required by default for authenticated CRM screens:

```text
/Users/maksim/.agents/skills/redesign-existing-projects/SKILL.md
/Users/maksim/.agents/skills/minimalist-ui/SKILL.md
```

Use for screenshot/reference-based implementation:

```text
/Users/maksim/.agents/skills/image-to-code/SKILL.md
```

Use for landing, brand and public marketing surfaces only:

```text
/Users/maksim/.agents/skills/design-taste-frontend/SKILL.md
/Users/maksim/.agents/skills/brandkit/SKILL.md
/Users/maksim/.agents/skills/imagegen-frontend-web/SKILL.md
```

Do not apply these aggressively to CRM work screens unless explicitly requested:

```text
/Users/maksim/.agents/skills/gpt-taste/SKILL.md
/Users/maksim/.agents/skills/high-end-visual-design/SKILL.md
/Users/maksim/.agents/skills/industrial-brutalist-ui/SKILL.md
/Users/maksim/.agents/skills/design-taste-frontend-v1/SKILL.md
```

They are useful for visual exploration, but can make operational CRM screens too decorative, animated or sparse.

## Zani CRM Design Filter

Taste-skill rules must be adapted to Zani's product reality:

- Zani is a daily SMB CRM and business control app, not an Awwwards landing page.
- Operational pages must be dense, scannable, fast and role-aware.
- Tables, lists, drawers, filters, side panels and action bars are first-class UI.
- Avoid hero sections, decorative intros, oversized cards and marketing copy inside `/app/*`.
- Prefer compact table/list workflows with contextual drawers over large isolated cards.
- AI accents are allowed only for AI actions, AI drafts, AI insights and AI analyst surfaces.
- Status colors must communicate state, not decorate the layout.
- Every visible block must support a real workflow: read, filter, compare, act, confirm, recover or navigate.

## Required Project Design Sources

For frontend UI work, always read these project docs together with taste-skill:

```text
AGENTS.md
docs/design-system.md
plan/ui_ux_design_system_reform.md
```

For CRM production behavior, design must not contradict:

```text
CRM_PRODUCTION_LAYER_PLAN.md
docs/PERMISSION_MATRIX.md
docs/AI_ASSISTANT_RULES.md
```

## Page-Level Direction

Use these directions when redesigning core CRM screens:

- Leads: high-throughput queue/table, clear next step, source/status/responsible, CRM drawer on row click.
- Tasks: compact productivity table, status/priority/deadline/assignee, drawer for details and actions.
- Conversations: split inbox with conversation list, chat thread, collapsible context panel and quick replies modal.
- Calendar: maximum schedule surface, compact toolbar, overlays/drawers for appointment details.
- Clients: searchable customer table/profile workflow, history and linked entities in drawer/panel.
- Deals: pipeline-first layout, compact cards, stage totals and deal drawer.
- Settings: structured configuration sections, no merchant-facing developer-console clutter.

## Implementation Rules

- Work with the existing React/Tailwind/component stack.
- Check `frontend/package.json` before adding or using new libraries.
- Prefer existing shared components before creating new page-local UI.
- Keep changes incremental and reviewable.
- Do not introduce new fonts, animation libraries or icon systems unless the project explicitly decides to adopt them.
- Preserve accessibility: visible focus states, keyboard navigation, readable contrast and minimum touch targets.
- Test frontend changes with:

```bash
cd frontend && npm run build
```

## Success Criteria

A completed taste-skill UI/UX pass should make the page:

- easier to scan;
- faster to operate;
- visually quieter;
- more consistent with other CRM pages;
- less card-heavy;
- less duplicated in navigation/filter/search controls;
- safer around destructive actions;
- usable at desktop, tablet and mobile widths.

