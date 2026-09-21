from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from django.utils import timezone
from django.db import transaction

from apps.activities.services import create_activity_event
from apps.activities.taxonomy import ActivityEvents
from apps.bots.models import BotConversation, BotMessage
from apps.businesses.access import Resources
from apps.businesses.models import Business
from apps.businesses.capabilities import assert_resource_enabled
from apps.core.audit import write_actor_audit_log
from apps.core.models import AuditLog
from apps.leads.services import can_mark_lead_appointment_created, mark_lead_appointment_created
from apps.scheduling.models import Appointment, Resource
from apps.scheduling.services import schedule_appointment_followups, validate_appointment_availability
from apps.services.models import Service


BOOKING_META_KEY = "auto_booking"


@dataclass
class BookingResult:
    status: str
    reason: str = ""
    appointment: Appointment | None = None
    confirmation_message: BotMessage | None = None


def store_offered_slots(*, conversation: BotConversation, scheduling_context: dict[str, Any], ai_log_id: int | None = None) -> None:
    slots = scheduling_context.get("next_available_slots") or []
    if not slots:
        return
    metadata = dict(conversation.metadata_json or {})
    booking_meta = dict(metadata.get(BOOKING_META_KEY) or {})
    booking_meta.update(
        {
            "offered_slots": slots[:8],
            "ai_log_id": ai_log_id,
            "offered_at": timezone.now().isoformat(),
        }
    )
    metadata[BOOKING_META_KEY] = booking_meta
    conversation.metadata_json = metadata
    conversation.save(update_fields=["metadata_json", "updated_at"])


def maybe_create_appointment_from_reply(*, conversation: BotConversation, message: BotMessage) -> BookingResult:
    assert_resource_enabled(conversation.business, Resources.APPOINTMENTS)
    slot = _select_offered_slot(conversation=conversation, text=message.text)
    if not slot:
        return BookingResult(status="skipped", reason="No offered slot matched the client reply.")
    # A client reply selects a preference; only staff may commit a booking.
    _save_booking_meta(conversation, status="requires_staff", slot=slot,
                       reason="An authorized staff member must create the appointment.")
    return BookingResult(status="requires_staff", reason="Staff booking is required.")


@transaction.atomic
def create_appointment_from_conversation(*, conversation: BotConversation, service_id: int, start_at, actor=None, resource_id: int | None = None, notes: str = "") -> Appointment:
    assert_resource_enabled(conversation.business, Resources.APPOINTMENTS)
    Business.objects.select_for_update().get(pk=conversation.business_id)
    if not conversation.client_id:
        raise ValueError("Conversation must be linked to a client before booking an appointment.")

    service = Service.objects.filter(id=service_id, business=conversation.business, is_active=True).first()
    if service is None:
        raise ValueError("Service was not found in this business.")

    resource = None
    if resource_id:
        resource = Resource.objects.filter(id=resource_id, business=conversation.business, is_active=True).first()
        if resource is None:
            raise ValueError("Resource was not found in this business.")

    end_at = validate_appointment_availability(conversation.business, service, start_at, resource=resource)
    if conversation.lead_id:
        if conversation.lead.business_id != conversation.business_id:
            raise ValueError("Lead must belong to the conversation business.")
        if not can_mark_lead_appointment_created(conversation.lead):
            raise ValueError(f"Cannot move lead from '{conversation.lead.status}' to appointment_created.")
    appointment = Appointment.objects.create(
        business=conversation.business,
        client=conversation.client,
        lead=conversation.lead,
        service=service,
        resource=resource,
        start_at=start_at,
        end_at=end_at,
        status=Appointment.Statuses.CREATED,
        source=_appointment_source(conversation.channel),
        notes=notes or f"Created from inbox conversation #{conversation.id}",
    )
    write_actor_audit_log(
        actor=actor,
        action=AuditLog.Actions.CREATE,
        instance=appointment,
        metadata={
            "event_type": ActivityEvents.APPOINTMENT_CREATED,
            "source": "inbox",
            "conversation_id": conversation.id,
            "service_id": service.id,
            "resource_id": resource.id if resource else None,
        },
    )
    if conversation.lead_id:
        mark_lead_appointment_created(
            lead=conversation.lead,
            actor=actor if actor and getattr(actor, "is_authenticated", False) else None,
            service=service,
            appointment=appointment,
            resource=resource,
            source="inbox",
            activity_metadata={"conversation_id": conversation.id},
        )
    schedule_appointment_followups(
        appointment,
        responsible_user=conversation.lead.responsible_user if conversation.lead_id and conversation.lead.responsible_user_id else conversation.assigned_to,
    )
    create_activity_event(
        business=conversation.business,
        client=conversation.client,
        actor=actor if actor and getattr(actor, "is_authenticated", False) else None,
        instance=appointment,
        event_type=ActivityEvents.APPOINTMENT_CREATED,
        category="appointment",
        source="inbox",
        text=f"Appointment created from inbox conversation #{conversation.id}",
        metadata={
            "event_type": ActivityEvents.APPOINTMENT_CREATED,
            "conversation_id": conversation.id,
            "service_id": service.id,
            "resource_id": resource.id if resource else None,
        },
    )
    return appointment


def _select_offered_slot(*, conversation: BotConversation, text: str) -> dict[str, Any] | None:
    slots = ((conversation.metadata_json or {}).get(BOOKING_META_KEY) or {}).get("offered_slots") or []
    if not slots:
        return None
    normalized = (text or "").strip().lower()
    index_match = re.search(r"\b(?:вариант\s*)?([1-8])\b", normalized)
    if index_match:
        index = int(index_match.group(1)) - 1
        if 0 <= index < len(slots):
            return slots[index]
    if any(word in normalized for word in ["первый", "первое", "1-й"]):
        return slots[0]
    if len(slots) == 1 and normalized in {"да", "ок", "окей", "подходит", "подтверждаю"}:
        return slots[0]

    time_matches = set(re.findall(r"\b([01]?\d|2[0-3])[:.]([0-5]\d)\b", normalized))
    if not time_matches:
        return None
    matched = []
    for slot in slots:
        try:
            start_at = datetime.fromisoformat(str(slot["start_at"]))
        except (KeyError, ValueError, TypeError):
            continue
        local_start = timezone.localtime(start_at)
        if (str(local_start.hour), f"{local_start.minute:02d}") in time_matches or (f"{local_start.hour:02d}", f"{local_start.minute:02d}") in time_matches:
            matched.append(slot)
    return matched[0] if len(matched) == 1 else None


def _save_booking_meta(conversation: BotConversation, *, status: str, appointment: Appointment | None = None, slot=None, reason: str = "") -> None:
    metadata = dict(conversation.metadata_json or {})
    booking_meta = dict(metadata.get(BOOKING_META_KEY) or {})
    booking_meta.update(
        {
            "status": status,
            "appointment_id": appointment.id if appointment else booking_meta.get("appointment_id"),
            "selected_slot": slot or booking_meta.get("selected_slot"),
            "reason": reason,
            "updated_at": timezone.now().isoformat(),
        }
    )
    metadata[BOOKING_META_KEY] = booking_meta
    conversation.metadata_json = metadata
    conversation.save(update_fields=["metadata_json", "updated_at"])


def _appointment_source(channel: str) -> str:
    allowed = {choice[0] for choice in Appointment.Sources.choices}
    return channel if channel in allowed else Appointment.Sources.BOT
