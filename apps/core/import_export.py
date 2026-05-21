import csv
import io
from pathlib import Path

from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.exceptions import ValidationError

try:
    from openpyxl import load_workbook
except ImportError:  # pragma: no cover - local env may install requirements after code checkout.
    load_workbook = None

from apps.clients.models import Client
from apps.clients.services import duplicate_payload, find_duplicate_clients
from apps.core.audit import write_audit_log
from apps.core.models import AuditLog, ImportJob
from apps.crm.models import Deal
from apps.leads.models import Lead


CLIENT_FIELD_ALIASES = {
    "full_name": ["full_name", "name", "имя", "фио", "клиент", "client", "contact"],
    "phone": ["phone", "телефон", "номер", "mobile", "whatsapp"],
    "email": ["email", "почта", "e-mail"],
    "source": ["source", "источник"],
    "notes": ["notes", "note", "заметки", "комментарий"],
}

CLIENT_FIELDS = ["full_name", "phone", "email", "source", "notes"]


def build_import_preview(job: ImportJob, mapping=None):
    rows = read_tabular_file(job.source_file.path)
    headers = list(rows[0].keys()) if rows else []
    mapping = mapping or guess_mapping(headers, CLIENT_FIELD_ALIASES)
    preview_rows = rows[:10]
    duplicates = duplicate_preview(job, preview_rows, mapping)
    job.mapping_json = mapping
    job.preview_json = {"headers": headers, "rows": preview_rows}
    job.duplicates_json = {"rows": duplicates}
    job.total_rows = len(rows)
    job.status = ImportJob.Statuses.PREVIEWED
    job.error = ""
    job.save(update_fields=["mapping_json", "preview_json", "duplicates_json", "total_rows", "status", "error", "updated_at"])
    return job


@transaction.atomic
def confirm_import(job: ImportJob, request):
    if job.entity_type != ImportJob.EntityTypes.CLIENTS:
        raise ValidationError("Only clients import is enabled in this foundation stage.")
    mapping = job.mapping_json or {}
    if not mapping:
        raise ValidationError("Run preview before confirming import.")
    rows = read_tabular_file(job.source_file.path)
    imported = 0
    for row in rows:
        payload = mapped_payload(row, mapping)
        if not payload.get("full_name") and not payload.get("phone") and not payload.get("email"):
            continue
        Client.objects.create(
            business=job.business,
            full_name=payload.get("full_name") or payload.get("phone") or payload.get("email") or "Imported client",
            phone=payload.get("phone", ""),
            email=payload.get("email", ""),
            source=payload.get("source") or Client.Sources.OTHER,
            notes=payload.get("notes", ""),
        )
        imported += 1
    job.status = ImportJob.Statuses.IMPORTED
    job.imported_count = imported
    job.imported_at = timezone.now()
    job.error = ""
    job.save(update_fields=["status", "imported_count", "imported_at", "error", "updated_at"])
    write_audit_log(
        request,
        AuditLog.Actions.CREATE,
        job,
        business=job.business,
        metadata={"kind": "import_confirmed", "entity_type": job.entity_type, "rows": imported},
    )
    return job


def read_tabular_file(path):
    extension = Path(path).suffix.lower()
    if extension == ".csv":
        with open(path, newline="", encoding="utf-8-sig") as file:
            return list(csv.DictReader(file))
    if extension == ".xlsx":
        if load_workbook is None:
            raise ValidationError("XLSX import requires openpyxl. Install requirements.txt and retry.")
        workbook = load_workbook(path, read_only=True, data_only=True)
        sheet = workbook.active
        rows = list(sheet.iter_rows(values_only=True))
        if not rows:
            return []
        headers = [str(value or "").strip() for value in rows[0]]
        result = []
        for values in rows[1:]:
            result.append({headers[index]: cell_to_string(value) for index, value in enumerate(values) if index < len(headers)})
        return result
    raise ValidationError("Only CSV and XLSX files are supported.")


def cell_to_string(value):
    if value is None:
        return ""
    return str(value).strip()


def guess_mapping(headers, aliases):
    mapping = {}
    normalized = {normalize_header(header): header for header in headers}
    for field, candidates in aliases.items():
        for candidate in candidates:
            header = normalized.get(normalize_header(candidate))
            if header:
                mapping[field] = header
                break
    return mapping


def normalize_header(value):
    return str(value or "").strip().lower().replace(" ", "_")


def mapped_payload(row, mapping):
    return {field: str(row.get(header, "") or "").strip() for field, header in mapping.items() if field in CLIENT_FIELDS}


def duplicate_preview(job, rows, mapping):
    result = []
    for index, row in enumerate(rows, start=1):
        payload = mapped_payload(row, mapping)
        duplicates = find_duplicate_clients(job.business, phone=payload.get("phone"), email=payload.get("email"))
        if duplicates:
            result.append({"row": index, "payload": payload, "duplicates": duplicate_payload(duplicates, phone=payload.get("phone"), email=payload.get("email"))})
    return result


def export_csv_response(queryset, fields, filename):
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(fields)
    for instance in queryset:
        writer.writerow([getattr(instance, field, "") for field in fields])
    response = HttpResponse(buffer.getvalue(), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def export_clients(business):
    return export_csv_response(
        Client.objects.filter(business=business, is_archived=False).order_by("id"),
        ["id", "full_name", "phone", "email", "source", "notes", "created_at"],
        "clients.csv",
    )


def export_leads(business):
    return export_csv_response(
        Lead.objects.filter(business=business, is_archived=False).order_by("id"),
        ["id", "client_id", "service_id", "source", "status", "message", "responsible_user_id", "created_at"],
        "leads.csv",
    )


def export_deals(business):
    return export_csv_response(
        Deal.objects.filter(business=business, is_archived=False).order_by("id"),
        ["id", "client_id", "pipeline_id", "stage_id", "title", "amount", "status", "owner_id", "source", "created_at"],
        "deals.csv",
    )
