from apps.core.models import AuditLog


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

    AuditLog.objects.create(
        business=resolved_business,
        actor=request.user,
        action=action,
        entity_type=instance.__class__.__name__,
        entity_id=str(getattr(instance, "pk", "")),
        metadata=metadata or {},
        ip_address=get_client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", ""),
    )
