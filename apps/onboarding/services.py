from datetime import time, timedelta

from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from apps.automations.models import AutomationAction, AutomationRule
from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.businesses.access import ensure_default_roles
from apps.businesses.models import Business
from apps.clients.models import Client
from apps.conversations.models import QuickReplyTemplate
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.integrations.connectors import normalize_business_event, update_connector_health
from apps.integrations.models import BusinessConnector
from apps.leads.models import Lead
from apps.onboarding.templates import NICHES, get_niche_template
from apps.scheduling.models import Appointment, Resource, WorkingHours
from apps.services.models import Service
from apps.tasks.models import Task


def list_onboarding_templates():
    return [
        {
            "key": key,
            "label": template["label"],
            "services": [service[0] for service in template["services"]],
            "resources": [resource[0] for resource in template["resources"]],
            "stages": template["stages"],
            "quick_replies": [reply[0] for reply in template["quick_replies"]],
        }
        for key, template in NICHES.items()
    ]


@transaction.atomic
def apply_niche_template(business: Business, niche: str, actor=None):
    template = get_niche_template(niche)
    business.business_type = niche if niche in NICHES else Business.BusinessTypes.OTHER
    business.save(update_fields=["business_type", "updated_at"])

    ensure_default_roles(business)
    pipeline = _apply_pipeline(business, niche, template["stages"])
    services = _apply_services(business, template["services"])
    resources = _apply_resources(business, template["resources"])
    _apply_working_hours(business)
    quick_replies = _apply_quick_replies(business, template["quick_replies"])
    automations = _apply_automations(business)
    checklist = get_onboarding_status(business)

    return {
        "business": business,
        "template_key": business.business_type,
        "pipeline": pipeline,
        "services_count": len(services),
        "resources_count": len(resources),
        "quick_replies_count": len(quick_replies),
        "automations_count": len(automations),
        "checklist": checklist,
    }


@transaction.atomic
def create_demo_data(business: Business, actor=None):
    template = get_niche_template(business.business_type)
    service = business.services.filter(is_active=True).first()
    if service is None:
        service = _apply_services(business, template["services"])[0]
    resource = business.resources.filter(is_active=True).first()
    if resource is None:
        resource = _apply_resources(business, template["resources"])[0]
    _apply_working_hours(business)
    pipeline = business.pipelines.filter(is_default=True).first() or _apply_pipeline(business, business.business_type, template["stages"])
    stage = pipeline.stages.order_by("order").first()

    client, _ = Client.objects.get_or_create(
        business=business,
        phone="+77010001010",
        defaults={
            "full_name": "Демо клиент",
            "email": "demo-client@example.com",
            "source": Client.Sources.MANUAL,
            "notes": "Создано onboarding wizard для безопасного просмотра CRM.",
        },
    )
    lead, _ = Lead.objects.get_or_create(
        business=business,
        client=client,
        message="Хочу записаться и узнать ближайшее свободное время.",
        defaults={
            "service": service,
            "source": Lead.Sources.MANUAL,
            "status": Lead.Statuses.NEW,
            "responsible_user": actor if actor and actor.is_authenticated else None,
        },
    )
    deal = None
    if stage:
        deal, _ = Deal.objects.get_or_create(
            business=business,
            client=client,
            lead=lead,
            title=f"Демо сделка: {service.name}",
            defaults={
                "pipeline": pipeline,
                "stage": stage,
                "amount": service.price_from or 0,
                "probability": stage.probability,
                "owner": actor if actor and actor.is_authenticated else None,
                "source": "onboarding",
            },
        )

    start_at = _next_business_hour()
    appointment, _ = Appointment.objects.get_or_create(
        business=business,
        client=client,
        lead=lead,
        service=service,
        start_at=start_at,
        defaults={
            "resource": resource,
            "end_at": start_at + timedelta(minutes=service.duration_minutes),
            "source": Appointment.Sources.MANUAL,
            "notes": "Демо запись для проверки календаря.",
        },
    )
    Task.objects.get_or_create(
        business=business,
        title="Проверить демо-заявку и создать реальную",
        defaults={
            "description": "Первый рабочий сценарий: открыть заявку, связаться с клиентом и создать запись.",
            "client": client,
            "lead": lead,
            "deal": deal,
            "appointment": appointment,
            "assignee": actor if actor and actor.is_authenticated else None,
            "created_by": actor if actor and actor.is_authenticated else None,
            "priority": Task.Priorities.HIGH,
            "due_at": timezone.now() + timedelta(hours=2),
        },
    )
    status = get_onboarding_status(business)
    status["mode"] = "demo"
    status["demo"] = True
    return status


@transaction.atomic
def setup_first_channel(business: Business, channel: str = BotChannel.Channels.WEBSITE, actor=None):
    if channel not in {BotChannel.Channels.WEBSITE, BotChannel.Channels.TELEGRAM, BotChannel.Channels.WHATSAPP}:
        raise ValueError("Unsupported onboarding channel.")

    bot, _ = Bot.objects.get_or_create(
        business=business,
        name="Zani assistant",
        defaults={
            "status": Bot.Statuses.ACTIVE,
            "settings_json": {"created_by": "onboarding", "handoff_mode": "manager_first"},
        },
    )
    if bot.status != Bot.Statuses.ACTIVE:
        bot.status = Bot.Statuses.ACTIVE
        bot.save(update_fields=["status", "updated_at"])

    channel_config = {
        "created_by": "onboarding",
        "provider_mode": "mock",
        "handoff_required_by_default": True,
    }
    bot_channel, _ = BotChannel.objects.get_or_create(
        bot=bot,
        channel=channel,
        defaults={
            "status": BotChannel.Statuses.ACTIVE,
            "config_json": channel_config,
        },
    )
    bot_channel.status = BotChannel.Statuses.ACTIVE
    bot_channel.config_json = {**channel_config, **(bot_channel.config_json or {})}
    bot_channel.save(update_fields=["status", "config_json", "updated_at"])

    provider = channel
    connector, _ = BusinessConnector.objects.get_or_create(
        business=business,
        provider=provider,
        name=f"{channel.title()} onboarding channel",
        defaults={
            "capability": BusinessConnector.Capabilities.COMMUNICATIONS if channel != BotChannel.Channels.WEBSITE else BusinessConnector.Capabilities.SALES,
            "auth_type": BusinessConnector.AuthTypes.NONE if channel == BotChannel.Channels.WEBSITE else BusinessConnector.AuthTypes.TOKEN,
            "created_by": actor if actor and actor.is_authenticated else None,
            "config_json": {"bot_channel_id": bot_channel.id, "created_by": "onboarding"},
        },
    )
    connector.config_json = {**(connector.config_json or {}), "bot_channel_id": bot_channel.id, "created_by": "onboarding"}
    update_connector_health(connector, status=BusinessConnector.Statuses.CONNECTED if channel == BotChannel.Channels.WEBSITE else BusinessConnector.Statuses.NEEDS_ATTENTION)

    normalize_business_event(
        business=business,
        connector=connector,
        source=provider,
        event_type="channel_connected",
        external_id=f"onboarding-{business.id}-{channel}",
        payload={"channel": channel, "bot_channel_id": bot_channel.id, "public_token": str(bot_channel.public_token)},
    )
    return {
        "business": business.id,
        "bot": bot.id,
        "channel": bot_channel.id,
        "channel_type": channel,
        "connector": connector.id,
        "public_token": str(bot_channel.public_token),
        "status": get_onboarding_status(business),
    }


@transaction.atomic
def create_first_channel_message(business: Business, actor=None):
    setup = setup_first_channel(business, BotChannel.Channels.WEBSITE, actor=actor)
    channel = BotChannel.objects.select_related("bot", "bot__business").get(id=setup["channel"])
    client, _ = Client.objects.get_or_create(
        business=business,
        phone="+77010002020",
        defaults={
            "full_name": "Первый клиент из сайта",
            "email": "website-lead@example.com",
            "source": Client.Sources.WEBSITE,
            "notes": "Создано onboarding сценарием первого сообщения.",
        },
    )
    lead, _ = Lead.objects.get_or_create(
        business=business,
        client=client,
        source=Lead.Sources.WEBSITE,
        message="Здравствуйте, хочу узнать ближайшее свободное время.",
        defaults={
            "service": business.services.filter(is_active=True).first(),
            "status": Lead.Statuses.NEW,
            "responsible_user": actor if actor and actor.is_authenticated else None,
        },
    )
    conversation, _ = BotConversation.objects.get_or_create(
        business=business,
        bot=channel.bot,
        channel=BotConversation.Channels.WEBSITE,
        external_user_id="onboarding-website-visitor",
        defaults={
            "client": client,
            "lead": lead,
            "assigned_to": actor if actor and actor.is_authenticated else None,
            "handoff_required": True,
            "handoff_reason": "Onboarding test message requires manager reply.",
            "metadata_json": {"source": "onboarding"},
        },
    )
    conversation.client = conversation.client or client
    conversation.lead = conversation.lead or lead
    conversation.handoff_required = True
    conversation.handoff_reason = "Onboarding test message requires manager reply."
    conversation.assigned_to = conversation.assigned_to or (actor if actor and actor.is_authenticated else None)
    conversation.save(update_fields=["client", "lead", "handoff_required", "handoff_reason", "assigned_to", "updated_at"])

    message, _ = BotMessage.objects.get_or_create(
        conversation=conversation,
        direction=BotMessage.Directions.INBOUND,
        external_message_id="onboarding-first-message",
        defaults={
            "sender_type": BotMessage.SenderTypes.CLIENT,
            "text": "Здравствуйте, хочу записаться. Когда есть ближайшее окно?",
            "payload_json": {"source": "onboarding"},
        },
    )
    conversation.last_message_at = message.created_at
    conversation.last_inbound_at = message.created_at
    conversation.unread_count = max(conversation.unread_count, 1)
    conversation.save(update_fields=["last_message_at", "last_inbound_at", "unread_count", "updated_at"])

    connector = BusinessConnector.objects.filter(business=business, provider=BusinessConnector.Providers.WEBSITE).first()
    normalize_business_event(
        business=business,
        connector=connector,
        source=BusinessConnector.Providers.WEBSITE,
        event_type="message_received",
        external_id=f"onboarding-message-{message.id}",
        payload={"conversation_id": conversation.id, "message_id": message.id, "lead_id": lead.id},
    )
    return {
        "business": business.id,
        "conversation": conversation.id,
        "message": message.id,
        "lead": lead.id,
        "client": client.id,
        "status": get_onboarding_status(business),
    }


def get_onboarding_status(business: Business):
    items = [
        _item("template", "Выбрать шаблон ниши", business.services.exists() and business.pipeline_stages.exists() and business.quick_reply_templates.exists()),
        _item("services", "Добавить услуги", business.services.filter(is_active=True).exists()),
        _item("resources", "Добавить ресурсы", business.resources.filter(is_active=True).exists()),
        _item("working_hours", "Настроить график", business.working_hours.exists()),
        _item("quick_replies", "Подготовить быстрые ответы", business.quick_reply_templates.filter(is_active=True).exists()),
        _item("automations", "Включить базовые автоматизации", business.automation_rules.exists()),
        _item("first_channel", "Подключить первый канал", business.business_connectors.exists() or business.bots.filter(channels__status=BotChannel.Statuses.ACTIVE).exists()),
        _item("first_message", "Получить первое сообщение", business.bot_conversations.exists()),
        _item("first_lead", "Создать первую заявку", business.leads.exists()),
        _item("first_appointment", "Создать первую запись", business.appointments.exists()),
    ]
    completed = sum(1 for item in items if item["is_completed"])
    return {
        "business": business.id,
        "progress": round((completed / len(items)) * 100),
        "completed": completed,
        "total": len(items),
        "items": items,
    }


def _apply_pipeline(business, niche, stage_names):
    pipeline = business.pipelines.filter(is_default=True).first()
    if pipeline is None:
        pipeline = Pipeline.objects.create(
            business=business,
            name="Основная воронка",
            slug="main-pipeline",
            is_default=True,
            template_key=f"onboarding_{niche}",
        )
    else:
        pipeline.name = "Основная воронка"
        pipeline.template_key = f"onboarding_{niche}"
        pipeline.save(update_fields=["name", "template_key", "updated_at"])
    if not pipeline.deals.exists():
        pipeline.stages.all().delete()
    for order, name in enumerate(stage_names, start=1):
        normalized = slugify(name)
        PipelineStage.objects.get_or_create(
            business=business,
            pipeline=pipeline,
            name=name,
            defaults={
                "order": order,
                "color": _stage_color(order, len(stage_names)),
                "probability": _stage_probability(order, len(stage_names)),
                "sla_minutes": 120 if order <= 3 else None,
                "is_won": order == len(stage_names) - 1 or normalized in {"won", "oplacheno", "uspeshno"},
                "is_lost": order == len(stage_names) or "lost" in normalized or "poteryana" in normalized,
            },
        )
    return pipeline


def _apply_services(business, service_specs):
    services = []
    for name, duration, price in service_specs:
        service = business.services.filter(name=name).first()
        if service is None:
            service = Service.objects.create(
                business=business,
                name=name,
                duration_minutes=duration,
                price_from=price,
                description="Создано из шаблона быстрого старта.",
            )
        services.append(service)
    return services


def _apply_resources(business, resource_specs):
    resources = []
    for name, resource_type in resource_specs:
        resource, _ = Resource.objects.get_or_create(
            business=business,
            name=name,
            defaults={"resource_type": resource_type, "is_active": True},
        )
        resources.append(resource)
    return resources


def _apply_working_hours(business):
    for weekday in range(6):
        WorkingHours.objects.update_or_create(
            business=business,
            resource=None,
            weekday=weekday,
            defaults={"start_time": time(9, 0), "end_time": time(18, 0), "is_day_off": False},
        )
    WorkingHours.objects.update_or_create(
        business=business,
        resource=None,
        weekday=6,
        defaults={"start_time": time(9, 0), "end_time": time(18, 0), "is_day_off": True},
    )


def _apply_quick_replies(business, reply_specs):
    replies = []
    for order, (title, text) in enumerate(reply_specs, start=1):
        reply = business.quick_reply_templates.filter(title=title).first()
        if reply is None:
            reply = QuickReplyTemplate.objects.create(
                business=business,
                title=title,
                text=text,
                category="onboarding",
                channel=QuickReplyTemplate.Channels.ALL,
                sort_order=order,
            )
        replies.append(reply)
    return replies


def _apply_automations(business):
    specs = [
        (
            "Новая заявка -> задача менеджеру",
            AutomationRule.TriggerTypes.LEAD_CREATED,
            "Создать follow-up задачу при появлении новой заявки.",
            {"title": "Связаться с новой заявкой", "priority": "high"},
        ),
        (
            "Новая запись -> подготовить визит",
            AutomationRule.TriggerTypes.APPOINTMENT_CREATED,
            "Создать задачу подготовки после записи.",
            {"title": "Подготовить запись клиента", "priority": "normal"},
        ),
    ]
    rules = []
    for order, (name, trigger, description, config) in enumerate(specs, start=1):
        rule, _ = AutomationRule.objects.get_or_create(
            business=business,
            name=name,
            defaults={"trigger_type": trigger, "description": description, "is_active": False, "priority": order * 10},
        )
        AutomationAction.objects.get_or_create(
            rule=rule,
            order=0,
            defaults={"action_type": AutomationAction.ActionTypes.CREATE_TASK, "config": config, "delay_seconds": 0},
        )
        rules.append(rule)
    return rules


def _item(key, title, is_completed):
    return {"key": key, "title": title, "is_completed": bool(is_completed)}


def _stage_color(order, total):
    palette = ["#06b6d4", "#2563eb", "#8b5cf6", "#f59e0b", "#16a34a", "#ef4444"]
    return palette[min(order - 1, len(palette) - 1 if order < total else len(palette) - 1)]


def _stage_probability(order, total):
    if order == total:
        return 0
    return min(100, round((order / max(total - 1, 1)) * 100))


def _next_business_hour():
    start_at = timezone.now().replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=1)
    if start_at.weekday() == 6:
        start_at += timedelta(days=1)
    return start_at
