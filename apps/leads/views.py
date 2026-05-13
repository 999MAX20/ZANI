from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.automations.engine import run_automations_for_event
from apps.automations.models import AutomationRule
from apps.activities.services import create_activity_event
from apps.core.audit import write_audit_log
from apps.core.crm_cards import lead_crm_card
from apps.core.models import AuditLog
from apps.core.viewsets import TenantModelViewSet
from apps.leads.models import Lead
from apps.leads.serializers import CreateAppointmentFromLeadSerializer, LeadSerializer
from apps.scheduling.serializers import AppointmentSerializer
from apps.scheduling.services import create_appointment_from_lead


class LeadViewSet(TenantModelViewSet):
    queryset = Lead.objects.select_related("business", "client", "service", "responsible_user")
    serializer_class = LeadSerializer

    def perform_create(self, serializer):
        super().perform_create(serializer)
        lead = serializer.instance
        run_automations_for_event(
            business=lead.business,
            trigger_type=AutomationRule.TriggerTypes.LEAD_CREATED,
            entity=lead,
            payload={"trigger_type": AutomationRule.TriggerTypes.LEAD_CREATED, "lead_id": lead.id},
        )

    def perform_update(self, serializer):
        previous_status = serializer.instance.status
        super().perform_update(serializer)
        lead = serializer.instance
        if previous_status != lead.status:
            create_activity_event(
                business=lead.business,
                client=lead.client,
                actor=self.request.user,
                event_type="lead_status_changed",
                instance=lead,
                text=f"Статус заявки изменён: {previous_status} → {lead.status}",
                metadata={"from": previous_status, "to": lead.status},
            )

    @action(detail=True, methods=["post"], url_path="create-appointment")
    def create_appointment(self, request, pk=None):
        lead = self.get_object()
        serializer = CreateAppointmentFromLeadSerializer(data=request.data, context={"lead": lead})
        serializer.is_valid(raise_exception=True)
        try:
            appointment = create_appointment_from_lead(
                lead=lead,
                service=serializer.validated_data["service"],
                start_at=serializer.validated_data["start_at"],
                resource=serializer.validated_data.get("resource"),
            )
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        write_audit_log(request, AuditLog.Actions.CREATE, appointment)
        write_audit_log(request, AuditLog.Actions.UPDATE, lead, metadata={"status": lead.status})
        run_automations_for_event(
            business=appointment.business,
            trigger_type=AutomationRule.TriggerTypes.APPOINTMENT_CREATED,
            entity=appointment,
            payload={"trigger_type": AutomationRule.TriggerTypes.APPOINTMENT_CREATED, "appointment_id": appointment.id, "lead_id": lead.id},
        )
        return Response(AppointmentSerializer(appointment).data, status=201)

    @action(detail=True, methods=["get"], url_path="crm-card")
    def crm_card(self, request, pk=None):
        lead = self.get_object()
        return Response(lead_crm_card(lead))
