# File Storage And Safety

Zani now has a storage foundation for future attachments, voice notes, documents and media messages.

## Local Development

By default files use local media:

```bash
USE_S3=False
MEDIA_ROOT=/app/media
PRIVATE_MEDIA_ROOT=/app/media/private
```

Private files should be stored below `PRIVATE_MEDIA_ROOT` and served through:

```text
GET /api/files/private/<path:file_path>/
```

The endpoint requires authentication and uses safe path joining to avoid directory traversal. Future object-level permissions should be checked before returning a file that belongs to a specific business/client/conversation.

## S3-Compatible Production

For S3/R2/Yandex-compatible storage:

```bash
USE_S3=True
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_STORAGE_BUCKET_NAME=
AWS_S3_REGION_NAME=
AWS_S3_ENDPOINT_URL=
AWS_QUERYSTRING_AUTH=True
```

S3 is optional. Empty S3 variables do not affect local development while `USE_S3=False`.

## Validation Helpers

Use `apps.core.file_validation.validate_file_upload()` before accepting files.

It validates:

- extension;
- content type;
- max size.

Settings:

```bash
MAX_UPLOAD_SIZE_MB=10
ALLOWED_UPLOAD_EXTENSIONS=jpg,jpeg,png,webp,pdf,txt,doc,docx,xls,xlsx,mp3,ogg,wav
ALLOWED_UPLOAD_CONTENT_TYPES=image/jpeg,image/png,image/webp,application/pdf,text/plain,...
```

## Current Scope

Implemented:

- local private media pattern;
- optional S3-compatible settings;
- upload validation helpers;
- tests for validation and private file serving.

Not implemented yet:

- file attachment models;
- CDN;
- migration of existing files;
- paid storage provider setup.
