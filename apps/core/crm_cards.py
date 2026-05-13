from django.db.models import Q

from apps.activities.models import ActivityEvent, Note
from apps.activities.serializers import ActivityEventSerializer, NoteSerializer
from apps.bots.models import BotConversation
from apps.clients.models import Client
from apps.clients.serializers import ClientSerializer
from apps.conversations.inbox_serializers import InboxConversationSerializer
from apps.crm.models import Deal
from apps.crm.serializers import DealSerializer
from apps.leads.models import Lead
from apps.leads.serializers import LeadSerializer
from apps.scheduling.models import Appointment
from apps.scheduling.serializers import AppointmentSerializer
from apps.tasks.models import Task
from apps.tasks.serializers import TaskSerializer


def _empty_q():
    return Q(pk__in=[])


def _or_queries(queries):
    query = _empty_q()
    for item in queries:
        query |= item
    return query


def _entity_query(entity_refs):
    return _or_queries([Q(entity_type=entity_type, entity_id=str(entity_id)) for entity_type, entity_id in entity_refs if entity_id])


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

    timeline_filters = []
    if client is not None:
        timeline_filters.append(Q(client=client))
    if entity_refs:
        timeline_filters.append(_entity_query(entity_refs))

    notes_filters = list(timeline_filters)

    leads = Lead.objects.filter(business=business).select_related("business", "client", "service", "responsible_user").filter(_or_queries(lead_filters)).distinct()
    deals = Deal.objects.filter(business=business).select_related("business", "client", "lead", "pipeline", "stage", "owner").filter(_or_queries(deal_filters)).distinct()
    appointments = Appointment.objects.filter(business=business).select_related("business", "client", "lead", "service", "resource").filter(_or_queries(appointment_filters)).distinct()
    tasks = Task.objects.filter(business=business).select_related("business", "client", "lead", "deal", "appointment", "assignee").filter(_or_queries(task_filters)).distinct()
    conversations = (
        BotConversation.objects.filter(business=business)
        .select_related("business", "bot", "client", "lead", "assigned_to")
        .filter(_or_queries(conversation_filters))
        .distinct()
    )
    timeline = ActivityEvent.objects.filter(business=business).filter(_or_queries(timeline_filters)).distinct()[:50]
    notes = Note.objects.filter(business=business).select_related("business", "client", "author").filter(_or_queries(notes_filters)).distinct()

    primary_lead = lead or leads.first()
    primary_deal = deal or deals.first()
    primary_appointment = appointment or appointments.first()

    return {
        "client": ClientSerializer(client).data if client is not None else None,
        "lead": LeadSerializer(primary_lead).data if primary_lead is not None else None,
        "deal": DealSerializer(primary_deal).data if primary_deal is not None else None,
        "appointment": AppointmentSerializer(primary_appointment).data if primary_appointment is not None else None,
        "leads": LeadSerializer(leads, many=True).data,
        "deals": DealSerializer(deals, many=True).data,
        "appointments": AppointmentSerializer(appointments, many=True).data,
        "tasks": TaskSerializer(tasks, many=True).data,
        "conversations": InboxConversationSerializer(conversations, many=True).data,
        "timeline": ActivityEventSerializer(timeline, many=True).data,
        "notes": NoteSerializer(notes, many=True).data,
    }


def client_crm_card(client: Client):
    return build_crm_card_payload(business=client.business, client=client)


def lead_crm_card(lead: Lead):
    return build_crm_card_payload(business=lead.business, lead=lead)


def deal_crm_card(deal: Deal):
    return build_crm_card_payload(business=deal.business, deal=deal)


def appointment_crm_card(appointment: Appointment):
    return build_crm_card_payload(business=appointment.business, appointment=appointment)
