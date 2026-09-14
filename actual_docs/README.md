# Active ZANI Technical Documentation

This directory contains only the documents that currently govern future work in
the canonical ZANI repository.

Status reconciliation: 2026-09-14, committed source `4ba3cbf`. Historical full
gates do not certify the current uncommitted AI/channel package. See
[backend audit](../docs/pilot/backend-development-audit.md) and
[documentation inventory](../docs/operations/technical-documentation-audit.md).

## Current sources of authority

1. `PROJECT_HANDOFF.md` — canonical identity, migration snapshot and startup guardrails for the new Codex Zani project.
2. `PRE_PILOT_CODE_READINESS_MASTER.md` — final pre-pilot code-readiness
   synthesis, ordered security/fallback/UX/certification gates and release
   definition of done. It owns overall sequence but does not replace detailed
   task contracts.
3. `CRM_WORKSPACE_UX_REFORM.md` — active UI/UX delivery plan. UX-3
   (owner/administrator dashboard) is done; UX-4 (final browser certification)
   remains open. Do not reopen UX-3 from an older index snapshot.
4. `DEFECT_KNOWLEDGE_BASE.md` — mandatory defect and regression-precedent
   register. Every confirmed defect must be recorded here and audited across
   every relevant shared surface.
5. `APP_FUNCTIONAL_CERTIFICATION.md` — FC-001/002/004/005/006/007 pass at their
   documented checkpoint; FC-003/008 remain partial. The latest recorded full
   gate is `d4f7c8f` with 962 Django tests and frontend/mobile/dependency checks.
   It does not cover subsequent uncommitted changes.
6. `BACKEND_AUDIT_REMEDIATION_PLAN.md` — backend remediation evidence through
   BE-REM-006; BE-REM-007 is partial after the clean-range pass and remains
   open for final certification.
7. `UNIFIED_FALLBACK_EXPERIENCE_PLAN.md` — active execution queue for the shared
   backend/frontend error contract, merchant-safe fallback UX and recovery
   certification. FB-001 through FB-007 and FB-010 are done in the committed
   candidate; FB-008 remains open for live-provider evidence and FB-009 for
   manual screen-reader evidence.
8. `../docs/pilot/backend-open-logic-register.md` — canonical backend remaining
   scope. BE-GAP-001 is closed; BE-GAP-003 remains partial; BE-GAP-004 requires
   a policy decision; BE-GAP-006 has a connector-sync implementation gap as well
   as environment prerequisites.

## Boundary

Completed execution plans, historical audits, readiness reports and superseded
roadmaps live in `../archive_docs/`. They remain preserved as evidence and
project knowledge, but they do not authorize new implementation work.

Production/security, fallback, UX and certification have separate detailed
documents under the pre-pilot master. Their presence does not authorize
implementation; execution begins only after an explicit owner instruction and
follows each document's phase and manager gates.
