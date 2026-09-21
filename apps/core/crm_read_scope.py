"""Read projections delegate authorization to the existing access layer."""
from django.db.models import CharField, Q, Subquery
from django.db.models.functions import Cast

from apps.businesses.access import Actions, Resources, can, scope_queryset
from apps.businesses.capabilities import resource_is_enabled


def readable_queryset(queryset, *, actor, business, resource):
    queryset = queryset.filter(business=business)
    if actor is None or not resource_is_enabled(business, resource):
        return queryset.none()
    return scope_queryset(queryset, actor, business, resource, Actions.VIEW)


def readable_link(entity, *, actor, business, resource):
    if entity is None or actor is None or entity.business_id != business.id:
        return None
    if not resource_is_enabled(business, resource):
        return None
    return entity if can(actor, business, resource, Actions.VIEW, obj=entity).allowed else None


def readable_across_businesses(queryset, *, actor, resource, businesses=None):
    from apps.core.permissions import accessible_businesses

    if businesses is None:
        businesses = accessible_businesses(actor)
    result = queryset.none()
    for business in businesses:
        result |= readable_queryset(queryset, actor=actor, business=business, resource=resource)
    return result


def scope_entity_history(queryset, *, actor, business=None):
    """Intersect the endpoint's existing access with referenced CRM access."""
    from apps.core.permissions import accessible_businesses

    businesses = [business] if business is not None else accessible_businesses(actor)
    result = queryset.none()
    for current in businesses:
        result |= scope_entity_records(
            queryset.filter(business=current), actor=actor, business=current,
        )
    return result


def scope_entity_records(queryset, *, actor, business, visible=None):
    """A client back-reference must not authorize a forbidden entity's history.

    Keep existing non-CRM/system event policy; enforce the recognized CRM
    entity's current scope, including archived records (history is retained).
    SQL subqueries filter BEFORE limits/counts; no per-event object lookup.
    """
    from apps.bots.models import BotConversation, BotMessage
    from apps.clients.models import Client
    from apps.conversations.models import Conversation, Message
    from apps.crm.models import Deal
    from apps.leads.models import Lead
    from apps.payments.models import Payment
    from apps.scheduling.models import Appointment
    from apps.tasks.models import Task

    visible = dict(visible or {})
    models = (
        (Client, Resources.CLIENTS, ()),
        (Lead, Resources.LEADS, ()),
        (Deal, Resources.DEALS, ()),
        (Appointment, Resources.APPOINTMENTS, ()),
        (Task, Resources.TASKS, ()),
        (BotConversation, Resources.CONVERSATIONS, ('bot_conversation',)),
        (Conversation, Resources.CONVERSATIONS, ()),
        (Payment, Resources.PAYMENTS, ()),
    )
    for model, resource, aliases in models:
        if model not in visible:
            visible[model] = readable_queryset(model.objects.all(), actor=actor, business=business, resource=resource)
        queryset = _filter_entity_type(queryset, visible[model], (model.__name__, *aliases))
    for model, parent, aliases in (
        (BotMessage, BotConversation, ('bot_message',)),
        (Message, Conversation, ()),
    ):
        messages = model.objects.filter(conversation__in=visible[parent])
        queryset = _filter_entity_type(queryset, messages, (model.__name__, *aliases))
    return queryset


def _filter_entity_type(queryset, entities, names):
    recognized = Q(pk__in=[])
    for name in names:
        recognized |= Q(entity_type__iexact=name)
    ids = entities.order_by().annotate(_entity_id_text=Cast('pk', CharField())).values('_entity_id_text')
    return queryset.exclude(recognized & ~Q(entity_id__in=Subquery(ids)))
