from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.conf import settings

from apps.businesses.access import Actions, Resources, assert_can
from apps.core.audit import write_audit_log
from apps.core.import_export import (
    build_import_preview,
    confirm_import,
    create_manual_catalog_item,
    create_manual_sale,
    export_catalog,
    export_clients,
    export_deals,
    export_leads,
    export_sales,
    import_template_response,
    mark_excel_csv_import_failed,
)
from apps.core.file_validation import validate_file_upload
from apps.core.models import AuditLog, ImportJob
from apps.core.permissions import accessible_businesses
from apps.core.serializers import ImportJobSerializer
from apps.core.viewsets import TenantModelViewSet
from apps.integrations.serializers import BusinessEventSerializer


class ImportJobViewSet(TenantModelViewSet):
    serializer_class = ImportJobSerializer
    queryset = ImportJob.objects.select_related("business", "actor")
    access_resource = Resources.CLIENTS

    def get_queryset(self):
        queryset = super().get_queryset()
        business_id = self.request.query_params.get("business")
        if business_id:
            queryset = queryset.filter(business_id=business_id)
        return queryset.filter(actor=self.request.user) if not self.request.user.is_platform_user else queryset

    def perform_create(self, serializer):
        business = serializer.validated_data["business"]
        entity_type = serializer.validated_data.get("entity_type", ImportJob.EntityTypes.CLIENTS)
        assert_can(self.request.user, business, _resource_for_entity(entity_type), Actions.CREATE)
        upload = serializer.validated_data["source_file"]
        _validate_import_file(upload)
        job = serializer.save(actor=self.request.user, original_filename=getattr(upload, "name", ""))
        try:
            build_import_preview(job)
        except Exception as exc:
            job.status = ImportJob.Statuses.FAILED
            job.error = str(exc)
            job.save(update_fields=["status", "error", "updated_at"])
            mark_excel_csv_import_failed(job, exc)
            raise
        write_audit_log(
            self.request,
            AuditLog.Actions.CREATE,
            job,
            business=business,
            metadata={"kind": "import_uploaded", "entity_type": entity_type, "filename": job.original_filename},
        )

    @action(detail=True, methods=["post"])
    def preview(self, request, pk=None):
        job = self.get_object()
        assert_can(request.user, job.business, _resource_for_entity(job.entity_type), Actions.CREATE)
        job = build_import_preview(job, mapping=request.data.get("mapping") or None)
        return Response(self.get_serializer(job).data)

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        job = self.get_object()
        assert_can(request.user, job.business, _resource_for_entity(job.entity_type), Actions.CREATE)
        if job.status == ImportJob.Statuses.IMPORTED:
            raise ValidationError("This import job was already confirmed.")
        try:
            job = confirm_import(job, request)
        except ValidationError:
            raise
        except Exception as exc:
            job.status = ImportJob.Statuses.FAILED
            job.error = str(exc)
            job.save(update_fields=["status", "error", "updated_at"])
            raise
        return Response(self.get_serializer(job).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def export_entity(request, entity_type):
    business_id = request.query_params.get("business")
    business = accessible_businesses(request.user).filter(id=business_id).first() if business_id else accessible_businesses(request.user).first()
    if business is None:
        raise PermissionDenied("Business is required.")
    resource = _resource_for_entity(entity_type)
    assert_can(request.user, business, resource, Actions.VIEW)
    write_audit_log(
        request,
        AuditLog.Actions.CREATE,
        business,
        business=business,
        metadata={"kind": "export", "entity_type": entity_type},
    )
    if entity_type == ImportJob.EntityTypes.CLIENTS:
        return export_clients(business)
    if entity_type == ImportJob.EntityTypes.LEADS:
        return export_leads(business)
    if entity_type == ImportJob.EntityTypes.DEALS:
        return export_deals(business)
    if entity_type == ImportJob.EntityTypes.SALES:
        return export_sales(business)
    if entity_type == ImportJob.EntityTypes.CATALOG:
        return export_catalog(business)
    raise ValidationError("Unsupported export entity.")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def import_template(request, entity_type):
    return import_template_response(entity_type)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def manual_sale(request):
    business = _resolve_business_for_write(request)
    assert_can(request.user, business, Resources.INTEGRATIONS, Actions.MANAGE)
    event = create_manual_sale(business, request.data, request)
    return Response(BusinessEventSerializer(event).data, status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def manual_catalog_item(request):
    business = _resolve_business_for_write(request)
    assert_can(request.user, business, Resources.INTEGRATIONS, Actions.MANAGE)
    event = create_manual_catalog_item(business, request.data, request)
    return Response(BusinessEventSerializer(event).data, status=201)


def _resolve_business_for_write(request):
    business_id = request.data.get("business") or request.query_params.get("business")
    business = accessible_businesses(request.user).filter(id=business_id).first() if business_id else accessible_businesses(request.user).first()
    if business is None:
        raise PermissionDenied("Business is required.")
    return business


def _resource_for_entity(entity_type):
    if entity_type == ImportJob.EntityTypes.CLIENTS:
        return Resources.CLIENTS
    if entity_type == ImportJob.EntityTypes.LEADS:
        return Resources.LEADS
    if entity_type == ImportJob.EntityTypes.DEALS:
        return Resources.DEALS
    if entity_type in {ImportJob.EntityTypes.SALES, ImportJob.EntityTypes.CATALOG}:
        return Resources.INTEGRATIONS
    raise ValidationError("Unsupported import/export entity.")


def _validate_import_file(upload):
    validate_file_upload(
        upload,
        allowed_extensions=["csv", "xlsx"],
        allowed_content_types=[
            "text/csv",
            "application/csv",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
        max_size_mb=settings.MAX_UPLOAD_SIZE_MB,
    )
