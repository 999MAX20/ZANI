from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from django.utils._os import safe_join
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated

from apps.businesses.access import Actions
from apps.core.audit import write_audit_log
from apps.core.file_attachments import assert_attachment_access
from apps.core.models import AuditLog, FileAttachment


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def private_media_file(request, file_path):
    if getattr(settings, "USE_S3", False):
        raise Http404("Private local media serving is disabled when S3 storage is active.")

    try:
        absolute_path = safe_join(settings.PRIVATE_MEDIA_ROOT, file_path)
    except ValueError as exc:
        raise Http404("Invalid file path.") from exc

    path = Path(absolute_path)
    if not path.is_file():
        raise Http404("File not found.")

    normalized_path = str(file_path or "").replace("\\", "/").lstrip("/")
    attachment = (
        FileAttachment.objects.select_related("business")
        .filter(file=f"private/{normalized_path}")
        .first()
    )
    if attachment is None:
        raise Http404("File not found.")

    try:
        assert_attachment_access(request.user, attachment, Actions.VIEW)
    except (PermissionDenied, ValidationError) as exc:
        raise Http404("File not found.") from exc

    write_audit_log(
        request,
        AuditLog.Actions.DOWNLOAD,
        attachment,
        business=attachment.business,
        metadata={
            "kind": "file_download",
            "entity_type": attachment.entity_type,
            "entity_id": attachment.entity_id,
            "source": "legacy_private_media",
        },
    )

    return FileResponse(path.open("rb"), as_attachment=False, filename=attachment.original_name)
