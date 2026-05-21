from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from django.utils import timezone

from apps.automations.engine import run_automations_for_event
from apps.automations.models import AutomationRule
from apps.activities.services import create_activity_event
from apps.businesses.access import Actions, Resources, assert_can
from apps.core.audit import write_audit_log
from apps.core.crm_cards import lead_crm_card
from apps.core.models import AuditLog
from apps.core.viewsets import TenantModelViewSet
from apps.leads.forms_service import submit_lead_form
from apps.leads.models import Lead, LeadForm, LeadFormField, LeadFormSubmission
from apps.leads.serializers import (
    CreateAppointmentFromLeadSerializer,
    LeadDuplicateCheckSerializer,
    LeadFormFieldSerializer,
    LeadFormSerializer,
    LeadFormSubmissionSerializer,
    LeadSerializer,
    PublicLeadFormSerializer,
)
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
        if serializer.validated_data.get("status") == Lead.Statuses.LOST:
            lost_reason = serializer.validated_data.get("lost_reason") or serializer.instance.lost_reason
            if not lost_reason:
                raise ValidationError({"lost_reason": "Reason is required when lead is lost."})
            serializer.validated_data.setdefault("previous_status", previous_status)
            serializer.validated_data.setdefault("lost_at", timezone.now())
            serializer.validated_data.setdefault("lost_by", self.request.user)
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

    @action(detail=False, methods=["post"], url_path="check-duplicates")
    def check_duplicates(self, request):
        serializer = LeadDuplicateCheckSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return Response(serializer.duplicates())


class LeadFormViewSet(TenantModelViewSet):
    queryset = LeadForm.objects.select_related("business", "default_responsible_user").prefetch_related("fields")
    serializer_class = LeadFormSerializer
    access_resource = "leads"

    @action(detail=False, methods=["post"], url_path="create-template")
    def create_template(self, request):
        business_id = request.data.get("business")
        from apps.core.permissions import accessible_businesses

        business = accessible_businesses(request.user).filter(id=business_id).first() if business_id else accessible_businesses(request.user).first()
        if business is None:
            raise ValidationError("Business is required.")
        assert_can(request.user, business, Resources.LEADS, Actions.CREATE)
        form = LeadForm.objects.create(
            business=business,
            name=request.data.get("name") or "Website lead form",
            title=request.data.get("title") or "Оставить заявку",
            description=request.data.get("description", "Оставьте контакты, и мы свяжемся с вами."),
            source=request.data.get("source") or Lead.Sources.WEBSITE,
            default_responsible_user=business.owner,
        )
        fields = [
            ("full_name", "Имя", LeadFormField.FieldTypes.TEXT, True),
            ("phone", "Телефон", LeadFormField.FieldTypes.PHONE, True),
            ("email", "Email", LeadFormField.FieldTypes.EMAIL, False),
            ("message", "Комментарий", LeadFormField.FieldTypes.TEXTAREA, False),
        ]
        for index, (key, label, field_type, required) in enumerate(fields, start=1):
            LeadFormField.objects.create(form=form, key=key, label=label, field_type=field_type, is_required=required, sort_order=index)
        return Response(self.get_serializer(form).data, status=201)


class LeadFormFieldViewSet(TenantModelViewSet):
    queryset = LeadFormField.objects.select_related("form", "form__business")
    serializer_class = LeadFormFieldSerializer
    business_lookup = "form__business"
    access_resource = "leads"


class LeadFormSubmissionViewSet(TenantModelViewSet):
    queryset = LeadFormSubmission.objects.select_related("business", "form", "client", "lead")
    serializer_class = LeadFormSubmissionSerializer
    access_resource = "leads"


class PublicLeadFormView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_form"

    def get(self, request, public_id):
        form = LeadForm.objects.prefetch_related("fields").select_related("business").filter(public_id=public_id, is_active=True).first()
        if form is None:
            raise ValidationError("Lead form is not available.")
        return Response(PublicLeadFormSerializer(form).data)


class PublicLeadFormSubmitView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_form"

    def post(self, request, public_id):
        form = LeadForm.objects.prefetch_related("fields").select_related("business", "business__owner", "default_responsible_user").filter(public_id=public_id, is_active=True).first()
        if form is None:
            raise ValidationError("Lead form is not available.")
        try:
            submission = submit_lead_form(lead_form=form, payload=request.data, request=request)
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        return Response(
            {
                "ok": True,
                "success_message": form.success_message,
                "submission_id": submission.id,
                "lead_id": submission.lead_id,
                "duplicate_warning": bool(submission.duplicate_json.get("duplicates")),
            },
            status=201,
        )
