from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db import transaction
from django.utils import timezone

from apps.analytics.models import AnalyticsEvent
from apps.leads.models import Lead
from apps.notifications.models import Notification
from apps.scheduling.models import Appointment, AppointmentMessageSetting, WorkingHours


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
    schedule_appointment_followups(appointment, responsible_user=lead.responsible_user)

    return appointment


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
                action_url=f"/dashboard/calendar?appointment={appointment.id}",
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
        action_url=f"/dashboard/calendar?appointment={appointment.id}",
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
