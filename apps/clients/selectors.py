from django.db import models
from django.db.models import BooleanField, Case, CharField, Count, DateTimeField, Exists, F, IntegerField, OuterRef, Q, Subquery, Value, When
from django.db.models.functions import Cast

from apps.activities.models import Segment, TaggedObject
from apps.activities.segments import evaluate_segment_queryset
from apps.bots.models import BotConversation
from apps.clients.identity import normalize_email, normalize_phone
from apps.crm.models import Deal
from apps.leads.models import Lead
from apps.scheduling.models import Appointment
from apps.tasks.models import Task


def client_queryset_for_request(queryset, request, *, client_ids=None, apply_quick_filter=True):
    queryset = filter_client_queryset(queryset, request, client_ids=client_ids)
    queryset = annotate_client_list_queryset(queryset)
    if apply_quick_filter:
        queryset = apply_client_quick_filter(queryset, request)
    return queryset.distinct()


def filter_client_queryset(queryset, request, *, client_ids=None):
    search = request.query_params.get("q") or request.query_params.get("search")
    source = request.query_params.get("source")
    tag_id = request.query_params.get("tag")
    segment_id = request.query_params.get("segment")

    if search:
        normalized_phone = normalize_phone(search)
        normalized_email = normalize_email(search)
        search_query = Q(full_name__icontains=search) | Q(phone__icontains=search) | Q(email__icontains=search)
        if normalized_phone:
            search_query |= Q(normalized_phone__icontains=normalized_phone)
        if normalized_email:
            search_query |= Q(normalized_email__icontains=normalized_email)
        queryset = queryset.filter(search_query)
    if client_ids:
        queryset = queryset.filter(id__in=client_ids)
    if source:
        queryset = queryset.filter(source=source)
    if tag_id:
        tagged_client_ids = TaggedObject.objects.filter(
            business_id__in=queryset.values_list("business_id", flat=True),
            entity_type="client",
            tag_id=tag_id,
        ).values_list("entity_id", flat=True)
        queryset = queryset.filter(id__in=tagged_client_ids)
    if segment_id:
        segment = Segment.objects.filter(
            id=segment_id,
            business_id__in=queryset.values_list("business_id", flat=True),
            entity_type=Segment.EntityTypes.CLIENT,
            is_active=True,
        ).first()
        if segment is None:
            return queryset.none()
        segment_ids = evaluate_segment_queryset(segment).values_list("id", flat=True)
        queryset = queryset.filter(id__in=segment_ids)
    return queryset


def annotate_client_list_queryset(queryset):
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

    return queryset.annotate(
        latest_lead_manager_id=Subquery(latest_lead.values("responsible_user_id")[:1]),
        latest_deal_owner_id=Subquery(latest_deal.values("owner_id")[:1]),
        latest_task_manager_id=Subquery(latest_task.values("assignee_id")[:1]),
        latest_conversation_manager_id=Subquery(latest_conversation.values("assigned_to_id")[:1]),
        latest_lead_at=Subquery(latest_lead.values("updated_at")[:1], output_field=DateTimeField()),
        latest_deal_at=Subquery(latest_deal.values("updated_at")[:1], output_field=DateTimeField()),
        latest_task_at=Subquery(latest_task.values("due_at")[:1], output_field=DateTimeField()),
        latest_conversation_at=Subquery(latest_conversation.values("updated_at")[:1], output_field=DateTimeField()),
        latest_task_title=Subquery(latest_task.values("title")[:1]),
        latest_task_due_at=Subquery(latest_task.values("due_at")[:1], output_field=DateTimeField()),
        latest_task_priority=Subquery(latest_task.values("priority")[:1]),
        leads_count=Count("leads", filter=Q(leads__is_archived=False), distinct=True),
        deals_count=Count("deals", filter=Q(deals__is_archived=False), distinct=True),
        appointments_count=Count("appointments", filter=Q(appointments__is_archived=False), distinct=True),
        tasks_count=Count("tasks", filter=Q(tasks__is_archived=False), distinct=True),
        conversations_count=Count("bot_conversations", filter=Q(bot_conversations__is_archived=False), distinct=True),
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
        last_activity_at=Case(
            When(latest_conversation_at__isnull=False, then=F("latest_conversation_at")),
            When(latest_task_at__isnull=False, then=F("latest_task_at")),
            When(latest_deal_at__isnull=False, then=F("latest_deal_at")),
            When(latest_lead_at__isnull=False, then=F("latest_lead_at")),
            default=F("updated_at"),
            output_field=DateTimeField(),
        ),
        next_step_title=Case(
            When(latest_task_title__isnull=False, then=F("latest_task_title")),
            When(has_no_reply=True, then=Value("Ответить клиенту")),
            When(has_appointment=True, then=Value("Подтвердить запись")),
            default=Value("Связаться с клиентом"),
            output_field=CharField(),
        ),
        next_step_date=Case(
            When(latest_task_due_at__isnull=False, then=F("latest_task_due_at")),
            default=Value(None),
            output_field=DateTimeField(),
        ),
        next_step_priority=Case(
            When(latest_task_priority__isnull=False, then=F("latest_task_priority")),
            default=Value("normal"),
            output_field=CharField(),
        ),
    )


def apply_client_quick_filter(queryset, request):
    quick_filter = request.query_params.get("quick_filter")
    if quick_filter == "new":
        return queryset.filter(is_archived=False, is_vip=False, has_no_reply=False, is_active=False)
    if quick_filter == "vip":
        return queryset.filter(is_vip=True)
    if quick_filter == "no_reply":
        return queryset.filter(has_no_reply=True)
    if quick_filter == "mine":
        return queryset.filter(manager_user_id=request.user.id)
    return queryset


def build_client_summary(queryset):
    return queryset.aggregate(
        total=Count("id"),
        active=Count("id", filter=Q(is_active=True) | Q(is_vip=True)),
        no_reply=Count("id", filter=Q(has_no_reply=True)),
        repeat=Count("id", filter=Q(has_multiple_deals=True) | Q(has_multiple_appointments=True)),
    )


def build_client_facets(queryset):
    return {
        "source": {item["source"] or "manual": item["count"] for item in queryset.values("source").annotate(count=Count("id", distinct=True))},
        "activity": {
            "active": queryset.filter(is_active=True).count(),
            "vip": queryset.filter(is_vip=True).count(),
            "no_reply": queryset.filter(has_no_reply=True).count(),
            "repeat": queryset.filter(Q(has_multiple_deals=True) | Q(has_multiple_appointments=True)).count(),
        },
    }
