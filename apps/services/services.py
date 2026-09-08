from django.db import transaction

from apps.activities.services import write_activity_event
from apps.core.archive import archive_instance, restore_instance
from apps.core.audit import write_audit_log
from apps.core.domain_errors import InvalidTransition
from apps.core.models import AuditLog


@transaction.atomic
def set_service_active(*, request, service, is_active):
    if service.is_archived:
        raise InvalidTransition("Restore the service before changing its status.")
    if service.is_active == is_active:
        return service

    previous = service.is_active
    service.is_active = is_active
    service.save(update_fields=["is_active", "updated_at"])
    event_type = "service_activated" if is_active else "service_deactivated"
    metadata = {
        "kind": "lifecycle",
        "event_type": event_type,
        "from_active": previous,
        "to_active": is_active,
    }
    write_audit_log(request, AuditLog.Actions.UPDATE, service, metadata=metadata)
    write_activity_event(
        request,
        event_type,
        service,
        text="Service activated" if is_active else "Service deactivated",
        metadata=metadata,
    )
    return service


@transaction.atomic
def archive_service(*, request, service, reason=""):
    if service.is_archived:
        return service
    if service.is_active:
        service.is_active = False
        service.save(update_fields=["is_active", "updated_at"])
    return archive_instance(request, service, reason=reason)


@transaction.atomic
def restore_service(*, request, service):
    service = restore_instance(request, service)
    if service.is_active:
        service.is_active = False
        service.save(update_fields=["is_active", "updated_at"])
    return service
