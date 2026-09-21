from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError

from apps.businesses.access import Actions, Resources, assert_can, scope_queryset
from apps.businesses.capabilities import assert_resource_enabled
from apps.businesses.models import Business
from apps.clients.models import Client
from apps.crm.models import Deal
from apps.scheduling.models import Appointment
from .models import Payment


def payment_business(actor, business_id, action=Actions.VIEW):
    if not str(business_id or "").isdigit():
        raise ValidationError({"business": "A business is required."})
    business = get_object_or_404(Business, pk=business_id)
    assert_can(actor, business, Resources.PAYMENTS, action)
    assert_can(actor, business, Resources.CLIENTS, Actions.VIEW)
    assert_resource_enabled(business, Resources.PAYMENTS)
    return business


def visible_entities(model, actor, business, resource):
    assert_resource_enabled(business, resource)
    assert_can(actor, business, resource, Actions.VIEW)
    return scope_queryset(model.objects.filter(business=business), actor, business, resource)


def payment_queryset(actor, business):
    clients = visible_entities(Client, actor, business, Resources.CLIENTS)
    return scope_queryset(
        Payment.objects.filter(business=business, client__in=clients),
        actor, business, Resources.PAYMENTS,
    ).select_related("client", "created_by", "business", "deal", "appointment")


def filter_payments(queryset, params):
    for field in ("client", "kind"):
        if params.get(field):
            queryset = queryset.filter(**{field: params[field]})
    if params.get("q"):
        query = params["q"].strip()
        queryset = queryset.filter(Q(client__full_name__icontains=query) | Q(client__phone__icontains=query))
    return queryset


def payment_options(actor, business, *, kind, client_id=None, query=""):
    model, resource = {
        "client": (Client, Resources.CLIENTS),
        "deal": (Deal, Resources.DEALS),
        "appointment": (Appointment, Resources.APPOINTMENTS),
    }[kind]
    queryset = visible_entities(model, actor, business, resource).filter(is_archived=False)
    if kind == "client":
        return queryset.filter(Q(full_name__icontains=query) | Q(phone__icontains=query)).order_by("full_name", "id")
    client = get_object_or_404(visible_entities(Client, actor, business, Resources.CLIENTS), pk=client_id)
    queryset = queryset.filter(client=client)
    if kind == "deal":
        return queryset.filter(title__icontains=query).order_by("-id")
    return queryset.select_related("service").filter(service__name__icontains=query).order_by("-start_at", "-id")
