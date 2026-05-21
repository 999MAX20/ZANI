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

## Storage Accounting And Quotas

Storage usage is calculated from `FileAttachment.size` by business.

The billing usage endpoint includes:

```text
GET /api/billing/usage-summary/
```

Storage response item:

```json
{
  "metric": "storage_mb",
  "value": 12.5,
  "value_bytes": 13107200,
  "limit": 2048,
  "limit_bytes": 2147483648,
  "is_limited": true,
  "is_over_limit": false
}
```

Limits are read from `SubscriptionPlan.limits_json.storage_mb`.

Fallback defaults:

- `start`: 100 MB;
- `growth`: 2048 MB;
- `platform`: 10240 MB.

If a business has no subscription, storage is not blocked yet. This keeps local/dev and early onboarding flows usable while billing enforcement matures.

Uploads are rejected before saving when `current_usage + uploaded_file.size` exceeds the plan limit.

## Audit

File upload and download actions write audit records.

Download audit uses:

```text
AuditLog.action = download
metadata.kind = file_download
category = security
risk_level = medium
```

This is important for owner trust: sensitive documents should leave a trace when employees or support users access them.

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
- file attachment metadata/API foundation.
- storage usage summary;
- plan-aware upload quota check;
- audit for upload/download actions.

Not implemented yet:

- CDN;
- migration of existing files;
- paid storage provider setup.
- antivirus/provider interface;
- production retention policy.
