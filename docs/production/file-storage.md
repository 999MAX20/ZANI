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

For Supabase Storage S3-compatible API, Cloudflare R2, Yandex Object Storage or AWS S3:

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

Recommended staging choice:

- Cloudflare R2 if you want simple S3-compatible private buckets with predictable pricing;
- Supabase Storage S3-compatible API if you want to keep database and storage in one vendor;
- AWS S3 for mature production operations.

Do not use Render container disk for paid beta uploads. Render web disks are not a tenant-safe, redeploy-safe file storage strategy for merchant documents.

Recommended path strategy:

```text
private/attachments/business-{business_id}/{filename}
```

The `business-{id}` prefix is part of the object key and must remain stable. Bucket permissions should stay private; access goes through the backend so tenant permissions and audit can be enforced.

## Runtime Smoke

After configuring object storage in staging, run:

```bash
python manage.py storage_runtime_smoke --business-id <business_id>
```

For Render Shell or production-like env, prefer:

```bash
BUSINESS_ID=<business_id> scripts/render_h2_storage_smoke.sh
```

Optional cleanup:

```bash
python manage.py storage_runtime_smoke --business-id <business_id> --cleanup
```

The command creates a tiny private `FileAttachment`, writes it through the active Django storage backend, checks that the object exists, and prints the final object key.

If it fails:

- `USE_S3` may still be `False`;
- bucket credentials may be wrong;
- endpoint/region may be wrong;
- bucket policy may reject writes;
- Render env may be deployed from old values.
- backend web and worker services may not share the same storage env.

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

The legacy local endpoint also checks the `business-{id}` prefix before serving files:

```text
GET /api/files/private/business-<id>/...
```

Use `GET /api/file-attachments/{id}/download/` for real CRM files because it enforces object-level entity access and writes the download audit record.

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

## Production Cutover Checklist

1. Create a private bucket.
2. Set `USE_S3=True` and S3-compatible env variables.
3. Redeploy backend and workers.
4. Run `scripts/render_h2_storage_smoke.sh`.
5. Upload/download a file through CRM UI.
6. Verify `AuditLog` contains upload/download records.
7. Verify `GET /api/billing/usage-summary/` shows storage usage.
8. Keep lifecycle/retention rules documented before paid traffic.

## H2 Acceptance

H2 is green only when:

- object storage is private by default;
- `USE_S3=True` in staging/production;
- `storage.object_storage` is green in `production_readiness_audit`;
- `scripts/render_h2_storage_smoke.sh` passes;
- another merchant cannot list or download the uploaded file;
- owner usage summary shows storage usage;
- download creates an `AuditLog` record.
