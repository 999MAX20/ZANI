from pathlib import Path

from django.conf import settings
from rest_framework.exceptions import ValidationError


MAGIC_SIGNATURES = {
    "jpg": (b"\xff\xd8\xff",),
    "jpeg": (b"\xff\xd8\xff",),
    "png": (b"\x89PNG\r\n\x1a\n",),
    "webp": (b"RIFF",),
    "pdf": (b"%PDF-",),
    "doc": (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",),
    "xls": (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",),
    "docx": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    "xlsx": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    "mp3": (b"ID3", b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"),
    "ogg": (b"OggS",),
    "wav": (b"RIFF",),
}
TEXT_EXTENSIONS = {"txt", "csv"}


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

    validate_file_signature(uploaded_file, extension)

    return uploaded_file


def validate_file_signature(uploaded_file, extension):
    header = _read_file_header(uploaded_file)
    if not header:
        raise ValidationError({"file": "Uploaded file is empty."})

    signatures = MAGIC_SIGNATURES.get(extension)
    if signatures and not any(header.startswith(signature) for signature in signatures):
        raise ValidationError({"file": "File content does not match the declared file type."})

    if extension in TEXT_EXTENSIONS:
        try:
            header.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise ValidationError({"file": "Text file content is not valid UTF-8."}) from exc


def _read_file_header(uploaded_file, size=512):
    position = None
    if hasattr(uploaded_file, "tell") and hasattr(uploaded_file, "seek"):
        try:
            position = uploaded_file.tell()
        except (OSError, ValueError):
            position = None

    chunk = uploaded_file.read(size)
    if isinstance(chunk, str):
        chunk = chunk.encode("utf-8")

    if position is not None:
        uploaded_file.seek(position)
    elif hasattr(uploaded_file, "seek"):
        uploaded_file.seek(0)

    return chunk or b""
