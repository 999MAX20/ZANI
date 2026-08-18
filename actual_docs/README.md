# Active ZANI Technical Documentation

This directory contains only the documents that currently govern future work in
the canonical ZANI repository.

## Current sources of authority

1. `CRM_WORKSPACE_UX_REFORM.md` — active UI/UX delivery plan. The next planned
   phases are UX-3 (owner/administrator dashboard) and UX-4 (final browser
   certification).
2. `DEFECT_KNOWLEDGE_BASE.md` — mandatory defect and regression-precedent
   register. Every confirmed defect must be recorded here and audited across
   every relevant shared surface.
3. `APP_FUNCTIONAL_CERTIFICATION.md` — future cross-application certification
   plan. It is intentionally **PLANNED / ON HOLD** and may begin only after an
   explicit owner instruction.
4. `BACKEND_AUDIT_REMEDIATION_PLAN.md` — active planned queue for the seven
   remaining backend audit findings, security hardening and their verification
   gates.
5. `UNIFIED_FALLBACK_EXPERIENCE_PLAN.md` — active planned queue for the shared
   backend/frontend error contract, merchant-safe fallback UX and recovery
   certification.

## Boundary

Completed execution plans, historical audits, readiness reports and superseded
roadmaps live in `../archive_docs/`. They remain preserved as evidence and
project knowledge, but they do not authorize new implementation work.

Production/security and fallback remediation now have separate active planning
documents. Their presence does not authorize implementation; execution begins
only after an explicit owner instruction and follows each document's phase and
manager gates.
