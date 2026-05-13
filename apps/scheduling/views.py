from datetime import datetime, timedelta

from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.automations.engine import run_automations_for_event
from apps.automations.models import AutomationRule
from apps.activities.services import create_activity_event
from apps.core.crm_cards import appointment_crm_card
from apps.core.permissions import user_can_access_business
from apps.core.viewsets import TenantModelViewSet
from apps.businesses.models import Business
from apps.scheduling.models import Appointment, Resource, WorkingHours
from apps.scheduling.serializers import (
    AppointmentSerializer,
    AvailableSlotSerializer,
    ResourceSerializer,
    WorkingHoursSerializer,
)
from apps.scheduling.services import get_available_slots
from apps.services.models import Service


class ResourceViewSet(TenantModelViewSet):
    queryset = Resource.objects.select_related("business")
    serializer_class = ResourceSerializer


class WorkingHoursViewSet(TenantModelViewSet):
    queryset = WorkingHours.objects.select_related("business", "resource")
    serializer_class = WorkingHoursSerializer


class AppointmentViewSet(TenantModelViewSet):
    queryset = Appointment.objects.select_related("business", "client", "lead", "service", "resource")
    serializer_class = AppointmentSerializer

    def perform_create(self, serializer):
        super().perform_create(serializer)
        appointment = serializer.instance
        run_automations_for_event(
            business=appointment.business,
            trigger_type=AutomationRule.TriggerTypes.APPOINTMENT_CREATED,
            entity=appointment,
            payload={"trigger_type": AutomationRule.TriggerTypes.APPOINTMENT_CREATED, "appointment_id": appointment.id},
        )

    def perform_update(self, serializer):
        previous_status = serializer.instance.status
        super().perform_update(serializer)
        appointment = serializer.instance
        if previous_status != Appointment.Statuses.CANCELLED and appointment.status == Appointment.Statuses.CANCELLED:
            create_activity_event(
                business=appointment.business,
                client=appointment.client,
                actor=self.request.user,
                event_type="appointment_cancelled",
                instance=appointment,
                category="appointment",
                text=f"Запись отменена: {appointment.start_at:%d.%m.%Y %H:%M}",
                metadata={"from": previous_status, "to": appointment.status},
            )
            run_automations_for_event(
                business=appointment.business,
                trigger_type=AutomationRule.TriggerTypes.APPOINTMENT_CANCELLED,
                entity=appointment,
                payload={"trigger_type": AutomationRule.TriggerTypes.APPOINTMENT_CANCELLED, "appointment_id": appointment.id},
            )

    @action(detail=False, methods=["get"], url_path="available-slots")
    def available_slots(self, request):
        business_id = request.query_params.get("business_id")
        service_id = request.query_params.get("service_id")
        resource_id = request.query_params.get("resource_id")
        date_value = request.query_params.get("date")

        if not business_id or not service_id or not date_value:
            raise ValidationError("business_id, service_id and date are required.")

        business = Business.objects.filter(id=business_id).first()
        if not business or not user_can_access_business(request.user, business):
            raise ValidationError("Business is not available.")

        service = Service.objects.filter(id=service_id, business=business).first()
        if not service:
            raise ValidationError("Service is not available.")

        resource = None
        if resource_id:
            resource = Resource.objects.filter(id=resource_id, business=business).first()
            if not resource:
                raise ValidationError("Resource is not available.")

        try:
            slot_date = datetime.strptime(date_value, "%Y-%m-%d").date()
        except ValueError as exc:
            raise ValidationError("date must be YYYY-MM-DD.") from exc

        slots = get_available_slots(business, service, slot_date, resource=resource)
        payload = [
            {"start_at": slot, "end_at": slot + timedelta(minutes=service.duration_minutes)}
            for slot in slots
        ]
        return Response(AvailableSlotSerializer(payload, many=True).data)

    @action(detail=True, methods=["get"], url_path="crm-card")
    def crm_card(self, request, pk=None):
        appointment = self.get_object()
        return Response(appointment_crm_card(appointment))
