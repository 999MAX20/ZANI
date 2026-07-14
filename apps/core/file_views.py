from pathlib import Path
import re

from django.conf import settings
from django.http import FileResponse, Http404
from django.utils._os import safe_join
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.core.permissions import user_can_access_business


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

    business_id = _extract_business_id(file_path)
    if business_id is None:
        raise Http404("File not found.")
    if not _can_access_private_file(request.user, business_id):
        raise Http404("File not found.")

    return FileResponse(path.open("rb"), as_attachment=False, filename=path.name)


def _extract_business_id(file_path):
    match = re.search(r"(?:^|/)business-(\d+)(?:/|$)", file_path)
    return int(match.group(1)) if match else None


def _can_access_private_file(user, business_id):
    from apps.businesses.models import Business

    try:
        business = Business.objects.get(id=business_id)
    except Business.DoesNotExist:
        return False
    return user_can_access_business(user, business)
