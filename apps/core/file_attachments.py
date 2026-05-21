from rest_framework.exceptions import ValidationError

from apps.bots.models import BotConversation, BotMessage
from apps.businesses.access import Actions, Resources, assert_can
from apps.clients.models import Client
from apps.crm.models import Deal
from apps.leads.models import Lead
from apps.scheduling.models import Appointment
from apps.tasks.models import Task


ENTITY_CONFIG = {
    "client": (Client, Resources.CLIENTS),
    "lead": (Lead, Resources.LEADS),
    "deal": (Deal, Resources.DEALS),
    "appointment": (Appointment, Resources.APPOINTMENTS),
    "task": (Task, Resources.TASKS),
    "bot_conversation": (BotConversation, Resources.CONVERSATIONS),
    "bot_message": (BotMessage, Resources.CONVERSATIONS),
}


def resolve_attachment_entity(business, entity_type, entity_id):
    config = ENTITY_CONFIG.get(entity_type)
    if not config:
        raise ValidationError({"entity_type": "Unsupported attachment entity type."})
    model, resource = config
    queryset = model.objects.all()
    if entity_type == "bot_message":
        entity = queryset.filter(id=entity_id, conversation__business=business).select_related("conversation").first()
    elif entity_type == "bot_conversation":
        entity = queryset.filter(id=entity_id, business=business).first()
    else:
        entity = queryset.filter(id=entity_id, business=business).first()
    if entity is None:
        raise ValidationError({"entity_id": "Attachment entity was not found in this business."})
    return entity, resource


def assert_attachment_access(user, attachment, action=Actions.VIEW):
    _, resource = resolve_attachment_entity(attachment.business, attachment.entity_type, attachment.entity_id)
    required_action = Actions.UPDATE if action in {Actions.CREATE, Actions.UPDATE} else Actions.VIEW
    return assert_can(user, attachment.business, resource, required_action)
