# Backend Open And Partial Logic Register

- Status: active pre-pilot technical source of truth
- Audit date: 2026-09-08
- Candidate branch: `codex/ux-3-owner-dashboard`
- Source baseline at audit start: `f142f3e498e4726320fc7de0b6ad0cc27187c57f`
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

## Pilot Decision Boundary

A local/dev controlled pilot may use mock or disabled providers and does not
claim paid-production readiness. It still requires a reproducible commit,
tenant-safe mutations, migration consistency, the controlled-pilot gate and a
final certification record.

A paid or externally connected pilot additionally requires all production,
queue, storage, email, monitoring, backup and live-provider gates in this
document to be green.

## Open Register

| ID | Area | Status | Controlled pilot | Paid/live pilot |
| --- | --- | --- | --- | --- |
| BE-GAP-001 | Tenant ownership immutability on generic updates | `BLOCKER` | Blocks | Blocks |
| BE-GAP-002 | Exact clean release candidate and final integrated gate | `BLOCKER` | Blocks | Blocks |
| BE-GAP-003 | Functional certification FC-003/004/006/008 | `PARTIAL` | Blocks formal acceptance | Blocks |
| BE-GAP-004 | Platform manager support-mutation policy | `POLICY_CONFLICT` | Resolve before support access | Blocks support operations |
| BE-GAP-005 | Real provider failure and recovery evidence | `ENV_GATED` | May remain disabled | Blocks each enabled provider |
| BE-GAP-006 | Queue-backed production runtime | `ENV_GATED` | May use eager/in-memory mode | Blocks |
| BE-GAP-007 | Production database, storage, email, monitoring and backup | `ENV_GATED` | Out of local/demo scope | Blocks |
| BE-GAP-008 | Public abuse controls beyond fixed DRF throttles | `PARTIAL` | Accept only with bounded traffic | Required before broad exposure |
| BE-GAP-009 | Marketplace write-back and reconciliation | `ROADMAP` | Must stay disabled | Not generally available |
| BE-GAP-010 | 1C bridge and other future providers | `ROADMAP` | Must show request/roadmap | Not available |
| BE-GAP-011 | Production file lifecycle hardening | `PARTIAL` | Local private media is sufficient | Required by production policy |
| BE-GAP-012 | Vertical-specific CRM behavior | `ROADMAP` | Canonical CRM only | Product decision required |

## BE-GAP-001 - Tenant Ownership Is Mutable On Generic Update

### Current behavior

`TenantModelViewSet.get_object()` scopes and authorizes the existing object in
its current business. During update, `_business_from_serializer()` prefers the
request-supplied `business`, `_enforce_business_access()` authorizes that target
business, and `serializer.save()` persists the new foreign key.

The field remains writable in verified serializers including:

- `ClientSerializer`;
- `ServiceSerializer`;
- `ResourceSerializer` and `WorkingHoursSerializer`;
- `LeadSerializer`;
- `BusinessConnectorSerializer`.

Some sensitive serializers already reject business reassignment explicitly,
including support grants, routing policy and membership serializers. The
protection is therefore present as a local pattern but is not a global invariant.

### Impact

An actor who can access both businesses can re-parent an entity from one tenant
to another. Existing leads, appointments, deals, connector events or other
relations may continue to reference the moved object from the original
business, violating the mandatory same-business invariant. This is not an
arbitrary foreign-tenant IDOR because access to both businesses is required,
but it is a tenant integrity and authorization defect.

### Acceptance criteria

- Generic updates cannot change the owning business for tenant-owned entities.
- Any future explicit transfer workflow is separate, privileged, atomic and
  validates every dependent relation.
- Regression coverage includes same-business success, role denial,
  cross-business reassignment denial and unchanged related records.
- Cross-tenant failure remains non-enumerable.

## BE-GAP-002 - Clean Release Candidate And Integrated Verification

At audit start the branch had no staged changes and a large mixed working tree.
The service archive implementation included an untracked migration, domain
service and tests. Historical green results therefore did not identify one
reproducible artifact that a deploy could build.

Acceptance requires:

- every intended model change and migration committed together;
- no project source or required migration left untracked;
- no generated Playwright CLI logs or stray root lockfile in the commit;
- `git diff --check` clean;
- the full deterministic gate executed from the exact committed range;
- the verification report records branch, base SHA, candidate SHA, commands,
  results and skipped external checks.

## BE-GAP-003 - Functional Certification Is Partial

The current functional certification records:

- `FC-003 PARTIAL`: form, mutation, dialog and session failure contracts are not
  fully closed in the certification report;
- `FC-004 PARTIAL`: deterministic data-state and fault fixtures do not yet
  constitute a final integrated fault matrix;
- `FC-006 PARTIAL`: representative journeys pass, but all ten journeys are not
  yet accepted as UI-to-API-to-persistence evidence in the final report;
- `FC-008 PARTIAL/BLOCKED`: clean full gate and final report are open.

The fallback registry and browser audits provide strong supporting evidence,
but they do not silently convert these certification rows to `PASS`. Statuses
must be reconciled and closed in `actual_docs/APP_FUNCTIONAL_CERTIFICATION.md`.

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
