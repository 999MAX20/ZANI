from rest_framework.viewsets import ModelViewSet

from apps.businesses.models import Business, BusinessMember
from apps.businesses.serializers import BusinessMemberSerializer, BusinessSerializer
from apps.core.audit import write_audit_log
from apps.core.models import AuditLog
from apps.core.permissions import IsTenantMember, accessible_businesses, is_platform_admin
from apps.core.viewsets import TenantModelViewSet


class BusinessViewSet(ModelViewSet):
    serializer_class = BusinessSerializer
    permission_classes = [IsTenantMember]

    def get_queryset(self):
        return Business.objects.all() if is_platform_admin(self.request.user) else accessible_businesses(self.request.user)

    def perform_create(self, serializer):
        owner = serializer.validated_data.get("owner") or self.request.user
        business = serializer.save(owner=owner)
        BusinessMember.objects.get_or_create(
            business=business,
            user=owner,
            defaults={"role": BusinessMember.Roles.OWNER, "is_active": True},
        )
        from apps.crm.services import ensure_default_pipeline

        ensure_default_pipeline(business)
        write_audit_log(self.request, AuditLog.Actions.CREATE, business)

    def perform_update(self, serializer):
        business = serializer.save()
        write_audit_log(self.request, AuditLog.Actions.UPDATE, business)


class BusinessMemberViewSet(TenantModelViewSet):
    queryset = BusinessMember.objects.select_related("business", "user")
    serializer_class = BusinessMemberSerializer
