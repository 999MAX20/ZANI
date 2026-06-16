from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db.models import Count, Q

from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.crm.serializers import DealSerializer
from apps.notifications.models import Notification

from apps.activities.models import Note
from apps.activities.serializers import NoteSerializer
from apps.automations.engine import run_automations_for_event
from apps.automations.models import AutomationRule
from apps.activities.services import create_activity_event
from apps.businesses.access import Actions, Resources, assert_can
from apps.core.audit import write_audit_log
from apps.core.crm_cards import lead_crm_card
from apps.core.models import AuditLog
from apps.core.viewsets import TenantModelViewSet
from apps.leads.forms_service import log_lead_form_submission_error, submit_lead_form
from apps.leads.models import Lead, LeadForm, LeadFormField, LeadFormSubmission, LeadFormSubmissionError
from apps.leads.serializers import (
    CreateAppointmentFromLeadSerializer,
    LeadDuplicateCheckSerializer,
    LeadFormFieldSerializer,
    LeadFormSerializer,
    LeadFormSubmissionErrorSerializer,
    LeadFormSubmissionSerializer,
    LeadSerializer,
    LeadListSerializer,
    PublicLeadFormSerializer,
)
from apps.scheduling.serializers import AppointmentSerializer
from apps.scheduling.services import create_appointment_from_lead


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
            stale_before = timezone.now() - timezone.timedelta(days=3)
            queryset = queryset.filter(Q(responsible_user__isnull=True) | Q(updated_at__lte=stale_before), status__in=[Lead.Statuses.NEW, Lead.Statuses.CONTACTED, Lead.Statuses.IN_PROGRESS])

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
        stale_before = now - timezone.timedelta(days=3)
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
                "attention": queryset.filter(Q(responsible_user__isnull=True) | Q(updated_at__lte=stale_before), status__in=[Lead.Statuses.NEW, Lead.Statuses.CONTACTED, Lead.Statuses.IN_PROGRESS]).count(),
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

    def perform_update(self, serializer):
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
        user_id = request.data.get("user_id") or request.user.id
        responsible_user = get_user_model().objects.filter(id=user_id, is_active=True).first()
        if responsible_user is None:
            raise ValidationError({"user_id": "User was not found."})
        if not lead.business.members.filter(user=responsible_user, is_active=True).exists():
            raise ValidationError({"user_id": "Responsible user must be an active business member."})
        previous_responsible_user_id = lead.responsible_user_id
        lead.responsible_user = responsible_user
        lead.save(update_fields=["responsible_user", "updated_at"])
        write_audit_log(request, AuditLog.Actions.UPDATE, lead, metadata={"responsible_user": responsible_user.id})
        create_activity_event(
            business=lead.business,
            client=lead.client,
            actor=request.user,
            event_type="lead_assigned",
            instance=lead,
            text="Ответственный по заявке обновлён",
            metadata={"from": previous_responsible_user_id, "to": responsible_user.id},
        )
        return Response(self.get_serializer(lead).data)

    @action(detail=True, methods=["post"], url_path="take-in-work")
    def take_in_work(self, request, pk=None):
        lead = self.get_object()
        assert_can(request.user, lead.business, Resources.LEADS, Actions.UPDATE, obj=lead)
        if lead.status not in {Lead.Statuses.NEW, Lead.Statuses.CONTACTED, Lead.Statuses.LOST}:
            raise ValidationError({"status": "Only new, contacted or lost leads can be taken into work."})
        return self._apply_lead_status(
            lead=lead,
            request=request,
            status=Lead.Statuses.IN_PROGRESS,
            event_type="lead_taken_in_work",
            text="Заявка взята в работу",
        )

    @action(detail=True, methods=["post"], url_path="mark-contacted")
    def mark_contacted(self, request, pk=None):
        lead = self.get_object()
        assert_can(request.user, lead.business, Resources.LEADS, Actions.UPDATE, obj=lead)
        return self._apply_lead_status(
            lead=lead,
            request=request,
            status=Lead.Statuses.CONTACTED,
            event_type="lead_contacted",
            text="С клиентом по заявке связались",
        )

    @action(detail=True, methods=["post"], url_path="mark-closed")
    def mark_closed(self, request, pk=None):
        lead = self.get_object()
        assert_can(request.user, lead.business, Resources.LEADS, Actions.UPDATE, obj=lead)
        return self._apply_lead_status(
            lead=lead,
            request=request,
            status=Lead.Statuses.CLOSED,
            event_type="lead_closed",
            text="Заявка закрыта успешно",
        )

    @action(detail=True, methods=["post"], url_path="mark-lost")
    def mark_lost(self, request, pk=None):
        lead = self.get_object()
        assert_can(request.user, lead.business, Resources.LEADS, Actions.UPDATE, obj=lead)
        lost_reason = (request.data.get("lost_reason") or "").strip()
        if not lost_reason:
            raise ValidationError({"lost_reason": "Reason is required when lead is lost."})
        return self._apply_lead_status(
            lead=lead,
            request=request,
            status=Lead.Statuses.LOST,
            event_type="lead_marked_lost",
            text="Заявка закрыта как отказ",
            lost_reason=lost_reason,
        )

    @action(detail=True, methods=["post"], url_path="reopen")
    def reopen(self, request, pk=None):
        lead = self.get_object()
        assert_can(request.user, lead.business, Resources.LEADS, Actions.UPDATE, obj=lead)
        target_status = lead.previous_status if lead.previous_status and lead.previous_status != Lead.Statuses.LOST else Lead.Statuses.IN_PROGRESS
        return self._apply_lead_status(
            lead=lead,
            request=request,
            status=target_status,
            event_type="lead_reopened",
            text="Заявка возвращена в работу",
            clear_lost=True,
        )

    @action(detail=True, methods=["post"], url_path="create-deal")
    def create_deal(self, request, pk=None):
        lead = self.get_object()
        assert_can(request.user, lead.business, Resources.DEALS, Actions.CREATE, obj=lead)
        existing_deal = lead.deals.filter(is_archived=False).order_by("-updated_at").first()
        if existing_deal:
            return Response(DealSerializer(existing_deal).data)

        pipeline = Pipeline.objects.filter(business=lead.business, is_default=True).first() or Pipeline.objects.filter(business=lead.business).order_by("id").first()
        if pipeline is None:
            pipeline = Pipeline.objects.create(
                business=lead.business,
                name="CRM Light",
                slug=f"crm-light-{lead.business_id}",
                is_default=True,
            )
        stage = PipelineStage.objects.filter(business=lead.business, pipeline=pipeline, is_won=False, is_lost=False).order_by("order", "id").first()
        if stage is None:
            stage = PipelineStage.objects.create(
                business=lead.business,
                pipeline=pipeline,
                name="Новая сделка",
                order=1,
                probability=10,
            )

        title = (request.data.get("title") or f"Сделка по заявке #{lead.id} — {lead.client}").strip()
        deal = Deal.objects.create(
            business=lead.business,
            client=lead.client,
            lead=lead,
            pipeline=pipeline,
            stage=stage,
            title=title,
            amount=request.data.get("amount") or 0,
            source=lead.source,
            owner=lead.responsible_user or request.user,
            probability=stage.probability,
            stage_entered_at=timezone.now(),
        )
        previous_status = lead.status
        lead.status = Lead.Statuses.IN_PROGRESS
        lead.previous_status = previous_status if previous_status != Lead.Statuses.IN_PROGRESS else lead.previous_status
        lead.save(update_fields=["status", "previous_status", "updated_at"])
        write_audit_log(request, AuditLog.Actions.CREATE, deal)
        create_activity_event(
            business=lead.business,
            client=lead.client,
            actor=request.user,
            event_type="deal_created_from_lead",
            instance=deal,
            text="Сделка создана из заявки",
            metadata={"lead_id": lead.id},
        )
        self._notify_responsible(lead, f"По заявке создана сделка: {deal.title}", action_url=f"/dashboard/deals?deal={deal.id}")
        return Response(DealSerializer(deal).data, status=201)

    def _apply_lead_status(self, *, lead, request, status, event_type, text, lost_reason=None, clear_lost=False):
        previous_status = lead.status
        now = timezone.now()
        lead.status = status
        if status == Lead.Statuses.LOST:
            lead.previous_status = previous_status if previous_status != Lead.Statuses.LOST else ""
            lead.lost_reason = lost_reason or lead.lost_reason
            lead.lost_at = now
            lead.lost_by = request.user
        elif clear_lost or status != Lead.Statuses.LOST:
            if previous_status != status:
                lead.previous_status = previous_status
            lead.lost_reason = ""
            lead.lost_at = None
            lead.lost_by = None
        lead.save(update_fields=["status", "previous_status", "lost_reason", "lost_at", "lost_by", "updated_at"])
        write_audit_log(request, AuditLog.Actions.UPDATE, lead, metadata={"from": previous_status, "to": status})
        create_activity_event(
            business=lead.business,
            client=lead.client,
            actor=request.user,
            event_type=event_type,
            instance=lead,
            text=text,
            metadata={"from": previous_status, "to": status},
        )
        self._notify_responsible(lead, text)
        return Response(self.get_serializer(lead).data)

    def _notify_responsible(self, lead, text, *, action_url=None):
        if not lead.responsible_user_id:
            return None
        return Notification.objects.create(
            business=lead.business,
            recipient=lead.responsible_user,
            client=lead.client,
            channel=Notification.Channels.SYSTEM,
            category=Notification.Categories.SALES,
            priority=Notification.Priorities.NORMAL,
            text=text,
            send_at=timezone.now(),
            status=Notification.Statuses.PENDING,
            action_url=action_url or f"/dashboard/leads?lead={lead.id}",
            action_label="Открыть",
        )

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
            event_type="lead_note_added",
            instance=lead,
            text=f"Комментарий к заявке: {text[:120]}",
            metadata={"note_id": note.id},
        )
        return Response(NoteSerializer(note).data, status=201)

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
