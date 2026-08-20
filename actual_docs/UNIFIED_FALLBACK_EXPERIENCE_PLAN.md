# ZANI Unified Fallback And Error Experience Plan

- Status: **ACTIVE / IN EXECUTION**
- Created: 2026-08-18
- Scope: merchant-visible errors, recovery actions, loading/empty/offline states, backend error contracts and technical-detail isolation
- Execution state: **FB-001 DONE / FB-002 READY**
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
| API contract | `apps/core/exceptions.py` | stable `code`, `request_id`, `detail`, `errors` for known DRF/domain errors and unknown `internal_error` failures |
| Domain failures | `apps/core/domain_errors.py` | explicit conflict, unavailable, disabled and temporary-service codes |
| Secret redaction | `apps/integrations/sanitization.py` | removes common credentials from persisted/logged error text |
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

### 5. Backend code still persists or raises raw exception text

Several provider, import, scheduling, analytics, leads and AI paths use `str(exc)` as a stored error or validation detail. Redaction exists, but it is not applied consistently at every persistence and response boundary.

### 6. Unknown 500 backend responses are fixed; the broader taxonomy remains

BE-REM-004 now guarantees a safe `internal_error` envelope for exceptions DRF cannot handle and for non-domain DRF 5xx responses. It correlates the response, structured log and configured Sentry capture by request ID without exposing exception text, stack traces, SQL, payloads or provider responses. The broader `category`, `retryable` and `retry_after_seconds` contract, stored-error sanitization and frontend mapping remain part of FB-002 and FB-003.

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
| FB-002 | Complete the backend safe envelope and sanitization boundary | P0 | NOT_STARTED | BE-REM-004 |
| FB-003 | Introduce `AppError` normalization and retire raw parsing | P0 | NOT_STARTED | FB-001..002 |
| FB-004 | Build the shared visual fallback surface family | P0 | NOT_STARTED | FB-003 |
| FB-005 | Remove raw messages from crash and route boundaries | P0 | NOT_STARTED | FB-003..004 |
| FB-006 | Migrate direct technical-error consumers | P0 | NOT_STARTED | FB-003..005 |
| FB-007 | Standardize session, connectivity and draft preservation | P1 | NOT_STARTED | FB-003..004 |
| FB-008 | Standardize async job, provider and Inbox delivery recovery | P1 | NOT_STARTED | FB-002..007 |
| FB-009 | Complete RU/KK/EN copy and accessibility review | P1 | NOT_STARTED | FB-004..008 |
| FB-010 | Run cross-role browser failure certification | P1 | NOT_STARTED | FB-001..009 |

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

The fallback execution queue itself has not started. The prerequisite backend item has the following accepted evidence:

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
