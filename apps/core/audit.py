from apps.core.models import AuditLog
from apps.integrations.sanitization import sanitize_error_payload, sanitize_error_text


def get_client_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def write_audit_log(request, action, instance, business=None, metadata=None):
    if request is None or not getattr(request, "user", None) or not request.user.is_authenticated:
        return

    resolved_business = business or getattr(instance, "business", None)
    if resolved_business is None and instance.__class__.__name__ == "Business":
        resolved_business = instance
    if resolved_business is None and hasattr(instance, "conversation"):
        resolved_business = instance.conversation.business

    metadata = sanitize_audit_metadata(metadata or {})
    AuditLog.objects.create(
        business=resolved_business,
        actor=request.user,
        action=action,
        category=metadata.get("category") or infer_audit_category(action, instance, metadata),
        risk_level=metadata.get("risk_level") or infer_audit_risk(action, instance, metadata),
        entity_type=instance.__class__.__name__,
        entity_id=str(getattr(instance, "pk", "")),
        metadata=metadata,
        ip_address=get_client_ip(request),
        user_agent=sanitize_error_text(request.META.get("HTTP_USER_AGENT", "")),
    )


def sanitize_audit_metadata(metadata):
    return sanitize_error_payload(metadata or {})


def infer_audit_category(action, instance, metadata):
    if metadata.get("permission") or instance.__class__.__name__ in {"BusinessRole", "RolePermission", "BusinessMember"}:
        return AuditLog.Categories.ACCESS
    if metadata.get("kind") in {"export", "file_download"} or metadata.get("archive") or metadata.get("restore"):
        return AuditLog.Categories.SECURITY
    if "Integration" in instance.__class__.__name__ or metadata.get("provider"):
        return AuditLog.Categories.INTEGRATION
    if action == AuditLog.Actions.SUPPORT_ACCESS:
        return AuditLog.Categories.ACCESS
    return AuditLog.Categories.DATA


def infer_audit_risk(action, instance, metadata):
    if action == AuditLog.Actions.DELETE or metadata.get("hard_delete"):
        return AuditLog.RiskLevels.CRITICAL
    if metadata.get("kind") == "export" or metadata.get("permission") or metadata.get("support_access"):
        return AuditLog.RiskLevels.HIGH
    if metadata.get("kind") == "file_download":
        return AuditLog.RiskLevels.MEDIUM
    if metadata.get("archive") or metadata.get("restore") or metadata.get("lost"):
        return AuditLog.RiskLevels.MEDIUM
    if instance.__class__.__name__ in {"BusinessRole", "RolePermission", "BusinessMember"}:
        return AuditLog.RiskLevels.HIGH
    return AuditLog.RiskLevels.LOW
