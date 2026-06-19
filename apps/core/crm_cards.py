from django.db.models import Q

from apps.activities.models import ActivityEvent, Note, TaggedObject
from apps.activities.serializers import ActivityEventSerializer, NoteSerializer, TaggedObjectSerializer
from apps.bots.models import BotConversation
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
from apps.scheduling.models import Appointment
from apps.scheduling.serializers import AppointmentSerializer
from apps.tasks.models import Task
from apps.tasks.serializers import TaskSerializer

RELATED_LIMIT = 25
TIMELINE_LIMIT = 50
NOTES_LIMIT = 50


def _empty_q():
    return Q(pk__in=[])


def _or_queries(queries):
    query = _empty_q()
    for item in queries:
        query |= item
    return query


def _entity_query(entity_refs):
    queries = []
    for entity_type, entity_id in entity_refs:
        if not entity_id:
            continue
        queries.append(Q(entity_type=entity_type, entity_id=str(entity_id)))
        queries.append(Q(entity_type=entity_type.lower(), entity_id=str(entity_id)))
    return _or_queries(queries)


def _append_entity_refs(entity_refs, entity_type, ids):
    existing = {(item_type, str(item_id)) for item_type, item_id in entity_refs}
    for entity_id in ids:
        key = (entity_type, str(entity_id))
        if entity_id and key not in existing:
            entity_refs.append((entity_type, entity_id))
            existing.add(key)


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


def _tags_payload(business, entity_refs):
    if not entity_refs:
        return []
    tags = TaggedObject.objects.filter(business=business).select_related("tag").filter(_entity_query(entity_refs)).distinct()
    return TaggedObjectSerializer(tags, many=True).data


def _attachments_payload(business, entity_refs):
    if not entity_refs:
        return []
    attachments = FileAttachment.objects.filter(business=business).filter(_entity_query(entity_refs)).distinct()
    return FileAttachmentSerializer(attachments, many=True).data


def build_crm_card_payload(*, business, client=None, lead=None, deal=None, appointment=None):
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
    if lead is not None:
        task_filters.append(Q(lead=lead))
    if deal is not None:
        task_filters.append(Q(deal=deal))
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
    tasks = Task.objects.filter(business=business).select_related("business", "client", "lead", "deal", "appointment", "assignee").filter(_or_queries(task_filters)).distinct().order_by("-updated_at")
    conversations = (
        BotConversation.objects.filter(business=business)
        .select_related("business", "bot", "client", "lead", "assigned_to")
        .filter(_or_queries(conversation_filters))
        .distinct()
        .order_by("-updated_at")
    )

    _append_entity_refs(entity_refs, "Lead", leads.values_list("id", flat=True))
    _append_entity_refs(entity_refs, "Deal", deals.values_list("id", flat=True))
    _append_entity_refs(entity_refs, "Appointment", appointments.values_list("id", flat=True))
    _append_entity_refs(entity_refs, "Task", tasks.values_list("id", flat=True))

    timeline_filters = []
    if client is not None:
        timeline_filters.append(Q(client=client))
    if entity_refs:
        timeline_filters.append(_entity_query(entity_refs))

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

    return {
        "primary_entity": primary_entity,
        "available_actions": available_actions,
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
        "tags": _tags_payload(business, entity_refs),
        "attachments": _attachments_payload(business, entity_refs),
        "custom_fields": _custom_field_payload(
            business,
            client=client,
            lead=lead,
            deal=deal,
            appointment=appointment,
        ),
    }


def client_crm_card(client: Client):
    return build_crm_card_payload(business=client.business, client=client)


def lead_crm_card(lead: Lead):
    return build_crm_card_payload(business=lead.business, lead=lead)


def deal_crm_card(deal: Deal):
    return build_crm_card_payload(business=deal.business, deal=deal)


def appointment_crm_card(appointment: Appointment):
    return build_crm_card_payload(business=appointment.business, appointment=appointment)
