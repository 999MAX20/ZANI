from django.db import transaction
from rest_framework.response import Response
from rest_framework.fields import DateField

from apps.businesses.access import Actions, Resources, assert_can
from apps.businesses.models import Business
from apps.core.viewsets import TenantModelViewSet
from apps.core.audit import write_audit_log
from apps.core.models import AuditLog
from apps.scheduling.models import ScheduleException
from apps.scheduling.schedule_serializers import ScheduleExceptionSerializer


class ScheduleExceptionViewSet(TenantModelViewSet):
    queryset = ScheduleException.objects.select_related("business", "resource")
    serializer_class = ScheduleExceptionSerializer
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_access_resource(self):
        return Resources.APPOINTMENTS if self.action in {"list", "retrieve"} else Resources.SETTINGS

    def get_access_action(self):
        return Actions.VIEW if self.action in {"list", "retrieve"} else Actions.UPDATE

    def get_queryset(self):
        queryset = super().get_queryset()
        for field in ("business", "resource"):
            value = self.request.query_params.get(field)
            if value:
                queryset = queryset.filter(**{f"{field}_id": value})
        if self.request.query_params.get("date"):
            queryset = queryset.filter(date=DateField().run_validation(self.request.query_params["date"]))
        return queryset

    @transaction.atomic
    def perform_create(self, serializer):
        Business.objects.select_for_update().get(pk=serializer.validated_data["business"].pk)
        super().perform_create(serializer)

    @transaction.atomic
    def perform_update(self, serializer):
        Business.objects.select_for_update().get(pk=serializer.instance.business_id)
        super().perform_update(serializer)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        # Match the schedule-edit permission for deleting an exception, too.
        instance = self.get_object()
        assert_can(request.user, instance.business, Resources.SETTINGS, Actions.UPDATE)
        Business.objects.select_for_update().get(pk=instance.business_id)
        write_audit_log(request, AuditLog.Actions.DELETE, instance, metadata={"resource_id": instance.resource_id, "date": instance.date.isoformat()})
        instance.delete()
        return Response(status=204)
