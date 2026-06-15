from django.db import models
from django.db.models import BooleanField, Case, Count, Exists, F, IntegerField, OuterRef, Q, Subquery, Value, When
from django.db.models.functions import Cast

from rest_framework.decorators import action
from rest_framework.response import Response

from apps.activities.models import Segment, TaggedObject
from apps.activities.segments import evaluate_segment_queryset
from apps.clients.models import Client
from apps.clients.serializers import ClientMergeSerializer, ClientSerializer, DuplicateCheckSerializer
from apps.core.audit import write_audit_log
from apps.core.crm_cards import client_crm_card
from apps.core.models import AuditLog
from apps.core.viewsets import TenantModelViewSet
from apps.crm.models import Deal
from apps.leads.models import Lead
from apps.scheduling.models import Appointment
from apps.tasks.models import Task
from apps.bots.models import BotConversation


class ClientViewSet(TenantModelViewSet):
    queryset = Client.objects.select_related("business")
    serializer_class = ClientSerializer

    def _build_client_summary(self, queryset):
        return queryset.aggregate(
            total=Count("id"),
            active=Count("id", filter=Q(is_active=True) | Q(is_vip=True)),
            no_reply=Count("id", filter=Q(has_no_reply=True)),
            repeat=Count("id", filter=Q(has_multiple_deals=True) | Q(has_multiple_appointments=True)),
        )

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        summary = self._build_client_summary(queryset)
        response = super().list(request, *args, **kwargs)
        if isinstance(response.data, dict):
            response.data["summary"] = {
                "total": summary["total"],
                "active": summary["active"],
                "no_reply": summary["no_reply"],
                "repeat": summary["repeat"],
            }
        return response

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get("q") or self.request.query_params.get("search")
        source = self.request.query_params.get("source")
        tag_id = self.request.query_params.get("tag")
        segment_id = self.request.query_params.get("segment")
        client_ids = self.parse_query_id_list("client_ids")
        if search:
            queryset = queryset.filter(full_name__icontains=search) | queryset.filter(phone__icontains=search) | queryset.filter(email__icontains=search)
        if client_ids:
            queryset = queryset.filter(id__in=client_ids)
        if source:
            queryset = queryset.filter(source=source)
        if tag_id:
            client_ids = TaggedObject.objects.filter(
                business_id__in=queryset.values_list("business_id", flat=True),
                entity_type="client",
                tag_id=tag_id,
            ).values_list("entity_id", flat=True)
            queryset = queryset.filter(id__in=client_ids)

        latest_lead = Lead.objects.filter(
            client_id=OuterRef("id"),
            is_archived=False,
        ).order_by("-updated_at")
        latest_deal = Deal.objects.filter(
            client_id=OuterRef("id"),
            is_archived=False,
        ).order_by("-updated_at")
        latest_task = Task.objects.filter(
            client_id=OuterRef("id"),
            is_archived=False,
        ).exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED]).order_by("-updated_at")
        latest_conversation = BotConversation.objects.filter(
            client_id=OuterRef("id"),
            is_archived=False,
        ).order_by("-updated_at")
        has_open_deal = Deal.objects.filter(
            client_id=OuterRef("id"),
            is_archived=False,
            status=Deal.Statuses.OPEN,
        )
        has_open_task = Task.objects.filter(
            client_id=OuterRef("id"),
            is_archived=False,
        ).exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED])
        has_appointment = Appointment.objects.filter(
            client_id=OuterRef("id"),
            is_archived=False,
        )
        has_recent_interaction = BotConversation.objects.filter(
            client_id=OuterRef("id"),
            is_archived=False,
        )
        has_no_reply_conversation = BotConversation.objects.filter(
            client_id=OuterRef("id"),
            is_archived=False,
        ).filter(Q(unread_count__gt=0) | Q(handoff_required=True))
        has_new_lead = Lead.objects.filter(
            client_id=OuterRef("id"),
            is_archived=False,
            status=Lead.Statuses.NEW,
        )
        multiple_deals = (
            Deal.objects.filter(client_id=OuterRef("id"), is_archived=False)
            .values("client_id")
            .annotate(total=Count("id"))
            .filter(total__gt=1)
        )
        multiple_appointments = (
            Appointment.objects.filter(client_id=OuterRef("id"), is_archived=False)
            .values("client_id")
            .annotate(total=Count("id"))
            .filter(total__gt=1)
        )

        if segment_id:
            segment = Segment.objects.filter(id=segment_id).first()
            if segment is None:
                return queryset.none()
            segment_ids = evaluate_segment_queryset(segment).values_list("id", flat=True)
            queryset = queryset.filter(id__in=segment_ids)
        queryset = queryset.annotate(
            latest_lead_manager_id=Subquery(latest_lead.values("responsible_user_id")[:1]),
            latest_deal_owner_id=Subquery(latest_deal.values("owner_id")[:1]),
            latest_task_manager_id=Subquery(latest_task.values("assignee_id")[:1]),
            latest_conversation_manager_id=Subquery(latest_conversation.values("assigned_to_id")[:1]),
            is_vip=Exists(
                TaggedObject.objects.filter(
                    business_id=OuterRef("business_id"),
                    entity_type="client",
                    entity_id=Cast(OuterRef("id"), output_field=models.CharField()),
                    tag__name__iexact="vip",
                )
            ),
            has_open_deal=Exists(has_open_deal),
            has_open_task=Exists(has_open_task),
            has_appointment=Exists(has_appointment),
            has_recent_interaction=Exists(has_recent_interaction),
            has_no_reply_conversation=Exists(has_no_reply_conversation),
            has_new_lead=Exists(has_new_lead),
            has_no_reply=Case(
                When(Q(has_no_reply_conversation=True) | Q(has_new_lead=True), then=Value(True)),
                default=Value(False),
                output_field=BooleanField(),
            ),
            has_multiple_deals=Exists(multiple_deals),
            has_multiple_appointments=Exists(multiple_appointments),
            is_active=Case(
                When(
                    Q(has_open_deal=True) | Q(has_open_task=True) | Q(has_appointment=True) | Q(has_recent_interaction=True),
                    then=Value(True),
                ),
                default=Value(False),
                output_field=BooleanField(),
            ),
            manager_user_id=Case(
                When(latest_task_manager_id__isnull=False, then=F("latest_task_manager_id")),
                When(latest_deal_owner_id__isnull=False, then=F("latest_deal_owner_id")),
                When(latest_lead_manager_id__isnull=False, then=F("latest_lead_manager_id")),
                When(latest_conversation_manager_id__isnull=False, then=F("latest_conversation_manager_id")),
                default=Value(None),
                output_field=IntegerField(),
            ),
        )
        return queryset.distinct()

    @action(detail=True, methods=["get"], url_path="crm-card")
    def crm_card(self, request, pk=None):
        client = self.get_object()
        return Response(client_crm_card(client))

    @action(detail=False, methods=["post"], url_path="check-duplicates")
    def check_duplicates(self, request):
        serializer = DuplicateCheckSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return Response({"duplicates": serializer.duplicates()})

    @action(detail=True, methods=["post"])
    def merge(self, request, pk=None):
        target_client = self.get_object()
        serializer = ClientMergeSerializer(data=request.data, context={"request": request, "target_client": target_client})
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        write_audit_log(request, AuditLog.Actions.UPDATE, target_client, metadata={"merge": result})
        return Response(result)
