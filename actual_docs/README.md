# Active ZANI Technical Documentation

This directory contains only the documents that currently govern future work in
the canonical ZANI repository.

## Current sources of authority

1. `PROJECT_HANDOFF.md` — canonical identity, migration snapshot and startup guardrails for the new Codex Zani project.
2. `PRE_PILOT_CODE_READINESS_MASTER.md` — final pre-pilot code-readiness
   synthesis, ordered security/fallback/UX/certification gates and release
   definition of done. It owns overall sequence but does not replace detailed
   task contracts.
2. `CRM_WORKSPACE_UX_REFORM.md` — active UI/UX delivery plan. The next planned
   phases are UX-3 (owner/administrator dashboard) and UX-4 (final browser
   certification).
3. `DEFECT_KNOWLEDGE_BASE.md` — mandatory defect and regression-precedent
   register. Every confirmed defect must be recorded here and audited across
   every relevant shared surface.
4. `APP_FUNCTIONAL_CERTIFICATION.md` — executed partial certification: FC-001,
   FC-002, FC-005 and FC-007 pass; FC-003, FC-004 and FC-006 are partial;
   FC-008 is blocked by remaining security/fallback/journey evidence.
5. `BACKEND_AUDIT_REMEDIATION_PLAN.md` — backend remediation evidence through
   BE-REM-006; BE-REM-007 remains blocked by final fallback and certification.
7. `UNIFIED_FALLBACK_EXPERIENCE_PLAN.md` — active execution queue for the shared
   backend/frontend error contract, merchant-safe fallback UX and recovery
   certification. FB-001 and FB-002 are done; FB-003 is ready.

## Boundary

Completed execution plans, historical audits, readiness reports and superseded
roadmaps live in `../archive_docs/`. They remain preserved as evidence and
project knowledge, but they do not authorize new implementation work.

Production/security, fallback, UX and certification have separate detailed
documents under the pre-pilot master. Their presence does not authorize
implementation; execution begins only after an explicit owner instruction and
follows each document's phase and manager gates.
