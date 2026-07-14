from dataclasses import asdict, dataclass

from django.conf import settings


@dataclass(frozen=True)
class BackupReadinessItem:
    key: str
    title: str
    status: str
    detail: str
    action: str
    required_for_paid_beta: bool = True


def _status(condition):
    return "pass" if condition else "fail"


def _item(key, title, condition, detail, action, required_for_paid_beta=True):
    return BackupReadinessItem(
        key=key,
        title=title,
        status=_status(condition),
        detail=detail,
        action=action,
        required_for_paid_beta=required_for_paid_beta,
    )


def run_backup_restore_readiness_check():
    database = settings.DATABASES["default"]
    engine = database.get("ENGINE", "")
    is_sqlite = engine.endswith("sqlite3")
    uses_object_storage = bool(settings.USE_S3)
    has_storage_bucket = bool(getattr(settings, "AWS_STORAGE_BUCKET_NAME", ""))
    has_storage_endpoint = bool(getattr(settings, "AWS_S3_ENDPOINT_URL", "")) or bool(getattr(settings, "AWS_S3_REGION_NAME", ""))

    items = [
        _item(
            "database.managed_postgres",
            "Managed PostgreSQL is used",
            not is_sqlite,
            f"DATABASE_ENGINE={engine}",
            "Use Supabase/Neon/RDS/Postgres with automated backups for staging/production.",
        ),
        _item(
            "database.connection_reuse",
            "Database connection reuse is configured",
            int(database.get("CONN_MAX_AGE") or 0) >= 30,
            f"CONN_MAX_AGE={database.get('CONN_MAX_AGE')}",
            "Set DB_CONN_MAX_AGE around 60 seconds behind a pooler/proxy.",
            required_for_paid_beta=False,
        ),
        _item(
            "storage.object_storage",
            "Object storage is enabled",
            uses_object_storage,
            f"USE_S3={settings.USE_S3}",
            "Use private S3-compatible object storage before paid beta.",
        ),
        _item(
            "storage.bucket_configured",
            "Storage bucket is configured",
            (not uses_object_storage) or (has_storage_bucket and has_storage_endpoint),
            f"bucket={has_storage_bucket}; endpoint_or_region={has_storage_endpoint}",
            "Set AWS_STORAGE_BUCKET_NAME and endpoint/region for the selected storage provider.",
        ),
        _item(
            "secrets.production_like",
            "Environment is named explicitly",
            settings.ENVIRONMENT in {"staging", "production"},
            f"ENVIRONMENT={settings.ENVIRONMENT}",
            "Use ENVIRONMENT=staging or ENVIRONMENT=production for backup/restore drills.",
            required_for_paid_beta=False,
        ),
    ]
    summary = {
        "pass": sum(1 for item in items if item.status == "pass"),
        "fail": sum(1 for item in items if item.status == "fail"),
        "paid_beta_blockers": sum(1 for item in items if item.status == "fail" and item.required_for_paid_beta),
    }
    return {"environment": settings.ENVIRONMENT, "summary": summary, "items": [asdict(item) for item in items]}
