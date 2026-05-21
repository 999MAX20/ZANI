import re

from django.db import transaction
from django.db.models import Q

from apps.activities.models import ActivityEvent, Note
from apps.activities.services import create_activity_event
from apps.analytics.models import AnalyticsEvent
from apps.bots.models import BotConversation
from apps.clients.models import Client
from apps.conversations.models import Conversation
from apps.crm.models import Deal
from apps.leads.models import Lead
from apps.notifications.models import Notification
from apps.scheduling.models import Appointment
from apps.tasks.models import Task


def normalize_phone(phone):
    digits = re.sub(r"\D+", "", phone or "")
    if len(digits) == 11 and digits.startswith("8"):
        digits = f"7{digits[1:]}"
    return digits


def normalize_email(email):
    return (email or "").strip().lower()


def find_duplicate_clients(
    business,
    *,
    phone=None,
    email=None,
    whatsapp_id=None,
    telegram_id=None,
    instagram_id=None,
    exclude_client_id=None,
):
    normalized_phone = normalize_phone(phone)
    normalized_email = normalize_email(email)
    query = Q(pk__in=[])

    if normalized_email:
        query |= Q(email__iexact=normalized_email)
    if whatsapp_id:
        query |= Q(whatsapp_id=whatsapp_id)
    if telegram_id:
        query |= Q(telegram_id=telegram_id)
    if instagram_id:
        query |= Q(instagram_id=instagram_id)

    candidates = Client.objects.filter(business=business).filter(query)
    if exclude_client_id:
        candidates = candidates.exclude(id=exclude_client_id)

    duplicates = list(candidates)

    if normalized_phone:
        phone_candidates = Client.objects.filter(business=business).exclude(phone="")
        if exclude_client_id:
            phone_candidates = phone_candidates.exclude(id=exclude_client_id)
        duplicates.extend([client for client in phone_candidates if normalize_phone(client.phone) == normalized_phone])

    unique = {}
    for client in duplicates:
        unique[client.id] = client
    return list(unique.values())


def duplicate_payload(clients, *, phone=None, email=None, whatsapp_id=None, telegram_id=None, instagram_id=None):
    normalized_phone = normalize_phone(phone)
    normalized_email = normalize_email(email)
    rows = []
    for client in clients:
        matched_fields = []
        if normalized_phone and normalize_phone(client.phone) == normalized_phone:
            matched_fields.append("phone")
        if normalized_email and normalize_email(client.email) == normalized_email:
            matched_fields.append("email")
        if whatsapp_id and client.whatsapp_id == whatsapp_id:
            matched_fields.append("whatsapp_id")
        if telegram_id and client.telegram_id == telegram_id:
            matched_fields.append("telegram_id")
        if instagram_id and client.instagram_id == instagram_id:
            matched_fields.append("instagram_id")
        rows.append(
            {
                "id": client.id,
                "full_name": client.full_name,
                "phone": client.phone,
                "email": client.email,
                "matched_fields": matched_fields,
            }
        )
    return rows


@transaction.atomic
def merge_clients(*, target_client, duplicate_client, actor=None):
    if target_client.business_id != duplicate_client.business_id:
        raise ValueError("Clients must belong to the same business.")
    if target_client.id == duplicate_client.id:
        raise ValueError("Cannot merge client into itself.")

    business = target_client.business
    transferred = {
        "leads": Lead.objects.filter(business=business, client=duplicate_client).update(client=target_client),
        "appointments": Appointment.objects.filter(business=business, client=duplicate_client).update(client=target_client),
        "conversations": Conversation.objects.filter(business=business, client=duplicate_client).update(client=target_client),
        "bot_conversations": BotConversation.objects.filter(business=business, client=duplicate_client).update(client=target_client),
        "tasks": Task.objects.filter(business=business, client=duplicate_client).update(client=target_client),
        "deals": Deal.objects.filter(business=business, client=duplicate_client).update(client=target_client),
        "notes": Note.objects.filter(business=business, client=duplicate_client).update(client=target_client),
        "activity_events": ActivityEvent.objects.filter(business=business, client=duplicate_client).update(client=target_client),
        "analytics_events": AnalyticsEvent.objects.filter(business=business, client=duplicate_client).update(client=target_client),
        "notifications": Notification.objects.filter(business=business, client=duplicate_client).update(client=target_client),
    }

    duplicate_snapshot = {
        "id": duplicate_client.id,
        "full_name": duplicate_client.full_name,
        "phone": duplicate_client.phone,
        "email": duplicate_client.email,
    }
    duplicate_client.delete()

    create_activity_event(
        business=business,
        client=target_client,
        actor=actor,
        event_type="client_merged",
        instance=target_client,
        category=ActivityEvent.Categories.CRM,
        text=f"Клиент объединён с дублем: {duplicate_snapshot['full_name']}",
        metadata={"duplicate": duplicate_snapshot, "transferred": transferred},
    )

    return {"target_client_id": target_client.id, "deleted_duplicate": duplicate_snapshot, "transferred": transferred}
