from rest_framework.viewsets import ModelViewSet
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.activities.services import write_activity_event
from apps.core.audit import write_audit_log
from apps.core.models import AuditLog
from apps.core.permissions import IsTenantMember, accessible_businesses, is_platform_admin, user_can_access_business


class TenantModelViewSet(ModelViewSet):
    permission_classes = [IsTenantMember]
    business_lookup = "business"

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        if is_platform_admin(user):
            return queryset

        business_ids = accessible_businesses(user).values("id")
        return queryset.filter(**{f"{self.business_lookup}__in": business_ids})

    def _business_from_serializer(self, serializer):
        business = serializer.validated_data.get("business")
        if business is None and "conversation" in serializer.validated_data:
            business = serializer.validated_data["conversation"].business
        if business is None and "bot" in serializer.validated_data:
            business = serializer.validated_data["bot"].business
        if business is None and "rule" in serializer.validated_data:
            business = serializer.validated_data["rule"].business
        if business is None and serializer.instance is not None:
            business = getattr(serializer.instance, "business", None)
            if business is None and hasattr(serializer.instance, "conversation"):
                business = serializer.instance.conversation.business
            if business is None and hasattr(serializer.instance, "bot"):
                business = serializer.instance.bot.business
            if business is None and hasattr(serializer.instance, "rule"):
                business = serializer.instance.rule.business
        return business

    def _enforce_business_access(self, serializer):
        business = self._business_from_serializer(serializer)
        if not user_can_access_business(self.request.user, business):
            raise PermissionDenied("You do not have access to this business.")

    def perform_create(self, serializer):
        self._enforce_business_access(serializer)
        instance = serializer.save()
        write_audit_log(self.request, AuditLog.Actions.CREATE, instance)
        write_activity_event(self.request, f"{instance.__class__.__name__.lower()}.created", instance)

    def perform_update(self, serializer):
        self._enforce_business_access(serializer)
        instance = serializer.save()
        write_audit_log(self.request, AuditLog.Actions.UPDATE, instance)
        write_activity_event(self.request, f"{instance.__class__.__name__.lower()}.updated", instance)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        write_audit_log(request, AuditLog.Actions.DELETE, instance, metadata={"repr": str(instance)})
        write_activity_event(request, f"{instance.__class__.__name__.lower()}.deleted", instance)
        self.perform_destroy(instance)
        return Response(status=204)
