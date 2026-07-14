from apps.ai_core.models import AIToolCallLog, ApprovalRequest
from apps.core.audit import write_audit_log
from apps.core.models import AuditLog


def audit_ai_tool_execution(request, tool_call: AIToolCallLog, *, status=None, error=None, extra_metadata=None) -> None:
    metadata = {
        "kind": "ai_tool_execution",
        "category": AuditLog.Categories.SYSTEM,
        "risk_level": AuditLog.RiskLevels.MEDIUM,
        "tool_call_id": tool_call.id,
        "tool_name": tool_call.tool_name,
        "status": status or tool_call.status,
        "conversation_id": tool_call.conversation_id,
        "input_keys": _payload_keys(tool_call.input_json),
        "output_keys": _payload_keys(tool_call.output_json),
        "output_refs": _safe_entity_refs(tool_call.output_json),
        "error": error if error is not None else tool_call.error,
    }
    if extra_metadata:
        metadata.update(extra_metadata)
    write_audit_log(
        request,
        AuditLog.Actions.UPDATE,
        tool_call,
        metadata=metadata,
    )


def audit_approval_request_created(request, approval: ApprovalRequest) -> None:
    write_audit_log(
        request,
        AuditLog.Actions.CREATE,
        approval,
        metadata={
            "kind": "ai_approval_request",
            "category": AuditLog.Categories.SYSTEM,
            "risk_level": AuditLog.RiskLevels.MEDIUM,
            "approval_id": approval.id,
            "action_type": approval.action_type,
            "status": approval.status,
            "source_object_type": approval.source_object_type,
            "source_object_id": approval.source_object_id,
            "ai_request_log_id": approval.ai_request_log_id,
            "ai_tool_call_log_id": approval.ai_tool_call_log_id,
            "payload_keys": _payload_keys(approval.payload),
        },
    )


def audit_approval_decision(request, approval: ApprovalRequest, *, decision: str) -> None:
    write_audit_log(
        request,
        AuditLog.Actions.UPDATE,
        approval,
        metadata={
            "kind": "ai_approval_decision",
            "category": AuditLog.Categories.SYSTEM,
            "risk_level": AuditLog.RiskLevels.MEDIUM,
            "approval_id": approval.id,
            "decision": decision,
            "action_type": approval.action_type,
            "status": approval.status,
            "source_object_type": approval.source_object_type,
            "source_object_id": approval.source_object_id,
            "ai_request_log_id": approval.ai_request_log_id,
            "ai_tool_call_log_id": approval.ai_tool_call_log_id,
            "reason": approval.reason,
            "payload_keys": _payload_keys(approval.payload),
        },
    )


def _payload_keys(payload) -> list[str]:
    if not isinstance(payload, dict):
        return []
    return sorted(str(key) for key in payload.keys())


def _safe_entity_refs(payload) -> dict:
    if not isinstance(payload, dict):
        return {}
    return {key: value for key, value in payload.items() if key.endswith("_id") and _is_scalar(value)}


def _is_scalar(value) -> bool:
    return value is None or isinstance(value, (bool, int, float, str))
