from django.utils import timezone

from apps.activities.services import write_activity_event
from apps.activities.taxonomy import canonical_event_type
from apps.businesses.access import Actions, Resources, can
from apps.businesses.models import BusinessMember
from apps.core.audit import write_audit_log
from apps.core.models import AuditLog


def is_business_admin(user, business):
    if not user or not user.is_authenticated or business is None:
        return False
    if user.is_superuser or getattr(user, "role", "") == "platform_admin":
        return True
    return business.members.filter(
        user=user,
        is_active=True,
        role__in=[BusinessMember.Roles.OWNER, BusinessMember.Roles.ADMIN],
    ).exists()


def supports_archive(instance):
    return hasattr(instance, "is_archived")


def archive_instance(request, instance, reason=""):
    if not supports_archive(instance):
        return instance
    if instance.is_archived:
        return instance
    instance.is_archived = True
    instance.archived_at = timezone.now()
    instance.archived_by = request.user
    instance.archive_reason = reason or ""
    instance.save(update_fields=["is_archived", "archived_at", "archived_by", "archive_reason", "updated_at"])
    event_type = canonical_event_type(f"{instance.__class__.__name__.lower()}.archived")
    metadata = {"kind": "archive", "event_type": event_type, "archive": True, "reason": reason or ""}
    write_audit_log(request, AuditLog.Actions.UPDATE, instance, metadata=metadata)
    write_activity_event(request, event_type, instance, text=f"Archived: {reason or 'no reason'}", metadata=metadata)
    return instance


def restore_instance(request, instance):
    if not supports_archive(instance):
        return instance
    if not instance.is_archived:
        return instance
    instance.is_archived = False
    instance.archived_at = None
    instance.archived_by = None
    instance.archive_reason = ""
    instance.save(update_fields=["is_archived", "archived_at", "archived_by", "archive_reason", "updated_at"])
    event_type = canonical_event_type(f"{instance.__class__.__name__.lower()}.restored")
    metadata = {"kind": "restore", "event_type": event_type, "restore": True}
    write_audit_log(request, AuditLog.Actions.UPDATE, instance, metadata=metadata)
    write_activity_event(request, event_type, instance, text="Restored from archive", metadata=metadata)
    return instance


def can_hard_delete(user, business, resource=None):
    if is_business_admin(user, business):
        return True
    if resource:
        return can(user, business, resource, Actions.DELETE).allowed and can(user, business, Resources.TEAM, Actions.MANAGE).allowed
    return False
