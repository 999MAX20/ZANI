# ZANI Defect Knowledge Base

- Status: **ACTIVE**
- Started: 2026-08-04
- Scope: defects, UX failures, regressions and incomplete behavior in the
  existing ZANI product foundation
- Owner: ZANI manager workflow
- Primary audit scope: authenticated `/app`

## Purpose

This is the permanent precedent register for defects discovered during owner
review, browser audits, automated checks and implementation work.

It is not a roadmap and must not contain new feature ideas. Its purpose is to
turn every confirmed problem into reusable knowledge:

```text
observed symptom
  -> confirmed cause
  -> actual cross-product scope
  -> bounded correction
  -> regression evidence
  -> reusable audit rule
```

Before a broad functional or UI/UX audit, agents must read this document and
apply all active regression rules to every relevant page, not only to the page
where the owner first noticed the problem.

## Operating Rules

For every owner-reported problem:

1. Record the observed page, role, action and visible symptom.
2. Separate a defect from a new feature request or product preference.
3. Reproduce the behavior before changing code when practical.
4. Locate the shared component, hook, API client or domain layer involved.
5. Search every consumer of that shared layer and state the real blast radius.
6. Prefer one shared fix when the cause is shared.
7. Verify both the original failure and the normal success path.
8. Add focused regression coverage when the behavior can recur silently.
9. Record the exact commit, branch, checks and remaining test debt.
10. Promote the precedent into the regression-rule catalogue below.

A problem is not `CLOSED` only because the UI looks correct once. Closure
requires a focused implementation, verification evidence and integration into
the accepted project branch.

## Classification

### Type

- `FUNCTIONAL`: a supported action produces an incorrect result.
- `INTERACTION`: focus, input, navigation, overlay or control behavior breaks.
- `VISUAL`: content is unreadable, clipped, overlapping or misleading.
- `CONSISTENCY`: the same concept behaves differently across shared surfaces.
- `TECHNICAL_LEAK`: internal errors or provider details reach merchant UI.
- `ACCESS`: role or tenant behavior is incorrect.
- `PERFORMANCE`: latency, rerenders or payload size break the working flow.

### Status

- `REPORTED`: recorded but not reproduced.
- `CONFIRMED`: reproduced and scoped.
- `FIXED_BRANCH`: correction committed on a task branch.
- `VERIFIED_BRANCH`: focused gate passed on the task branch.
- `INTEGRATED`: accepted into the canonical integration branch.
- `CLOSED`: integrated, verified and no known acceptance gap remains.
- `TEST_DEBT`: behavior is fixed but durable regression coverage is incomplete.
- `DEFERRED`: confirmed but intentionally not scheduled.

## Defect Register

| ID | Type | Owner-observed surface | Actual scope | Status | Fix |
| --- | --- | --- | --- | --- | --- |
| ZD-001 | INTERACTION | Internal search on Leads and Deals | Search controls across Leads, Deals, Clients, Tasks, Inbox, Outreach, Pricing and global search | FIXED_BRANCH / TEST_DEBT | `1b40d00` |
| ZD-002 | VISUAL / TECHNICAL_LEAK | Outbound manager message in Inbox | Shared message bubbles for manager, bot/AI and client plus failed-message action in the conversation list | VERIFIED_BRANCH | `7284920` |
| ZD-003 | INTERACTION | Client CRM drawer after canceling the native file picker | Shared `CrmEntityDrawer` attachment flow for client, lead, deal and appointment entities, including entity drawers opened from Tasks | VERIFIED_BRANCH | `f81cee7` |
| ZD-004 | CONSISTENCY / TECHNICAL_LEAK | Code-level fallback audit | Shared API parsing, crash boundaries and direct error fields across merchant and platform surfaces | VERIFIED_BRANCH / EXTERNAL_AND_MANUAL_EVIDENCE_OPEN | `UNIFIED_FALLBACK_EXPERIENCE_PLAN.md` |
| ZD-005 | SECURITY / AUTHORIZATION | Legacy local private-media URL | Every registered attachment consumer and every CRM entity scope within the same business | VERIFIED_BRANCH | `codex/pre-pilot-sec-010-security-certification` |
| ZD-006 | VISUAL / CONSISTENCY | Merchant root and owner dashboard | Router aliases, desktop/mobile navigation and the owner/administrator dashboard hierarchy | VERIFIED_BRANCH | `codex/ux-3-owner-dashboard` |

## Detailed Precedents

### ZD-001 — Search input loses focus after each character

- Recorded: 2026-08-04
- Observed behavior: typing one character triggered a data refresh, the active
  search control was remounted and focus was lost before the next character.
- User impact: normal multi-character search was effectively unusable.
- Root cause class: query/filter state and unstable component identity were
  coupled to each keystroke.
- Actual scope: the correction touched shared debounce behavior and search
  state in Clients, Conversations, Deals, Leads, Outreach, Pricing and Tasks,
  plus the global search control.
- Correction: preserve stable input ownership, debounce query work without
  replacing the control and avoid state paths that remount the active input.
- Commit: `1b40d00 fix(frontend): keep page search inputs stable`.
- Durable regression status: `TEST_DEBT`. The defect is the reference case in
  `actual_docs/APP_FUNCTIONAL_CERTIFICATION.md`, but a dedicated cross-page
  typing/focus regression must still be retained in the final certification
  suite.
- Derived audit rule: every searchable page must accept a multi-character
  query without losing focus, selection, caret position or intermediate text.

### ZD-002 — Outbound Inbox bubble is unreadable and exposes internal failure UI

- Recorded: 2026-08-04
- Observed behavior: manager/bot bubbles used a saturated orange background;
  message content and raw provider error text were difficult to read, while
  persistent retry controls duplicated recovery actions.
- User impact: the primary conversation content became harder to scan and
  implementation details leaked into the merchant workspace.
- Actual scope: the shared message bubble and the conversation-list failed
  message action, not one isolated conversation.
- Correction: standard white message surfaces with dark text; remove raw
  provider error text, visible status pills and persistent retry buttons from
  the current UI. The backend retry capability remains available for a later
  permission-aware delivery-details design.
- Commit: `7284920 fix(inbox): simplify outbound message bubbles`.
- Verification: focused desktop Playwright coverage asserts readable manager
  and bot surfaces, absence of raw provider error text and absence of inline
  retry buttons; production build and bundle gate passed.
- Derived audit rule: merchant UI must show normalized human-readable failure
  states. Raw provider errors and technical recovery controls belong in a
  permission-aware detail surface, never in the primary message content.

### ZD-003 — CRM drawer appears empty after file picker cancellation

- Recorded: 2026-08-04
- Observed behavior: after opening the native file picker from a CRM card and
  canceling without selecting a file, only the sticky drawer header remained
  visible while tabs and entity context appeared empty.
- User impact: the user lost visual context and could reasonably assume the CRM
  card had crashed or discarded its state.
- Root cause class: the visually hidden file input participated in focus and
  scroll behavior inside a nested drawer. Native-dialog focus restoration could
  move the outer drawer scroll container while the header remained sticky.
- Actual scope: the shared attachment panel and shared Drawer primitive used by
  client, lead, deal and appointment CRM entities.
- Correction: use an explicit visible picker trigger with a non-focusable hidden
  input; handle native cancellation; restore trigger focus without scrolling;
  prevent the outer Drawer from becoming a scroll container; keep the tab row
  non-shrinkable.
- Commit: `f81cee7 fix(crm): preserve drawer after file picker cancel`.
- Verification: Playwright opened drawers from Leads, Clients and Deals,
  simulated cancellation, asserted preserved tabs/content/focus, then selected
  a real fixture file and asserted the normal selection path still worked. The
  full overlay suite passed on desktop and mobile; clean production build and
  bundle gate passed.
- Derived audit rule: canceling any browser/OS-mediated action must leave the UI
  in the same usable state as before it opened. This applies to file pickers,
  share dialogs, print dialogs, permission prompts and external OAuth windows.

### ZD-004 — Fallback surfaces can expose raw technical messages

- Recorded: 2026-08-18
- Type: `CONSISTENCY / TECHNICAL_LEAK`
- Status: `VERIFIED_BRANCH / EXTERNAL_AND_MANUAL_EVIDENCE_OPEN`
- Owner-observed surface: broad fallback/error review requested by the owner.
- Evidence: shared `getApiErrorMessage` can return raw response strings,
  backend `detail` and arbitrary key/value output; application and route error
  boundaries can render runtime `error.message` or `statusText`; several
  automation, outreach, pricing, developer and operations surfaces render raw
  error fields directly.
- User impact: the same failure can appear with different visuals and copy, and
  a merchant can receive English or technical implementation details without a
  clear recovery action.
- Actual scope: backend exception/persistence boundaries, frontend API error
  normalization, crash boundaries, page/query states, action feedback,
  background jobs, Inbox delivery and provider/integration status.
- Required correction: execute
  `actual_docs/UNIFIED_FALLBACK_EXPERIENCE_PLAN.md` and use one safe error
  taxonomy, one normalization layer, shared visual surfaces and
  permission-aware recovery.
- Verification status: BE-REM-004 closed the unknown backend `500` sub-gap.
  FB-002 then completed the shared taxonomy/retry envelope, response redaction,
  safe provider failure boundary and model-level sanitization for 15 persisted
  error-bearing model types. The complete 906-test backend gate plus static,
  security and frontend build/bundle gates passed on branch
  `codex/fallback-fb-002-safe-envelope-sanitization` at commit `079508d`.
  FB-003 then introduced the typed frontend `AppError` boundary, recognized all
  29 accepted backend codes before HTTP fallback, removed raw response parsing
  from `getApiErrorMessage`, bounded field/retry metadata and aligned shared
  action feedback with the same retry policy. Its focused tests, generated
  inventory, RU/KK/EN validation, production builds and bundle gate passed on
  `codex/fallback-fb-003-app-error-normalization`.
  FB-004 then completed one AppError-driven visual family for page, inline,
  permission, connectivity, form, toast and support-reference failures. Its
  focused policy tests, RU/KK/EN validation, production builds, bundle gate,
  manager gate and desktop/mobile browser review passed on
  `codex/fallback-fb-004-shared-fallback-surfaces` at commit `42f4779`.
  FB-005 then removed raw `error.message` and route `statusText` from the root
  application and router crash boundaries while retaining the original
  exception for monitoring. Focused policy tests, production builds, the
  manager gate and deliberate desktop/mobile browser crash injection passed on
  `codex/fallback-fb-005-safe-crash-route-boundaries` at commit `155cbb8`;
  technical SQL, path, token-marker and chunk-load strings reached the expected
  monitoring console only and were absent from the DOM/accessibility snapshots.
  FB-006 through FB-010 are now integrated in the working checkout: all shared
  notices delegate to `StatusNotice`; import-row and provider `reason` text is
  no longer rendered directly; RU/KK/EN parity, production build, bundle,
  desktop/mobile failure matrix, session recovery, visual audit and interaction
  audit pass. The committed-range full gate passed on `e65e0f4`. ZD-004
  remains open only for production-like live-provider evidence and manual
  screen-reader review.
- Derived audit rule: no merchant-visible component may render raw backend or
  runtime error text. Every failure must be normalized, localized, sanitized
  and paired with a safe next action when one exists.

### ZD-005 — Raw private-media URL bypasses entity-level scope

- Recorded: 2026-08-22.
- Type: `SECURITY / AUTHORIZATION`.
- Status: `VERIFIED_BRANCH`.
- Owner-observed surface: discovered by repository-wide security certification;
  the affected endpoint is the legacy local private-media download route.
- Role and prerequisites: authenticated operator in the same business as an
  owner, with a guessed or obtained storage path for an attachment linked to an
  owner-only task.
- Reproduction steps: create an owner-only task and attachment, authenticate as
  the operator, request the canonical attachment endpoint and then the raw
  `/api/files/private/...` endpoint.
- Expected behavior: both endpoints apply the attachment entity's OWN/TEAM scope
  and return `404` to the operator.
- Actual behavior: before remediation the canonical endpoint returned `404`,
  while the raw private-media endpoint returned `200` based only on business
  membership.
- User impact: a same-tenant user could read a private attachment outside their
  assigned entity scope if its storage path became known.
- Root cause class: authorization boundary divergence between two consumers of
  the same protected object.
- Actual cross-product scope: all local/private registered file attachments and
  every entity type resolved by `resolve_attachment_entity`.
- Correction: resolve the exact `FileAttachment` in the legacy route, require
  shared entity-aware attachment authorization, hide unauthorized/unregistered
  paths behind `404`, and audit legitimate downloads.
- Commit / branch: `codex/pre-pilot-sec-010-security-certification`.
- Verification commands and results: focused attachment suites `13/13`; full
  backend suite `944/944`; security dependency gate passed; remediation diff
  scan `30ad4502-d729-4009-af48-ae0acc1681e7` completed with `0` findings.
- Skipped checks and reason: frontend/browser gates were not rerun because the
  fix changes no frontend contract or UI; live object storage remains a
  deployment-environment gate.
- Remaining risk or test debt: production S3/object-storage bucket policy and
  signed-delivery behavior require live-environment certification.
- Derived audit rule: whenever one protected object has multiple download or
  view routes, prove that every route resolves the same object and applies the
  same object-level permission and audit boundary.

### ZD-006 — Ambiguous dashboard route and overloaded owner workspace

- Recorded: 2026-08-22.
- Type: `VISUAL / CONSISTENCY`.
- Status: `VERIFIED_BRANCH`.
- Owner-observed surface: authenticated merchant root `/app` and its owner/
  administrator dashboard.
- Role and prerequisites: authenticated owner or administrator with ordinary
  CRM, task, booking, conversation and analytics data.
- Reproduction steps: open `/app`, inspect the URL and scan the complete page at
  desktop width; then repeat on a narrow mobile viewport.
- Expected behavior: the dashboard has an explicit canonical URL and presents
  one fast management summary built from revenue availability, daily workload,
  urgent exceptions and team state.
- Actual behavior: the dashboard previously lived only at the generic `/app`
  root and repeated the same operational data across a large revenue surface,
  KPI cards, priority lists, entity lists and a permanent connector block.
- User impact: owners had no clear dashboard route, needed excessive scanning
  and could not distinguish decisions from low-value status detail.
- Root cause class: route identity drift plus an unbounded information budget.
- Actual cross-product scope: merchant router redirects, sidebar/mobile home
  links, route-sensitive E2E helpers and the owner/administrator dashboard.
- Correction: make `/app/dashboard` canonical with a safe `/app` redirect;
  reduce the page to four decision metrics and three compact actionable
  surfaces; deduplicate AI recommendations; show connectors only on failure;
  retain explicit no-data states and existing permission-aware destinations.
- Commit / branch: `codex/ux-3-owner-dashboard`.
- Verification commands and results: dashboard regression `1/1`; production
  build and `4680`-key i18n gate passed; bundle budget passed; canonical route
  E2E `1/1`; Playwright CLI desktop/mobile overflow `0` and console errors `0`;
  full interaction and visual audits produced no dashboard blocker.
- Skipped checks and reason: backend and migration suites were not rerun because
  the implementation changes no backend, persistence or API contract.
- Remaining risk or test debt: final owner product sign-off and UX-4 cross-role
  failure/empty-state certification remain separate gates.
- Derived audit rule: every primary workspace needs one canonical route, and
  every dashboard block must justify itself with a unique decision or action;
  repeated status detail belongs on the destination workspace.

## Regression Rule Catalogue

These rules are inputs to future functional certification and browser audits.

| Rule | Required probe | Relevant surfaces |
| --- | --- | --- |
| ZR-001 Stable typing | Enter at least 5 characters quickly; assert text, caret and focus survive async requests | Every internal/global search, filter text field and autocomplete |
| ZR-002 Cancel invariance | Open and cancel an action; assert entity, tab, draft, scroll context and focus remain usable | File picker, modal, drawer, share/print, OAuth and permission flows |
| ZR-003 Shared-layer blast radius | When one shared component fails, enumerate and test all consumers | CRM drawer, tables, filters, overlays, forms, notifications and API hooks |
| ZR-004 No technical leakage | Force provider/API failure; assert safe merchant copy and absence of raw errors/secrets | Inbox, integrations, automations, AI and imports |
| ZR-005 Recovery action placement | Assert retry/recovery appears once, is permission-aware and is shown only when actionable | Messages, integrations, imports, background jobs and sync states |
| ZR-006 Overlay continuity | Exercise Escape, backdrop, focus return, native dialogs and viewport changes | Drawers, dialogs, popovers, command palette and mobile navigation |
| ZR-007 Success-path preservation | After a defect fix, prove the original normal action still completes | Every remediated interaction |
| ZR-008 Canonical route and information budget | Assert one canonical URL, safe aliases and one unique decision per dashboard surface | Dashboard, overview and landing workspaces |

## Audit Expansion Matrix

When a new precedent matches a row below, the audit must expand automatically.

| Observed on one surface | Minimum expanded scope |
| --- | --- |
| Search/filter input | All pages using the shared debounce/query/filter hooks |
| CRM drawer or entity panel | Client, lead, deal, appointment and Task-linked entity drawers |
| Table/list row action | Desktop table, compact/mobile card and keyboard activation |
| Modal/dialog defect | All consumers of `Dialog` and the relevant focus-return behavior |
| Inbox message state | Manager, operator, bot/AI, inbound client, desktop and mobile thread views |
| Provider/integration failure | Card, setup flow, background status, retry path and sanitized error copy |
| Role-visible action | Owner, administrator, manager, operator and specialist plus backend denial |

## Entry Template

Copy this section for every new confirmed precedent:

```markdown
### ZD-XXX — Short defect name

- Recorded:
- Type:
- Status:
- Owner-observed surface:
- Role and prerequisites:
- Reproduction steps:
- Expected behavior:
- Actual behavior:
- User impact:
- Root cause class:
- Actual cross-product scope:
- Correction:
- Commit / branch:
- Verification commands and results:
- Skipped checks and reason:
- Remaining risk or test debt:
- Derived audit rule:
```

## Maintenance Contract

- Add an entry when a defect is confirmed, not after memory has faded.
- Update the same entry as it moves from report to verification and integration.
- Do not duplicate the defect in a new historical plan.
- Link to existing execution/certification documents instead of copying their
  full task lists.
- Do not include customer secrets, credentials or unnecessary personal data.
- During final certification, unresolved `REPORTED`, `CONFIRMED`,
  `FIXED_BRANCH` and `TEST_DEBT` entries must be reviewed explicitly.
