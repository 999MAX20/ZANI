# Backend Open And Partial Logic Register

- Status: active pre-pilot technical source of truth
- Audit date: 2026-09-08
- Candidate branch: `codex/be-gap-003-functional-certification`
- Source baseline for the current candidate: `81167518fb60887c023069a1fd7fa83f90fba6aa`
- Scope: backend behavior, tenant and permission boundaries, recovery, providers,
  production gates and certification dependencies

This register lists backend logic that is not implemented, is only partially
implemented, is enabled only for a controlled environment, or still lacks the
evidence required for pilot acceptance. It does not reopen CRM phases that are
already implemented and verified at their documented scope.

## Status Model

| Status | Meaning |
| --- | --- |
| `BLOCKER` | Must be resolved before any controlled pilot candidate is accepted. |
| `PARTIAL` | A usable foundation exists, but a required contract, path or proof is incomplete. |
| `ENV_GATED` | Repository support exists, but the target environment or real provider gate is not green. |
| `ROADMAP` | Intentionally unavailable and must not be presented as current functionality. |
| `POLICY_CONFLICT` | Code and documentation express different authorization or product rules. |
| `CLOSED` | The repository requirement and its deterministic verification are complete. |

## Pilot Decision Boundary

A local/dev controlled pilot may use mock or disabled providers and does not
claim paid-production readiness. It still requires a reproducible commit,
tenant-safe mutations, migration consistency, the controlled-pilot gate and a
final certification record.

A paid or externally connected pilot additionally requires all production,
queue, storage, email, monitoring, backup and live-provider gates in this
document to be green.

## Gap Register

| ID | Area | Status | Controlled pilot | Paid/live pilot |
| --- | --- | --- | --- | --- |
| BE-GAP-001 | Tenant ownership immutability on generic updates | `CLOSED` | Cleared at repository level | Cleared at repository level; environment gates remain separate |
| BE-GAP-002 | Exact clean release candidate and final integrated gate | `CLOSED` | Cleared for the repository candidate | Production env gates remain separate |
| BE-GAP-003 | Functional certification FC-003/008 | `PARTIAL` - FC-004/006 closed | Blocks formal acceptance | Blocks |
| BE-GAP-004 | Platform manager support-mutation policy | `POLICY_CONFLICT` | Resolve before support access | Blocks support operations |
| BE-GAP-005 | Real provider failure and recovery evidence | `ENV_GATED` | May remain disabled | Blocks each enabled provider |
| BE-GAP-006 | Queue-backed production runtime | `ENV_GATED` | May use eager/in-memory mode | Blocks |
| BE-GAP-007 | Production database, storage, email, monitoring and backup | `ENV_GATED` | Out of local/demo scope | Blocks |
| BE-GAP-008 | Public abuse controls beyond fixed DRF throttles | `PARTIAL` | Accept only with bounded traffic | Required before broad exposure |
| BE-GAP-009 | Marketplace write-back and reconciliation | `ROADMAP` | Must stay disabled | Not generally available |
| BE-GAP-010 | 1C bridge and other future providers | `ROADMAP` | Must show request/roadmap | Not available |
| BE-GAP-011 | Production file lifecycle hardening | `PARTIAL` | Local private media is sufficient | Required by production policy |
| BE-GAP-012 | Vertical-specific CRM behavior | `ROADMAP` | Canonical CRM only | Product decision required |

## BE-GAP-001 - Tenant Ownership Immutability - Closed

Generic `PATCH` and `PUT` requests can no longer move a tenant-owned object to
another business. `TenantModelViewSet.update()` now validates ownership before
calling any `perform_update()` implementation, including domain viewsets that
override the default mutation hook.

The invariant uses each viewset's existing `business_lookup`, so it covers both
direct ownership through `business` and derived ownership through relations
such as `conversation__business`, `bot__business`, `rule__business` and
`form__business`. Repointing a relation inside the same business remains
allowed. A future cross-business transfer must be a separate privileged,
atomic workflow that validates and moves every dependent relation.

Closure evidence:

- implementation commit: `21f5eb0`;
- verification base: `ba764a94992b64a328c3f19b54253e3c83069e8b`;
- before the fix, the focused regression class reproduced three unauthorized
  moves with HTTP `200`: direct `Client.business`, derived
  `Message.conversation` and `BusinessConnector.business` through a custom
  `perform_update()`;
- after the fix, `apps.core.tests_tenant_isolation` passed all 11 tests,
  covering same-business direct and derived updates, multi-business
  reassignment denial, unchanged related CRM records, role denial and a hidden
  foreign source object;
- `scripts/codex_verify.py --mode backend --base-ref ba764a9...` passed in
  1686.5 seconds: clean working-tree/index/committed-range diff checks, no
  migration drift, clean Django system check and all 960 Django tests in
  1623.366 seconds.

No migration, environment, notification, BusinessEvent, AI or frontend change
was required.

## BE-GAP-002 - Clean Release Candidate And Integrated Verification - Closed

At audit start the branch had no staged changes and a large mixed working tree.
The service archive implementation included an untracked migration, domain
service and tests. Historical green results therefore did not identify one
reproducible artifact that a deploy could build.

Closure evidence:

- integrated candidate: `e65e0f4` on `codex/ux-3-owner-dashboard`;
- base SHA: `f142f3e498e4726320fc7de0b6ad0cc27187c57f`;
- all intended model changes, the service migration, domain service and tests
  are committed together;
- generated Playwright CLI logs and the stray root lockfile are not committed;
- `git diff --check` passed for working tree, index and committed range;
- `scripts/codex_verify.py --mode full --base-ref f142f3e...` passed in
  1727.1 seconds with no migration drift, a clean Django check, all 954 Django
  tests, deterministic frontend install/build/bundle, mobile owner/manager
  smoke, hashed lock installability, zero Python advisories, zero npm
  vulnerabilities and final diff hygiene.

This closed the repository artifact and integrated-gate portion at that
checkpoint. BE-GAP-001 was closed by its later dedicated candidate; the
remaining FC rows and paid/live environment gates stay separate.

## BE-GAP-003 - Functional Certification Is Partial

The current functional certification records:

- `FC-003 PARTIAL`: all 43 routes have structural action metadata, but every
  route/action registry row is still `NOT_RUN`; expected-result proof or an
  approved exclusion is not recorded for every interactive control;
- `FC-004 PASS`: the FB-010 machine registry certifies 744 combinations across
  ten journeys, five roles, twelve data/failure states and two viewport classes;
- `FC-006 PASS`: a separate machine registry accepts exactly ten required
  merchant journeys with route, role, frontend, API and persistence evidence;
  newly added browser coverage proves J06 lead import, J07 team role changes and
  J10 source-grounded AI approval end to end;
- `FC-008 PARTIAL`: implementation commit `d4f7c8f` passes the current full
  committed-range gate; final acceptance remains dependent on FC-003
  reconciliation.

### Delivered in the current candidate

- Lead CSV preview now reports an existing-client duplicate before importing a
  lead and retains UI/API/persistence evidence.
- Team role, department and invitation collections retain accessible-business
  authorization and can be narrowed to the active business; Settings supplies
  the active business, preventing cross-business option mixing.
- The AI assistant requires a real conversation source before requesting a tool
  suggestion and requires explicit confirmation plus an approval record before
  executing the exact suggested task action.
- Registry guard scripts fail if the ten-journey set, route identifiers,
  evidence files or exact evidence markers drift.
- All J06/J07/J10 journeys pass on desktop, tablet and mobile Chromium; the
  complete clean desktop project discovers 62 scenarios and exits zero.
- Certification fixtures now follow action-only service activation, real
  platform MFA step-up, explicit backend retryability and the current
  owner/manager dashboard separation. Working-hours modal close/discard returns
  focus to the visible resource trigger.
- Implementation commit `d4f7c8f` passed
  `scripts/codex_verify.py --mode full --base-ref 81167518...` in 1911.2s:
  all 962 Django tests, migration/check, deterministic frontend
  install/build/bundle, mobile role smoke, dependency audits and diff hygiene
  passed.

### Still unimplemented or only partially evidenced

1. `route-action-registry.mjs` needs an executable semantic status/evidence
   contract per listed action, rather than the current global `NOT_RUN` default.
2. Every interactive control needs either a passing expected-result assertion
   or a documented exclusion with owner rationale. Structural route coverage
   and broad failure matrices cannot substitute for this action-level proof.
3. After those records are executed, rerun the committed-range gate if the
   action-level work changes executable code, reconcile the report and close
   `FC-003` and then `FC-008`. The current implementation commit already passes
   focused backend checks, production frontend build, all registry guards, a
   clean full desktop browser project, the new tablet/mobile journeys and the
   full committed-range gate.

This remaining work is formal certification debt. No current evidence shows an
additional missing CRM lifecycle, permission or tenant-isolation implementation
inside J01-J10. Live-provider and managed-service gates remain separately
environment-gated and are not closed by repository certification.

## BE-GAP-004 - Platform Manager Support Mutation Policy Conflict

`docs/security/PERMISSION_MATRIX.md` says platform operations are readable by
`platform_admin` and `platform_manager`, while mutation is restricted to
`platform_admin`. The current merchant support-action endpoint uses
`IsPlatformUser`, allowing both roles after recent MFA step-up. Other readiness
notes explicitly describe cross-tenant support actions for platform managers.

This must be resolved as a product and security policy decision before the
support workflow is treated as certified. The chosen rule must be identical in
the permission matrix, endpoint permissions, UI capability checks and tests.

## BE-GAP-005 - Real Provider Failure And Recovery Evidence

Provider adapters, credential masking, webhook authentication, idempotency,
safe error envelopes and support-visible connector health are implemented at
repository level. Real staging evidence remains open.

For every enabled provider, acceptance requires:

- production-strength secrets and public HTTPS delivery;
- provider readiness command green in the target environment;
- queue-backed execution and retry behavior;
- signed webhook or authenticated pull-sync proof;
- duplicate delivery and idempotency proof;
- timeout, rate-limit, partial-failure and recovery evidence;
- sanitized merchant-facing errors and support-visible diagnostics;
- rollback owner and tested disable procedure.

Provider status must remain honest:

| Provider | Current allowed claim | Missing before broader use |
| --- | --- | --- |
| Website widget/public forms | Local/dev and first production candidate | Domain/embed QA and edge abuse controls |
| Excel/CSV | Controlled-pilot import | Production data onboarding and recovery rehearsal |
| Telegram | Real-provider candidate | Live env, webhook, queue, Sentry and readiness pass |
| WhatsApp | Pilot/setup required | Meta signup, live signed webhook and target-env recovery |
| Instagram/Meta | Pilot/setup required | OAuth/account linking, live signed webhook and recovery |
| Kaspi | Beta read-only | Live merchant sync proof; no write-back |
| MoySklad | Beta read-only | App/install authorization is a future UX; no write-back |
| Wildberries | Beta read-only | Live merchant proof; write operations disabled |
| Ozon | Beta read-only | Live merchant proof; write operations disabled |
| OpenRouter/OpenAI | Mock/dev by default | Queue, limits, monitoring and provider-disabled fallback proof |
| Transactional email | Runtime dependency | Real SMTP configuration and smoke test |

## BE-GAP-006 - Queue-Backed Production Runtime

Automations, integration syncs, notifications, AI work and exports have queue
contracts and safe eager/local behavior. Production acceptance still requires
TLS Redis, non-eager Celery workers, beat where scheduled jobs are enabled,
worker health, lag/retry/failure metrics and restart/recovery proof. HTTP request
paths must not become the hidden production executor when the queue is absent.

## BE-GAP-007 - Production Infrastructure Gates

These are target-environment prerequisites rather than missing local CRM code:

- strong production secret and trusted host/origin/HTTPS configuration;
- managed TLS PostgreSQL and connection policy;
- tested backup and restore drill;
- TLS Redis with workers and beat;
- private object storage and signed/private delivery;
- Sentry or equivalent error monitoring;
- transactional email;
- deployed staging smoke and browser E2E;
- tested support-grant workflow;
- non-critical Platform Operations health;
- rollback for every enabled real provider.

`production_readiness_audit --fail-on-critical` and
`paid_beta_gate_check --fail-on-blockers` are authoritative. Local controlled
pilot success must not be reported as paid-beta readiness.

## BE-GAP-008 - Abuse And Rate-Limit Hardening

Fixed DRF scoped throttles exist for authentication, MFA, public API, public
forms, widget, webhooks and AI. The following are not implemented:

- dynamic per-business throttling;
- CAPTCHA or challenge for public forms;
- IP reputation integration;
- Cloudflare WAF/rate-limit rules;
- webhook queue backpressure metrics;
- alerting and tuning from real `429` and retry traffic.

For a small controlled pilot, bounded traffic and existing scoped throttles may
be accepted. Public production exposure requires edge controls and observable
traffic-based tuning.

## BE-GAP-009 - Marketplace Write-Back And Reconciliation

Kaspi, MoySklad, Wildberries and Ozon are read-only by default. General price,
product-card, order, supply and stock mutation is not implemented as a supported
production capability.

Any future inventory write pilot requires explicit `inventory_write` selection,
healthy read sync, warehouse/store validation, complete product mapping,
idempotent queued writes, audit history, partial-failure visibility,
reconciliation and rollback. Kaspi repricing remains recommendation/decision
support until an approved provider write mechanism is selected and tested.

## BE-GAP-010 - 1C And Future Providers

The 1C target is a push-based ZANI Agent or application flow. There is no
approved production adapter, installer, credential UX, support playbook,
rollback procedure or provider test suite. It must remain `request/roadmap`.
The same rule applies to future payments, delivery and accounting providers.

## BE-GAP-011 - Production File Lifecycle Hardening

Implemented today: private local media behavior, optional S3-compatible
settings, upload validation, attachment metadata/API, usage summary,
plan-aware quota checks and upload/download audit.

Still missing:

- paid storage provider setup;
- migration of existing files;
- CDN strategy;
- antivirus/provider interface;
- production retention and lifecycle policy.

Private bucket configuration and an upload/download/audit smoke are mandatory
before paid traffic relies on attachments.

## BE-GAP-012 - Vertical-Specific CRM Behavior

Dentistry and other vertical profiles are intentionally deferred. Business type
must not silently change canonical CRM modules, terminology or lifecycle rules.
Any vertical behavior requires a separate owner-approved product contract,
permissions analysis, migration impact, API behavior and regression suite.

## Explicitly Not Opened By This Register

The following foundations are implemented at their currently documented scope
and should not be described as missing merely because production evidence is
still open:

- lead, deal, client, appointment and task lifecycle services;
- activity timeline and sensitive-action audit foundation;
- tenant-scoped querysets and role/capability checks for normal reads;
- invitation hardening, access-token epoch revocation and privileged MFA;
- encrypted connector credentials and masked serializers;
- webhook signature verification and outbound webhook SSRF defenses;
- automation condition-field allowlist;
- safe API/fallback envelopes and provider-error sanitization;
- Excel/CSV imports and read-only marketplace event normalization;
- service activate/deactivate/archive/restore implementation present in the
  current candidate, subject to migration and integrated test acceptance.

## Closure Rules

1. Update a row only after implementation and its required verification both
   exist in one reproducible committed candidate.
2. Record exact commands, results, base SHA and candidate SHA.
3. For CRM mutations, include happy path, role denial, tenant isolation and
   related-object business validation.
4. For providers, distinguish repository tests from real target-environment
   evidence.
5. Do not change `ROADMAP` or `ENV_GATED` to available based only on a rendered
   UI card or configured credential.
6. Keep this register synchronized with the permission matrix, provider rollout,
   production readiness and functional certification documents.
