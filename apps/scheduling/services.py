from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db import transaction
from django.utils import timezone

from apps.analytics.models import AnalyticsEvent
from apps.leads.models import Lead
from apps.notifications.models import Notification
from apps.scheduling.models import Appointment, WorkingHours


SLOT_STEP_MINUTES = 30

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


def get_available_slots(business, service, date, resource=None, after_time=None):
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
def create_appointment_from_lead(lead, service, start_at, resource=None):
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
        source=Appointment.Sources.MANUAL,
    )
    lead.service = service
    lead.status = Lead.Statuses.APPOINTMENT_CREATED
    lead.save(update_fields=["service", "status", "updated_at"])

    AnalyticsEvent.objects.create(
        business=lead.business,
        client=lead.client,
        event_type=AnalyticsEvent.EventTypes.APPOINTMENT_CREATED,
        source=appointment.source,
        metadata={"appointment_id": appointment.id, "lead_id": lead.id},
    )
    Notification.objects.create(
        business=lead.business,
        recipient=lead.responsible_user or lead.business.owner,
        client=lead.client,
        appointment=appointment,
        channel=Notification.Channels.SYSTEM,
        text=f"Reminder: appointment for {service.name} at {appointment.start_at:%Y-%m-%d %H:%M}",
        send_at=appointment.start_at - timedelta(hours=2),
        status=Notification.Statuses.PENDING,
    )

    return appointment
