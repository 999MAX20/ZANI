from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.businesses.access import Actions, Resources, can
from apps.businesses.capabilities import resource_is_enabled
from apps.core.import_export import entity_export_queryset, export_entity_response
from apps.core.models import ExportJob
from apps.integrations.sanitization import sanitize_error_text


def export_resource(export_key):
    return {
        "clients": Resources.CLIENTS,
        "leads": Resources.LEADS,
        "deals": Resources.DEALS,
        "sales": Resources.INTEGRATIONS,
        "catalog": Resources.INTEGRATIONS,
        "source_roi": Resources.ANALYTICS,
        "manager_performance": Resources.ANALYTICS,
        "funnel_velocity": Resources.ANALYTICS,
        "retention_ltv": Resources.ANALYTICS,
    }.get(export_key)


def request_entity_export(*, business, actor, export_key):
    resource = export_resource(export_key)
    if resource is None:
        raise ValidationError("Unsupported export entity.")
    if not resource_is_enabled(business, resource) or not can(actor, business, resource, Actions.VIEW).allowed:
        raise PermissionDenied("Export is not available.")
    row_count = entity_export_queryset(business, export_key, user=actor).count()
    if row_count > settings.EXPORT_MAX_ROWS:
        raise ValidationError({"export": f"Export cannot exceed {settings.EXPORT_MAX_ROWS} rows."})
    if row_count <= settings.EXPORT_SYNC_MAX_ROWS:
        return export_entity_response(business, export_key, user=actor), None
    job = _create_job(
        business=business,
        actor=actor,
        kind=ExportJob.Kinds.ENTITY,
        export_key=export_key,
        parameters={"expected_rows": row_count},
        row_count=row_count,
    )
    return None, job


def request_report_export(*, business, actor, report_key, start_date, end_date):
    if export_resource(report_key) != Resources.ANALYTICS:
        raise ValidationError("Unsupported analytics report.")
    if not resource_is_enabled(business, Resources.ANALYTICS) or not can(actor, business, Resources.ANALYTICS, Actions.VIEW).allowed:
        raise PermissionDenied("Export is not available.")
    days = (end_date - start_date).days + 1
    if days <= settings.REPORT_EXPORT_SYNC_MAX_DAYS:
        from apps.analytics.reports import export_report_csv

        return export_report_csv(
            business,
            report_key,
            user=actor,
            start_date=start_date,
            end_date=end_date,
        ), None
    job = _create_job(
        business=business,
        actor=actor,
        kind=ExportJob.Kinds.ANALYTICS_REPORT,
        export_key=report_key,
        parameters={"start": start_date.isoformat(), "end": end_date.isoformat()},
    )
    return None, job


def _create_job(*, business, actor, kind, export_key, parameters, row_count=0):
    job = ExportJob.objects.create(
        business=business,
        actor=actor,
        kind=kind,
        export_key=export_key,
        parameters_json=parameters,
        row_count=row_count,
    )
    from apps.core.tasks import process_export_job_task

    transaction.on_commit(lambda: process_export_job_task.delay(job.id))
    return job


def process_export_job(job_id):
    stale_before = timezone.now() - timezone.timedelta(seconds=settings.EXPORT_STALE_SECONDS)
    claimed = ExportJob.objects.filter(id=job_id).filter(
        Q(status=ExportJob.Statuses.PENDING)
        | Q(status=ExportJob.Statuses.RUNNING, started_at__lt=stale_before)
    ).update(
        status=ExportJob.Statuses.RUNNING,
        started_at=timezone.now(),
        error="",
    )
    if not claimed:
        return ExportJob.objects.filter(id=job_id).first()
    job = ExportJob.objects.select_related("business", "actor").get(id=job_id)
    try:
        resource = export_resource(job.export_key)
        if (
            job.actor is None
            or resource is None
            or not resource_is_enabled(job.business, resource)
            or not can(job.actor, job.business, resource, Actions.VIEW).allowed
        ):
            raise PermissionDenied("Export access is no longer available.")
        if job.kind == ExportJob.Kinds.ENTITY:
            response = export_entity_response(job.business, job.export_key, user=job.actor)
        elif job.kind == ExportJob.Kinds.ANALYTICS_REPORT:
            from apps.analytics.reports import export_report_csv

            response = export_report_csv(
                job.business,
                job.export_key,
                user=job.actor,
                start_date=parse_date(job.parameters_json.get("start", "")),
                end_date=parse_date(job.parameters_json.get("end", "")),
            )
        else:
            raise ValidationError("Unsupported export job kind.")
        content = bytes(response.content)
        filename = f"{job.export_key}-{job.id}.csv"
        job.result_file.save(filename, ContentFile(content), save=False)
        job.row_count = max(content.count(b"\n") - 1, 0)
        job.status = ExportJob.Statuses.SUCCEEDED
        job.completed_at = timezone.now()
        job.error = ""
        job.save(update_fields=["result_file", "row_count", "status", "completed_at", "error", "updated_at"])
    except Exception as exc:
        job.status = ExportJob.Statuses.FAILED
        job.completed_at = timezone.now()
        job.error = sanitize_error_text(str(exc), max_length=1000)
        job.save(update_fields=["status", "completed_at", "error", "updated_at"])
    return job


def process_due_export_jobs(limit=50):
    stale_before = timezone.now() - timezone.timedelta(seconds=settings.EXPORT_STALE_SECONDS)
    job_ids = list(
        ExportJob.objects.filter(
            Q(status=ExportJob.Statuses.PENDING)
            | Q(status=ExportJob.Statuses.RUNNING, started_at__lt=stale_before)
        )
        .order_by("created_at")
        .values_list("id", flat=True)[: max(1, min(int(limit or 50), 200))]
    )
    return [process_export_job(job_id) for job_id in job_ids]
