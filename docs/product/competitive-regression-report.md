# Zani Competitive Regression Report

Date: 2026-05-20

Scope: final QA pass against the internal amoCRM/Bitrix24 competitive checklist from `plan/teh plan 13.05.md` and `plan/zani_execution_prompts_from_13_05.md`.

This report is intentionally strict. It does not mark an area as ready unless the current repository has backend, API, frontend, tenant isolation, and at least basic verification in place.

## Executive Summary

Zani is no longer just a mini-CRM prototype. The current project has a real multi-tenant CRM/Business OS foundation:

- merchant CRM with clients, leads, deals, appointments, tasks, inbox, timeline, analytics, settings;
- platform admin foundation;
- RBAC with business roles, role permissions, departments and scoped permissions;
- audit/security center;
- imports/exports;
- custom fields, tags, segments;
- quick replies;
- automation rules/templates;
- bot/inbox foundation with website chat, Telegram and WhatsApp provider layer;
- private file attachments;
- public API tokens and webhook foundation;
- onboarding templates by niche;
- mobile-first polish pass for shared UI shells.

The product is strong for an SMB-first CRM MVP, but it is not yet production-complete for 10,000 merchants. The largest remaining gaps are production infrastructure, realtime collaboration, mature automation builder UX, provider-grade integrations, reporting/export scheduling, storage quotas, and end-to-end QA on real devices.

## Classification Legend

- `Ready`: implemented enough for MVP/business testing.
- `Partial`: useful foundation exists, but not yet full competitive parity.
- `Gap`: important feature is missing or too shallow.
- `Stronger`: current Zani approach can be simpler/better for SMB than amoCRM/Bitrix24 if polished.

## Area Review

| Area | Status | Evidence in Current Project | Competitive Notes |
| --- | --- | --- | --- |
| Multi-tenant CRM core | Ready | `TenantModelViewSet`, `Business`, tenant filtering, scoped querysets, tests | Good foundation. Must keep this as non-negotiable architecture. |
| Clients/leads/appointments/services/resources | Ready | CRUD APIs + frontend pages + tests | SMB usable. Needs later bulk actions and duplicate workflows polish. |
| Deals/pipelines/kanban | Partial | pipelines, stages, move stage, stage metadata, board UI | Strong base, but not yet as configurable as amoCRM/Bitrix24 with complex stage rules and required-field UX. |
| CRM card / unified context | Ready | `CrmEntityDrawer`, CRM card payload, timeline, attachments, tasks, messages | Stronger than a plain table CRM. Needs faster inline editing later. |
| Inbox/conversations | Partial | inbox, website/Telegram/WhatsApp foundation, quick replies, attachments | Good direction. Needs realtime, assignment queues, SLA/handoff UX, channel health. |
| Tasks | Partial | priorities, reminders, comments, watchers, archive; recurring execution is not implemented and is rejected by the API | Useful. Needs richer views, calendar sync, dependencies UX and a real recurrence scheduler before recurrence is exposed. |
| RBAC/roles | Ready for MVP | `BusinessRole`, `RolePermission`, presets, departments, permissions UI | Strong for current stage. Needs policy review before enterprise rollout. |
| Audit/security center | Ready for MVP | `AuditLog`, login history, risk levels, support grants, Settings security UI | Good owner-control differentiator. Needs retention jobs and security alert delivery later. |
| Notifications | Ready for MVP | categories, priority, read/unread, summary, header dropdown | Useful. Needs push/realtime and preference center for parity. |
| Automations | Partial | triggers/actions/conditions, templates, manual builder, runs | Backend foundation exists. Builder UX is still not at amoCRM/Bitrix level. |
| Analytics | Partial | owner dashboard, team performance, source metrics | Good MVP. Lacks full widget dashboards, scheduled reports, exports, cohort/LTV/MRR depth. |
| Import/export | Ready for MVP | preview, mapping, duplicate detection, CSV export, audit | Strong SMB migration story. Needs richer import templates and rollback. |
| Custom fields | Ready for MVP | definitions/values, CRM card integration | Important parity item covered. Needs validation/required-field UX in all forms. |
| Tags/segments | Ready for MVP | tags, tagged objects, segment filters/evaluate | Good base. Needs saved smart views in UI. |
| Integrations provider layer | Partial | provider abstraction, website, Telegram, WhatsApp mock/disabled, logs | Architecture is correct. Paid provider production credentials and retries are still gaps. |
| Public API/webhooks | Ready for foundation | scoped tokens, rotate/revoke, delivery logs, retry, rate limit | Good developer foundation. Needs OpenAPI docs, OAuth/apps, IP allowlists. |
| File attachments/storage | Partial | private uploads/download, validation, entity links | Needs object storage production config, quotas, antivirus, previews. |
| Onboarding by niche | Ready for MVP | templates, apply endpoint, checklist, demo flow, wizard | Strong SMB advantage: faster than complex enterprise setup. |
| Platform admin | Partial | platform routes, overview, merchants | Needs operational tools: merchant impersonation with audit, support workflows, billing operations. |
| Billing/subscriptions | Partial | plans, current subscription, usage summary | No real payments, entitlement enforcement, invoice lifecycle. |
| Mobile UX | Partial | mobile shell/nav/search/modal/drawer polish | Better than desktop-only admin. Needs real device QA and page-by-page polish. |
| Production infra | Gap | Docker/settings/env exist; S3 optional | Needs deployment architecture, backups, observability, worker/retry infra, secrets policy. |
| Realtime | Gap | no websocket/SSE layer | Needed for inbox, notifications, SLA, collaborative sales work. |

## Stronger-Than-Competitors Opportunities

1. SMB simplicity over enterprise clutter.
   Zani can present “owner mode” and “operator mode” without exposing huge settings matrices by default.

2. Niche onboarding.
   Applying dentistry/beauty/sauna/autoservice/education/medical templates makes the CRM usable in minutes. This can beat generic CRM onboarding if templates become high quality.

3. Unified CRM card.
   A clean card with client, leads, deals, appointments, tasks, messages, timeline, tags, custom fields and attachments can feel lighter than Bitrix-style navigation.

4. Security and audit as owner trust layer.
   SMB owners care about employee mistakes, hidden deletes, missed leads and support access. Zani already has the right direction here.

5. Provider-neutral integrations.
   Current provider layer avoids locking business logic to one WhatsApp/Telegram vendor. This is the correct long-term architecture.

## Critical Gaps

These should not be hidden as “polish”. They are real blockers for a stable 10,000-merchant production rollout.

1. Production infrastructure and operations.
   Need deployment topology, managed Postgres/Supabase Postgres decision, backups, migrations policy, environment separation, static/media storage, and rollback plan.

2. Object storage production readiness.
   Private attachments exist, but production needs bucket isolation/prefixing, quotas per merchant/plan, signed URLs or backend streaming policy, antivirus scanning, file retention and deletion rules.

3. Realtime layer.
   Inbox, notifications, handoff, SLA and task updates need WebSockets/SSE or polling strategy. Without it, managers may miss live events.

4. Automation execution maturity.
   The engine foundation exists, but production needs queue-backed execution, retry policy, delays, failure handling, idempotency, run logs UI and guardrails.

5. Integration provider production contracts.
   Telegram/WhatsApp foundations exist, but real paid providers need credential management, webhook verification per provider, outbound status callbacks, retries and provider error mapping.

6. Reporting depth.
   Current analytics is useful, not yet competitive with full CRM reporting. Need configurable dashboards, source ROI, funnel velocity, employee performance exports, scheduled reports.

7. QA coverage by user flow.
   Unit/API tests are good. Need e2e smoke scripts for owner/operator/platform, mobile viewport checks and core flow regression.

8. Performance and scale testing.
   Need indexes review, query count profiling, pagination everywhere, load tests for 10,000 merchants, API rate limits by endpoint category.

9. Data lifecycle.
   Need archive/restore/retention policy per entity, export/delete workflows, support access expiry jobs, audit retention jobs.

10. Entitlements.
   Billing/usage counters exist, but plan limits are not consistently enforced through an entitlement layer.

## Next Critical Tasks

### Priority 1: Production Readiness Baseline

- finalize database provider strategy;
- add production settings checklist;
- configure object storage;
- add backup/restore docs;
- add healthcheck/readiness endpoints for deploy;
- add error tracking and structured logging;
- add deployment README for web + worker.

### Priority 2: Realtime Communication Layer

- choose WebSockets or SSE;
- realtime notification count;
- inbox message updates;
- conversation assignment/handoff updates;
- fallback polling for cheap hosting.

### Priority 3: Automation Runtime Hardening

- move delayed/retry automation actions to queue-ready service;
- add idempotency keys for automation runs;
- add failure/retry UI;
- add run detail drawer;
- add tests for duplicate event prevention.

### Priority 4: Storage and Data Safety

- production storage backend decision;
- per-business storage accounting;
- file quotas;
- delete/archive policy;
- virus scanning placeholder/provider interface;
- private download audit for sensitive file types.

### Priority 5: UI/UX Competitive Polish

- dashboard owner/operator variants;
- leads/deals mobile kanban polish;
- inbox mobile composer polish;
- CRM drawer inline editing;
- settings simplification into tabs/sections;
- onboarding copy and demo templates refinement.

## Do Not Do Architecturally

- Do not bypass tenant-aware querysets for speed.
- Do not put provider-specific WhatsApp/Telegram logic directly into CRM views.
- Do not add plan checks as scattered `if plan == ...` conditions.
- Do not hard-delete CRM records by default.
- Do not turn Settings into an infinite single page forever.
- Do not hide missing production infrastructure behind mock/demo states.
- Do not make AI mandatory in core CRM flows.
- Do not overbuild Bitrix-style modules before core daily workflows are excellent.

## Current Verification Snapshot

Latest green checks during this pass:

- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check` — OK.
- `DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test` — OK, 152 tests.
- `cd frontend && npm run build` — OK.

## Readiness Estimate

For internal demo / first controlled SMB pilot: `70-75%`.

For paid beta with a small number of merchants: `55-60%`, assuming careful manual support and no strict uptime promise.

For production at 10,000 active merchants: `35-40%`.

The core product architecture is moving in the right direction. The remaining work is less about “more CRM screens” and more about production operations, realtime reliability, integration hardening, storage safety, e2e QA and UX simplification.
