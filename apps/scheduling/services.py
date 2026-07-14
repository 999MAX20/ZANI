from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db import transaction
from django.utils import timezone

from apps.analytics.models import AnalyticsEvent
from apps.activities.services import create_activity_event
from apps.activities.taxonomy import ActivityEvents
from apps.automations.engine import run_automations_for_event
from apps.automations.models import AutomationRule
from apps.businesses.models import Business
from apps.core.audit import infer_audit_category, infer_audit_risk, sanitize_audit_metadata, write_audit_log
from apps.core.models import AuditLog
from apps.notifications.models import Notification
from apps.scheduling.models import Appointment, AppointmentMessageSetting, WorkingHours
from apps.tasks.models import Task
from apps.tasks.services import create_task_notification


SLOT_STEP_MINUTES = 30
APPOINTMENT_CONFIRMATION_LABEL = "Подтвердить запись"
APPOINTMENT_REMINDER_LABEL = "Напомнить о записи"
APPOINTMENT_THANK_YOU_LABEL = "Поблагодарить после визита"

APPOINTMENT_MESSAGE_DEFAULTS = {
    AppointmentMessageSetting.Scenarios.CONFIRMATION: {
        "label": APPOINTMENT_CONFIRMATION_LABEL,
        "offset_minutes": -24 * 60,
        "template_text": (
            "Здравствуйте, {client_name}! Подтвердите, пожалуйста, запись на {service_name}{resource_text} "
            "{date} в {time}.{address_text} Ответьте «Да», если всё в силе, или «Отменить», если нужно перенести."
        ),
    },
    AppointmentMessageSetting.Scenarios.REMINDER: {
        "label": APPOINTMENT_REMINDER_LABEL,
        "offset_minutes": -2 * 60,
        "template_text": "Напоминаем о записи на {service_name}{resource_text} сегодня в {time}.{address_text} Ждём вас!",
    },
    AppointmentMessageSetting.Scenarios.THANK_YOU: {
        "label": APPOINTMENT_THANK_YOU_LABEL,
        "offset_minutes": 30,
        "template_text": (
            "Спасибо, что выбрали нас! Надеемся, услуга «{service_name}» прошла отлично. "
            "Если остались вопросы или хотите записаться снова, просто ответьте на это сообщение."
        ),
    },
}
TERMINAL_APPOINTMENT_STATUSES = {
    Appointment.Statuses.CANCELLED,
    Appointment.Statuses.COMPLETED,
    Appointment.Statuses.NO_SHOW,
}
APPOINTMENT_LIFECYCLE_ACTIONS = {
    ActivityEvents.APPOINTMENT_CONFIRMED: "appointment_confirmed",
    ActivityEvents.APPOINTMENT_CANCELLED: "appointment_cancelled",
    ActivityEvents.APPOINTMENT_COMPLETED: "appointment_completed",
    ActivityEvents.APPOINTMENT_NO_SHOW: "appointment_no_show",
    ActivityEvents.APPOINTMENT_RESCHEDULED: "appointment_rescheduled",
}

WORKING_HOURS_PRESETS = {
    "weekdays_9_18": {
        "label": "Пн-Пт 09:00-18:00, Сб-Вс выходной",
        "start": time(9, 0),
        "end": time(18, 0),
        "working_days": {0, 1, 2, 3, 4},
    },
    "daily_9_20": {
        "label": "Ежедневно 09:00-20:00",
        "start": time(9, 0),
        "end": time(20, 0),
        "working_days": {0, 1, 2, 3, 4, 5, 6},
    },
    "mon_sat_9_18": {
        "label": "Пн-Сб 09:00-18:00, Вс выходной",
        "start": time(9, 0),
        "end": time(18, 0),
        "working_days": {0, 1, 2, 3, 4, 5},
    },
}


def _business_zone(business):
    try:
        return ZoneInfo(business.timezone)
    except Exception:
        return ZoneInfo("UTC")


def _working_hours_for(business, weekday, resource=None):
    if resource:
        resource_hours = WorkingHours.objects.filter(
            business=business,
            resource=resource,
            weekday=weekday,
        ).first()
        if resource_hours:
            return resource_hours

    return WorkingHours.objects.filter(
        business=business,
        resource__isnull=True,
        weekday=weekday,
    ).first()


def _overlaps(start, end, busy_start, busy_end):
    return start < busy_end and end > busy_start


def apply_working_hours_preset(business, preset_key, resource=None):
    if preset_key not in WORKING_HOURS_PRESETS:
        raise ValueError("Unknown working hours preset.")
    if resource and resource.business_id != business.id:
        raise ValueError("Resource must belong to the selected business.")

    preset = WORKING_HOURS_PRESETS[preset_key]
    updated = []
    with transaction.atomic():
        for weekday in range(7):
            hours, _ = WorkingHours.objects.update_or_create(
                business=business,
                resource=resource,
                weekday=weekday,
                defaults={
                    "start_time": preset["start"],
                    "end_time": preset["end"],
                    "is_day_off": weekday not in preset["working_days"],
                },
            )
            updated.append(hours)
    return updated


def get_available_slots(business, service, date, resource=None, after_time=None, exclude_appointment=None):
    if service.business_id != business.id:
        raise ValueError("Service must belong to the selected business.")
    if resource and resource.business_id != business.id:
        raise ValueError("Resource must belong to the selected business.")

    weekday = date.weekday()
    working_hours = _working_hours_for(business, weekday, resource=resource)
    if not working_hours or working_hours.is_day_off:
        return []

    tz = _business_zone(business)
    day_start = timezone.make_aware(datetime.combine(date, working_hours.start_time), tz)
    day_end = timezone.make_aware(datetime.combine(date, working_hours.end_time), tz)

    if after_time:
        if isinstance(after_time, datetime):
            threshold = after_time if timezone.is_aware(after_time) else timezone.make_aware(after_time, tz)
        elif isinstance(after_time, time):
            threshold = timezone.make_aware(datetime.combine(date, after_time), tz)
        else:
            raise ValueError("after_time must be a time or datetime instance.")
        day_start = max(day_start, threshold)

    duration = timedelta(minutes=service.duration_minutes)
    step = timedelta(minutes=SLOT_STEP_MINUTES)
    busy_query = Appointment.objects.filter(
        business=business,
        start_at__lt=day_end,
        end_at__gt=day_start,
    ).exclude(status__in=[Appointment.Statuses.CANCELLED, Appointment.Statuses.RESCHEDULED])
    if resource:
        busy_query = busy_query.filter(resource=resource)
    if exclude_appointment:
        busy_query = busy_query.exclude(pk=exclude_appointment.pk)

    busy_intervals = list(busy_query.values_list("start_at", "end_at"))
    slots = []
    current = day_start
    while current + duration <= day_end:
        slot_end = current + duration
        if not any(_overlaps(current, slot_end, busy_start, busy_end) for busy_start, busy_end in busy_intervals):
            slots.append(current)
        current += step

    return slots


def validate_appointment_availability(business, service, start_at, resource=None, exclude_appointment=None):
    if service.business_id != business.id:
        raise ValueError("Service must belong to the selected business.")
    if resource and resource.business_id != business.id:
        raise ValueError("Resource must belong to the selected business.")

    tz = _business_zone(business)
    if timezone.is_naive(start_at):
        start_at = timezone.make_aware(start_at, tz)

    local_start = start_at.astimezone(tz)
    duration = timedelta(minutes=service.duration_minutes)
    end_at = start_at + duration

    working_hours = _working_hours_for(business, local_start.date().weekday(), resource=resource)
    if not working_hours or working_hours.is_day_off:
        raise ValueError("Requested appointment time is outside working hours.")

    day_start = timezone.make_aware(datetime.combine(local_start.date(), working_hours.start_time), tz)
    day_end = timezone.make_aware(datetime.combine(local_start.date(), working_hours.end_time), tz)
    local_end = end_at.astimezone(tz)
    if local_start < day_start or local_end > day_end:
        raise ValueError("Requested appointment time is outside working hours.")

    busy_query = Appointment.objects.filter(
        business=business,
        start_at__lt=end_at,
        end_at__gt=start_at,
    ).exclude(status__in=[Appointment.Statuses.CANCELLED, Appointment.Statuses.RESCHEDULED])
    if resource:
        busy_query = busy_query.filter(resource=resource)
    if exclude_appointment:
        busy_query = busy_query.exclude(pk=exclude_appointment.pk)
    if busy_query.exists():
        raise ValueError("Requested appointment time is not available.")

    return end_at


@transaction.atomic
def create_appointment_from_lead(
    lead,
    service,
    start_at,
    resource=None,
    actor=None,
    request=None,
    source=Appointment.Sources.MANUAL,
    lead_activity_source="scheduling",
):
    if service.business_id != lead.business_id:
        raise ValueError("Service must belong to lead business.")
    if resource and resource.business_id != lead.business_id:
        raise ValueError("Resource must belong to lead business.")

    if timezone.is_naive(start_at):
        start_at = timezone.make_aware(start_at, _business_zone(lead.business))

    end_at = validate_appointment_availability(lead.business, service, start_at, resource=resource)

    appointment = Appointment.objects.create(
        business=lead.business,
        client=lead.client,
        lead=lead,
        service=service,
        resource=resource,
        start_at=start_at,
        end_at=end_at,
        status=Appointment.Statuses.CREATED,
        source=source,
    )

    from apps.leads.services import mark_lead_appointment_created

    mark_lead_appointment_created(
        lead=lead,
        actor=actor,
        request=request,
        service=service,
        appointment=appointment,
        resource=resource,
        source=lead_activity_source,
    )

    AnalyticsEvent.objects.create(
        business=lead.business,
        client=lead.client,
        event_type=AnalyticsEvent.EventTypes.APPOINTMENT_CREATED,
        source=appointment.source,
        metadata={"appointment_id": appointment.id, "lead_id": lead.id},
    )
    schedule_appointment_followups(appointment, responsible_user=lead.responsible_user)

    return appointment


def handle_appointment_created(appointment):
    schedule_appointment_followups(appointment)
    notify_appointment_responsible(appointment, "New appointment created")
    run_automations_for_event(
        business=appointment.business,
        trigger_type=AutomationRule.TriggerTypes.APPOINTMENT_CREATED,
        entity=appointment,
        payload={"trigger_type": AutomationRule.TriggerTypes.APPOINTMENT_CREATED, "appointment_id": appointment.id},
    )


def sync_appointment_after_update(
    *,
    appointment,
    actor,
    previous_status,
    previous_start_at,
    previous_service_id,
    previous_resource_id,
):
    if previous_status != Appointment.Statuses.CANCELLED and appointment.status == Appointment.Statuses.CANCELLED:
        cancel_appointment_followups(appointment)
        create_appointment_activity(
            appointment=appointment,
            actor=actor,
            event_type=ActivityEvents.APPOINTMENT_CANCELLED,
            text=f"Запись отменена: {appointment.start_at:%d.%m.%Y %H:%M}",
            previous_status=previous_status,
        )
        run_appointment_cancelled_automations(appointment)
    elif previous_status != Appointment.Statuses.COMPLETED and appointment.status == Appointment.Statuses.COMPLETED:
        cancel_appointment_followups(appointment)
        schedule_post_service_followup(appointment)
        create_appointment_activity(
            appointment=appointment,
            actor=actor,
            event_type=ActivityEvents.APPOINTMENT_COMPLETED,
            text=f"Визит завершён: {appointment.start_at:%d.%m.%Y %H:%M}",
            previous_status=previous_status,
        )
        run_appointment_completed_automations(appointment)
    elif appointment.status not in {Appointment.Statuses.CANCELLED, Appointment.Statuses.COMPLETED, Appointment.Statuses.NO_SHOW} and (
        previous_start_at != appointment.start_at
        or previous_service_id != appointment.service_id
        or previous_resource_id != appointment.resource_id
        or previous_status != appointment.status
    ):
        schedule_appointment_followups(appointment)


def confirm_appointment(*, appointment, actor, activity_metadata=None, activity_source="api"):
    return apply_appointment_status(
        appointment=appointment,
        actor=actor,
        status_value=Appointment.Statuses.CONFIRMED,
        event_type=ActivityEvents.APPOINTMENT_CONFIRMED,
        text="Запись подтверждена",
        activity_metadata=activity_metadata,
        activity_source=activity_source,
    )


def cancel_appointment(*, appointment, actor, reason, request=None, activity_metadata=None, activity_source="api"):
    reason = (reason or "").strip()
    if not reason:
        raise ValueError("Cancellation reason is required.")
    audit_metadata = {"reason": reason}
    if activity_metadata:
        audit_metadata.update(activity_metadata)
    return apply_appointment_status(
        appointment=appointment,
        actor=actor,
        status_value=Appointment.Statuses.CANCELLED,
        event_type=ActivityEvents.APPOINTMENT_CANCELLED,
        text="Запись отменена",
        request=request,
        audit_metadata=audit_metadata,
        reason=reason,
        activity_metadata=activity_metadata,
        activity_source=activity_source,
    )


def complete_appointment(*, appointment, actor, request=None):
    return apply_appointment_status(
        appointment=appointment,
        actor=actor,
        status_value=Appointment.Statuses.COMPLETED,
        event_type=ActivityEvents.APPOINTMENT_COMPLETED,
        text="Визит завершён",
        request=request,
        audit_metadata={},
    )


def mark_appointment_no_show(*, appointment, actor, reason, request=None):
    reason = (reason or "").strip()
    if not reason:
        raise ValueError("No-show reason is required.")
    return apply_appointment_status(
        appointment=appointment,
        actor=actor,
        status_value=Appointment.Statuses.NO_SHOW,
        event_type=ActivityEvents.APPOINTMENT_NO_SHOW,
        text="Клиент не пришёл",
        request=request,
        audit_metadata={"reason": reason},
        reason=reason,
    )


@transaction.atomic
def reschedule_appointment(*, appointment, actor, start_at, resource=None, reason="", request=None):
    Business.objects.select_for_update().get(pk=appointment.business_id)
    if appointment.is_archived:
        raise ValueError("Archived appointment cannot be rescheduled.")
    if appointment.status in {Appointment.Statuses.CANCELLED, Appointment.Statuses.COMPLETED, Appointment.Statuses.NO_SHOW}:
        raise ValueError("Terminal appointment cannot be rescheduled.")
    if resource and resource.business_id != appointment.business_id:
        raise ValueError("Resource must belong to the selected business.")

    previous_status = appointment.status
    previous_start_at = appointment.start_at
    previous_end_at = appointment.end_at
    previous_resource_id = appointment.resource_id

    end_at = validate_appointment_availability(
        appointment.business,
        appointment.service,
        start_at,
        resource=resource,
        exclude_appointment=appointment,
    )

    appointment.start_at = start_at
    appointment.end_at = end_at
    appointment.resource = resource
    appointment.status = previous_status
    appointment.save(update_fields=["start_at", "end_at", "resource", "status", "updated_at"])

    schedule_appointment_followups(appointment)
    create_activity_event(
        business=appointment.business,
        client=appointment.client,
        actor=actor,
        event_type=ActivityEvents.APPOINTMENT_RESCHEDULED,
        instance=appointment,
        category="appointment",
        text=f"Запись перенесена: {previous_start_at:%d.%m.%Y %H:%M} -> {appointment.start_at:%d.%m.%Y %H:%M}",
        metadata={
            "event_type": ActivityEvents.APPOINTMENT_RESCHEDULED,
            "lifecycle_action": APPOINTMENT_LIFECYCLE_ACTIONS[ActivityEvents.APPOINTMENT_RESCHEDULED],
            "from": previous_status,
            "to": appointment.status,
            "previous_start_at": previous_start_at.isoformat(),
            "previous_end_at": previous_end_at.isoformat(),
            "start_at": appointment.start_at.isoformat(),
            "end_at": appointment.end_at.isoformat(),
            "previous_resource_id": previous_resource_id,
            "resource_id": appointment.resource_id,
            "reason": reason,
        },
    )
    if request is not None:
        write_audit_log(
            request,
            AuditLog.Actions.UPDATE,
            appointment,
            metadata={
                "kind": "lifecycle",
                "event_type": ActivityEvents.APPOINTMENT_RESCHEDULED,
                "lifecycle_action": APPOINTMENT_LIFECYCLE_ACTIONS[ActivityEvents.APPOINTMENT_RESCHEDULED],
                "from": previous_status,
                "to": appointment.status,
                "previous_start_at": previous_start_at.isoformat(),
                "start_at": appointment.start_at.isoformat(),
                "previous_resource_id": previous_resource_id,
                "resource_id": appointment.resource_id,
                "reason": reason,
            },
        )
    return appointment


@transaction.atomic
def apply_appointment_status(
    *,
    appointment,
    actor,
    status_value,
    event_type,
    text,
    request=None,
    audit_metadata=None,
    reason="",
    activity_metadata=None,
    activity_source="api",
):
    appointment = (
        Appointment.objects.select_for_update()
        .select_related("business", "client", "lead", "service", "resource")
        .get(pk=appointment.pk)
    )
    previous_status = appointment.status
    if appointment.is_archived:
        raise ValueError("Archived appointment cannot change lifecycle status.")
    if previous_status == status_value:
        raise ValueError(f"Appointment already has status '{status_value}'.")
    if previous_status in TERMINAL_APPOINTMENT_STATUSES:
        raise ValueError("Terminal appointment cannot change lifecycle status.")

    appointment.status = status_value
    appointment.save(update_fields=["status", "updated_at"])

    if status_value in TERMINAL_APPOINTMENT_STATUSES:
        cancel_appointment_followups(appointment)
    if status_value == Appointment.Statuses.COMPLETED:
        schedule_post_service_followup(appointment)
    elif status_value not in {Appointment.Statuses.CANCELLED, Appointment.Statuses.NO_SHOW}:
        schedule_appointment_followups(appointment)

    transition_metadata = {"reason": reason} if reason else {}
    if activity_metadata:
        transition_metadata.update(activity_metadata)
    create_appointment_activity(
        appointment=appointment,
        actor=actor,
        event_type=event_type,
        text=f"{text}: {appointment.start_at:%d.%m.%Y %H:%M}",
        previous_status=previous_status,
        metadata=transition_metadata or None,
        source=activity_source,
    )
    if status_value == Appointment.Statuses.CANCELLED:
        run_appointment_cancelled_automations(appointment)
    if status_value == Appointment.Statuses.COMPLETED:
        run_appointment_completed_automations(appointment)
    if status_value in TERMINAL_APPOINTMENT_STATUSES:
        create_appointment_follow_up_task(appointment=appointment, actor=actor, request=request, reason=reason)
    notify_appointment_responsible(appointment, f"Appointment status changed to {status_value}", actor=actor)
    if audit_metadata is not None:
        lifecycle_metadata = {
            "kind": "lifecycle",
            "event_type": event_type,
            "lifecycle_action": APPOINTMENT_LIFECYCLE_ACTIONS.get(event_type, event_type),
            "from": previous_status,
            "to": appointment.status,
        }
        lifecycle_metadata.update(audit_metadata)
        if request is not None:
            write_audit_log(
                request,
                AuditLog.Actions.UPDATE,
                appointment,
                metadata=lifecycle_metadata,
            )
        else:
            _write_system_appointment_audit(appointment=appointment, actor=actor, metadata=lifecycle_metadata)
    return appointment


def create_appointment_activity(*, appointment, actor, event_type, text, previous_status, metadata=None, source="api"):
    payload = {
        "event_type": event_type,
        "lifecycle_action": APPOINTMENT_LIFECYCLE_ACTIONS.get(event_type, event_type),
        "from": previous_status,
        "to": appointment.status,
    }
    if metadata:
        payload.update(metadata)
    create_activity_event(
        business=appointment.business,
        client=appointment.client,
        actor=actor,
        event_type=event_type,
        instance=appointment,
        category="appointment",
        source=source,
        text=text,
        metadata=payload,
    )


def _write_system_appointment_audit(*, appointment, actor, metadata):
    metadata = sanitize_audit_metadata(metadata)
    AuditLog.objects.create(
        business=appointment.business,
        actor=actor if _is_active_business_member(appointment.business, actor) else None,
        action=AuditLog.Actions.UPDATE,
        category=infer_audit_category(AuditLog.Actions.UPDATE, appointment, metadata),
        risk_level=infer_audit_risk(AuditLog.Actions.UPDATE, appointment, metadata),
        entity_type=appointment.__class__.__name__,
        entity_id=str(appointment.pk),
        metadata=metadata,
    )


def create_appointment_follow_up_task(*, appointment, actor, request=None, reason=""):
    task_spec = _appointment_follow_up_task_spec(appointment, reason=reason)
    if task_spec is None:
        return None

    assignee = appointment_responsible_user(appointment, actor=actor)
    created_by = actor if _is_active_business_member(appointment.business, actor) else None
    task = Task.objects.create(
        business=appointment.business,
        title=task_spec["title"],
        description=task_spec["description"],
        client=appointment.client,
        lead=appointment.lead,
        appointment=appointment,
        assignee=assignee,
        created_by=created_by,
        due_at=task_spec["due_at"],
        priority=task_spec["priority"],
    )
    create_activity_event(
        business=appointment.business,
        client=appointment.client,
        actor=actor,
        event_type=ActivityEvents.TASK_CREATED,
        instance=task,
        category="task",
        text=f"Task created from appointment #{appointment.id}",
        metadata={
            "appointment_id": appointment.id,
            "appointment_status": appointment.status,
            "reason": reason,
        },
    )
    if request is not None:
        write_audit_log(
            request,
            AuditLog.Actions.CREATE,
            task,
            metadata={
                "kind": "appointment_follow_up",
                "appointment_id": appointment.id,
                "appointment_status": appointment.status,
                "reason": reason,
            },
        )
    if task.assignee_id:
        create_task_notification(task, f"New appointment follow-up task: {task.title}")
    return task


def _appointment_follow_up_task_spec(appointment, *, reason=""):
    reason_text = f"\nReason: {reason}" if reason else ""
    due_at = timezone.now() + timedelta(hours=2)
    if appointment.status == Appointment.Statuses.CANCELLED:
        return {
            "title": f"Follow up cancelled appointment #{appointment.id}",
            "description": f"Contact the client after cancellation and agree the next step.{reason_text}",
            "priority": Task.Priorities.HIGH,
            "due_at": due_at,
        }
    if appointment.status == Appointment.Statuses.NO_SHOW:
        return {
            "title": f"Follow up no-show appointment #{appointment.id}",
            "description": f"Contact the client after the missed appointment and decide whether to rebook.{reason_text}",
            "priority": Task.Priorities.HIGH,
            "due_at": due_at,
        }
    if appointment.status == Appointment.Statuses.COMPLETED:
        return {
            "title": f"Follow up completed appointment #{appointment.id}",
            "description": "Check satisfaction, add notes and offer the next booking when relevant.",
            "priority": Task.Priorities.NORMAL,
            "due_at": timezone.now() + timedelta(days=1),
        }
    return None


def notify_appointment_responsible(appointment, text, *, actor=None, priority=None):
    recipient = appointment_responsible_user(appointment, actor=actor)
    if recipient is None:
        return None
    return Notification.objects.create(
        business=appointment.business,
        recipient=recipient,
        client=appointment.client,
        appointment=appointment,
        channel=Notification.Channels.SYSTEM,
        category=Notification.Categories.SALES,
        priority=priority or Notification.Priorities.NORMAL,
        text=text,
        send_at=timezone.now(),
        status=Notification.Statuses.PENDING,
        action_url=f"/app/calendar?appointment={appointment.id}",
        action_label="Open appointment",
    )


def appointment_responsible_user(appointment, *, actor=None):
    candidates = [
        getattr(getattr(appointment, "lead", None), "responsible_user", None),
        actor,
        appointment.business.owner,
    ]
    for candidate in candidates:
        if _is_active_business_member(appointment.business, candidate):
            return candidate
    return None


def _is_active_business_member(business, user):
    if not user:
        return False
    if business.owner_id == user.id:
        return True
    return business.members.filter(user=user, is_active=True).exists()


def run_appointment_cancelled_automations(appointment):
    run_automations_for_event(
        business=appointment.business,
        trigger_type=AutomationRule.TriggerTypes.APPOINTMENT_CANCELLED,
        entity=appointment,
        payload={"trigger_type": AutomationRule.TriggerTypes.APPOINTMENT_CANCELLED, "appointment_id": appointment.id},
    )


def run_appointment_completed_automations(appointment):
    run_automations_for_event(
        business=appointment.business,
        trigger_type=AutomationRule.TriggerTypes.APPOINTMENT_COMPLETED,
        entity=appointment,
        payload={"trigger_type": AutomationRule.TriggerTypes.APPOINTMENT_COMPLETED, "appointment_id": appointment.id},
    )


def schedule_appointment_followups(appointment, *, responsible_user=None):
    if appointment.status in {Appointment.Statuses.CANCELLED, Appointment.Statuses.COMPLETED, Appointment.Statuses.NO_SHOW}:
        return []

    cancel_appointment_followups(appointment)
    now = timezone.now()
    notifications = []
    for kind, label, send_at, text, channel in _appointment_followup_specs(appointment):
        if send_at <= now:
            send_at = now + timedelta(minutes=5)
        recipient = None if channel != Notification.Channels.SYSTEM else (responsible_user or appointment.business.owner)
        notifications.append(
            Notification.objects.create(
                business=appointment.business,
                recipient=recipient,
                client=appointment.client,
                appointment=appointment,
                channel=channel,
                category=Notification.Categories.SALES,
                priority=Notification.Priorities.HIGH if kind == "confirmation" else Notification.Priorities.NORMAL,
                text=text,
                send_at=send_at,
                status=Notification.Statuses.PENDING,
                action_url=f"/app/calendar?appointment={appointment.id}",
                action_label=label,
            )
        )
    return notifications


def schedule_post_service_followup(appointment, *, responsible_user=None):
    if appointment.status != Appointment.Statuses.COMPLETED:
        return None
    setting = get_appointment_message_setting(appointment.business, AppointmentMessageSetting.Scenarios.THANK_YOU)
    if not setting.is_enabled:
        return None
    Notification.objects.filter(
        business=appointment.business,
        appointment=appointment,
        status=Notification.Statuses.PENDING,
        action_label=APPOINTMENT_THANK_YOU_LABEL,
    ).update(status=Notification.Statuses.CANCELLED, updated_at=timezone.now())

    channel = _appointment_notification_channel(appointment.client, setting.channel_policy)
    recipient = None if channel != Notification.Channels.SYSTEM else (responsible_user or appointment.business.owner)
    send_at = max(timezone.now() + timedelta(minutes=5), appointment.end_at + timedelta(minutes=setting.offset_minutes))
    return Notification.objects.create(
        business=appointment.business,
        recipient=recipient,
        client=appointment.client,
        appointment=appointment,
        channel=channel,
        category=Notification.Categories.SALES,
        priority=Notification.Priorities.NORMAL,
        text=render_appointment_message(appointment, setting.template_text),
        send_at=send_at,
        status=Notification.Statuses.PENDING,
        action_url=f"/app/calendar?appointment={appointment.id}",
        action_label=APPOINTMENT_THANK_YOU_LABEL,
    )


def cancel_appointment_followups(appointment):
    labels = {APPOINTMENT_CONFIRMATION_LABEL, APPOINTMENT_REMINDER_LABEL, APPOINTMENT_THANK_YOU_LABEL}
    return Notification.objects.filter(
        business=appointment.business,
        appointment=appointment,
        status=Notification.Statuses.PENDING,
        action_label__in=labels,
    ).update(status=Notification.Statuses.CANCELLED, updated_at=timezone.now())


def _appointment_followup_specs(appointment):
    specs = []
    for scenario in [AppointmentMessageSetting.Scenarios.CONFIRMATION, AppointmentMessageSetting.Scenarios.REMINDER]:
        setting = get_appointment_message_setting(appointment.business, scenario)
        if not setting.is_enabled:
            continue
        specs.append(
            (
                scenario,
                setting.label,
                appointment.start_at + timedelta(minutes=setting.offset_minutes),
                render_appointment_message(appointment, setting.template_text),
                _appointment_notification_channel(appointment.client, setting.channel_policy),
            )
        )
    return specs


def ensure_appointment_message_settings(business):
    settings = []
    for scenario, defaults in APPOINTMENT_MESSAGE_DEFAULTS.items():
        setting, _ = AppointmentMessageSetting.objects.get_or_create(
            business=business,
            scenario=scenario,
            defaults={
                "label": defaults["label"],
                "offset_minutes": defaults["offset_minutes"],
                "template_text": defaults["template_text"],
                "channel_policy": AppointmentMessageSetting.ChannelPolicies.AUTO,
                "is_enabled": True,
            },
        )
        settings.append(setting)
    return settings


def get_appointment_message_setting(business, scenario):
    setting = AppointmentMessageSetting.objects.filter(business=business, scenario=scenario).first()
    if setting:
        return setting
    defaults = APPOINTMENT_MESSAGE_DEFAULTS[scenario]
    return AppointmentMessageSetting(
        business=business,
        scenario=scenario,
        label=defaults["label"],
        offset_minutes=defaults["offset_minutes"],
        template_text=defaults["template_text"],
        channel_policy=AppointmentMessageSetting.ChannelPolicies.AUTO,
        is_enabled=True,
    )


def render_appointment_message(appointment, template_text):
    local_start = timezone.localtime(appointment.start_at, _business_zone(appointment.business))
    local_end = timezone.localtime(appointment.end_at, _business_zone(appointment.business))
    address = appointment.business.address or ""
    values = {
        "business_name": appointment.business.name,
        "client_name": appointment.client.full_name or appointment.client.phone or "клиент",
        "service_name": appointment.service.name,
        "resource_name": appointment.resource.name if appointment.resource_id else "",
        "resource_text": f" у {appointment.resource.name}" if appointment.resource_id else "",
        "date": local_start.strftime("%d.%m"),
        "time": local_start.strftime("%H:%M"),
        "end_time": local_end.strftime("%H:%M"),
        "address": address,
        "address_text": f" Адрес: {address}." if address else "",
    }
    return template_text.format_map(_SafeFormatDict(values))


def _appointment_notification_channel(client, channel_policy):
    if channel_policy == AppointmentMessageSetting.ChannelPolicies.AUTO:
        return _preferred_client_channel(client)
    return channel_policy


def _preferred_client_channel(client):
    if client.telegram_id:
        return Notification.Channels.TELEGRAM
    if client.whatsapp_id:
        return Notification.Channels.WHATSAPP
    if client.email:
        return Notification.Channels.EMAIL
    if client.phone:
        return Notification.Channels.SMS
    return Notification.Channels.SYSTEM


class _SafeFormatDict(dict):
    def __missing__(self, key):
        return "{" + key + "}"
