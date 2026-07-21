from datetime import timedelta
from string import Formatter

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from apps.activities.models import ActivityEvent
from apps.activities.segments import evaluate_segment_queryset
from apps.activities.services import create_activity_event
from apps.businesses.models import BusinessMember
from apps.clients.models import Client
from apps.core.audit import write_audit_log
from apps.core.models import AuditLog
from apps.integrations.connectors import normalize_business_event
from apps.integrations.sanitization import sanitize_error_payload, sanitize_error_text
from apps.notifications.models import Notification
from apps.notifications.routing import create_role_notification
from apps.outreach.models import OutreachCampaign, OutreachConsent, OutreachRecipient
from apps.scheduling.services import APPOINTMENT_CONFIRMATION_LABEL, APPOINTMENT_REMINDER_LABEL, APPOINTMENT_THANK_YOU_LABEL


WHATSAPP_TEMPLATE_REQUIRED_REASON = "WhatsApp campaign requires an approved template."
OPT_IN_REQUIRED_REASON = "Client has no opt-in for this channel."
OPTED_OUT_REASON = "Client opted out from this channel."
SUPPORTED_TEMPLATE_VARIABLES = {"client_name", "phone", "email", "business_name", "channel"}
APPOINTMENT_AUTOMATION_SCENARIOS = [
    {
        "key": "appointment_confirmation",
        "label": APPOINTMENT_CONFIRMATION_LABEL,
        "trigger": "За 24 часа до записи",
        "description": "Просит клиента подтвердить запись или предупредить о переносе.",
    },
    {
        "key": "appointment_reminder",
        "label": APPOINTMENT_REMINDER_LABEL,
        "trigger": "За 2 часа до записи",
        "description": "Напоминает клиенту о времени, услуге, мастере и адресе.",
    },
    {
        "key": "post_service_thank_you",
        "label": APPOINTMENT_THANK_YOU_LABEL,
        "trigger": "Через 30 минут после завершения визита",
        "description": "Благодарит клиента и мягко предлагает повторную запись.",
    },
]
ERROR_KEYWORDS = {
    "channel_not_connected": ("channel is not connected", "канал не подключ", "not connected"),
    "missing_recipient": ("channel id is missing", "recipient", "chat not found"),
    "provider_disabled": ("disabled", "provider is not enabled"),
    "provider_credentials": ("credentials are missing", "access token", "unauthorized", "forbidden", "invalid token"),
    "template_required": ("template", "approved"),
    "sms_not_configured": ("sms provider is not configured",),
}
RETRYABLE_ERROR_CODES = {"provider_error", "channel_not_connected", "provider_credentials"}
OUTREACH_ROLES = {
    BusinessMember.Roles.ADMIN,
    BusinessMember.Roles.MANAGER,
    BusinessMember.Roles.MARKETER,
}
OWNER_ADMIN_ROLES = {
    BusinessMember.Roles.OWNER,
    BusinessMember.Roles.ADMIN,
}


def channel_recipient_id(client, channel):
    if channel == OutreachCampaign.Channels.TELEGRAM:
        return client.telegram_id
    if channel == OutreachCampaign.Channels.WHATSAPP:
        return client.whatsapp_id or client.phone
    return ""


def campaign_audience_queryset(campaign):
    queryset = Client.objects.filter(business=campaign.business, is_archived=False)
    if campaign.audience_type == OutreachCampaign.AudienceTypes.SEGMENT:
        if campaign.segment is None or campaign.segment.business_id != campaign.business_id:
            return queryset.none()
        queryset = evaluate_segment_queryset(campaign.segment)
    return queryset.filter(_channel_filter(campaign.channel)).distinct()


def consent_for_client(client, channel):
    return OutreachConsent.objects.filter(business=client.business, client=client, channel=channel).first()


def can_receive_campaign(client, campaign):
    consent = consent_for_client(client, campaign.channel)
    if consent and consent.status == OutreachConsent.Statuses.OPTED_OUT:
        return False, OPTED_OUT_REASON
    if campaign.require_opt_in and (not consent or consent.status != OutreachConsent.Statuses.OPTED_IN):
        return False, OPT_IN_REQUIRED_REASON
    return True, ""


def validate_campaign_launch(campaign):
    if campaign.channel == OutreachCampaign.Channels.WHATSAPP and campaign.whatsapp_template_status != OutreachCampaign.TemplateStatuses.APPROVED:
        raise ValueError(WHATSAPP_TEMPLATE_REQUIRED_REASON)
    if campaign.rate_limit_per_minute < 1:
        raise ValueError("Rate limit must be greater than zero.")
    if campaign.batch_size < 1:
        raise ValueError("Batch size must be greater than zero.")


def _channel_filter(channel):
    if channel == OutreachCampaign.Channels.TELEGRAM:
        return Q(telegram_id__gt="")
    if channel == OutreachCampaign.Channels.WHATSAPP:
        return Q(whatsapp_id__gt="") | Q(phone__gt="")
    return Q(pk__isnull=True)


def render_message(template, client):
    values = {
        "client_name": client.full_name,
        "phone": client.phone,
        "email": client.email,
        "business_name": client.business.name,
        "channel": client.source,
    }
    return (template or "").format_map(_SafeTemplateValues(values))


def template_variables(text):
    variables = set()
    for _, field_name, _, _ in Formatter().parse(text or ""):
        if not field_name:
            continue
        variables.add(field_name.split(".", 1)[0].split("[", 1)[0])
    return variables


def unsupported_template_variables(text):
    return sorted(template_variables(text) - SUPPORTED_TEMPLATE_VARIABLES)


def record_explicit_consent(*, client, channel, source, note="", evidence=None):
    now = timezone.now()
    return OutreachConsent.objects.update_or_create(
        business=client.business,
        client=client,
        channel=channel,
        defaults={
            "status": OutreachConsent.Statuses.OPTED_IN,
            "source": source,
            "note": note,
            "evidence_json": evidence or {},
            "opted_in_at": now,
            "opted_out_at": None,
        },
    )[0]


def preview_campaign_audience(campaign, limit=5):
    if campaign.audience_type == OutreachCampaign.AudienceTypes.MANUAL:
        queryset = Client.objects.filter(
            business=campaign.business,
            id__in=campaign.recipients.values("client_id"),
            is_archived=False,
        ).filter(_channel_filter(campaign.channel))
    else:
        queryset = campaign_audience_queryset(campaign)
    eligible_count = 0
    suppressed_count = 0
    clients = []
    for client in queryset[:limit]:
        allowed, reason = can_receive_campaign(client, campaign)
        if allowed:
            eligible_count += 1
        else:
            suppressed_count += 1
        clients.append(
            {
                "id": client.id,
                "full_name": client.full_name,
                "phone": client.phone,
                "telegram_id": client.telegram_id,
                "whatsapp_id": client.whatsapp_id,
                "recipient_id": channel_recipient_id(client, campaign.channel),
                "eligible": allowed,
                "suppression_reason": reason,
            }
        )
    if queryset.count() > limit:
        for client in queryset[limit:]:
            allowed, _ = can_receive_campaign(client, campaign)
            if allowed:
                eligible_count += 1
            else:
                suppressed_count += 1
    return {
        "count": queryset.count(),
        "eligible_count": eligible_count,
        "suppressed_count": suppressed_count,
        "clients": clients,
    }


@transaction.atomic
def prepare_campaign_recipients(campaign, *, client_ids=None):
    if campaign.status not in {OutreachCampaign.Statuses.DRAFT, OutreachCampaign.Statuses.READY}:
        raise ValueError("Only draft or ready campaigns can be prepared.")

    if campaign.audience_type == OutreachCampaign.AudienceTypes.MANUAL:
        queryset = Client.objects.filter(business=campaign.business, id__in=client_ids or [], is_archived=False).filter(_channel_filter(campaign.channel))
    else:
        queryset = campaign_audience_queryset(campaign)

    created = 0
    skipped = 0
    for client in queryset:
        recipient_id = channel_recipient_id(client, campaign.channel)
        if not recipient_id:
            skipped += 1
            continue
        allowed, reason = can_receive_campaign(client, campaign)
        if not allowed:
            OutreachRecipient.objects.update_or_create(
                campaign=campaign,
                client=client,
                defaults={
                    "business": campaign.business,
                    "recipient_id": recipient_id,
                    "personalized_text": "",
                    "status": OutreachRecipient.Statuses.SKIPPED,
                    "error": reason,
                    "error_code": classify_delivery_error(reason),
                    "provider_result": {},
                    "skipped_reason": reason,
                },
            )
            skipped += 1
            continue
        _, was_created = OutreachRecipient.objects.update_or_create(
            campaign=campaign,
            client=client,
            defaults={
                "business": campaign.business,
                "recipient_id": recipient_id,
                "personalized_text": render_message(campaign.message_text, client),
                "status": OutreachRecipient.Statuses.QUEUED,
                "error": "",
                "error_code": "",
                "provider_result": {},
                "skipped_reason": "",
            },
        )
        created += 1 if was_created else 0

    campaign.status = OutreachCampaign.Statuses.READY
    campaign.save(update_fields=["status", "updated_at"])
    total = campaign.recipients.count()
    _write_campaign_activity(campaign, "outreach_prepared", {"created": created, "total": total, "skipped": skipped})
    _notify_outreach_team(
        campaign,
        text=f"Рассылка «{campaign.name}» подготовлена: {total} получателей, пропущено {skipped}.",
        priority=Notification.Priorities.NORMAL,
    )
    return {"created": created, "total": total, "skipped": skipped}


def launch_campaign(campaign):
    if campaign.status not in {OutreachCampaign.Statuses.READY, OutreachCampaign.Statuses.SCHEDULED}:
        reason = "Prepare campaign recipients before launch."
        _notify_outreach_blocked(campaign, reason)
        raise ValueError(reason)
    try:
        validate_campaign_launch(campaign)
    except ValueError as exc:
        _notify_outreach_blocked(campaign, sanitize_error_text(exc))
        raise

    with transaction.atomic():
        send_at = campaign.scheduled_at or timezone.now()
        queued = campaign.recipients.select_related("client").filter(status=OutreachRecipient.Statuses.QUEUED).order_by("id")
        created = 0
        for index, recipient in enumerate(queued[: campaign.batch_size]):
            stagger_seconds = int(index / max(1, campaign.rate_limit_per_minute) * 60)
            notification = Notification.objects.create(
                business=campaign.business,
                client=recipient.client,
                channel=campaign.channel,
                category=Notification.Categories.OUTREACH,
                priority=Notification.Priorities.NORMAL,
                text=recipient.personalized_text or render_message(campaign.message_text, recipient.client),
                send_at=send_at + timedelta(seconds=stagger_seconds),
                status=Notification.Statuses.PENDING,
                action_url=f"/app/clients?client={recipient.client_id}",
                action_label="Открыть клиента",
            )
            recipient.notification = notification
            recipient.status = OutreachRecipient.Statuses.PENDING
            recipient.save(update_fields=["notification", "status", "updated_at"])
            created += 1

        campaign.started_at = timezone.now()
        campaign.status = OutreachCampaign.Statuses.SCHEDULED if send_at > timezone.now() else OutreachCampaign.Statuses.RUNNING
        campaign.save(update_fields=["started_at", "status", "updated_at"])
        _write_campaign_activity(campaign, "outreach_launched", {"notifications": created, "send_at": send_at.isoformat()})
        _notify_outreach_team(
            campaign,
            text=f"Рассылка «{campaign.name}» запущена: создано уведомлений {created}.",
            priority=Notification.Priorities.NORMAL,
        )

    return {"notifications": created, "send_at": send_at}


@transaction.atomic
def cancel_campaign(campaign, *, request=None, reason=""):
    if campaign.status == OutreachCampaign.Statuses.SENT:
        raise ValueError("Sent campaigns cannot be cancelled.")

    previous_status = campaign.status
    cancellable_statuses = [
        OutreachRecipient.Statuses.QUEUED,
        OutreachRecipient.Statuses.PENDING,
    ]
    recipients = campaign.recipients.filter(
        business=campaign.business,
        status__in=cancellable_statuses,
    )
    notification_ids = list(recipients.exclude(notification_id__isnull=True).values_list("notification_id", flat=True))
    cancelled_recipients = recipients.update(
        status=OutreachRecipient.Statuses.CANCELLED,
        error_code="cancelled",
        skipped_reason=reason or "Campaign cancelled.",
        updated_at=timezone.now(),
    )
    cancelled_notifications = Notification.objects.filter(
        business=campaign.business,
        id__in=notification_ids,
        status=Notification.Statuses.PENDING,
    ).update(status=Notification.Statuses.CANCELLED, updated_at=timezone.now())

    campaign.status = OutreachCampaign.Statuses.CANCELLED
    campaign.finished_at = timezone.now()
    campaign.save(update_fields=["status", "finished_at", "updated_at"])

    metadata = {
        "previous_status": previous_status,
        "new_status": campaign.status,
        "cancelled_recipients": cancelled_recipients,
        "cancelled_notifications": cancelled_notifications,
        "reason": reason or "",
        "actor_id": getattr(getattr(request, "user", None), "id", None),
    }
    _write_campaign_activity(campaign, "outreach_cancelled", metadata, actor=getattr(request, "user", None))
    normalize_business_event(
        business=campaign.business,
        source="outreach",
        event_type="outreach.campaign_cancelled",
        external_id=f"outreach:campaign:{campaign.id}:cancelled",
        payload={
            "campaign_id": campaign.id,
            "campaign_name": campaign.name,
            "channel": campaign.channel,
            **metadata,
        },
    )
    write_audit_log(
        request,
        AuditLog.Actions.UPDATE,
        campaign,
        business=campaign.business,
        metadata={"kind": "lifecycle", "event_type": "outreach_cancelled", **metadata},
    )
    _notify_outreach_team(
        campaign,
        text=f"Рассылка «{campaign.name}» отменена: отменено получателей {cancelled_recipients}.",
        priority=Notification.Priorities.NORMAL,
    )
    return {
        "previous_status": previous_status,
        "cancelled_recipients": cancelled_recipients,
        "cancelled_notifications": cancelled_notifications,
    }


@transaction.atomic
def retry_failed_recipients(campaign, *, retryable_only=False, delay_minutes=0):
    if campaign.status not in {OutreachCampaign.Statuses.RUNNING, OutreachCampaign.Statuses.SENT, OutreachCampaign.Statuses.READY}:
        raise ValueError("Only ready, running or sent campaigns can retry failed recipients.")
    recipients = campaign.recipients.filter(status=OutreachRecipient.Statuses.FAILED)
    failed_total = recipients.count()
    if retryable_only:
        recipients = recipients.filter(error_code__in=RETRYABLE_ERROR_CODES)
    count = recipients.count()
    recipients.update(
        notification=None,
        status=OutreachRecipient.Statuses.QUEUED,
        error="",
        error_code="",
        provider_result={},
        skipped_reason="",
        sent_at=None,
        updated_at=timezone.now(),
    )
    if count:
        campaign.status = OutreachCampaign.Statuses.READY
        campaign.finished_at = None
        campaign.scheduled_at = timezone.now() + timezone.timedelta(minutes=max(0, int(delay_minutes or 0))) if delay_minutes else campaign.scheduled_at
        campaign.save(update_fields=["status", "finished_at", "scheduled_at", "updated_at"])
        _write_campaign_activity(
            campaign,
            "outreach_retry_failed",
            {"recipients": count, "failed_total": failed_total, "retryable_only": retryable_only, "delay_minutes": delay_minutes},
        )
        _notify_outreach_team(
            campaign,
            text=f"Рассылка «{campaign.name}»: {count} ошибок возвращены в очередь для повторной отправки.",
            priority=Notification.Priorities.NORMAL,
        )
    return {"queued": count, "skipped_non_retryable": failed_total - count}


def campaign_stats(campaign):
    counts = dict(campaign.recipients.values("status").annotate(count=Count("id")).values_list("status", "count"))
    errors = dict(
        campaign.recipients.exclude(error_code="")
        .values("error_code")
        .annotate(count=Count("id"))
        .values_list("error_code", "count")
    )
    total = campaign.recipients.count()
    sent = counts.get(OutreachRecipient.Statuses.SENT, 0)
    failed = counts.get(OutreachRecipient.Statuses.FAILED, 0)
    skipped = counts.get(OutreachRecipient.Statuses.SKIPPED, 0)
    pending = counts.get(OutreachRecipient.Statuses.PENDING, 0) + counts.get(OutreachRecipient.Statuses.QUEUED, 0)
    return {
        "campaign_id": campaign.id,
        "status": campaign.status,
        "total": total,
        "sent": sent,
        "failed": failed,
        "skipped": skipped,
        "pending": pending,
        "delivery_rate": round(sent / total * 100, 2) if total else 0,
        "failure_rate": round(failed / total * 100, 2) if total else 0,
        "suppression_rate": round(skipped / total * 100, 2) if total else 0,
        "errors": [{"code": code, "count": count, "label": error_label(code)} for code, count in sorted(errors.items())],
        "retryable_failed": sum(count for code, count in errors.items() if code in RETRYABLE_ERROR_CODES),
    }


def campaign_launch_checklist(campaign):
    stats = campaign_stats(campaign)
    audience_preview = preview_campaign_audience(campaign)
    checks = [
        _check("message", "Текст сообщения заполнен", bool((campaign.message_text or "").strip())),
        _check("audience", "Аудитория выбрана", campaign.audience_type != OutreachCampaign.AudienceTypes.SEGMENT or bool(campaign.segment_id)),
        _check("prepared", "Очередь получателей подготовлена", stats["total"] > 0 and stats["pending"] > 0),
        _check("eligible", "Есть получатели для отправки", stats["pending"] > 0),
        _check("rate_limit", "Rate limit и batch корректны", campaign.rate_limit_per_minute > 0 and campaign.batch_size > 0),
        _check("opt_in", "Opt-in проверен", not campaign.require_opt_in or audience_preview["suppressed_count"] == 0 or stats["pending"] > 0),
    ]
    if campaign.channel == OutreachCampaign.Channels.WHATSAPP:
        checks.append(_check("whatsapp_template", "WhatsApp template approved", campaign.whatsapp_template_status == OutreachCampaign.TemplateStatuses.APPROVED))
        checks.append(_check("whatsapp_template_name", "WhatsApp template name указан", bool(campaign.whatsapp_template_name)))
    can_launch = all(item["ok"] for item in checks) and campaign.status in {OutreachCampaign.Statuses.READY, OutreachCampaign.Statuses.SCHEDULED}
    return {
        "can_launch": can_launch,
        "status": campaign.status,
        "stats": stats,
        "checks": checks,
    }


def appointment_automation_status(business):
    labels = [scenario["label"] for scenario in APPOINTMENT_AUTOMATION_SCENARIOS]
    counts = {
        label: {
            Notification.Statuses.PENDING: 0,
            Notification.Statuses.SENT: 0,
            Notification.Statuses.FAILED: 0,
            Notification.Statuses.CANCELLED: 0,
        }
        for label in labels
    }
    rows = (
        Notification.objects.filter(
            business=business,
            category=Notification.Categories.SALES,
            action_label__in=labels,
        )
        .values("action_label", "status")
        .annotate(total=Count("id"))
    )
    for row in rows:
        counts[row["action_label"]][row["status"]] = row["total"]

    scenarios = []
    for scenario in APPOINTMENT_AUTOMATION_SCENARIOS:
        scenario_counts = counts[scenario["label"]]
        scenarios.append(
            {
                **scenario,
                "enabled": True,
                "channel_policy": "Telegram -> WhatsApp -> Email -> SMS -> System fallback",
                "counts": {
                    "pending": scenario_counts[Notification.Statuses.PENDING],
                    "sent": scenario_counts[Notification.Statuses.SENT],
                    "failed": scenario_counts[Notification.Statuses.FAILED],
                    "cancelled": scenario_counts[Notification.Statuses.CANCELLED],
                },
            }
        )

    failed_notifications = [
        {
            "id": notification.id,
            "label": notification.action_label,
            "channel": notification.channel,
            "client_name": notification.client.full_name if notification.client_id else "",
            "client_phone": notification.client.phone if notification.client_id else "",
            "appointment_id": notification.appointment_id,
            "send_at": notification.send_at,
            "action_url": notification.action_url,
        }
        for notification in Notification.objects.select_related("client", "appointment")
        .filter(
            business=business,
            category=Notification.Categories.SALES,
            action_label__in=labels,
            status=Notification.Statuses.FAILED,
        )
        .order_by("-updated_at", "-id")[:8]
    ]

    return {
        "business": business.id,
        "enabled": True,
        "scenarios": scenarios,
        "total_pending": sum(item["counts"]["pending"] for item in scenarios),
        "total_failed": sum(item["counts"]["failed"] for item in scenarios),
        "failed_notifications": failed_notifications,
    }


def classify_delivery_error(reason):
    normalized = str(reason or "").lower()
    if not normalized:
        return ""
    for code, keywords in ERROR_KEYWORDS.items():
        if any(keyword in normalized for keyword in keywords):
            return code
    if "opt-in" in normalized:
        return "opt_in_required"
    if "opted out" in normalized:
        return "opted_out"
    return "provider_error"


def error_label(code):
    return {
        "channel_not_connected": "Канал не подключен",
        "missing_recipient": "Нет channel id клиента",
        "provider_disabled": "Провайдер отключен",
        "provider_credentials": "Неверные или отсутствующие credentials",
        "template_required": "WhatsApp template не готов",
        "sms_not_configured": "SMS provider не настроен",
        "opt_in_required": "Нет согласия клиента",
        "opted_out": "Клиент отписан",
        "cancelled": "Отменено",
        "provider_error": "Ошибка провайдера",
    }.get(code, code or "Без кода")


def _check(key, label, ok):
    return {"key": key, "label": label, "ok": bool(ok)}


@transaction.atomic
def refresh_campaign_status(campaign):
    for recipient in campaign.recipients.select_related("notification").filter(notification__isnull=False):
        notification_status = recipient.notification.status
        if notification_status == Notification.Statuses.SENT:
            recipient.status = OutreachRecipient.Statuses.SENT
            recipient.sent_at = recipient.notification.updated_at
            recipient.error = ""
            recipient.error_code = ""
            recipient.provider_result = _notification_delivery_result(recipient.notification)
        elif notification_status == Notification.Statuses.FAILED:
            recipient.status = OutreachRecipient.Statuses.FAILED
            result = sanitize_error_payload(_notification_delivery_result(recipient.notification))
            reason = sanitize_error_text(_delivery_reason(result) or "Notification delivery failed.")
            recipient.error = reason
            recipient.error_code = classify_delivery_error(reason)
            recipient.provider_result = result
        elif notification_status == Notification.Statuses.CANCELLED:
            recipient.status = OutreachRecipient.Statuses.CANCELLED
            recipient.error_code = "cancelled"
        else:
            continue
        recipient.save(update_fields=["status", "sent_at", "error", "error_code", "provider_result", "updated_at"])

    counts = dict(campaign.recipients.values("status").annotate(count=Count("id")).values_list("status", "count"))
    active = counts.get(OutreachRecipient.Statuses.QUEUED, 0) + counts.get(OutreachRecipient.Statuses.PENDING, 0)
    if campaign.status in {OutreachCampaign.Statuses.RUNNING, OutreachCampaign.Statuses.SCHEDULED} and active == 0:
        campaign.status = OutreachCampaign.Statuses.SENT
        campaign.finished_at = timezone.now()
        campaign.save(update_fields=["status", "finished_at", "updated_at"])
        failed = counts.get(OutreachRecipient.Statuses.FAILED, 0)
        skipped = counts.get(OutreachRecipient.Statuses.SKIPPED, 0)
        priority = Notification.Priorities.HIGH if failed else Notification.Priorities.NORMAL
        _write_campaign_activity(campaign, "outreach_finished", {"counts": counts})
        _notify_outreach_team(
            campaign,
            text=f"Рассылка «{campaign.name}» завершена: отправлено {counts.get(OutreachRecipient.Statuses.SENT, 0)}, ошибок {failed}, пропущено {skipped}.",
            priority=priority,
        )
    return counts


def _notify_outreach_blocked(campaign, reason):
    _write_campaign_activity(campaign, "outreach_blocked", {"reason": reason})
    _notify_outreach_team(
        campaign,
        text=f"Запуск рассылки «{campaign.name}» заблокирован: {reason}",
        priority=Notification.Priorities.HIGH,
    )
    if "template" in reason.lower() or "whatsapp" in reason.lower():
        _notify_owner_admin_service_recommendation(
            campaign,
            text=(
                "ИИ-помощник: WhatsApp-рассылка не готова к запуску. "
                "Подключите официальный WhatsApp-канал и утвердите template, чтобы бот мог отправлять сервисные сообщения."
            ),
        )


def _notify_outreach_team(campaign, *, text, priority):
    return create_role_notification(
        business=campaign.business,
        category=Notification.Categories.OUTREACH,
        priority=priority,
        text=text,
        action_url=f"/app/outreach?campaign={campaign.id}",
        action_label="Открыть рассылку",
        roles=OUTREACH_ROLES,
        exclude_owner=False,
    )


def _notify_owner_admin_service_recommendation(campaign, *, text):
    return create_role_notification(
        business=campaign.business,
        category=Notification.Categories.AI_ALERTS,
        priority=Notification.Priorities.HIGH,
        text=text,
        action_url="/app/integrations",
        action_label="Подключить услугу",
        roles=OWNER_ADMIN_ROLES,
        exclude_owner=False,
    )


def _notification_delivery_result(notification):
    event = (
        ActivityEvent.objects.filter(
            business=notification.business,
            entity_type="Notification",
            entity_id=str(notification.id),
            event_type__in=["notification_failed", "notification_sent"],
        )
        .order_by("-created_at", "-id")
        .first()
    )
    if not event:
        return {}
    return event.metadata.get("result") or {}


def _delivery_reason(result):
    if not isinstance(result, dict):
        return str(result or "")
    if result.get("reason"):
        return str(result["reason"])
    nested = result.get("result")
    if isinstance(nested, dict) and nested.get("reason"):
        return str(nested["reason"])
    return ""


def _write_campaign_activity(campaign, event_type, metadata, *, actor=None):
    create_activity_event(
        business=campaign.business,
        event_type=event_type,
        instance=campaign,
        actor=actor if getattr(actor, "id", None) else None,
        category="automation",
        source="outreach",
        text=f"Рассылка «{campaign.name}»: {event_type}",
        metadata=metadata,
    )


class _SafeTemplateValues(dict):
    def __missing__(self, key):
        return ""
