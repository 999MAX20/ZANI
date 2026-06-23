from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.activities.models import ActivityEvent, Note, TaggedObject
from apps.activities.services import create_activity_event
from apps.activities.taxonomy import ActivityEvents
from apps.analytics.models import AnalyticsEvent
from apps.bots.models import BotConversation
from apps.clients.identity import normalize_client_identity, normalize_email, normalize_phone
from apps.clients.models import Client, ClientMergeLog
from apps.conversations.models import Conversation
from apps.crm.models import Deal
from apps.core.models import CustomFieldValue, FileAttachment
from apps.leads.models import Lead
from apps.notifications.models import Notification
from apps.scheduling.models import Appointment
from apps.tasks.models import Task


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
        query |= Q(normalized_email=normalized_email)
    if whatsapp_id:
        query |= Q(whatsapp_id=whatsapp_id)
    if telegram_id:
        query |= Q(telegram_id=telegram_id)
    if instagram_id:
        query |= Q(instagram_id=instagram_id)

    candidates = Client.objects.filter(business=business, is_archived=False).filter(query)
    if exclude_client_id:
        candidates = candidates.exclude(id=exclude_client_id)

    duplicates = list(candidates)

    if normalized_phone:
        phone_candidates = Client.objects.filter(business=business, is_archived=False, normalized_phone=normalized_phone).exclude(normalized_phone="")
        if exclude_client_id:
            phone_candidates = phone_candidates.exclude(id=exclude_client_id)
        duplicates.extend(phone_candidates)

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
        if normalized_phone and (client.normalized_phone or normalize_phone(client.phone)) == normalized_phone:
            matched_fields.append("phone")
        if normalized_email and (client.normalized_email or normalize_email(client.email)) == normalized_email:
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
    duplicate_snapshot = client_snapshot(duplicate_client)
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
    entity_transfer = transfer_client_entity_links(business=business, target_client=target_client, duplicate_client=duplicate_client)
    transferred.update(entity_transfer["transferred"])
    merge_log = ClientMergeLog.objects.create(
        business=business,
        target_client=target_client,
        actor=actor,
        duplicate_snapshot=duplicate_snapshot,
        transferred_counts=transferred,
        metadata={"policy": "archive_duplicate_after_transfer", "skipped": entity_transfer["skipped"]},
    )
    duplicate_client.is_archived = True
    duplicate_client.archived_at = timezone.now()
    duplicate_client.archived_by = actor
    duplicate_client.archive_reason = f"Merged into client #{target_client.id}"
    duplicate_client.save(update_fields=["is_archived", "archived_at", "archived_by", "archive_reason", "updated_at"])

    create_activity_event(
        business=business,
        client=target_client,
        actor=actor,
        event_type=ActivityEvents.CLIENT_MERGED,
        instance=target_client,
        category=ActivityEvent.Categories.CRM,
        text=f"Клиент объединён с дублем: {duplicate_snapshot['full_name']}",
        metadata={"duplicate": duplicate_snapshot, "transferred": transferred, "merge_log_id": merge_log.id},
    )

    return {
        "target_client_id": target_client.id,
        "archived_duplicate": duplicate_snapshot,
        "deleted_duplicate": duplicate_snapshot,
        "transferred": transferred,
        "merge_log_id": merge_log.id,
    }


def merge_clients_dry_run(*, target_client, duplicate_client):
    if target_client.business_id != duplicate_client.business_id:
        raise ValueError("Clients must belong to the same business.")
    if target_client.id == duplicate_client.id:
        raise ValueError("Cannot merge client into itself.")

    business = target_client.business
    return {
        "target_client_id": target_client.id,
        "duplicate": client_snapshot(duplicate_client),
        "transferred": {
            "leads": Lead.objects.filter(business=business, client=duplicate_client).count(),
            "appointments": Appointment.objects.filter(business=business, client=duplicate_client).count(),
            "conversations": Conversation.objects.filter(business=business, client=duplicate_client).count(),
            "bot_conversations": BotConversation.objects.filter(business=business, client=duplicate_client).count(),
            "tasks": Task.objects.filter(business=business, client=duplicate_client).count(),
            "deals": Deal.objects.filter(business=business, client=duplicate_client).count(),
            "notes": Note.objects.filter(business=business, client=duplicate_client).count(),
            "activity_events": ActivityEvent.objects.filter(business=business, client=duplicate_client).count(),
            "analytics_events": AnalyticsEvent.objects.filter(business=business, client=duplicate_client).count(),
            "notifications": Notification.objects.filter(business=business, client=duplicate_client).count(),
            "tags": TaggedObject.objects.filter(business=business, entity_type="client", entity_id=str(duplicate_client.id)).count(),
            "attachments": FileAttachment.objects.filter(business=business, entity_type="client", entity_id=str(duplicate_client.id)).count(),
            "custom_field_values": CustomFieldValue.objects.filter(business=business, entity_type="client", entity_id=str(duplicate_client.id)).count(),
        },
        "will_delete_duplicate": False,
        "policy": "archive_duplicate_after_transfer",
    }


def client_snapshot(client):
    return {
        "id": client.id,
        "full_name": client.full_name,
        "phone": client.phone,
        "email": client.email,
        "whatsapp_id": client.whatsapp_id,
        "telegram_id": client.telegram_id,
        "instagram_id": client.instagram_id,
        "source": client.source,
        "is_archived": client.is_archived,
    }


def transfer_client_entity_links(*, business, target_client, duplicate_client):
    duplicate_id = str(duplicate_client.id)
    target_id = str(target_client.id)
    transferred = {
        "tags": 0,
        "attachments": 0,
        "custom_field_values": 0,
    }
    skipped = {
        "tags": [],
        "custom_field_values": [],
    }

    duplicate_tags = TaggedObject.objects.filter(business=business, entity_type="client", entity_id=duplicate_id).select_related("tag")
    for tagged_object in list(duplicate_tags):
        target_exists = TaggedObject.objects.filter(
            business=business,
            tag=tagged_object.tag,
            entity_type="client",
            entity_id=target_id,
        ).exists()
        if target_exists:
            skipped["tags"].append({"tag_id": tagged_object.tag_id, "duplicate_tagged_object_id": tagged_object.id})
            tagged_object.delete()
            continue
        tagged_object.entity_id = target_id
        tagged_object.save(update_fields=["entity_id"])
        transferred["tags"] += 1

    transferred["attachments"] = FileAttachment.objects.filter(
        business=business,
        entity_type="client",
        entity_id=duplicate_id,
    ).update(entity_id=target_id)

    duplicate_values = CustomFieldValue.objects.filter(
        business=business,
        entity_type="client",
        entity_id=duplicate_id,
    ).select_related("definition")
    for value in list(duplicate_values):
        target_exists = CustomFieldValue.objects.filter(
            definition=value.definition,
            entity_type="client",
            entity_id=target_id,
        ).exists()
        if target_exists:
            skipped["custom_field_values"].append({"definition_id": value.definition_id, "duplicate_value_id": value.id})
            value.delete()
            continue
        value.entity_id = target_id
        value.save(update_fields=["entity_id"])
        transferred["custom_field_values"] += 1

    return {"transferred": transferred, "skipped": skipped}
