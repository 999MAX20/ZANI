from pathlib import Path

from django.conf import settings
from rest_framework.exceptions import ValidationError


def normalize_extension(filename):
    return Path(filename or "").suffix.lower().lstrip(".")


def validate_file_upload(uploaded_file, allowed_extensions=None, allowed_content_types=None, max_size_mb=None):
    allowed_extensions = {item.lower().lstrip(".") for item in (allowed_extensions or settings.ALLOWED_UPLOAD_EXTENSIONS)}
    allowed_content_types = set(allowed_content_types or settings.ALLOWED_UPLOAD_CONTENT_TYPES)
    max_size_mb = max_size_mb or settings.MAX_UPLOAD_SIZE_MB
    max_size_bytes = max_size_mb * 1024 * 1024

    extension = normalize_extension(getattr(uploaded_file, "name", ""))
    if not extension or extension not in allowed_extensions:
        raise ValidationError({"file": f"Unsupported file extension: {extension or 'none'}."})

    size = getattr(uploaded_file, "size", 0) or 0
    if size > max_size_bytes:
        raise ValidationError({"file": f"File is too large. Maximum size is {max_size_mb} MB."})

    content_type = getattr(uploaded_file, "content_type", "") or ""
    if allowed_content_types and content_type not in allowed_content_types:
        raise ValidationError({"file": f"Unsupported content type: {content_type or 'unknown'}."})

    return uploaded_file
