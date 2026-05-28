from django.http import FileResponse
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.businesses.access import Actions, assert_can, can, scope_queryset
from apps.billing.storage import assert_storage_quota_allows
from apps.core.audit import write_audit_log
from apps.core.file_attachments import assert_attachment_access, resolve_attachment_entity
from apps.core.models import AuditLog, FileAttachment
from apps.core.permissions import IsTenantMember, accessible_businesses, platform_admin_has_global_access, user_can_access_business
from apps.core.serializers import FileAttachmentSerializer


class FileAttachmentViewSet(ModelViewSet):
    serializer_class = FileAttachmentSerializer
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsTenantMember]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        queryset = FileAttachment.objects.select_related("business", "uploaded_by")
        user = self.request.user
        if platform_admin_has_global_access(user):
            filtered = queryset
        else:
            filtered = queryset.none()
            for business in accessible_businesses(user):
                for entity_type, resource in _attachment_resources():
                    if can(user, business, resource, Actions.VIEW).allowed:
                        filtered = filtered | scope_queryset(
                            queryset.filter(business=business, entity_type=entity_type),
                            user,
                            business,
                            resource,
                            Actions.VIEW,
                        )
        params = self.request.query_params
        for field in ["business", "entity_type", "entity_id"]:
            value = params.get(field)
            if value:
                filtered = filtered.filter(**{field: value})
        return filtered.distinct()

    def perform_create(self, serializer):
        business = serializer.validated_data["business"]
        if not user_can_access_business(self.request.user, business):
            raise PermissionDenied("You do not have access to this business.")
        _, resource = resolve_attachment_entity(
            business,
            serializer.validated_data["entity_type"],
            serializer.validated_data["entity_id"],
        )
        assert_can(self.request.user, business, resource, Actions.UPDATE)
        uploaded_file = serializer.validated_data["file"]
        assert_storage_quota_allows(business, getattr(uploaded_file, "size", 0) or 0)
        attachment = serializer.save(uploaded_by=self.request.user)
        write_audit_log(
            self.request,
            AuditLog.Actions.CREATE,
            attachment,
            business=business,
            metadata={"kind": "file_upload", "entity_type": attachment.entity_type, "entity_id": attachment.entity_id},
        )

    def retrieve(self, request, *args, **kwargs):
        attachment = self.get_object()
        assert_attachment_access(request.user, attachment, Actions.VIEW)
        return Response(self.get_serializer(attachment).data)

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        attachment = self.get_object()
        assert_attachment_access(request.user, attachment, Actions.VIEW)
        write_audit_log(
            request,
            AuditLog.Actions.DOWNLOAD,
            attachment,
            business=attachment.business,
            metadata={"kind": "file_download", "entity_type": attachment.entity_type, "entity_id": attachment.entity_id},
        )
        return FileResponse(attachment.file.open("rb"), as_attachment=False, filename=attachment.original_name)


def _attachment_resources():
    return [
        ("client", "clients"),
        ("lead", "leads"),
        ("deal", "deals"),
        ("appointment", "appointments"),
        ("task", "tasks"),
        ("bot_conversation", "conversations"),
        ("bot_message", "conversations"),
    ]
