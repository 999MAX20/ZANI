# Data Exports

Merchant exports are permission-, capability- and tenant-scoped.

## Contract

- Small entity exports return CSV synchronously from `/api/export/{entity}/`.
- Larger exports return `202` with an `ExportJob`.
- Poll jobs through `/api/export-jobs/` and download a completed private file through `/api/export-jobs/{id}/download/`.
- Analytics exports longer than the synchronous period use the same job flow.
- A worker re-checks the actor's current business permission and module capability before building a file.

## Limits

```env
EXPORT_SYNC_MAX_ROWS=5000
EXPORT_MAX_ROWS=100000
REPORT_MAX_RANGE_DAYS=366
REPORT_EXPORT_SYNC_MAX_DAYS=90
EXPORT_STALE_SECONDS=900
```

`reports_exports` must be consumed by a Celery worker, and beat must run `exports.process_due_jobs`. Failed and stale export jobs are visible in Platform Operations health.
