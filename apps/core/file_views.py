from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from django.utils._os import safe_join
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated


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

    return FileResponse(path.open("rb"), as_attachment=False, filename=path.name)
