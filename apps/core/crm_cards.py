from django.db.models import CharField, OuterRef, Q, Subquery
from django.db.models.functions import Cast

from apps.activities.models import ActivityEvent, Note, TaggedObject
from apps.activities.serializers import ActivityEventSerializer, NoteSerializer, TaggedObjectSerializer
from apps.bots.models import BotConversation, BotMessage
from apps.businesses.access import Actions, Resources, can
from apps.businesses.models import RolePermission
from apps.clients.models import Client
from apps.clients.serializers import ClientSerializer
from apps.conversations.inbox_serializers import InboxConversationSerializer
from apps.core.models import CustomFieldDefinition, CustomFieldValue
from apps.core.models import FileAttachment
from apps.core.serializers import CustomFieldDefinitionSerializer, CustomFieldValueSerializer, FileAttachmentSerializer
from apps.crm.models import Deal
from apps.crm.serializers import DealSerializer
from apps.leads.models import Lead
from apps.leads.serializers import LeadSerializer
from apps.outreach.models import OutreachConsent
from apps.scheduling.models import Appointment
from apps.scheduling.serializers import AppointmentSerializer
from apps.tasks.models import Task
from apps.tasks.serializers import TaskSerializer

RELATED_LIMIT = 25
TIMELINE_LIMIT = 50
NOTES_LIMIT = 50


ACTION_DEFINITIONS = {
    "client": {
        "create_lead": (Resources.LEADS, Actions.CREATE),
        "create_deal": (Resources.DEALS, Actions.CREATE),
        "create_appointment": (Resources.APPOINTMENTS, Actions.CREATE),
        "create_task": (Resources.TASKS, Actions.CREATE),
        "add_note": (Resources.CLIENTS, Actions.UPDATE),
        "merge": (Resources.CLIENTS, Actions.DELETE),
    },
    "lead": {
        "take": (Resources.LEADS, Actions.UPDATE),
        "contacted": (Resources.LEADS, Actions.UPDATE),
        "create_deal": (Resources.DEALS, Actions.CREATE),
        "create_appointment": (Resources.APPOINTMENTS, Actions.CREATE),
        "close": (Resources.LEADS, Actions.UPDATE),
        "lost": (Resources.LEADS, Actions.UPDATE),
        "reopen": (Resources.LEADS, Actions.UPDATE),
        "assign": (Resources.LEADS, Actions.UPDATE),
        "add_note": (Resources.LEADS, Actions.UPDATE),
        "create_task": (Resources.TASKS, Actions.CREATE),
    },
    "deal": {
        "create_task": (Resources.TASKS, Actions.CREATE),
        "create_appointment": (Resources.APPOINTMENTS, Actions.CREATE),
        "add_note": (Resources.DEALS, Actions.UPDATE),
        "won": (Resources.DEALS, Actions.UPDATE),
        "lost": (Resources.DEALS, Actions.UPDATE),
        "reopen": (Resources.DEALS, Actions.UPDATE),
    },
    "appointment": {
        "add_note": (Resources.APPOINTMENTS, Actions.UPDATE),
        "confirm": (Resources.APPOINTMENTS, Actions.UPDATE),
        "cancel": (Resources.APPOINTMENTS, Actions.UPDATE),
        "reschedule": (Resources.APPOINTMENTS, Actions.UPDATE),
        "complete": (Resources.APPOINTMENTS, Actions.UPDATE),
        "no_show": (Resources.APPOINTMENTS, Actions.UPDATE),
        "repeat": (Resources.APPOINTMENTS, Actions.CREATE),
    },
}

REASON_ACTIONS = {"lost", "cancel", "no_show"}
CONFIRM_ACTIONS = {"close", "won", "reopen", "complete"}
DESTRUCTIVE_ACTIONS = {"merge"}


def _empty_q():
    return Q(pk__in=[])


def _or_queries(queries):
    query = _empty_q()
    for item in queries:
        query |= item
    return query


def _entity_query(entity_refs):
    grouped_ids = {}
    for entity_type, entity_id in entity_refs:
        if not entity_id:
            continue
        grouped_ids.setdefault(entity_type, []).append(str(entity_id))
    queries = [
        Q(
            entity_type__in=[entity_type, entity_type.lower()],
            entity_id__in=entity_ids,
        )
        for entity_type, entity_ids in grouped_ids.items()
    ]
    return _or_queries(queries)


def _related_entity_query(entity_refs, related_querysets):
    queries = [_entity_query(entity_refs)]
    for entity_type, queryset in related_querysets:
        related_ids = (
            queryset.order_by()
            .annotate(entity_id_text=Cast("id", output_field=CharField()))
            .values("entity_id_text")
        )
        queries.append(
            Q(
                entity_type__in=[entity_type, entity_type.lower()],
                entity_id__in=Subquery(related_ids),
            )
        )
    return _or_queries(queries)


def _custom_field_entity(client=None, lead=None, deal=None, appointment=None):
    if appointment is not None:
        return "appointment", appointment.id
    if deal is not None:
        return "deal", deal.id
    if lead is not None:
        return "lead", lead.id
    if client is not None:
        return "client", client.id
    return "", ""


def _custom_field_payload(business, *, client=None, lead=None, deal=None, appointment=None):
    entity_type, entity_id = _custom_field_entity(client=client, lead=lead, deal=deal, appointment=appointment)
    if not entity_type or not entity_id:
        return []
    definitions = CustomFieldDefinition.objects.filter(business=business, entity_type=entity_type, is_active=True)
    values = {
        value.definition_id: value
        for value in CustomFieldValue.objects.filter(
            business=business,
            entity_type=entity_type,
            entity_id=str(entity_id),
            definition__in=definitions,
        )
    }
    return [
        {
            "definition": CustomFieldDefinitionSerializer(definition).data,
            "value": CustomFieldValueSerializer(values[definition.id]).data if definition.id in values else None,
        }
        for definition in definitions
    ]


def _primary_entity_payload(*, client=None, lead=None, deal=None, appointment=None):
    if appointment is not None:
        return {"type": "appointment", "id": appointment.id}
    if deal is not None:
        return {"type": "deal", "id": deal.id}
    if lead is not None:
        return {"type": "lead", "id": lead.id}
    if client is not None:
        return {"type": "client", "id": client.id}
    return None


def _primary_entity_context(*, client=None, lead=None, deal=None, appointment=None):
    if appointment is not None:
        return "appointment", appointment
    if deal is not None:
        return "deal", deal
    if lead is not None:
        return "lead", lead
    if client is not None:
        return "client", client
    return "", None


def _lead_actions(lead, deals):
    if lead is None:
        return []
    actions = []
    if lead.status != Lead.Statuses.IN_PROGRESS:
        actions.append("take")
    if lead.status != Lead.Statuses.CONTACTED:
        actions.append("contacted")
    if not deals.filter(is_archived=False).exists():
        actions.append("create_deal")
    if lead.status not in [Lead.Statuses.CLOSED, Lead.Statuses.LOST]:
        actions.extend(["create_appointment", "close", "lost"])
    if lead.status in [Lead.Statuses.CLOSED, Lead.Statuses.LOST]:
        actions.append("reopen")
    actions.extend(["assign", "add_note", "create_task"])
    return actions


def _deal_actions(deal):
    if deal is None:
        return []
    actions = ["create_task", "create_appointment", "add_note"]
    if deal.status != Deal.Statuses.WON:
        actions.append("won")
    if deal.status != Deal.Statuses.LOST:
        actions.append("lost")
    if deal.status != Deal.Statuses.OPEN:
        actions.append("reopen")
    return actions


def _appointment_actions(appointment):
    if appointment is None:
        return []
    actions = ["add_note"]
    if appointment.status in [Appointment.Statuses.CREATED, Appointment.Statuses.RESCHEDULED]:
        actions.extend(["confirm", "cancel", "reschedule"])
    if appointment.status == Appointment.Statuses.CONFIRMED:
        actions.extend(["complete", "cancel", "no_show", "reschedule"])
    if appointment.status in [Appointment.Statuses.CANCELLED, Appointment.Statuses.COMPLETED, Appointment.Statuses.NO_SHOW]:
        actions.append("repeat")
    return actions


def _client_actions(client):
    if client is None:
        return []
    return ["create_lead", "create_deal", "create_appointment", "create_task", "add_note", "merge"]


def _available_actions(*, client=None, lead=None, deal=None, appointment=None, deals=None):
    if appointment is not None:
        return _appointment_actions(appointment)
    if deal is not None:
        return _deal_actions(deal)
    if lead is not None:
        return _lead_actions(lead, deals or Deal.objects.none())
    if client is not None:
        return _client_actions(client)
    return []


def _action_confirmation(action_id):
    if action_id in REASON_ACTIONS:
        return "reason"
    if action_id in CONFIRM_ACTIONS or action_id in DESTRUCTIVE_ACTIONS:
        return "confirm"
    return "none"


def _available_action_details(action_ids, *, business, actor=None, entity_type="", entity=None):
    definitions = ACTION_DEFINITIONS.get(entity_type, {})
    details = []
    permission_cache = {}
    for action_id in action_ids:
        resource, permission_action = definitions.get(action_id, ("", ""))
        if resource and permission_action and actor is not None:
            permission_key = (resource, permission_action)
            permission = permission_cache.get(permission_key)
            if permission is None:
                permission = can(actor, business, resource, permission_action, obj=entity)
                permission_cache[permission_key] = permission
            allowed = permission.allowed
            scope = permission.scope
            reason = permission.reason
        else:
            allowed = True
            scope = RolePermission.Scopes.BUSINESS
            reason = ""
        details.append(
            {
                "id": action_id,
                "label_key": f"crm.actions.{action_id}",
                "resource": resource,
                "action": permission_action,
                "allowed": allowed,
                "scope": scope,
                "reason": reason,
                "requires_reason": action_id in REASON_ACTIONS,
                "destructive": action_id in DESTRUCTIVE_ACTIONS,
                "confirmation": _action_confirmation(action_id),
            }
        )
    return details


def _tags_payload(business, entity_query):
    if entity_query is None:
        return []
    tags = TaggedObject.objects.filter(business=business).select_related("tag").filter(entity_query).distinct()
    return TaggedObjectSerializer(tags, many=True).data


def _attachments_payload(business, entity_query):
    if entity_query is None:
        return []
    attachments = FileAttachment.objects.filter(business=business).filter(entity_query).distinct()
    return FileAttachmentSerializer(attachments, many=True).data


def _consent_summary_payload(business, client):
    if client is None:
        return []
    consents = {
        consent.channel: consent
        for consent in OutreachConsent.objects.filter(business=business, client=client)
    }
    rows = []
    for channel in OutreachConsent.Channels.values:
        consent = consents.get(channel)
        rows.append(
            {
                "channel": channel,
                "status": consent.status if consent else OutreachConsent.Statuses.UNKNOWN,
                "source": consent.source if consent else "",
                "note": consent.note if consent else "",
                "opted_in_at": consent.opted_in_at if consent else None,
                "opted_out_at": consent.opted_out_at if consent else None,
            }
        )
    return rows


def build_crm_card_payload(*, business, actor=None, client=None, lead=None, deal=None, appointment=None):
    if client is None and lead is not None:
        client = lead.client
    if client is None and deal is not None:
        client = deal.client
    if client is None and appointment is not None:
        client = appointment.client
    if lead is None and deal is not None:
        lead = deal.lead
    if lead is None and appointment is not None:
        lead = appointment.lead

    entity_refs = []
    if client is not None:
        entity_refs.append(("Client", client.id))
    if lead is not None:
        entity_refs.append(("Lead", lead.id))
    if deal is not None:
        entity_refs.append(("Deal", deal.id))
    if appointment is not None:
        entity_refs.append(("Appointment", appointment.id))

    lead_filters = []
    if client is not None:
        lead_filters.append(Q(client=client))
    if lead is not None:
        lead_filters.append(Q(id=lead.id))

    deal_filters = []
    if client is not None:
        deal_filters.append(Q(client=client))
    if lead is not None:
        deal_filters.append(Q(lead=lead))
    if deal is not None:
        deal_filters.append(Q(id=deal.id))

    appointment_filters = []
    if client is not None:
        appointment_filters.append(Q(client=client))
    if lead is not None:
        appointment_filters.append(Q(lead=lead))
    if appointment is not None:
        appointment_filters.append(Q(id=appointment.id))

    task_filters = []
    if client is not None:
        task_filters.append(Q(client=client))
        task_filters.append(Q(conversation__client=client))
    if lead is not None:
        task_filters.append(Q(lead=lead))
        task_filters.append(Q(conversation__lead=lead))
    if deal is not None:
        task_filters.append(Q(deal=deal))
        task_filters.append(Q(conversation__deal=deal))
    if appointment is not None:
        task_filters.append(Q(appointment=appointment))

    conversation_filters = []
    if client is not None:
        conversation_filters.append(Q(client=client))
    if lead is not None:
        conversation_filters.append(Q(lead=lead))

    leads = Lead.objects.filter(business=business).select_related("business", "client", "service", "responsible_user").filter(_or_queries(lead_filters)).distinct().order_by("-updated_at")
    deals = Deal.objects.filter(business=business).select_related("business", "client", "lead", "pipeline", "stage", "owner").filter(_or_queries(deal_filters)).distinct().order_by("-updated_at")
    appointments = Appointment.objects.filter(business=business).select_related("business", "client", "lead", "service", "resource").filter(_or_queries(appointment_filters)).distinct().order_by("-start_at")
    tasks = (
        Task.objects.filter(business=business)
        .select_related(
            "business",
            "client",
            "lead",
            "lead__client",
            "deal",
            "appointment",
            "appointment__service",
            "conversation",
            "conversation__client",
            "assignee",
            "created_by",
        )
        .prefetch_related("watchers")
        .filter(_or_queries(task_filters))
        .distinct()
        .order_by("-updated_at")
    )
    latest_message = BotMessage.objects.filter(conversation_id=OuterRef("pk")).order_by(
        "-created_at",
        "-id",
    )
    conversations = (
        BotConversation.objects.filter(business=business)
        .select_related("business", "bot", "client", "lead", "assigned_to")
        .annotate(
            latest_message_id=Subquery(latest_message.values("id")[:1]),
            latest_message_direction=Subquery(latest_message.values("direction")[:1]),
            latest_message_sender_type=Subquery(latest_message.values("sender_type")[:1]),
            latest_message_text=Subquery(latest_message.values("text")[:1]),
            latest_message_status=Subquery(latest_message.values("status")[:1]),
            latest_message_created_at=Subquery(latest_message.values("created_at")[:1]),
        )
        .filter(_or_queries(conversation_filters))
        .distinct()
        .order_by("-updated_at")
    )

    related_entity_query = _related_entity_query(
        entity_refs,
        [
            ("Lead", leads),
            ("Deal", deals),
            ("Appointment", appointments),
            ("Task", tasks),
        ],
    )

    timeline_filters = []
    if client is not None:
        timeline_filters.append(Q(client=client))
    timeline_filters.append(related_entity_query)

    notes_filters = list(timeline_filters)

    timeline = ActivityEvent.objects.filter(business=business).filter(_or_queries(timeline_filters)).distinct().order_by("-created_at")
    notes = Note.objects.filter(business=business).select_related("business", "client", "author").filter(_or_queries(notes_filters)).distinct().order_by("-created_at")

    primary_lead = lead or leads.first()
    primary_deal = deal or deals.first()
    primary_appointment = appointment or appointments.first()
    related_counts = {
        "leads": leads.count(),
        "deals": deals.count(),
        "appointments": appointments.count(),
        "tasks": tasks.count(),
        "conversations": conversations.count(),
        "timeline": timeline.count(),
        "notes": notes.count(),
    }
    primary_entity = _primary_entity_payload(client=client, lead=lead, deal=deal, appointment=appointment)
    available_actions = _available_actions(client=client, lead=lead, deal=deal, appointment=appointment, deals=deals)
    action_entity_type, action_entity = _primary_entity_context(client=client, lead=lead, deal=deal, appointment=appointment)

    return {
        "primary_entity": primary_entity,
        "available_actions": available_actions,
        "available_action_details": _available_action_details(
            available_actions,
            business=business,
            actor=actor,
            entity_type=action_entity_type,
            entity=action_entity,
        ),
        "meta": {
            "related_counts": related_counts,
            "limits": {
                "related": RELATED_LIMIT,
                "timeline": TIMELINE_LIMIT,
                "notes": NOTES_LIMIT,
            },
            "has_more": {
                "leads": related_counts["leads"] > RELATED_LIMIT,
                "deals": related_counts["deals"] > RELATED_LIMIT,
                "appointments": related_counts["appointments"] > RELATED_LIMIT,
                "tasks": related_counts["tasks"] > RELATED_LIMIT,
                "conversations": related_counts["conversations"] > RELATED_LIMIT,
                "timeline": related_counts["timeline"] > TIMELINE_LIMIT,
                "notes": related_counts["notes"] > NOTES_LIMIT,
            },
        },
        "client": ClientSerializer(client).data if client is not None else None,
        "lead": LeadSerializer(primary_lead).data if primary_lead is not None else None,
        "deal": DealSerializer(primary_deal).data if primary_deal is not None else None,
        "appointment": AppointmentSerializer(primary_appointment).data if primary_appointment is not None else None,
        "leads": LeadSerializer(leads[:RELATED_LIMIT], many=True).data,
        "deals": DealSerializer(deals[:RELATED_LIMIT], many=True).data,
        "appointments": AppointmentSerializer(appointments[:RELATED_LIMIT], many=True).data,
        "tasks": TaskSerializer(tasks[:RELATED_LIMIT], many=True).data,
        "conversations": InboxConversationSerializer(conversations[:RELATED_LIMIT], many=True).data,
        "timeline": ActivityEventSerializer(timeline[:TIMELINE_LIMIT], many=True).data,
        "notes": NoteSerializer(notes[:NOTES_LIMIT], many=True).data,
        "tags": _tags_payload(business, related_entity_query),
        "attachments": _attachments_payload(business, related_entity_query),
        "consents": _consent_summary_payload(business, client),
        "custom_fields": _custom_field_payload(
            business,
            client=client,
            lead=lead,
            deal=deal,
            appointment=appointment,
        ),
    }


def client_crm_card(client: Client, *, actor=None):
    return build_crm_card_payload(business=client.business, actor=actor, client=client)


def lead_crm_card(lead: Lead, *, actor=None):
    return build_crm_card_payload(business=lead.business, actor=actor, lead=lead)


def deal_crm_card(deal: Deal, *, actor=None):
    return build_crm_card_payload(business=deal.business, actor=actor, deal=deal)


def appointment_crm_card(appointment: Appointment, *, actor=None):
    return build_crm_card_payload(business=appointment.business, actor=actor, appointment=appointment)
