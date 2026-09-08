# ZANI Unified Fallback And Error Experience Plan

- Status: **ACTIVE / IN EXECUTION**
- Created: 2026-08-18
- Scope: merchant-visible errors, recovery actions, loading/empty/offline states, backend error contracts and technical-detail isolation
- Execution state: **FB-001..FB-007 DONE / FB-008 LIVE-PROVIDER EVIDENCE OPEN / FB-009 MANUAL SCREEN-READER OPEN / FB-010 DONE**
- Owner: ZANI manager workflow

## Product Outcome

A ZANI user must never need to understand HTTP, Django, provider payloads, tokens, serializers, stack traces or internal status names to recover from a problem.

Every fallback must answer three questions in plain language:

1. What happened?
2. What was preserved or not completed?
3. What can the user do next?

The target experience is:

```text
backend stable error code
  -> frontend normalized application error
  -> one consistent visual surface
  -> one safe recovery action
  -> technical evidence in logs/support only
```

Creating this document does not authorize implementation. Execution starts only after explicit owner approval and follows the phase stop gate.

## Non-Goals

- no new CRM feature;
- no decorative error illustrations or marketing copy;
- no raw provider console inside daily merchant workflows;
- no automatic retry of unsafe or non-idempotent mutations;
- no replacement of field validation with generic toast messages;
- no hiding of genuine data-loss risk behind vague success-like wording;
- no production monitoring setup without approved external services.

## Current Confirmed Foundation

The project already contains useful reusable pieces:

| Layer | Existing mechanism | Current value |
| --- | --- | --- |
| API contract | `apps/core/exceptions.py` | stable `code`, `request_id`, `detail`, `errors`, `category`, `retryable` and `retry_after_seconds` for known DRF/domain errors and unknown `internal_error` failures |
| Domain failures | `apps/core/domain_errors.py` | explicit conflict, unavailable, disabled and temporary-service codes |
| Secret redaction | `apps/core/sanitization.py`, `apps/integrations/sanitization.py` | removes common credentials from error text and nested payloads at response and model-persistence boundaries |
| Authentication recovery | `frontend/src/api/client.ts` | single-flight refresh and one retry after `401` |
| Query recovery | React Query defaults | reconnect refetch and one retry for network/5xx reads |
| Action feedback | `useActionFeedback` | status classification, safe generic copy, optional retry and focus restoration |
| Notifications | `NotificationProvider` | consistent success/info/warning/danger toast with ARIA behavior |
| Page states | `LoadingState`, `ErrorState`, `ForbiddenState`, `EmptyState` | reusable loading, failure, access and zero-data surfaces |
| Crash containment | `AppErrorBoundary`, `RouteErrorBoundary` | prevents a blank application after component/route failure |
| Destructive recovery | `ActionConfirmProvider`, `UndoToastProvider` | confirmation, reason capture and undo where implemented |
| Integration mapping | `merchantSafeIntegrationError` | converts common provider failures to merchant-safe copy |
| Async delivery | outbox/retry/status layers | retains failed work and supports controlled retry |

No native `window.alert` or `window.confirm` usage was confirmed by the source scan. The project already prefers application-owned surfaces.

## Confirmed Consistency Gaps

### 1. Raw API content can reach users

`getApiErrorMessage` currently:

- returns a raw string response;
- returns raw backend `detail`;
- formats arbitrary response objects as `key: value` text;
- falls back to a hard-coded English sentence.

It is referenced across 46 frontend files, so changing it requires a planned migration and regression coverage rather than a narrow one-page fix.

### 2. Crash boundaries expose runtime messages

`AppErrorBoundary` displays `error.message`. `RouteErrorBoundary` can display `statusText` or `error.message`. These values may contain component names, library messages, paths or provider details and must not be merchant-facing.

### 3. Shared action feedback is not universal

The audit found:

- `useActionFeedback` in 12 files;
- direct `notifyError` usage in 8 files;
- `getApiErrorMessage` in 46 files;
- `ErrorState` across 57 files.

This is evidence of a good shared layer with incomplete adoption. The same failure can therefore appear as a toast, raw inline text, generic red block or route crash depending on the page.

### 4. Technical fields are rendered directly

Confirmed raw or weakly normalized surfaces include:

- automation run `error` values;
- platform operations `last_error` and `error` values;
- outreach recipient `error_code`;
- pricing sync log `error`;
- developer webhook delivery `error`;
- some import, analytics, auth, bot, settings and CRM drawer paths using raw `getApiErrorMessage` output.

Platform/support users may need technical evidence, but it must live behind a separate permission-aware detail view. A daily merchant surface must not render the same field directly.

### 5. Backend persistence and response boundaries are sanitized

FB-002 added a shared text/payload sanitizer and model-level save boundary for 15 error-bearing model types. Remaining `str(exc)` uses are limited to controlled provider-configuration messages, sanitized persistence backed by that model boundary, internal exception chaining or management-command output. Merchant API paths now use explicit domain/validation errors or safe provider failure copy. Frontend surfaces that still render sanitized technical fields directly remain migration work for FB-003 through FB-006.

### 6. Backend taxonomy is complete; frontend normalization remains

BE-REM-004 and FB-002 now guarantee a safe envelope for unknown and known API failures, correlate the response, structured log and configured Sentry capture by request ID, and expose bounded taxonomy/retry metadata without exception text, stack traces, SQL, payloads or provider responses. Mapping this contract into one frontend `AppError` model remains FB-003.

### 7. Recovery placement varies

Some operations offer retry inline, some in a toast, some in a card and some do not expose recovery. Retry must appear once, only when actionable, and only for users with permission to perform it.

## Canonical Error Model

### Backend envelope

Every API error must return the same safe structure:

```json
{
  "code": "schedule_conflict",
  "category": "conflict",
  "request_id": "public-support-reference",
  "detail": "Safe non-localized API fallback for non-browser clients.",
  "errors": {
    "start_at": ["Choose another time."]
  },
  "retryable": false,
  "retry_after_seconds": null
}
```

Rules:

- `code` is stable and drives frontend localization;
- `category` controls presentation and default recovery policy;
- `detail` is safe but is not the primary browser copy source;
- `errors` contains field-safe validation only;
- `request_id` is a support reference, not a stack trace;
- `retryable` is decided by the backend/domain policy, not guessed from text;
- `retry_after_seconds` is present for throttling or controlled temporary failures;
- raw exception, provider response, SQL, path and credential data never appear.

### Frontend application error

Introduce one normalized internal model, for example:

```ts
type AppError = {
  code: string;
  kind:
    | "validation"
    | "authentication"
    | "permission"
    | "not_found"
    | "conflict"
    | "rate_limit"
    | "offline"
    | "temporary"
    | "provider"
    | "internal";
  titleKey: string;
  messageKey: string;
  fieldErrors: Record<string, string[]>;
  retryable: boolean;
  retryAfterSeconds?: number;
  requestId?: string;
};
```

One `normalizeAppError(error, context)` function must replace raw parsing in components. Unknown values always become safe `internal` or `temporary` copy.

## Error And Recovery Taxonomy

| Category | User meaning | Default recovery | Automatic retry |
| --- | --- | --- | --- |
| validation | entered data needs correction | focus first invalid field | never |
| authentication | session ended or login is required | sign in and preserve intended route | refresh once, then stop |
| permission | role or business settings do not allow the action | explain access boundary; return safely | never |
| not found | record was removed or is no longer available | return to current list and refresh | never |
| conflict | data changed or requested state is no longer valid | refresh current entity; repeat deliberately | only safe reads |
| rate limit | too many attempts | show wait time when known | after server-provided delay only |
| offline/network | browser cannot reach ZANI | preserve local draft; retry after reconnect | safe reads once |
| temporary server | ZANI could not complete the operation | retry once if idempotent | controlled only |
| provider | external channel is unavailable | preserve work; retry/repair from one owned surface | queue policy only |
| internal | unexpected application failure | reload section, return home or contact support | never blindly |

## Surface Selection Standard

| Situation | Required surface | Required action |
| --- | --- | --- |
| invalid form field | inline field message plus form summary when needed | focus first invalid field |
| failed button/mutation, page remains usable | toast | retry only when safe and supplied |
| one widget/query failed | inline fallback card inside the widget | retry section |
| primary page data unavailable | full content-area fallback | retry page, back or home |
| user lacks access | forbidden state | safe navigation, no retry |
| session expired | non-technical session notice then login | sign in; preserve destination |
| offline | persistent global connectivity banner | retry automatically on reconnect for reads |
| background job failed | status center/detail drawer | inspect safe reason, retry if permitted |
| provider delivery failed | normalized delivery state/details | retry once from one permission-aware location |
| destructive action | confirmation dialog before action | cancel or explicit confirm; reason when required |
| reversible destructive action | success toast with undo | undo within defined window |
| React/route crash | safe error boundary | reload section/page or return to workspace |

## Visual Standard

All fallback surfaces must use the existing ZANI design system.

Required anatomy:

1. recognizable icon;
2. short human title;
3. one sentence explaining impact;
4. one primary recovery action when available;
5. optional secondary navigation action;
6. optional collapsible support reference, never raw technical content.

Rules:

- do not rely on color alone;
- reserve strong red for failed/destructive states;
- use warm warning styling for recoverable attention states;
- keep copy readable on white/warm surfaces;
- do not stack several error boxes for the same cause;
- do not cover the user's draft or entity context unnecessarily;
- preserve focus, scroll, selected row, open drawer and unsaved input;
- toast width, spacing, iconography, radius and shadow follow shared tokens;
- all controls have keyboard focus and screen-reader labels;
- `role="alert"` is used only for urgent failures; routine status uses polite announcements.

## Copy Standard

### Required formula

```text
Outcome + preservation + next action
```

Examples:

- `Не удалось сохранить изменения. Данные в форме сохранены. Повторите через несколько секунд.`
- `Соединение прервалось. Текст ответа сохранён. Отправьте его после восстановления связи.`
- `Эта запись изменилась в другой вкладке. Обновите данные перед повторным сохранением.`
- `У вашей роли нет доступа к этому действию. Обратитесь к владельцу или администратору.`
- `Канал временно недоступен. Сообщение сохранено и будет доступно для повторной отправки.`
- `Сессия завершилась. Войдите снова, чтобы продолжить с этой страницы.`

Forbidden merchant-facing terms unless they are a real product concept:

```text
500, 502, payload, serializer, traceback, exception, stack, undefined, null,
token, API key, webhook signature, database, Celery, Redis, S3, provider SDK,
constraint, IntegrityError, object ID, Python/React component name
```

Do not promise that data is preserved unless the application can prove it.

All copy must exist in RU, KK and EN dictionaries. A missing translation must fall back to a safe localized generic message, never an i18n key.

## Recovery Action Policy

A `Повторить` action is allowed only when:

- the operation is idempotent or protected by an idempotency key;
- repeating cannot create a duplicate entity/message/payment/action;
- the user still has permission;
- prerequisite data has not become stale;
- the backend marks the error retryable or the frontend owns a proven safe read retry;
- the action is shown in one place only.

Never offer blind retry for:

- invalid fields;
- expired or missing permissions;
- destructive actions;
- unknown transaction outcome;
- authentication failures beyond the single refresh attempt;
- conflicts that require the user to review changed data.

Other valid recovery actions:

- `Исправить поля`;
- `Обновить данные`;
- `Вернуться к списку`;
- `Войти снова`;
- `Открыть настройки канала`;
- `Связаться с администратором`;
- `Скопировать код обращения`;
- `Отменить` / `Вернуть`.

## Technical Detail Isolation

Merchant UI receives safe categories and copy only.

Full technical evidence belongs in:

- structured server logs;
- Sentry with release and request ID;
- audited platform/support operations;
- provider delivery/sync detail views accessible only to authorized roles;
- development tools outside the authenticated merchant workflow.

Even platform/support views must sanitize credentials and personal data. A request ID may be shown to the merchant as `Код обращения`, preferably behind `Подробнее`, with a copy button. It must not disclose an internal database ID.

## Execution Queue

| ID | Work item | Priority | Status | Depends on |
| --- | --- | --- | --- | --- |
| FB-001 | Build route/action/failure inventory and error-code registry | P0 | DONE | none |
| FB-002 | Complete the backend safe envelope and sanitization boundary | P0 | DONE | BE-REM-004 |
| FB-003 | Introduce `AppError` normalization and retire raw parsing | P0 | DONE | FB-001..002 |
| FB-004 | Build the shared visual fallback surface family | P0 | DONE | FB-003 |
| FB-005 | Remove raw messages from crash and route boundaries | P0 | DONE | FB-003..004 |
| FB-006 | Migrate direct technical-error consumers | P0 | DONE | FB-003..005 |
| FB-007 | Standardize session, connectivity and draft preservation | P1 | DONE | FB-003..004 |
| FB-008 | Standardize async job, provider and Inbox delivery recovery | P1 | INTEGRATED RUNTIME PASS - live-provider evidence open | FB-002..007 |
| FB-009 | Complete RU/KK/EN copy and accessibility review | P1 | INTEGRATED BROWSER PASS - manual screen-reader review open | FB-004..008 |
| FB-010 | Run cross-role browser failure certification | P1 | DONE - matrix, visual, interaction and committed-range gates pass | FB-001..009 |

## FB-001 - Inventory And Error-Code Registry

- enumerate every route, query, mutation, background job and provider status;
- record current loading, empty, denied, failure and recovery surfaces;
- map backend codes to one category and one localized frontend copy family;
- identify operations with idempotency guarantees;
- identify permission owner and intended retry location;
- link all known defect precedents from `DEFECT_KNOWLEDGE_BASE.md`.

Deliverable: a machine-readable registry or typed source file plus a generated human-readable report. Do not maintain two manual truth sources.

## FB-002 - Backend Safe Envelope

- extend the completed BE-REM-004 unknown-500 contract with the remaining shared taxonomy fields;
- add `category`, `retryable` and `retry_after_seconds` consistently;
- sanitize all stored provider/import/automation error text;
- replace merchant-facing `str(exc)` with explicit domain errors;
- preserve full exception evidence only in logs/monitoring;
- add contract, redaction and correlation tests.

## FB-003 - Frontend Normalization

- introduce `normalizeAppError` and typed `AppError`;
- map stable backend codes before HTTP status;
- use status/network classification only as a safe fallback;
- remove raw string/object formatting from `getApiErrorMessage`;
- ensure unknown errors become localized safe copy;
- make field errors available without exposing unrelated response fields.

## FB-004 - Shared Surface Family

Reuse and extend existing primitives rather than duplicating them:

- `ActionFeedbackToast` for action results;
- `InlineFallback` for a failed block;
- `PageFallback` for primary page failure;
- `ForbiddenState` for access denial;
- `ConnectivityBanner` for offline/reconnect state;
- `FieldErrorSummary` for forms;
- `RecoveryDetails` for support reference;
- existing confirm and undo providers for destructive recovery.

The final component names may differ, but all variants must consume the same `AppError` model and tokens.

## FB-005 - Crash And Route Boundaries

- never render `error.message` or `statusText` to merchants;
- capture the original error to monitoring;
- show localized generic copy and safe navigation;
- provide reload only when it is the correct recovery;
- add component and browser tests with deliberately technical thrown messages;
- assert that the technical string appears in monitoring mocks but not in DOM.

## FB-006 - Direct Consumer Migration

Audit and migrate at minimum:

- Automations;
- Platform Operations;
- Outreach;
- Pricing;
- Developer webhook deliveries;
- Tasks;
- Authentication and invitation pages;
- Analytics and AI assistant;
- Bot details;
- Settings and account security;
- CRM attachment/drawer mutations;
- import/export and integration setup.

Each migration must preserve useful domain context while removing raw technical text. Platform detail views may expose sanitized diagnostics only behind explicit permission and audit.

## FB-007 - Session, Connectivity And Draft Preservation

- add a consistent session-expired notice before/at login redirect;
- preserve intended destination;
- define what unsaved drafts can be retained safely;
- add online/offline/reconnecting state;
- refetch safe reads on reconnect;
- never retry a mutation unless idempotency is proven;
- test multiple simultaneous `401` responses and single-flight refresh.

## FB-008 - Async And Provider Recovery

- unify statuses for queued, sending, delivered, delayed, failed and retrying;
- keep raw provider error outside the primary Inbox bubble;
- show one permission-aware retry action in delivery details or status center;
- retain failed drafts/messages/jobs when possible;
- explain whether retry is automatic, scheduled or manual;
- prevent duplicate message/job creation;
- add provider-unavailable, timeout, rate-limit, expired-credential and webhook failure fixtures.

## FB-009 - Localization And Accessibility

- complete RU, KK and EN error catalog parity;
- prohibit hard-coded English generic errors;
- verify icon plus text, contrast, focus restoration and keyboard actions;
- verify `aria-live` priority and avoid duplicate announcements;
- keep mobile fallback actions reachable without horizontal overflow;
- run reduced-motion and screen-reader-oriented checks where practical.

## FB-010 - Failure Certification

For each critical merchant journey, force:

- success;
- empty data;
- validation failure;
- permission denial;
- not found;
- conflict;
- rate limit;
- offline/network failure;
- temporary server failure;
- provider failure;
- session expiry;
- unexpected component/route failure.

Run the matrix for owner, administrator, manager, operator and specialist where the route is applicable, on desktop and mobile. Assert visible copy, recovery, focus/context preservation, absence of raw technical terms and backend tenant denial.

## Required Automated Gates

### Backend

```powershell
.\.venv\Scripts\python.exe manage.py test apps.core.tests_b3_contracts -v 2
.\.venv\Scripts\python.exe manage.py test apps.integrations apps.conversations apps.automations -v 2
.\.venv\Scripts\python.exe manage.py test -v 2
.\.venv\Scripts\python.exe manage.py check
```

### Frontend

```powershell
Set-Location frontend
npm run build
npm run check:bundle
npm run audit:interaction
npm run audit:visual
```

### Required security assertions

- no token/secret/provider payload in API failure bodies;
- no stack trace, exception class, technical thrown message or raw response object in merchant DOM;
- request IDs correlate response, logs and monitoring;
- retry cannot duplicate critical mutations;
- forbidden and cross-tenant failures do not reveal object existence.

## Manager Gates

### Gate F-A - Contract

- FB-001 through FB-003 complete;
- backend and frontend share one stable taxonomy;
- unknown errors are safe.

### Gate F-B - Presentation

- FB-004 through FB-009 complete;
- all known raw consumers are migrated;
- RU/KK/EN and accessibility gates pass.

### Gate F-C - Certification

- FB-010 complete;
- every critical journey has failure/recovery evidence;
- defect rules ZR-002, ZR-004, ZR-005, ZR-006 and ZR-007 pass;
- remaining unsupported scenarios are explicitly documented.

## Definition Of Done

The unified fallback layer is complete only when:

- every API error follows the safe envelope;
- every merchant-facing error goes through `AppError` normalization;
- no raw `detail`, `error`, `last_error`, `error_code`, `statusText` or runtime `error.message` is rendered in merchant UI;
- recovery appears once and is safe, permission-aware and context-aware;
- loading, empty, forbidden, offline, conflict, temporary and fatal states use the same visual language;
- user draft/entity/focus context is preserved whenever technically possible;
- RU, KK and EN copy is complete;
- backend, frontend and browser failure matrices are green;
- exact checks, skipped checks and residual risks are recorded;
- final browser evidence is reviewed before the phase is closed.

## Evidence Log

The fallback execution queue is active. The prerequisite backend item has the following accepted evidence:

```text
Task: BE-REM-004 prerequisite - unknown API 500 contract
Affected routes/actions: every DRF API view that raises an unknown exception or a non-domain 5xx APIException
Branch: codex/backend-rem-004-safe-api-envelope
Commits: b1d554c, c3241e9
Backend error codes changed: unknown failures now use internal_error; known domain/4xx codes are unchanged
Frontend surfaces changed: none
Checks run and exact result: focused contract/rollback tests passed; backend 872/872 passed; frontend build/bundle passed; browser mobile role smoke 2/2 passed; Python/npm security audits passed with 0 known vulnerabilities
Checks skipped and reason: no constituent deterministic gate skipped
Role/tenant impact: no permission or tenant behavior changed; complete suite remained green
Residual risk: FB-002 through FB-010 remain NOT_STARTED; target-environment Sentry delivery requires a real configured DSN
```

Add one entry per completed fallback item:

```text
Task:
Affected routes/actions:
Branch:
Commit:
Backend error codes changed:
Frontend surfaces changed:
Checks run and exact result:
Checks skipped and reason:
Role/tenant impact:
Residual risk:
```

```text
Task: FB-001 - route/action/failure inventory and error-code registry
Affected routes/actions: all 43 registered public, merchant and platform route entries; 580 distinct frontend API query/mutation contracts; 13 Celery tasks; 83 async/provider status values across 15 models
Branch: codex/fallback-fb-001-registry
Commit: 6f44856
Backend error codes changed: none; 27 current stable codes are classified into the shared fallback taxonomy and localized copy families
Frontend surfaces changed: none at runtime; added a source-derived machine-readable policy registry, completeness guard and generated report at actual_docs/UNIFIED_FALLBACK_INVENTORY.generated.md
Checks run and exact result: npm run test:fallback-inventory -> 2/2 passed; npm run check:fallback-inventory -> 43 routes, 580 API operations, 13 tasks, 83 statuses and 27 codes; npm run check:certification -> 43 entries cover 81 declarations / 77 unique paths; npm run build -> 4662 i18n keys across RU/KK/EN and both application/widget builds passed; npm run check:bundle -> no chunk above 500 kB and app shell below 400 kB; codex_verify.py --mode static --base-ref dade26f -> PASS with no migration drift, clean Django system check and clean committed-range diff
Checks skipped and reason: backend and browser gates skipped because FB-001 changes inventory/test/docs tooling only and does not change API or merchant runtime behavior
Role/tenant impact: no permission or tenant behavior changed; every inventory entry records its permission owner and intended recovery location
Residual risk: FB-002 through FB-010 remain unfinished; current route surface detection records migration gaps but does not remediate them
```

```text
Task: FB-002 - backend safe envelope and sanitization boundary
Affected routes/actions: shared DRF exception handler; public API token authentication; merchant validation/domain failures in scheduling, Inbox, leads, outreach, analytics, AI, imports and integration setup; provider delivery/validation for Telegram, WhatsApp, Instagram, Kaspi, Ozon, Wildberries and MoySklad; persistence boundaries for 15 error-bearing model types
Branch: codex/fallback-fb-002-safe-envelope-sanitization
Commits: c9bc8d5, 079508d
Backend error codes changed: every safe envelope now includes category, retryable and retry_after_seconds; unknown failures remain internal_error; validation/authentication/permission/not-found/rate-limit and explicit domain codes retain stable HTTP semantics; arbitrary non-validation payload keys are dropped
Frontend surfaces changed: none at runtime; the documented API action contract now includes the complete backend error envelope consumed by the future FB-003 normalizer
Checks run and exact result: focused fallback, redaction, persistence, provider and compatibility tests passed; codex_verify.py --mode backend --base-ref 8a7eba1 -> 906/906 tests passed with no migration drift and clean Django system check; codex_verify.py --mode static -> PASS; codex_verify.py --mode security -> PASS including hashed Python lock dry-runs, pip-audit and npm audit at moderate threshold; codex_verify.py --mode frontend -> PASS including production application/widget builds and bundle budget
Checks skipped and reason: browser failure-injection matrix skipped because FB-002 changes backend contracts and persistence only; cross-role browser certification is explicitly FB-010 after frontend normalization and shared recovery surfaces exist
Role/tenant impact: no permission, tenant scoping or successful CRM workflow changed; full backend suite and frontend build remained green; malformed/revoked public API tokens preserve safe 401 behavior
Residual risk: ZD-004 remains open at the product level because frontend raw parsing, crash boundaries, direct technical-field consumers, recovery surfaces, localization and browser failure injection remain FB-003 through FB-010
```

```text
Task: FB-003 - frontend application-error normalization
Affected routes/actions: all frontend callers of getApiErrorMessage; shared useActionFeedback action failures; the generated route/action/failure inventory and its stable error-code registry
Branch: codex/fallback-fb-003-app-error-normalization
Commits: f36cc1e plus the follow-up evidence commit
Backend error codes changed: none; the frontend runtime registry now recognizes all 29 accepted backend codes, including ownership_conflict and invitation_account_authentication_required, and maps a known code before HTTP status
Frontend surfaces changed: getApiErrorMessage now returns localized safe category copy instead of raw strings, backend detail or arbitrary object formatting; typed AppError exposes bounded fieldErrors, requestId and retry metadata; shared action feedback offers retry only when the normalized policy permits it
Checks run and exact result: npm run test:app-error -> 6/6 passed; npm run test:action-feedback -> 2/2 passed; npm run check:i18n -> 4665 keys across RU/KK/EN; npm run generate:fallback-inventory and npm run check:fallback-inventory -> 43 routes, 581 API operations, 13 tasks, 83 statuses and 29 codes; npm run test:fallback-inventory -> 2/2 passed; npm run build -> TypeScript plus application/widget production builds passed; npm run check:bundle -> no JS chunk above 500 kB and app shell below 400 kB; codex_verify.py --mode frontend --base-ref c113e3eb620da90c4952ea7e969ddee5a54326ae -> QUALITY GATE PASSED with deterministic npm ci (0 vulnerabilities), gate-environment policy 1/1, no migration drift, clean Django check, application/widget builds and bundle budget; git diff --check -> clean
Checks skipped and reason: backend and browser suites skipped because FB-003 changes only shared frontend error normalization and policy; visual failure surfaces are FB-004, crash-boundary browser behavior is FB-005 and the cross-role failure matrix is FB-010
Role/tenant impact: no backend permission, tenant scoping, notification, BusinessEvent, AI, schema, dependency or environment behavior changed
Residual risk: ZD-004 remains CONFIRMED overall; shared visual surfaces, crash boundaries, direct technical-field consumers, session/connectivity/draft recovery, provider recovery, accessibility/copy review and browser failure certification remain FB-004 through FB-010
```

```text
Task: FB-004 - shared visual fallback surface family
Affected routes/actions: shared action feedback notifications and every current or future frontend consumer of the common page, inline, permission, connectivity, form-field and support-reference fallback primitives
Branch: codex/fallback-fb-004-shared-fallback-surfaces
Commit: 42f4779
Backend error codes changed: none; all surfaces consume the existing typed AppError contract and its 29 accepted codes
Frontend surfaces changed: added InlineFallback, PageFallback, PermissionFallback, ConnectivityBanner, FieldErrorSummary and RecoveryDetails; ForbiddenState delegates to the permission surface; ActionFeedbackToast and useActionFeedback consume AppError directly; added RU/KK/EN copy and a browser fixture covering the complete family
Checks run and exact result: npm run test:fallback-surfaces -> 4/4 passed; npm run test:app-error -> 6/6 passed; npm run test:action-feedback -> 2/2 passed; npm run check:i18n -> 4677 keys across RU/KK/EN; npm run check:fallback-inventory -> 43 routes, 581 API operations, 13 tasks, 83 statuses and 29 codes; npm run test:fallback-inventory -> 2/2 passed; npm run build -> TypeScript plus application/widget production builds passed; npm run check:bundle -> no JS chunk above 500 kB and app shell below 400 kB; Playwright CLI desktop 1280x720 and mobile 390x844 visual/interaction review -> all required surfaces and recovery actions rendered without overflow, request-ID disclosure was bounded to support-reference-7, clipboard and toast interactions passed, console errors 0; codex_verify.py --mode frontend --base-ref 91178a4c1321ce6daf8246395ceca43afc820148 -> QUALITY GATE PASSED with deterministic npm ci (0 vulnerabilities), gate-environment policy 1/1, no migration drift, clean Django check, application/widget builds and bundle budget; git diff --check -> clean
Checks skipped and reason: full backend suite skipped because FB-004 changes only shared frontend presentation and uses the already accepted AppError contract; app/route crash injection is FB-005, direct-consumer migration is FB-006, session/connectivity/draft behavior is FB-007 and the full cross-role failure matrix is FB-010
Role/tenant impact: no backend permission, tenant scoping, schema, dependency, environment, notification delivery, BusinessEvent or AI behavior changed; access-denied presentation remains driven by the existing authorization result
Residual risk: ZD-004 remains CONFIRMED overall; crash boundaries, direct technical-field consumers, session/connectivity/draft recovery, provider recovery, final accessibility/copy review and browser failure certification remain FB-005 through FB-010
```

```text
Task: FB-005 - safe application and route crash boundaries
Affected routes/actions: the root AppErrorBoundary around all providers and application routes; every router errorElement using RouteErrorBoundary; deliberate component and route crash fixtures
Branch: codex/fallback-fb-005-safe-crash-route-boundaries
Commit: 155cbb8
Backend error codes changed: none; route failures reuse the typed AppError categories and never enable blind retry
Frontend surfaces changed: AppErrorBoundary no longer stores or renders runtime error.message; RouteErrorBoundary no longer renders error.message or statusText; both reuse the FB-004 page fallback layout, retain safe reload/back/home recovery and send the original error to monitoring; added a localized route title in RU/KK/EN
Checks run and exact result: npm run test:error-boundaries -> 3/3 passed; npm run test:fallback-surfaces -> 4/4 passed; npm run test:app-error -> 6/6 passed; npm run test:action-feedback -> 2/2 passed; npm run check:i18n -> 4678 keys across RU/KK/EN; npm run check:fallback-inventory -> 43 routes, 581 API operations, 13 tasks, 83 statuses and 29 codes; npm run test:fallback-inventory -> 2/2 passed; npm run build -> TypeScript plus application/widget production builds passed; npm run check:bundle -> no JS chunk above 500 kB and app shell below 400 kB; Playwright CLI desktop and mobile 390x844 failure injection -> application and route fallbacks rendered without overflow, the monitoring probe received the original SQL/path error, the two expected React/monitoring console errors were captured, and SQLSTATE, private path, token marker and ChunkLoadError were absent from DOM/accessibility snapshots; codex_verify.py --mode frontend --base-ref 548793cd55fc749a7ab0f305a4d54f64c58902cf -> QUALITY GATE PASSED with deterministic npm ci (0 vulnerabilities), gate-environment policy 1/1, no migration drift, clean Django check, application/widget builds and bundle budget; git diff --check -> clean
Checks skipped and reason: full backend suite skipped because FB-005 changes only frontend crash presentation and monitoring handoff; direct technical-field consumers are FB-006, session/connectivity/draft behavior is FB-007, provider recovery is FB-008 and the full cross-role failure matrix is FB-010
Role/tenant impact: no backend permission, tenant scoping, schema, dependency, environment, notification delivery, BusinessEvent or AI behavior changed; the original exception remains available to configured monitoring but never to the merchant DOM
Residual risk: ZD-004 remains CONFIRMED overall; direct technical-field consumers, session/connectivity/draft recovery, provider recovery, final accessibility/copy review and browser failure certification remain FB-006 through FB-010
```

```text
Task: FB-006 - direct technical-error consumer migration
Working tree: codex/ux-3-owner-dashboard @ f142f3e498e4726320fc7de0b6ad0cc27187c57f (uncommitted)
Backend error codes changed: none
Frontend surfaces changed: authentication now distinguishes invalid credentials from login bootstrap failure; Automations, Platform Operations, Outreach, Pricing and Developer delivery views use localized safe copy for technical failure fields; the existing platform-admin diagnostic boundary remains permission-scoped; fallback consumers retain normalized AppError policy.
Checks run and exact result: npm run test:login-page -> 14/14 passed; npm run test:app-error -> 6/6 passed; npm run test:fallback-surfaces -> 4/4 passed; npm run check:i18n -> 4687 keys at the FB-006 checkpoint and 4703 keys in the final integrated checkout; npm run check:fallback-inventory -> 43 routes, 581 API operations, 13 tasks, 83 statuses and 29 error codes; npm run build -> TypeScript plus application/widget production builds passed; npm run check:bundle -> no JS chunk above 500 kB and app shell below 400 kB; git diff --check -> exit 0 with line-ending normalization warnings only.
Checks skipped and reason: audit:interaction and audit:visual were intentionally skipped because the owner excluded point 2 Critic UI/UX; full Django/codex_verify and browser failure matrix remain part of FB-010/FC-008.
Role/tenant impact: no permission grant or tenant scope changed; login route preservation remains in the existing router state flow.
Residual risk: clean commit-range evidence and cross-role browser proof remain open.
```

```text
Task: FB-007 - session, connectivity and draft preservation
Working tree: codex/ux-3-owner-dashboard @ f142f3e498e4726320fc7de0b6ad0cc27187c57f (uncommitted)
Backend error codes changed: none
Frontend surfaces changed: refresh expiry writes a one-shot session notice consumed by LoginPage; protected-route destination remains preserved; AppProviders now mounts a global offline/reconnecting banner; React Query continues safe read refetch on reconnect and the banner retry refetches active reads only; the existing Inbox composer session draft is preserved per business/conversation and no password/token/attachment is stored by this change.
Checks run and exact result: npm run test:login-page -> 14/14 passed; npm run check:i18n -> 4687 keys at the FB-007 checkpoint and 4703 keys in the final integrated checkout; npm run test:fallback-surfaces -> 4/4 passed; npm run build -> application/widget builds passed; npm run check:bundle -> budget passed; manage.py check -> no issues.
Checks skipped and reason: multi-401 browser injection, full cross-role session matrix, visual/interaction audits and full Django suite were not accepted as complete; the combined apps.bots/apps.conversations run timed out at 124 seconds, while the targeted backend labels passed.
Role/tenant impact: no permission or tenant scope changed; auth-expiry notice is generated only after protected-request refresh failure.
Residual risk: browser proof of simultaneous 401 single-flight behavior and reconnect UI is still open.
```

```text
Task: FB-008 - async/provider and Inbox delivery recovery
Working tree: codex/ux-3-owner-dashboard @ f142f3e498e4726320fc7de0b6ad0cc27187c57f (uncommitted)
Backend error codes changed: none; the existing outbox/retry/idempotency contract is consumed by the frontend.
Frontend surfaces changed: send and manual retry requests now pass Idempotency-Key; Inbox types accept backend delivering/retry_scheduled metadata; delivery states normalize to queued, sending, delivered, delayed, retrying and failed; a single permission-aware retry action is exposed in MessageDeliveryDetails, while the primary MessageBubble continues to omit raw provider error text and retry controls.
Checks run and exact result: npm run test:inbox-delivery -> 2/2 passed; npm run check:i18n -> 4703 keys; npm run build -> TypeScript plus application/widget production builds passed; npm run check:bundle -> no JS chunk above 500 kB and app shell below 400 kB; targeted Django labels for outbound retry/send/retry-idempotency/inbox-task-idempotency -> 5/5 passed; manage.py check -> no issues.
Checks skipped and reason: full apps.bots/apps.conversations suite timed out at 124 seconds; provider fault fixture matrix and cross-role browser certification remain open; audit:interaction and audit:visual remain intentionally skipped under the excluded point 2.
Role/tenant impact: retry is gated by the existing conversations:update permission; server-side retry idempotency and tenant-scoped conversation lookup remain authoritative.
Residual risk: live provider failure fixtures, delivery-details browser proof and final FC-008 clean-range gate remain open.
```

```text
Task: FB-009 - RU/KK/EN copy and accessibility surface pass
Working tree: codex/ux-3-owner-dashboard @ f142f3e498e4726320fc7de0b6ad0cc27187c57f (uncommitted)
Frontend surfaces changed: added RU/KK/EN login, connectivity and delivery-recovery copy; session and connectivity surfaces use polite status announcements; recovery icons have text labels and animated indicators respect reduced-motion preferences.
Checks run and exact result: npm run check:i18n -> 4703 keys; npm run test:login-page -> 14/14 passed; npm run test:fallback-surfaces -> 4/4 passed; npm run test:inbox-delivery -> 2/2 passed; npm run build -> passed.
Checks skipped and reason: dedicated screen-reader/manual accessibility and browser visual/interaction audits are still open; point 2 audits were excluded by owner instruction.
Residual risk: FB-010 must prove mobile reachability, focus order, announcement priority and copy across owner, manager, operator and staff scenarios.
```

```text
Checkpoint: 2026-09-02 pre-pilot dependency and E2E-fixture integration
Working tree: codex/ux-3-owner-dashboard @ f142f3e498e4726320fc7de0b6ad0cc27187c57f (uncommitted and shared with the active Critic UI/UX work)
Integrated scope: Django REST framework 3.17.2 lock update; npm audit lock-only update; deterministic foreign-owner/foreign-tenant E2E fixture; tenant-denial smoke no longer depends on platform-admin MFA activation.
Checks run and exact result: pip-audit against requirements.txt -> 0 known vulnerabilities; npm audit --audit-level=moderate -> 0 vulnerabilities; manage.py check -> no issues; manage.py makemigrations --check --dry-run -> no changes; targeted backend labels -> 265/265 passed; full manage.py test -v 1 --noinput -> 947/947 passed in 2343.504 seconds; npm run build -> passed; npm run check:bundle -> passed with maximum JS chunk 365.0 kB and app shell 266.6 kB; bounded Playwright desktop/mobile action, role and tenant matrix -> 14 selected cases completed with suite status passed; git diff --check -> exit 0 with line-ending normalization warnings only.
Checks skipped and reason: audit:interaction and audit:visual remain owned by the separately executing Critic UI/UX scope; the full FB-010 state-by-role-by-viewport matrix was not represented by this bounded 14-case checkpoint; codex_verify clean-range gate is not valid while the canonical checkout contains mixed uncommitted work.
Infrastructure evidence: production_readiness_audit -> 6 passed, 1 warning and 11 critical failures in the local development profile; real providers remain disabled, so their guardrail passes do not prove live-provider readiness.
Role/tenant impact: no permission grant changed; the new foreign tenant fixture exercises existing backend tenant isolation without requiring privileged platform activation.
Residual risk: FB-010, FC-003, FC-004, FC-006, FC-008 and BE-REM-007 remain open until the full failure/recovery matrix and a clean committed-range gate pass. Production-like staging also requires external secrets and managed services.
```

```text
Task: FB-010 - cross-role browser failure certification
Working tree: codex/ux-3-owner-dashboard @ f142f3e498e4726320fc7de0b6ad0cc27187c57f (uncommitted and shared with the active Critic UI/UX work)
Coverage: machine-readable registry covers 10 critical merchant journeys, owner/administrator/manager/operator/specialist where applicable, 12 required states and desktop/mobile; 744 applicable cells total (372 per viewport).
Defects found and fixed: session restore failures that bypassed the shared Axios interceptor did not raise the one-shot expired-session notice; the authenticated public-route guard could race the login callback and redirect to the dashboard instead of the preserved protected route; each role cycle could retain prior browser auth state. Session expiry now distinguishes prior authenticated state from first anonymous login, stores only safe internal /app or /platform return paths, keeps raw 401 details out of the login UI and restores the intended route after re-authentication.
Browser evidence: desktop matrix 372/372 cells passed; desktop session-expiry recovery passed for 5/5 merchant roles; mobile matrix and session-expiry tests passed 2/2; desktop foreign-tenant operator smoke passed 1/1. Assertions cover non-empty safe copy, recovery availability and completion, draft/context preservation, validation focus restoration, no raw SQLSTATE/token/provider/stack markers, no horizontal overflow and zero serious/critical Axe violations across the 12 unique surfaces per viewport.
Backend evidence: manage.py check -> no issues; apps.core.tests_b3_contracts plus apps.core.tests_tenant_isolation -> 11/11 passed; apps.integrations apps.conversations apps.automations -> 208/208 passed in 432.592 seconds; full manage.py test -v 1 --noinput -> 947/947 passed in 2539.088 seconds.
Frontend evidence: npm run test:failure-certification -> 1/1 passed; npm run check:failure-certification -> 744 cells accepted; npm run test:login-page -> 14/14 passed; npm run test:app-error -> 6/6 passed; npm run test:fallback-surfaces -> 4/4 passed; npm run test:error-boundaries -> 3/3 passed; npm run test:inbox-delivery -> 2/2 passed; npm run build -> i18n parity at 4721 RU/KK/EN keys plus TypeScript and application/widget production builds passed; npm run check:bundle -> maximum JS chunk 365.0 kB and app shell 267.9 kB.
Checks skipped or not accepted for integrated closeout: npm run audit:interaction and npm run audit:visual remain owned by the separately executing and explicitly excluded Critic UI/UX scope; npm run check:fallback-inventory reports that the generated report is stale and was not regenerated while that source set is changing in parallel; codex_verify clean-range evidence is not valid in the mixed dirty checkout; live providers were not enabled.
Role/tenant impact: no permission grants, membership rules or tenant query scopes changed. Backend and browser evidence confirms foreign tenant object access remains indistinguishable 404 and role-denied mutations remain 403.
Status decision: the bounded FB-010 matrix is implemented and passes in the isolated fixture/runtime. FB-010 is not marked fully DONE until the generated inventory, Critic-owned visual/interaction gates and one clean integrated commit range are reconciled.
Next bounded step: after Critic UI/UX stops changing the shared source set, regenerate and verify the fallback inventory, run the two Critic-owned audits against the integrated checkout and execute the clean-range verification gate; do not begin FC-008 as part of this checkpoint.
```

```text
Checkpoint: 2026-09-04 integrated fallback and alert UI convergence
Working tree: codex/ux-3-owner-dashboard @ f142f3e498e4726320fc7de0b6ad0cc27187c57f (mixed uncommitted checkout; no commit created)
Frontend surfaces changed: StatusNotice is now the canonical success/info/warning/danger anatomy used by shared page/inline/permission/connectivity/form/toast states and migrated auth, MFA, CRM forms/drawers, Inbox, AI, import and integration setup notices. Semantic business badges and metric cards remain separate status components. Import row field/message text, outreach skip reasons and integration provider reason/last_error values are not rendered directly; field summaries replace technical markers with localized safe copy.
Scenario coverage: the machine-readable registry remains complete at 744 applicable cells across 10 critical merchant journeys, 5 roles, 12 states and desktop/mobile. The generated source inventory is current at 43 routes, 583 API operations, 13 background tasks, 83 provider/async statuses and 29 stable error codes. Auxiliary route rows marked not_detected remain explicit source-detection gaps rather than certified fallback behavior.
Checks run and exact result: npm run test:fallback-surfaces -> 6/6 passed; npm run test:app-error -> 6/6; npm run test:error-boundaries -> 3/3; npm run test:login-page -> 14/14; npm run test:action-feedback -> 2/2; npm run test:inbox-delivery -> 2/2; npm run test:failure-certification -> 1/1; npm run check:failure-certification -> 744 cells accepted; npm run generate:fallback-inventory plus test/check -> 43 routes, 583 API operations, 13 tasks, 83 statuses, 29 codes and 2/2 tests passed; final npm run check:i18n -> 4831 RU/KK/EN keys; final npm run build -> TypeScript plus application/widget builds passed; final npm run check:bundle -> no chunk above 500 kB and app shell below 400 kB. Playwright desktop/mobile failure fixture and five-role session-expiry recovery passed after an isolated rerun; no SQLSTATE/token/provider/stack marker, horizontal overflow or serious/critical Axe violation reached the DOM. npm run audit:visual -> 13/13 routes with zero overflow, API issues, auth redirects or transparent-surface issues. npm run audit:interaction -> 12 routes with zero blocking/unexpected/API issues.
Runner correction: the first isolated visual audit timed out because both audit scripts hard-coded ports 5173/8000 while waiting on configured URLs; both now derive managed server ports from E2E_BASE_URL/E2E_API_BASE_URL and use strict Vite port binding. The rerun passed.
Checks skipped and reason: full backend suite and migration tests were not rerun because this checkpoint changes frontend presentation, frontend policy tests and browser audit runners only; the previously recorded 947/947 backend evidence remains the current integrated backend checkpoint. scripts/codex_verify.sh / clean-range verification was not run because the canonical checkout still contains unrelated mixed uncommitted changes and cannot produce honest commit-range evidence.
Residual risk: no absolute all-route production guarantee is claimed. Clean committed-range verification, manual screen-reader review and real staging provider failures remain open. The interaction audit also reported five non-blocking selector misses across Leads, Deals, Conversations, Analytics and AI Agents; no page was blocked and no API or unexpected error occurred.
```

### 2026-09-08 committed-range closeout

The integrated candidate `e65e0f4` on `codex/ux-3-owner-dashboard` passed
`scripts/codex_verify.py --mode full --base-ref f142f3e...` in 1727.1 seconds.
The gate included committed-range diff hygiene, migration drift, Django system
check, all 954 Django tests, deterministic frontend install/build/bundle,
mobile owner/manager smoke, hashed Python lock installation, Python and npm
dependency audits with zero known vulnerabilities, and final diff hygiene.
This closes the clean-range dependencies for FB-006, FB-007 and FB-010. FB-008
still requires real staging provider failure/recovery evidence, and FB-009
still requires manual screen-reader review.
