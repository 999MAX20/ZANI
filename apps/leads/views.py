from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from django.utils import timezone
from django.db.models import Count, Q

from apps.clients.serializers import ClientSerializer
from apps.crm.serializers import DealSerializer

from apps.activities.models import Note
from apps.activities.serializers import NoteSerializer
from apps.activities.services import create_activity_event
from apps.activities.taxonomy import ActivityEvents
from apps.automations.engine import run_automations_for_event
from apps.automations.models import AutomationRule
from apps.businesses.access import Actions, Resources, assert_can
from apps.core.audit import write_audit_log
from apps.core.crm_cards import lead_crm_card
from apps.core.models import AuditLog
from apps.core.viewsets import TenantModelViewSet
from apps.core.work_queues import stale_leads_queryset
from apps.leads.forms_service import log_lead_form_submission_error, submit_lead_form
from apps.leads.models import Lead, LeadForm, LeadFormField, LeadFormSubmission, LeadFormSubmissionError
from apps.leads.serializers import (
    CreateAppointmentFromLeadSerializer,
    CreateTaskFromLeadSerializer,
    LeadDuplicateCheckSerializer,
    LeadFormFieldSerializer,
    LeadFormSerializer,
    LeadFormSubmissionErrorSerializer,
    LeadFormSubmissionSerializer,
    LeadSerializer,
    LeadListSerializer,
    PublicLeadFormSerializer,
)
from apps.leads.services import (
    assign_lead,
    convert_lead_to_client,
    create_appointment_from_lead_contract,
    create_deal_from_lead,
    create_follow_up_task_from_lead,
    mark_lead_closed,
    mark_lead_contacted,
    mark_lead_lost,
    reopen_lead,
    take_lead_in_work,
)
from apps.scheduling.serializers import AppointmentSerializer
from apps.tasks.serializers import TaskSerializer


class LeadPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 100


class LeadViewSet(TenantModelViewSet):
    queryset = Lead.objects.select_related("business", "client", "service", "responsible_user")
    serializer_class = LeadSerializer
    pagination_class = LeadPagination

    def get_serializer_class(self):
        if getattr(self, "action", "") == "list":
            return LeadListSerializer
        return super().get_serializer_class()

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        if isinstance(response.data, dict):
            base_queryset = self.filter_queryset(self.get_queryset())
            response.data["facets"] = self._build_facets(base_queryset)
        return response

    def get_queryset(self):
        queryset = super().get_queryset()
        client_ids = self.parse_query_id_list("client_ids")
        if client_ids:
            queryset = queryset.filter(client_id__in=client_ids)
        return self._apply_list_filters(queryset)

    def _apply_list_filters(self, queryset):
        params = self.request.query_params
        search = (params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(client__full_name__icontains=search)
                | Q(client__phone__icontains=search)
                | Q(client__email__icontains=search)
                | Q(message__icontains=search)
                | Q(service__name__icontains=search)
            )

        statuses = self.parse_query_list("status") or self.parse_query_list("statuses")
        if statuses:
            queryset = queryset.filter(status__in=[status for status in statuses if status in Lead.Statuses.values])

        source = (params.get("source") or "").strip()
        if source == "website":
            queryset = queryset.filter(source__in=[Lead.Sources.WEBSITE, Lead.Sources.LANDING])
        elif source:
            queryset = queryset.filter(source=source)

        responsible_user = params.get("responsible_user")
        if responsible_user:
            try:
                queryset = queryset.filter(responsible_user_id=int(responsible_user))
            except (TypeError, ValueError):
                queryset = queryset.none()

        if params.get("unassigned") == "true":
            queryset = queryset.filter(responsible_user__isnull=True)
        if params.get("mine") == "true":
            queryset = queryset.filter(responsible_user=self.request.user)
        if params.get("attention") == "true":
            queryset = stale_leads_queryset(queryset=queryset)

        created_from = params.get("created_from")
        if created_from:
            queryset = queryset.filter(created_at__gte=created_from)
        created_to = params.get("created_to")
        if created_to:
            queryset = queryset.filter(created_at__lte=created_to)

        ordering = params.get("ordering")
        allowed_ordering = {
            "created_at",
            "-created_at",
            "updated_at",
            "-updated_at",
            "status",
            "-status",
            "source",
            "-source",
        }
        if ordering in allowed_ordering:
            queryset = queryset.order_by(ordering, "-id")
        return queryset

    def _build_facets(self, queryset):
        return {
            "status": dict(queryset.values_list("status").annotate(count=Count("id"))),
            "source": dict(queryset.values_list("source").annotate(count=Count("id"))),
        }

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        queryset = super().get_queryset()
        now = timezone.now()
        week_ago = now - timezone.timedelta(days=7)
        by_status = dict(queryset.values_list("status").annotate(count=Count("id")))
        by_source = dict(queryset.values_list("source").annotate(count=Count("id")))
        return Response(
            {
                "total": queryset.count(),
                "new": queryset.filter(status=Lead.Statuses.NEW).count(),
                "new_this_week": queryset.filter(created_at__gte=week_ago).count(),
                "unanswered": queryset.filter(responsible_user__isnull=True).count(),
                "unanswered_this_week": queryset.filter(responsible_user__isnull=True, created_at__gte=week_ago).count(),
                "in_progress": queryset.filter(status__in=[Lead.Statuses.CONTACTED, Lead.Statuses.IN_PROGRESS]).count(),
                "in_progress_this_week": queryset.filter(status__in=[Lead.Statuses.CONTACTED, Lead.Statuses.IN_PROGRESS], created_at__gte=week_ago).count(),
                "hot": queryset.filter(status=Lead.Statuses.NEW, responsible_user__isnull=True).count(),
                "hot_this_week": queryset.filter(status=Lead.Statuses.NEW, responsible_user__isnull=True, created_at__gte=week_ago).count(),
                "attention": stale_leads_queryset(queryset=queryset, now=now).count(),
                "mine": queryset.filter(responsible_user=request.user).count(),
                "by_status": by_status,
                "by_source": by_source,
            }
        )

    def perform_create(self, serializer):
        if serializer.validated_data.get("responsible_user") is None:
            serializer.validated_data["responsible_user"] = self.request.user
        super().perform_create(serializer)
        lead = serializer.instance
        run_automations_for_event(
            business=lead.business,
            trigger_type=AutomationRule.TriggerTypes.LEAD_CREATED,
            entity=lead,
            payload={"trigger_type": AutomationRule.TriggerTypes.LEAD_CREATED, "lead_id": lead.id},
        )

    def _legacy_perform_update_disabled(self, serializer):
        previous_status = serializer.instance.status
        previous_responsible_user_id = serializer.instance.responsible_user_id
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
        if previous_responsible_user_id != lead.responsible_user_id:
            create_activity_event(
                business=lead.business,
                client=lead.client,
                actor=self.request.user,
                event_type="lead_assigned",
                instance=lead,
                text="Ответственный по заявке обновлён",
                metadata={"from": previous_responsible_user_id, "to": lead.responsible_user_id},
            )

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        lead = self.get_object()
        assert_can(request.user, lead.business, Resources.LEADS, Actions.UPDATE, obj=lead)
        lead = assign_lead(lead=lead, actor=request.user, user_id=request.data.get("user_id"), request=request)
        return Response(self.get_serializer(lead).data)

    @action(detail=True, methods=["post"], url_path="take-in-work")
    def take_in_work(self, request, pk=None):
        lead = self.get_object()
        assert_can(request.user, lead.business, Resources.LEADS, Actions.UPDATE, obj=lead)
        lead = take_lead_in_work(lead=lead, actor=request.user, request=request)
        return Response(self.get_serializer(lead).data)

    @action(detail=True, methods=["post"], url_path="mark-contacted")
    def mark_contacted(self, request, pk=None):
        lead = self.get_object()
        assert_can(request.user, lead.business, Resources.LEADS, Actions.UPDATE, obj=lead)
        lead = mark_lead_contacted(lead=lead, actor=request.user, request=request)
        return Response(self.get_serializer(lead).data)

    @action(detail=True, methods=["post"], url_path="mark-closed")
    def mark_closed(self, request, pk=None):
        lead = self.get_object()
        assert_can(request.user, lead.business, Resources.LEADS, Actions.UPDATE, obj=lead)
        lead = mark_lead_closed(lead=lead, actor=request.user, request=request)
        return Response(self.get_serializer(lead).data)

    @action(detail=True, methods=["post"], url_path="mark-lost")
    def mark_lost(self, request, pk=None):
        lead = self.get_object()
        assert_can(request.user, lead.business, Resources.LEADS, Actions.UPDATE, obj=lead)
        lead = mark_lead_lost(lead=lead, actor=request.user, lost_reason=request.data.get("lost_reason", ""), request=request)
        return Response(self.get_serializer(lead).data)

    @action(detail=True, methods=["post"], url_path="reopen")
    def reopen(self, request, pk=None):
        lead = self.get_object()
        assert_can(request.user, lead.business, Resources.LEADS, Actions.UPDATE, obj=lead)
        lead = reopen_lead(lead=lead, actor=request.user, request=request)
        return Response(self.get_serializer(lead).data)

    @action(detail=True, methods=["post"], url_path="create-deal")
    def create_deal(self, request, pk=None):
        lead = self.get_object()
        assert_can(request.user, lead.business, Resources.DEALS, Actions.CREATE, obj=lead)
        result = create_deal_from_lead(
            lead=lead,
            actor=request.user,
            amount=request.data.get("amount") or 0,
            title=request.data.get("title") or "",
            request=request,
        )
        return Response(DealSerializer(result.deal).data, status=201 if result.created else 200)

    @action(detail=True, methods=["post"], url_path="convert-client")
    def convert_client(self, request, pk=None):
        lead = self.get_object()
        assert_can(request.user, lead.business, Resources.LEADS, Actions.UPDATE, obj=lead)
        assert_can(request.user, lead.business, Resources.CLIENTS, Actions.CREATE, obj=lead)
        client = convert_lead_to_client(lead=lead, actor=request.user, request=request)
        return Response(ClientSerializer(client).data)

    @action(detail=True, methods=["post"], url_path="add-note")
    def add_note(self, request, pk=None):
        lead = self.get_object()
        assert_can(request.user, lead.business, Resources.LEADS, Actions.UPDATE, obj=lead)
        text = (request.data.get("text") or "").strip()
        if not text:
            raise ValidationError({"text": "This field is required."})
        note = Note.objects.create(
            business=lead.business,
            client=lead.client,
            author=request.user,
            entity_type="Lead",
            entity_id=str(lead.id),
            text=text,
        )
        write_audit_log(request, AuditLog.Actions.CREATE, note)
        create_activity_event(
            business=lead.business,
            client=lead.client,
            actor=request.user,
            event_type=ActivityEvents.LEAD_NOTE_ADDED,
            instance=lead,
            text=f"Комментарий к заявке: {text[:120]}",
            metadata={"note_id": note.id},
        )
        return Response(NoteSerializer(note).data, status=201)

    @action(detail=True, methods=["post"], url_path="create-appointment")
    def create_appointment(self, request, pk=None):
        lead = self.get_object()
        assert_can(request.user, lead.business, Resources.APPOINTMENTS, Actions.CREATE, obj=lead)
        serializer = CreateAppointmentFromLeadSerializer(data=request.data, context={"lead": lead})
        serializer.is_valid(raise_exception=True)
        appointment = create_appointment_from_lead_contract(
            lead=lead,
            actor=request.user,
            service=serializer.validated_data["service"],
            start_at=serializer.validated_data["start_at"],
            resource=serializer.validated_data.get("resource"),
            request=request,
        )
        run_automations_for_event(
            business=appointment.business,
            trigger_type=AutomationRule.TriggerTypes.APPOINTMENT_CREATED,
            entity=appointment,
            payload={"trigger_type": AutomationRule.TriggerTypes.APPOINTMENT_CREATED, "appointment_id": appointment.id, "lead_id": lead.id},
        )
        return Response(AppointmentSerializer(appointment).data, status=201)

    @action(detail=True, methods=["post"], url_path="create-task")
    def create_task(self, request, pk=None):
        lead = self.get_object()
        assert_can(request.user, lead.business, Resources.TASKS, Actions.CREATE, obj=lead)
        serializer = CreateTaskFromLeadSerializer(data=request.data, context={"lead": lead})
        serializer.is_valid(raise_exception=True)
        task = create_follow_up_task_from_lead(
            lead=lead,
            actor=request.user,
            title=serializer.validated_data["title"],
            description=serializer.validated_data.get("description", ""),
            priority=serializer.validated_data.get("priority") or "normal",
            due_at=serializer.validated_data.get("due_at"),
            assignee_id=serializer.validated_data.get("assignee"),
            request=request,
        )
        return Response(TaskSerializer(task).data, status=201)

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


class LeadFormSubmissionErrorViewSet(TenantModelViewSet):
    queryset = LeadFormSubmissionError.objects.select_related("business", "form")
    serializer_class = LeadFormSubmissionErrorSerializer
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
            log_lead_form_submission_error(
                public_id=public_id,
                payload=request.data,
                error_message="Lead form is not available.",
                request=request,
            )
            raise ValidationError("Lead form is not available.")
        try:
            submission = submit_lead_form(lead_form=form, payload=request.data, request=request)
        except ValueError as exc:
            log_lead_form_submission_error(
                form=form,
                public_id=public_id,
                payload=request.data,
                error_message=str(exc),
                request=request,
            )
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
